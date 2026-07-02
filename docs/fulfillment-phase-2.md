# Fulfillment System — Phase 2 (plan + runbook)

Activates live fulfillment on the Phase 1 spine: the order_status enum, transition
engine, message_log idempotency, and admin dashboard are all EXTENDED, none rebuilt.
Branch `feat/fulfillment-phase-2`, stacked on `feat/preorder-system-phase-1` so preorder
and fulfillment can go live independently (preorder first; this merges later).

## Approved decisions (2026-07-02)
- **Platform: EasyPost** (webhook reliability, bundled CASS address validation, sub-second
  label API, free tier 3,000 labels/month; accepted loss: Shippo's nicer manual dashboard).
- **Rates: two flat tiers, no live rates.** Structural reason: Stripe hosted Checkout
  collects the address after session creation, so live rating would require rebuilding
  checkout. Tiers live on products.shipping_tier_cents (kit $12, notebook $5).
- **Blended mixed-cart formula:** customer shipping = MAX(tier of any item); extra
  notebooks ride in the kit box for $0. Always ONE shipment with combined weight
  (shipping-config.ts: calculateOrderShippingCents + combinedParcel).
- Pivot triggers to live rates: recorded postage deviates >20% from tier for a month;
  divergent-weight SKUs; AK/HI/international; custom checkout replaces Stripe hosted.

## What Phase 2 adds
- Migration `20260702180000`: products weight/dims/tier; orders label URL, carrier,
  tracking, cost, validation status, shipped/delivered timestamps; shipping_events
  ledger; message_log 'note' channel; products_public view; founder_orders v2.
- `_shared/easypost.ts` (REST client + HMAC verify), `_shared/shipping-config.ts`
  (tiers, parcel math), `_shared/order-fulfillment.ts` (release / validate / buy label /
  void / ship / deliver, all through transition()).
- Edge-keyed message registry (order-messages.ts): paid->preorder_hold (preorder
  confirmation), paid->ready_to_fulfill (in-stock confirmation), preorder_hold->
  ready_to_fulfill (preorder_released), label_created->shipped (tracking email+SMS),
  shipped->delivered (SMS). label_created->ready_to_fulfill (void) sends nothing.
  Same message_log_sent_once key; no transition ever double-sends.
- `shipping-webhook` EF: EasyPost tracker.updated -> delivered (HMAC + ledger + edge
  guards). `founder-fulfillment` EF: founder-JWT action endpoint for the queue.
- stripe-webhook: charge.refunded splits full (-> refunded, messaging suppressed) vs
  partial (state kept, idempotent audit note in message_log).
- /founder Orders tab = fulfillment queue (filters, bulk select, batch release, label
  buying behind the address-validation gate, mark-shipped confirm AFTER carrier pickup,
  manual delivered override).
- /preorder copy keyed off products_public.is_preorder (flip the flag, copy changes, no
  code edit). Terms render in the island so terms + buy buttons are inseparable.

## The switch (Phase 4)
1. Flip `products.is_preorder=false` (+ optional ships_on) for a product -> storefront
   shows in-stock language; new checkouts land ready_to_fulfill with in-stock messaging.
2. /founder -> Orders -> Release preorders -> pick SKU -> Batch release: every held order
   moves to ready_to_fulfill and gets exactly ONE preorder_released email/SMS.

## Fulfillment loop (Phase 5)
ready_to_fulfill: validate address (failures flag the order and BLOCK label purchase) ->
Buy label (single combined shipment, lowest rate, captures label/tracking/actual cost) ->
label_created -> print + hand to carrier -> AFTER pickup click Mark shipped (sends
tracking email/SMS) -> carrier webhook flips delivered (or manual override). Void label
returns the order to the queue and refunds postage; a voided order cannot be marked
shipped (no label/tracking on file).

## Founder setup (before dark test)
1. EasyPost: create account (free tier), add a payment method (funds postage), create a
   PRODUCTION API key.
2. Supabase secrets: `EASYPOST_API_KEY`, `EASYPOST_WEBHOOK_SECRET` (any long random
   string), `SHIP_FROM_JSON` (see shipping-config.ts for the shape).
3. Register the webhook once: `deno run --allow-net --allow-env scripts/setup-easypost-webhook.ts`.
4. CONFIRM real product weights/dims from production samples and update the products
   rows (migration seeds placeholders; labels misprice if these are wrong).
5. Confirm the notebook flat tier ($5 placeholder) before flipping any product in-stock.

## Deploy (on founder go, after PR #227's set)
Apply migration 20260702180000 -> deploy stripe-webhook + shipping-webhook (verify_jwt
OFF) + founder-fulfillment (JWT ON) + redeploy create-checkout (shared modules) -> set
secrets -> register webhook -> dark test: buy admin-test order, release, validate, buy
label on a real address, void it, re-buy, mark shipped after a real pickup, watch the
webhook deliver. Reconcile script still applies to payment; message_log audits sends.

## Edge cases (spec checklist)
- Mixed cart: single shipment, combined weight, MAX-tier blended rate (documented above).
- Address validation failure: order flagged in admin with the carrier's reasons; label
  purchase refuses until re-validated.
- Label voided/refunded: label fields cleared, order back to ready_to_fulfill, mark-
  shipped structurally impossible without a label.
- Partial refund after shipping: order stays shipped; idempotent note in message_log;
  no cancelled/refunded messaging.
- cancelled/refunded remain terminal; charge.refunded (full) unchanged from Phase 1.
