-- founder_revenue: a refunded guide sale must stop counting as a sale.
--
-- Found by the 2026-07-20 dark test. PR #321 made refunds their own row in
-- public.payments rather than mutating the original, which is right: the ledger should
-- record what happened, not overwrite it. But the guide block here sums
-- `status = 'paid'` and the ORIGINAL row keeps that status forever, while the refund row
-- (status = 'refunded') is filtered out. Net effect: a refund never reduces the figure.
-- Revenue, transaction count, and distinct buyers all stay permanently inflated.
--
-- Scope is narrower than it first looks, and worth stating so nobody widens it by
-- mistake. This block is filtered to lookup_key = 'deep_dive_guide'. **Preorder revenue
-- is NOT affected**: founder_orders computes gross_cents off public.orders with
-- `status not in ('cancelled','refunded')`, which already excludes refunds correctly.
-- So this fixes the $4.99 guide line, not the $249 kit line.
--
-- Matching: refund rows carry both lookup_key and stripe_payment_intent_id, verified
-- against live data, so a refund is tied to its original by payment intent.
--
-- Partial refunds are handled deliberately differently per figure:
--   revenue_cents   nets by AMOUNT, so a partial refund reduces revenue by exactly what
--                   was returned.
--   sales_total     counts a partially refunded purchase as STILL A SALE, because it is.
--   purchased_total same, a partially refunded buyer is still a buyer.
-- Only a purchase with some refund against it is excluded from the two counts, which is
-- the pragmatic reading: full refunds are the common case and partial refunds on a $4.99
-- guide are near-hypothetical.
--
-- `create or replace` only, no data touched, so this is a no-op on re-run and `db push`
-- stays clean. Every other block in the function is byte-identical to the version
-- installed by 20260720040000_founder_rpc_hardening.sql.

create or replace function public.founder_revenue(p_since timestamp with time zone)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  result json;
begin
  if not public.is_founder() then
    raise exception 'Not authorized';
  end if;

  select json_build_object(
    'subscriptions', json_build_object(
      'active_seed', (select count(*) from public.profiles
                       where subscription_status = 'active' and subscription_tier = 'seed'
                         and not public.is_internal_email(email)),
      'active_root', (select count(*) from public.profiles
                       where subscription_status = 'active' and subscription_tier = 'root'
                         and not public.is_internal_email(email)),
      'active_practitioner', (select count(*) from public.profiles
                       where subscription_status = 'active' and subscription_tier = 'practitioner'
                         and not public.is_internal_email(email)),
      'active_total', (select count(*) from public.profiles
                       where subscription_status = 'active'
                         and subscription_tier in ('seed','root','practitioner')
                         and not public.is_internal_email(email)),
      'canceled', (select count(*) from public.profiles
                       where subscription_status = 'canceled'
                         and not public.is_internal_email(email))
    ),
    'guide', json_build_object(
      -- Distinct people, so the existing "Guide buyers" label stays true.
      -- A buyer whose only purchase was refunded is no longer a buyer.
      'purchased_total', (select count(distinct p.customer_email) from public.payments p
                           where p.lookup_key = 'deep_dive_guide'
                             and p.status = 'paid' and not p.is_internal
                             and not exists (
                               select 1 from public.payments r
                               where r.status = 'refunded'
                                 and r.stripe_payment_intent_id is not null
                                 and r.stripe_payment_intent_id = p.stripe_payment_intent_id
                             )),
      -- Transactions. A repeat buyer now shows up here, which is the whole point.
      -- A refunded transaction does not.
      'sales_total',     (select count(*) from public.payments p
                           where p.lookup_key = 'deep_dive_guide'
                             and p.status = 'paid' and not p.is_internal
                             and not exists (
                               select 1 from public.payments r
                               where r.status = 'refunded'
                                 and r.stripe_payment_intent_id is not null
                                 and r.stripe_payment_intent_id = p.stripe_payment_intent_id
                             )),
      -- Net of refunds, by amount, so partial refunds are reflected exactly.
      'revenue_cents',   (
        (select coalesce(sum(amount_cents), 0) from public.payments
          where lookup_key = 'deep_dive_guide'
            and status = 'paid' and not is_internal)
        -
        (select coalesce(sum(amount_cents), 0) from public.payments
          where lookup_key = 'deep_dive_guide'
            and status = 'refunded' and not is_internal)
      )
    ),
    'course', json_build_object(
      'orders', (select count(*) from public.course_sales where occurred_at >= p_since),
      'revenue_cents', coalesce((select sum(amount_cents) from public.course_sales where occurred_at >= p_since), 0),
      'currency', coalesce((select currency from public.course_sales order by occurred_at desc limit 1), 'usd')
    )
  ) into result;

  return result;
end;
$function$;
