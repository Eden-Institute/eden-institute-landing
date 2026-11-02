-- weekly_trends_snapshot(): add lead_page_visitors (founder 2026-10-23).
--
-- The weekly trends email divided leads by EVERY visitor, so a week of outreach
-- (ESA vendors, people opening their Week 1 download page, list members clicking an
-- email) read as a "conversion slip" and told the founder to fix sign-up buttons that
-- were working. The 10/23 email said visits rose 33% and the lead rate halved; on the
-- pages that can actually take a sign-up, new visitors rose 13%.
--
-- lead_page_visitors {this, last} = visitors (bots excluded) who viewed at least one page
-- with a sign-up form, not counting people who ARRIVED from Eden's own emails to the
-- list. The email now divides leads by this number.
--
--   Sign-up pages: the pages that mount the sign-up pop-up (WaitlistController /
--   DualLeadMagnetCTAs / HomeJourneyPersonalizer on 2026-10-23) plus the quiz:
--   /, /homeschool, /freebies, /back-to-eden, /constitutional-herbalism, /community,
--   /assessment. Query strings, #fragments and trailing slashes are ignored.
--   A page that gains a sign-up form later needs adding here.
--
--   "Arrived from the list": the visitor's FIRST page view in the window carried
--   utm_source=email with one of the automated list mediums from _shared/email-utm.ts
--   (welcome, nurture, buyer, newsletter, broadcast, podcast_announce, partner, receipt,
--   guide_access), or utm_source=modal (the post-signup pop-up), or utm_medium=test.
--   Camila's hand-sent emails (signature, esa_outreach, coop_outreach) reach people who
--   are not on the list yet, so they still count.
--
--   visitor_hash resets every day (no hash appears on two Central dates), so a visitor
--   here is one person on one day, the same unit as traffic_visitors.
--
-- Everything else is unchanged. CREATE OR REPLACE keeps the function's privileges
-- (service_role only since 20260915100000_audit_hardening); they are re-stated below
-- so this file is safe to run on its own.

CREATE OR REPLACE FUNCTION public.weekly_trends_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      p.visitor_hash,
      p.occurred_at,
      p.utm_source,
      p.utm_medium,
      COALESCE(NULLIF(regexp_replace(regexp_replace(p.path, '[?#].*$', ''), '/+$', ''), ''), '/') AS page
    FROM public.page_views p, bounds b
    WHERE p.occurred_at >= b.lw_start
      AND p.occurred_at <  b.now_ts
      AND COALESCE(p.is_bot, false) = false
  ),
  arrivals AS (
    SELECT DISTINCT ON (visitor_hash)
      visitor_hash,
      wk,
      COALESCE(
           (lower(utm_source) = 'email' AND lower(utm_medium) IN (
              'welcome', 'nurture', 'buyer', 'newsletter', 'broadcast',
              'podcast_announce', 'partner', 'receipt', 'guide_access'))
        OR lower(utm_source) = 'modal'
        OR lower(utm_medium) = 'test',
        false) AS from_list
    FROM pv
    WHERE visitor_hash IS NOT NULL
    ORDER BY visitor_hash, occurred_at
  ),
  lead_page_hashes AS (
    SELECT DISTINCT visitor_hash
    FROM pv
    WHERE page IN ('/', '/homeschool', '/freebies', '/back-to-eden',
                   '/constitutional-herbalism', '/community', '/assessment')
  ),
  lead_page_visitors AS (
    SELECT a.wk
    FROM arrivals a
    JOIN lead_page_hashes l USING (visitor_hash)
    WHERE NOT a.from_list
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
    'lead_page_visitors', jsonb_build_object(
      'this', (SELECT count(*)::int FROM lead_page_visitors WHERE wk = 'this'),
      'last', (SELECT count(*)::int FROM lead_page_visitors WHERE wk = 'last')
    ),
    'quiz', jsonb_build_object(
      'this', (SELECT count(*)::int FROM quiz WHERE wk = 'this'),
      'last', (SELECT count(*)::int FROM quiz WHERE wk = 'last')
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.weekly_trends_snapshot() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_trends_snapshot() TO service_role;
