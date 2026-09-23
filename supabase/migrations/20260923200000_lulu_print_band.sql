-- Seedlings printed set on the Lulu print shop: make the print rail band-aware.
--
-- Founder decisions 2026-09-23: the Seedlings (grades 3-5) Teacher's Guide,
-- Student Notebook and Read-Aloud Storybook sell as ONE set through the same
-- Lulu print-on-demand shop as Sprouts, $249 like Sprouts, the Teacher's Guide
-- and Notebook on the same Lulu package as Sprouts' (letter, coil bound) and the
-- Read-Aloud A5 perfect bound like Sprouts'.
--
-- What this does, all idempotent, nothing about Sprouts changes:
--
--   1. lulu_printables gets a `band` column ('sprouts' default, so the three
--      live Sprouts rows become ('sprouts', tg/nb/ra) untouched) and its primary
--      key moves from (book_key) to (band, book_key).
--   2. Three Seedlings printable rows, with the package ids the Sprouts rows use
--      and NO files. page_count is left NULL on purpose: the Seedlings page
--      counts live in ONE place, SEEDLINGS_PAGE_COUNTS in
--      supabase/functions/_shared/lulu-config.ts, and a row value would override
--      it. interior_url and cover_url are the main session's to fill; until all
--      three are filled, create-checkout refuses a Seedlings sale
--      (PRINT_SHOP_NOT_CONFIGURED) before any card is charged.
--   3. The seedlings_print_set products row, $249 (founder decision), with NO
--      Stripe Price and NO shipping tier. Both are left NULL because neither
--      exists yet / neither was decided for Seedlings: print_products_public
--      hides a row missing either, so /books shows "coming soon", and
--      create-checkout refuses it. A re-run never overwrites values filled in
--      later.
--
-- No orders column: a print order's band is derived from orders.lookup_key (the
-- first cart SKU), and create-checkout allows one band per order.
--
-- Depends on 20260911000100 (lulu_printables, products.fulfillment,
-- products.shipping_tier_cents, product_type 'book_set').

begin;

-- 1. lulu_printables: band + composite key ----------------------------------

alter table public.lulu_printables
  add column if not exists band text not null default 'sprouts';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lulu_printables'::regclass and conname = 'lulu_printables_band_check'
  ) then
    alter table public.lulu_printables
      add constraint lulu_printables_band_check check (band in ('sprouts', 'seedlings'));
  end if;

  -- Swap the primary key only while it is still the single-column one.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.lulu_printables'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (book_key)'
  ) then
    alter table public.lulu_printables drop constraint lulu_printables_pkey;
    alter table public.lulu_printables add constraint lulu_printables_pkey primary key (band, book_key);
  end if;
end
$$;

comment on column public.lulu_printables.band is
  'Which band''s printed year this book belongs to: sprouts (K-2) or seedlings (3-5). Matches LULU_BOOKS in _shared/lulu-config.ts.';

-- 2. Seedlings printables ----------------------------------------------------

insert into public.lulu_printables (band, book_key, title, pod_package_id, page_count)
values
  ('seedlings', 'tg', 'Eden''s Table Seedlings: Teacher''s Guide',     '0850X1100.FC.STD.CO.080CW444.GXX', null),
  ('seedlings', 'nb', 'Eden''s Table Seedlings: Student Notebook',     '0850X1100.FC.STD.CO.080CW444.GXX', null),
  ('seedlings', 'ra', 'Eden''s Table Seedlings: Read-Aloud Storybook', '0583X0827.FC.STD.PB.080CW444.GXX', null)
on conflict (band, book_key) do update set
  title          = excluded.title,
  pod_package_id = excluded.pod_package_id,
  updated_at     = now();

-- 3. The Seedlings set -------------------------------------------------------

insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   is_preorder, active, fulfillment, shipping_tier_cents, stripe_retail_price_id)
values
  ('seedlings_print_set', 'Seedlings Printed Curriculum Set', 'book_set', 24900, 24900, null,
   false, true, 'lulu', null, null)
on conflict (sku) do update set
  name                   = excluded.name,
  product_type           = excluded.product_type,
  retail_price_cents     = excluded.retail_price_cents,
  founding_price_cents   = excluded.founding_price_cents,
  is_preorder            = excluded.is_preorder,
  fulfillment            = excluded.fulfillment,
  -- Filled by hand after this migration; a re-run must not blank them.
  shipping_tier_cents    = coalesce(public.products.shipping_tier_cents, excluded.shipping_tier_cents),
  stripe_retail_price_id = coalesce(public.products.stripe_retail_price_id, excluded.stripe_retail_price_id),
  updated_at             = now();

-- 4. Storefront: hide a Seedlings product until its files are in -------------

-- Same columns and same rules as 20260911000100, plus ONE clause that applies
-- only to seedlings_* SKUs: every Seedlings printable must have its files (or a
-- cached Lulu printable id). So /books shows the Seedlings set as "coming soon"
-- until price, shipping AND files are all in, instead of offering a set that
-- checkout would then refuse. Sprouts rows are filtered exactly as before.
-- CREATE OR REPLACE keeps the existing grants.
create or replace view public.print_products_public as
select sku, name, retail_price_cents, shipping_tier_cents
from public.products
where active
  and fulfillment = 'lulu'
  and stripe_retail_price_id is not null
  and shipping_tier_cents is not null
  and (
    sku not like 'seedlings\_%'
    or (
      select count(*)
      from public.lulu_printables lp
      where lp.band = 'seedlings'
        and (lp.printable_id is not null or (lp.interior_url is not null and lp.cover_url is not null))
    ) = 3
  );

commit;
