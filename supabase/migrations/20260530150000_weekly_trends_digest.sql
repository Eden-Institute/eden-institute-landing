-- ============================================================
-- Weekly trends digest infrastructure
--
-- A founder-facing weekly briefing (every Friday) that translates raw
-- capture/traffic/quiz data into week-over-week trends. Mirrors the daily
-- lead digest (notify-founder-digest), but server-side and aggregate-only:
--
--   (a) weekly_trends_runs        — idempotency log; UNIQUE(run_date)
--                                   prevents double-sends on cron retry.
--   (b) weekly_trends_snapshot()  — SECURITY DEFINER RPC returning this-week
--                                   vs last-week aggregates (leads by
--                                   funnel/source, page-view traffic, quiz
--                                   completions) as a single jsonb object.
--                                   Internal testers + unsubscribed + bots
--                                   are excluded, consistent with the
--                                   dashboard (v_lead_magnet_stats, #80).
--
-- Companion deploys in the same PR:
--   - supabase/functions/weekly-trends-digest/      (new EF; reads RPC, sends)
--   - api/cron/weekly-trends-digest.ts              (Vercel cron entry)
--   - vercel.json                                   (Friday 14:00 UTC cron)
--
-- Schedule: Vercel cron "0 14 * * 5" = Friday 14:00 UTC = 08:00 CT (CST) /
-- 09:00 CT (CDT). Same one-hour seasonal drift convention as the daily digest.
--
-- Windows are rolling 7-day: this = [now-7d, now); last = [now-14d, now-7d).
-- Aggregate-only (no PII), so it never depends on the privileged MCP path —
-- it runs purely server-side with the EF's service-role key.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Weekly run audit / idempotency log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_trends_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date         date NOT NULL UNIQUE,
  triggered_at     timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  leads_this_week  integer,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','failed')),
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weekly_trends_runs IS
  'Idempotency log for the weekly trends briefing emailed to hello@edeninstitute.health. '
  'UNIQUE(run_date) prevents double-sends if Vercel cron retries on the same day. The EF '
  'INSERTs a pending row (failing on conflict if already run that date), then UPDATEs to '
  'sent / failed. Always sends (even a quiet week) — the weekly rhythm is the point.';

ALTER TABLE public.weekly_trends_runs ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies = denied. service_role bypasses RLS.


-- ------------------------------------------------------------
-- 2. Weekly trends snapshot RPC
--
-- Returns this-week vs last-week aggregates as a single jsonb object.
-- Rolling 7-day windows. Excludes internal testers (#80), unsubscribed
-- leads, and bot page views — consistent with the founder dashboard.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.weekly_trends_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH bounds AS (
    SELECT
      now()                       AS now_ts,
      now() - interval '7 days'   AS tw_start,
      now() - interval '14 days'  AS lw_start
  ),
  leads AS (
    SELECT
      CASE WHEN ws.entered_at >= b.tw_start THEN 'this' ELSE 'last' END AS wk,
      ws.entry_funnel::text                  AS funnel,
      COALESCE(ws.source, '(unattributed)')  AS source
    FROM public.waitlist_signups ws, bounds b
    WHERE ws.entered_at >= b.lw_start
      AND ws.entered_at <  b.now_ts
      AND ws.unsubscribed_at IS NULL
      AND NOT public.is_internal_tester(ws.email)
  ),
  leads_by_src AS (
    SELECT wk, funnel, source, count(*)::int AS n
    FROM leads GROUP BY 1, 2, 3
  ),
  pv AS (
    SELECT
      CASE WHEN p.occurred_at >= b.tw_start THEN 'this' ELSE 'last' END AS wk,
      p.visitor_hash
    FROM public.page_views p, bounds b
    WHERE p.occurred_at >= b.lw_start
      AND p.occurred_at <  b.now_ts
      AND COALESCE(p.is_bot, false) = false
  ),
  quiz AS (
    SELECT
      CASE WHEN q.completed_at >= b.tw_start THEN 'this' ELSE 'last' END AS wk
    FROM public.quiz_completions q, bounds b
    WHERE q.completed_at >= b.lw_start
      AND q.completed_at <  b.now_ts
      AND NOT public.is_internal_tester(q.email)
  )
  SELECT jsonb_build_object(
    'generated_at',    (SELECT now_ts   FROM bounds),
    'this_week_start', (SELECT tw_start FROM bounds),
    'last_week_start', (SELECT lw_start FROM bounds),
    'leads', jsonb_build_object(
      'this', (SELECT count(*)::int FROM leads WHERE wk = 'this'),
      'last', (SELECT count(*)::int FROM leads WHERE wk = 'last'),
      'by_source', (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('funnel', funnel, 'source', source, 'wk', wk, 'n', n)),
          '[]'::jsonb
        ) FROM leads_by_src
      )
    ),
    'traffic_views', jsonb_build_object(
      'this', (SELECT count(*)::int FROM pv WHERE wk = 'this'),
      'last', (SELECT count(*)::int FROM pv WHERE wk = 'last')
    ),
    'traffic_visitors', jsonb_build_object(
      'this', (SELECT count(DISTINCT visitor_hash)::int FROM pv WHERE wk = 'this'),
      'last', (SELECT count(DISTINCT visitor_hash)::int FROM pv WHERE wk = 'last')
    ),
    'quiz', jsonb_build_object(
      'this', (SELECT count(*)::int FROM quiz WHERE wk = 'this'),
      'last', (SELECT count(*)::int FROM quiz WHERE wk = 'last')
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.weekly_trends_snapshot() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.weekly_trends_snapshot() TO service_role;

COMMENT ON FUNCTION public.weekly_trends_snapshot IS
  'Service-role-gated. Returns this-week vs last-week aggregates (leads by funnel/source, '
  'page-view traffic, quiz completions) as jsonb for the weekly-trends-digest EF. Rolling '
  '7-day windows; excludes internal testers, unsubscribed leads, and bots. No PII.';


-- ============================================================
-- End of weekly trends digest migration.
-- ============================================================
