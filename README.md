# Reverbly

Reverbly is a browser-based audio editor for short-form creators. It creates slowed + reverb, sped-up, and clip-ready WAV versions directly in the browser.

## Project files

- `index.html` – entry point
- `reverbly-landing.html` – marketing site
- `reverbly-prototype.html` – audio editor
- `reverbly-account.html` – passwordless sign-in and trial checkout entry
- `reverbly-dashboard.html` – plan status, billing portal entry, export history
- `reverbly-supabase-config.js` – browser config (Supabase publishable key + Stripe Payment Link)
- `reverbly-stripe-webhook.ts` – Edge Function for Stripe subscription events
- `reverbly-stripe-portal.ts` – Edge Function for Stripe Customer Portal sessions

## Supabase migrations

Run these files in Supabase SQL Editor, in this order:

1. `reverbly-supabase.sql`
2. `reverbly-export-gate.sql`
3. `reverbly-saved-presets.sql`
4. `reverbly-export-history.sql`

The last migration creates a private `exports` storage bucket for WAV files saved in export history.

## Auth setup

1. Enable **Email** magic-link (OTP) in Supabase Authentication.
2. Add redirect URLs for local and production, including:
   - `…/reverbly-account.html`
   - `…/reverbly-dashboard.html`

## Stripe setup

1. Create a Subscription Payment Link with a **7-day trial** and $7/month price.
2. Put the Payment Link URL in `reverbly-supabase-config.js` → `stripeTrialLink`.
   - Keep the `test_…` link for staging; switch to the live link before launch.
3. Deploy Edge Functions and set secrets:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_ANON_KEY` for the portal function)
4. Webhook endpoint (`reverbly-stripe-webhook.ts`) events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Deploy `reverbly-stripe-portal.ts`, enable Customer Portal in Stripe, then set
   `stripePortalFunctionUrl` in `reverbly-supabase-config.js` to the function URL.

Payment Link must pass `client_reference_id` (the signed-in user id) so the webhook can attach the subscription to the correct profile.

## Plan limits (client-enforced)

| Plan | Exports | Max file | Max duration |
|------|---------|----------|--------------|
| Free | 1 / day | 20 MB | 5 minutes |
| Trial / Pro | Unlimited | 80 MB | 20 minutes |

Server-side export quota remains in `consume_export` / `consume_export_anonymous`.

## Netlify deployment

1. Connect the GitHub repository.
2. Publish directory = repository root (no build command).
3. Mirror the production URL in Supabase Auth redirect settings.

## Secrets

Do not commit `.env` files or Stripe/Supabase service keys. The publishable Supabase key is intentionally public.

## Before launch checklist

- [ ] SQL migrations applied on production Supabase
- [ ] Magic-link sign-in works on the production URL
- [ ] Live Stripe Payment Link (not `test_`) in config
- [ ] Webhook deployed and trial → dashboard shows **Trial active**
- [ ] Customer Portal function deployed; **Manage billing** works
- [ ] Export while signed in → history Download + Recreate work
- [ ] Storage retention policy reviewed for `exports` bucket
