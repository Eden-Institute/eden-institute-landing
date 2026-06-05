-- founder_lead_summary: exact lead aggregates computed SERVER-SIDE.
--
-- Why this exists: the dashboard previously derived every headline number
-- (new-lead count, by-magnet breakdown, daily strip) by counting the rows
-- returned from founder_lead_feed. PostgREST caps an RPC response at the
-- project "Max rows" limit (1000), so once captures crossed 1000 the counts
-- froze at the cap — the dashboard read ~994 while the table truly held 1,088+.
--
-- Counting in the database has no row cap, so these numbers stay exact at any
-- scale. founder_lead_feed is left intact for the raw "All captures" feed
-- (which is legitimately a capped newest-N list). Same is_founder() gate.
--
-- Mirrors the server-aggregation pattern already used by founder_traffic.

create or replace function public.founder_lead_summary(
  p_since timestamptz default (now() - interval '90 days')
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total',  (select count(*) from public.waitlist_signups
                where entered_at >= p_since),
    'active', (select count(*) from public.waitlist_signups
                where entered_at >= p_since and unsubscribed_at is null),
    'unsub',  (select count(*) from public.waitlist_signups
                where entered_at >= p_since and unsubscribed_at is not null),
    'last_capture', (select max(entered_at) from public.waitlist_signups
                where entered_at >= p_since and unsubscribed_at is null),
    -- Grouped by raw (funnel, source); the client maps these to display
    -- labels (magnetLabel) and merges, keeping that mapping in one place.
    'by_magnet', (
      select coalesce(jsonb_agg(m order by (m->>'count')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'funnel', entry_funnel::text,
          'source', coalesce(source, '(unattributed)'),
          'count',  count(*),
          'last',   max(entered_at)
        ) as m
        from public.waitlist_signups
        where entered_at >= p_since and unsubscribed_at is null
        group by entry_funnel::text, coalesce(source, '(unattributed)')
      ) x
    ),
    -- Active signups per day in America/Chicago, for the recent-days strip.
    'daily', (
      select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'day',   (entered_at at time zone 'America/Chicago')::date,
          'count', count(*)
        ) as d
        from public.waitlist_signups
        where entered_at >= p_since and unsubscribed_at is null
        group by (entered_at at time zone 'America/Chicago')::date
      ) x
    )
  ) into result;

  return result;
end;
$$;

comment on function public.founder_lead_summary(timestamptz) is
  'Founder-gated, server-side lead aggregates (counts/by-magnet/daily). No PII, '
  'no row cap — fixes the 1000-row undercount on the /founder dashboard. '
  'SECURITY DEFINER; is_founder() is the sole access boundary.';

revoke execute on function public.founder_lead_summary(timestamptz) from public, anon;
grant execute on function public.founder_lead_summary(timestamptz) to authenticated;
