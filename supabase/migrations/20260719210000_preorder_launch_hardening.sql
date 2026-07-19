-- Pre-launch hardening for the founding preorder (launch 2026-07-29).
--
-- Three things, all of which have to exist before the first real order:
--   1. A real STOCK ceiling. Until now `founding_qty_limit` (500) was only a PRICE
--      switch: the 501st order succeeded at retail, and so would the 5,000th. There
--      was no code path that could ever say "sold out", and the only stop button was
--      hand-editing products.active. Founder decision 2026-07-19: print run is 1000
--      kits + 1000 notebooks, so 500 stays the price gate and 1000 becomes the cap.
--   2. A human-readable ORDER NUMBER. /returns tells customers twice to quote one and
--      it did not exist: orders are keyed by a bare uuid never shown to the buyer,
--      absent from the confirmation email, and not rendered on the dashboard.
--   3. A real SHIP DATE as data. products.ships_on was NULL and the customer-facing
--      window lived only as a hardcoded string, so nothing could ever compute whether
--      we are late or drive an FTC delay notice.
--
-- Safe to apply at any time, but deliberately applied at ZERO orders: the order_number
-- backfill below is a no-op today and the column can therefore be NOT NULL immediately.

begin;

-- ── 1. Stock ceiling ────────────────────────────────────────────────────────
--
-- NULL means uncapped (unchanged behaviour). Distinct from founding_qty_limit,
-- which governs PRICE only. Both can be set: units 1-500 sell at the founding
-- price, 501-1000 at retail, and 1001 is refused.

alter table public.products
  add column stock_qty integer check (stock_qty is null or stock_qty >= 0);

comment on column public.products.stock_qty is
  'Hard ceiling on net units sellable. NULL = uncapped. Distinct from '
  'founding_qty_limit, which only switches price.';

