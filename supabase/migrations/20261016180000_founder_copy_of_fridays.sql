-- 2026-10-16, founder: "I want to receive the emails as well to hello so I can watch as they come
-- in - no need to send me the nurture emails." public.broadcast_audience now adds the founder
-- address (public.app_settings.founder_email) to EVERY Friday Broadcast audience, so hello@ gets
-- each list email the moment families do. Nurture queues are untouched. Everything else is
-- 20261016160000 unchanged; grants unchanged. The hourly refresh (broadcast-stage refresh_due)
-- adds the founder to each scheduled Friday's segment within 26 hours of its send. Idempotent.

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
  where b.email not in (select o.email from optout o where o.email is not null)
    and b.email not in (select i.email from internal i where i.email is not null)
    and b.email not like '%@example.test'
    and b.email not like '%@edeninstitute.health'
),
picked as (
  select l.email, l.first_name, l.band
  from list l
  where case
  -- The whole list (Thanksgiving, Christmas): buyers, kit families, new families and the
  -- 90-day quiet readers all included. Opt-outs, testers and test addresses are out above.
  when p_audience = 'everyone' then true
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
                     'catchup_unused', 'catchup_quiet')
  and not exists (select 1 from picked p where p.email = f.email)
order by 1;
$$;

revoke all on function public.broadcast_audience(text, timestamptz) from public, anon, authenticated;
grant execute on function public.broadcast_audience(text, timestamptz) to service_role;
