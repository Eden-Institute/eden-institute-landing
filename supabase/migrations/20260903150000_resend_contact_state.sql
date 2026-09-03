-- Resend contact properties: the Postgres side.
--
-- WHY. Resend held exactly one fact about each of ~1,600 contacts, membership in
-- the "Eden Institute Waitlist" segment. Behaviour-based segments and any future
-- automation need funnel, band, purchase state, quiz state and engagement ON the
-- contact. Those facts already live here, spread over five tables, so this
-- migration gives them ONE computed home (a view) and ONE record of what Resend
-- was last told (a table). The contact-properties-sync edge function reads the
-- view, diffs it against the table, and PATCHes only the contacts whose state
-- changed. Postgres stays the source of truth; Resend is a projection of it.
--
-- WHY A VIEW AND NOT COLUMNS. Every value below is derivable from rows that
-- already exist, and each of them can change without any signup code running
-- (an order is refunded, a quiz is taken later, sixty days pass). A stored
-- column would drift; the view cannot.
--
-- VALUE DEFINITIONS (mirrored in _shared/resend-contacts.ts, keep them in step):
--   funnel           entry_funnel, resolved edens_table > quiz_funnel > any other
--   band             from magnet_email_queue.band (both/sprouts/seedlings), else
--                    waitlist_signups.source, else 'none'
--   purchase_status  preordered (a live kit preorder) > purchased (a live
--                    non-preorder order, e.g. Starter Unit / Deep-Dive Guide) > none
--   founding         'true' if any live order line is_founding
--   quiz_status      completed if a quiz_completions row exists, else none
--   engagement_tier  hot (<14d) / warm (<60d) / new (no events, joined <60d) / cold
--
-- Only reachable contacts are computed: waitlist_signups.unsubscribed_at IS NULL.
-- A globally unsubscribed or bounced address never gets a property write.

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

comment on view public.resend_contact_state_computed is
  'One row per reachable contact with the six Resend contact properties derived from waitlist_signups, magnet_email_queue, orders/order_items, quiz_completions and email_events. Read by contact-properties-sync and stripe-webhook. Service role only.';

revoke all on public.resend_contact_state_computed from anon, authenticated;

-- What Resend was last told, per contact. state_hash is the six values joined
-- with '|'; the sync PATCHes a contact only when the computed hash differs.
create table if not exists public.resend_contact_state (
  email            text primary key,
  funnel           text,
  band             text,
  purchase_status  text,
  founding         text,
  quiz_status      text,
  engagement_tier  text,
  state_hash       text not null,
  synced_at        timestamptz not null default now(),
  last_status      integer,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.resend_contact_state is
  'Last state written to each Resend contact by contact-properties-sync. A failed write keeps a FAILED: hash so it is retried next run. Health check: select count(*) where synced_at > now() - interval ''2 days'' must be non-zero.';

alter table public.resend_contact_state enable row level security;
revoke all on public.resend_contact_state from anon, authenticated;

drop trigger if exists resend_contact_state_updated_at on public.resend_contact_state;
create trigger resend_contact_state_updated_at
  before update on public.resend_contact_state
  for each row execute function public.set_updated_at();

create index if not exists resend_contact_state_synced_idx
  on public.resend_contact_state (synced_at);
