(function () {
  const config = {
    url: 'https://vnqzknyxxdxtjlfzyqfh.supabase.co',
    anonKey: 'sb_publishable_mKbX82lncbniQINpMLRrHQ_lZ7AJnCU'
  };

  if (!window.supabase) {
    throw new Error('Supabase browser SDK must be loaded before reverbly-supabase-config.js');
  }

  window.reverblySupabaseConfig = config;
  window.reverblySupabaseClient = window.supabase.createClient(config.url, config.anonKey);
})();
