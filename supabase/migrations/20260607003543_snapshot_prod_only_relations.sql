-- =============================================================================
-- SNAPSHOT: production-only objects that no earlier migration creates.
--
-- Produced 2026-09-15 from a live, read-only schema dump of project
-- noeqztssupewjidpvhar (information_schema.columns, pg_constraint, pg_indexes,
-- pg_policies, pg_trigger, pg_class.relacl, pg_proc.proacl, pg_get_viewdef,
-- pg_get_functiondef). Nothing here was reconstructed from memory.
--
-- THIS FILE NEVER REPLAYS AGAINST PRODUCTION. Every object below already exists
-- there. The version is marked applied in production with
--   supabase migration repair --status applied 20260607003543
-- (see docs/ops/2026-09-15-migration-history-repair.md), so `supabase db push`
-- skips it. It exists so a fresh database (`supabase db reset`, a branch, a new
-- project) gets these objects before the first migration that uses them.
--
-- Why this version: the earliest migration that touches any of these objects is
-- 20260607003544_nurture_queue_allow_3arc_positions.sql (ALTER TABLE
-- public.nurture_email_queue). This file sorts one second before it. Everything
-- crm_people reads (waitlist_signups, quiz_completions, magnet_email_queue,
-- profiles, is_internal_tester) is created by earlier migrations.
--
-- Objects, and how the live shape is split across files on a replay:
--   public.founders_interest    full live shape (also codified, identically, in
--                               20260915100000 section 9; read by 20260728230000,
--                               which ran before section 9 existed)
--   public.nurture_email_queue  full live shape; 20260607003544 drops and re-adds
--                               the same sequence_position check, a no-op here
--   public.set_nurture_queue_updated_at() + trigger trg_nurture_queue_updated_at
--   public.feedback_submissions BASE shape only: the 8 original columns, their
--                               constraints and two indexes. The other 17 columns,
--                               their checks and FKs, feedback_submissions_status_idx,
--                               feedback_submissions_punch_idx and the policy
--                               feedback_submissions_select_own are added by
--                               20260709180000_feedback_intake_structure.sql, whose
--                               CREATE POLICY is unguarded, so they must not be
--                               created here. Base + that migration = live shape.
--   public.crm_people           view, owner-privileged (no security_invoker), as live
--   public.founder_crm_feed(timestamptz), public.founder_crm_summary(timestamptz),
--   public.founder_partner_awaiting_email()   founder dashboard RPCs
--
-- Idempotent and non-destructive: IF NOT EXISTS everywhere, the view and the
-- functions are created only when absent (never replaced), no DROP, no data.
-- Grants reproduce the live ACLs. The two queue/inbox tables carry Supabase's
-- default full grants to anon/authenticated on live; RLS is on with no anon
-- policy, so those roles read nothing. They are written out to match live
-- exactly, not as a recommendation.
-- =============================================================================

-- founders_interest -----------------------------------------------------------
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
-- Live ACL: {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}, no policies.
revoke all on table public.founders_interest from public, anon, authenticated;
grant all on table public.founders_interest to service_role;

