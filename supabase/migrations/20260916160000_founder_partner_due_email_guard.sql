-- 20260916160000_founder_partner_due_email_guard.sql
--
-- Restores the email guard in founder_partner_due() that 20260831120000 (PR #421) added and that
-- 20260912230000 (next_followup_override cadence rule) dropped when it redefined the function.
--
-- Why it matters: founding_partners.email has been nullable since 2026-08-31 (DM-only partners carry
-- status 'awaiting_email'). Without the guard, such a row can be returned as due, and the Monday
-- partner-followup-check drafts a reply to an empty address and runs a broader-than-intended
-- `in:sent to:` search whose results are written back to the row. No such row exists on 2026-09-15;
-- this closes the latent path.
--
-- The body below is the LIVE definition read from production on 2026-09-15 (the 09-12 cadence rule,
-- founder override included) with exactly two added conditions. Nothing else changes: same signature,
-- return type, SECURITY DEFINER, search_path, and the existing grants are kept by CREATE OR REPLACE.

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
    and p.email is not null                -- a DM-only partner has no address to follow up to
    and p.status <> 'awaiting_email'       -- recorded, never mailed (PR #421)
  order by d.next_due asc;
end;
$function$;

do $assert$
declare
  def text := lower(pg_get_functiondef('public.founder_partner_due()'::regprocedure));
begin
  if position('p.email is not null' in def) = 0 or position('awaiting_email' in def) = 0 then
    raise exception 'founder_partner_due() is missing the email guard';
  end if;
  if position('next_followup_due' in def) = 0 then
    raise exception 'founder_partner_due() lost the 2026-09-12 founder override rule';
  end if;
  if has_function_privilege('anon', 'public.founder_partner_due()', 'EXECUTE') then
    raise exception 'anon must not execute founder_partner_due()';
  end if;
end
$assert$;
