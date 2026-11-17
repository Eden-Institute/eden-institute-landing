-- 2026-11-17, Lane 2 deep audit area 8, finding U3. Founder tap "Let them back in": when a family who once
-- unsubscribed signs up again, that one series comes back for them (free week, quiz or Advent); their other
-- opt-outs stay; hard bounces and spam complaints stay blocked.
--
-- THE RULE (public.email_send_blocked): an opt-out blocks every email queued BEFORE it. A sign-up AFTER it
-- queues new emails, which may send. A later opt-out blocks those too (unsubscribe now refreshes
-- email_list_unsubscribes.unsubscribed_at on a repeat). Always blocked whatever the dates: a hard (Permanent)
-- bounce, a spam complaint, a deleted Resend contact, and a global opt-out whose cause is not a voluntary
-- Resend unsubscribe. Before this, a returning family got the welcome and then nothing (free week), or every
-- quiz email even after leaving everything (the quiz drip never checked global opt-outs), or "You're in" and
-- no Sunday emails (Advent).
--
-- 1. seasonal_optins.last_optin_at: the latest Advent sign-up (created_at keeps the first). Backfilled.
-- 2. public.email_send_blocked(email, list, queued_at): the rule above. nurture-emails asks it for the free-week
--    and quiz drips, with the queue row's created_at.
-- 3. public.reopen_series_on_signup(email, series, band): called by resend-waitlist on a free-week, quiz or
--    Advent sign-up. For someone who had opted out and is not hard-blocked, it clears THAT series' rows that
--    were cancelled because of the opt-out (they would otherwise block the fresh queue: unique keys), stamps
--    last_optin_at for Advent, and records the return in waitlist_signups.metadata.returned_after_optout. It
--    never deletes an opt-out record: the other series stay off.
-- 4. public.broadcast_audience: advent_2026 also takes Advent opt-ins newer than the family's last voluntary
--    opt-out (advent_back). Body = live 20261117033011 plus the two marked NEW pieces; every other audience
--    returns exactly the same rows (checked before applying).
-- All three functions: security definer, service role only.

alter table public.seasonal_optins add column if not exists last_optin_at timestamptz;
update public.seasonal_optins set last_optin_at = created_at where last_optin_at is null;
alter table public.seasonal_optins alter column last_optin_at set default now();
alter table public.seasonal_optins alter column last_optin_at set not null;

create or replace function public.email_send_blocked(p_email text, p_list text, p_queued_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select exists (
    select 1 from public.waitlist_signups w
    where lower(trim(w.email)) = lower(trim(p_email))
      and (
        coalesce(w.metadata->>'bounce_type', '') ilike any (array['%permanent%', '%hard%'])
        or coalesce(w.metadata, '{}'::jsonb) ? 'complaint_received'
        or (w.unsubscribed_at is not null
            and (coalesce(w.metadata->>'resend_action', '') <> 'contact.unsubscribed'
                 or p_queued_at is null
                 or w.unsubscribed_at >= p_queued_at))
      )
  ) or exists (
    select 1 from public.email_list_unsubscribes u
    where lower(trim(u.email)) = lower(trim(p_email))
      and u.list = p_list
      and (p_queued_at is null or u.unsubscribed_at >= p_queued_at)
  );
$fn$;

create or replace function public.reopen_series_on_signup(p_email text, p_series text, p_band text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_list    text;
  v_removed integer := 0;
begin
  v_list := case p_series when 'free_week' then 'homeschool' when 'quiz' then 'constitution'
                          when 'advent_2026' then 'homeschool' end;
  if v_list is null then
    raise exception 'reopen_series_on_signup: unknown series %', p_series;
  end if;
  if p_series = 'free_week' and coalesce(p_band, '') not in ('sprouts', 'seedlings') then
    raise exception 'reopen_series_on_signup: free_week needs band sprouts or seedlings, got %', p_band;
  end if;
  if v_email = '' then
    return jsonb_build_object('action', 'none', 'reason', 'no email');
  end if;

  -- Advent: the latest sign-up is what advent_back compares against.
  if p_series = 'advent_2026' then
    update public.seasonal_optins set last_optin_at = now()
     where lower(trim(email)) = v_email and series = 'advent_2026';
  end if;

  if not exists (select 1 from public.email_list_unsubscribes u where lower(trim(u.email)) = v_email and u.list = v_list)
     and not exists (select 1 from public.waitlist_signups w where lower(trim(w.email)) = v_email and w.unsubscribed_at is not null)
  then
    return jsonb_build_object('action', 'none');
  end if;

  -- Signed up just now, so newer than any earlier voluntary opt-out: only a hard block can still stop it.
  if public.email_send_blocked(v_email, v_list, now()) then
    return jsonb_build_object('action', 'blocked');
  end if;

  if p_series = 'free_week' then
    delete from public.magnet_email_queue
     where lower(trim(recipient_email)) = v_email and band = p_band
       and status = 'cancelled' and error_message ilike '%unsubscribed%';
    get diagnostics v_removed = row_count;
  elsif p_series = 'quiz' then
    delete from public.nurture_email_queue
     where lower(trim(recipient_email)) = v_email
       and status = 'cancelled' and error_message ilike '%unsubscribed%';
    get diagnostics v_removed = row_count;
  end if;

  update public.waitlist_signups
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'returned_after_optout',
           coalesce(metadata->'returned_after_optout', '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object('series', p_series, 'band', p_band, 'at', now(),
                                                     'cleared_cancelled_rows', v_removed)))
   where lower(trim(email)) = v_email;

  return jsonb_build_object('action', 'reopened', 'cleared_cancelled_rows', v_removed,
                            'resend_unsubscribe_off', p_series = 'advent_2026');
