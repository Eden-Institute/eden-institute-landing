-- Audit hardening: close grants that production carries but the migrations never intended.
-- Written 2026-09-15 by the production audit. NOT YET APPLIED. Apply once, from a linked
-- checkout (supabase db push) or the SQL editor. Every statement is idempotent, and the
-- assertions at the bottom abort the whole transaction if any grant survives.
--
-- ROOT CAUSE (read this before writing the next migration)
--   Supabase's default privileges grant EXECUTE on every new public function, and SELECT on
--   every new view, EXPLICITLY to anon and authenticated. `REVOKE ALL ... FROM PUBLIC` does
--   not remove those explicit grants. Several migrations below used exactly that pattern and
--   believed the object was service-role only; production shows anon can still call it.
--   Always revoke FROM PUBLIC, anon, authenticated by name.
--   CREATE OR REPLACE on an EXISTING function keeps its ACL; only a brand-new function gets
--   the default anon grant. So a new function always needs `revoke ... from public, anon`
--   by name, even when a later CREATE OR REPLACE of an older function did not.
--
-- WHAT THIS CHANGES (verified against production 2026-09-15)
--   1. profiles: authenticated users could UPDATE every column of their own row except tier,
--      status and stripe_customer_id (policy profiles_self_update). That included
--      stripe_subscription_id, which stripe-webhook's handleSubscriptionDeleted compares
--      against the ended subscription: a subscriber could write a fake id, cancel, and keep
--      the paid tier when Stripe's delete event was ignored. It also let a user set
--      is_founding_member, current_period_end and cancel_at_period_end on themselves.
--      No client code writes profiles at all (src/ and web/ only SELECT from it), so UPDATE
--      is narrowed to display_name. The service role (webhooks) is unaffected.
--   2. waitlist_apply_resend_event: anon-executable SECURITY DEFINER. Anyone holding the
--      public key could unsubscribe any address on the list, or merge arbitrary JSON into its
--      metadata. Only resend-webhook calls it, with the service role.
--   3. weekly_trends_snapshot: anon-executable SECURITY DEFINER that returns lead counts by
--      source and traffic totals. Only weekly-trends-digest calls it, with the service role.
--   4. is_internal_tester: anon-executable SECURITY DEFINER that answers "is this address on
--      the internal testers list". Only SQL (definer views and functions) calls it.
--   5. founder_course_funnel: guarded by is_founder(), but anon still held EXECUTE and the
--      search_path omitted pg_temp. The founder dashboard calls it as authenticated; kept.
--   6. quiz_completion_failure_stats (definer view) and v_lead_magnet_stats: readable by anon,
--      consumed by nothing in the repo. quiz_completion_failure_stats also switches to
--      security_invoker, so the deny-all RLS on quiz_completion_failures applies through it
--      even if a grant is ever re-added (service_role has SELECT and BYPASSRLS, so SQL-editor
--      and service-role triage still read it).
--   7. Six functions flagged by the Supabase security advisor with a mutable search_path.
--      Side effect: a LANGUAGE sql function with a SET clause is no longer inlined by the
--      planner. The eden_classify_* functions run over ~300 herb rows; negligible.
--   8. record_page_view, record_cta_click: soft per-visitor cap of 30 page views and 60 CTA
--      clicks per visitor_hash per rolling minute, plus (visitor_hash, occurred_at desc)
--      indexes so the check is an index range scan. This is a speed bump against naive
--      scripted floods that pollute the founder dashboard and grow the tables, NOT a hard
--      defence: visitor_hash is derived from the client-supplied user-agent and
--      x-forwarded-for, so rotating the user-agent yields a fresh hash. Production's highest
--      ever count was 19 page views and 4 clicks for one hash in one minute, so no real
--      visitor has come near the cap. Bodies are the live pg_get_functiondef text with only
--      the guard added (record_cta_click's live body has CRLF line endings; the logic is
--      identical). Grants are re-stated unchanged.
--   9. founders_interest, founders_send_log: created at runtime by the founders-lock edge
--      function (CREATE TABLE IF NOT EXISTS over SUPABASE_DB_URL) and never by a migration,
--      although list-announce's per-campaign claim log depends on founders_send_log. Codified
--      with the live column list, constraint names and RLS state, so this is a no-op on
--      production. anon/authenticated table grants are revoked: RLS with no policies already
--      denied them, list-announce uses the service role, founders-lock connects as postgres.
--  10. quiz_completions_email_unique: the UNIQUE btree index on lower(email) exists in
--      production but no migration creates it (20260425200000's header calls it
--      quiz_completions_lower_email_idx; the live name is quiz_completions_email_unique).
--      record-quiz-completion and replay-quiz-completion-failures rely on it for their 409
--      no-op path. Production had 0 duplicate lower(email) values on 2026-09-15.
--  11. feedback_promote refuses a submission that already has a punch_list_id (a double click,
--      retry or direct RPC created a second founder_punch_list row). feedback_merge refuses a
--      canonical that does not exist or is itself a duplicate (no merge chains). Bodies are
--      otherwise identical to production.
--  12. founder_* RPC sweep: every public function named founder_* ends with no PUBLIC or anon
--      EXECUTE and keeps authenticated. On production only founder_course_funnel changes
--      (section 5); the sweep also covers the production-only founder_crm_feed,
--      founder_crm_summary and founder_partner_awaiting_email, which no migration defines.
--  13. herbs_clinical_v (Seed+ owner view, superseded by herbs_directory_v; 20260424183000
--      planned to drop it) and the legacy tier helpers tier_rank, current_tier, has_tier:
--      no repo consumer, no live policy, view or function dependent, and no API request for
--      any of them in the last 24h of edge logs. current_tier also ignores
--      subscription_status, so it would be a wrong gate if anyone adopted it. Revoked from
--      anon and authenticated, kept for service_role. If a policy, view or invoker function
--      references a tier helper at apply time, that revoke is skipped with a WARNING.
--  14. clinical.encounters, clinical.formularies, clinical.formulary_items: RLS enabled with
--      no policies (defence in depth). The tables are owned by postgres, carry no grant for
--      anon, authenticated or service_role, and the clinical schema grants USAGE to postgres
--      only. They are read solely by postgres-owned SECURITY DEFINER RPCs
--      (clinical_encounter_*, clinical_formular*, pocket_materia_medica) called by the
--      practitioner-clinical edge function, and a table owner bypasses non-forced RLS.
--  15. SECURITY DEFINER functions pinned to `public` without pg_temp (handle_new_user,
--      tg_person_profiles_enforce_cap, tg_profiles_create_self_on_upgrade,
--      tg_quiz_completion_sync_constitution, checkout_rate_bump, esa_next_invoice_number,
--      esa_auto_confirm_ready, esa_mark_invoice_paid, current_tier, has_tier) become
--      `public, pg_temp`. pg_temp moves from implicitly first to explicitly last, so a
--      caller's temp table cannot shadow a public table; nothing else resolves differently
--      and no body changes. Definer functions are never inlined, so no planner change. Also
--      repo parity: set_updated_at, tg_person_profiles_set_updated_at,
--      person_profile_cap_for_tier and tier_rank are pinned to `pg_catalog, public` in
--      production but not in the repo; pinned only where no search_path is set (no-op live).
--
-- DELIBERATELY NOT CHANGED
--   * record_page_view, record_cta_click grants: anon by design (cookieless analytics
--     beacons; the publishable key in the beacon URL is public by design). No retention or
--     purge job for page_views / cta_events: how long analytics rows are kept is the
--     founder's call.
--   * current_user_tier, current_user_at_least, is_founder: return only the caller's own
--     state and back RLS policies and paywall views.
--   * Trigger and event-trigger functions (tg_*, handle_new_user, cancel_*, enqueue_*,
--     quiz_completions_to_waitlist, rls_auto_enable): the advisor lists them, but Postgres
--     refuses to call a trigger function outside a trigger, so the grant is inert.
--   * herbs_public, herbs_directory_v, print_products_public, contraindications_safety_v:
--     intentionally owner-privileged views (security_invoker false) reachable by anon. They
--     read RLS-locked base tables (public.herbs has a using(false) policy) through owner
--     rights, and tier gating lives in CASE expressions on current_user_at_least(). Flipping
--     them to security_invoker would empty the public herb directory.
--   * Nothing is dropped. herbs_clinical_v, tier_rank, current_tier, has_tier and
--     v_lead_magnet_stats are revoked and kept; dropping them, and regenerating
--     src/integrations/supabase/types.ts afterwards, is a separate decision.
--   * founders-lock/index.ts keeps its runtime CREATE TABLE IF NOT EXISTS (idempotent, and
--     the function is retired). Replay order is still broken for founders_interest:
--     20260728230000 selects from it before this migration creates it.
--   * FORCE ROW LEVEL SECURITY on clinical.*: it would make the definer RPCs deny-all too.
--   * rls_auto_enable still only acts on schema public. Covering clinical means re-issuing
--     the whole event-trigger function body; left as a follow-up.
--   * pg_trgm in public: moving it rewrites index operator classes; not an audit change.

