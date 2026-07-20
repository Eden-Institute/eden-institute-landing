-- founder_orders: return customer_phone so the founder can call a buyer.
--
-- Stripe Checkout has collected the phone since the preorder system shipped
-- (create-checkout: phone_number_collection.enabled = true), the webhook writes it to
-- orders.customer_phone (order-flow.ts), and it is already exposed on the
-- preorder_broadcast_list view. The one place it was missing is the founder dashboard
-- RPC, so the number was captured on every order and visible nowhere.
--
-- Founder intent (2026-07-20): "in case something goes wrong I will personally call each
-- one individually." That is a service contact, not a marketing list. This does NOT
-- change consent: SMS to the number still requires orders.sms_consent, which is
-- collected separately and defaults unchecked (TCPA: never pre-check).
--
-- Additive only: one column added to an existing select. No signature change, no grant
-- change, no behaviour change for any other field. `create or replace` keeps this a
-- no-op on re-run so `db push` stays clean.

create or replace function public.founder_orders(p_since timestamptz)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $function$
  select case
    when not public.is_founder() then jsonb_build_object('error', 'Not authorized')
    else jsonb_build_object(
      'summary', (
        select jsonb_build_object(
          'total',         count(*) filter (where not public.is_internal_email(customer_email)),
          'preorder_hold', count(*) filter (where status = 'preorder_hold' and not public.is_internal_email(customer_email)),
          'cancelled',     count(*) filter (where status = 'cancelled' and not public.is_internal_email(customer_email)),
          'refunded',      count(*) filter (where status = 'refunded' and not public.is_internal_email(customer_email)),
          -- SMS opt-ins previously counted cancelled and refunded orders, overstating the
          -- messageable list. Every other field here filters terminal statuses.
          'sms_consent',   count(*) filter (where sms_consent
                                              and status not in ('cancelled','refunded')
                                              and not public.is_internal_email(customer_email)),
          'gross_cents',   coalesce(sum(amount_total_cents) filter (
                             where status not in ('cancelled','refunded')
                               and not public.is_internal_email(customer_email)), 0),
          'tax_cents',     coalesce(sum(tax_cents) filter (
                             where status not in ('cancelled','refunded')
                               and not public.is_internal_email(customer_email)), 0),
          'internal_cents', coalesce(sum(amount_total_cents) filter (
                             where status not in ('cancelled','refunded')
                               and public.is_internal_email(customer_email)), 0),
          'internal_count', count(*) filter (where public.is_internal_email(customer_email))
        )
        from orders
        where created_at >= p_since
      ),
      'orders', (
        select coalesce(jsonb_agg(row_to_json(o)), '[]'::jsonb)
        from (
          select
            ord.id, ord.order_number, ord.customer_email, ord.customer_phone,
            ord.shipping_name, ord.status,
            ord.amount_total_cents, ord.tax_cents, ord.currency,
            ord.sms_consent, ord.is_preorder, ord.product_label, ord.created_at,
            public.is_internal_email(ord.customer_email) as is_internal,
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
$function$;
