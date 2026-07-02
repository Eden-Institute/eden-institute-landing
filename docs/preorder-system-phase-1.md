# Preorder System — Phase 1 (plan + build tracker)

Takes founding-preorder payments, records who bought what, confirms the order, stays
compliant. No inventory, no shipping in this phase (orders only reach `preorder_hold`).

## Architecture decision
**Extend the existing Supabase Edge Function stack — NOT a new Next.js/Vercel app.** A live
physical-checkout flow already exists (`create-checkout` + `stripe-webhook` + the
`homeschool_orders` scaffold). A second Stripe webhook endpoint would risk double-processing
live payments. One endpoint, one signing secret. We harden what's already there.

## Reuse vs new
| Reuse / adapt | New |
|---|---|
| `create-checkout` (mode=payment, US shipping, metadata) | preorder branch: Stripe Tax, founding-price selection, PREORDERS_LIVE gate |
| `stripe-webhook` signature verify, dispatch | event-id idempotency ledger (`stripe_events`), `charge.refunded`, Sentry |
| `homeschool_orders` -> evolved into `orders` | `order_status` enum + transition engine |
| Resend sender + `_shared` templates | `products`, `order_items`, `message_log` |
| Twilio `sendSms` (from founders-lock) | /preorder storefront, founder Orders tab, broadcast view, reconcile script |

## Schema
`supabase/migrations/20260630120000_orders_preorder_system.sql` evolves the empty
`homeschool_orders` into `orders` (rename + enum status + new columns); adds `products`,
`order_items`, `message_log`, `stripe_events`. All RLS-on, service-role only.
`20260702120000_founder_orders_and_broadcast.sql` adds the `founder_orders` RPC
(is_founder-gated, powers the /founder Orders tab) and the `preorder_broadcast_list`
view (service-role only). Apply BOTH together with the paired webhook deploy.

## Webhook idempotency (3 layers)
1. **Event gate** — first action after signature verify: `insert into stripe_events ... on
   conflict (event_id) do nothing`. Already `processed` -> 200 and stop. Fail-open by design.
2. **Order gate** — order write is an upsert on `UNIQUE(stripe_checkout_session_id)`.
3. **Message gate** — `message_log_sent_once` partial-unique: one successful send per
   (order, template_key, transition); failures may retry.

## Order lifecycle (the spine)
`paid -> preorder_hold -> ready_to_fulfill -> label_created -> shipped -> delivered`, plus
`cancelled` / `refunded` terminal branches. Phase 1 reaches only `preorder_hold` (+ refund).
Messages bind to STATE TRANSITIONS via the registry in `_shared/order-messages.ts`, never to
a global preorder flag. `transition()` validates the edge, updates status, and dispatches the
registered messages through the guarded sender. Terminal states fire nothing, so suppression
is a property of state.

## Founding pricing (single cohort)
- **Kit:** $249 founding ($100 below the $349 retail) — the \"$100 off\" claim is KIT-ONLY copy.
- **Notebook:** $19.99 founding, $24.99 retail (rides the same cohort; no $100 claim).
- The cohort ends when **500 founding kits** have sold (`FOUNDING_GATE_SKU`/`FOUNDING_GATE_LIMIT`
  in `_shared/order-config.ts`; per-product `founding_qty_limit` in `products`). Checkout then
  automatically bills the retail Stripe Price. Count-based selection can overshoot ~500 by a
  few under simultaneous checkouts — accepted for a founding cohort.
- Each product has founding + retail Stripe Price IDs (in `products` and mirrored in
  `order-config.ts`); `order_items.is_founding` stamps what was actually sold.

## Dark launch / launch flip
- `create-checkout` refuses preorder requests with 403 `PREORDERS_NOT_LIVE` until the
  **`PREORDERS_LIVE`** secret is `true`. The webhook is always live (harmless: only gated
  checkout can mint `preorder_sku` sessions).
