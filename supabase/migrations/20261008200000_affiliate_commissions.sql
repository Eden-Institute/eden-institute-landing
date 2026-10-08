-- Affiliate commissions on /founder → Partners tab: what each code has earned, what is
-- payable, what has been paid, and what is still owed.
-- 2026-10-08. Terms are the founder's 2026-10-05 decision (Laws L-30):
--   * commission = rate × goods paid (amount_total minus tax minus shipping, so the
--     buyer's 10% discount is already out), every store product
--   * payable 30 days after shipping; digital orders (no shipment) start at purchase
--   * refunded or cancelled orders earn nothing
--   * paid monthly, by hand. Stripe knows nothing about commission.
-- Same arithmetic as scripts/affiliate_payouts.py (the Commissions tab), kept in step.
--
-- affiliate_codes is a READ MIRROR of the Outreach Bible "Affiliates" tab, refreshed by
-- scripts/sync_affiliate_codes.py. Edit the SHEET, not this table.
-- affiliate_payouts is written from the dashboard ("Mark paid") and is the ledger of record.
--
-- Security follows the existing founder pattern: RLS on, NO policies, reads and writes only
-- through SECURITY DEFINER RPCs guarded by public.is_founder().

create table if not exists public.affiliate_codes (
  promo_code_id    text primary key,          -- Stripe promo id, what orders.raw carries
  code             text not null,
  partner          text not null,
  commission_rate  numeric(5,4) not null default 0.10 check (commission_rate between 0 and 1),
  status           text,
  minted_on        date,
  synced_at        timestamptz not null default now()
);
comment on table public.affiliate_codes is
  'Read mirror of the Affiliates tab. Edit the SHEET; sync_affiliate_codes.py overwrites it. '
  'commission_rate 0 = waived by the partner (e.g. ONTHECOVE).';
alter table public.affiliate_codes enable row level security;

create table if not exists public.affiliate_payouts (
  id             uuid primary key default gen_random_uuid(),
  promo_code_id  text not null references public.affiliate_codes(promo_code_id),
  amount_cents   integer not null check (amount_cents > 0),
  paid_on        date not null default current_date,
  note           text,
  created_at     timestamptz not null default now()
);
comment on table public.affiliate_payouts is
  'Commission paid out by hand, recorded from the founder dashboard. One row per payment.';
alter table public.affiliate_payouts enable row level security;
create index if not exists affiliate_payouts_code_idx on public.affiliate_payouts (promo_code_id);

-- ---------------------------------------------------------------- per-code totals
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
      greatest(0, coalesce(ord.amount_total_cents, 0)
                  - coalesce((ord.raw->'total_details'->>'amount_tax')::int, ord.tax_cents, 0)
                  - coalesce((ord.raw->'total_details'->>'amount_shipping')::int, 0)) as goods,
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

-- ---------------------------------------------------------------- record a payout
create or replace function public.founder_record_affiliate_payout(
  p_promo_code_id text, p_amount_cents integer, p_note text default null
) returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be more than zero';
  end if;
  insert into public.affiliate_payouts (promo_code_id, amount_cents, note)
  values (p_promo_code_id, p_amount_cents, nullif(trim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.founder_affiliate_commissions() from public, anon;
revoke all on function public.founder_record_affiliate_payout(text, integer, text) from public, anon;
grant execute on function public.founder_affiliate_commissions() to authenticated;
grant execute on function public.founder_record_affiliate_payout(text, integer, text) to authenticated;
