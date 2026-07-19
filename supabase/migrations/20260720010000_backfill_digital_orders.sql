-- Backfill one-off DIGITAL sales (Deep-Dive Guide, courses) into orders.
--
-- Until the accompanying stripe-webhook change, a guide purchase recorded nothing but
-- a BOOLEAN flip of quiz_completions.purchased_guide, matched on the buyer's email.
-- Consequences, both observed in production on 2026-07-18:
--   * Two $4.99 guide sales to the same address were indistinguishable from one. The
--     second overwrote the first flag. No amount, no date, no product, no line item.
--   * A buyer whose email matched no quiz row hit an early return that ALSO skipped
--     PDF delivery. They paid and received nothing.
--
-- The money was never lost, only unrecorded: every sale is in stripe_events, which the
-- webhook writes before dispatching. This reconstructs the missing orders rows from
-- that ledger, so revenue reporting matches Stripe.
--
-- Idempotent. Keyed on the UNIQUE stripe_checkout_session_id, so re-running inserts
-- nothing. Safe to replay on any branch.

begin;

insert into public.orders (
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_customer_id,
  customer_email,
  lookup_key,
  product_label,
  amount_total_cents,
  tax_cents,
  currency,
  quantity,
  payment_status,
  status,
  is_preorder,
  raw,
  created_at
)
select
  o->>'id',
  o->>'payment_intent',
  o->>'customer',
  lower(coalesce(o->'customer_details'->>'email', o->>'customer_email')),
  o->'metadata'->>'lookup_key',
  -- Same label shape recordDigitalOrder() produces, so backfilled and live rows read alike.
  case
    when o->'metadata'->>'lookup_key' = 'deep_dive_guide'
      then 'Deep-Dive Guide'
           || coalesce(': ' || nullif(o->'metadata'->>'constitution_nickname', ''), '')
    else o->'metadata'->>'lookup_key'
  end,
  (o->>'amount_total')::integer,
  (o->'total_details'->>'amount_tax')::integer,
  o->>'currency',
  1,
  o->>'payment_status',
  -- Digital goods are delivered at purchase. 'paid' would park them in the
  -- fulfillment queue forever looking unshipped.
  'delivered'::public.order_status,
  -- MUST be false: preorder_broadcast_list selects on this, and a guide buyer must
  -- never receive kit manufacturing updates.
  false,
  e.payload->'data'->'object',
  -- The real purchase time, not the time this migration runs.
  e.received_at
from public.stripe_events e
cross join lateral (select e.payload->'data'->'object') as x(o)
where e.type = 'checkout.session.completed'
  and o->>'mode' = 'payment'
  and o->>'payment_status' = 'paid'
  and (
    o->'metadata'->>'lookup_key' = 'deep_dive_guide'
    or o->'metadata'->>'lookup_key' like 'course\_%'
  )
  and o->>'id' is not null
on conflict (stripe_checkout_session_id) do nothing;

commit;
