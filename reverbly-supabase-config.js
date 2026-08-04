(function () {
  const config = {
    url: 'https://vnqzknyxxdxtjlfzyqfh.supabase.co',
    anonKey: 'sb_publishable_mKbX82lncbniQINpMLRrHQ_lZ7AJnCU',
    // Stripe Payment Link for the 7-day trial → Pro plan.
    // Replace the test link with the live Payment Link before production launch.
    stripeTrialLink: 'https://buy.stripe.com/test_eVq5kv34s38O3QneFmd7q00',
    // Optional: Supabase Edge Function that creates a Stripe Customer Portal session.
    stripePortalFunctionUrl: '',
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
