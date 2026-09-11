-- Lulu print-on-demand fulfilment, part 2 of 2.
--
-- The printed Sprouts curriculum (Teacher's Guide, Student Notebook, Read-Aloud
-- storybook) prints to order at Lulu and ships straight to the buyer. Founder
-- decision 2026-09-10: the three books sell TOGETHER as one set for $249 with
-- a flat $12 shipping charge, never separately. So there is one sellable
-- product and three printables behind it.
--
-- This migration adds what the Stripe -> orders spine needs to hand a paid
-- order to Lulu and follow it to the buyer's door:
--
--   1. products: which fulfilment rail a product uses and its flat shipping
--      tier, plus the seeded set (price and shipping from the founder
--      decision, and the live Stripe Price the founder created in the
--      Dashboard on 2026-09-10: price_1UEKA22NWfYbCZT8s5nFReu7 on product prod_VEnlvZetV0GZuJ,
--      $249.00 USD one-off, tax code txcd_99999999).
--   2. lulu_printables: one row per book Lulu manufactures, with the package
--      id, page count, public source URLs for the first job, and the
--      printable id Lulu returns afterwards. Seeded with the verified package
--      ids; URLs and the Read-Aloud page count are the founder's to fill.
--   3. orders: the Lulu job id and status, and the tracking fields the shipped
--      and delivered emails read. Column names match the July fulfilment
--      branch (feat/fulfillment-phase-2) so it can still land later
--      (ADD COLUMN IF NOT EXISTS on both sides).
--   4. lulu_jobs: the durable work item. The webhook records the sale and
--      queues this; a separate function (lulu-submit) talks to Lulu, because a
--      call to a third party has no business inside a Stripe webhook that Stripe
--      will retry on timeout.
--   5. lulu_events: idempotency ledger for Lulu's status webhooks (twin of
--      stripe_events).
--   6. print_products_public: the storefront reads prices from here, so the page
--      never carries a hardcoded price.
--   7. founder_orders v4: the dashboard sees the new fields.
--
-- Depends on 20260911000000 (the in_production enum value) having committed.

begin;

-- 1. Products ----------------------------------------------------------------

alter table public.products
  add column if not exists fulfillment text not null default 'stock'
    check (fulfillment in ('stock', 'lulu', 'digital')),
  -- Flat shipping charged at checkout for this product. The cart charges the
  -- MAX tier across its lines (one parcel, the July fulfilment decision).
  -- NULL means "not decided", and the checkout refuses to sell until it is.
  add column if not exists shipping_tier_cents integer
    check (shipping_tier_cents is null or shipping_tier_cents >= 0);

comment on column public.products.fulfillment is
  'stock = we ship it ourselves; lulu = printed and shipped to order by Lulu; digital = delivered by email.';

-- The set. founding_price_cents is NOT NULL on this table and unused on this
-- rail, so it equals the retail price. stripe_retail_price_id is the LIVE Price
-- read back from the Stripe Dashboard on 2026-09-10 (product
-- prod_VEnlvZetV0GZuJ, $249.00 USD, one-off). Idempotent.
insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   is_preorder, active, fulfillment, shipping_tier_cents, stripe_retail_price_id)
values
  ('sprouts_print_set', 'Sprouts Printed Curriculum Set', 'book_set', 24900, 24900, null,
   false, true, 'lulu', 1200, 'price_1UEKA22NWfYbCZT8s5nFReu7')
on conflict (sku) do update set
  name                   = excluded.name,
  product_type           = excluded.product_type,
  retail_price_cents     = excluded.retail_price_cents,
  founding_price_cents   = excluded.founding_price_cents,
  is_preorder            = excluded.is_preorder,
  fulfillment            = excluded.fulfillment,
  shipping_tier_cents    = excluded.shipping_tier_cents,
  stripe_retail_price_id = excluded.stripe_retail_price_id,
  updated_at             = now();

-- 2. lulu_printables: what Lulu manufactures --------------------------------

create table if not exists public.lulu_printables (
  -- 'tg' | 'nb' | 'ra'. Matches LULU_BOOKS in _shared/lulu-config.ts.
  book_key   text primary key check (book_key in ('tg', 'nb', 'ra')),
  title      text not null,
  -- Lulu POD package id, dotted format ("[Trim].[Ink].[Quality].[Binding].[Paper].[Finish]").
  -- Lulu accepts the legacy 27-character format until 2027-02-01; use dotted.
  pod_package_id text not null,
  -- Interior page count. Lulu prices per page and validates the cover against it.
  page_count integer check (page_count is null or page_count >= 2),
  -- Public URLs Lulu can download the source files from. Only needed until the
  -- first job validates; after that printable_id is used and these can be
  -- cleared. Supabase Storage on this plan caps files at 50 MB and the interiors
  -- are far larger, so these are expected to be external direct-download links.
  interior_url text,
  cover_url    text,
  -- Lulu's immutable printable id, returned on the first successful print job.
  -- Once set, print jobs reference it and no file is transferred again.
  printable_id uuid,
  updated_at timestamptz not null default now()
);

