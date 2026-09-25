-- Back to Eden book shop (founder request 2026-09-25: "build the checkout now").
--
-- Camila's book Back to Eden sells in six ways from /back-to-eden: three printed
-- titles (6x9 paperback, Study & Journal Edition, Study Guide), printed to order
-- by Lulu on the existing print rail, and the same three as PDF downloads.
--
--   1. products: product_type 'book', and a stripe_lookup_key column. The six
--      Stripe Prices were created by the founder in the Dashboard with lookup keys
--      (bte_*_print / bte_*_digital); checkout resolves the price by that key, so
--      no price id has to be copied into the database. stripe_retail_price_id stays
--      NULL for these rows, which also keeps them out of print_products_public
--      (the /books storefront), where they do not belong.
--   2. lulu_printables: band 'bte' and book keys pb / sj / sg, with the package
--      ids and page counts of the final files. The file URLs are NOT set here:
--      they are filled once the print files are uploaded, and create-checkout
--      refuses a Back to Eden print sale until they are (printableProblems).
--   3. The three printed products. Prices are the founder's (2026-09-25):
--      $24.99 paperback + $6 shipping, $64 Study & Journal + $10, $44 Study
--      Guide + $10. retail_price_cents is the display and E2E test amount; the
--      buyer is charged the Stripe Price found by lookup key.
--   4. book_downloads: one row per digital purchase, holding the download token
--      emailed to the buyer. Service role only.
--   5. A private storage bucket, book-files, for the PDFs (downloads and the
--      print files Lulu fetches). Every file is under the plan's 50 MB cap.
--
-- Nothing already on sale changes: the Sprouts and Seedlings rows, the storefront
-- view and the starter tables are untouched.

begin;

-- 1. products ----------------------------------------------------------------

alter table public.products
  add column if not exists stripe_lookup_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_stripe_lookup_key_key'
  ) then
    alter table public.products add constraint products_stripe_lookup_key_key unique (stripe_lookup_key);
  end if;
end
$$;

comment on column public.products.stripe_lookup_key is
  'Stripe Price lookup key. When set and stripe_retail_price_id is NULL, create-checkout charges the active Price carrying this key.';

alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check
  check (product_type in ('kit', 'notebook', 'book_set', 'book'));

-- 2. lulu_printables ---------------------------------------------------------

alter table public.lulu_printables drop constraint if exists lulu_printables_band_check;
alter table public.lulu_printables add constraint lulu_printables_band_check
  check (band in ('sprouts', 'seedlings', 'bte'));

alter table public.lulu_printables drop constraint if exists lulu_printables_book_key_check;
alter table public.lulu_printables add constraint lulu_printables_book_key_check
  check (book_key in ('tg', 'nb', 'ra', 'pb', 'sj', 'sg'));

insert into public.lulu_printables (band, book_key, title, pod_package_id, page_count)
values
  ('bte', 'pb', 'Back to Eden: A Biblical Foundation for Herbal Healing', '0600X0900.BW.STD.PB.060UW444.MXX', 186),
  ('bte', 'sj', 'Back to Eden: Study & Journal Edition',                  '0850X1100.FC.STD.CO.060UW444.MXX', 386),
  ('bte', 'sg', 'Back to Eden: Study Guide',                              '0850X1100.FC.STD.CO.060UW444.MXX', 266)
on conflict (band, book_key) do update set
  title          = excluded.title,
  pod_package_id = excluded.pod_package_id,
  page_count     = excluded.page_count,
  updated_at     = now();

-- 3. The printed titles ------------------------------------------------------

insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   is_preorder, active, fulfillment, shipping_tier_cents, stripe_retail_price_id, stripe_lookup_key)
values
  ('bte_paperback_print',     'Back to Eden, Paperback',               'book', 2499, 2499, null, false, true, 'lulu',  600, null, 'bte_paperback_print'),
  ('bte_study_journal_print', 'Back to Eden, Study & Journal Edition', 'book', 6400, 6400, null, false, true, 'lulu', 1000, null, 'bte_study_journal_print'),
  ('bte_study_guide_print',   'Back to Eden, Study Guide',             'book', 4400, 4400, null, false, true, 'lulu', 1000, null, 'bte_study_guide_print')
on conflict (sku) do update set
  name                 = excluded.name,
  product_type         = excluded.product_type,
  retail_price_cents   = excluded.retail_price_cents,
  founding_price_cents = excluded.founding_price_cents,
  is_preorder          = excluded.is_preorder,
  fulfillment          = excluded.fulfillment,
  shipping_tier_cents  = excluded.shipping_tier_cents,
  stripe_lookup_key    = excluded.stripe_lookup_key,
  updated_at           = now();

-- 4. Digital downloads -------------------------------------------------------

create table if not exists public.book_downloads (
  id                         uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  order_id                   uuid references public.orders(id) on delete set null,
  sku                        text not null
    check (sku in ('bte_paperback_digital', 'bte_study_journal_digital', 'bte_study_guide_digital')),
  email                      text,
  purchaser_name             text,
  -- The credential in the emailed link. 64 hex characters, never logged.
  download_token             text not null unique,
  email_sent_at              timestamptz,
  email_attempts             integer not null default 0,
  last_error                 text,
  download_count             integer not null default 0,
  last_download_at           timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table public.book_downloads is
  'One row per Back to Eden PDF purchase. The token in the emailed link is the download credential; downloads stop if the order is refunded. Written by stripe-webhook, read by book-download. Service role only.';

alter table public.book_downloads enable row level security;
-- No policies on purpose: only the service role (edge functions) reads or writes it.

-- 5. Storage -----------------------------------------------------------------

-- PRIVATE. The files are the product; access is only ever through signed URLs
-- minted server-side (short-lived for buyers, long-lived for Lulu's fetch).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

commit;
