-- Route new lead-magnet signups: free week 1, free week 2, then the offer.
--
-- BEFORE: enqueue_launch_sequence_on_signup queued positions 1-17. The 7-email
-- vision arc ran on days 2-14 and the preorder series did not start until
-- DAY 16, so a lead who signed up during the launch window waited more than two
-- weeks to be told the doors were open.
--
-- AFTER: the vision arc is not queued at all for new signups. They get
--   day 0  free week 1   (sent inline by resend-waitlist)
--   day 7  free week 2   (magnet_email_queue position 2)
--   day 9  Email 8, the preorder offer, then the series
--
-- Day offsets 9/11/13/16/19/22/25/29/33/37 preserve the launch cohort's exact
-- relative cadence (+0/+2/+4/+7/+10/+13/+16/+20/+24/+28), just anchored 2 days
-- after free week 2 instead of 2 days after Email 7. Two days is the same gap
-- the old sequence left between the last vision email and the first offer.
--
-- The vision arc itself is NOT deleted. Positions 1-7 still exist, still have
-- builders, and the backfilled July cohort already received them. This only
-- stops NEW signups from entering that arc.
--
-- Part 2 of this change lives in the resend-waitlist edge function, which must
-- stop enqueueing magnet position 3. Positions 4-7 chain off 3, so removing 3
-- ends the W3-W7 tail without touching MAGNET_CHAIN_NEXT.

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
    -- Preorder conversion series only. Starts 2 days after free week 2 (day 7).
    (8, 9), (9, 11), (10, 13), (11, 16), (12, 19),
    (13, 22), (14, 25), (15, 29), (16, 33), (17, 37)
  ) as s(pos, day_offset)
  on conflict (recipient_email, sequence_position) do nothing;

  return new;
end;
$function$;

-- ── Pull the in-flight cohort forward too (founder decision 2026-07-28) ──
-- Everyone still mid-way through the vision arc stops receiving it and joins
-- the launch cohort, so the whole list hears the offer on launch morning.
--
-- Order matters: capture WHO is mid-arc before cancelling, or the second
-- statement has nothing left to match on.

-- Done as ONE statement. mid_arc must be evaluated against the pre-cancel
-- state, and every CTE here shares a single snapshot, so the outer UPDATE still
-- sees who was mid-arc even though stop_arc has cancelled those rows. A
-- data-modifying CTE always executes even when nothing selects from it.
with mid_arc as (
  select distinct lower(recipient_email) as email
  from public.launch_email_queue
  where status = 'pending'
    and sequence_position between 1 and 7
),
sched (pos, day_offset) as (
  values
    (8, 0), (9, 2), (10, 4), (11, 7), (12, 10),
    (13, 13), (14, 16), (15, 20), (16, 24), (17, 28)
),
-- 1. Stop the remaining vision-arc emails.
stop_arc as (
  update public.launch_email_queue
     set status        = 'cancelled',
         error_message = 'superseded: routed straight to preorder series 2026-07-28',
         updated_at    = now()
   where status = 'pending'
     and sequence_position between 1 and 7
  returning id
)
-- 2. Re-anchor their conversion series to the launch moment, matching everyone
--    else. Only moves rows EARLIER and only pending ones, so a family who has
--    already been sent something is never disturbed.
update public.launch_email_queue q
   set scheduled_for = ('2026-07-29 10:00:00'::timestamp at time zone 'America/Chicago')
                       + (s.day_offset * interval '1 day'),
       updated_at    = now()
  from sched s
 where q.sequence_position = s.pos
   and q.status = 'pending'
   and lower(q.recipient_email) in (select email from mid_arc)
   and q.scheduled_for > ('2026-07-29 10:00:00'::timestamp at time zone 'America/Chicago')
                         + (s.day_offset * interval '1 day');