comment on table public.lulu_printables is
  'One row per book Lulu prints. printable_id is set by lulu-submit from the first successful job and reused after.';

alter table public.lulu_printables enable row level security;

-- Verified against lulu-print-api-spec-sheet.xlsx on 2026-09-10. The Read-Aloud
-- page count is unknown (perfect bound needs at least 32; the founder is adding
-- pages) and stays NULL until she sets it. On re-run, values the founder has
-- filled in are kept.
insert into public.lulu_printables (book_key, title, pod_package_id, page_count)
values
  ('tg', 'Eden''s Table Sprouts: Teacher''s Guide',      '0850X1100.FC.STD.CO.080CW444.GXX', 240),
  ('nb', 'Eden''s Table Sprouts: Student Notebook',      '0850X1100.FC.STD.CO.080CW444.GXX', 224),
  ('ra', 'Eden''s Table Sprouts: Read-Aloud Storybook',  '0583X0827.FC.STD.PB.080CW444.GXX', null)
on conflict (book_key) do update set
  title          = excluded.title,
  pod_package_id = excluded.pod_package_id,
  page_count     = coalesce(public.lulu_printables.page_count, excluded.page_count),
  updated_at     = now();

-- 3. Orders ------------------------------------------------------------------

alter table public.orders
  -- Which rail fulfils this order. NULL for legacy rows; the webhook stamps it.
  add column if not exists fulfillment text
    check (fulfillment is null or fulfillment in ('stock', 'lulu', 'digital')),
  add column if not exists lulu_print_job_id bigint,
  -- Lulu's own status name (CREATED, UNPAID, PRODUCTION_DELAYED, IN_PRODUCTION,
  -- SHIPPED, DELIVERED, REJECTED, CANCELED ...). Informational; our order_status
  -- is the state machine.
  add column if not exists lulu_status text,
  add column if not exists lulu_status_message text,
  add column if not exists lulu_submitted_at timestamptz,
  -- What Lulu charged us (print + shipping + tax), in cents, once known.
  add column if not exists lulu_cost_cents integer,
  -- Tracking. Same names as feat/fulfillment-phase-2.
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

create index if not exists orders_lulu_print_job_id_idx
  on public.orders (lulu_print_job_id) where lulu_print_job_id is not null;

-- 4. lulu_jobs: the work item -------------------------------------------------

create table if not exists public.lulu_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One job per order. UNIQUE is the idempotency key: a Stripe webhook retry
  -- that reaches the enqueue step again inserts nothing.
  order_id uuid not null unique references public.orders(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted', 'failed', 'cancelled')),
  attempts integer not null default 0,
  last_error text,

  print_job_id bigint,
  submitted_at timestamptz
);

comment on table public.lulu_jobs is
  'Fulfilment work item for a Lulu print-on-demand order, drained by the lulu-submit edge function. '
  'pending/failed rows under the attempt cap are retried; submitted means Lulu holds the job.';

create index if not exists lulu_jobs_status_idx
  on public.lulu_jobs (status, created_at)
  where status in ('pending', 'failed');

alter table public.lulu_jobs enable row level security;

-- 5. lulu_events: webhook idempotency ledger ---------------------------------

-- Lulu's webhook payload carries no event id, only the print job with its
-- current status. The key is therefore (print job, status name, status changed
-- timestamp), which is unique per transition and stable across Lulu's retries.
create table if not exists public.lulu_events (
  event_key    text primary key,
  print_job_id bigint,
  status_name  text,
  status       text not null default 'received' check (status in ('received', 'processed', 'error')),
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  payload      jsonb
);

alter table public.lulu_events enable row level security;

-- 6. Storefront price source --------------------------------------------------

-- The /books page reads this. Marketing-safe columns only, active Lulu products
-- only, and only rows the checkout would actually accept (Stripe Price and
-- shipping decided), so the page can never advertise a set that checkout then
-- refuses.
create or replace view public.print_products_public as
select sku, name, retail_price_cents, shipping_tier_cents
from public.products
where active
  and fulfillment = 'lulu'
  and stripe_retail_price_id is not null
  and shipping_tier_cents is not null;

grant select on public.print_products_public to anon, authenticated;

-- 7. founder_orders v4 ---------------------------------------------------------

-- Same contract as 20260720060000 (customer_phone, internal-email filtering),
-- plus: fulfilment rail, Lulu job id/status, tracking, and per-state counts for
-- the fulfilment queue tiles. Additive only.

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
