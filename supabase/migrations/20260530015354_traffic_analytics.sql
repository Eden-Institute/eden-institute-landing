-- First-party, cookieless web-visit analytics.
--
-- Privacy: the raw IP is NEVER stored. We keep only a daily-rotating, salted
-- SHA-256 "visitor hash" — enough to approximate daily-unique counts, but not
-- cross-day trackable and not reversible without DB access. No cookies, no
-- localStorage, no PII. Aligns with the Cookie Policy's "aggregated and
-- anonymized" analytics language; needs no consent banner.
--
-- Write path: the public site calls record_page_view() with the anon key. The
-- function reads IP + user-agent from PostgREST request headers server-side,
-- hashes them, bot-filters, and inserts. No Edge Function, no verify_jwt knob.
-- Read path: founder_traffic() (gated by is_founder()) returns aggregates.
--
-- Applied to production via apply_migration MCP (version 20260530015354). File
-- committed for source-of-truth parity; re-run is a no-op.

create extension if not exists pgcrypto with schema extensions;

-- Private salt (singleton). Not readable by anon → keeps the visitor hash
-- non-reversible. Generated here so the secret never lives in the repo.
create table if not exists public.analytics_salt (
  id   smallint primary key default 1,
  salt text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  constraint analytics_salt_singleton check (id = 1)
);
alter table public.analytics_salt enable row level security;
insert into public.analytics_salt (id) values (1) on conflict (id) do nothing;

-- Cookieless page-view event log.
create table if not exists public.page_views (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),
  path          text not null,
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  visitor_hash  text,
  is_bot        boolean not null default false
);
alter table public.page_views enable row level security;
-- No anon/authenticated policies → only service_role / SECURITY DEFINER owner.

create index if not exists page_views_occurred_idx on public.page_views (occurred_at desc) where not is_bot;
create index if not exists page_views_path_idx     on public.page_views (path)              where not is_bot;

comment on table public.page_views is
  'Cookieless first-party page-view log. visitor_hash is a daily-rotating salted '
  'SHA-256 of IP+UA (raw IP never stored). No PII. Written by record_page_view().';


-- ── Public writer ──
create or replace function public.record_page_view(
  p_path         text,
  p_referrer     text default null,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_headers jsonb;
  v_ua text; v_ip text; v_salt text; v_day text; v_hash text; v_path text; v_ref text; v_bot boolean;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ua := coalesce(v_headers->>'user-agent', '');
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);

  -- sanitize path: drop query/hash, cap length
  v_path := left(split_part(split_part(coalesce(p_path,'/'),'?',1),'#',1), 300);
  if v_path = '' then v_path := '/'; end if;

  -- referrer → host only (no external URLs/paths retained)
  if coalesce(p_referrer,'') ~ '^https?://' then
    v_ref := left(regexp_replace(p_referrer, '^https?://([^/]+).*$', '\1'), 200);
  else
    v_ref := null;
  end if;

  v_bot := v_ua ~* '(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|lighthouse|preview|curl|wget|python-requests|axios|node-fetch|semrush|ahrefs|dataprovider)';

  v_day  := (now() at time zone 'America/Chicago')::date::text;
  select salt into v_salt from public.analytics_salt where id = 1;
  v_hash := left(encode(extensions.digest(v_ip || '|' || v_ua || '|' || coalesce(v_salt,'') || '|' || v_day, 'sha256'), 'hex'), 16);

  insert into public.page_views (path, referrer_host, utm_source, utm_medium, utm_campaign, visitor_hash, is_bot)
  values (v_path, v_ref, left(p_utm_source,100), left(p_utm_medium,100), left(p_utm_campaign,100), v_hash, coalesce(v_bot,false));
end;
$$;

revoke execute on function public.record_page_view(text,text,text,text,text) from public;
grant execute on function public.record_page_view(text,text,text,text,text) to anon, authenticated;

comment on function public.record_page_view(text,text,text,text,text) is
  'Public cookieless page-view writer (anon-callable). Derives a daily-rotating '
  'salted visitor hash from IP+UA server-side; raw IP is never stored.';


-- ── Founder-gated reader: one JSON payload for the dashboard ──
create or replace function public.founder_traffic(
  p_since timestamptz default (now() - interval '30 days')
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
    'totals', (
      select jsonb_build_object('views', count(*), 'visitors', count(distinct visitor_hash))
      from public.page_views where occurred_at >= p_since and not is_bot
    ),
    'daily', (
      select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb) from (
        select jsonb_build_object(
          'day', (occurred_at at time zone 'America/Chicago')::date,
          'views', count(*), 'visitors', count(distinct visitor_hash)) as d
        from public.page_views where occurred_at >= p_since and not is_bot
        group by (occurred_at at time zone 'America/Chicago')::date
      ) x
    ),
    'top_pages', (
      select coalesce(jsonb_agg(p order by (p->>'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('path', path, 'views', count(*), 'visitors', count(distinct visitor_hash)) as p
        from public.page_views where occurred_at >= p_since and not is_bot
        group by path order by count(*) desc limit 15
      ) x
    ),
    'sources', (
      select coalesce(jsonb_agg(s order by (s->>'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('referrer', coalesce(referrer_host,'(direct)'), 'views', count(*)) as s
        from public.page_views
        where occurred_at >= p_since and not is_bot
          and (referrer_host is null or referrer_host not ilike '%edeninstitute.health%')
        group by coalesce(referrer_host,'(direct)') order by count(*) desc limit 15
      ) x
    ),
    'campaigns', (
      select coalesce(jsonb_agg(c order by (c->>'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('campaign', cmp.utm_campaign, 'views', cmp.views, 'signups', coalesce(sg.signups,0)) as c
        from (
          select coalesce(utm_campaign,'(none)') as utm_campaign, count(*) as views
          from public.page_views where occurred_at >= p_since and not is_bot
          group by coalesce(utm_campaign,'(none)')
        ) cmp
        left join (
          select coalesce(utm_campaign,'(none)') as utm_campaign, count(*) as signups
          from public.waitlist_signups where entered_at >= p_since
          group by coalesce(utm_campaign,'(none)')
        ) sg on sg.utm_campaign = cmp.utm_campaign
        order by cmp.views desc limit 15
      ) x
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.founder_traffic(timestamptz) from public, anon;
grant execute on function public.founder_traffic(timestamptz) to authenticated;

comment on function public.founder_traffic(timestamptz) is
  'Founder-gated (is_founder) web-traffic aggregates for the /founder dashboard: '
  'totals, daily series, top pages, referrer sources, and UTM campaigns with '
  'visits->signup conversion. Bots excluded.';