end;
$fn$;

create or replace function public.broadcast_audience(p_audience text, p_as_of timestamptz default now())
returns table (email text, first_name text, band text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with et as (
  select lower(trim(w.email)) as email, min(w.created_at) as first_at
  from public.waitlist_signups w
  where w.entry_funnel::text = 'edens_table' and w.email is not null
  group by 1
),
quiz_only as (
  -- Took the quiz, never joined the homeschool list (2026-10-15).
  select lower(trim(w.email)) as email, min(w.created_at) as first_at
  from public.waitlist_signups w
  where w.entry_funnel::text = 'quiz_funnel' and w.email is not null
    and lower(trim(w.email)) not in (select e.email from et e)
  group by 1
),
base as (
  select e.email, e.first_at, true as on_list from et e
  union all
  select q.email, q.first_at, false from quiz_only q
),
optout as (
  select lower(trim(x.email)) as email from public.waitlist_signups x where x.unsubscribed_at is not null
  union
  select lower(trim(u.email)) from public.email_list_unsubscribes u where u.list = 'homeschool'
  union
  -- NEW: a quiz-only person who left the quiz emails left the only list they joined.
  select lower(trim(u.email)) from public.email_list_unsubscribes u
  where u.list = 'constitution' and lower(trim(u.email)) in (select q.email from quiz_only q)
),
internal as (
  select lower(trim(t.email)) as email from public.internal_testers t
),
buyers as (
  select lower(trim(o.customer_email)) as email,
    bool_or(o.lookup_key in ('sprouts_starter_unit', 'sprouts_print_set', 'both_bands_print_set')) as owns_sprouts,
    bool_or(o.lookup_key in ('seedlings_starter_unit', 'seedlings_print_set', 'both_bands_print_set')) as owns_seedlings
  from public.orders o
  where o.payment_status = 'paid'
    and o.customer_email is not null
    and coalesce(o.lookup_key, '') not in ('deep_dive_guide', 'bte_paperback_digital', 'bte_paperback_print')
  group by 1
),
kit as (
  -- Kit families: list-announce leaves out everyone on preorder_broadcast_list, every campaign.
  select distinct lower(trim(k.customer_email)) as email from public.preorder_broadcast_list k where k.customer_email is not null
),
eng as (
  select lower(e.recipient) as email,
    bool_or(e.event_type = 'clicked'
      and (coalesce(e.raw->'data'->'click'->>'link', e.clicked_url) ilike any (array['%freebies%', '%.pdf%', '%week-1%']))) as used_free_week,
    max(e.inserted_at) filter (where e.event_type = 'opened'
      or (e.event_type = 'clicked' and coalesce(e.raw->'data'->'click'->>'link', e.clicked_url, '') not ilike '%unsubscribe%')) as last_engaged,
    -- list-announce's dormant test counts ANY open or click (event time = inserted_at).
    max(e.inserted_at) filter (where e.event_type in ('opened', 'clicked')) as last_any
  from public.email_events e
  where e.recipient is not null
  group by 1
),
bands as (
  select lower(m.recipient_email) as email, bool_or(m.band = 'sprouts') as s, bool_or(m.band = 'seedlings') as d
  from public.magnet_email_queue m
  group by 1
),
asked as (
  -- Families the Day 7 check-in has already asked "How did the ... week go?" (live since PR
  -- #576, 2026-09-24 19:16 CDT, so sends from 2026-09-25 00:00 UTC on), plus check-ins still
  -- pending, which will have gone out before any catch-up note does.
  select distinct lower(m.recipient_email) as email
  from public.magnet_email_queue m
  where m.sequence_position = 2
    and (m.status = 'pending' or (m.status = 'sent' and m.sent_at >= timestamptz '2026-09-25 00:00:00+00'))
),
names as (
  -- The homeschool-list name first, then (NEW) the quiz name for quiz-only people.
  select distinct on (lower(trim(w.email))) lower(trim(w.email)) as email, nullif(trim(w.first_name), '') as first_name
  from public.waitlist_signups w
  where w.entry_funnel::text in ('edens_table', 'quiz_funnel') and w.email is not null
  order by lower(trim(w.email)), (w.entry_funnel::text <> 'edens_table'), w.created_at
),
-- NEW 2026-11-17 (area 8 U3, founder tap "Let them back in"): an Advent opt-in made AFTER the family's
-- last voluntary opt-out brings them back for Advent only. A hard bounce, a spam complaint, a deleted
-- contact, or any opt-out newer than their last Advent sign-up still keeps them out
-- (public.email_send_blocked). Every other audience is unaffected: this only widens advent_2026.
advent_back as (
  select lower(trim(o.email)) as email
  from public.seasonal_optins o
  where o.series = 'advent_2026' and o.email is not null
    and not public.email_send_blocked(o.email, 'homeschool', o.last_optin_at)
),
list as (
  select b.email, b.first_at, b.on_list, n.first_name,
    case when coalesce(bd.s, false) and coalesce(bd.d, false) then 'both'
         when coalesce(bd.s, false) then 'sprouts'
         when coalesce(bd.d, false) then 'seedlings'
         else 'none' end as band,
    coalesce(g.used_free_week, false) as used_free_week,
    g.last_engaged,
    g.last_any,
    (cb.email is not null) as buyer,
    coalesce(cb.owns_sprouts, false) as owns_sprouts,
    coalesce(cb.owns_seedlings, false) as owns_seedlings,
    (k.email is not null) as kit,
    (a.email is not null) as asked
  from base b
  left join names n using (email)
  left join bands bd using (email)
  left join eng g using (email)
  left join buyers cb using (email)
  left join kit k using (email)
  left join asked a using (email)
  where (b.email not in (select o.email from optout o where o.email is not null)
         or (p_audience = 'advent_2026' and b.email in (select a.email from advent_back a)))
    and b.email not in (select i.email from internal i where i.email is not null)
    and b.email not like '%@example.test'
    and b.email not like '%@edeninstitute.health'
),
-- NEW 2026-11-17: opt-in seasonal series (Plants of the Nativity).
seasonal as (
  select lower(trim(o.email)) as email, o.series from public.seasonal_optins o where o.email is not null
),
picked as (
  select l.email, l.first_name, l.band
  from list l
  where case
  -- The whole list (Thanksgiving, Christmas): buyers, kit families, new families and the
  -- 90-day quiet readers all included. Opt-outs, testers and test addresses are out above.
  when p_audience = 'everyone' then true
  -- NEW 2026-11-17: Advent opt-ins only, kit families included (they asked for it).
  when p_audience = 'advent_2026' then l.email in (select s.email from seasonal s where s.series = 'advent_2026')
  -- Every other audience leaves kit families out, as list-announce does.
  when l.kit then false
  -- NEW: the catch-up notes are about the free week, so homeschool-list families only.
  when p_audience like 'catchup_%' and not l.on_list then false
  else case p_audience
  when 'catchup_used_sprouts' then not l.buyer and not l.asked and l.first_at < p_as_of - interval '12 days' and l.used_free_week and l.band = 'sprouts'
  when 'catchup_used_seedlings' then not l.buyer and not l.asked and l.first_at < p_as_of - interval '12 days' and l.used_free_week and l.band = 'seedlings'
  when 'catchup_used_both' then not l.buyer and not l.asked and l.first_at < p_as_of - interval '12 days' and l.used_free_week and l.band in ('both', 'none')
  when 'catchup_unused' then not l.buyer and not l.asked and l.first_at < p_as_of - interval '12 days' and not l.used_free_week and l.last_engaged is not null
  when 'catchup_quiet' then not l.buyer and not l.asked and l.first_at < p_as_of - interval '12 days' and not l.used_free_week and l.last_engaged is null
  when 'weekly' then not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  when 'weekly_skip_sprouts_owners' then not l.owns_sprouts
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  when 'weekly_skip_seedlings_owners' then not l.owns_seedlings
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  else false
  end
  end
)
select p.email, p.first_name, p.band from picked p
union all
-- NEW 2026-10-16 (founder: "I want to receive the emails as well to hello so I can watch as they
-- come in"): the founder address from app_settings gets a copy of every Friday Broadcast, in every
-- audience, whatever its own opt-out rows say. Never a second copy if it is already in the audience.
select f.email, 'Camila', 'none'
from (select distinct lower(trim(s.founder_email)) as email from public.app_settings s
      where nullif(trim(s.founder_email), '') is not null) f
where p_audience in ('everyone', 'weekly', 'weekly_skip_sprouts_owners', 'weekly_skip_seedlings_owners',
                     'catchup_used_sprouts', 'catchup_used_seedlings', 'catchup_used_both',
                     'catchup_unused', 'catchup_quiet', 'advent_2026')
  and not exists (select 1 from picked p where p.email = f.email)
order by 1;
$$;

revoke all on function public.email_send_blocked(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.email_send_blocked(text, text, timestamptz) to service_role;
revoke all on function public.reopen_series_on_signup(text, text, text) from public, anon, authenticated;
grant execute on function public.reopen_series_on_signup(text, text, text) to service_role;
revoke all on function public.broadcast_audience(text, timestamptz) from public, anon, authenticated;
grant execute on function public.broadcast_audience(text, timestamptz) to service_role;
