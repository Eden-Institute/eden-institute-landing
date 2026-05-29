-- ============================================================
-- Lead-magnet analytics infrastructure
--
-- Implements:
--   (a) ADD COLUMN source on waitlist_signups       — records WHICH CTA fired
--                                                     (sprouts_magnet, seedlings_magnet,
--                                                      reserve, etc.). Distinct from
--                                                      entry_funnel (coarse audience).
--   (b) digest_runs                                  — idempotency log; UNIQUE(digest_date)
--                                                     prevents double-sends on cron retry.
--   (c) v_lead_magnet_stats                          — anon-readable aggregated view, NO PII;
--                                                     powers the live dashboard artifact.
--   (d) lead_capture_digest_window RPC               — service-role-gated; returns full
--                                                     row data for captures in a time
--                                                     window. Sole input the digest EF
--                                                     needs to compose the daily email.
--
-- Companion deploys in the same PR:
--   - supabase/functions/notify-founder-digest/      (new EF, reads RPC, sends digest)
--   - api/cron/notify-founder-digest.ts              (Vercel cron entry)
--   - vercel.json                                    (cron schedule, 14:00 UTC daily)
--   - supabase/functions/resend-waitlist/index.ts    (persist `source` to new column;
--                                                     ships in follow-up PR)
--
-- Schedule: Vercel cron at 14:00 UTC daily = 08:00 America/Chicago (CST).
-- During DST (CDT, UTC-5) the digest lands at 09:00 local. Acceptable —
-- shifting the cron entry seasonally is more brittle than a one-hour drift.
--
-- Closes the founder's "ONE email when a new contact is added" request as
-- a daily digest (chosen over per-event for inbox calm) and ships the live
-- analytics dashboard data source.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Source attribution column on waitlist_signups
-- ------------------------------------------------------------
ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.waitlist_signups.source IS
  'Which CTA fired the capture (sprouts_magnet, seedlings_magnet, reserve, '
  'constitution_assessment, etc.). Distinct from entry_funnel: funnel is the '
  'coarse audience category, source is the exact button. NULL for legacy rows '
  'predating this column.';

CREATE INDEX IF NOT EXISTS waitlist_signups_source_idx
  ON public.waitlist_signups (source)
  WHERE source IS NOT NULL;


-- ------------------------------------------------------------
-- 2. Digest run audit / idempotency log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digest_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date     date NOT NULL UNIQUE,
  window_start    timestamptz NOT NULL,
  window_end      timestamptz NOT NULL,
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  captures_count  integer,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','skipped_zero','failed')),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.digest_runs IS
  'Idempotency log for the daily lead-magnet digest sent to hello@edeninstitute.health. '
  'UNIQUE(digest_date) prevents double-sends if Vercel cron retries. Digest EF first '
  'INSERTs a pending row (failing on conflict if already exists for that date), then '
  'UPDATEs to sent / skipped_zero / failed.';

ALTER TABLE public.digest_runs ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies = denied. service_role bypasses RLS.


-- ------------------------------------------------------------
-- 3. PII-free aggregated stats view
--
-- Returns per-day, per-funnel, per-source capture counts.
-- No emails, no first names, no IP-correlatable columns.
-- Safe to expose via the anon publishable key.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_lead_magnet_stats
WITH (security_invoker = on)
AS
  SELECT
    (entered_at AT TIME ZONE 'America/Chicago')::date AS capture_day,
    entry_funnel::text                                AS funnel,
    COALESCE(source, '(unattributed)')                AS source,
    count(*)::int                                     AS captures
  FROM public.waitlist_signups
  WHERE unsubscribed_at IS NULL
  GROUP BY 1, 2, 3;

COMMENT ON VIEW public.v_lead_magnet_stats IS
  'PII-free aggregated stats for the lead-magnet analytics dashboard. '
  'Day + funnel + source granularity. Excludes unsubscribed rows. Safe for anon-key reads.';

GRANT SELECT ON public.v_lead_magnet_stats TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 4. Service-role-only digest window RPC
--
-- Returns full row data (including PII) for captures inside a
-- window. Only the digest EF calls this; service-role grant is
-- the access boundary.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lead_capture_digest_window(
  p_window_start timestamptz,
  p_window_end   timestamptz
)
RETURNS TABLE (
  email          text,
  first_name     text,
  funnel         text,
  source         text,
  entered_at     timestamptz,
  source_url     text,
  utm_source     text,
  utm_campaign   text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    email,
    first_name,
    entry_funnel::text,
    COALESCE(source, '(unattributed)'),
    entered_at,
    source_url,
    utm_source,
    utm_campaign
  FROM public.waitlist_signups
  WHERE entered_at >= p_window_start
    AND entered_at <  p_window_end
  ORDER BY entered_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.lead_capture_digest_window(timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.lead_capture_digest_window(timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.lead_capture_digest_window IS
  'Service-role-gated. Returns capture rows (including PII) within a time window for '
  'the notify-founder-digest EF to compose the daily summary. Replace with a join to a '
  'welcome_variants table if the magnet-slug → welcome-email mapping ever lives in DB.';


-- ============================================================
-- End of lead-magnet analytics migration.
-- ============================================================
