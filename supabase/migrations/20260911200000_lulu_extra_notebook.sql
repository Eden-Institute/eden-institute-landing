-- Extra Student Notebook for the printed Sprouts set (founder decision
-- 2026-09-11): a second, third... Notebook for siblings, $29.99 each, printed
-- by Lulu in the same job as the set and shipped in the same parcel.
--
-- One sellable product, one printable (the Notebook, lulu_printables 'nb').
-- Shipping tier equals the set's so the cart's MAX-tier rule still charges
-- one $12 for the parcel. stripe_retail_price_id is the LIVE Price the founder
-- created in the Stripe Dashboard on 2026-09-11 (product prod_VF6XcSOc0qCfid,
-- $29.99 USD one-off, General tangible goods), read back from the Dashboard.
-- Idempotent.

insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   is_preorder, active, fulfillment, shipping_tier_cents, stripe_retail_price_id)
values
  ('sprouts_nb_print', 'Extra Student Notebook, printed', 'notebook', 2999, 2999, null,
   false, true, 'lulu', 1200, 'price_1UEcJx2NWfYbCZT8ClSdmBjd')
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
