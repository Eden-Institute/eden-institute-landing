-- Per-partner follow-up date override (founder decision 2026-09-12).
--
-- The partner cadence is last_touch + 28 days, computed, never stored. On 2026-09-12 Camila sent a
-- one-off check-in to 20 partners and asked that their NEXT follow-up wait 6 weeks, not 4, without
-- changing the cadence for anyone else. This column holds that exception.
--
-- Semantics, shared by founder_partner_due(), scripts/sync_partners.py and the Monday
-- partner-followup-check task: a partner is due on next_followup_due when it is set AND later than
-- the Central date of last_touch_at; otherwise on last_touch + 28 as before. The "later than the
-- last touch" test makes it self-expiring: once a newer touch lands past it, the normal clock resumes,
-- so a stale override can never leave someone permanently due.
--
-- Idempotent: safe to re-run.

alter table public.founding_partners
  add column if not exists next_followup_due date;

comment on column public.founding_partners.next_followup_due is
  'Optional founder override for the next partner follow-up (Central date). Used only while it is later than last_touch_at''s Central date; otherwise last_touch + 28 applies.';

create or replace function public.founder_partner_due()
 returns table(name text, email text, handle text, welcome_sent_at timestamp with time zone, last_touch_at timestamp with time zone, follow_ups integer, next_due date, days_overdue integer)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select p.name, p.email, p.handle, p.welcome_sent_at, p.last_touch_at, p.follow_ups,
         d.next_due,
         greatest(0, (current_date - d.next_due))::integer as days_overdue
  from public.founding_partners p
  cross join lateral (
    select case
             when p.follow_ups is null or p.follow_ups > 2 then null      -- sequence spent, rests
             when p.next_followup_due is not null
              and p.next_followup_due > (coalesce(p.last_touch_at, p.welcome_sent_at) at time zone 'America/Chicago')::date
               then p.next_followup_due                                   -- founder override
             else (coalesce(p.last_touch_at, p.welcome_sent_at)
                   + case p.follow_ups
                       when 0 then interval '28 days'
                       when 1 then interval '21 days'
                       when 2 then interval '21 days'
                     end)::date
           end as next_due
  ) d
  where d.next_due is not null
    and coalesce(p.welcome_sent_at, p.last_touch_at) is not null
  order by d.next_due asc;
end;
$function$;