- **Dark test in prod:** open `/preorder?admin=<PREORDER_ADMIN_TOKEN>` and buy with a real
  card (sessions get `preorder_test=true` metadata); verify order -> `preorder_hold`, email
  (+SMS if consented), message_log rows; refund in the Stripe Dashboard; verify -> `refunded`.
- **Sentry check:** `curl -X POST <fn-url>/stripe-webhook -H \"x-eden-sentry-test: <token>\"`
  -> 500 + event in Sentry.
- **Launch flip:** set `PREORDERS_LIVE=true` (secrets change; no redeploy) and link /preorder
  from the homeschool page + nav. Rollback = flip the secret back.

## Compliance copy (on /preorder BEFORE redirect + in the confirmation email; no em dashes)
- Founding preorder: your patience helps fund the founding; in exchange you get $100 off the
  complete kit and founding-member status.
- Estimated ship window: **Winter 2026**, stated as an estimate.
- Card charged today; if we cannot ship within the estimated window we will notify you and
  you may request a full refund. (FTC Mail Order Rule.)
- SMS: explicit UNCHECKED opt-in checkbox on /preorder; phone collected by Stripe; preorder
  SMS sends only with consent; STOP language included.

## Broadcast updates (manufacturer news)
Query `select * from preorder_broadcast_list` (service role; excludes cancelled/refunded,
includes later Phase-2 states) and send via the one-off email tooling (log to
`email_oneoff_log` as usual). These are manual engagement emails, separate from the
transactional state-transition messages.

## Reconcile (missed-webhook backstop)
`deno run --allow-net --allow-env scripts/reconcile-preorders.ts [--days 30]`
with STRIPE_SECRET_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Read-only. Flags: paid in
Stripe but missing in DB, in DB but not found paid in Stripe, amount mismatches, orders stuck
in `paid`. Exit 1 on any discrepancy.

## Founder / human steps (before dark test)
1. Stripe: enable Stripe Tax (origin address, registrations, product tax codes on the two
   products); confirm the four Price IDs in `order-config.ts` are LIVE mode; add
   `charge.refunded` to the existing webhook endpoint's subscribed events.
2. Supabase secrets: `PREORDERS_LIVE=false`, `PREORDER_ADMIN_TOKEN=<random>`, `SENTRY_DSN`,
   confirm Twilio secrets (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM or MESSAGING_SERVICE_SID).
3. Sentry: create project, provide DSN.
4. Approval gates: review PR -> apply BOTH migrations + deploy patched stripe-webhook +
   create-checkout (as a set) -> dark-test via /preorder?admin=... -> launch flip when
   samples arrive.

## Build tracker
- [x] Migration (orders state machine + products/order_items/message_log/stripe_events)
- [x] Product seed (sprouts_kit, sprouts_notebook with live Price IDs)
- [x] create-checkout patch (Stripe Tax + unchecked sms_consent + founding price selection + PREORDERS_LIVE gate)
- [x] stripe-webhook patch (transition engine + message_log + event ledger + charge.refunded)
- [x] Confirmation email + preorder SMS templates (ship window: Winter 2026)
- [x] /preorder storefront (compliance copy, unchecked SMS opt-in, dark-launch aware)
- [x] Admin orders view (/founder Orders tab via founder_orders RPC; hello@edeninstitute.health)
- [x] Broadcast list (preorder_broadcast_list view)
- [x] Reconcile script (Stripe payments vs orders)
- [x] Sentry wiring (webhook + message sends + deliberate-error test path)
- [x] Dark-launch gating (PREORDERS_LIVE + PREORDER_ADMIN_TOKEN admin override)
- [ ] Adversarial review pass
- [ ] Deploy day: apply migrations + deploy EFs as a set (founder go required)

## Deploy / launch sequence
Review PR -> apply both migrations + deploy patched stripe-webhook AND create-checkout
together -> configure Stripe (Tax + Prices + charge.refunded) -> set secrets -> dark-test in
prod via /preorder?admin=... -> run reconcile -> launch flip when samples arrive.
