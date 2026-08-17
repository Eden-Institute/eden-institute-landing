-- Founding-partner follow-up cadence columns.
--
-- WHY: the partner cadence is "welcome, then +28 days, then +21, then +21, then rest"
-- (founder decision 2026-07-23, reconfirmed 2026-08-16). Follow-up 1 is computable from
-- welcome_sent_at, but follow-ups 2 and 3 are "+21 days from the LAST touch", and the table
-- had no way to express either the last touch or how many touches had already gone out.
--
-- This was not a theoretical gap. The weekly `partner-followup-check` task could not run the
-- cadence from the database at all, so it was still reading a roster table inside
-- partner_tracker.md that had been deleted on 2026-07-26. It ran every Monday, found nothing,
-- reported "nobody is due", and looked healthy while doing no work for three weeks.
--
-- Applied to production 2026-08-17 via the Management API. This file exists so `db push`
-- stays a no-op and the schema is reproducible from the repo. Fully idempotent.

alter table public.founding_partners
  add column if not exists last_touch_at timestamptz,
  add column if not exists follow_ups integer not null default 0;

comment on column public.founding_partners.last_touch_at is
  'Timestamp of the most recent outbound touch (welcome or any follow-up). Drives the +21 day spacing for follow-ups 2 and 3.';

comment on column public.founding_partners.follow_ups is
  'Count of follow-ups sent AFTER the welcome. 0 = welcome only. 3 = sequence complete, partner moves to resting.';

-- Backfill: every partner existing at this point has had exactly one touch, their welcome.
-- Guarded so a re-run cannot clobber a real follow-up timestamp.
update public.founding_partners
   set last_touch_at = welcome_sent_at
 where last_touch_at is null
   and welcome_sent_at is not null;
