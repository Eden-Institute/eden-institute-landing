-- ============================================================================
-- CRO Phase 4 (approved redesign plan §14): funnel metrics instrumentation.
--
-- Every conversion CTA shipped across CRO Phases 0-3 carries a passive
-- data-cta attribute; nothing records clicks, so none of those changes is
-- measurable. This migration adds the write/read pair, modeled
-- byte-for-byte on the record_page_view rails (20260530015354):
--
--   1. public.cta_events — cookieless first-party click events. Same
--      privacy posture as page_views: raw IP/UA are read from PostgREST
--      request headers server-side and NEVER stored; only a 16-hex
--      daily-rotating salted SHA-256 visitor hash (public.analytics_salt)
--      lands in the table. No cookies, no localStorage, no PII, no
--      auth.uid(). Needs no consent banner.
--
--   2. public.record_cta_click() — SECURITY DEFINER writer, granted to
--      anon + authenticated, called fire-and-forget with the anon key
--      from (a) a document-level capture-phase [data-cta] click listener
--      in the SPA + the Astro SiteAnalytics island (sendBeacon, so page
--      unloads don't eat marketing-side clicks), and (b) explicit
--      funnel-moment calls: cta='quiz-start' (first answer, marketing
--      quiz only) and cta='checkout-start' (every create-checkout invoke
--      site, carrying p_lookup_key — the post-signup auto-resume has no
--      click to delegate).
--
--   3. public.founder_funnel() — is_founder()-gated jsonb aggregate
--      reader (founder_lead_summary/founder_traffic pattern). Everything
--      is counted server-side: cta_events will pass the 1000-row
--      PostgREST cap quickly, and /founder counts must never be derived
--      from a capped row feed.
--
-- Idempotent. Applied to production via Supabase SQL Editor.
-- ============================================================================

-- ── 1. Events table ─────────────────────────────────────────────────────────

create table if not exists public.cta_events (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  cta          text not null,
  path         text not null,
  lookup_key   text,
  visitor_hash text,
  is_bot       boolean not null default false
);

comment on table public.cta_events is
  'CRO Phase 4: cookieless first-party CTA click / funnel-moment events. '
  'Written only via record_cta_click() (SECURITY DEFINER); no direct '
  'anon/authenticated access (RLS enabled, zero policies). visitor_hash '
  'is the same daily-rotating salted hash as page_views — no PII stored.';

alter table public.cta_events enable row level security;
-- No anon/authenticated policies -> only service_role / SECURITY DEFINER owner.

create index if not exists cta_events_occurred_idx
  on public.cta_events (occurred_at desc) where (not is_bot);
create index if not exists cta_events_cta_idx
  on public.cta_events (cta) where (not is_bot);

-- ── 2. Writer ────────────────────────────────────────────────────────────────

create or replace function public.record_cta_click(
  p_cta        text,
  p_path       text default null,
  p_lookup_key text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_headers jsonb;
  v_ua text; v_ip text; v_salt text; v_day text; v_hash text;
  v_cta text; v_path text; v_key text; v_bot boolean;
begin
  -- cta is required and capped; refuse empties rather than store junk rows.
  v_cta := left(trim(coalesce(p_cta, '')), 100);
  if v_cta = '' then
    return;
  end if;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ua := coalesce(v_headers->>'user-agent', '');
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);

  -- sanitize path: drop query/hash, cap length (same as record_page_view)
  v_path := left(split_part(split_part(coalesce(p_path,'/'),'?',1),'#',1), 300);
  if v_path = '' then v_path := '/'; end if;

  v_key := nullif(left(trim(coalesce(p_lookup_key, '')), 100), '');

  v_bot := v_ua ~* '(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|lighthouse|preview|curl|wget|python-requests|axios|node-fetch|semrush|ahrefs|dataprovider)';

  v_day  := (now() at time zone 'America/Chicago')::date::text;
  select salt into v_salt from public.analytics_salt where id = 1;
  v_hash := left(encode(extensions.digest(v_ip || '|' || v_ua || '|' || coalesce(v_salt,'') || '|' || v_day, 'sha256'), 'hex'), 16);

  insert into public.cta_events (cta, path, lookup_key, visitor_hash, is_bot)
  values (v_cta, v_path, v_key, v_hash, coalesce(v_bot, false));
end;
$$;

revoke execute on function public.record_cta_click(text,text,text) from public;
grant execute on function public.record_cta_click(text,text,text) to anon, authenticated;

-- ── 3. Founder-gated funnel reader (server-aggregated, never a row feed) ────

create or replace function public.founder_funnel(
  p_since timestamptz default now() - interval '30 days'
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    -- Named funnel stages (plan §14). quiz_completes/accounts come from
    -- the tables that already record those moments; only clicks are new.
    'stages', jsonb_build_object(
      'quiz_starts', (
        select count(*) from public.cta_events
        where cta = 'quiz-start' and not is_bot and occurred_at >= p_since
      ),
      'quiz_completes', (
        select count(*) from public.quiz_completions
        where completed_at >= p_since
      ),
      'accounts_created', (
        select count(*) from public.profiles
        where created_at >= p_since
      ),
      'seed_cta_clicks', (
        -- Clicks on Seed-labelled upgrade CTAs (cta name contains "seed":
        -- results-upgrade-seed, card-locked-unlock-seed, monograph-*-seed,
        -- favorites-free-seed, etc.). Counted by cta NAME only — NOT by
        -- lookup_key — so a single Seed checkout journey (which emits both
        -- checkout-intent-signup and checkout-start with a seed_* key) is
        -- not double-counted into this upstream "intent" stage.
        select count(*) from public.cta_events
        where not is_bot and occurred_at >= p_since
          and cta ilike '%seed%'
      ),
      'checkout_starts', (
        select count(*) from public.cta_events
        where cta = 'checkout-start' and not is_bot and occurred_at >= p_since
      ),
      'active_subscribers', (
        select count(*) from public.profiles
        where subscription_status = 'active'
      )
    ),
    'by_cta', (
      select coalesce(jsonb_agg(row_j order by (row_j->>'clicks')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'cta', cta,
          'clicks', count(*),
          'visitors', count(distinct visitor_hash),
          'last', max(occurred_at)
        ) as row_j
        from public.cta_events
        where not is_bot and occurred_at >= p_since
        group by cta
        order by count(*) desc
        limit 40
      ) x
    ),
    'by_path', (
      select coalesce(jsonb_agg(row_j order by (row_j->>'clicks')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'path', path,
          'clicks', count(*)
        ) as row_j
        from public.cta_events
        where not is_bot and occurred_at >= p_since
        group by path
        order by count(*) desc
        limit 20
      ) x
    ),
    'by_checkout_product', (
      select coalesce(jsonb_agg(row_j order by (row_j->>'starts')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'lookup_key', coalesce(lookup_key, '(unknown)'),
          'starts', count(*)
        ) as row_j
        from public.cta_events
        where cta = 'checkout-start' and not is_bot and occurred_at >= p_since
        group by coalesce(lookup_key, '(unknown)')
        order by count(*) desc
      ) x
    ),
    'daily', (
      select coalesce(jsonb_agg(row_j order by row_j->>'day'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'day', (occurred_at at time zone 'America/Chicago')::date,
          'clicks', count(*)
        ) as row_j
        from public.cta_events
        where not is_bot and occurred_at >= p_since
        group by (occurred_at at time zone 'America/Chicago')::date
      ) x
    )
  ) into result;

  return result;
end;
$$;

comment on function public.founder_funnel(timestamptz) is
  'CRO Phase 4 (plan §14): founder-gated funnel aggregates — named stages '
  '(quiz starts/completes, accounts, seed CTA clicks, checkout starts, '
  'active subscribers), per-CTA and per-path click counts, checkout starts '
  'by product, and CT daily click counts. All server-side; never subject '
  'to the PostgREST row cap.';

revoke execute on function public.founder_funnel(timestamptz) from public, anon;
grant execute on function public.founder_funnel(timestamptz) to authenticated;
