-- Queue the Email 7 make-good resend (2026-07-25 dead-link incident).
--
-- One-off data migration. E7 went to 1,382 families with a Reserve button that
-- pointed at the bare founders page URL, so the page disabled its own submit
-- button and captured zero reservations. Only a new send reaches those people.
--
-- STAGED ON PURPOSE. Two canary rows are due immediately; the real cohort is not
-- due for 25 minutes. The Vercel cron drains every 15 minutes and only picks up
-- rows where scheduled_for <= now(), so the next tick sends ONLY the canaries.
-- That leaves a real abort window: if the canary is wrong, cancel the cohort
-- with
--     update public.launch_email_queue set status='cancelled'
--      where sequence_position=18 and status='pending';
-- before it comes due, and nobody is mailed.
--
-- The two canaries deliberately cover BOTH arms of the subject-line split test
-- (variantForEmail(): hello+capitest -> a, hello+sproutstest -> b), so one tick
-- proves both subjects, both preheaders, and the signed link.
--
-- Idempotent and safe to replay: ON CONFLICT DO NOTHING against the
-- UNIQUE (recipient_email, sequence_position) constraint, and on a fresh
-- database there are no position-7 'sent' rows, so the cohort insert is a no-op
-- rather than mailing anyone.

-- Canaries: due now
insert into public.launch_email_queue
  (recipient_email, first_name, sequence_position, scheduled_for, status)
values
  ('hello+capitest@edeninstitute.health',    'Camila', 18, now(), 'pending'),
  ('hello+sproutstest@edeninstitute.health', 'Camila', 18, now(), 'pending')
on conflict (recipient_email, sequence_position) do nothing;

-- The incident cohort: due in 25 minutes.
-- Excludes the seeded test addresses, anyone who opted out of the homeschool
-- list, and anyone flagged unsubscribed on waitlist_signups. Expected: 1375.
insert into public.launch_email_queue
  (recipient_email, first_name, sequence_position, scheduled_for, status)
select c.email,
       coalesce(nullif(trim(c.first_name), ''), 'friend'),
       18,
       now() + interval '25 minutes',
       'pending'
from (
  select distinct on (lower(q.recipient_email))
         lower(q.recipient_email) as email, q.first_name
  from public.launch_email_queue q
  where q.sequence_position = 7 and q.status = 'sent'
  order by lower(q.recipient_email), q.sent_at desc
) c
where c.email not like 'hello+%'
  and c.email not like 'test.%@edeninstitute.health'
  and c.email <> 'hello@edeninstitute.health'
  and not exists (
    select 1 from public.email_list_unsubscribes u
     where lower(u.email) = c.email and u.list = 'homeschool')
  and not exists (
    select 1 from public.waitlist_signups w
     where lower(w.email) = c.email and w.unsubscribed_at is not null)
on conflict (recipient_email, sequence_position) do nothing;
