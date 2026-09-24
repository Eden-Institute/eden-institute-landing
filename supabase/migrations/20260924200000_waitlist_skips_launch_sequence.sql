-- Founder decision 2026-09-24: a Cultivators or Practitioners WAITLIST signup
-- gets its band welcome and, later, the launch email for its band. It does NOT
-- get the automatic launch sequence (positions 8-12 and 19-21, which sell the
-- Sprouts year). List-wide blasts still reach these people, because
-- list-announce selects every edens_table row in waitlist_signups; this only
-- stops the automatic series.
--
-- The trigger fires AFTER INSERT on waitlist_signups, and resend-waitlist
-- inserts only on a person's FIRST signup (unique email + entry_funnel). So:
--   * someone whose first signup is a band waitlist: no series (the new rule);
--   * someone already on the list (a free week, say) who later joins a band
--     waitlist: unchanged, they are already in whatever series they had.
--
-- The body below is the live definition (read with pg_get_functiondef on
-- 2026-09-24, identical to 20260828020000) plus the one source check.
-- It also cancels the pending series rows of the one person whose first signup
-- was a band waitlist (6 rows at the time of writing).

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
  -- 2026-09-24: band waitlists (Cultivators, Practitioners) are not enrolled.
  if coalesce(new.source, '') in ('cultivators_waitlist', 'practitioners_waitlist') then
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
    -- Preorder conversion series.
    (8, 9), (9, 11), (10, 13), (11, 16), (12, 19),
    -- Post-delay Starter Unit arc. Replaces the cancelled 13 to 17.
    (19, 22), (20, 26), (21, 31)
  ) as s(pos, day_offset)
  on conflict (recipient_email, sequence_position) do nothing;

  return new;
end;
$function$;

update public.launch_email_queue q
   set status = 'cancelled'
 where q.status = 'pending'
   and q.recipient_email in (
     select lower(w.email) from public.waitlist_signups w
      where w.entry_funnel = 'edens_table'
        and w.source in ('cultivators_waitlist', 'practitioners_waitlist')
   );
