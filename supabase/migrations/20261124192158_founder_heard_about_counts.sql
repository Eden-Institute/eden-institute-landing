-- Founder dashboard: "How did you hear about us?" answers, counted.
--
-- The question went live on 2026-11-24 (migration 20261124185416_heard_about.sql, PR #841; Gina / UHPN's ask,
-- Camila's taps "Yes, add it", "Use these", "Yes, ship it"). Her tap on the dashboard count was "later"; this is it.
-- Read-only: one SECURITY DEFINER function, is_founder()-gated, no table changes. APPLIED 2026-11-24 13:21 CT on her tap "Yes, ship it" (recorded version 20261124192158).
--
-- Two populations, counted separately (a family can answer in both places):
--   signups  public.waitlist_signups, free-week rows only (entry_funnel 'edens_table', source sprouts_magnet or
--            seedlings_magnet: the only form that asks, src/components/landing/WaitlistModal.tsx isFreeWeek).
--            A returning family's answer is written onto its ORIGINAL row (resend-waitlist fills heard_about only
--            if empty), so answers are counted on every row whatever its created_at. "Skipped" counts only rows
--            created since the question went live, because older rows were never asked.
--   orders   public.orders with payment_status 'paid' (every checkout carries the optional Stripe dropdown;
--            stripe-webhook stamps it after the sale). Same rule: answers on any row, skipped since launch.
-- Test traffic is left out the same way as founder_week1_signups_by_source: utm_source 'claude_test' and
-- public.is_internal_tester(email).
--
-- Launch instant = the heard_about migration's recorded version, 2026-11-24 18:54:16 UTC.
-- Every answer value is returned, zeros included, so the panel never has to guess the list. The values are
-- supabase/functions/_shared/heard-about.ts HEARD_ABOUT_OPTIONS (src/test/heardAbout.test.ts keeps them equal to
-- the CHECK constraints; src/test/heardAboutCounts.test.ts keeps this function's list equal to them too).
--
-- Grants follow 20260915100000_audit_hardening.sql section 5: revoke from public AND anon by name, then grant
-- authenticated (the dashboard) and service_role. The assertion block aborts the transaction if a grant is wrong.

begin;

create or replace function public.founder_heard_about_counts()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  launched constant timestamptz := '2026-11-24 18:54:16+00';
  vals constant text[] := array[
    'talesandtabletalk', 'uhpn', 'anotherpodcast', 'facebook', 'instagram', 'pinterest', 'search', 'friendfamily', 'other'
  ];
  result json;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with s as (
    select w.heard_about, w.created_at
    from public.waitlist_signups w
    where w.entry_funnel = 'edens_table'
      and w.source in ('sprouts_magnet', 'seedlings_magnet')
      and coalesce(nullif(lower(btrim(w.utm_source)), ''), '') <> 'claude_test'
      and not public.is_internal_tester(w.email)
  ),
  o as (
    select x.heard_about, x.created_at
    from public.orders x
    where x.payment_status = 'paid'
      and coalesce(nullif(lower(btrim(x.attr_utm_source)), ''), '') <> 'claude_test'
      and not public.is_internal_tester(x.customer_email)
  )
  select json_build_object(
    'launched_at', launched,
    'by_answer', (
      select json_agg(json_build_object(
        'value',   v.val,
        'signups', (select count(*) from s where s.heard_about = v.val)::int,
        'orders',  (select count(*) from o where o.heard_about = v.val)::int
      ) order by v.ord)
      from unnest(vals) with ordinality as v(val, ord)
    ),
    'signups', json_build_object(
      'answered', (select count(*) from s where s.heard_about is not null)::int,
      'skipped',  (select count(*) from s where s.heard_about is null and s.created_at >= launched)::int
    ),
    'orders', json_build_object(
      'answered', (select count(*) from o where o.heard_about is not null)::int,
      'skipped',  (select count(*) from o where o.heard_about is null and o.created_at >= launched)::int
    )
  ) into result;

  return result;
end;
$$;

comment on function public.founder_heard_about_counts() is
  'Founder dashboard (Funnel tab): "How did you hear about us?" answers per choice on free-week sign-ups and paid orders, plus answered / skipped-since-launch totals. Test rows excluded. is_founder() gated. Read-only.';

revoke all on function public.founder_heard_about_counts() from public, anon;
grant execute on function public.founder_heard_about_counts() to authenticated, service_role;

-- Assertions: fail the migration rather than report success with a grant open ---------------
do $$
declare
  fn  constant text := 'public.founder_heard_about_counts()';
  bad text[] := '{}';
begin
  if has_function_privilege('anon', fn, 'EXECUTE') then
    bad := bad || 'anon holds EXECUTE'::text;
  end if;
  if not has_function_privilege('authenticated', fn, 'EXECUTE') then
    bad := bad || 'authenticated lacks EXECUTE'::text;
  end if;
  if not has_function_privilege('service_role', fn, 'EXECUTE') then
    bad := bad || 'service_role lacks EXECUTE'::text;
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = fn::regprocedure) then
    bad := bad || 'not SECURITY DEFINER'::text;
  end if;
  if not exists (
    select 1 from pg_proc p, unnest(coalesce(p.proconfig, '{}'::text[])) c
     where p.oid = fn::regprocedure and c like 'search_path=%pg\_temp%'
  ) then
    bad := bad || 'search_path lacks pg_temp'::text;
  end if;

  if array_length(bad, 1) is not null then
    raise exception 'founder_heard_about_counts: checks failed: %', array_to_string(bad, ', ');
  end if;
end $$;

commit;
