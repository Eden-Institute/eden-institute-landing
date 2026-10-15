-- 2026-10-15, founder rule "every event gets 3 or 4 emails, then everyone is on the shared
-- Friday list" (plan: Eden's Table > Projects > Email Journeys and Nurture >
-- Email_Lifecycle_Plan_2026-10-15). Copy approved in her inbox 2026-10-15
-- (scripts/email_proofs/2026-10-15 in the ops folder).
--
-- 1. public.children_at_home_answers: the day-2 "Do you have children at home?" tap from the
--    quiz and Back to Eden Chapter 1 tracks (children-answer edge function). One row per
--    email, the latest answer wins. Only a Yes gets the day-6 Eden's Table email.
-- 2. public.followup_email_queue: the Chapter 1 track (days 2, 4, 6; enqueued by
--    resend-waitlist) and the refund note (3 days after a full refund; enqueued by the
--    trigger below). Drained by nurture-emails with the same backoff columns as the other
--    queues. One refund note per person, ever.
-- 3. trg_enqueue_refund_note on public.orders: a full refund (status turns 'refunded')
--    queues the note. Wrapped so a failure here can never fail the order update itself.
-- 4. cancel_queued_emails_on_unsubscribe also cancels pending followup rows on a global
--    unsubscribe or bounce.
-- 5. public.broadcast_audience: quiz-only people (quiz_funnel, never on the homeschool list)
--    join the Friday audiences 7 days after the quiz, unless they opted out of the quiz
--    emails (founder 2026-10-15: "Yes, all 49"); anyone partway through the quiz or Chapter 1
--    track skips the weekly Friday until it ends; the catch-up audiences stay homeschool-list
--    only. 'everyone' keeps its 2026-10-14 meaning (the whole list, new people included).
--
-- RLS on, no policies: service role only, like every queue. Idempotent.

-- ── 1. children_at_home_answers ──
create table if not exists public.children_at_home_answers (
  email text primary key,
  has_children boolean not null,
  track text not null check (track in ('quiz', 'back_to_eden_ch1')),
  answered_at timestamptz not null default now()
);
alter table public.children_at_home_answers enable row level security;
comment on table public.children_at_home_answers is
  'Day-2 "Do you have children at home?" answers from the quiz and Back to Eden Chapter 1 tracks (children-answer EF). Lowercased email; latest answer wins. Service role only.';

-- ── 2. followup_email_queue ──
create table if not exists public.followup_email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  first_name text,
  track text not null check (track in ('back_to_eden_ch1', 'refund_note')),
  sequence_position smallint not null check (sequence_position between 1 and 4),
  order_id uuid references public.orders(id) on delete set null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  first_failed_at timestamptz,
  gave_up_at timestamptz,
  founder_alerted_at timestamptz,
  constraint followup_email_queue_one_per_step unique (recipient_email, track, sequence_position)
);
create index if not exists followup_email_queue_due_idx on public.followup_email_queue (status, scheduled_for);
alter table public.followup_email_queue enable row level security;
comment on table public.followup_email_queue is
  'Back to Eden Chapter 1 track (positions 2-4) and the refund note (position 1, 3 days after a full refund). Drained by nurture-emails. Service role only.';

-- ── 3. refund note trigger ──
create or replace function public.enqueue_refund_note()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' and new.customer_email is not null then
    begin
      insert into public.followup_email_queue (recipient_email, track, sequence_position, order_id, scheduled_for)
      values (lower(trim(new.customer_email)), 'refund_note', 1, new.id, now() + interval '3 days')
      on conflict (recipient_email, track, sequence_position) do nothing;
    exception when others then
      -- Never fail the refund itself over a follow-up note.
      raise warning 'enqueue_refund_note failed for order %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_refund_note on public.orders;
create trigger trg_enqueue_refund_note
  after update of status on public.orders
  for each row execute function public.enqueue_refund_note();

-- ── 4. global unsubscribe / bounce cancels the new queue too ──
create or replace function public.cancel_queued_emails_on_unsubscribe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.unsubscribed_at is not null and old.unsubscribed_at is null then
    update public.magnet_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);

    update public.nurture_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);

    update public.launch_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);

    update public.followup_email_queue
       set status = 'cancelled',
           error_message = left(coalesce(error_message,'') ||
             ' [auto-cancelled '||now()::text||': recipient unsubscribed/bounced]', 500),
           updated_at = now()
     where status = 'pending'
       and lower(recipient_email) = lower(new.email);
  end if;
  return new;
end;
$$;

-- ── 5. broadcast_audience ──
-- Replaces 20261015020000 in place; grants unchanged. Changes, all marked NEW:
--   base also takes quiz-only people; their opt-out includes the quiz (constitution) list;
--   their hold is 7 days from the quiz (the 4 quiz emails run 6 days); anyone with a pending
--   quiz or Chapter 1 email (mid_track) skips the weekly audiences; catch-up = homeschool list only.
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
  -- NEW 2026-10-15: took the quiz, never joined the homeschool list.
  select lower(trim(w.email)) as email, min(w.created_at) as first_at
  from public.waitlist_signups w
  where w.entry_funnel::text = 'quiz_funnel' and w.email is not null
    and lower(trim(w.email)) not in (select e.email from et e)
  group by 1
),
base as (
  select e.email, e.first_at, true as on_list, e.first_at + interval '12 days' as hold_until from et e
  union all
  select q.email, q.first_at, false, q.first_at + interval '7 days' from quiz_only q
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
mid_track as (
  -- NEW: partway through the quiz or Chapter 1 track. They skip the weekly Friday until it ends.
  select distinct lower(trim(n.recipient_email)) as email from public.nurture_email_queue n where n.status = 'pending'
  union
  select lower(trim(f.recipient_email)) from public.followup_email_queue f
  where f.status = 'pending' and f.track = 'back_to_eden_ch1'
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
  select b.email, b.first_at, b.on_list, b.hold_until, n.first_name,
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
    (a.email is not null) as asked,
    (mt.email is not null) as mid_track
  from base b
  left join names n using (email)
  left join bands bd using (email)
  left join eng g using (email)
  left join buyers cb using (email)
  left join kit k using (email)
  left join asked a using (email)
  left join mid_track mt using (email)
  where b.email not in (select o.email from optout o where o.email is not null)
    and b.email not in (select i.email from internal i where i.email is not null)
    and b.email not like '%@example.test'
    and b.email not like '%@edeninstitute.health'
)
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
  when 'weekly' then l.hold_until < p_as_of and not l.mid_track
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  when 'weekly_skip_sprouts_owners' then not l.owns_sprouts and l.hold_until < p_as_of and not l.mid_track
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  when 'weekly_skip_seedlings_owners' then not l.owns_seedlings and l.hold_until < p_as_of and not l.mid_track
    and not (l.first_at < p_as_of - interval '90 days' and (l.last_any is null or l.last_any < p_as_of - interval '90 days'))
  else false
  end
end
order by l.email;
$$;

revoke all on function public.broadcast_audience(text, timestamptz) from public, anon, authenticated;
grant execute on function public.broadcast_audience(text, timestamptz) to service_role;
