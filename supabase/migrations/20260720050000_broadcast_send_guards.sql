-- Guards for the one endpoint that can create legal liability by being called twice.
--
-- founder-broadcast mails every live preorder buyer. In `delay` mode it also inserts an
-- order_delay_notices row per order, and requiresOptIn() treats ANY second notice to the
-- same order as opt-in, where silence legally equals cancellation (16 CFR 435.2(b)).
--
-- So a duplicate send is not a duplicate email. It converts the entire buyer book into
-- orders that are deemed cancelled and owed refunds 30 days later. That is reachable by a
-- stolen session, and just as reachable by a double-click, a retried fetch, or a browser
-- back-navigation. Before this migration the only guard was a window.confirm() in the
-- browser.

begin;

-- ── Idempotency ─────────────────────────────────────────────────────────────
--
-- The client mints a key per composed message. Retrying the same message returns the
-- original broadcast instead of sending again. Partial index because historical rows
-- have no key and must stay valid.

alter table public.broadcasts
  add column idempotency_key text;

comment on column public.broadcasts.idempotency_key is
  'Client-generated per composed message. Unique among non-null values, so a retry of the '
  'same send collides here rather than mailing the cohort twice.';

create unique index broadcasts_idempotency_key_uidx
  on public.broadcasts (idempotency_key)
  where idempotency_key is not null;

-- ── Rate limit ──────────────────────────────────────────────────────────────
--
-- Deliberately NOT the checkout limiter. Two differences that matter:
--
--   1. Keyed on the authenticated user, not on IP. This endpoint is founder-only, so the
--      actor is known; IP would be both weaker and noisier.
--   2. FAILS CLOSED. checkout-rate-limit.ts fails open, correctly, because blocking a
--      real buyer on launch morning costs more than the abuse it prevents. Here the
--      asymmetry runs the other way: a refused send is a button pressed again in a
--      minute, while an unintended send is mass refund liability that cannot be undone.

create table public.broadcast_rate_limits (
  actor_key         text primary key,
  window_started_at timestamptz not null default now(),
  count             integer     not null default 0
);

alter table public.broadcast_rate_limits enable row level security;
-- No policies: service-role only.

comment on table public.broadcast_rate_limits is
  'Send-attempt counter for founder-broadcast, keyed on auth user id. Fails closed.';

create or replace function public.broadcast_rate_bump(
  p_key text,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.broadcast_rate_limits (actor_key, window_started_at, count)
  values (p_key, now(), 1)
  on conflict (actor_key) do update
    set count = case
                  when public.broadcast_rate_limits.window_started_at
                       < now() - make_interval(secs => p_window_seconds)
                  then 1
                  else public.broadcast_rate_limits.count + 1
                end,
        window_started_at = case
                  when public.broadcast_rate_limits.window_started_at
                       < now() - make_interval(secs => p_window_seconds)
                  then now()
                  else public.broadcast_rate_limits.window_started_at
                end
  returning count into v_count;

  return v_count;
end;
$$;

-- Service role only. Nothing client-side has any business incrementing this, and an
-- attacker who could would use it to exhaust the founder's own budget.
revoke execute on function public.broadcast_rate_bump(text, integer) from public, anon, authenticated;

commit;
