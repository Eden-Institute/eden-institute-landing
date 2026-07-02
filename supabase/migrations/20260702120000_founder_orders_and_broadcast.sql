-- Preorder system, Phase 1 (part 2): founder dashboard read RPC + broadcast list view.
-- Depends on 20260630120000_orders_preorder_system.sql (orders/products/order_items/
-- message_log). Apply together with it on deploy day.

begin;

-- 1. Broadcast list: every order that ORIGINATED as a preorder (is_preorder marker,
-- set at creation, never consulted by transactional messaging) and has not been
-- cancelled or refunded. Used for MANUAL manufacturer-update broadcasts, which are
-- engagement emails separate from the transactional state-transition messages.
-- Membership deliberately survives Phase-2 states: a shipped founding order stays
-- in the founding cohort list.
create view public.preorder_broadcast_list as
select
  o.id            as order_id,
  o.customer_email,
  o.shipping_name,
  o.customer_phone,
  o.sms_consent,
  o.status,
  o.product_label,
  o.created_at
from public.orders o
where o.is_preorder
  and o.status not in ('cancelled', 'refunded');

-- The view runs with owner (postgres) rights and would bypass orders RLS, so lock it
-- to the service role only (broadcasts are sent by the founder's tooling, never the app).
revoke all on public.preorder_broadcast_list from public, anon, authenticated;

-- 2. Founder dashboard Orders tab. Same pattern as founder_lead_feed and the other
-- founder_* RPCs: SECURITY DEFINER gated by is_founder() (JWT email check), so any
-- other authenticated account gets 'Not authorized' regardless of the UI.
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
            ord.id, ord.customer_email, ord.shipping_name, ord.status,
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

commit;
