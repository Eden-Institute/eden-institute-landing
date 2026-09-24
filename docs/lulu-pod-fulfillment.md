# Lulu print-on-demand fulfilment

> **STATUS 2026-09-12: LIVE IN PRODUCTION.** The shop has been selling since 2026-09-11.
> Production Lulu keys, `LULU_API_BASE` = production, `PRINT_SHOP_LIVE=true`,
> `LULU_SHIPPING_LEVEL=MAIL`, webhook registered. All six files validated. The extra
> Student Notebook is $39.99 (migration `20260911220000_notebook_price_3999.sql`).
> Order ET-1026 proved pay, record, email/SMS, Lulu job, refund and Lulu cancel end to end.
> **The "Founder steps" and "Test plan" sections below are the historical go-live record.**
> Do not re-run them against production, and never unset `PRINT_SHOP_LIVE` as a "dark test":
> that closes checkout for real buyers. The boxed kit is off sale (2026-09-12), so the
> old $249 price-collision note no longer applies.

Built 2026-09-10 on `feat/lulu-pod-fulfillment` (PR #458). The printed Sprouts
curriculum sells on edeninstitute.health as ONE SET (Teacher's Guide, Student
Notebook, Read-Aloud storybook; founder decision 2026-09-10: never sold
separately, $249, flat $12 shipping), prints to order at Lulu, and ships from
Lulu straight to the buyer. This document is the runbook: what was built, what
the founder has to do before the first sale, and how to test and operate it.

## How an order moves

```
/books (PrintBuyBox)                 price from print_products_public
  -> create-checkout { print_shop: true, items: [{ sku: sprouts_print_set, qty }] }
  -> Stripe Checkout (US address + phone, Stripe Tax, one flat shipping charge)
  -> stripe-webhook checkout.session.completed
       records the order (is_preorder=false, fulfillment='lulu'), paid -> ready_to_fulfill
       sends the order confirmation email (+ SMS if consented)
       queues lulu_jobs(pending) and kicks lulu-submit
  -> lulu-submit
       POST /print-jobs/ with the buyer's address, a 48-hour production delay,
       and THREE line items (tg, nb, ra), each either the cached printable id
       or the interior + cover URLs from lulu_printables
       records lulu_print_job_id, order -> in_production
  -> Lulu PRINT_JOB_STATUS_CHANGED webhook -> lulu-webhook
       SHIPPED   -> tracking on the order, order -> shipped, shipped email (+ SMS)
       DELIVERED -> order -> delivered, delivered email (+ SMS)
       REJECTED / CANCELED / ERROR -> founder email, job marked failed
  -> api/cron/drain-lulu-jobs every 10 min retries anything the kick missed
```

Refunds: `charge.refunded` first tries to cancel the Lulu job. Inside the
48-hour delay that works and nothing prints. After production starts Lulu
refuses, the books ship anyway, Lulu still bills us, and the founder is emailed
so she can decide what to tell the buyer.

## Files

| Piece | Where |
|---|---|
| Config: the set, the three printables, delay, shipping level | `supabase/functions/_shared/lulu-config.ts` |
| Lulu API client, address mapping, HMAC | `supabase/functions/_shared/lulu.ts` (+ `lulu.test.ts`) |
| Queue, submit, status apply, cancel, founder alerts | `supabase/functions/_shared/lulu-fulfillment.ts` |
| State machine (`in_production` added) | `supabase/functions/_shared/order-state.ts` |
| Order emails and SMS, edge-keyed registry | `supabase/functions/_shared/order-messages.ts` |
| Retail order recording | `supabase/functions/_shared/order-flow.ts` |
| Checkout branch | `supabase/functions/create-checkout/index.ts` (`handlePrintCheckout`) |
| Webhook branch + refund cancel | `supabase/functions/stripe-webhook/index.ts` |
| Edge functions | `lulu-submit` (service role), `lulu-webhook` (HMAC, no JWT), `lulu-admin` (founder JWT) |
| Cron drain | `api/cron/drain-lulu-jobs.ts`, `vercel.json` |
| Migrations | `20260911000000_lulu_pod_in_production_state.sql`, `20260911000100_lulu_pod_fulfillment.sql` |
| Storefront | `web/pages/books.astro`, `web/components/islands/PrintBuyBox.tsx` |
| Confirmation page | `web/pages/books/thank-you.astro`, `web/components/islands/PrintThankYou.tsx`, `print-order-status` (public) |
| Dashboard | `src/components/founder/OrdersTab.tsx` (Lulu column + actions) |

## Verified Lulu facts this build relies on

Read from api.lulu.com/docs, the Print API spec sheet and lulu.com/terms on
2026-09-10.

- Auth: OAuth2 client credentials, token endpoint
  `/auth/realms/glasstree/protocol/openid-connect/token`, about an hour per token.
- Sandbox: separate account at developers.sandbox.lulu.com, base
  `https://api.sandbox.lulu.com`, test cards only, nothing prints.
- A print job needs `line_items`, `shipping_address` (with `phone_number`),
  `shipping_level`, `contact_email`. `external_id` is ours (we send the order
  number; each line's `external_id` is the book key). `production_delay` is
  60 to 2880 minutes.
- A line item is either `printable_id` (from an earlier job) or `interior` +
  `cover` source URLs plus `pod_package_id`. Lulu downloads the files from a
  public URL. The first job returns a `printable_id` per line; we cache it in
  `lulu_printables` and never send files again.
- Package ids, dotted format (live 2026-03-31; the 27-character legacy format
  dies 2027-02-01):
  - Teacher's Guide and Student Notebook: `0850X1100.FC.STD.CO.080CW444.GXX`
    (US Letter, full color, standard, coil, 80# coated white, gloss;
    2 to 470 pages; $6.95 + $0.0635 per page).
  - Read-Aloud: `0583X0827.FC.STD.PB.080CW444.GXX` (A5, full color, standard,
    perfect bound, 80# coated white, gloss; 32 to 800 pages; $1.99 + $0.0505
    per page).
- Webhooks: topic `PRINT_JOB_STATUS_CHANGED`, payload `{ topic, data: <print job> }`,
  signed in `Lulu-HMAC-SHA256` with the API secret. Five failed deliveries in a
  row deactivate the webhook; `lulu-admin list_webhooks` shows `is_active`.
- Payment: jobs sit UNPAID until a card is on file at Lulu; with a card they
  auto-advance and the card is charged when production starts.
- Cancellation only during the production delay. No returns. Damaged copies
  replaced at Lulu's discretion against photos.

## What the migration seeds, and what it leaves for the founder

`products` row `sprouts_print_set`: name "Sprouts Printed Curriculum Set",
$249.00, flat shipping $12.00, `fulfillment='lulu'`, active, and
`stripe_retail_price_id` = `price_1UEKA22NWfYbCZT8s5nFReu7` (live Stripe product
`prod_VEnlvZetV0GZuJ`, created by the founder in the Dashboard 2026-09-10, $249.00
USD one-off, tax code txcd_99999999). Nothing on the product row is left blank.

`products` row `sprouts_nb_print` (migration 20260911200000): "Extra Student
Notebook, printed", $39.99, shipping tier $12 (the cart charges the MAX tier,
so it rides in the set's parcel for no extra shipping), printable `nb` only.
Live Stripe product `prod_VF6XcSOc0qCfid`, price `price_1UEcJx2NWfYbCZT8ClSdmBjd`, seeded by the migration.

`products` row `seedlings_nb_print` (migration 20260924230000): the same add-on
for the Seedlings set, $39.99, shipping tier $12, printable `seedlings/nb` only.
Seeded with `stripe_retail_price_id` NULL (the /books Seedlings box hides the
option until it is set); the live price is `price_1UJK0n2NWfYbCZT8de1VEZ49` on
product `prod_VJxw2dagT54hOY`.

`lulu_printables` rows `tg`, `nb`, `ra` with the verified package ids and page
counts (240, 224, and NULL for the Read-Aloud until its final count is known).
**Left NULL:** `interior_url`, `cover_url` on all three, and `page_count` on
`ra`.

## Founder steps before the first real order (DONE 2026-09-11, historical)

1. **Lulu accounts.** Production account at lulu.com (API keys appear under
   the developer portal), a separate sandbox account at
   developers.sandbox.lulu.com, and a **card on file** in production.
2. **Secrets** (Supabase project `noeqztssupewjidpvhar`, Edge Function secrets):
   - `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET` (sandbox pair first, production pair at go-live)
   - `LULU_API_BASE` = `https://api.sandbox.lulu.com` while testing; unset or
     `https://api.lulu.com` for production
   - `LULU_SHIPPING_LEVEL` = one of `MAIL`, `PRIORITY_MAIL`, `GROUND_HD`,
     `GROUND_BUS`, `GROUND`, `EXPEDITED`, `EXPRESS`. **No default on purpose.**
     Nothing submits until this is chosen.
   - `PRINT_SHOP_LIVE` = `true` to open the shop. Until then `/books` shows the
     set (once its Stripe Price exists) but checkout answers `PRINT_SHOP_NOT_LIVE`;
     the existing `PREORDER_ADMIN_TOKEN` header opens it for dark tests.
3. **Stripe.** Done 2026-09-10: live product `prod_VEnlvZetV0GZuJ`, price
   `price_1UEKA22NWfYbCZT8s5nFReu7`, $249.00 USD one-off, General tangible goods. The
   migration seeds the price id; nothing to do here unless the price changes.

4. **Files.** A public direct-download link for each interior and cover, and
   the Read-Aloud's final page count:

   ```sql
   update public.lulu_printables set interior_url = '<url>', cover_url = '<url>', updated_at = now() where book_key = 'tg';
   update public.lulu_printables set interior_url = '<url>', cover_url = '<url>', updated_at = now() where book_key = 'nb';
   update public.lulu_printables set interior_url = '<url>', cover_url = '<url>', page_count = <final count>, updated_at = now() where book_key = 'ra';
   ```

   Lulu fetches them once. Supabase Storage on this plan caps a file at 50 MB
   and the interiors are around 200 MB, so use any host that serves a direct
   download (Lulu's own example is a Dropbox link with `?dl=1`). After the
   first successful job the printable id is cached and the URLs can be
   cleared. Current files: `Sprouts_{TG,NB}_LULU_Weeks1-36_FullBleed_8.75x11.25.pdf`
   and `LULU_{TG,NB}_cover_spread_17.25x11.25.pdf`; the Read-Aloud interior and
   A5 cover spread still need exporting.
5. **Validate the files** without placing an order: from a signed-in founder
   session call `lulu-admin` with `{ "action": "validate_files", "book": "tg" }`,
   then poll `{ "action": "validation_status", "interior_id": ..., "cover_id": ... }`
   until both read `NORMALIZED` (or `ERROR` with reasons). Repeat for `nb` and `ra`.
6. **Register the webhook** (once per environment):
   `{ "action": "subscribe_webhook", "url": "https://noeqztssupewjidpvhar.supabase.co/functions/v1/lulu-webhook" }`.
7. **Returns policy.** Done 2026-09-11: `/returns` has a "Printed books,
   printed to order" section (48-hour cancellation, no returns once printing
   starts, damaged copies replaced against a photo within 14 days of delivery).
8. **Sales tax on Lulu's invoice.** Stripe Tax charges the buyer; Lulu also
   charges us tax on the print job. Whether a resale certificate removes that is
   a CPA question.
9. ~~Price collision with the kit~~ Resolved 2026-09-12: the kit is off sale.

## Deploy

Migrations, then functions, then the cron:

```
supabase db push
supabase functions deploy lulu-submit
supabase functions deploy lulu-webhook --no-verify-jwt
supabase functions deploy lulu-admin
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-checkout --no-verify-jwt
python <eden-ops checkout>/scripts/ef_stale_sweep.py --repo <path to this repo>   # lives in the private eden-ops repo, not here
```

`_shared/order-state.ts`, `order-db.ts`, `order-messages.ts` and `order-flow.ts`
changed, so the stale sweep must run and every function it names must be
redeployed in the same session. `vercel.json` gained a cron; Vercel picks it up
on the next production deploy.

`config.toml` locks `lulu-webhook` to `verify_jwt=false` and `lulu-submit` /
`lulu-admin` to `true`.

## Test plan (historical, do not re-run against production)

Sandbox first, with `LULU_API_BASE=https://api.sandbox.lulu.com` and the
sandbox key pair:

1. `deno test supabase/functions/_shared/lulu.test.ts` (pure logic).
2. Dark test: with `PRINT_SHOP_LIVE` unset, call `create-checkout` directly
   with the `x-preorder-admin` header and
   `{ print_shop: true, items: [{ sku: "sprouts_print_set", qty: 1 }] }`, pay
   with a real card, and confirm: an `orders` row with `fulfillment='lulu'` and
   `status='ready_to_fulfill'`; a `lulu_jobs` row that moves to `submitted`;
   `orders.lulu_print_job_id` set; order at `in_production`; three line items
   on the Lulu job; the confirmation email received.
3. In Lulu's sandbox developer portal, watch the job. Use `lulu-admin refresh`
   to pull its state. Use the webhook test endpoint (`/webhooks/{id}/test-submission/PRINT_JOB_STATUS_CHANGED/`)
   to prove `lulu-webhook` verifies and applies a payload.
4. Refund the test order in Stripe within the delay: `lulu_jobs.status`
   becomes `cancelled`, `orders.lulu_status` `CANCELED`, and no founder email
   (it was cancelled by us).
5. Production: one real order to the founder's own address, at the founder's
   chosen shipping level. Read the SENT copies of the confirmation and shipped
   emails, and click the tracking link.

## Operating it

- `/founder` Orders tab shows each Lulu order's status, Lulu job id, tracking,
  Lulu's cost, and the job's last error. Buttons: Resubmit (after fixing a
  cause), Cancel at Lulu (inside the delay), Refresh (pull state from Lulu).
- A job that fails five times stops retrying and is counted as `stuck` in
  every drain log at error level. `lulu_jobs.last_error` says why.
- `lulu-webhook` returns 200 for anything it can parse, because five failed
  deliveries deactivate Lulu's webhook. If tracking stops arriving, check
  `is_active` via `list_webhooks` and re-activate by updating it.
- UNPAID for more than a few minutes means no card on file at Lulu. Nothing
  prints until that is fixed in the Lulu portal.
