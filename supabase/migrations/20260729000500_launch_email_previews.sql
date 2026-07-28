-- Tracks which launch emails have already been previewed to the founder.
--
-- The founder reviews every email that goes to the list BEFORE the list gets
-- it: launch-email-preview renders each queued position and sends it to
-- FOUNDER_EMAIL roughly 24 hours ahead of its first real send, so copy can
-- still be changed on the fly.
--
-- Primary key is sequence_position alone, deliberately. Each email's copy needs
-- reviewing once, before it first goes out. Stragglers (recipients deferred to a
-- later anchor) must not trigger a second preview of copy already approved.
--
-- To deliberately re-preview a position after editing its copy, delete the row:
--   delete from public.launch_email_previews where sequence_position = 12;

create table if not exists public.launch_email_previews (
  sequence_position smallint     primary key,
  scheduled_for     timestamptz  not null,
  subject           text,
  resend_id         text,
  sent_at           timestamptz  not null default now()
);

comment on table public.launch_email_previews is
  'One row per launch email previewed to the founder. Delete a row to force a re-preview.';

-- Service-role only. The edge function uses the service key, which bypasses
-- RLS; enabling it with no policies means nothing else can read or write.
alter table public.launch_email_previews enable row level security;
