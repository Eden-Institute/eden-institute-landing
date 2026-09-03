-- Exclude synthetic test addresses from the Resend contact-state projection.
--
-- The first backfill (2026-09-03) tried to create Resend contacts for two
-- anon-*@example.test rows left by automated tests; Resend rejects the domain
-- (422) on every run, so they would otherwise be retried nightly forever.
-- Same body as 20260903150000 with one extra predicate on reachable.

create or replace view public.resend_contact_state_computed
with (security_invoker = true) as
with reachable as (
  select
    lower(email)                                  as email,
    min(entered_at)                               as entered_at,
    min(first_name) filter (where nullif(btrim(first_name), '') is not null) as first_name,
    bool_or(entry_funnel = 'edens_table')         as has_edens,
    bool_or(entry_funnel = 'quiz_funnel')         as has_quiz,
    min(entry_funnel::text)                       as any_funnel,
    bool_or(source = 'sprouts_magnet')            as src_sprouts,
    bool_or(source = 'seedlings_magnet')          as src_seedlings
  from public.waitlist_signups
  where unsubscribed_at is null
    and email not ilike '%@example.test'
  group by 1
),
bands as (
  select lower(recipient_email) as email,
         bool_or(band = 'sprouts')   as s,
         bool_or(band = 'seedlings') as d
  from public.magnet_email_queue
  group by 1
),
live_orders as (
  select lower(o.customer_email) as email,
         bool_or(o.is_preorder and o.status not in ('cancelled', 'refunded'))                          as preordered,
         bool_or((not o.is_preorder) and o.status not in ('cancelled', 'refunded'))                    as purchased,
         bool_or(coalesce(oi.is_founding, false) and o.status not in ('cancelled', 'refunded'))        as founding
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  where o.customer_email is not null
  group by 1
),
quiz as (
  select lower(email) as email from public.quiz_completions group by 1
),
eng as (
  select lower(recipient) as email, max(occurred_at) as last_any
  from public.email_events
  where recipient is not null
  group by 1
)
select
  r.email,
  r.first_name,
  case when r.has_edens then 'edens_table'
       when r.has_quiz  then 'quiz_funnel'
       else r.any_funnel end                                              as funnel,
  case when coalesce(b.s, false) and coalesce(b.d, false) then 'both'
       when coalesce(b.s, false) then 'sprouts'
       when coalesce(b.d, false) then 'seedlings'
       when r.src_sprouts and r.src_seedlings then 'both'
       when r.src_sprouts then 'sprouts'
       when r.src_seedlings then 'seedlings'
       else 'none' end                                                    as band,
  case when coalesce(lo.preordered, false) then 'preordered'
       when coalesce(lo.purchased, false)  then 'purchased'
       else 'none' end                                                    as purchase_status,
  case when coalesce(lo.founding, false) then 'true' else 'false' end    as founding,
  case when q.email is not null then 'completed' else 'none' end         as quiz_status,
  case when e.last_any >= now() - interval '14 days' then 'hot'
       when e.last_any >= now() - interval '60 days' then 'warm'
       when e.last_any is null and r.entered_at >= now() - interval '60 days' then 'new'
       else 'cold' end                                                    as engagement_tier
from reachable r
left join bands       b  using (email)
left join live_orders lo using (email)
left join quiz        q  using (email)
left join eng         e  using (email);

revoke all on public.resend_contact_state_computed from anon, authenticated;

-- Drop the two poisoned state rows so they stop counting as failures.
delete from public.resend_contact_state where email ilike '%@example.test';
