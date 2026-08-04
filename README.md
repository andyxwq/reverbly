# Reverbly

Reverbly is a browser-based audio editor for short-form creators. It creates slowed + reverb, sped-up, and clip-ready WAV versions directly in the browser.

## Project files

- `index.html` – entry point (redirects to landing)
- `reverbly-landing.html` – marketing site
- `reverbly-prototype.html` – audio editor
- `reverbly-account.html` – passwordless sign-in and trial checkout entry
- `reverbly-dashboard.html` – plan status, billing portal entry, export history
- `reverbly-privacy.html` / `reverbly-terms.html` – legal pages
- `reverbly-supabase-config.js` – Supabase + Stripe Payment Link + optional analytics
- `reverbly-stripe-webhook.ts` – Edge Function for Stripe subscription events
- `reverbly-stripe-portal.ts` – Edge Function for Stripe Customer Portal sessions
- `netlify.toml` – security headers and short URL redirects
- `404.html`, `robots.txt`, `sitemap.xml`, `favicon.svg`

## Supabase migrations

Run these files in Supabase SQL Editor, in this order:

1. `reverbly-supabase.sql`
2. `reverbly-export-gate.sql`
3. `reverbly-saved-presets.sql`
4. `reverbly-export-history.sql`

Optional: `reverbly-storage-retention.sql` (notes only).

## Auth setup

1. Enable **Email** magic-link (OTP) in Supabase Authentication.
2. Add redirect URLs for local and production, including:
   - `…/reverbly-account.html`
   - `…/reverbly-dashboard.html`

## Stripe setup

1. Create a Subscription Payment Link with a **7-day trial** and $7/month price.
2. Put the Payment Link URL in `reverbly-supabase-config.js` → `stripeTrialLink`.
3. Deploy Edge Functions and set secrets:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_ANON_KEY` for the portal function)
4. Webhook events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`
5. Deploy portal function, enable Customer Portal in Stripe, set `stripePortalFunctionUrl`.

Payment Link must receive `client_reference_id` (signed-in user id).

## Plan limits

| Plan | Exports | Max file | Max duration |
|------|---------|----------|--------------|
| Free | 1 / day | 20 MB | 5 minutes |
| Trial / Pro | Unlimited | 80 MB | 20 minutes |

## Analytics (optional)

`window.reverblyTrack(event, props)` fires when:

- Plausible is loaded (`window.plausible`), or
- `analyticsEndpoint` is set in config (sendBeacon JSON)

Events: `audio_loaded`, `export_success`, `export_blocked`, `trial_checkout_start`, `billing_portal_open`.

## Netlify

- Publish directory = repository root
- Short paths: `/app` → editor, `/trial` → account, `/account` → dashboard
- Security headers + CSP configured in `netlify.toml`

## Before launch checklist

- [ ] SQL migrations on production Supabase
- [ ] Magic-link works on production URL
- [ ] Live Stripe Payment Link (not `test_`) in config
- [ ] Webhook deployed; trial → dashboard **Trial active**
- [ ] Portal function deployed; **Manage billing** works
- [ ] Export history Download + Recreate
- [ ] Storage retention reviewed
- [ ] Domain + sitemap hostnames match production
