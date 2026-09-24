-- Extra Student Notebook for the printed Seedlings (grades 3-5) set, founder
-- decision 2026-09-24: a second, third... Seedlings Notebook for siblings,
-- $39.99 each, sold only as an add-on to the Seedlings set on /books, printed by
-- Lulu in the same job and shipped in the same parcel. The exact mirror of
-- sprouts_nb_print (20260911200000, repriced by 20260911220000).
--
-- One sellable product, one printable (lulu_printables seedlings/nb, 227 pages,
-- files already in). Shipping tier equals the set's (1200) so the cart's
-- MAX-tier rule still charges one shipping amount for the parcel.
--
-- stripe_retail_price_id is deliberately NULL here and is set separately after
-- deploy. The live Price exists (created in the Stripe Dashboard 2026-09-24:
-- price_1UJK0n2NWfYbCZT8de1VEZ49, $39.99 USD one-time, on product
-- prod_VJxw2dagT54hOY, General tangible goods). Until it is set print_products_public hides this
-- row (it requires a Price id), so the /books Seedlings box shows no notebook
-- option while the set itself keeps selling, and create-checkout refuses the SKU
-- with PRINT_SHOP_NOT_CONFIGURED if it is ever sent by hand.
--
-- print_products_public needs no change: it lists by rule, not by SKU, and its
-- seedlings_* clause (20260923200000) already covers this SKU.
--
-- Idempotent. A re-run never blanks a Price id or shipping tier filled in later.

insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   is_preorder, active, fulfillment, shipping_tier_cents, stripe_retail_price_id)
values
  ('seedlings_nb_print', 'Seedlings Extra Student Notebook, printed', 'notebook', 3999, 3999, null,
   false, true, 'lulu', 1200, null)
on conflict (sku) do update set
  name                   = excluded.name,
  product_type           = excluded.product_type,
  retail_price_cents     = excluded.retail_price_cents,
  founding_price_cents   = excluded.founding_price_cents,
  is_preorder            = excluded.is_preorder,
  fulfillment            = excluded.fulfillment,
  shipping_tier_cents    = coalesce(public.products.shipping_tier_cents, excluded.shipping_tier_cents),
  stripe_retail_price_id = coalesce(public.products.stripe_retail_price_id, excluded.stripe_retail_price_id),
  updated_at             = now();
