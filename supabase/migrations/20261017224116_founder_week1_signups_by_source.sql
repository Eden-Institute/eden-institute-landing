-- Founder dashboard: free Week 1 sign-ups by source, per ISO week and per calendar month.
--
-- WRITTEN FOR REVIEW, NOT APPLIED. Apply to production only with Camila's OK, BEFORE the
-- PR that ships the panel is merged (until then the Funnel tab panel shows the RPC error
-- and every other tab is unaffected). Idempotent: create or replace + named revokes/grants,
-- and the assertion block at the bottom aborts the whole transaction if a grant is wrong.
--
-- Why: the Instagram bio link is moving to a tagged Week 1 link (utm_campaign week1), and
-- nothing on the dashboard answers "how many Week 1 families came from Instagram this
-- week / this month". The Lead magnets tab counts by magnet, not by source.
--
-- Population: public.waitlist_signups rows with entry_funnel = 'edens_table' and
-- source in ('sprouts_magnet','seedlings_magnet'). waitlist_signups is unique on
-- (email, entry_funnel) and resend-waitlist's waitlistUpsert keeps the EXISTING row on
-- conflict, so this counts each family once, on the date and with the attribution of
-- their FIRST Week 1 sign-up. A family that later grabs the other band's Week 1 is not
-- counted again. Unsubscribed rows are counted: the sign-up still happened.
--
-- Excluded as test traffic:
--   * utm_source = 'claude_test' (audit rows)
--   * public.is_internal_tester(email): @edeninstitute.health, @example.com and the
--     internal_testers table. On 2026-10-17 that was 9 Week 1 rows in all, 6 of them the
--     claude_test rows and 3 untagged internal addresses.
--
-- Buckets are mutually exclusive and checked in this order (the tag always wins over the
-- referrer, so a tagged Instagram tap that also carries l.instagram.com counts once):
--   instagram_tagged    utm_source = 'instagram' (bio link, any tagged Instagram link)
--   facebook            utm_source = 'facebook'
--   other_tagged        any other non-empty utm_source
--   instagram_referrer  no utm_source, referrer host instagram.com or *.instagram.com
--                       (l.instagram.com is how untagged taps from the app arrive)
--   facebook            no utm_source, referrer host facebook.com or *.facebook.com
--                       (m., l., lm., www.)
--   untagged            everything else (no tag, no Instagram/Facebook referrer)
-- utm_source is compared lower-cased and trimmed.
--
-- History: sign-up attribution was first captured by PR #420 (2026-08-28). The first Week 1
-- row carrying a referrer or source_url is 2026-08-31 04:58 UTC, so every earlier row has no
-- tag and no referrer and lands in untagged. That is the truthful value, not a bug.
--
-- Weeks are ISO weeks (Monday start) and months are calendar months, both in
-- America/Chicago like the rest of /founder. Only buckets with at least one sign-up are
-- returned; the panel (src/lib/week1Sources.ts) fills the empty weeks and months.
--
-- Grants follow 20260915100000_audit_hardening.sql section 5: Supabase grants EXECUTE on
-- every NEW public function explicitly to anon, so revoke from public AND anon by name,
-- then grant authenticated (the dashboard) and service_role.

begin;

create or replace function public.founder_week1_signups_by_source(p_since timestamptz)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result json;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with w1 as (
    select
      w.created_at,
      nullif(lower(btrim(w.utm_source)), '') as tag,
      lower(substring(w.referrer from '^[A-Za-z][A-Za-z0-9+.-]*://([^/:?#]+)')) as ref_host
    from public.waitlist_signups w
    where w.entry_funnel = 'edens_table'
      and w.source in ('sprouts_magnet', 'seedlings_magnet')
      and w.created_at >= p_since
      and coalesce(nullif(lower(btrim(w.utm_source)), ''), '') <> 'claude_test'
      and not public.is_internal_tester(w.email)
  ),
  classified as (
    select
      date_trunc('week',  w1.created_at at time zone 'America/Chicago')::date as week_start,
      date_trunc('month', w1.created_at at time zone 'America/Chicago')::date as month_start,
      case
        when w1.tag = 'instagram' then 'instagram_tagged'
        when w1.tag = 'facebook'  then 'facebook'
        when w1.tag is not null   then 'other_tagged'
        when w1.ref_host = 'instagram.com' or w1.ref_host like '%.instagram.com' then 'instagram_referrer'
        when w1.ref_host = 'facebook.com'  or w1.ref_host like '%.facebook.com'  then 'facebook'
        else 'untagged'
      end as bucket
    from w1
  )
  select json_build_object(
    'by_week', coalesce((
      select json_agg(json_build_object(
        'week_start',         x.week_start,
        'total',              x.total,
        'instagram_tagged',   x.instagram_tagged,
        'instagram_referrer', x.instagram_referrer,
        'facebook',           x.facebook,
        'other_tagged',       x.other_tagged,
        'untagged',           x.untagged
      ) order by x.week_start)
      from (
        select c.week_start,
          count(*)::int                                                  as total,
          (count(*) filter (where c.bucket = 'instagram_tagged'))::int   as instagram_tagged,
          (count(*) filter (where c.bucket = 'instagram_referrer'))::int as instagram_referrer,
          (count(*) filter (where c.bucket = 'facebook'))::int           as facebook,
          (count(*) filter (where c.bucket = 'other_tagged'))::int       as other_tagged,
          (count(*) filter (where c.bucket = 'untagged'))::int           as untagged
        from classified c
        group by c.week_start
      ) x
    ), '[]'::json),
    'by_month', coalesce((
      select json_agg(json_build_object(
        'month_start',        x.month_start,
        'total',              x.total,
        'instagram_tagged',   x.instagram_tagged,
        'instagram_referrer', x.instagram_referrer,
        'facebook',           x.facebook,
        'other_tagged',       x.other_tagged,
        'untagged',           x.untagged
      ) order by x.month_start)
      from (
        select c.month_start,
          count(*)::int                                                  as total,
          (count(*) filter (where c.bucket = 'instagram_tagged'))::int   as instagram_tagged,
          (count(*) filter (where c.bucket = 'instagram_referrer'))::int as instagram_referrer,
          (count(*) filter (where c.bucket = 'facebook'))::int           as facebook,
          (count(*) filter (where c.bucket = 'other_tagged'))::int       as other_tagged,
          (count(*) filter (where c.bucket = 'untagged'))::int           as untagged
        from classified c
        group by c.month_start
      ) x
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;

comment on function public.founder_week1_signups_by_source(timestamptz) is
  'Founder dashboard (Funnel tab): free Week 1 sign-ups (edens_table sprouts/seedlings magnets) since p_since, per ISO week and calendar month in America/Chicago, split into mutually exclusive source buckets (instagram_tagged, instagram_referrer, facebook, other_tagged, untagged). Test rows excluded. is_founder() gated.';

revoke all on function public.founder_week1_signups_by_source(timestamp with time zone) from public, anon;
grant execute on function public.founder_week1_signups_by_source(timestamp with time zone) to authenticated, service_role;

-- Assertions: fail the migration rather than report success with a grant open ---------------
do $$
declare
  fn  constant text := 'public.founder_week1_signups_by_source(timestamp with time zone)';
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
    raise exception 'founder_week1_signups_by_source: checks failed: %', array_to_string(bad, ', ');
  end if;
end $$;

commit;