-- Net units sold across BOTH price tiers. Mirrors founding_units_sold but without
-- the is_founding filter, so it is the availability number rather than the
-- founding-allocation number.
create or replace function public.units_sold(p_product_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::integer
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and o.status not in ('cancelled', 'refunded');
$$;

revoke all on function public.units_sold(uuid) from public, anon, authenticated;
grant execute on function public.units_sold(uuid) to service_role;

-- Availability for one product. STABLE and side-effect free, unlike founding_gate:
-- running out of stock is a reversible fact (a refund frees a unit), so there is
-- deliberately no latch here. The founding window latches; stock does not.
--   sold      = net units across both tiers
--   cap       = products.stock_qty (null = uncapped)
--   remaining = null when uncapped, else greatest(cap - sold, 0)
--   sold_out  = cap is not null and sold >= cap
create or replace function public.stock_gate(p_product_id uuid)
returns table (sold integer, cap integer, remaining integer, sold_out boolean)
language sql
stable
set search_path = public
as $$
  select
    units_sold(p_product_id),
    p.stock_qty,
    case when p.stock_qty is null then null::integer
         else greatest(p.stock_qty - units_sold(p_product_id), 0) end,
    p.stock_qty is not null and units_sold(p_product_id) >= p.stock_qty
  from products p
  where p.id = p_product_id;
$$;

revoke all on function public.stock_gate(uuid) from public, anon, authenticated;
grant execute on function public.stock_gate(uuid) to service_role;

-- ── 2. Human-readable order number ──────────────────────────────────────────
--
-- Format ET-1001, ET-1002, ... Starts at 1001 so the first founding order is not
-- "ET-1", which reads like a test row to a customer. The sequence is the identity;
-- gaps are fine and expected (a failed insert burns a value).

create sequence public.order_number_seq start with 1001;

alter table public.orders
  add column order_number text;

-- Backfill is a no-op at zero orders, but keeping it makes the migration safe to
-- run against a populated table if it is ever replayed on a branch.
update public.orders
   set order_number = 'ET-' || lpad(nextval('public.order_number_seq')::text, 4, '0')
 where order_number is null;

alter table public.orders
  alter column order_number set default 'ET-' || lpad(nextval('public.order_number_seq')::text, 4, '0'),
  alter column order_number set not null;

create unique index orders_order_number_key on public.orders (order_number);

comment on column public.orders.order_number is
  'Customer-facing order identifier (ET-1001...). Quoted in the confirmation email, '
  'on the founder dashboard, and by /returns. The uuid PK stays internal.';

-- ── 3. Ship date as data ────────────────────────────────────────────────────
--
-- products.ships_on already existed and was NULL. Founder decision 2026-07-19:
-- the BINDING commitment is on or before 2026-12-31 (marketing speaks about early
-- November; the FTC clock runs on the guarantee). Stored per product so a later
-- preorder wave carries its own date instead of inheriting this one.

comment on column public.products.ships_on is
  'Binding outside ship date for the CURRENT preorder wave. Drives the customer-facing '
  'guarantee and the FTC delay-notice deadline. Set per wave; do not reuse a past wave''s date.';

-- ── 4. Checkout rate limiting ───────────────────────────────────────────────
--
-- create-checkout is public (verify_jwt=false, CORS *), unauthenticated, and every
-- request mints a real Stripe Checkout Session. The threat is not someone buying too
-- many kits: it is CARD TESTING, where bots use open checkout endpoints to validate
-- stolen card numbers in bulk. That spikes dispute and fraud metrics, which is exactly
-- the profile that gets an account reserved or frozen while it is holding preorder money.
--
-- Keyed on a SALTED HASH of the caller IP, never the raw address, so the table holds no
-- personal data. The EF computes the hash; this side never sees an IP.
--
-- Windows are bucketed rather than sliding: good enough to stop automated abuse, and one
-- row per IP per window keeps it cheap. Old rows are pruned per-key on write; a periodic
-- sweep can be added later if volume ever justifies it.

create table public.checkout_rate_limits (
  ip_hash      text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (ip_hash, window_start)
);

comment on table public.checkout_rate_limits is
  'Bucketed per-IP request counters for the public create-checkout endpoint. Keyed by a '
  'salted hash, never a raw IP. Written only by checkout_rate_bump(); RLS on with no '
  'policies, so no client session can read or forge counts.';

alter table public.checkout_rate_limits enable row level security;
-- Deliberately no policies: reachable only through checkout_rate_bump() below.

-- Atomic increment for the caller's current window, returning the new count.
create or replace function public.checkout_rate_bump(
  p_ip_hash text,
  p_window_seconds integer default 600
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  -- Bucket the clock: every caller in the same interval shares a window_start.
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  -- Bounded cleanup: only this key's expired buckets, so the write stays O(1)-ish.
  delete from public.checkout_rate_limits
   where ip_hash = p_ip_hash and window_start < v_window;

  insert into public.checkout_rate_limits (ip_hash, window_start, count)
    values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start)
    do update set count = checkout_rate_limits.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.checkout_rate_bump(text, integer) from public, anon, authenticated;
grant execute on function public.checkout_rate_bump(text, integer) to service_role;

-- ── 5. Surface the order number on the founder dashboard ────────────────────
--
-- Same body as 20260702120000, with ord.order_number added to the projection. Without
-- it the founder cannot look up the number a customer quotes, which defeats the point
-- of having one.

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
          'total',         count(*),
          'preorder_hold', count(*) filter (where status = 'preorder_hold'),
          'cancelled',     count(*) filter (where status = 'cancelled'),
          'refunded',      count(*) filter (where status = 'refunded'),
          'sms_consent',   count(*) filter (where sms_consent),
          'gross_cents',   coalesce(sum(amount_total_cents) filter (where status not in ('cancelled','refunded')), 0),
          'tax_cents',     coalesce(sum(tax_cents) filter (where status not in ('cancelled','refunded')), 0)
        )
        from orders
        where created_at >= p_since
      ),
      'orders', (
        select coalesce(jsonb_agg(row_to_json(o)), '[]'::jsonb)
        from (
          select
            ord.id, ord.order_number, ord.customer_email, ord.shipping_name, ord.status,
            ord.amount_total_cents, ord.tax_cents, ord.currency,
            ord.sms_consent, ord.is_preorder, ord.product_label, ord.created_at,
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

-- ── 6. Apply the founder decisions to the live rows ─────────────────────────
--
-- Founder decisions 2026-07-19: print run 1000 kits + 1000 notebooks; binding ship
-- guarantee on or before 2026-12-31 (marketing speaks about early November, but the
-- FTC clock runs on the guarantee). founding_qty_limit is deliberately untouched: 500
-- remains the PRICE gate, 1000 is the new availability ceiling.

update public.products
   set stock_qty = 1000,
       ships_on  = date '2026-12-31'
 where sku in ('sprouts_kit', 'sprouts_notebook');

commit;
