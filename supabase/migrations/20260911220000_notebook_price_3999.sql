-- Extra Student Notebook, printed: price raised from $29.99 to $39.99
-- (founder decision 2026-09-11).
--
-- Why: $29.99 did not cover the cost. Lulu's cost calculator, run against the
-- production account on 2026-09-11 for one notebook shipped MAIL to Clarksville:
--   print (224pp coil, 0850X1100.FC.STD.CO.080CW444.GXX)  $21.17
--   shipping MAIL                                          $5.69
--   Lulu fulfillment fee                                    $0.75
--   subtotal                                              $27.61
--   sales tax Lulu charges                                 $2.62
--   total                                                 $30.23
-- Against $29.99 collected, that is a loss before Stripe's fee of roughly
-- $1.17 on the transaction. At $39.99 the unit clears about $8.60.
--
-- stripe_retail_price_id is the LIVE Price created in the Stripe Dashboard on
-- 2026-09-11 (product prod_VF6XcSOc0qCfid, $39.99 USD one-off, tax behaviour
-- "Default (inferred by currency)", matching the price it replaces). The id was
-- read back off the price page before being written here.
--
-- The set (sprouts_print_set) is NOT repriced: $59.45 excl tax against $261
-- collected. Idempotent; touches one row.

update public.products
set retail_price_cents     = 3999,
    founding_price_cents   = 3999,
    stripe_retail_price_id = 'price_1UEem82NWfYbCZT8NzKHlfBG',
    updated_at             = now()
where sku = 'sprouts_nb_print';
