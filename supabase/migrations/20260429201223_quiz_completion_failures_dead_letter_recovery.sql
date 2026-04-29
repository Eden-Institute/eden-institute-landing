-- v4.2 launch-blocker fix: durable recovery for visitors whose quiz submissions
-- fail at the database write layer. Captures the full payload + diagnostic detail
-- BEFORE the Edge Function returns 502, so no real-traffic submission is silently lost.
--
-- Architecture (matches Lock #48 producer/consumer pattern):
--   PRODUCER: record-quiz-completion EF writes to this table on PostgREST non-OK
--             after one immediate retry. Always returns 502 to caller so frontend
--             knows the save failed (visitor is shown an error and can retry).
--   CONSUMER: replay-quiz-completion-failures EF (cron-driven via Vercel every 30
--             min) drains pending rows by replaying the original payload through
--             the same INSERT path. On success, marks resolved_at +
--             resolved_quiz_completion_id. On failure, increments retry_count.
--
-- RLS: enabled with NO policies. Service-role-only writes. Same lockdown as
-- quiz_completions per Lock #15.

CREATE TABLE IF NOT EXISTS public.quiz_completion_failures (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_payload                   jsonb       NOT NULL,
  -- What the Edge Function captured from PostgREST when the original INSERT failed:
  postgrest_status              integer,
  postgrest_body                text,
  ef_error_message              text,
  -- Replay bookkeeping:
  retry_count                   integer     NOT NULL DEFAULT 0,
  last_retry_at                 timestamptz,
  last_retry_status             integer,
  last_retry_body               text,
  -- Resolution:
  resolved_at                   timestamptz,
  resolved_quiz_completion_id   uuid        REFERENCES public.quiz_completions(id) ON DELETE SET NULL,
  -- Free-form for manual triage (e.g. "permanent — visitor reached out separately"):
  notes                         text,
  received_at                   timestamptz NOT NULL DEFAULT now()
);

-- Lock down. Service-role bypasses RLS; no other role gets read or write.
ALTER TABLE public.quiz_completion_failures ENABLE ROW LEVEL SECURITY;

-- Index for the cron drain query: oldest unresolved rows first.
CREATE INDEX IF NOT EXISTS quiz_completion_failures_pending_idx
  ON public.quiz_completion_failures (received_at)
  WHERE resolved_at IS NULL;

-- Index for triage / stats queries.
CREATE INDEX IF NOT EXISTS quiz_completion_failures_received_at_desc_idx
  ON public.quiz_completion_failures (received_at DESC);

COMMENT ON TABLE public.quiz_completion_failures IS
  'Dead-letter recovery table for record-quiz-completion EF. Captures the full payload of any quiz submission whose database INSERT fails, so the Vercel-cron-driven replay-quiz-completion-failures EF can retry it. Lock #14: introduced 2026-04-29 in response to four real-traffic 502s with no recoverable payload data. RLS enabled with no policies — service-role only.';

-- Stats view for at-a-glance triage. Service-role can read directly; safe to expose
-- to authenticated dashboard queries later if a tier-gated dashboard is built.
CREATE OR REPLACE VIEW public.quiz_completion_failure_stats AS
SELECT
  COUNT(*) FILTER (WHERE resolved_at IS NULL)                        AS pending_count,
  COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)                    AS resolved_count,
  COUNT(*)                                                            AS total_count,
  COUNT(*) FILTER (WHERE received_at > now() - interval '24 hours')  AS last_24h_count,
  COUNT(*) FILTER (WHERE received_at > now() - interval '24 hours'
                     AND resolved_at IS NULL)                         AS last_24h_pending,
  MIN(received_at) FILTER (WHERE resolved_at IS NULL)                 AS oldest_pending_received_at,
  MAX(received_at)                                                    AS most_recent_failure_at,
  MAX(retry_count)                                                    AS max_retries_seen
FROM public.quiz_completion_failures;

COMMENT ON VIEW public.quiz_completion_failure_stats IS
  'At-a-glance dead-letter health for the quiz_completion_failures recovery queue. Surfaced via SQL editor for triage; future Practitioner-tier admin dashboard can RLS-gate a row source.';
