-- Seedlings Starter Unit: make the starter tables band-aware (2026-09-23).
--
-- Founder decision 2026-09-23: a second $39 Starter Unit, for Seedlings (grades
-- 3-5), same shape as Sprouts. The purchase, credit and delivery rails are shared,
-- so each row now records WHICH band it belongs to. The band decides the master
-- PDFs that get stamped, the filenames, the delivery email and the receipt.
--
-- EXISTING ROWS ARE ALL SPROUTS, because Sprouts was the only Starter Unit. The
-- column default 'sprouts' backfills them in place (Postgres 11+ applies a constant
-- default without rewriting the table), and code reading a row with no band also
-- treats it as Sprouts (normalizeStarterBand in _shared/starter-config.ts).
--
-- ORDER OF OPERATIONS. The Sprouts code path does not name this column on insert
-- or select, so Sprouts keeps working whether this runs before or after the
-- function deploy. The Seedlings path DOES write it, so this migration must be
-- applied before the first Seedlings sale; without it that insert fails loudly.
--
-- Idempotent: every statement is guarded and can be re-run.

-- ---------------------------------------------------------------------------
-- starter_credits.band
-- ---------------------------------------------------------------------------
alter table public.starter_credits
  add column if not exists band text not null default 'sprouts';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'starter_credits_band_check'
      and conrelid = 'public.starter_credits'::regclass
  ) then
    alter table public.starter_credits
      add constraint starter_credits_band_check check (band in ('sprouts', 'seedlings'));
  end if;
end $$;

comment on column public.starter_credits.band is
  'Which band''s Starter Unit minted this credit: sprouts or seedlings. The credit applies only to '
  'that band''s printed year (the Stripe coupon is scoped to that product).';

-- ---------------------------------------------------------------------------
-- starter_deliveries.band
-- ---------------------------------------------------------------------------
alter table public.starter_deliveries
  add column if not exists band text not null default 'sprouts';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'starter_deliveries_band_check'
      and conrelid = 'public.starter_deliveries'::regclass
  ) then
    alter table public.starter_deliveries
      add constraint starter_deliveries_band_check check (band in ('sprouts', 'seedlings'));
  end if;
end $$;

comment on column public.starter_deliveries.band is
  'Which band''s Starter Unit this delivery is: sprouts or seedlings. Picks the master PDFs, the '
  'delivered filenames, the email copy and the receipt line.';

-- ---------------------------------------------------------------------------
-- Reporting, per band
-- ---------------------------------------------------------------------------
-- The original report counted every credit but only Sprouts sales. With a second
-- band that would mix Seedlings credits into the Sprouts conversion rate. So the
-- body moves into a per-band function, and the original name keeps its exact
-- signature and meaning by calling it for Sprouts.
create or replace function public.starter_conversion_report_by_band(p_band text)
returns table (
  units_sold bigint,
  codes_issued bigint,
  codes_redeemed bigint,
  codes_outstanding bigint,
  redemption_rate numeric,
  median_days_to_redeem numeric,
  gross_starter_cents bigint,
  attributed_kit_cents bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with k as (
    select case p_band
      when 'sprouts' then 'sprouts_starter_unit'
      when 'seedlings' then 'seedlings_starter_unit'
    end as lookup_key
  ),
  credits as (
    select
      c.issued_at,
      c.redeemed_at,
      c.amount_cents,
      o.amount_total_cents as kit_cents
    from starter_credits c
    left join orders o on o.id = c.redeemed_order_id
    where c.deactivated_at is null
      and c.band = p_band
  )
  select
    (select count(*) from orders, k where orders.lookup_key = k.lookup_key
       and status not in ('cancelled', 'refunded'))                          as units_sold,
    count(*)                                                                  as codes_issued,
    count(*) filter (where redeemed_at is not null)                           as codes_redeemed,
    count(*) filter (where redeemed_at is null)                               as codes_outstanding,
    round(
      100.0 * count(*) filter (where redeemed_at is not null)
      / nullif(count(*), 0), 2)                                               as redemption_rate,
    percentile_cont(0.5) within group (
      order by extract(epoch from (redeemed_at - issued_at)) / 86400.0
    ) filter (where redeemed_at is not null)                                  as median_days_to_redeem,
    (select coalesce(sum(amount_total_cents), 0) from orders, k
       where orders.lookup_key = k.lookup_key
         and status not in ('cancelled', 'refunded'))                         as gross_starter_cents,
    coalesce(sum(kit_cents) filter (where redeemed_at is not null), 0)::bigint as attributed_kit_cents
  from credits;
$function$;

comment on function public.starter_conversion_report_by_band(text) is
  'Starter Unit funnel for one band (sprouts or seedlings): units sold, credits issued/redeemed/'
  'outstanding, redemption rate, median days from starter purchase to print purchase, revenue.';

create or replace function public.starter_conversion_report()
returns table (
  units_sold bigint,
  codes_issued bigint,
  codes_redeemed bigint,
  codes_outstanding bigint,
  redemption_rate numeric,
  median_days_to_redeem numeric,
  gross_starter_cents bigint,
  attributed_kit_cents bigint
)
language sql
stable
set search_path to 'public'
as $function$
  select * from public.starter_conversion_report_by_band('sprouts');
$function$;

comment on function public.starter_conversion_report() is
  'Sprouts Starter Unit funnel (unchanged meaning since 2026-08-26). For Seedlings use '
  'starter_conversion_report_by_band(''seedlings'').';
