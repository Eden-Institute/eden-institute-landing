-- page_views learns utm_content (founder request 2026-09-28).
--
-- WHY. Every QR code on the makers market wall carries utm_content naming the exact
-- piece (herb_label + "chamomile", table_sign + "back_to_eden"). Orders and signups
-- already store it (attr_utm_content, resend-waitlist utm_content), but page_views
-- dropped it, so visit counts could say "a herb label" and never which herb.
--
-- SAFE ORDER. Apply this BEFORE the client change ships. The new parameter has a
-- default, so the current bundle (which sends five args) keeps working against the
-- new function; the old five-arg overload is dropped so PostgREST never has two
-- candidates to choose between. Grants match production as read 2026-09-28:
-- postgres, anon, authenticated, service_role; nothing for PUBLIC.

alter table public.page_views add column if not exists utm_content text;

drop function if exists public.record_page_view(text, text, text, text, text);

create or replace function public.record_page_view(
  p_path text,
  p_referrer text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_headers jsonb;
  v_ua text; v_ip text; v_salt text; v_day text; v_hash text; v_path text; v_ref text; v_bot boolean;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ua := coalesce(v_headers->>'user-agent', '');
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);

  -- sanitize path: drop query/hash, cap length
  v_path := left(split_part(split_part(coalesce(p_path,'/'),'?',1),'#',1), 300);
  if v_path = '' then v_path := '/'; end if;

  -- referrer → host only (no external URLs/paths retained)
  if coalesce(p_referrer,'') ~ '^https?://' then
    v_ref := left(regexp_replace(p_referrer, '^https?://([^/]+).*$', '\1'), 200);
  else
    v_ref := null;
  end if;

  v_bot := v_ua ~* '(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|lighthouse|preview|curl|wget|python-requests|axios|node-fetch|semrush|ahrefs|dataprovider)';

  v_day  := (now() at time zone 'America/Chicago')::date::text;
  select salt into v_salt from public.analytics_salt where id = 1;
  v_hash := left(encode(extensions.digest(v_ip || '|' || v_ua || '|' || coalesce(v_salt,'') || '|' || v_day, 'sha256'), 'hex'), 16);

  -- Soft flood cap (speed bump only: the hash changes with the user-agent).
  if (select count(*) from public.page_views
       where visitor_hash = v_hash and occurred_at > now() - interval '1 minute') >= 30 then
    return;
  end if;

  insert into public.page_views (path, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, visitor_hash, is_bot)
  values (v_path, v_ref, left(p_utm_source,100), left(p_utm_medium,100), left(p_utm_campaign,100), left(p_utm_content,100), v_hash, coalesce(v_bot,false));
end;
$function$;

revoke all on function public.record_page_view(text, text, text, text, text, text) from public;
grant execute on function public.record_page_view(text, text, text, text, text, text) to anon, authenticated, service_role;
