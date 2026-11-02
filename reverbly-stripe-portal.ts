import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  const authHeader = request.headers.get('Authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders })
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default
  )

  const { data: subscription, error: subError } = await service
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let returnUrl = 'https://reverbly.app/reverbly-dashboard'
  try {
    const body = await request.json()
    if (typeof body?.return_url === 'string' && body.return_url.startsWith('https://reverbly.app')) {
      returnUrl = body.return_url
    }
  } catch {
    // optional body
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe is not configured' }), { status: 500, headers: corsHeaders })
  }

  let customerId = subscription?.stripe_customer_id || ''
  if (!customerId && user.email) {
    const found = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=5`, {
      headers: { Authorization: `Bearer ${stripeKey}` }
    })
    const customers = await found.json()
    customerId = customers.data?.[0]?.id || ''
  }

  if (!customerId) {
    return new Response(JSON.stringify({ error: 'No Stripe customer for this email' }), { status: 400, headers: corsHeaders })
  }

  const listed = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=all&limit=5`, {
    headers: { Authorization: `Bearer ${stripeKey}` }
  })
  const subscriptions = await listed.json()
  const current = (subscriptions.data || []).find((item: { status?: string }) => item.status === 'trialing' || item.status === 'active')
    || subscriptions.data?.[0]
  if (current) {
    const status = String(current.status || 'active')
    const amount = Number(current.items?.data?.[0]?.price?.unit_amount || 0)
    const plan = status === 'trialing' ? 'trialing' : amount === 399 ? 'plus' : status === 'canceled' ? 'free' : 'pro'
    const trialEnd = current.trial_end ? new Date(Number(current.trial_end) * 1000).toISOString() : null
    const periodEnd = current.items?.data?.[0]?.current_period_end
      ? new Date(Number(current.items.data[0].current_period_end) * 1000).toISOString()
      : null
    await service.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: String(current.id),
      status: ['trialing', 'active', 'canceled', 'past_due'].includes(status) ? status : 'active',
      trial_ends_at: trialEnd,
      current_period_ends_at: periodEnd,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    await service.from('profiles').update({ plan, updated_at: new Date().toISOString() }).eq('id', user.id)
  } else {
    await service.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      status: 'inactive',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  }

  const params = new URLSearchParams({
    customer: customerId,
    return_url: returnUrl
  })

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  })

  const payload = await response.json()
  if (!response.ok) {
    return new Response(JSON.stringify({ error: payload.error?.message || 'Stripe portal error' }), {
      status: 400,
      headers: corsHeaders
    })
  }

  return new Response(JSON.stringify({ url: payload.url }), { status: 200, headers: corsHeaders })
})
