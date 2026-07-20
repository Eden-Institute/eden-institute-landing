-- A ledger of money actually received.
--
-- The gap this closes, found 2026-07-19 while chasing "I have no record of any of it":
-- subscriptions were recorded as STATE, never as TRANSACTIONS. profiles carries the
-- current tier, status and period dates, and gets OVERWRITTEN on every change. So:
--   * no subscription payment amount was stored anywhere. Not one column in the whole
--     schema held what a subscriber actually paid.
--   * renewals left no trace at all. Month two, three and four simply rewrote the same
--     profiles row with new period dates.
--   * churn showed as 'free/canceled' with no date and no lifetime value.
-- And the webhook never handled invoice.paid, which is the event that means money moved
-- on a subscription. It only handled customer.subscription.*, which means state changed.
--
-- SEPARATION OF CONCERNS, deliberately:
--   orders   = what we owe someone (the fulfillment spine: physical + digital goods)
--   payments = what money came in (every charge, including recurring ones)
-- A one-off purchase produces BOTH. A subscription renewal produces only a payment.
-- Revenue is therefore sum(payments), and it can be reconciled against Stripe directly
-- instead of being inferred from tier flags.

begin;

create table public.payments (
  id                        uuid primary key default gen_random_uuid(),

  -- Idempotency. Stripe retries webhooks, and a replay must not double-count revenue.
  -- Nullable because backfilled rows come from the Stripe API, not from an event.
  stripe_event_id           text unique,

  stripe_invoice_id         text,
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  stripe_customer_id        text,
  stripe_subscription_id    text,

  user_id                   uuid references auth.users(id) on delete set null,
  customer_email            text,

  -- 'subscription' = an invoice payment (initial or renewal).
  -- 'one_off'      = a single Checkout purchase (guide, course, kit, preorder).
  kind                      text not null check (kind in ('subscription', 'one_off')),

  -- Human-readable: the tier for subscriptions, the product label for one-offs.
  description               text,
  -- The Stripe lookup_key or price nickname, when known. Lets revenue group by product.
  lookup_key                text,

  amount_cents              integer not null,
  -- Stripe fee and net, when the balance transaction is available. Null on webhook-time
  -- rows (the fee is not in the invoice payload); the backfill script can fill them.
  fee_cents                 integer,
  net_cents                 integer,
  currency                  text not null default 'usd',

  status                    text not null check (status in ('paid', 'failed', 'refunded')),

  -- Billing period for subscription payments. Null for one-offs.
  period_start              timestamptz,
  period_end                timestamptz,

  -- When the money moved, per Stripe. NOT when we recorded it: a backfilled row must
  -- sit at its real date or every revenue chart is wrong.
  occurred_at               timestamptz not null,

  raw                       jsonb,
  created_at                timestamptz not null default now()
);

comment on table public.payments is
  'Every payment received, including subscription renewals. Distinct from orders, which '
  'is the fulfillment spine. Revenue = sum(payments); orders = things to deliver.';

-- A Stripe invoice pays once. Guards against double-counting when the same invoice
-- arrives via both a webhook and a backfill run.
create unique index payments_invoice_once
  on public.payments (stripe_invoice_id)
  where stripe_invoice_id is not null and status = 'paid';

create index payments_occurred_idx  on public.payments (occurred_at desc);
create index payments_customer_idx  on public.payments (stripe_customer_id);
create index payments_kind_idx      on public.payments (kind, status);

alter table public.payments enable row level security;
-- No policies: service-role writes, founder reads through the RPC below.

-- ── Founder revenue read ────────────────────────────────────────────────────
--
-- Deliberately simple and total: one row per payment, plus honest aggregates. The
-- existing Revenue tab infers revenue from tier flags and quiz booleans, which is what
-- made two real guide sales invisible. This reads the ledger instead.

create or replace function public.founder_payments(p_since timestamptz)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case
    when not public.is_founder() then jsonb_build_object('error', 'Not authorized')
    else jsonb_build_object(
      'summary', (
        select jsonb_build_object(
          'gross_cents',        coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
          'refunded_cents',     coalesce(sum(amount_cents) filter (where status = 'refunded'), 0),
          'net_cents',          coalesce(sum(amount_cents) filter (where status = 'paid'), 0)
                                - coalesce(sum(amount_cents) filter (where status = 'refunded'), 0),
          'subscription_cents', coalesce(sum(amount_cents) filter (where status = 'paid' and kind = 'subscription'), 0),
          'one_off_cents',      coalesce(sum(amount_cents) filter (where status = 'paid' and kind = 'one_off'), 0),
          'paid_count',         count(*) filter (where status = 'paid'),
          'failed_count',       count(*) filter (where status = 'failed')
        )
        from payments where occurred_at >= p_since
      ),
      'payments', (
        select coalesce(jsonb_agg(row_to_json(p) order by p.occurred_at desc), '[]'::jsonb)
        from (
          select id, occurred_at, kind, status, description, lookup_key,
                 amount_cents, currency, customer_email,
                 stripe_invoice_id, stripe_subscription_id, period_start, period_end
          from payments
          where occurred_at >= p_since
          order by occurred_at desc
          limit 500
        ) p
      )
    )
  end;
$$;

revoke all on function public.founder_payments(timestamptz) from public;
grant execute on function public.founder_payments(timestamptz) to authenticated;

-- ── Backfill the one-off sales we can already reconstruct ───────────────────
--
-- Every checkout.session.completed the webhook has ever seen is in stripe_events with a
-- full payload, so those payments can be rebuilt locally. Subscription invoices CANNOT:
-- no invoice.* event was ever received, so that history lives only in Stripe and needs
-- scripts/backfill-payments.ts, which talks to the Stripe API.
--
-- Idempotent on stripe_event_id.

insert into public.payments (
  stripe_event_id, stripe_payment_intent_id, stripe_customer_id,
  customer_email, kind, description, lookup_key,
  amount_cents, currency, status, occurred_at, raw
)
select
  e.event_id,
  o->>'payment_intent',
  o->>'customer',
  lower(coalesce(o->'customer_details'->>'email', o->>'customer_email')),
  'one_off',
  coalesce(
    case when o->'metadata'->>'lookup_key' = 'deep_dive_guide'
      then 'Deep-Dive Guide'
           || coalesce(': ' || nullif(o->'metadata'->>'constitution_nickname', ''), '')
    end,
    o->'metadata'->>'lookup_key',
    'One-off purchase'
  ),
  o->'metadata'->>'lookup_key',
  (o->>'amount_total')::integer,
  coalesce(o->>'currency', 'usd'),
  'paid',
  e.received_at,
  e.payload->'data'->'object'
from public.stripe_events e
cross join lateral (select e.payload->'data'->'object') as x(o)
where e.type = 'checkout.session.completed'
  and o->>'payment_status' = 'paid'
  and (o->>'amount_total') is not null
on conflict (stripe_event_id) do nothing;

commit;
