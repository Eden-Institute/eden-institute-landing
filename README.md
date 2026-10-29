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
Test sessions send nothing either (2026-10-28): an automated browser (`navigator.webdriver`), the
E2E switch (`eden_e2e_token`), or a tab that arrived on a `utm_source=e2e_check` / `claude_e2e` or
`utm_medium=test` link (`TEST_SESSION_GUARD_JS`, remembered for the tab in `eden-test-session`).

**Purchases come from the server** (2026-10-28). `stripe-webhook` sends GA4's `purchase` for every
paid checkout and subscription invoice, and `refund` for every refund, through the Measurement
Protocol (`supabase/functions/_shared/ga4-mp.ts`, secret `GA4_MP_API_SECRET`). The browser no
longer sends `purchase`. Each `payments` row records the outcome in `ga4_status` (`sent`, `failed`,
or `skipped_test` / `skipped_internal` / `skipped_declined` / `skipped_no_secret` /
`skipped_unmatched` / `skipped_not_subscription`), so GA4 purchase revenue for a month equals
`sum(paid) - sum(refunded)` over rows with `ga4_status = 'sent'`, and every other row says why.
`value` is the full amount the row records (tax and shipping included); a buyer who clicked
Decline is never sent. The visit is joined through `ga_client_id` / `ga_session_id` in the
checkout metadata (`src/lib/gaVisitor.ts`).

**Internal links carry no UTM tags.** A tag on a link between the site's own pages starts a new
session credited to the tag. Such clicks are `select_content` events instead
(`trackInternalLinkClick` in `src/lib/emailSubmit.ts`).

**Consent** (`src/lib/consent.ts`): Google and Pinterest run by default and stop after Decline
(`eden-marketing-consent` = `denied`). The Meta Pixel waits for Accept. Every event below checks
for Decline before it sends.

| Event | Where it fires | Notes |
|---|---|---|
| `page_view` | Astro pages: `gtag('config')`, automatic. SPA routes: `GaPageViewTracker` (`src/lib/gaPageView.ts`), sent once `useDocumentMeta` has set the route's real title; `index.html` sets `send_page_view: false` | GA4 Enhanced measurement "Page changes based on browser history events" must stay OFF, or SPA routes count twice |
| `email_submit` (GA4 key event) | `src/lib/emailSubmit.ts` `trackEmailSubmit(form_name)`, after the server confirms | `form_name` values below |
| `purchase` / `refund` (GA4, Merchant Center) | `stripe-webhook`, server side (see above) | every product; `transaction_id` = `checkoutRef(session id)` for a checkout, the invoice id for a subscription; items = the order's lines (`products.sku`) |
| `select_content` (`content_type` `post_signup_modal`) | the button after a `WaitlistModal` signup | replaced the `utm_source=modal` tags |
| Google Ads `conversion` | `src/lib/ga4Purchase.ts` / `ga4DigitalPurchase.ts`, from the thank-you pages | browser only; never for a `cs_test_` order |
| `starter_unit_purchase` | `web/pages/starter/thank-you.astro`, `web/pages/starter/seedlings/thank-you.astro` | an extra marker for the $39 digital Starter Unit; its GA4 `purchase` comes from `stripe-webhook` like every sale |
| `purchase_confirmed` | `src/pages/HomeschoolWelcome.tsx` | SPA homeschool checkout |
| Meta `Lead` / `InitiateCheckout` / `Purchase` | browser `metaTrack` plus server Conversions API (`supabase/functions/_shared/meta-capi.ts`, from `resend-waitlist`, `create-checkout`, `stripe-webhook`) | deduped on event id; browser `Purchase` (`src/lib/metaPurchase.ts`) skips `cs_test_` orders, the server skips E2E |
| Pinterest `lead` / `addtocart` / `checkout` | `src/lib/pinterestTag.ts` | Astro pages only |
| Google Customer Reviews opt-in | `src/lib/customerReviews.ts`, every thank-you page: the two print paths plus `/starter/thank-you`, `/starter/seedlings/thank-you`, the PDF path of `BookThankYou` and the Deep-Dive Guide (`GuideLanding`) | merchant 5861058138; delivery date (Central) = order date + 21 days when the order ships, the order date for digital-only; country from `print-order-status` (`delivery_country`) |
| Google store badge | `src/lib/merchantWidget.ts`, via `SiteAnalytics` | public Astro pages only (never noindex or private pages), only after Accept, lifted above a `data-sticky-bottom-bar` |

**`email_submit` form_name values**

| form_name | Form |
|---|---|
| `freebies_sprouts_week1`, `freebies_seedlings_week1` | free-week pop-ups, `/freebies` |
| `homeschool_sprouts_week1`, `homeschool_seedlings_week1` | free-week pop-ups in the band ladders, `/homeschool` |
| `homeschool_cultivators_waitlist`, `homeschool_practitioners_waitlist` | "Tell me when it opens", `/homeschool` |
| `back_to_eden_ch1` | free Chapter 1, `/back-to-eden` |
| any other `data-waitlist-source` | a `WaitlistModal` with no `data-waitlist-form-name` falls back to its source |
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
