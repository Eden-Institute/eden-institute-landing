-- Launch-day blast: pre-queue the preorder conversion series (positions 8-17).
--
-- Body is scripts/launch-day-blast.sql verbatim, with ONE change: the anchor is
-- a fixed timestamp instead of now(), so the rows could be queued the night
-- before and still begin at the launch moment.
--
--   ANCHOR: 2026-07-29 10:00 America/Chicago (15:00 UTC, CDT is UTC-5)
--
--     8  +0   Jul 29      13  +13  Aug 11
--     9  +2   Jul 31      14  +16  Aug 14
--    10  +4   Aug 2       15  +20  Aug 18
--    11  +7   Aug 5       16  +24  Aug 22
--    12  +10  Aug 8       17  +28  Aug 26
--
-- Recipients still mid-way through the vision arc (pending rows in positions
-- 1-7) anchor at 2 days after their LAST scheduled vision email, so nobody
-- receives "the doors are about to open" after "the doors are open."
--
-- Ran as a migration rather than ad hoc because the Supabase MCP connection is
-- read-only and the dashboard SQL editor was not an option at the time. Keeping
-- it in migration history also means the remote schema_migrations table and this
-- repo do not drift, which a one-off dashboard run would have caused.
--
-- SAFE TO REPLAY. Idempotent via unique (recipient_email, sequence_position)
-- plus ON CONFLICT DO NOTHING, and it selects entirely from live list data, so
-- an environment without that data inserts nothing. Purchase and unsubscribe
-- suppression both happen again at SEND time in the nurture-emails drainer, so
-- rows queued here cannot outlive a family's decision to buy or to leave.
--
-- To abort before the first send:
--   update public.launch_email_queue set status = 'cancelled'
--    where status = 'pending' and sequence_position between 8 and 17;

with anchor_base as (
  select ('2026-07-29 10:00:00'::timestamp at time zone 'America/Chicago') as t
),
audience as (
  select distinct on (lower(email))
    lower(email)                                     as email,
    coalesce(nullif(trim(first_name), ''), 'friend') as first_name
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
  -- Structurally undeliverable addresses. Same shape rule as
  -- hasDeliverableShape() in resend-waitlist.
  and lower(email) ~ '^[^[:space:]@.]([^[:space:]@]*[^[:space:]@.])?@[^[:space:]@.]+(\.[^[:space:]@.]+)+$'
  and lower(email) !~ '\.\.'
  order by lower(email), joined_at asc
),
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
    greatest(ab.t, coalesce(pv.last_vision_send + interval '2 days', ab.t)) as anchor
  from audience a
  cross join anchor_base ab
  left join pending_vision pv on pv.email = a.email
),
sched (pos, day_offset) as (
  values
    (8, 0), (9, 2), (10, 4), (11, 7), (12, 10),
    (13, 13), (14, 16), (15, 20), (16, 24), (17, 28)
)
insert into public.launch_email_queue
  (recipient_email, first_name, sequence_position, scheduled_for, status)
select an.email, an.first_name, s.pos,
       an.anchor + (s.day_offset * interval '1 day'), 'pending'
from anchored an
cross join sched s
on conflict (recipient_email, sequence_position) do nothing;
