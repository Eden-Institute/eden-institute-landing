-- Ad Studio: per-day call ceilings on the money-spending edge functions.
--
-- studio-generate (multi-model copy + judge) and studio-image (Gemini) call
-- PAID providers on every request. Access is founder-only, enforced three ways,
-- but a stolen or replayed founder session would otherwise be an unbounded spend
-- amplifier: nothing caps how many times it can loop a generation. This adds a
-- per-UTC-day ceiling per endpoint.
--
-- The edge function FAILS OPEN if this counter is unavailable (RPC missing, DB
-- blip): a rate-limit outage must never block the founder's legitimate work. The
-- ceiling exists to bound a compromised session, not to gate normal use, so the
-- caps are set generously and are overridable per environment.

create table if not exists public.studio_rate_limits (
  user_id     uuid not null references auth.users(id) on delete cascade,
  window_date date not null default (now() at time zone 'utc')::date,
  endpoint    text not null,
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, window_date, endpoint)
);

comment on table public.studio_rate_limits is
  'Per-UTC-day request counters for the founder-only /studio AI edge functions. Written only by studio_rate_bump() (SECURITY DEFINER); RLS on with NO policies, so no client session can read the counts or forge a row.';

alter table public.studio_rate_limits enable row level security;
-- Deliberately no policies: reachable only through studio_rate_bump() below.

-- Atomic increment for today's (caller, endpoint) counter, returning the new
-- count. SECURITY DEFINER so it can write the RLS-protected table, but it
-- self-guards on is_founder() and only ever touches auth.uid()'s own row, so a
-- direct client call cannot inflate anyone else's quota (or read the table).
create or replace function public.studio_rate_bump(p_endpoint text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_founder() then
    raise exception 'not authorized';
  end if;

  insert into public.studio_rate_limits (user_id, endpoint, count)
    values (auth.uid(), p_endpoint, 1)
  on conflict (user_id, window_date, endpoint)
    do update set count = studio_rate_limits.count + 1, updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.studio_rate_bump(text) from public, anon;
grant execute on function public.studio_rate_bump(text) to authenticated;
