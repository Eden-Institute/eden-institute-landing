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

## Analytics events

Read this before renaming an event, moving a thank-you page or changing a product id.
Merchant Center conversions and the GA4 key events depend on these exact names.

**Tags.** GA4 `G-5DVHEZPKL0` (property "Landing Page", 526336363) and GTM `GTM-PVRHXN8N` load
from the head of `web/layouts/MarketingLayout.astro` (every Astro page) and `index.html`
(every SPA route, including `/apothecary/*`). The Pinterest tag is Astro-only. The Meta Pixel
(`src/lib/metaPixel.ts`) loads only after the visitor clicks Accept.

**Live site only.** Every third-party tag (GTM, gtag.js, Pinterest, Meta Pixel, Google Customer
Reviews) loads only when the hostname is `edeninstitute.health` or `www.edeninstitute.health`.
Vercel previews and localhost send nothing. The pattern lives in `src/lib/productionHost.ts`
and is copied inline in both heads, and `src/test/productionHost.test.ts` fails if they drift.

**Consent** (`src/lib/consent.ts`): Google and Pinterest run by default and stop after Decline
(`eden-marketing-consent` = `denied`). The Meta Pixel waits for Accept. Every event below checks
for Decline before it sends.

| Event | Where it fires | Notes |
|---|---|---|
| `page_view` | `gtag('config')` in both heads | automatic |
| `email_submit` (GA4 key event) | `src/lib/emailSubmit.ts` `trackEmailSubmit(form_name)`, after the server confirms | `form_name` values below |
| `purchase` (GA4, Merchant Center) | `src/lib/ga4Purchase.ts`, from `PrintThankYou` (`/books/thank-you`) and the print path of `BookThankYou` (`/back-to-eden/thank-you`) | physical lines only, once per order, values from `print-order-status` |
| `starter_unit_purchase` | `web/pages/starter/thank-you.astro`, `web/pages/starter/seedlings/thank-you.astro` | the $39 digital Starter Unit. Deliberately NOT `purchase` |
| `purchase_confirmed` | `src/pages/HomeschoolWelcome.tsx` | SPA homeschool checkout |
| Meta `Lead` / `InitiateCheckout` / `Purchase` | browser `metaTrack` plus server Conversions API (`supabase/functions/_shared/meta-capi.ts`, from `resend-waitlist`, `create-checkout`, `stripe-webhook`) | deduped on event id |
| Pinterest `lead` / `addtocart` / `checkout` | `src/lib/pinterestTag.ts` | Astro pages only |
| Google Customer Reviews opt-in | `src/lib/customerReviews.ts`, the same two print thank-you paths | merchant 5861058138, delivery date = order date + 21 days |

**`email_submit` form_name values**

| form_name | Form |
|---|---|
| `sprouts_magnet`, `seedlings_magnet`, `back_to_eden_ch1`, `cultivators_waitlist`, `practitioners_waitlist` (any `data-waitlist-source`) | `WaitlistModal` on `/freebies`, `/homeschool`, `/back-to-eden` |
| `constitution_assessment` | quiz email gate, `/assessment` |
| `get_involved_<role>` | homepage partner / investor / parent form |
| `ttt_eden_page` | `/tales-and-table-talk` signup |
| `esa_invoice` | ESA invoice form, `/esa/<state>` |

`purchase` item ids are `products.sku` and must equal the `id` column of the
"Eden Merchant Center Product Feed" Google Sheet, case-sensitive:

| item_id | Product |
|---|---|
| `sprouts_print_set` | Sprouts Printed Set, K-2 |
| `seedlings_print_set` | Seedlings Printed Set, 3-5 |
| `both_bands_print_set` | Sprouts + Seedlings Sets, K-5 |
| `bte_paperback_print` | Back to Eden, Paperback |
| `bte_study_guide_print` | Back to Eden Study Guide |
| `bte_study_journal_print` | Back to Eden Study & Journal Edition |

The extra-notebook add-ons (`sprouts_nb_print`, `seedlings_nb_print`) are physical, so they appear
in `purchase` items, but they are not in the feed.

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
