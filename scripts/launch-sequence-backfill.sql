-- ONE-TIME BACKFILL — July 2026 Sprouts preorder launch sequence.
--
-- Run this in the Supabase dashboard SQL editor (role=postgres) IMMEDIATELY
-- AFTER migration 20260702190000_launch_email_queue.sql is applied (the
-- trigger then covers all later signups, so there is no coverage gap). It
-- enqueues all 7 fixed-date sends for everyone on the homeschool list at
-- that moment:
--
--   Email 1  Jul  9   Email 2  Jul 11   Email 3  Jul 13   Email 4  Jul 15
--   Email 5  Jul 17   Email 6  Jul 20   Email 7  Jul 22      (13:00 UTC = 8 AM Central)
--
-- Signups AFTER the backfill are covered by the trg_enqueue_launch_sequence
-- trigger (2-day drip); the unique (recipient_email, sequence_position)
-- constraint makes re-running this script harmless (on conflict do nothing).
--
-- Audience: active edens_table signups (sprouts_magnet, seedlings_magnet,
-- reserve) plus founders_interest captures, deduped by email, minus global
-- unsubscribes and homeschool per-list opt-outs. As of 2026-07-02 this is
-- ~1,468 recipients; the drainer sends 200/run every 15 min, so launch-day
-- Email 1 completes within ~2 hours of 13:00 UTC.

with audience as (
  select distinct on (lower(email))
    lower(email)                                        as email,
    coalesce(nullif(trim(first_name), ''), 'friend')    as first_name
  from (
    select email, first_name, entered_at as joined_at
      from public.waitlist_signups
     where entry_funnel::text = 'edens_table'
       and unsubscribed_at is null
    union all
    select email, first_name, created_at as joined_at
      from public.founders_interest
  ) u
  where lower(email) not in (
    select lower(email) from public.email_list_unsubscribes where list = 'homeschool'
  )
  and lower(email) not in (
    select lower(email) from public.waitlist_signups where unsubscribed_at is not null
  )
  order by lower(email), joined_at asc
),
sched (pos, send_at) as (
  values
    (1, timestamptz '2026-07-09 13:00:00+00'),
    (2, timestamptz '2026-07-11 13:00:00+00'),
    (3, timestamptz '2026-07-13 13:00:00+00'),
    (4, timestamptz '2026-07-15 13:00:00+00'),
    (5, timestamptz '2026-07-17 13:00:00+00'),
    (6, timestamptz '2026-07-20 13:00:00+00'),
    (7, timestamptz '2026-07-22 13:00:00+00')
)
insert into public.launch_email_queue
  (recipient_email, first_name, sequence_position, scheduled_for, status)
select a.email, a.first_name, s.pos, s.send_at, 'pending'
from audience a
cross join sched s
on conflict (recipient_email, sequence_position) do nothing;

-- Sanity check: expect (audience size x 7) rows, all pending, 7 distinct dates.
select
  count(*)                                   as total_rows,
  count(distinct recipient_email)            as recipients,
  count(*) filter (where status = 'pending') as pending,
  count(distinct scheduled_for)              as distinct_send_times
from public.launch_email_queue;
