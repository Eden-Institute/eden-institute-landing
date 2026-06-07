-- The quiz 3-arc (#189) enqueues sequence_position 5/6/7, but the original
-- CHECK capped it at 5 — so the atomic 6-row enqueue batch failed entirely,
-- silently dropping the whole drip for new quiz signups. Widen to 2..7.
alter table public.nurture_email_queue
  drop constraint if exists nurture_email_queue_sequence_position_check;

alter table public.nurture_email_queue
  add constraint nurture_email_queue_sequence_position_check
  check (sequence_position >= 2 and sequence_position <= 7);
