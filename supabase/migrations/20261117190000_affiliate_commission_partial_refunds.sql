-- 2026-11-17, Lane 2 deep audit area 9, finding C2 (founder tap "Yes, build + ship").
-- founder_affiliate_commissions(): a partly refunded order used to earn the full 10%, because a partial refund
-- leaves orders.status unchanged and the function voided only 'refunded'/'cancelled'. Now each order's goods are
-- reduced by the refunded share (refund rows in payments, matched by payment intent), pro rata, so a refund of
-- shipping alone trims the commission by its share instead of wiping it. Full refunds are unchanged (void).
-- Body = 20261008200000 (identical to the live definition, checked 2026-11-17) plus the two marked NEW pieces.
-- Same grants as before: authenticated may execute, guarded by is_founder() inside; anon and public revoked.

create or replace function public.founder_affiliate_commissions()
returns table (
  promo_code_id   text,
  code            text,
  partner         text,
  commission_rate numeric,
  orders          integer,
  goods_cents     bigint,
  earned_cents    bigint,   -- every non-void order, whether or not payable yet
  holding_cents   bigint,   -- shipped/bought, inside the 30-day hold
  waiting_cents   bigint,   -- physical order not shipped yet
  payable_cents   bigint,   -- past the hold
  paid_cents      bigint,
  owed_cents      bigint,   -- payable minus paid
  last_order_at   timestamptz,
  last_paid_on    date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  with o as (
    select
      a.promo_code_id,
      ord.created_at,
      -- NEW 2026-11-17 (area 9 C2): a PARTIAL refund leaves the order's status alone
      -- (stripe-webhook charge.refunded), so its share comes off here: goods x (paid - refunded) / paid,
      -- refunds read from payments rows with status 'refunded' on the same payment intent. A full
      -- refund is still caught by status 'refunded' below (void).
      round(
        greatest(0, coalesce(ord.amount_total_cents, 0)
                    - coalesce((ord.raw->'total_details'->>'amount_tax')::int, ord.tax_cents, 0)
                    - coalesce((ord.raw->'total_details'->>'amount_shipping')::int, 0))
        * case when coalesce(ord.amount_total_cents, 0) > 0
               then greatest(0, ord.amount_total_cents - coalesce(rf.refunded_cents, 0))::numeric / ord.amount_total_cents
               else 1 end
      )::bigint as goods,
      ord.status::text in ('refunded', 'cancelled') as void,
      case
        when ord.fulfillment = 'lulu'
          or coalesce((ord.raw->'total_details'->>'amount_shipping')::int, 0) > 0
          then coalesce(ord.shipped_at, ord.delivered_at)
        else ord.created_at
      end as clock
    from public.orders ord
    join public.affiliate_codes a
      on a.promo_code_id = ord.raw->'discounts'->0->>'promotion_code'
    -- NEW 2026-11-17 (area 9 C2): what was refunded on this order so far.
    left join lateral (
      select sum(p.amount_cents)::bigint as refunded_cents
      from public.payments p
      where p.status = 'refunded'
        and ord.stripe_payment_intent_id is not null
        and p.stripe_payment_intent_id = ord.stripe_payment_intent_id
    ) rf on true
  ),
  c as (
    select o.*, case when o.void then 0
                     else round(o.goods * a.commission_rate)::bigint end as comm
    from o join public.affiliate_codes a using (promo_code_id)
  ),
  agg as (
    select
      c.promo_code_id,
      count(*) filter (where not c.void)::int                                    as orders,
      coalesce(sum(c.goods) filter (where not c.void), 0)::bigint                as goods_cents,
      coalesce(sum(c.comm), 0)::bigint                                           as earned_cents,
      coalesce(sum(c.comm) filter (where c.clock is not null
                                     and c.clock + interval '30 days' > now()), 0)::bigint  as holding_cents,
      coalesce(sum(c.comm) filter (where c.clock is null), 0)::bigint            as waiting_cents,
      coalesce(sum(c.comm) filter (where c.clock is not null
                                     and c.clock + interval '30 days' <= now()), 0)::bigint as payable_cents,
      max(c.created_at)                                                          as last_order_at
    from c group by c.promo_code_id
  ),
  paid as (
    select p.promo_code_id, sum(p.amount_cents)::bigint as paid_cents, max(p.paid_on) as last_paid_on
    from public.affiliate_payouts p group by p.promo_code_id
  )
  select a.promo_code_id, a.code, a.partner, a.commission_rate,
         coalesce(agg.orders, 0), coalesce(agg.goods_cents, 0), coalesce(agg.earned_cents, 0),
         coalesce(agg.holding_cents, 0), coalesce(agg.waiting_cents, 0), coalesce(agg.payable_cents, 0),
         coalesce(paid.paid_cents, 0),
         coalesce(agg.payable_cents, 0) - coalesce(paid.paid_cents, 0),
         agg.last_order_at, paid.last_paid_on
  from public.affiliate_codes a
  left join agg using (promo_code_id)
  left join paid using (promo_code_id)
  order by (coalesce(agg.payable_cents, 0) - coalesce(paid.paid_cents, 0)) desc,
           coalesce(agg.earned_cents, 0) desc, coalesce(agg.orders, 0) desc, a.code;
end;
$$;

revoke all on function public.founder_affiliate_commissions() from public, anon;
grant execute on function public.founder_affiliate_commissions() to authenticated;
