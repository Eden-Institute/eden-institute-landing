-- 2026-09-25: a signup for the free Back to Eden Chapter 1 (source 'back_to_eden_ch1', from
-- edeninstitute.health/back-to-eden) is a book reader, not a homeschool family. Like the band
-- waitlists (20260924200000) it gets its own welcome email from resend-waitlist and does NOT get
-- the automatic Eden's Table launch sequence, which sells the Sprouts year. List-wide blasts still
-- reach it (list-announce selects every edens_table row).
--
-- Body = the 20260924200000 definition plus 'back_to_eden_ch1' in the source check. Re-read the
-- live definition with pg_get_functiondef before applying and confirm it still matches.

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
  -- 2026-09-24: band waitlists (Cultivators, Practitioners) are not enrolled.
  -- 2026-09-25: nor are Back to Eden Chapter 1 readers.
  if coalesce(new.source, '') in ('cultivators_waitlist', 'practitioners_waitlist', 'back_to_eden_ch1') then
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