begin;

-- 1. profiles: only display_name is client-writable ---------------------------------------
revoke update on table public.profiles from anon, authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- 2-4. service-role-only SECURITY DEFINER functions ----------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.waitlist_apply_resend_event(text, uuid, text, jsonb)',
    'public.weekly_trends_snapshot()',
    'public.is_internal_tester(text)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- 5. founder_course_funnel: founder dashboard (authenticated) + service role only ------------
do $$
begin
  if to_regprocedure('public.founder_course_funnel(timestamp with time zone)') is not null then
    revoke all on function public.founder_course_funnel(timestamp with time zone) from public, anon;
    grant execute on function public.founder_course_funnel(timestamp with time zone) to authenticated, service_role;
    alter function public.founder_course_funnel(timestamp with time zone) set search_path = public, pg_temp;
  end if;
end $$;

-- 6. unused views readable by anon ----------------------------------------------------------
do $$
declare
  v text;
begin
  foreach v in array array['public.quiz_completion_failure_stats', 'public.v_lead_magnet_stats'] loop
    if to_regclass(v) is not null then
      execute format('revoke all on table %s from public, anon, authenticated', v);
      execute format('grant select on table %s to service_role', v);
    end if;
  end loop;
end $$;

alter view if exists public.quiz_completion_failure_stats set (security_invoker = true);

