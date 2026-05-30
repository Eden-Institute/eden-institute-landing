-- Investor-grade lead data: exclude internal/test traffic from the founder
-- dashboard + daily digest at READ time (retroactive, non-destructive — test
-- rows are kept, just not surfaced).
--
-- Rule: any @edeninstitute.health or @example.com address (internal + synthetic
-- test domains), plus an explicit allowlist of personal tester accounts in
-- public.internal_testers.
--
-- Applied to production via apply_migration MCP (version 20260530030110). File
-- committed for source-of-truth parity; re-run is a no-op.

create table if not exists public.internal_testers (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.internal_testers enable row level security;
-- service_role / SECURITY DEFINER owner only; no anon/authenticated policies.

insert into public.internal_testers (email, note) values
  ('grammarswag@gmail.com',                 'founder personal account'),
  ('coliveira77@hotmail.com',               'founder test account'),
  ('camila@unitedinpurpose.org',            'founder test account'),
  ('camila.oliveira.cont@truplaygames.com', 'founder test account'),
  ('nanjan329@gmail.com',                   'family tester (Naomi)')
on conflict (email) do nothing;

create or replace function public.is_internal_tester(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    lower(p_email) like '%@edeninstitute.health'
    or lower(p_email) like '%@example.com'
    or exists (select 1 from public.internal_testers t where lower(t.email) = lower(p_email)),
  false)
$$;

revoke execute on function public.is_internal_tester(text) from public;
grant execute on function public.is_internal_tester(text) to anon, authenticated, service_role;

comment on function public.is_internal_tester(text) is
  'True for internal/test signups (edeninstitute.health + example.com domains, '
  'plus the internal_testers allowlist). Keeps test traffic out of the founder '
  'dashboard, digest, and public stats. Manage personal tester emails in '
  'public.internal_testers.';


-- founder_lead_feed: exclude testers
create or replace function public.founder_lead_feed(
  p_since timestamptz default (now() - interval '90 days')
)
returns table (
  email text, first_name text, funnel text, source text,
  entered_at timestamptz, source_url text, utm_source text, utm_campaign text, unsubscribed boolean
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
    select w.email, w.first_name, w.entry_funnel::text,
           coalesce(w.source, '(unattributed)'),
           w.entered_at, w.source_url, w.utm_source, w.utm_campaign,
           (w.unsubscribed_at is not null)
    from public.waitlist_signups w
    where w.entered_at >= p_since
      and not public.is_internal_tester(w.email)
    order by w.entered_at desc;
end;
$$;


-- lead_capture_digest_window: exclude testers from the daily email
create or replace function public.lead_capture_digest_window(
  p_window_start timestamptz,
  p_window_end   timestamptz
)
returns table (
  email text, first_name text, funnel text, source text,
  entered_at timestamptz, source_url text, utm_source text, utm_campaign text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select email, first_name, entry_funnel::text, coalesce(source, '(unattributed)'),
         entered_at, source_url, utm_source, utm_campaign
  from public.waitlist_signups
  where entered_at >= p_window_start
    and entered_at <  p_window_end
    and not public.is_internal_tester(email)
  order by entered_at desc
$$;
revoke execute on function public.lead_capture_digest_window(timestamptz, timestamptz) from public;
grant  execute on function public.lead_capture_digest_window(timestamptz, timestamptz) to service_role;


-- v_lead_magnet_stats: exclude testers from the PII-free view too
create or replace view public.v_lead_magnet_stats
with (security_invoker = on) as
  select (entered_at at time zone 'America/Chicago')::date as capture_day,
         entry_funnel::text as funnel,
         coalesce(source, '(unattributed)') as source,
         count(*)::int as captures
  from public.waitlist_signups
  where unsubscribed_at is null
    and not public.is_internal_tester(email)
  group by 1,2,3;
