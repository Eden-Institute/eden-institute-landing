-- Seed the two Phase-1 launch products. The founding price is a single cohort that ends when
-- 500 Sprouts kits sell; the notebook rides the same cohort, so only the kit carries a
-- founding_qty_limit (the gate is enforced against the kit count in create-checkout).
-- Idempotent: re-running updates the rows in place.

insert into public.products
  (sku, name, product_type, retail_price_cents, founding_price_cents, founding_qty_limit,
   stripe_founding_price_id, stripe_retail_price_id, is_preorder, active)
values
  ('sprouts_kit', 'Sprouts Complete Kit', 'kit', 34900, 24900, 500,
   'price_1Tc7TJ2NWfYbCZT83q4TuxFf', 'price_1To6KC2NWfYbCZT8AHRdC9Gv', true, true),
  ('sprouts_notebook', 'Student Notebook', 'notebook', 2499, 1999, null,
   'price_1TjktC2NWfYbCZT8voGtwnOg', 'price_1To6Hr2NWfYbCZT86GlPe9PK', true, true)
on conflict (sku) do update set
  name                     = excluded.name,
  product_type             = excluded.product_type,
  retail_price_cents       = excluded.retail_price_cents,
  founding_price_cents     = excluded.founding_price_cents,
  founding_qty_limit       = excluded.founding_qty_limit,
  stripe_founding_price_id = excluded.stripe_founding_price_id,
  stripe_retail_price_id   = excluded.stripe_retail_price_id,
  is_preorder              = excluded.is_preorder,
  active                   = excluded.active,
  updated_at               = now();
