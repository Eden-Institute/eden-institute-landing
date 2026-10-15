-- 2026-10-14, founder decision: list emails move to Resend Broadcasts from Fri Oct 30.
-- A Broadcast goes to one Resend segment. Each Broadcast's audience is computed HERE, by name,
-- with the same rules list-announce uses, and broadcast-stage copies exactly that set into a
-- Resend segment (recording every add in broadcast_stage_members). Opt-outs are excluded here
-- AND pushed to Resend as unsubscribed by contact-properties-sync (two layers).
--
-- Audiences:
--   catchup_used_sprouts | catchup_used_seedlings | catchup_used_both
--       Oct 30 note 1: clicked a free-week download link; band decides the plant named.
--   catchup_unused   Oct 30 note 2: opened an email since July, never clicked a free-week link.
--   catchup_quiet    Oct 30 note 3: no open or real click since tracking began (2026-07-01).
--     All three: no curriculum buyers (any paid order but the Deep-Dive Guide and the Back to
--     Eden books), no family in its first 12 days (still in the welcome series).
--   weekly                        the Friday list email, list-announce's rules: no family in its
--   weekly_skip_sprouts_owners    first 12 days, and the 90-day quiet pause (joined 90+ days ago
--   weekly_skip_seedlings_owners  and no open/click in 90 days). The skip_ variants also leave
--                                 out owners of the band the email sells (nurture-emails'
--                                 BAND_OWNER_KEYS).
-- Everywhere: homeschool funnel only; no global unsubscribe, bounce or complaint; no per-list
-- homeschool opt-out; no kit family (preorder_broadcast_list); no internal testers,
-- @edeninstitute.health or @example.test addresses (the founder sees every email as a proof).
-- Unknown audience names return nothing. Service role only.

create or replace function public.broadcast_audience(p_audience text, p_as_of timestamptz default now())
returns table (email text, first_name text, band text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with base as (
  select lower(trim(w.email)) as email, min(w.created_at) as first_at
  from public.waitlist_signups w
  where w.entry_funnel::text = 'edens_table' and w.email is not null
  group by 1
),
optout as (
  select lower(trim(x.email)) as email from public.waitlist_signups x where x.unsubscribed_at is not null
  union
  select lower(trim(u.email)) from public.email_list_unsubscribes u where u.list = 'homeschool'
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
names as (
  select distinct on (lower(trim(w.email))) lower(trim(w.email)) as email, nullif(trim(w.first_name), '') as first_name
  from public.waitlist_signups w
  where w.entry_funnel::text = 'edens_table' and w.email is not null
  order by lower(trim(w.email)), w.created_at
),
list as (
  select b.email, b.first_at, n.first_name,
    case when coalesce(bd.s, false) and coalesce(bd.d, false) then 'both'
         when coalesce(bd.s, false) then 'sprouts'
         when coalesce(bd.d, false) then 'seedlings'
         else 'none' end as band,
    coalesce(g.used_free_week, false) as used_free_week,
    g.last_engaged,
    g.last_any,
    (cb.email is not null) as buyer,
    coalesce(cb.owns_sprouts, false) as owns_sprouts,
    coalesce(cb.owns_seedlings, false) as owns_seedlings
  from base b
  left join names n using (email)
  left join bands bd using (email)
  left join eng g using (email)
  left join buyers cb using (email)
  where b.email not in (select o.email from optout o where o.email is not null)
    and b.email not in (select k.email from kit k)
    and b.email not in (select i.email from internal i where i.email is not null)
    and b.email not like '%@example.test'
    and b.email not like '%@edeninstitute.health'
)
select l.email, l.first_name, l.band
from list l
where case p_audience
  when 'catchup_used_sprouts' then not l.buyer and l.first_at < p_as_of - interval '12 days' and l.used_free_week and l.band = 'sprouts'
  when 'catchup_used_seedlings' then not l.buyer and l.first_at < p_as_of - interval '12 days' and l.used_free_week and l.band = 'seedlings'
  when 'catchup_used_both' then not l.buyer and l.first_at < p_as_of - interval '12 days' and l.used_free_week and l.band in ('both', 'none')
  when 'catchup_unused' then not l.buyer and l.first_at < p_as_of - interval '12 days' and not l.used_free_week and l.last_engaged is not null
  when 'catchup_quiet' then not l.buyer and l.first_at < p_as_of - interval '12 days' and not l.used_free_week and l.last_engaged is null
  when 'weekly' then l.first_at < p_as_of - interval '12 days'
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  when 'weekly_skip_sprouts_owners' then not l.owns_sprouts and l.first_at < p_as_of - interval '12 days'
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  when 'weekly_skip_seedlings_owners' then not l.owns_seedlings and l.first_at < p_as_of - interval '12 days'
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  else false
end
order by l.email;
$$;

revoke all on function public.broadcast_audience(text, timestamptz) from public, anon, authenticated;
grant execute on function public.broadcast_audience(text, timestamptz) to service_role;

-- One row per contact broadcast-stage added (or could not add) to a Broadcast's segment, so
-- staging is resumable and never adds twice. Service role only: RLS on, no policies.
create table if not exists public.broadcast_stage_members (
  segment_name text not null,
  email text not null,
  status text not null check (status in ('added', 'created', 'absent', 'failed')),
  http_status integer,
  error text,
  staged_at timestamptz not null default now(),
  primary key (segment_name, email)
);

alter table public.broadcast_stage_members enable row level security;

comment on table public.broadcast_stage_members is
  'broadcast-stage log: each contact put in a Resend Broadcast segment (added, or created as a new Resend contact), one Resend cannot hold (absent: malformed address), or one that failed and is retried on the next stage call. Service role only.';
