(function () {
  const config = {
    url: 'https://vnqzknyxxdxtjlfzyqfh.supabase.co',
    anonKey: 'sb_publishable_mKbX82lncbniQINpMLRrHQ_lZ7AJnCU',
    // Stripe Payment Link for the 7-day trial → Pro plan.
    // Replace the test link with the live Payment Link before production launch.
    stripeTrialLink: 'https://buy.stripe.com/test_eVq5kv34s38O3QneFmd7q00',
    // Optional: Supabase Edge Function that creates a Stripe Customer Portal session.
    // Deploy reverbly-stripe-portal.ts and set this to the function URL.
    stripePortalFunctionUrl: ''
  };

  if (!window.supabase) {
    throw new Error('Supabase browser SDK must be loaded before reverbly-supabase-config.js');
  }

  window.reverblySupabaseConfig = config;
  window.reverblySupabaseClient = window.supabase.createClient(config.url, config.anonKey);
})();
