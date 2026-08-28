-- Widen launch_email_queue.sequence_position from 18 to 21.
--
-- WHY. Positions 13 to 17 were the fall-2026 launch sequence. Their ship dates were
-- correct but the argument around them was not: they sell a school year starting this
-- autumn ("what they will still remember in December", "before the founding 500 fill")
-- for a kit that now ships 2027-07-31. All 6,109 pending rows across those five
-- positions were cancelled on 2026-08-27 by founder decision.
--
-- Positions 19, 20 and 21 are their replacement: a three-email arc built on the podcast
-- interviews, selling the $39 digital Starter Unit that exists today rather than the
-- printed kit that does not.
--
-- WHY NOT REUSE 13 TO 17. `launch_email_queue` has UNIQUE (recipient_email,
-- sequence_position), and 179 to 214 people have already RECEIVED each of those
-- positions. Reusing a slot would both collide with their existing rows and silently
-- rewrite what a delivered email meant. New positions keep the historical record honest.
--
-- 18 is deliberately skipped: EMAIL_7_RESEND_POSITION already occupies it
-- (_shared/launch-sequence-templates.ts), and it is a one-off make-good resend, not part
-- of any sequence.
--
-- The drain in supabase/functions/nurture-emails/index.ts selects
-- `sequence_position >= CONVERSION_FIRST_POSITION (8) AND != EMAIL_7_RESEND_POSITION (18)`,
-- so 19, 20 and 21 are picked up with no change to that filter. The builders must still
-- be registered in LAUNCH_BUILDERS; an exported but unregistered builder makes
-- buildLaunchEmail() return null and fail silently at send time.

alter table public.launch_email_queue
  drop constraint if exists launch_email_queue_sequence_position_check;

alter table public.launch_email_queue
  add constraint launch_email_queue_sequence_position_check
  check (sequence_position >= 1 and sequence_position <= 21);
