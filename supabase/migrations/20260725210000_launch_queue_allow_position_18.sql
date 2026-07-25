-- Widen launch_email_queue.sequence_position to allow 18.
--
-- Position 18 is the one-off Email 7 make-good resend for the 2026-07-25
-- dead-link incident: E7 went to 1,382 families with a Reserve button that
-- pointed at the bare founders page URL, which disables its own submit button
-- without a signed ?t= token, so zero reservations were captured.
--
-- A new position is used rather than resetting the existing position-7 rows to
-- 'pending' for two reasons:
--   1. launch_email_queue is UNIQUE (recipient_email, sequence_position), and
--      the sent-at history of the original E7 send is worth keeping intact.
--   2. 24 position-7 rows are still legitimately pending for families who have
--      NOT yet received E7. Reusing position 7 would send them an apology for
--      an email they never got.
--
-- Position 18 is deliberately NOT added to enqueue_launch_sequence_on_signup:
-- new signups must never receive it, only the incident cohort.
--
-- Idempotent: safe to re-run and safe for `supabase db push` after the same
-- change has been applied by hand in the SQL editor.

alter table public.launch_email_queue
  drop constraint if exists launch_email_queue_sequence_position_check;

alter table public.launch_email_queue
  add constraint launch_email_queue_sequence_position_check
  check (sequence_position >= 1 and sequence_position <= 18);