-- nurture_email_queue ---------------------------------------------------------
create table if not exists public.nurture_email_queue (
  id                   uuid        not null default gen_random_uuid(),
  recipient_email      text        not null,
  sequence_position    smallint    not null,
  constitution_pattern text,
  scheduled_for        timestamptz not null,
  sent_at              timestamptz,
  status               text        not null default 'pending'::text,
  error_message        text,
  retry_count          integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint nurture_email_queue_pkey primary key (id),
  constraint nurture_email_queue_recipient_email_sequence_position_key unique (recipient_email, sequence_position),
  constraint nurture_email_queue_sequence_position_check check (((sequence_position >= 2) and (sequence_position <= 7))),
  constraint nurture_email_queue_status_check check ((status = any (array['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text, 'skipped'::text])))
);
create index if not exists idx_nurture_queue_due on public.nurture_email_queue using btree (scheduled_for) where (status = 'pending'::text);
create index if not exists idx_nurture_queue_recipient on public.nurture_email_queue using btree (recipient_email);
create index if not exists idx_nurture_queue_status on public.nurture_email_queue using btree (status);
alter table public.nurture_email_queue enable row level security;
comment on table public.nurture_email_queue is
  'v3.33 §20.10 #52 / Lock #48: durable nurture send schedule. Replaces Resend scheduled_at for Emails 2-5. Producer = resend-waitlist EF; Consumer = nurture-emails EF cron tick. See feedback_resend_scheduled_at_brittle.md.';
-- Live ACL: {postgres,anon,authenticated,service_role = arwdDxtm}, RLS on, no policies.
grant all on table public.nurture_email_queue to anon, authenticated, service_role;

do $do$
begin
  if to_regprocedure('public.set_nurture_queue_updated_at()') is null then
    execute $ddl$
CREATE OR REPLACE FUNCTION public.set_nurture_queue_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
$ddl$;
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.nurture_email_queue'::regclass
       and tgname = 'trg_nurture_queue_updated_at'
  ) then
    create trigger trg_nurture_queue_updated_at
      before update on public.nurture_email_queue
      for each row execute function public.set_nurture_queue_updated_at();
  end if;
end
$do$;

-- feedback_submissions (base shape; see header) -------------------------------
create table if not exists public.feedback_submissions (
  id           uuid        not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  message      text        not null,
  email        text,
  page_url     text,
  user_agent   text,
  auth_user_id uuid,
  context      jsonb       not null default '{}'::jsonb,
  constraint feedback_submissions_pkey primary key (id),
  constraint feedback_submissions_message_check check (((length(message) >= 1) and (length(message) <= 5000))),
  constraint feedback_submissions_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete set null
);
create index if not exists idx_feedback_submissions_created_at on public.feedback_submissions using btree (created_at desc);
create index if not exists idx_feedback_submissions_auth_user_id on public.feedback_submissions using btree (auth_user_id) where (auth_user_id is not null);
alter table public.feedback_submissions enable row level security;
comment on table public.feedback_submissions is
  'v3.34 — durable inbox for in-app FeedbackButton submissions. EF writes here as source of truth, then mirrors to hello@edeninstitute.health email. RLS-walled to service role only.';
-- Live ACL: {postgres,anon,authenticated,service_role = arwdDxtm}.
grant all on table public.feedback_submissions to anon, authenticated, service_role;

-- crm_people (view) -----------------------------------------------------------
-- pg_get_viewdef output with relation and function names schema-qualified.
-- Created only when absent; never replaced.
do $do$
begin
  if to_regclass('public.crm_people') is null then
    execute $ddl$
CREATE VIEW public.crm_people AS
 WITH w AS (
         SELECT lower(TRIM(BOTH FROM waitlist_signups.email)) AS email,
            min(waitlist_signups.entered_at) AS first_seen,
            (array_agg(waitlist_signups.first_name ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.first_name IS NOT NULL))[1] AS first_name,
            (array_agg(waitlist_signups.last_name ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.last_name IS NOT NULL))[1] AS last_name,
            (array_agg(waitlist_signups.entry_funnel::text ORDER BY waitlist_signups.entered_at))[1] AS entry_funnel,
            (array_agg(COALESCE(waitlist_signups.source, '(unattributed)'::text) ORDER BY waitlist_signups.entered_at))[1] AS source,
            (array_agg(waitlist_signups.utm_source ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.utm_source IS NOT NULL))[1] AS utm_source,
            (array_agg(waitlist_signups.utm_campaign ORDER BY waitlist_signups.entered_at) FILTER (WHERE waitlist_signups.utm_campaign IS NOT NULL))[1] AS utm_campaign,
            bool_or(waitlist_signups.unsubscribed_at IS NOT NULL) AS unsubscribed
           FROM public.waitlist_signups
          WHERE waitlist_signups.email IS NOT NULL AND NOT public.is_internal_tester(waitlist_signups.email)
          GROUP BY (lower(TRIM(BOTH FROM waitlist_signups.email)))
        ), q AS (
         SELECT lower(TRIM(BOTH FROM quiz_completions.email)) AS email,
            max(quiz_completions.constitution_nickname) AS quiz_pattern,
            max(quiz_completions.completed_at) AS quiz_at,
            bool_or(COALESCE(quiz_completions.purchased_guide, false)) AS bought_guide,
            bool_or(COALESCE(quiz_completions.purchased_course, false)) AS bought_course
           FROM public.quiz_completions
          WHERE quiz_completions.email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM quiz_completions.email)))
        ), hm AS (
         SELECT lower(TRIM(BOTH FROM magnet_email_queue.recipient_email)) AS email,
            array_to_string(array_agg(DISTINCT magnet_email_queue.band ORDER BY magnet_email_queue.band), ', '::text) AS homeschool_bands,
            count(*) FILTER (WHERE magnet_email_queue.status = 'sent'::text) AS magnet_sent
           FROM public.magnet_email_queue
          WHERE magnet_email_queue.recipient_email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM magnet_email_queue.recipient_email)))
        ), nq AS (
         SELECT lower(TRIM(BOTH FROM nurture_email_queue.recipient_email)) AS email,
            max(nurture_email_queue.sequence_position) AS nurture_pos,
            count(*) FILTER (WHERE nurture_email_queue.status = 'sent'::text) AS nurture_sent
           FROM public.nurture_email_queue
          WHERE nurture_email_queue.recipient_email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM nurture_email_queue.recipient_email)))
        ), pr AS (
         SELECT lower(TRIM(BOTH FROM profiles.email)) AS email,
            max(profiles.subscription_tier) AS subscription_tier,
            max(profiles.subscription_status) AS subscription_status,
            bool_or(COALESCE(profiles.is_founding_member, false)) AS is_founding_member
           FROM public.profiles
          WHERE profiles.email IS NOT NULL
          GROUP BY (lower(TRIM(BOTH FROM profiles.email)))
        )
 SELECT w.email,
    w.first_name,
    w.last_name,
    w.first_seen,
    w.entry_funnel,
    w.source,
    w.utm_source,
    w.utm_campaign,
    w.unsubscribed,
    q.quiz_pattern,
    q.quiz_at,
    COALESCE(q.bought_guide, false) AS bought_guide,
    COALESCE(q.bought_course, false) AS bought_course,
    hm.homeschool_bands,
    COALESCE(hm.magnet_sent, 0::bigint) AS magnet_sent,
    nq.nurture_pos,
    COALESCE(nq.nurture_sent, 0::bigint) AS nurture_sent,
    pr.subscription_tier,
    pr.subscription_status,
    COALESCE(pr.is_founding_member, false) AS is_founding_member,
        CASE
            WHEN COALESCE(q.bought_guide, false) OR COALESCE(q.bought_course, false) OR pr.subscription_status = 'active'::text THEN 'Customer'::text
            WHEN q.quiz_pattern IS NOT NULL THEN 'Quiz-taker'::text
            ELSE 'Lead'::text
        END AS stage
   FROM w
     LEFT JOIN q ON q.email = w.email
     LEFT JOIN hm ON hm.email = w.email
     LEFT JOIN nq ON nq.email = w.email
     LEFT JOIN pr ON pr.email = w.email
