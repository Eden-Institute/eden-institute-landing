-- Fulfillment system, Phase 2. EXTENDS the Phase 1 preorder schema (20260630120000 +
-- 20260702120000); rebuilds nothing. The order_status enum already contains the full
-- lifecycle; this migration adds the shipping-capture fields those states record, the
-- physical product data that feeds label generation, the EasyPost event ledger, and the
-- public product view that lets storefront copy key off is_preorder with no code edit.

begin;

-- 1. Products: physical attributes for label generation + the flat shipping tier.
alter table public.products
  add column weight_grams        integer check (weight_grams is null or weight_grams > 0),
  add column package_length_cm   numeric(6,1),
  add column package_width_cm    numeric(6,1),
  add column package_height_cm   numeric(6,1),
  add column shipping_tier_cents integer check (shipping_tier_cents is null or shipping_tier_cents >= 0);

-- Placeholder physicals: FOUNDER MUST CONFIRM real weights/dims from production samples
-- before any label is bought (labels misprice otherwise). Tiers: kit $12 (matches the
-- checkout flat rate), notebook $5.
update public.products set weight_grams = 1400, package_length_cm = 33.0,
  package_width_cm = 25.0, package_height_cm = 10.0, shipping_tier_cents = 1200
  where sku = 'sprouts_kit';
update public.products set weight_grams = 450, package_length_cm = 28.0,
  package_width_cm = 21.5, package_height_cm = 2.5, shipping_tier_cents = 500
  where sku = 'sprouts_notebook';

-- 2. Orders: shipping capture, mapped to the enum transitions (label_created records
-- label/tracking/cost; shipped/delivered record their timestamps).
alter table public.orders
  add column shipping_label_url        text,
  add column shipping_carrier          text,
  add column tracking_number           text,
  add column tracking_url              text,
  add column shipping_cost_cents       integer,
  add column easypost_shipment_id      text,
  add column address_validation_status text not null default 'unvalidated'
    check (address_validation_status in ('unvalidated','valid','failed')),
  add column address_validation_error  text,
  add column shipped_at                timestamptz,
  add column delivered_at              timestamptz;

-- Carrier webhook looks orders up by tracking number.
create index orders_tracking_number_idx on public.orders (tracking_number)
  where tracking_number is not null;

-- 3. message_log: allow non-message audit rows (partial refunds log here per spec
-- without triggering any messaging; 'note'/'logged' rows never occupy the
-- message_log_sent_once slot because that index is scoped to status='sent').
alter table public.message_log drop constraint message_log_channel_check;
alter table public.message_log add constraint message_log_channel_check
  check (channel in ('email','sms','note'));
alter table public.message_log drop constraint message_log_status_check;
alter table public.message_log add constraint message_log_status_check
  check (status in ('sent','failed','logged'));

-- 4. EasyPost event idempotency ledger (twin of stripe_events; same fail-open claim
-- pattern in code).
create table public.shipping_events (
  event_id     text primary key,        -- EasyPost evt_... id
  type         text not null,
  status       text not null default 'received' check (status in ('received','processed','error')),
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  payload      jsonb
);
alter table public.shipping_events enable row level security;

-- 5. Public product view: storefront copy keys off is_preorder/ships_on with NO code
-- edit (the /preorder island reads this). Exposes only marketing-safe columns.
create view public.products_public as
select sku, name, product_type, retail_price_cents, founding_price_cents,
       is_preorder, ships_on, active
from public.products
where active;
grant select on public.products_public to anon, authenticated;

-- 6. founder_orders v2: same contract as 20260702120000, plus the shipping fields the
-- fulfillment queue renders.
create or replace function public.founder_orders(p_since timestamptz)
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
          'total',            count(*),
          'preorder_hold',    count(*) filter (where status = 'preorder_hold'),
          'ready_to_fulfill', count(*) filter (where status = 'ready_to_fulfill'),
          'label_created',    count(*) filter (where status = 'label_created'),
          'shipped',          count(*) filter (where status = 'shipped'),
          'delivered',        count(*) filter (where status = 'delivered'),
          'cancelled',        count(*) filter (where status = 'cancelled'),
          'refunded',         count(*) filter (where status = 'refunded'),
          'sms_consent',      count(*) filter (where sms_consent),
          'gross_cents',      coalesce(sum(amount_total_cents) filter (where status not in ('cancelled','refunded')), 0),
          'tax_cents',        coalesce(sum(tax_cents) filter (where status not in ('cancelled','refunded')), 0)
        )
        from orders
        where created_at >= p_since
      ),
      'orders', (
        select coalesce(jsonb_agg(row_to_json(o)), '[]'::jsonb)
        from (
          select
            ord.id, ord.customer_email, ord.shipping_name, ord.status,
            ord.amount_total_cents, ord.tax_cents, ord.currency,
            ord.sms_consent, ord.is_preorder, ord.product_label, ord.lookup_key,
            ord.created_at,
            ord.shipping_label_url, ord.shipping_carrier, ord.tracking_number,
            ord.tracking_url, ord.shipping_cost_cents, ord.easypost_shipment_id,
            ord.address_validation_status, ord.address_validation_error,
            ord.shipped_at, ord.delivered_at, ord.shipping_address,
            (
              select coalesce(jsonb_agg(jsonb_build_object(
                'sku', p.sku,
                'name', p.name,
                'quantity', oi.quantity,
                'unit_price_cents', oi.unit_price_cents,
                'is_founding', oi.is_founding)), '[]'::jsonb)
              from order_items oi
              join products p on p.id = oi.product_id
              where oi.order_id = ord.id
            ) as items,
            (
              select coalesce(jsonb_agg(jsonb_build_object(
                'channel', ml.channel,
                'template_key', ml.template_key,
                'status', ml.status,
                'created_at', ml.created_at)
                order by ml.created_at), '[]'::jsonb)
              from message_log ml
              where ml.order_id = ord.id
            ) as messages
          from orders ord
          where ord.created_at >= p_since
          order by ord.created_at desc
          limit 500
        ) o
      )
    )
  end;
$$;

revoke all on function public.founder_orders(timestamptz) from public;
grant execute on function public.founder_orders(timestamptz) to authenticated;

commit;
