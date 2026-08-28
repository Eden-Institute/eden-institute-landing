-- Stop the signup trigger re-enqueuing the cancelled fall-2026 tail.
--
-- THE BUG THIS FIXES, and it is a partial fix being completed rather than a new
-- discovery: on 2026-08-27 all 6,109 pending rows at positions 13 to 17 were
-- cancelled, because that copy sells a school year starting this autumn for a kit
-- that now ships 2027-07-31. But only the ROWS were cancelled. This trigger is the
-- PRODUCER, and it still enqueued 13 to 17 for every new edens_table signup, so the
-- cancelled series would have quietly regenerated one signup at a time.
--
-- Nothing had regenerated yet when this was written, and that is luck rather than
-- design: new signups had collapsed from about 25 a week in late July to roughly one.
-- The next signup would have been enrolled into all five stale positions.
--
-- Lesson, already on the record in CLAUDE.md and repeated here because it recurred:
-- cancelling rows does not retire a series. Grep for the producer.
--
-- WHAT CHANGES. Positions 8 to 12 stay exactly as they were; they carry no
-- school-year assumption now that the "second-guessing in October" and "By spring you
-- will know 36 herbs" lines were re-anchored in PR #418. Positions 13 to 17 are
-- replaced by the post-delay Starter Unit arc at 19, 20 and 21, on the same cadence:
-- the old 13/14/15 sat at days 22/25/29, the new arc sits at 22/26/31, which mirrors
-- the 4 and 5 day spacing chosen for the existing list send on Aug 31, Sep 4 and Sep 9.
--
-- 18 is skipped: EMAIL_7_RESEND_POSITION owns it and it is a one-off make-good.

create or replace function public.enqueue_launch_sequence_on_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  launch_start constant timestamptz := '2026-07-03 00:00:00+00';
begin
  if now() < launch_start then
    return new;
  end if;
  if new.entry_funnel::text <> 'edens_table' then
    return new;
  end if;
  if new.unsubscribed_at is not null then
    return new;
  end if;

  insert into public.launch_email_queue
    (recipient_email, first_name, sequence_position, scheduled_for, status)
  select
    lower(new.email),
    coalesce(nullif(trim(new.first_name), ''), 'friend'),
    s.pos,
    now() + (s.day_offset * interval '1 day'),
    'pending'
  from (values
    -- Preorder conversion series.
    (8, 9), (9, 11), (10, 13), (11, 16), (12, 19),
    -- Post-delay Starter Unit arc. Replaces the cancelled 13 to 17.
    (19, 22), (20, 26), (21, 31)
  ) as s(pos, day_offset)
  on conflict (recipient_email, sequence_position) do nothing;

  return new;
end;
$function$;
