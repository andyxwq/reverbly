# Reverbly

Reverbly is a browser-based audio editor for short-form creators. It creates slowed + reverb, sped-up, and clip-ready WAV versions directly in the browser.

## Project files

- `index.html` – entry point
- `reverbly-landing.html` – marketing site
- `reverbly-prototype.html` – audio editor
- `reverbly-account.html` – passwordless sign-in and trial entry
- `reverbly-dashboard.html` – plan status and export history
- `reverbly-stripe-webhook.ts` – Supabase Edge Function for Stripe events

## Supabase migrations

Run these files in Supabase SQL Editor, in this order:

1. `reverbly-supabase.sql`
2. `reverbly-export-gate.sql`
3. `reverbly-saved-presets.sql`
4. `reverbly-export-history.sql`

The last migration creates a private `exports` storage bucket for WAV files saved in export history.

## Netlify deployment

1. Create a GitHub repository and push this project.
2. In Netlify, choose **Add new site** → **Import an existing project**.
3. Connect the GitHub repository.
4. Use the repository root as the publish directory. No build command is required for this static prototype.
5. Set the production site URL in Supabase Authentication redirect settings, together with the local development URL if needed.

Every push to the production branch can then trigger a Netlify deploy.

## Secrets

Do not commit `.env` files or Stripe/Supabase service keys. The publishable Supabase key used by the browser is intentionally public; Stripe secret keys, webhook secrets, and Supabase service-role keys belong only in Supabase Edge Function environment variables.

## Before launch

- Test passwordless email sign-in on the Netlify URL.
- Test the Stripe Trial and confirm the dashboard becomes `Trial active`.
- Export from a signed-in account and verify Download and Recreate in Export history.
- Review storage usage and file retention for saved WAV files.
