-- Founder-only lead-magnet dashboard data path.
-- Companion to the daily digest (notify-founder-digest). Lock #76 amendment:
-- PII is permitted on the dashboard, but ONLY behind founder auth — enforced
-- server-side by is_founder() inside a SECURITY DEFINER RPC, not by UI gating.
--
-- Applied to production via apply_migration MCP on 2026-05-30 (version
-- 20260530013650). This file is the source-of-truth record; re-running it is a
-- no-op (CREATE OR REPLACE), so a future `supabase db push` is safe.

create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'hello@edeninstitute.health'
$$;

comment on function public.is_founder() is
  'True when the request JWT belongs to the founder account. Gates founder-only '
  'data RPCs (e.g. founder_lead_feed). Extend the allowlist here if more '
  'founder/admin accounts are ever added.';

revoke execute on function public.is_founder() from public;
grant execute on function public.is_founder() to authenticated, service_role;


create or replace function public.founder_lead_feed(
  p_since timestamptz default (now() - interval '90 days')
)
returns table (
  email         text,
  first_name    text,
  funnel        text,
  source        text,
  entered_at    timestamptz,
  source_url    text,
  utm_source    text,
  utm_campaign  text,
  unsubscribed  boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    select
      w.email,
      w.first_name,
      w.entry_funnel::text,
      coalesce(w.source, '(unattributed)'),
      w.entered_at,
      w.source_url,
      w.utm_source,
      w.utm_campaign,
      (w.unsubscribed_at is not null)
    from public.waitlist_signups w
    where w.entered_at >= p_since
    order by w.entered_at desc;
end;
$$;

comment on function public.founder_lead_feed(timestamptz) is
  'Founder-gated lead-magnet feed (includes PII). SECURITY DEFINER; the '
  'is_founder() check is the sole access boundary. Powers the /founder '
  'dashboard. Lock #76 amendment: PII allowed on dashboard behind founder auth.';

revoke execute on function public.founder_lead_feed(timestamptz) from public, anon;
grant execute on function public.founder_lead_feed(timestamptz) to authenticated;
