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
