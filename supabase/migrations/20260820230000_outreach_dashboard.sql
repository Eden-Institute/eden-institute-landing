-- Outreach dashboard: influencer + podcast pipeline on /founder
-- 2026-08-20. Mirrors the Google Sheet "Eden's Table - Influencer Outreach Tracker".
-- The SHEET remains the source of truth for editing; these tables are a read mirror,
-- refreshed by scripts/sync_outreach.py at every wrap.
--
-- Security follows the existing founder pattern exactly:
--   RLS on, NO policies (service-role writes only), reads exclusively via
--   SECURITY DEFINER RPCs guarded by public.is_founder().
-- These rows are the names, handles, follower counts and contact history of ~160 real
-- people who never consented to appear anywhere. anon must never reach them.

-- ---------------------------------------------------------------- influencers
create table if not exists public.outreach_influencers (
  handle              text primary key,
  display_name        text,
  profile_url         text,
  followers           integer,
  status              text,
  disqualify_reason   text,
  touches             integer not null default 0,
  last_contacted      date,
  next_touch_no       text,
  next_touch_due      date,
  converted           boolean not null default false,
  outcome             text,
  outcome_date        date,
  date_sourced        date,
  synced_at           timestamptz not null default now()
);
comment on table public.outreach_influencers is
  'Read mirror of the Prospects tab. Edit the SHEET, not this table; sync_outreach.py overwrites it.';

alter table public.outreach_influencers enable row level security;
-- no policies on purpose: service role writes, RPC reads

-- ------------------------------------------------------------------- podcasts
create table if not exists public.outreach_podcasts (
  show                text primary key,
  host                text,
  email               text,
  sub_niche           text,
  takes_guests        text,
  episodes            integer,      -- activity proxy, NOT reach. Reach was never captured.
  last_episode        date,         -- ditto
  status              text,
  touches             integer not null default 0,
  first_pitch         date,
  last_touch          date,
  recording_date      text,         -- free text on purpose: carries timezones e.g. '1:00pm CENTRAL'
  next_action         text,
  next_action_due     date,
  synced_at           timestamptz not null default now()
);
comment on column public.outreach_podcasts.episodes is
  'Episode count from the iTunes search API. This is an ACTIVITY proxy and must never be '
  'presented as audience reach. Listener and download numbers are private to the host and '
  'have never been captured for any show on this tab.';

alter table public.outreach_podcasts enable row level security;

-- ----------------------------------------------------------------------- RPCs
create or replace function public.founder_outreach_influencers()
returns setof public.outreach_influencers
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
    select * from public.outreach_influencers
    -- active pipeline first, then most recently contacted
    order by
      case
        when status = 'Responded' then 0
        when status like 'Queued%' then 1
        when status = 'Sent' then 2
        when status = 'Declined' then 3
        else 4
      end,
      last_contacted desc nulls last,
      followers desc nulls last;
end;
$$;

create or replace function public.founder_outreach_podcasts()
returns setof public.outreach_podcasts
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
    select * from public.outreach_podcasts
    order by
      case
        when status like 'BOOKED%' then 0
        when status like 'RECORDED%' then 1
        when status like 'RESPONDED%' then 2
        when status like 'PAID%' then 3
        when status like 'AWAITING%' then 4
        when status = 'NOT CONTACTED' then 6
        else 5
      end,
      next_action_due asc nulls last,
      last_touch desc nulls last;
end;
$$;

revoke execute on function public.founder_outreach_influencers() from public, anon;
revoke execute on function public.founder_outreach_podcasts()    from public, anon;
grant  execute on function public.founder_outreach_influencers() to authenticated;
grant  execute on function public.founder_outreach_podcasts()    to authenticated;

-- --------------------------------------------- FIX: partner cadence was invisible
-- 20260817140000 added last_touch_at + follow_ups to founding_partners to encode the
-- +28 / +21 / +21 cadence, but founder_partner_engagement() was never updated to select
-- them. Result: nothing in the UI could show which partners are DUE. Same failure class
-- as the two scheduled tasks that ran green for three weeks against a deleted roster.
create or replace function public.founder_partner_due()
returns table (
  name           text,
  email          text,
  handle         text,
  welcome_sent_at timestamptz,
  last_touch_at  timestamptz,
  follow_ups     integer,
  next_due       date,
  days_overdue   integer
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
  select p.name, p.email, p.handle, p.welcome_sent_at, p.last_touch_at, p.follow_ups,
         d.next_due,
         greatest(0, (current_date - d.next_due))::integer as days_overdue
  from public.founding_partners p
  cross join lateral (
    select (coalesce(p.last_touch_at, p.welcome_sent_at)
            + case p.follow_ups
                when 0 then interval '28 days'   -- welcome -> +28
                when 1 then interval '21 days'   -- -> +21
                when 2 then interval '21 days'   -- -> +21
                else null                        -- sequence spent, rests
              end)::date as next_due
  ) d
  where d.next_due is not null
    and coalesce(p.welcome_sent_at, p.last_touch_at) is not null
  order by d.next_due asc;
end;
$$;

revoke execute on function public.founder_partner_due() from public, anon;
grant  execute on function public.founder_partner_due() to authenticated;
