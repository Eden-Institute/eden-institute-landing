-- Founder punch list — durable open-items tracker surfaced in the daily
-- notify-founder-digest email. Service-role only (the digest EF reads it).
-- Mirrors the OneDrive Eden_Punch_List.md, now the source of truth so a
-- Vercel-cron EF can read it.

CREATE TABLE IF NOT EXISTS public.founder_punch_list (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  title        text NOT NULL,
  detail       text,
  owner        text,                          -- 'C' | 'AI' | free text
  status       text NOT NULL DEFAULT 'open',  -- open | deferred | done
  sort_order   integer NOT NULL DEFAULT 100,
  completed_at timestamptz
);

COMMENT ON TABLE public.founder_punch_list IS
  'Founder open-items tracker. Read by notify-founder-digest (service role) and appended to the daily email. status: open | deferred | done. RLS service-role only.';

ALTER TABLE public.founder_punch_list ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS founder_punch_list_status_idx
  ON public.founder_punch_list (status, sort_order);
