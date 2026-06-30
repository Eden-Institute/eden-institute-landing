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
| `create-checkout` (mode=payment, US shipping, metadata) | `charge.refunded` handling |
| `stripe-webhook` signature verify, dispatch | event-id idempotency ledger (`stripe_events`) |
| `homeschool_orders` -> evolved into `orders` | `order_status` enum + transition engine |
| Resend sender + `_shared` templates | `products`, `order_items`, `message_log` |
| Twilio `sendSms` (from founders-lock) | admin orders view, reconcile script, Sentry |

## Schema
See `supabase/migrations/20260630120000_orders_preorder_system.sql`. Evolves the empty
`homeschool_orders` into `orders` (rename + enum status + new columns); adds `products`,
`order_items`, `message_log`, `stripe_events`. All RLS-on, service-role only.

## Webhook idempotency (3 layers)
1. **Event gate** — first action after signature verify: `insert into stripe_events ... on
   conflict (event_id) do nothing`. 0 rows -> already processed -> 200 and stop.
2. **Order gate** — order write is an upsert on `UNIQUE(stripe_checkout_session_id)`.
3. **Message gate** — `message_log_sent_once` partial-unique: one successful send per
   (order, template_key, transition); failures may retry.

## Order lifecycle (the spine)
`paid -> preorder_hold -> ready_to_fulfill -> label_created -> shipped -> delivered`, plus
`cancelled` / `refunded` terminal branches. Phase 1 reaches only `preorder_hold` (+ refund).
Messages bind to STATE TRANSITIONS via a template registry, never to a global preorder flag.
A single `transition(order, new_status)` validates the edge, updates status, and dispatches
the message(s) registered for that edge through the guarded sender. The dispatcher refuses
to send for `cancelled`/`refunded`, so suppression is a property of state.

## Founding pricing (from launch pricing)
- **Kit:** $249 founding for the **first 500 orders**, then $349.
- **Notebook:** $19.99 founding **during the founding window**, then $24.99.
- Modeled as `founding_qty_limit` (500 for kit; null for notebook) and `founding_until`
  (window end for notebook; null for kit). Each product needs **two Stripe Prices**
  (founding + retail) with lookup_keys; checkout picks founding while under the limit, else
  retail, and stamps `order_items.is_founding`.
- **Concurrency caveat:** count-based price selection can slightly overshoot 500 under
  simultaneous checkouts (slot isn't "taken" until payment completes). Acceptable for a
  founding cohort ("first ~500"); a hard cap would need slot reservation at session creation.

## Compliance copy (checkout + confirmation email, no em dashes)
- Founding preorder: your patience helps fund the founding; in exchange you get the founding
  price and founding-member status.
- Estimated ship window: **Winter 2026** (stated as an estimate).
- Card charged today; if we cannot ship within the estimated window we will notify you and
  you may request a full refund. (FTC Mail Order Rule.)

## Founder / human steps
1. Stripe: enable Stripe Tax (origin, registrations, product tax codes); create founding +
   retail Prices per product with lookup_keys; add `charge.refunded` to the existing webhook
   endpoint's events.
2. Supabase secrets: `PREORDERS_LIVE=false`, `SENTRY_DSN`, confirm Twilio secrets.
3. Sentry: create project, provide DSN.
4. Approval gates: review PR -> apply migration + deploy patched webhook (as a pair) ->
   dark-test via admin action -> launch flip (`PREORDERS_LIVE=true`, reveal storefront).
5. Admin dashboard user: hello@edeninstitute.health.

## Build tracker
- [x] Migration (orders state machine + products/order_items/message_log/stripe_events)
- [ ] Product seed (awaiting final SKU numbers)
- [ ] create-checkout patch (Stripe Tax + unchecked sms_consent + founding price selection)
- [ ] stripe-webhook patch (transition engine + message_log + event ledger + charge.refunded)
- [ ] Confirmation email + preorder SMS templates (ship window: Winter 2026)
- [ ] Admin orders view (Supabase Auth; hello@edeninstitute.health)
- [ ] Reconcile script (Stripe payments vs orders)
- [ ] Sentry wiring on the webhook
- [ ] Dark-launch gating (PREORDERS_LIVE) + admin-only test action
- [ ] Adversarial review pass

## Deploy / launch sequence
Review PR -> apply migration + deploy patched stripe-webhook together -> configure Stripe
(Tax + Prices + charge.refunded) -> set secrets -> dark-test in prod via admin action ->
launch flip when samples arrive.
