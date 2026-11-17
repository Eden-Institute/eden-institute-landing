-- Browser error report: errors that happen in a visitor's browser, recorded first-party.
-- 2026-11-17, Lane 2 deep audit area 16 finding E1. Camila's tap: "Yes, build it".
--
-- WHY. Supabase and the run tables showed every failure that reached the server, and nothing
-- that did not: a buy button or form that broke in the browser before its request left
-- (a script error, a promise nothing caught, a function call that never connected) left no
-- trace anywhere. src/lib/clientErrorBeacon.ts now reports those here, and the morning
-- digest's System health block shows a line when there were any (notify-founder-digest).
--
-- PRIVACY, the same posture as record_page_view: no cookies, no IP address stored, no bots.
-- Stored: the page path without its query string, a coarse browser name, the error text with
-- email addresses, long tokens and long numbers blanked, and a salted visitor hash that
-- changes daily (only used for the limits below and to say "N people").
--
-- LIMITS, so a page stuck in an error loop cannot flood the table or the digest: one visitor
-- at most 10 reports an hour, the same error on the same page from one visitor once per
-- 10 minutes, and at most 300 reports an hour in all. Rows older than 90 days are removed.
--
-- p_selftest = true checks a report and returns what WOULD be stored, writing nothing, so a
-- live check never leaves a row behind.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'rejection', 'function')),
  message text not null,
  source text,
  line integer,
  col integer,
  path text,
  fn text,
  status integer,
  browser text,
  visitor_hash text
);

create index if not exists client_errors_occurred_at_idx on public.client_errors (occurred_at desc);

alter table public.client_errors enable row level security;
-- No policy: only the server reads it (the digest runs as service_role). The browser writes
-- through record_client_error below, never to the table.
revoke all on table public.client_errors from anon, authenticated;
grant select, delete on table public.client_errors to service_role;

-- Blank anything that could identify a person or carry a secret, then cut to length:
-- email addresses, UUIDs, unbroken runs of 24+ letters/digits/underscores (keys, tokens,
-- base64), and runs of 7+ digits (phone or card numbers). Hyphenated words survive, so a
-- long herb page address like /herbs/pinkroot-also-indian-pink-... stays readable.
create or replace function public.client_error_scrub(p text, p_max integer)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '<email>', 'g'),
          '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}', '<id>', 'g'),
        '[A-Za-z0-9_]{24,}', '<token>', 'g'),
      '[0-9]{7,}', '<number>', 'g'),
    p_max)
$function$;

create or replace function public.record_client_error(
  p_kind text,
  p_message text,
  p_source text default null,
  p_line integer default null,
  p_col integer default null,
  p_path text default null,
  p_fn text default null,
  p_status integer default null,
  p_selftest boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_headers jsonb;
  v_ua text; v_ip text; v_salt text; v_day text; v_hash text; v_bot boolean;
  v_kind text; v_msg text; v_src text; v_path text; v_fn text; v_status integer;
  v_line integer; v_col integer; v_browser text;
begin
  v_kind := lower(coalesce(p_kind, ''));
  if v_kind not in ('error', 'rejection', 'function') then
    return jsonb_build_object('stored', false, 'why', 'kind');
  end if;

  v_msg := btrim(public.client_error_scrub(p_message, 300));
  if v_msg = '' then
    return jsonb_build_object('stored', false, 'why', 'empty');
  end if;

  -- Source file: path only (no host, no query string, no fragment).
  v_src := nullif(public.client_error_scrub(
    split_part(split_part(regexp_replace(coalesce(p_source, ''), '^[A-Za-z][A-Za-z0-9+.-]*://[^/]*', ''), '?', 1), '#', 1),
    200), '');
  v_path := public.client_error_scrub(split_part(split_part(coalesce(p_path, '/'), '?', 1), '#', 1), 200);
  if v_path = '' then v_path := '/'; end if;
  v_fn := case when coalesce(p_fn, '') ~ '^[a-z0-9-]{1,60}$' then p_fn else null end;
  v_status := case when p_status between 0 and 599 then p_status else null end;
  v_line := case when p_line between 0 and 10000000 then p_line else null end;
  v_col := case when p_col between 0 and 10000000 then p_col else null end;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ua := coalesce(v_headers->>'user-agent', '');
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);
  v_bot := v_ua ~* '(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|lighthouse|preview|curl|wget|python-requests|python-urllib|axios|node-fetch|semrush|ahrefs|dataprovider)';

  v_browser := case
    when v_ua ~* '(fban|fbav|instagram)' then 'Facebook/Instagram app'
    when v_ua ~* 'edg/' then 'Edge'
    when v_ua ~* 'samsungbrowser' then 'Samsung Internet'
    when v_ua ~* 'crios' then 'Chrome iOS'
    when v_ua ~* 'chrome' and v_ua ~* 'android' then 'Chrome Android'
    when v_ua ~* '(fxios|firefox)' then 'Firefox'
    when v_ua ~* 'chrome' then 'Chrome'
    when v_ua ~* '(iphone|ipad|ipod)' then 'Safari iOS'
    when v_ua ~* 'safari' then 'Safari'
    when v_ua = '' then null
    else 'Other'
  end;

  if p_selftest then
    return jsonb_build_object('stored', false, 'selftest', true, 'kind', v_kind, 'message', v_msg,
      'source', v_src, 'line', v_line, 'col', v_col, 'path', v_path, 'fn', v_fn, 'status', v_status,
      'browser', v_browser, 'bot', v_bot);
  end if;

  if v_bot then
    return jsonb_build_object('stored', false, 'why', 'bot');
  end if;

  v_day := (now() at time zone 'America/Chicago')::date::text;
  select salt into v_salt from public.analytics_salt where id = 1;
  v_hash := left(encode(extensions.digest(v_ip || '|' || v_ua || '|' || coalesce(v_salt, '') || '|' || v_day, 'sha256'), 'hex'), 16);

  if (select count(*) from public.client_errors
       where visitor_hash = v_hash and occurred_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('stored', false, 'why', 'visitor_limit');
  end if;
  if exists (select 1 from public.client_errors
              where visitor_hash = v_hash and message = v_msg and path = v_path
                and occurred_at > now() - interval '10 minutes') then
    return jsonb_build_object('stored', false, 'why', 'repeat');
  end if;
  if (select count(*) from public.client_errors where occurred_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('stored', false, 'why', 'hourly_limit');
  end if;

  delete from public.client_errors where occurred_at < now() - interval '90 days';

  insert into public.client_errors (kind, message, source, line, col, path, fn, status, browser, visitor_hash)
  values (v_kind, v_msg, v_src, v_line, v_col, v_path, v_fn, v_status, v_browser, v_hash);

  return jsonb_build_object('stored', true);
end;
$function$;

-- House pattern (20260915100000_audit_hardening.sql): revoke from public and the API roles by
-- name, then grant execute only to the roles that call it.
revoke execute on function public.client_error_scrub(text, integer) from public, anon, authenticated;
revoke execute on function public.record_client_error(text, text, text, integer, integer, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.record_client_error(text, text, text, integer, integer, text, text, integer, boolean) to anon, authenticated, service_role;
