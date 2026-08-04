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

  if (subError || !subscription?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No Stripe customer on file' }), { status: 400, headers: corsHeaders })
  }

  let returnUrl = 'https://getreverbly.com/reverbly-dashboard.html'
  try {
    const body = await request.json()
    if (typeof body?.return_url === 'string' && body.return_url.startsWith('http')) {
      returnUrl = body.return_url
    }
  } catch {
    // optional body
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe is not configured' }), { status: 500, headers: corsHeaders })
  }

  const params = new URLSearchParams({
    customer: subscription.stripe_customer_id,
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
