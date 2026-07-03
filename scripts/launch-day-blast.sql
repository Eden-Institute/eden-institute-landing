-- LAUNCH-DAY BLAST — preorder conversion series (positions 8-17).
--
-- Run this in the Supabase dashboard SQL editor (role=postgres) AT THE MOMENT
-- PREORDER OPENS, after PR #227 is merged, its migrations (including
-- 20260703093000_launch_conversion_series.sql) are applied, and the updated
-- nurture-emails EF is deployed.
--
-- Enqueues the 10-email conversion series for everyone on the homeschool
-- list, at day offsets from THIS run moment:
--
--   8: now   9: +2d   10: +4d   11: +7d   12: +10d
--   13: +13d 14: +16d 15: +20d  16: +24d  17: +28d
--
-- Emails 8-17 persist until a recipient preorders, then stop (order trigger
-- + drain-time suppression). Idempotent: the unique
-- (recipient_email, sequence_position) constraint makes re-runs harmless,
-- and existing purchasers are excluded up front.
--
-- Timing note: Email 8 lands relative to when you run this. Run it in the
-- morning (ideally ~8 AM Central) so the whole series inherits a morning
-- send time. ~1,450 recipients drain at 200 per 15-min cron tick, so the
-- launch email completes within about two hours of this run.

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
  -- Already preordered? The series never starts for them.
  and lower(email) not in (
    select lower(customer_email) from public.orders
     where status not in ('cancelled', 'refunded')
  )
  order by lower(email), joined_at asc
),
sched (pos, day_offset) as (
  values
    (8, 0), (9, 2), (10, 4), (11, 7), (12, 10),
    (13, 13), (14, 16), (15, 20), (16, 24), (17, 28)
)
insert into public.launch_email_queue
  (recipient_email, first_name, sequence_position, scheduled_for, status)
select a.email, a.first_name, s.pos, now() + (s.day_offset * interval '1 day'), 'pending'
from audience a
cross join sched s
on conflict (recipient_email, sequence_position) do nothing;

-- Sanity check: expect (audience size x 10) new rows in positions 8-17.
select
  count(*)                                   as conversion_rows,
  count(distinct recipient_email)            as recipients,
  count(*) filter (where status = 'pending') as pending,
  min(scheduled_for)                         as first_send,
  max(scheduled_for)                         as last_send
from public.launch_email_queue
where sequence_position >= 8;
