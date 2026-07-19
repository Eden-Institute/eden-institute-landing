-- Reaching the preorder cohort: manufacturer updates, and FTC-compliant delay notices.
--
-- Two things the system promised but could not do.
--
-- 1. BROADCASTS. The /preorder buy box tells every buyer: "As manufacturing details firm
--    up, we email you. Proofs, print dates, ship dates, and delays if they come. You will
--    never be left wondering." A preorder_broadcast_list view was built for exactly this
--    and nothing has ever read it: there was no send path. During a four-month wait these
--    updates, not the shipping emails, are what keep refunds and chargebacks low.
--
-- 2. DELAY NOTICES. 16 CFR 435.2(b) is not optional once money is taken up front. If we
--    cannot ship by the stated date we must, ON OR BEFORE that date, offer every buyer a
--    definite revised date and a free way to cancel for a full refund. The consequences
--    turn on how far we slip:
--      - 30 days or less  -> silence counts as CONSENT (opt out)
--      - more than 30 days, indefinite, or ANY second notice
--                         -> silence counts as CANCELLATION (opt in). Every buyer who
--                            does not affirmatively reply must be refunded.
--    That is unrunnable without per-order records of what was sent and who replied, which
--    is what order_delay_notices is. Retrofitting it mid-slip, under time pressure, with
--    money already spent, is the scenario this table exists to prevent.

begin;

-- ── 1. Broadcasts ───────────────────────────────────────────────────────────

create type public.broadcast_kind as enum ('update', 'delay_notice');

create table public.broadcasts (
  id             uuid primary key default gen_random_uuid(),
  kind           public.broadcast_kind not null default 'update',
  subject        text not null,
  body_markdown  text not null,
  -- Snapshot of the rendered HTML actually sent. Kept because a delay notice is
  -- legal evidence: it must be possible to prove exactly what each buyer was told.
  body_html      text,
  -- Delay notices only. NULL revised date = "we cannot yet give a definite date",
  -- which 435.2(a)(3) permits only with a reason, and which always requires opt-in.
  revised_ship_date date,
  -- True when silence must be treated as cancellation rather than consent.
  requires_opt_in   boolean not null default false,
  sent_at        timestamptz,
  sent_count     integer not null default 0,
  failed_count   integer not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);

comment on table public.broadcasts is
  'One row per manufacturer update or delay notice sent to the preorder cohort. '
  'body_html is the rendered snapshot, retained as evidence for delay notices.';

alter table public.broadcasts enable row level security;
-- No policies: written by the founder-broadcast EF (service role) only.

-- ── 2. Per-order delay-notice records ───────────────────────────────────────
--
-- One row per (order, notice). notice_number distinguishes the first notice from
-- subsequent ones, because the rule treats them differently: a second notice can
-- never rely on silence.

create table public.order_delay_notices (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  broadcast_id   uuid not null references public.broadcasts(id) on delete cascade,
  notice_number  integer not null check (notice_number >= 1),
  -- Copied from the broadcast so the per-order record is self-contained evidence
  -- even if the broadcast row is later edited.
  revised_ship_date date,
  requires_opt_in   boolean not null,
  sent_at        timestamptz not null default now(),
  -- The buyer's answer. NULL = no response yet, which MEANS DIFFERENT THINGS
  -- depending on requires_opt_in, and that is the whole point of storing it.
  responded_at   timestamptz,
  response       text check (response in ('consented', 'cancelled')),
  -- Set when a no-response opt-in notice was resolved by auto-cancellation, so the
  -- refund is auditable and cannot be run twice.
  auto_cancelled_at timestamptz,
  unique (order_id, broadcast_id)
);

comment on table public.order_delay_notices is
  'Per-order evidence for 16 CFR 435.2(b). response NULL means no reply yet; whether '
  'that counts as consent or cancellation depends on requires_opt_in.';

create index order_delay_notices_order_idx on public.order_delay_notices (order_id);
-- Drives the "who has not answered an opt-in notice" sweep.
create index order_delay_notices_pending_idx
  on public.order_delay_notices (requires_opt_in, responded_at)
  where requires_opt_in and responded_at is null and auto_cancelled_at is null;

alter table public.order_delay_notices enable row level security;
-- No policies: EF (service role) only. Buyers respond through a signed token, not a session.

-- ── 3. Outstanding opt-in notices ───────────────────────────────────────────
--
-- The list the founder must act on: buyers who were sent an opt-in delay notice,
-- have not answered, and whose 30-day response window has closed. Under
-- 435.2(b)(1)(iii) these orders are deemed cancelled and must be refunded WITHOUT
-- the customer asking.

create or replace function public.delay_notices_awaiting_action()
returns table (
  order_id uuid,
  customer_email text,
  amount_total_cents integer,
  notice_sent_at timestamptz,
  days_since_notice integer
)
language sql
stable
set search_path = public
as $$
  select
    o.id,
    o.customer_email,
    o.amount_total_cents,
    n.sent_at,
    extract(day from now() - n.sent_at)::integer
  from order_delay_notices n
  join orders o on o.id = n.order_id
  where n.requires_opt_in
    and n.responded_at is null
    and n.auto_cancelled_at is null
    and n.sent_at < now() - interval '30 days'
    and o.status not in ('cancelled', 'refunded')
  order by n.sent_at;
$$;

revoke all on function public.delay_notices_awaiting_action() from public, anon, authenticated;
grant execute on function public.delay_notices_awaiting_action() to service_role;

commit;
