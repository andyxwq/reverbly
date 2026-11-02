(function () {
  const config = {
    url: 'https://vnqzknyxxdxtjlfzyqfh.supabase.co',
    anonKey: 'sb_publishable_mKbX82lncbniQINpMLRrHQ_lZ7AJnCU',
    // Stripe Payment Links (create in Stripe Dashboard → Payment Links)
    // Pro $7.99/mo with 7-day trial:
    stripeTrialLink: 'https://buy.stripe.com/9B6dR1eNpcBxaw35XP7EQ01',
    // Plus €3.99/mo
    stripePlusLink: 'https://buy.stripe.com/7sY7sDdJlcBx5bJ4TL7EQ02',
    // Optional: Supabase Edge Function that creates a Stripe Customer Portal session.
    stripePortalFunctionUrl: 'https://vnqzknyxxdxtjlfzyqfh.supabase.co/functions/v1/reverbly-stripe-portal',
    // Optional analytics endpoint (Plausible custom events, or your own collector).
    analyticsEndpoint: ''
  };

  if (!window.supabase) {
    throw new Error('Supabase browser SDK must be loaded before reverbly-supabase-config.js');
  }

  window.reverblySupabaseConfig = config;
  window.reverblySupabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce'
    }
  });

  window.reverblyTrack = function reverblyTrack(eventName, props) {
    try {
      if (typeof window.plausible === 'function') {
        window.plausible(eventName, props ? { props: props } : undefined);
      }
      if (config.analyticsEndpoint) {
        navigator.sendBeacon?.(
          config.analyticsEndpoint,
          new Blob([JSON.stringify({ event: eventName, props: props || {}, ts: Date.now() })], { type: 'application/json' })
        );
      }
    } catch (_) {
      // analytics must never break the product
    }
  };
})();
