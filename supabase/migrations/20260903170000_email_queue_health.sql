-- One row per email rail with the four numbers that say whether it is alive.
--
-- WHY. Every queue drainer reports "processed 0" when nothing is due, and a
-- drainer that has silently stopped reports exactly the same thing. The
-- notify-founder-digest reads this view every morning so a stuck queue shows
-- up as an OVERDUE count the founder can see, rather than as an absence of
-- news. It is also the health check named in the nurture runbook: a healthy
-- system returns four rows with overdue = 0.
--
-- overdue     pending rows whose scheduled_for is more than an hour in the past
--             (the drain runs every 15 minutes, so anything older than an hour
--             means the drainer is not running or is failing before it sends)
-- due_24h     pending rows that will send in the next 24 hours
-- sent_24h    rows marked sent in the last 24 hours
-- failed_24h  rows that reached terminal failure in the last 24 hours

create or replace view public.email_queue_health
with (security_invoker = true) as
select 'nurture_email_queue' as rail,
       count(*) filter (where status = 'pending' and scheduled_for < now() - interval '1 hour')                  as overdue,
       count(*) filter (where status = 'pending' and scheduled_for between now() and now() + interval '24 hours') as due_24h,
       count(*) filter (where status = 'sent'    and sent_at   > now() - interval '24 hours')                     as sent_24h,
       count(*) filter (where status = 'failed'  and updated_at > now() - interval '24 hours')                    as failed_24h
from public.nurture_email_queue
union all
select 'magnet_email_queue',
       count(*) filter (where status = 'pending' and scheduled_for < now() - interval '1 hour'),
       count(*) filter (where status = 'pending' and scheduled_for between now() and now() + interval '24 hours'),
       count(*) filter (where status = 'sent'    and sent_at   > now() - interval '24 hours'),
       count(*) filter (where status = 'failed'  and updated_at > now() - interval '24 hours')
from public.magnet_email_queue
union all
select 'launch_email_queue',
       count(*) filter (where status = 'pending' and scheduled_for < now() - interval '1 hour'),
       count(*) filter (where status = 'pending' and scheduled_for between now() and now() + interval '24 hours'),
       count(*) filter (where status = 'sent'    and sent_at   > now() - interval '24 hours'),
       count(*) filter (where status = 'failed'  and updated_at > now() - interval '24 hours')
from public.launch_email_queue
union all
select 'buyer_email_queue',
       count(*) filter (where status = 'pending' and scheduled_for < now() - interval '1 hour'),
       count(*) filter (where status = 'pending' and scheduled_for between now() and now() + interval '24 hours'),
       count(*) filter (where status = 'sent'    and sent_at   > now() - interval '24 hours'),
       count(*) filter (where status = 'failed'  and updated_at > now() - interval '24 hours')
from public.buyer_email_queue;

comment on view public.email_queue_health is
  'Per-rail liveness for the four cron-drained email queues. Read by notify-founder-digest. overdue > 0 means the drainer is not sending. Service role only.';

revoke all on public.email_queue_health from anon, authenticated;
