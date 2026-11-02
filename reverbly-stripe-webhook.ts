import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = { 'Content-Type': 'application/json' }

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function stripeSignatureError(body: string, signature: string | null, secret: string) {
  const trimmed = secret.trim()
  if (!signature || !trimmed) return 'Webhook secret is missing'
  const parts = signature.split(',').map((part) => {
    const index = part.indexOf('=')
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const
  })
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!timestamp || !signatures.length) return 'Stripe signature is malformed'
  if (Math.abs(Date.now() / 1000 - timestamp) > 60 * 60 * 24 * 7) return 'Stripe signature is older than 7 days'
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(trimmed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)))
  if (!signatures.some((value) => value === digest)) return 'Stripe signature does not match this endpoint secret'
  return ''
}

function periodEnd(subscription: Record<string, unknown>) {
  if (subscription.current_period_end) return subscription.current_period_end
  const items = (subscription.items as { data?: { current_period_end?: number }[] } | undefined)?.data ?? []
  return items[0]?.current_period_end ?? null
}

function planFor(subscription: Record<string, unknown>) {
  const status = String(subscription.status)
  if (status === 'canceled' || status === 'incomplete_expired' || status === 'unpaid' || status === 'paused') return 'free'
  const items = (subscription.items as { data?: { price?: { id?: string } }[] } | undefined)?.data ?? []
  const priceId = items[0]?.price?.id ?? ''
  const plusId = Deno.env.get('STRIPE_PLUS_PRICE_ID') ?? ''
  const proId = Deno.env.get('STRIPE_PRO_PRICE_ID') ?? ''
  if (plusId && priceId === plusId) return 'plus'
  if (proId && priceId === proId) return status === 'trialing' ? 'trialing' : 'pro'
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'pro'
  return 'free'
}

async function profileIdFor(supabase: ReturnType<typeof createClient>, customerId: string, email?: string | null) {
  let customerEmail = email
  if (!customerEmail) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (stripeKey) {
      const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${stripeKey}` }
      })
      if (response.ok) customerEmail = (await response.json()).email
    }
  }
  if (!customerEmail) return null
  const { data, error } = await supabase.from('profiles').select('id').ilike('email', customerEmail).maybeSingle()
  if (error) throw error
  if (data?.id) return data.id
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = listed.data?.users?.find((entry) => entry.email?.toLowerCase() === customerEmail.toLowerCase())
  return user?.id ?? null
}

async function saveSubscription(supabase: ReturnType<typeof createClient>, userId: string, subscription: Record<string, unknown>) {
  const status = String(subscription.status)
  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: String(subscription.customer),
    stripe_subscription_id: String(subscription.id),
    status,
    trial_ends_at: subscription.trial_end ? new Date(Number(subscription.trial_end) * 1000).toISOString() : null,
    current_period_ends_at: periodEnd(subscription) ? new Date(Number(periodEnd(subscription)) * 1000).toISOString() : null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })
  if (error) throw error
  const result = await supabase.from('profiles').update({ plan: planFor(subscription), updated_at: new Date().toISOString() }).eq('id', userId)
  if (result.error) throw result.error
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await request.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    const signatureError = await stripeSignatureError(body, request.headers.get('stripe-signature'), webhookSecret)
    if (signatureError) {
      return new Response(JSON.stringify({ error: signatureError }), { status: 400, headers: corsHeaders })
    }

    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    const serviceKey = keys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!Deno.env.get('SUPABASE_URL') || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Supabase is not configured' }), { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!)
    const event = JSON.parse(body)
    const object = event.data.object

    if (event.type === 'checkout.session.completed') {
      const directUserId = typeof object.client_reference_id === 'string' ? object.client_reference_id : null
      const email = object.customer_details?.email ?? object.customer_email
      if ((directUserId || email) && object.customer && object.subscription) {
        const profileId = directUserId ?? await profileIdFor(supabase, String(object.customer), email)
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

        if (profileId && stripeKey) {
          const response = await fetch(
            `https://api.stripe.com/v1/subscriptions/${object.subscription}`,
            { headers: { Authorization: `Bearer ${stripeKey}` } }
          )

          if (!response.ok) {
            throw new Error('Could not retrieve Stripe subscription')
          }

          await saveSubscription(supabase, profileId, await response.json())
        }
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const { data: subscription } = await supabase.from('subscriptions').select('user_id').eq('stripe_customer_id', String(object.customer)).maybeSingle()
      const userId = subscription?.user_id ?? await profileIdFor(supabase, String(object.customer))
      if (userId) await saveSubscription(supabase, userId, object)
    }

    if (event.type === 'customer.subscription.deleted') {
      const { data: subscription } = await supabase.from('subscriptions').select('user_id').eq('stripe_customer_id', String(object.customer)).maybeSingle()
      if (subscription) {
        await supabase.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('user_id', subscription.user_id)
        await supabase.from('profiles').update({ plan: 'free', updated_at: new Date().toISOString() }).eq('id', subscription.user_id)
      }
    }

    return new Response(JSON.stringify({ received: true, type: event.type }), { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed'
    console.error('reverbly-stripe-webhook', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders })
  }
})
