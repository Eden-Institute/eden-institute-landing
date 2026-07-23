-- LAUNCH-DAY BLAST — preorder conversion series (positions 8-17).
--
-- Run this in the Supabase dashboard SQL editor (role=postgres) AT THE MOMENT
-- PREORDER OPENS, after PR #227 is merged, its migrations (including
-- 20260703093000_launch_conversion_series.sql) are applied, and the updated
-- nurture-emails EF is deployed.
--
-- Enqueues the 10-email conversion series for everyone on the homeschool
-- list, at day offsets from each recipient's ANCHOR:
--
--   8: +0   9: +2   10: +4   11: +7   12: +10
--   13: +13 14: +16 15: +20  16: +24  17: +28
--
-- Anchor = this run moment for most of the list. For recipients still
-- mid-way through the vision arc (pending 1-7 rows, i.e. signups from the
-- last two weeks), anchor = 2 days after their LAST scheduled vision email,
-- so nobody gets "the doors are about to open" after "the doors are open."
--
-- Copy phase is decided at SEND time by the drainer: founding offer ($249,
-- first 500) while the checkout's founding gate is open, retail copy ($349,
-- no founding language) automatically after it closes. Long-tail rows in
-- this blast (day +20/+24/+28) simply pick up whichever phase is true when
-- they send.
--
-- Emails stop per recipient the moment they preorder (orders trigger +
-- drain-time suppression). Idempotent: unique (recipient_email,
-- sequence_position) makes re-runs harmless, and existing purchasers are
-- excluded up front.
--
-- Timing note: run this in the morning (ideally ~8 AM Central) so the series
-- inherits a morning send hour. ~1,450 recipients drain at 200 per 15-min
-- cron tick, so the launch email completes within about two hours.

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
  -- Structurally undeliverable addresses. Six of these are already in the list
  -- (gmail / hotmail with no dot, hotmailcom, gmailc, a local part ending in a
  -- dot) and each one failed on all six vision-arc sends. Without this filter
  -- they would take 10 more rows apiece and fail 60 more times on launch day.
  -- Same shape rule as hasDeliverableShape() in resend-waitlist.
  and lower(email) ~ '^[^[:space:]@.]([^[:space:]@]*[^[:space:]@.])?@[^[:space:]@.]+(\.[^[:space:]@.]+)+$'
  and lower(email) !~ '\.\.'
  order by lower(email), joined_at asc
),
-- Recipients still receiving the vision arc: anchor after it finishes.
pending_vision as (
  select lower(recipient_email) as email,
         max(scheduled_for)     as last_vision_send
  from public.launch_email_queue
  where status = 'pending'
    and sequence_position between 1 and 7
  group by lower(recipient_email)
),
anchored as (
  select
    a.email,
    a.first_name,
    greatest(now(), coalesce(pv.last_vision_send + interval '2 days', now())) as anchor
  from audience a
  left join pending_vision pv on pv.email = a.email
),
sched (pos, day_offset) as (
  values
    (8, 0), (9, 2), (10, 4), (11, 7), (12, 10),
    (13, 13), (14, 16), (15, 20), (16, 24), (17, 28)
)
insert into public.launch_email_queue
  (recipient_email, first_name, sequence_position, scheduled_for, status)
select an.email, an.first_name, s.pos, an.anchor + (s.day_offset * interval '1 day'), 'pending'
from anchored an
cross join sched s
on conflict (recipient_email, sequence_position) do nothing;

-- Sanity check: expect (audience size x 10) new rows in positions 8-17,
-- with deferred_anchors matching the count of mid-drip signups.
select
  count(*)                                                    as conversion_rows,
  count(distinct recipient_email)                             as recipients,
  count(*) filter (where status = 'pending')                  as pending,
  count(distinct recipient_email) filter
    (where sequence_position = 8 and scheduled_for > now() + interval '1 hour')
                                                              as deferred_anchors,
  min(scheduled_for)                                          as first_send,
  max(scheduled_for)                                          as last_send
from public.launch_email_queue
where sequence_position >= 8;
