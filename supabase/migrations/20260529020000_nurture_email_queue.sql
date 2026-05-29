-- 20260529020000 — nurture_email_queue
--
-- Generic Day-N nurture email queue. Lives outside resend-waitlist EF and
-- consumed by per-funnel cron senders. Created for Eden's Table lead-magnet
-- flow (Sprouts/Seedlings Day-7 sends), but column shape is intentionally
-- funnel-agnostic so future flows (course Tier 1, app beta, etc.) can reuse.
--
-- Lifecycle:
--   1. Per-funnel signup EF (e.g. eden-table-lead-magnet) sends Day-1 email
--      via Resend AND inserts a queue row with send_at = now() + 7 days.
--   2. Per-funnel cron sender EF (e.g. eden-table-day7-sender) runs daily,
--      SELECTs pending rows WHERE sent_at IS NULL AND send_at <= now(),
--      sends each via Resend, and UPDATEs sent_at + resend_message_id.
--   3. Failed sends populate error_message for retry logic.
--
-- Idempotency: (email, template) is UNIQUE — re-signups with the same email
-- for the same template won't double-queue. Senders can safely retry.

CREATE TABLE IF NOT EXISTS public.nurture_email_queue (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text NOT NULL,
    first_name      text,
    entry_funnel    text NOT NULL,
    template        text NOT NULL,
    send_at         timestamptz NOT NULL,
    sent_at         timestamptz,
    resend_message_id text,
    error_message   text,
    attempts        int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per (recipient, template). Re-signups don't double-queue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nurture_queue_email_template
    ON public.nurture_email_queue (lower(email), template);

-- Cron sender's primary read path: pending rows due to send.
-- Partial index keeps it tiny even after years of sent history.
CREATE INDEX IF NOT EXISTS idx_nurture_queue_pending
    ON public.nurture_email_queue (send_at)
    WHERE sent_at IS NULL;

-- Operational lookup by funnel (e.g. monthly progress reports per funnel).
CREATE INDEX IF NOT EXISTS idx_nurture_queue_funnel
    ON public.nurture_email_queue (entry_funnel, created_at DESC);

-- RLS: service_role only. EFs (signup + cron sender) use service_role key.
-- No anon, no authenticated access — this is a server-side queue.
ALTER TABLE public.nurture_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.nurture_email_queue;
CREATE POLICY "service_role_all"
    ON public.nurture_email_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.nurture_email_queue IS
    'Generic Day-N nurture email queue. Per-funnel signup EFs insert; per-funnel cron senders consume. RLS: service_role only.';

COMMENT ON COLUMN public.nurture_email_queue.entry_funnel IS
    'Matches public.entry_funnel taxonomy (edens_table, course_tier2, etc.). Used for per-funnel routing in cron senders.';

COMMENT ON COLUMN public.nurture_email_queue.template IS
    'Logical template identifier within a funnel — e.g. ''sprouts_e2'', ''seedlings_e2''. Cron sender uses this to select the right HTML body.';

COMMENT ON COLUMN public.nurture_email_queue.attempts IS
    'Cron sender increments on each send attempt. Retry caps live in the sender; default cap is 3.';
