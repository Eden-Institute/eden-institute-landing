-- Purchase attribution: where each BUYER came from (2026-09-26).
--
-- WRITTEN FOR REVIEW, NOT APPLIED. Apply with the Supabase MCP (or db push) when
-- the PR is approved. Order relative to the edge-function deploy does NOT matter
-- for safety: stripe-webhook writes these columns in a separate best-effort UPDATE
-- after the order is recorded, so if it is deployed first the UPDATE is rejected,
-- logged, and the order is untouched. Applying this FIRST is still the right order,
-- because any purchase made in between is recorded without its attribution (the
-- values stay recoverable from orders.raw -> metadata -> attr_*).
--
-- Signups have carried first-touch attribution since src/lib/attribution.ts; purchases
-- never did. Checkout now sends the same first-touch values, create-checkout stamps
-- them into the Stripe Checkout Session metadata as attr_*, and stripe-webhook copies
-- them onto the rows below. See supabase/functions/_shared/purchase-attribution.ts.
--
--   1. orders.attr_*   every one-off purchase: print shop, Back to Eden PDF, Starter
--                      Unit, Deep-Dive Guide, preorders (off sale, kept for parity).
--   2. payments.attr_* the money ledger: one-off payments, and subscription invoice
--                      payments (from the Subscription's metadata, so renewals carry
--                      the subscriber's ORIGINAL first touch; kind tells them apart).
--   3. founder_orders v5: v4 (20260911000100) plus the seven attr_* fields, so the
--      /founder Orders tab can show a Source column. Additive only; the summary block
--      and every existing field are unchanged.
--
-- All columns nullable, no defaults, no backfill: rows written before this carry no
-- attribution, and NULL is the truthful value for them. Idempotent.

begin;

-- 1 + 2. Columns ---------------------------------------------------------------

alter table public.orders
  add column if not exists attr_utm_source   text,
  add column if not exists attr_utm_medium   text,
  add column if not exists attr_utm_campaign text,
  add column if not exists attr_utm_content  text,
  add column if not exists attr_utm_term     text,
  add column if not exists attr_referrer     text,
  add column if not exists attr_source_url   text;

alter table public.payments
  add column if not exists attr_utm_source   text,
  add column if not exists attr_utm_medium   text,
  add column if not exists attr_utm_campaign text,
  add column if not exists attr_utm_content  text,
  add column if not exists attr_utm_term     text,
  add column if not exists attr_referrer     text,
  add column if not exists attr_source_url   text;

comment on column public.orders.attr_utm_source is
  'First-touch utm_source of the buyer''s session (e.g. makers_market, pinterest). From Checkout metadata attr_utm_source. NULL = none captured or pre-2026-09-26.';
comment on column public.orders.attr_referrer is
  'First-touch EXTERNAL referrer of the buyer''s session. From Checkout metadata attr_referrer.';
comment on column public.orders.attr_source_url is
  'Landing page (origin + path) of the buyer''s first attributed touch. From Checkout metadata attr_source_url.';
comment on column public.payments.attr_utm_source is
  'First-touch utm_source of the purchase (one-off) or of the original subscription checkout (subscription). NULL = none captured or pre-2026-09-26.';

-- 3. founder_orders v5 ---------------------------------------------------------

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