$ddl$;
  end if;
end
$do$;
-- Live ACL: {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
revoke all on table public.crm_people from public, anon, authenticated;
grant all on table public.crm_people to service_role;

-- founder CRM / partner RPCs --------------------------------------------------
-- pg_get_functiondef output, verbatim. Created only when absent; never replaced.
-- Live ACL for all three: {postgres=X,authenticated=X,service_role=X}.
do $do$
begin
  if to_regprocedure('public.founder_crm_feed(timestamptz)') is null then
    execute $ddl$
CREATE OR REPLACE FUNCTION public.founder_crm_feed(p_since timestamp with time zone DEFAULT '2000-01-01 00:00:00+00'::timestamp with time zone)
 RETURNS TABLE(email text, first_name text, last_name text, stage text, first_seen timestamp with time zone, source text, utm_source text, quiz_pattern text, homeschool_bands text, subscription_status text, unsubscribed boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_founder() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;
  RETURN QUERY
    SELECT c.email, c.first_name, c.last_name, c.stage, c.first_seen,
           c.source, c.utm_source, c.quiz_pattern, c.homeschool_bands,
           c.subscription_status, c.unsubscribed
    FROM public.crm_people c
    WHERE c.first_seen >= p_since
    ORDER BY c.first_seen DESC;
END; $function$
$ddl$;
  end if;

  if to_regprocedure('public.founder_crm_summary(timestamptz)') is null then
    execute $ddl$
CREATE OR REPLACE FUNCTION public.founder_crm_summary(p_since timestamp with time zone DEFAULT '2000-01-01 00:00:00+00'::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_founder() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;
  SELECT jsonb_build_object(
    'total',        count(*),
    'leads',        count(*) FILTER (WHERE stage='Lead'),
    'quiz_takers',  count(*) FILTER (WHERE quiz_pattern IS NOT NULL),
    'customers',    count(*) FILTER (WHERE stage='Customer'),
    'homeschool',   count(*) FILTER (WHERE homeschool_bands IS NOT NULL),
    'unsubscribed', count(*) FILTER (WHERE unsubscribed),
    'by_stage', (SELECT coalesce(jsonb_agg(jsonb_build_object('stage',stage,'count',c) ORDER BY c DESC),'[]'::jsonb)
                 FROM (SELECT stage, count(*) c FROM public.crm_people WHERE first_seen >= p_since GROUP BY stage) s),
    'by_pattern', (SELECT coalesce(jsonb_agg(jsonb_build_object('pattern',quiz_pattern,'count',c) ORDER BY c DESC),'[]'::jsonb)
                   FROM (SELECT quiz_pattern, count(*) c FROM public.crm_people WHERE first_seen >= p_since AND quiz_pattern IS NOT NULL GROUP BY quiz_pattern) s),
    'by_source', (SELECT coalesce(jsonb_agg(jsonb_build_object('source',src,'count',c) ORDER BY c DESC),'[]'::jsonb)
                  FROM (SELECT coalesce(utm_source,'(direct / none)') src, count(*) c FROM public.crm_people WHERE first_seen >= p_since GROUP BY 1 ORDER BY c DESC LIMIT 10) s)
  ) INTO result
  FROM public.crm_people WHERE first_seen >= p_since;
  RETURN result;
END; $function$
$ddl$;
  end if;

  -- Reads public.founding_partners, which a later migration creates. plpgsql
  -- bodies are not resolved at CREATE time, so creating it here is safe; it is
  -- callable once that table exists, exactly as on production.
  if to_regprocedure('public.founder_partner_awaiting_email()') is null then
    execute $ddl$
CREATE OR REPLACE FUNCTION public.founder_partner_awaiting_email()
 RETURNS TABLE(id uuid, name text, handle text, welcome_sent_at timestamp with time zone, days_waiting integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_founder() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.name, p.handle, p.welcome_sent_at,
         greatest(0, (current_date - p.welcome_sent_at::date))::integer as days_waiting
  from public.founding_partners p
  where p.email is null
  order by p.welcome_sent_at asc nulls last;
end;
$function$
$ddl$;
  end if;
end
$do$;

revoke all on function public.founder_crm_feed(timestamptz) from public, anon;
revoke all on function public.founder_crm_summary(timestamptz) from public, anon;
revoke all on function public.founder_partner_awaiting_email() from public, anon;
grant execute on function public.founder_crm_feed(timestamptz) to authenticated, service_role;
grant execute on function public.founder_crm_summary(timestamptz) to authenticated, service_role;
grant execute on function public.founder_partner_awaiting_email() to authenticated, service_role;
