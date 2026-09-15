# eden-institute-landing

Source for **edeninstitute.health**: The Eden Institute and Eden's Table.

## Layout

- `web/` Astro marketing pages (pre-rendered): `/`, `/homeschool`, `/books`, `/starter`, legal, herbs.
- `src/` Vite + React SPA for the app routes (quiz, results, founder dashboard, account), served from `/_spa`.
- `supabase/functions/` Deno Edge Functions: checkout, Stripe webhook, Lulu print fulfilment, email and SMS.
- `supabase/migrations/` Postgres schema.
- `docs/` runbooks, for example `docs/lulu-pod-fulfillment.md`.

## Commands

```
npm install
npm run dev
npm run typecheck
npm run build
```

## Deploy

Vercel builds `main` to production. `main` is protected, so changes land through pull requests.
Edge Functions deploy separately with the Supabase CLI; after any change to
`supabase/functions/_shared/`, redeploy every function that imports it.
Resolve that set with `scripts/ef_stale_sweep.py` from the private eden-ops repo (not vendored here).

## Operations scripts

Some docs and comments in this repo refer to Python operations scripts. They are not in this
repository. They live in the private `Eden-Institute/eden-ops` repository under `scripts/`,
which backs up the founder's local `Biblical Herbalism/scripts/` folder. If a script is not in
eden-ops yet, the local folder is the working copy.

- `esa_payment_intake.py`
- `esa_invoice.py`
- `esa_invoices_sync.py`
- `guide_pdf_assets.py`
- `sync_outreach.py`
- `sync_partners.py`
- `ef_stale_sweep.py`
