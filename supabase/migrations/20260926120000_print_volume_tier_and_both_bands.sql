-- Co-op notebook tier + both-bands bundle (founder decisions 2026-09-26).
--
-- WRITTEN FOR REVIEW, NOT APPLIED. Apply with the Supabase MCP (or db push)
-- only when the PR is approved, BEFORE deploying the edge functions: the new
-- create-checkout selects products.volume_price_cents / volume_min_qty and
-- would refuse every print checkout (500) until these columns exist.
--
--   1. products.volume_price_cents + volume_min_qty. A row with both set is
--      charged its normal price for units 1 .. (volume_min_qty - 1) and the
--      volume price from unit volume_min_qty on, per order. The split lives in
--      supabase/functions/_shared/print-pricing.ts (create-checkout, receipt and
--      the /books buy box all use it). Both NULL = no tier, exactly as before.
--   2. The extra Student Notebooks (sprouts_nb_print, seedlings_nb_print): 1-5
--      stay $39.99, the 6th and beyond $32.00. Only as add-ons to a set in the
--      same order; create-checkout enforces that and the 100-per-order cap.
--   3. both_bands_print_set: the Sprouts AND Seedlings printed sets together,
--      $429 (vs $498 bought separately), shipping from $16. Priced by Stripe
--      lookup key 'both_bands_print_set' (no Stripe Price id is stored). The row
--      is INSERTED INACTIVE: the Stripe Price does not exist yet, and an active
--      row would show a buy button that checkout then refuses. After the founder
--      creates the Price (spec in the PR), activate it:
--        update public.products set active = true, updated_at = now()
--        where sku = 'both_bands_print_set';
--   4. print_products_public: also lists a book_set priced by lookup key (the
--      bundle; Back to Eden rows are product_type 'book' and stay out), treats
--      the bundle like a Seedlings row (hidden until the Seedlings files are in),
--      and exposes the two volume columns to the buy box. Columns are appended,
--      as CREATE OR REPLACE VIEW requires; grants are kept and re-asserted.
--
--   5. shipping_tier_cents follows the new shipping formula's base amounts
--      (founder 2026-09-26, "whatever covers my cost"; the formula itself is
--      supabase/functions/_shared/print-pricing.ts SHIPPING_RULES, one rule over
--      the whole cart, which create-checkout charges). The column stays the
--      "configured" gate and the one-unit amount: bundle 1600, paperback 800
--      (was 600, which Lulu's $5.69 MAIL + $0.75 fee did not cover). Sets 1200,
--      notebooks 1200 and the coil books 1000 already match.
--
-- Idempotent. A re-run never overwrites a volume price, Stripe key or active
-- flag changed later by hand.

begin;

-- 1. products: volume tier columns ------------------------------------------

alter table public.products
  add column if not exists volume_price_cents integer,
  add column if not exists volume_min_qty integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_volume_tier_check'
  ) then
    alter table public.products add constraint products_volume_tier_check check (
      (volume_price_cents is null and volume_min_qty is null)
      or (volume_price_cents > 0 and volume_min_qty >= 2)
    );
  end if;
end
$$;

comment on column public.products.volume_price_cents is
  'Unit price (cents) from the volume_min_qty-th unit of this SKU in one order. NULL = no volume tier. Split by _shared/print-pricing.ts splitVolumeTier.';
comment on column public.products.volume_min_qty is
  'First unit in an order charged volume_price_cents (6 = units 1-5 at retail, 6 on at volume). NULL = no volume tier.';

-- 2. The notebook tier ------------------------------------------------------

update public.products
set volume_price_cents = 3200,
    volume_min_qty     = 6,
    updated_at         = now()
where sku in ('sprouts_nb_print', 'seedlings_nb_print')
  and volume_price_cents is null
  and volume_min_qty is null;

-- 3. The both-bands bundle ----------------------------------------------------

insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   is_preorder, active, fulfillment, shipping_tier_cents, stripe_retail_price_id, stripe_lookup_key)
values
  ('both_bands_print_set', 'Sprouts and Seedlings Printed Curriculum Sets', 'book_set', 42900, 42900, null,
   false, false, 'lulu', 1600, null, 'both_bands_print_set')
on conflict (sku) do update set
  name                 = excluded.name,
  product_type         = excluded.product_type,
  retail_price_cents   = excluded.retail_price_cents,
  founding_price_cents = excluded.founding_price_cents,
  is_preorder          = excluded.is_preorder,
  fulfillment          = excluded.fulfillment,
  shipping_tier_cents  = excluded.shipping_tier_cents,
  stripe_lookup_key    = coalesce(public.products.stripe_lookup_key, excluded.stripe_lookup_key),
  -- active is deliberately NOT touched on conflict: the founder flips it.
  updated_at           = now();

-- 5. Shipping base amounts (header item 5; independent of the view) ------

update public.products set shipping_tier_cents = 800, updated_at = now()
where sku = 'bte_paperback_print' and shipping_tier_cents is distinct from 800;

-- 4. The storefront view ----------------------------------------------------

create or replace view public.print_products_public as
select sku, name, retail_price_cents, shipping_tier_cents, volume_price_cents, volume_min_qty
from public.products
where active
  and fulfillment = 'lulu'
  and (
    stripe_retail_price_id is not null
    or (product_type = 'book_set' and stripe_lookup_key is not null)
  )
  and shipping_tier_cents is not null
  and (
    (sku not like 'seedlings\_%' and sku not like 'both\_bands\_%')
    or (
      select count(*)
      from public.lulu_printables lp
      where lp.band = 'seedlings'
        and (lp.printable_id is not null or (lp.interior_url is not null and lp.cover_url is not null))
    ) = 3
  );

grant select on public.print_products_public to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.print_products_public from public, anon, authenticated;

commit;
