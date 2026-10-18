-- Last marked touch: what brought each BUYER back to buy (2026-10-18).
--
-- Founder approved 2026-10-18 (design, the eight names below, a 90-day window, and a
-- "Sales by last source" box on the /founder Orders tab).
--
-- First touch (20260926200000_purchase_attribution.sql) only remembers where a buyer
-- FIRST came from, so the nurture email or Friday note that brings them back to buy
-- is never credited. The browser now also keeps the most recent MARKED arrival
-- (UTMs, an ad click id, or another site's referrer; never this site's own links,
-- never a return from Stripe or Klarna) and checkout carries it as attr_last_*.
-- See src/lib/attribution.ts captureLastTouch and
-- supabase/functions/_shared/purchase-attribution.ts.
--
--   1. orders.attr_last_*    every one-off purchase.
--   2. payments.attr_last_*  the money ledger (subscription renewals carry the last
--                            touch before the ORIGINAL subscription checkout).
--   3. founder_orders v6: v5 (20260926200000, verified identical to the live
--      definition 2026-10-18) plus the eight attr_last_* fields. Additive only.
--
-- attr_last_click holds the NAME of the ad click id that marked the arrival
-- (gclid, gbraid, wbraid or fbclid), never the id itself.
--
-- ORDER. Apply this BEFORE deploying stripe-webhook. The webhook writes last touch in
-- its own update after the first-touch one, so if it ran first that update would be
-- rejected and logged and nothing else would change; applying first just means no
-- purchase in between loses its last touch (still recoverable from
-- orders.raw -> metadata -> attr_last_*).
--
-- All columns nullable, no defaults, no backfill: NULL is the truthful value for
-- every earlier row. Idempotent.

begin;

-- 1 + 2. Columns ---------------------------------------------------------------

alter table public.orders
  add column if not exists attr_last_utm_source   text,
  add column if not exists attr_last_utm_medium   text,
  add column if not exists attr_last_utm_campaign text,
  add column if not exists attr_last_utm_content  text,
  add column if not exists attr_last_utm_term     text,
  add column if not exists attr_last_referrer     text,
  add column if not exists attr_last_source_url   text,
  add column if not exists attr_last_click        text;

alter table public.payments
  add column if not exists attr_last_utm_source   text,
  add column if not exists attr_last_utm_medium   text,
  add column if not exists attr_last_utm_campaign text,
  add column if not exists attr_last_utm_content  text,
  add column if not exists attr_last_utm_term     text,
  add column if not exists attr_last_referrer     text,
  add column if not exists attr_last_source_url   text,
  add column if not exists attr_last_click        text;

comment on column public.orders.attr_last_utm_source is
  'Last MARKED touch before the purchase: utm_source of the most recent arrival with UTMs, an ad click id or an external referrer (never internal navigation), held 90 days. From Checkout metadata attr_last_utm_source. NULL = none captured or pre-2026-10-18.';
comment on column public.orders.attr_last_referrer is
  'Last marked touch: the EXTERNAL referrer of that arrival. From Checkout metadata attr_last_referrer.';
comment on column public.orders.attr_last_source_url is
  'Last marked touch: landing page (origin + path) of that arrival. From Checkout metadata attr_last_source_url.';
comment on column public.orders.attr_last_click is
  'Last marked touch: which ad click id was on that arrival (gclid, gbraid, wbraid, fbclid). The name only, never the id.';
comment on column public.payments.attr_last_utm_source is
  'Last marked touch before the purchase (one-off) or before the original subscription checkout (subscription). NULL = none captured or pre-2026-10-18.';

-- 3. founder_orders v6 ---------------------------------------------------------

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
          'total',            count(*) filter (where not public.is_internal_email(customer_email)),
          'preorder_hold',    count(*) filter (where status = 'preorder_hold' and not public.is_internal_email(customer_email)),
          'ready_to_fulfill', count(*) filter (where status = 'ready_to_fulfill' and not public.is_internal_email(customer_email)),
          'in_production',    count(*) filter (where status = 'in_production' and not public.is_internal_email(customer_email)),
          'shipped',          count(*) filter (where status = 'shipped' and not public.is_internal_email(customer_email)),
          'delivered',        count(*) filter (where status = 'delivered' and not public.is_internal_email(customer_email)),
          'cancelled',        count(*) filter (where status = 'cancelled' and not public.is_internal_email(customer_email)),
          'refunded',         count(*) filter (where status = 'refunded' and not public.is_internal_email(customer_email)),
          'sms_consent',      count(*) filter (where sms_consent
                                                and status not in ('cancelled','refunded')
                                                and not public.is_internal_email(customer_email)),
          'gross_cents',      coalesce(sum(amount_total_cents) filter (
                                where status not in ('cancelled','refunded')
                                  and not public.is_internal_email(customer_email)), 0),
          'tax_cents',        coalesce(sum(tax_cents) filter (
                                where status not in ('cancelled','refunded')
                                  and not public.is_internal_email(customer_email)), 0),
          'lulu_cost_cents',  coalesce(sum(lulu_cost_cents) filter (
                                where status not in ('cancelled','refunded')
                                  and not public.is_internal_email(customer_email)), 0),
          'internal_cents',   coalesce(sum(amount_total_cents) filter (
                                where status not in ('cancelled','refunded')
                                  and public.is_internal_email(customer_email)), 0),
          'internal_count',   count(*) filter (where public.is_internal_email(customer_email))
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
            ord.fulfillment, ord.lulu_print_job_id, ord.lulu_status, ord.lulu_status_message,
            ord.lulu_submitted_at, ord.lulu_cost_cents,
            ord.shipping_carrier, ord.tracking_number, ord.tracking_url,
            ord.shipped_at, ord.delivered_at,
            ord.attr_utm_source, ord.attr_utm_medium, ord.attr_utm_campaign,
            ord.attr_utm_content, ord.attr_utm_term, ord.attr_referrer, ord.attr_source_url,
            ord.attr_last_utm_source, ord.attr_last_utm_medium, ord.attr_last_utm_campaign,
            ord.attr_last_utm_content, ord.attr_last_utm_term, ord.attr_last_referrer,
            ord.attr_last_source_url, ord.attr_last_click,
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
            ) as messages,
            (
              select jsonb_build_object(
                'status', lj.status,
                'attempts', lj.attempts,
                'last_error', lj.last_error,
                'submitted_at', lj.submitted_at)
              from lulu_jobs lj
              where lj.order_id = ord.id
            ) as lulu_job
          from orders ord
          where ord.created_at >= p_since
          order by ord.created_at desc
          limit 500
        ) o
      )
    )
  end;
$function$;

revoke all on function public.founder_orders(timestamptz) from public;
grant execute on function public.founder_orders(timestamptz) to authenticated;

commit;
