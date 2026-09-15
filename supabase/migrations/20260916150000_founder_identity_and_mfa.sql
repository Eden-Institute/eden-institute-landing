-- 20260916150000_founder_identity_and_mfa.sql
--
-- Founder decision 2026-09-15 ("Both, set up 2FA now"):
--   1. The founder identity lives in ONE database setting, public.app_settings,
--      instead of a literal email copied into every gate.
--   2. public.is_founder_mfa(): the founder AND a two-factor (aal2) session. The
--      edge functions enforce the step-up for broadcast sends and Lulu cancels
--      (_shared/founder-identity.ts); this is the matching SQL building block for
--      any later RPC that should need it.
--
-- NOT APPLIED by the session that wrote it. Idempotent: safe to run twice.
--
-- Grants on is_founder() are left exactly as live on 2026-09-15:
--   postgres, anon, authenticated, service_role = EXECUTE.
-- CREATE OR REPLACE keeps an existing function's ACL, so nothing below touches them.
-- (anon holding EXECUTE is harmless: an anon JWT has no email, so it returns false.)
--
-- No lockout: is_founder() keeps answering for the same address it answers for
-- today, because the seeded row holds that exact address. The assertion block at
-- the bottom aborts the whole migration if the row, RLS or grants are not right.

create table if not exists public.app_settings (
  id            boolean primary key default true,
  founder_email text        not null,
  updated_at    timestamptz not null default now(),
  constraint app_settings_single_row check (id),
  constraint app_settings_founder_email_lower check (founder_email = lower(btrim(founder_email))),
  constraint app_settings_founder_email_shape check (founder_email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);

comment on table public.app_settings is
  'Single-row settings (id is always true). founder_email is the ONE source of the founder '
  'identity: is_founder() reads it, and the founder-gated edge functions read it through '
  '_shared/founder-identity.ts. No client access; change it with a migration or the SQL editor.';

alter table public.app_settings enable row level security;

-- No client grants. RLS is on with no policies AND the table grants are removed,
-- so anon and authenticated cannot read or change it by either route.
-- is_founder() is SECURITY DEFINER (owner postgres) and reads it directly.
revoke all on table public.app_settings from public;
revoke all on table public.app_settings from anon;
revoke all on table public.app_settings from authenticated;
-- The edge functions read the setting with the service role key.
revoke all on table public.app_settings from service_role;
grant select on table public.app_settings to service_role;

insert into public.app_settings (id, founder_email)
values (true, 'hello@edeninstitute.health')
on conflict (id) do nothing;


create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.app_settings s
     where s.id
       and s.founder_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

comment on function public.is_founder() is
  'True when the request JWT belongs to the founder account named in public.app_settings.founder_email. '
  'Gates the founder_* RPCs. Change the founder address in app_settings, never here.';


create or replace function public.is_founder_mfa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_founder()
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

comment on function public.is_founder_mfa() is
  'True when the request is the founder (is_founder()) AND the session passed a second factor (JWT aal = aal2).';

revoke all on function public.is_founder_mfa() from public;
revoke all on function public.is_founder_mfa() from anon;
grant execute on function public.is_founder_mfa() to authenticated, service_role;


-- ── Assertions: abort (and roll back) if any of this did not land as intended ──
do $$
declare
  v_rows  integer;
  v_email text;
  v_def   text;
begin
  select count(*), max(founder_email) into v_rows, v_email from public.app_settings;
  if v_rows <> 1 then
    raise exception 'app_settings must hold exactly one row, found %', v_rows;
  end if;
  if v_email <> 'hello@edeninstitute.health' then
    -- A deliberate later change is allowed, so this only warns.
    raise notice 'app_settings.founder_email is %, not the address is_founder() used before this migration', v_email;
  end if;

  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.app_settings'::regclass) then
    raise exception 'RLS is not enabled on public.app_settings';
  end if;
  if has_table_privilege('anon', 'public.app_settings', 'select')
     or has_table_privilege('anon', 'public.app_settings', 'update')
     or has_table_privilege('authenticated', 'public.app_settings', 'select')
     or has_table_privilege('authenticated', 'public.app_settings', 'insert')
     or has_table_privilege('authenticated', 'public.app_settings', 'update')
     or has_table_privilege('authenticated', 'public.app_settings', 'delete') then
    raise exception 'public.app_settings must not be readable or writable by anon or authenticated';
  end if;
  if not has_table_privilege('service_role', 'public.app_settings', 'select') then
    raise exception 'service_role must be able to read public.app_settings';
  end if;

  v_def := pg_get_functiondef('public.is_founder()'::regprocedure);
  if position('app_settings' in v_def) = 0 or position('@' in v_def) > 0 then
    raise exception 'is_founder() must read app_settings and carry no literal address';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'public.is_founder()'::regprocedure) then
    raise exception 'is_founder() must stay SECURITY DEFINER';
  end if;
  if not has_function_privilege('authenticated', 'public.is_founder()', 'execute')
     or not has_function_privilege('service_role', 'public.is_founder()', 'execute') then
    raise exception 'is_founder() lost an existing grant';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid = 'public.is_founder_mfa()'::regprocedure) then
    raise exception 'is_founder_mfa() must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.is_founder_mfa()', 'execute') then
    raise exception 'anon must not execute is_founder_mfa()';
  end if;

  -- With no request JWT both answer false rather than erroring.
  if public.is_founder() or public.is_founder_mfa() then
    raise exception 'is_founder()/is_founder_mfa() returned true with no request JWT';
  end if;
end
$$;
