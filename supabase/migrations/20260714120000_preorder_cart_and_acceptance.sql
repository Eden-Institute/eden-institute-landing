-- Preorder system, Phase 1 (part 3): single-session cart + disclaimer acceptance record.
-- Depends on 20260630120000_orders_preorder_system.sql. Apply with the same deploy set
-- (create-checkout + stripe-webhook redeploy) since the checkout request shape changes.
--
-- Three concerns:
--   1. Disclaimer acceptance is recorded on the order (chargeback / FTC Mail Order Rule
--      evidence): the two checkbox booleans, the exact ship-window text the buyer saw,
--      and when checkout was created.
--   2. A cart line can now have quantity > 1, so the founding-allocation counter must
--      SUM(quantity), not count rows. PostgREST cannot aggregate here, so it becomes an RPC.
--   3. One order can now hold multiple line items written by a webhook that Stripe retries,
--      so order_items gains UNIQUE(order_id, product_id): replay-safe upserts instead of
--      relying on an early-return that left a crash window between item inserts.

begin;

-- 1. Acceptance record.
alter table public.orders
  add column accepted_ship_window      boolean not null default false,
  add column accepted_founding_member  boolean not null default false,
  add column accepted_ship_window_text text,
  add column disclaimer_accepted_at    timestamptz;

-- 2. Founding units sold for a product = SUM of quantities on founding-priced lines,
-- excluding cancelled/refunded orders (same semantics the old row-count had, minus the
-- quantity blindness). Service-role only: called by create-checkout via the admin client.
create or replace function public.founding_units_sold(p_product_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::integer
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and oi.is_founding
    and o.status not in ('cancelled', 'refunded');
$$;

revoke all on function public.founding_units_sold(uuid) from public, anon, authenticated;
grant execute on function public.founding_units_sold(uuid) to service_role;

-- 3. One line per (order, product): carts carry distinct SKUs with a quantity, never two
-- lines of the same product. Makes addOrderItem's 23505-tolerant insert genuinely
-- idempotent on webhook replays.
create unique index order_items_order_product_once
  on public.order_items (order_id, product_id);

commit;