-- 7. pin search_path (advisor lint 0011) ----------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.eden_leading_clause(text)',
    'public.eden_classify_temperature(text)',
    'public.eden_classify_moisture(text)',
    'public.eden_classify_tone(text)',
    'public.is_internal_email(text)',
    'public.payments_set_internal()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('alter function %s set search_path = pg_catalog, public', fn);
    end if;
  end loop;
end $$;

-- 8. analytics beacons: soft per-visitor cap ------------------------------------------------
create index if not exists page_views_hash_recent_idx on public.page_views (visitor_hash, occurred_at desc);
create index if not exists cta_events_hash_recent_idx on public.cta_events (visitor_hash, occurred_at desc);

CREATE OR REPLACE FUNCTION public.record_page_view(p_path text, p_referrer text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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

  insert into public.page_views (path, referrer_host, utm_source, utm_medium, utm_campaign, visitor_hash, is_bot)
  values (v_path, v_ref, left(p_utm_source,100), left(p_utm_medium,100), left(p_utm_campaign,100), v_hash, coalesce(v_bot,false));
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_cta_click(p_cta text, p_path text DEFAULT NULL::text, p_lookup_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_headers jsonb;
  v_ua text; v_ip text; v_salt text; v_day text; v_hash text;
  v_cta text; v_path text; v_key text; v_bot boolean;
begin
  -- cta is required and capped; refuse empties rather than store junk rows.
  v_cta := left(trim(coalesce(p_cta, '')), 100);
  if v_cta = '' then
    return;
  end if;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ua := coalesce(v_headers->>'user-agent', '');
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);

  -- sanitize path: drop query/hash, cap length (same as record_page_view)
  v_path := left(split_part(split_part(coalesce(p_path,'/'),'?',1),'#',1), 300);
  if v_path = '' then v_path := '/'; end if;

  v_key := nullif(left(trim(coalesce(p_lookup_key, '')), 100), '');

  v_bot := v_ua ~* '(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|lighthouse|preview|curl|wget|python-requests|axios|node-fetch|semrush|ahrefs|dataprovider)';

  v_day  := (now() at time zone 'America/Chicago')::date::text;
  select salt into v_salt from public.analytics_salt where id = 1;
  v_hash := left(encode(extensions.digest(v_ip || '|' || v_ua || '|' || coalesce(v_salt,'') || '|' || v_day, 'sha256'), 'hex'), 16);

  -- Soft flood cap (speed bump only: the hash changes with the user-agent).
  if (select count(*) from public.cta_events
       where visitor_hash = v_hash and occurred_at > now() - interval '1 minute') >= 60 then
    return;
  end if;

  insert into public.cta_events (cta, path, lookup_key, visitor_hash, is_bot)
  values (v_cta, v_path, v_key, v_hash, coalesce(v_bot, false));
end;
$function$;

revoke execute on function public.record_page_view(text, text, text, text, text) from public;
grant execute on function public.record_page_view(text, text, text, text, text) to anon, authenticated;
revoke execute on function public.record_cta_click(text, text, text) from public;
grant execute on function public.record_cta_click(text, text, text) to anon, authenticated;

-- 9. founders-lock tables: created at runtime by the edge function, never versioned ----------
-- Column lists, defaults and constraint names match production (information_schema and
-- pg_constraint, 2026-09-15), so both CREATEs are no-ops there.
create table if not exists public.founders_interest (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  phone text,
  sms_consent boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.founders_interest enable row level security;
revoke all on table public.founders_interest from public, anon, authenticated;

create table if not exists public.founders_send_log (
  campaign text not null,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (campaign, email)
);
alter table public.founders_send_log enable row level security;
revoke all on table public.founders_send_log from public, anon, authenticated;
comment on table public.founders_send_log is
  'Per-campaign claim log for list-announce (claim before send; PK (campaign,email) makes a re-claim raise 23505). Service-role only, RLS on, no policies.';

-- 10. quiz_completions: repo parity for the live unique email index --------------------------
create unique index if not exists quiz_completions_email_unique on public.quiz_completions (lower(email));

-- 11. feedback triage RPCs: no double promote, no merge into a duplicate ---------------------
CREATE OR REPLACE FUNCTION public.feedback_merge(p_duplicate uuid, p_canonical uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT is_founder() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_duplicate = p_canonical THEN RAISE EXCEPTION 'Cannot merge a submission into itself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feedback_submissions WHERE id = p_canonical AND status <> 'duplicate') THEN
    RAISE EXCEPTION 'Canonical submission % does not exist or is itself a duplicate', p_canonical;
  END IF;
  UPDATE public.feedback_submissions
     SET status = 'duplicate', merged_into = p_canonical, status_updated_at = now()
   WHERE id = p_duplicate;
END;
$$;

CREATE OR REPLACE FUNCTION public.feedback_promote(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sub   public.feedback_submissions%ROWTYPE;
  v_rice  numeric;
  v_punch uuid;
  v_dups  integer;
BEGIN
  IF NOT is_founder() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_sub FROM public.feedback_submissions WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown submission %', p_id; END IF;
  IF v_sub.punch_list_id IS NOT NULL THEN
    RAISE EXCEPTION 'Submission % is already promoted to punch item %', p_id, v_sub.punch_list_id;
  END IF;

  SELECT count(*) INTO v_dups FROM public.feedback_submissions WHERE merged_into = p_id;

  v_rice := (COALESCE(v_sub.reach, 3)::numeric * COALESCE(v_sub.impact_score, 3))
            / GREATEST(COALESCE(v_sub.effort, 3), 1);

  INSERT INTO public.founder_punch_list (title, detail, owner, status, sort_order)
  VALUES (
    COALESCE(v_sub.title, left(v_sub.message, 80)),
    concat_ws(E'\n',
      v_sub.description,
      'Type: '  || COALESCE(v_sub.type, 'unspecified')
        || ' · Area: ' || COALESCE(v_sub.area, 'unspecified')
        || COALESCE(' / ' || v_sub.sub_area, ''),
      'RICE-lite: ' || round(v_rice, 1)
        || CASE WHEN v_dups > 0 THEN ' · ' || (v_dups + 1) || ' merged reports' ELSE '' END,
      'Source feedback: ' || v_sub.id),
    'AI',
    'open',
    GREATEST(1, 100 - round(v_rice * 8)::integer)
  )
  RETURNING id INTO v_punch;

  UPDATE public.feedback_submissions
     SET punch_list_id = v_punch, status = 'planned',
         triaged_at = COALESCE(triaged_at, now()), status_updated_at = now()
   WHERE id = p_id OR merged_into = p_id;

  RETURN v_punch;
END;
$$;

revoke all on function public.feedback_merge(uuid, uuid) from public, anon;
grant execute on function public.feedback_merge(uuid, uuid) to authenticated;
revoke all on function public.feedback_promote(uuid) from public, anon;
grant execute on function public.feedback_promote(uuid) to authenticated;

-- 12. founder_* RPCs: authenticated (founder dashboard) only, never anon ---------------------
-- Every founder_* function in migrations and production already grants authenticated, so
-- the grant widens nothing; it keeps authenticated access if it only came through PUBLIC.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'founder\_%'
  loop
    execute format('revoke execute on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated', fn.sig);
  end loop;
end $$;

-- 13. superseded read surfaces: revoke, keep --------------------------------------------------
do $$
begin
  if to_regclass('public.herbs_clinical_v') is not null then
    revoke all on table public.herbs_clinical_v from public, anon, authenticated;
    grant select on table public.herbs_clinical_v to service_role;
  end if;
end $$;

do $$
declare
  deps text;
  fn text;
begin
  -- Revoking EXECUTE would break a policy, invoker view or invoker function that calls a
  -- helper as anon/authenticated. None existed on 2026-09-15; re-check at apply time.
  select string_agg(obj, ', ') into deps
    from (
      select format('policy %s on %s', pol.polname, pol.polrelid::regclass) as obj
        from pg_policy pol
       where concat_ws(' ', pg_get_expr(pol.polqual, pol.polrelid), pg_get_expr(pol.polwithcheck, pol.polrelid))
             ~ '\m(tier_rank|current_tier|has_tier)\('
      union all
      select format('view %I.%I', vw.schemaname, vw.viewname)
        from pg_views vw
       where vw.schemaname not in ('pg_catalog', 'information_schema')
         and vw.definition ~ '\m(tier_rank|current_tier|has_tier)\('
      union all
      select format('function %s', p.oid::regprocedure)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname not in ('pg_catalog', 'information_schema')
         and not p.prosecdef
         and p.proname not in ('tier_rank', 'current_tier', 'has_tier')
         and p.prosrc ~ '\m(tier_rank|current_tier|has_tier)\('
    ) d;

  if deps is not null then
    raise warning 'audit_hardening: legacy tier helpers kept executable, dependents exist: %', deps;
    perform set_config('audit_hardening.tier_helpers_kept', 'on', true);
    return;
  end if;

  foreach fn in array array[
    'public.has_tier(public.subscription_tier)',
    'public.current_tier()',
    'public.tier_rank(public.subscription_tier)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- 14. clinical.*: RLS on, no policies ----------------------------------------------------------
-- No policies on purpose: deny-all for every non-owner role. Access is only through the
-- postgres-owned SECURITY DEFINER clinical_* / pocket_materia_medica RPCs, which run as the
-- table owner and so bypass non-forced RLS. Do not add FORCE ROW LEVEL SECURITY.
alter table if exists clinical.encounters      enable row level security;
alter table if exists clinical.formularies     enable row level security;
alter table if exists clinical.formulary_items enable row level security;

-- 15. SECURITY DEFINER search_path: add pg_temp -----------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname in (
         'handle_new_user', 'tg_person_profiles_enforce_cap', 'tg_profiles_create_self_on_upgrade',
         'tg_quiz_completion_sync_constitution', 'checkout_rate_bump', 'esa_next_invoice_number',
         'esa_auto_confirm_ready', 'esa_mark_invoice_paid', 'current_tier', 'has_tier')
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
          where c like 'search_path=%pg\_temp%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
    raise notice 'pinned search_path = public, pg_temp on %', fn.sig;
  end loop;

  -- Repo parity: production already pins these invoker functions; the repo never did.
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('set_updated_at', 'tg_person_profiles_set_updated_at',
                         'person_profile_cap_for_tier', 'tier_rank')
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
          where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = pg_catalog, public', fn.sig);
    raise notice 'pinned search_path = pg_catalog, public on %', fn.sig;
  end loop;
end $$;

-- Assertions: fail the migration rather than report success with a grant still open ---------
do $$
declare
  fn text;
  v text;
  bad text[] := '{}';
begin
  foreach fn in array array[
    'public.waitlist_apply_resend_event(text, uuid, text, jsonb)',
    'public.weekly_trends_snapshot()',
    'public.is_internal_tester(text)',
    'public.founder_course_funnel(timestamp with time zone)'
  ] loop
    if to_regprocedure(fn) is not null and has_function_privilege('anon', fn, 'EXECUTE') then
      bad := bad || fn;
    end if;
  end loop;

  if to_regclass('public.quiz_completion_failure_stats') is not null
     and has_table_privilege('anon', 'public.quiz_completion_failure_stats', 'SELECT') then
    bad := bad || 'quiz_completion_failure_stats'::text;
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'stripe_subscription_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'is_founding_member', 'UPDATE') then
    bad := bad || 'profiles column UPDATE'::text;
  end if;

  -- The beacons must stay callable by anon, or site analytics silently stops.
  foreach fn in array array[
    'public.record_page_view(text, text, text, text, text)',
    'public.record_cta_click(text, text, text)'
  ] loop
    if to_regprocedure(fn) is not null and not has_function_privilege('anon', fn, 'EXECUTE') then
      bad := bad || (fn || ' lost anon EXECUTE');
    end if;
  end loop;

  select bad || coalesce(array_agg(p.oid::regprocedure::text), '{}'::text[]) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'founder\_%'
     and has_function_privilege('anon', p.oid, 'EXECUTE');

  foreach v in array array[
    'public.v_lead_magnet_stats', 'public.herbs_clinical_v',
    'public.founders_interest', 'public.founders_send_log'
  ] loop
    if to_regclass(v) is not null and has_table_privilege('anon', v, 'SELECT') then
      bad := bad || v;
    end if;
  end loop;

  if coalesce(current_setting('audit_hardening.tier_helpers_kept', true), '') <> 'on' then
    foreach fn in array array[
      'public.has_tier(public.subscription_tier)',
      'public.current_tier()',
      'public.tier_rank(public.subscription_tier)'
    ] loop
      if to_regprocedure(fn) is not null and has_function_privilege('anon', fn, 'EXECUTE') then
        bad := bad || fn;
      end if;
    end loop;
  end if;

  if to_regclass('public.quiz_completions') is not null
     and to_regclass('public.quiz_completions_email_unique') is null then
    bad := bad || 'quiz_completions_email_unique missing'::text;
  end if;

  select bad || coalesce(array_agg(c.oid::regclass::text || ' RLS off'), '{}'::text[]) into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'clinical'
     and c.relname in ('encounters', 'formularies', 'formulary_items')
     and not c.relrowsecurity;

  select bad || coalesce(array_agg(p.oid::regprocedure::text || ' search_path lacks pg_temp'), '{}'::text[]) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proname in (
       'handle_new_user', 'tg_person_profiles_enforce_cap', 'tg_profiles_create_self_on_upgrade',
       'tg_quiz_completion_sync_constitution', 'checkout_rate_bump', 'esa_next_invoice_number',
       'esa_auto_confirm_ready', 'esa_mark_invoice_paid', 'current_tier', 'has_tier',
       'founder_course_funnel')
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%pg\_temp%');

  if array_length(bad, 1) is not null then
    raise exception 'audit_hardening: checks failed (grants still open or hardening missing): %', array_to_string(bad, ', ');
  end if;
end $$;

commit;
