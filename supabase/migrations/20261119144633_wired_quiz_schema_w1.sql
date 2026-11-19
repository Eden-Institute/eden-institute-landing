-- ============================================================================
-- Fearfully & Wonderfully Wired (learner quiz), ticket W1: the schema.
--
-- Spec: Eden's Table (Homeschool Curriculum)/Projects/New Projects Lane/
--       Wired_Quiz_Phase1_Developer_Spec.md (approved by Camila 2026-11-18), sections
--       4 and 18 (section 18 wins where they differ). Built by Lane 2, 2026-11-19.
--
-- Everything here is INERT until the wired-* edge functions exist (W3+), and the whole
-- feature ships dark behind WIRED_ENABLED (section 18 answer 18).
--
-- Rules kept (spec section 3):
--   - children's data minimum: per child only nickname, grade and quiz year (rule 6);
--   - every new table: RLS on, NO policies, grants to service_role BY NAME only; anon and
--     authenticated reach nothing here directly (rule 9; src/test/newTableGrants.test.ts).
--     This project's default privileges STILL auto-grant every new public table to anon and
--     authenticated (pg_default_acl, read 2026-11-19), so each table revokes them by name
--     first, the house pattern from 20261117225940_client_error_reports.sql;
--   - no citext: text + a unique index on lower(email) (section 18 answer 19).
--
-- Deliberate differences from section 4, each because section 18 or another section
-- says so (written back to Lane NP in the day's notes):
--   - wired_families has no deleted_at and no state: delete is a HARD delete plus a
--     tombstone (7.6, answer 10); state lives in wired_family_prefs (answer 9).
--   - wired_sessions carries no filters / priority_ranking (moved to wired_family_prefs,
--     answer 9), and its one-quiz-per-rater-per-year key INCLUDES family_id: with
--     NULLS NOT DISTINCT (answer 8) the mom/adult session has child_id null, so without
--     family_id every family's adult quiz would collide with every other family's.
--   - wired_buyers gains quiz_year (the $28 upgrade checks a same-quiz-year Blueprint,
--     9.2 / answer 2), stripe_customer_id, refunded_at, disputed_at (answer 15), and
--     family_id is nullable ON DELETE SET NULL (financial records survive a delete, 7.6).
--   - Not in W1, each lands with the ticket that uses it: the pilot tables and surveys
--     (W12; their shape follows the pilot build), nurture_send_log (W8, the shared
--     one-a-day guard across all queues), the punch-list partial unique index (W10),
--     the curriculum enum CHECKs (follow-up after the Sheet is vetted, answer 18).
--
-- Idempotent: every create is IF NOT EXISTS; the function swap is DROP + CREATE.
-- ============================================================================

-- ── 1. Question banks ───────────────────────────────────────────────────────
create table if not exists public.wired_question_banks (
  version     text primary key,
  set_kind    text not null check (set_kind in ('k2', 'g3_5', 'g6_8', 'g9_12', 'teen', 'adult')),
  bank        jsonb not null,
  active      boolean not null default false,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
-- Exactly one active version per set.
create unique index if not exists wired_question_banks_one_active
  on public.wired_question_banks (set_kind) where active;
alter table public.wired_question_banks enable row level security;
revoke all on table public.wired_question_banks from anon, authenticated;
grant select, insert, update, delete on table public.wired_question_banks to service_role;

-- ── 2. Families (one per email; no login) ──────────────────────────────────
create table if not exists public.wired_families (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (length(email) between 3 and 254),
  first_name text check (first_name is null or length(first_name) <= 60),
  created_at timestamptz not null default now()
);
create unique index if not exists wired_families_email_lower_uniq on public.wired_families (lower(email));
alter table public.wired_families enable row level security;
revoke all on table public.wired_families from anon, authenticated;
grant select, insert, update, delete on table public.wired_families to service_role;

-- ── 3. Children (nickname, grade, nothing else) ────────────────────────────
create table if not exists public.wired_children (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.wired_families (id) on delete cascade,
  nickname     text not null check (length(btrim(nickname)) between 1 and 40),
  grade        integer not null check (grade between 0 and 12),
  free_slot    boolean not null default false,
  unlocked_via text check (unlocked_via in ('free', 'blueprint', 'family_map', 'pilot')),
  unlocked_at  timestamptz,
  created_at   timestamptz not null default now(),
  removed_at   timestamptz
);
create index if not exists wired_children_family_idx on public.wired_children (family_id);
alter table public.wired_children enable row level security;
revoke all on table public.wired_children from anon, authenticated;
grant select, insert, update, delete on table public.wired_children to service_role;

-- An unlock is for good (DECIDED 11/17: "retests free for good"): once unlocked_via is
-- set it can never go back to null. Changing it (e.g. free -> family_map) is allowed.
create or replace function public.wired_children_unlock_is_sticky()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.unlocked_via is not null and new.unlocked_via is null then
    raise exception 'wired_children.unlocked_via cannot be cleared once set (child %)', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.wired_children_unlock_is_sticky() from public, anon, authenticated;
drop trigger if exists wired_children_unlock_sticky on public.wired_children;
create trigger wired_children_unlock_sticky
  before update of unlocked_via on public.wired_children
  for each row execute function public.wired_children_unlock_is_sticky();

-- ── 4. Observers (Blueprint feature; never on any email list) ──────────────
create table if not exists public.wired_observers (
  id                       uuid primary key default gen_random_uuid(),
  family_id                uuid not null references public.wired_families (id) on delete cascade,
  child_id                 uuid not null references public.wired_children (id) on delete cascade,
  -- Nulled (hard-deleted) when mom removes the observer, on her delete request, or after
  -- two Julys with no retest of that child (section 4 deletion rule); deleted_at records when.
  email                    text check (email is null or length(email) between 3 and 254),
  label                    text check (label is null or length(label) <= 40),
  invited_at               timestamptz,
  reminder_sent_at         timestamptz,
  last_completed_quiz_year integer,
  created_at               timestamptz not null default now(),
  removed_at               timestamptz,
  deleted_at               timestamptz
);
create index if not exists wired_observers_child_idx on public.wired_observers (child_id);
alter table public.wired_observers enable row level security;
revoke all on table public.wired_observers from anon, authenticated;
grant select, insert, update, delete on table public.wired_observers to service_role;

-- ── 5. Sessions (one completed quiz by one rater) ──────────────────────────
create table if not exists public.wired_sessions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.wired_families (id) on delete cascade,
  child_id        uuid references public.wired_children (id) on delete cascade,  -- null = the mom/adult set
  rater_role      text not null check (rater_role in ('mom', 'teen', 'observer')),
  observer_id     uuid references public.wired_observers (id) on delete cascade,
  bank_version    text not null references public.wired_question_banks (version),
  quiz_year       integer not null check (quiz_year between 2026 and 2100),  -- school year starting July 1 (America/Chicago)
  grade_at_quiz   integer check (grade_at_quiz between 0 and 12),
  is_pilot_retake boolean not null default false,
  started_at      timestamptz,
  completed_at    timestamptz,
  raw_answers     jsonb not null,
  scores          jsonb,
  top3            text[],
  renaissance     boolean,
  engine_version  text,
  family_answers  jsonb,   -- mom only: the 6 family questions
  attribution     jsonb,   -- mom only: utm_*, placement, landing path
  created_at      timestamptz not null default now(),
  check ((rater_role = 'observer') = (observer_id is not null))
);
-- One completed quiz per rater per child (or per family, for the adult set) per year;
-- pilot 30-day retakes are kept as their own rows and sit outside the key.
create unique index if not exists wired_sessions_one_per_rater_year
  on public.wired_sessions (family_id, child_id, rater_role, observer_id, quiz_year) nulls not distinct
  where completed_at is not null and not is_pilot_retake;
create index if not exists wired_sessions_child_idx on public.wired_sessions (child_id, quiz_year);
create index if not exists wired_sessions_family_idx on public.wired_sessions (family_id);
alter table public.wired_sessions enable row level security;
revoke all on table public.wired_sessions from anon, authenticated;
grant select, insert, update, delete on table public.wired_sessions to service_role;

-- ── 6. Results ─────────────────────────────────────────────────────────────
-- The blended profile per child per year, recomputed whenever a rater completes.
create table if not exists public.wired_results (
  child_id         uuid not null references public.wired_children (id) on delete cascade,
  quiz_year        integer not null,
  blended_scores   jsonb not null,
  top3             text[] not null,
  renaissance      boolean not null default false,
  weights          jsonb not null,
  session_ids      uuid[] not null,
  matches_snapshot jsonb,
  engine_version   text not null,
  computed_at      timestamptz not null default now(),
  primary key (child_id, quiz_year)
);
alter table public.wired_results enable row level security;
revoke all on table public.wired_results from anon, authenticated;
grant select, insert, update, delete on table public.wired_results to service_role;

-- Mom's own (adult set) result per year (section 18 answer 8).
create table if not exists public.wired_family_results (
  family_id      uuid not null references public.wired_families (id) on delete cascade,
  quiz_year      integer not null,
  adult_scores   jsonb not null,
  teaching_style jsonb,
  session_id     uuid references public.wired_sessions (id) on delete set null,
  computed_at    timestamptz not null default now(),
  primary key (family_id, quiz_year)
);
alter table public.wired_family_results enable row level security;
revoke all on table public.wired_family_results from anon, authenticated;
grant select, insert, update, delete on table public.wired_family_results to service_role;

-- Filters, ranking and state, written only by wired-matches (section 18 answer 9).
create table if not exists public.wired_family_prefs (
  family_id        uuid primary key references public.wired_families (id) on delete cascade,
  filters          jsonb,
  priority_ranking text[],
  state            char(2),
  updated_at       timestamptz not null default now()
);
alter table public.wired_family_prefs enable row level security;
revoke all on table public.wired_family_prefs from anon, authenticated;
grant select, insert, update, delete on table public.wired_family_prefs to service_role;

-- ── 7. Teen links (single use; no teen name or email, ever) ────────────────
create table if not exists public.wired_teen_links (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.wired_children (id) on delete cascade,
  quiz_year  integer not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
alter table public.wired_teen_links enable row level security;
revoke all on table public.wired_teen_links from anon, authenticated;
grant select, insert, update, delete on table public.wired_teen_links to service_role;

-- ── 8. Checkout, unlocks, buyers, credits ──────────────────────────────────
-- Verified before charging; only this row's id goes into Stripe metadata (answer 2).
create table if not exists public.wired_pending_checkouts (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.wired_families (id) on delete cascade,
  product           text not null check (product in ('blueprint', 'family_map', 'blueprint_upgrade', 'family_map_upgrade')),
  child_ids         uuid[] not null default '{}',
  quiz_year         integer not null,
  extra_children    integer not null default 0 check (extra_children >= 0),
  stripe_session_id text unique,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null
);
create index if not exists wired_pending_checkouts_family_idx on public.wired_pending_checkouts (family_id);
alter table public.wired_pending_checkouts enable row level security;
revoke all on table public.wired_pending_checkouts from anon, authenticated;
grant select, insert, update, delete on table public.wired_pending_checkouts to service_role;

-- Audit trail of every unlock (wired_children.unlocked_via is the fast read).
create table if not exists public.wired_unlocks (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.wired_families (id) on delete cascade,
  child_id   uuid references public.wired_children (id) on delete cascade,
  product    text not null check (product in ('blueprint', 'family_map', 'pilot_blueprint', 'pilot_family_map')),
  order_id   uuid references public.orders (id) on delete set null,
  granted_at timestamptz not null default now()
);
create index if not exists wired_unlocks_family_idx on public.wired_unlocks (family_id);
alter table public.wired_unlocks enable row level security;
revoke all on table public.wired_unlocks from anon, authenticated;
grant select, insert, update, delete on table public.wired_unlocks to service_role;

-- The buyer record the Sept 14 law requires: one row per paid order. Kept after a family
-- deletes its quiz data (financial record; family link nulled, 7.6).
create table if not exists public.wired_buyers (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid references public.wired_families (id) on delete set null,
  order_id           uuid references public.orders (id) on delete set null,
  email              text not null,
  purchaser_name     text,
  product            text not null,
  amount_cents       integer not null check (amount_cents >= 0),
  quiz_year          integer not null,
  channel            text not null default 'stripe',
  stripe_customer_id text,
  purchased_at       timestamptz not null default now(),
  credit_minted_at   timestamptz,
  refunded_at        timestamptz,
  disputed_at        timestamptz
);
create unique index if not exists wired_buyers_order_product_uniq on public.wired_buyers (order_id, product);
create index if not exists wired_buyers_email_lower_idx on public.wired_buyers (lower(email));
alter table public.wired_buyers enable row level security;
revoke all on table public.wired_buyers from anon, authenticated;
grant select, insert, update, delete on table public.wired_buyers to service_role;

-- Built, switched OFF (WIRED_CREDITS_ENABLED false): stays empty until Camila turns it on
-- after the kits go live (section 9.6). Same shape as starter_credits.
create table if not exists public.wired_credits (
  id                       uuid primary key default gen_random_uuid(),
  buyer_id                 uuid references public.wired_buyers (id) on delete set null,
  email                    text not null,
  purchaser_name           text,
  stripe_customer_id       text,
  stripe_promotion_code_id text,
  code                     text,
  amount_cents             integer not null check (amount_cents > 0),
  issued_at                timestamptz,
  redeemed_at              timestamptz,
  redeemed_order_id        uuid,
  redeemed_session_id      text,
  deactivated_at           timestamptz,
  deactivated_reason       text,
  created_at               timestamptz not null default now()
);
alter table public.wired_credits enable row level security;
revoke all on table public.wired_credits from anon, authenticated;
grant select, insert, update, delete on table public.wired_credits to service_role;

-- "2 free children per email, ever" and once-a-year survive a delete (answer 10).
-- email_hash = SHA-256 of lower(email) with a server-side pepper (never stored here).
create table if not exists public.wired_tombstones (
  email_hash      text primary key,
  free_slots_used integer not null default 0 check (free_slots_used between 0 and 2),
  last_quiz_year  integer,
  deleted_at      timestamptz not null default now()
);
alter table public.wired_tombstones enable row level security;
revoke all on table public.wired_tombstones from anon, authenticated;
grant select, insert, update, delete on table public.wired_tombstones to service_role;

-- ── 9. Curriculum database (approved rows only ever reach the public, via wired-matches) ──
create table if not exists public.wired_curricula (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  publisher          text,
  approach           text,             -- enum CHECKs in a follow-up migration (answer 18)
  approach_secondary text,
  subjects           text[] not null default '{}',
  grade_min          integer check (grade_min between 0 and 12),
  grade_max          integer check (grade_max between 0 and 12),
  domains_served     text[] not null default '{}',
  prep_load          text,
  price_cents        integer check (price_cents >= 0),
  price_basis        text,
  multi_age          boolean not null default false,
  faith_alignment    text,
  url                text,
  affiliate_url      text,
  is_affiliate       boolean not null default false,  -- never read by ranking (rule 3)
  eden_band          text,
  coming_soon        boolean not null default false,
  approved           boolean not null default false,
  approved_at        timestamptz,
  last_verified_at   timestamptz,
  -- Founder-only outreach fields: never returned by any public function, never ranked.
  dm_name            text,
  dm_role            text,
  dm_email           text,
  dm_source_url      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (grade_min is null or grade_max is null or grade_min <= grade_max)
);
create index if not exists wired_curricula_approved_idx on public.wired_curricula (approved, grade_min, grade_max);
alter table public.wired_curricula enable row level security;
revoke all on table public.wired_curricula from anon, authenticated;
grant select, insert, update, delete on table public.wired_curricula to service_role;

create table if not exists public.wired_curriculum_esa (
  curriculum_id uuid not null references public.wired_curricula (id) on delete cascade,
  state         char(2) not null,
  program       text not null,
  eligible      text not null default 'unknown' check (eligible in ('yes', 'no', 'unknown')),
  verified_at   date,
  source_url    text,
  notes         text,
  primary key (curriculum_id, state, program)
);
alter table public.wired_curriculum_esa enable row level security;
revoke all on table public.wired_curriculum_esa from anon, authenticated;
grant select, insert, update, delete on table public.wired_curriculum_esa to service_role;

-- Change history with rollback: every insert / update / delete on the two tables above.
create table if not exists public.wired_curricula_history (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null check (table_name in ('wired_curricula', 'wired_curriculum_esa')),
  curriculum_id uuid,            -- no FK: history outlives a deleted row
  op            text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  changed_at    timestamptz not null default now(),
  changed_by    text,
  before        jsonb,
  after         jsonb
);
create index if not exists wired_curricula_history_curriculum_idx
  on public.wired_curricula_history (curriculum_id, changed_at desc);
alter table public.wired_curricula_history enable row level security;
revoke all on table public.wired_curricula_history from anon, authenticated;
grant select, insert, update, delete on table public.wired_curricula_history to service_role;

create or replace function public.wired_curricula_log_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_by text;
  v_curriculum uuid;
begin
  -- Who: the founder's JWT email when the admin RPCs run as her (answer 16), else the role.
  begin
    v_by := coalesce(auth.jwt() ->> 'email', auth.jwt() ->> 'sub');
  exception when others then
    v_by := null;
  end;
  v_by := coalesce(v_by, current_user);

  if tg_table_name = 'wired_curricula' then
    v_curriculum := coalesce(new.id, old.id);
  else
    v_curriculum := coalesce(new.curriculum_id, old.curriculum_id);
  end if;

  insert into public.wired_curricula_history (table_name, curriculum_id, op, changed_by, before, after)
  values (
    tg_table_name,
    v_curriculum,
    tg_op,
    v_by,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.wired_curricula_log_change() from public, anon, authenticated;

drop trigger if exists wired_curricula_history_log on public.wired_curricula;
create trigger wired_curricula_history_log
  after insert or update or delete on public.wired_curricula
  for each row execute function public.wired_curricula_log_change();

drop trigger if exists wired_curriculum_esa_history_log on public.wired_curriculum_esa;
create trigger wired_curriculum_esa_history_log
  after insert or update or delete on public.wired_curriculum_esa
  for each row execute function public.wired_curricula_log_change();

-- ── 10. Email queue + dead letter ──────────────────────────────────────────
create table if not exists public.wired_email_queue (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid references public.wired_families (id) on delete cascade,
  email          text not null,
  child_id       uuid references public.wired_children (id) on delete cascade,
  observer_id    uuid references public.wired_observers (id) on delete cascade,
  kind           text not null check (kind in ('drip', 'july', 'observer_invite', 'observer_reminder', 'teen_ready', 'pdf_update')),
  position       integer,
  domain         text,
  band           text,
  scheduled_for  timestamptz not null,
  sent_at        timestamptz,
  failed_at      timestamptz,
  retry_count    integer not null default 0,
  resend_id      text,
  skipped_reason text,
  created_at     timestamptz not null default now()
);
create index if not exists wired_email_queue_due_idx
  on public.wired_email_queue (scheduled_for) where sent_at is null and failed_at is null and skipped_reason is null;
create index if not exists wired_email_queue_email_lower_idx on public.wired_email_queue (lower(email));
alter table public.wired_email_queue enable row level security;
revoke all on table public.wired_email_queue from anon, authenticated;
grant select, insert, update, delete on table public.wired_email_queue to service_role;

-- Dead letter for wired-submit (model quiz_completion_failures). email_lower lets a delete
-- request purge that address's payloads (answer 10).
create table if not exists public.wired_failures (
  id               uuid primary key default gen_random_uuid(),
  email_lower      text,
  raw_payload      jsonb not null,
  postgrest_status integer,
  postgrest_body   text,
  ef_error_message text,
  retry_count      integer not null default 0,
  last_retry_at    timestamptz,
  last_retry_status integer,
  resolved_at      timestamptz,
  notes            text,
  received_at      timestamptz not null default now()
);
create index if not exists wired_failures_open_idx on public.wired_failures (received_at) where resolved_at is null;
create index if not exists wired_failures_email_idx on public.wired_failures (email_lower);
alter table public.wired_failures enable row level security;
revoke all on table public.wired_failures from anon, authenticated;
grant select, insert, update, delete on table public.wired_failures to service_role;

-- ── 11. cta_events.placement + ONE 4-argument record_cta_click (answer 13) ──
-- Header vs pop-up vs inline on the same page can now be told apart. The old 3-argument
-- function is dropped and replaced by one with p_placement default null, so every existing
-- 3-argument call (named args through PostgREST) resolves to it unchanged; execute is
-- re-granted exactly as before (anon, authenticated). Body = the live function
-- (pg_get_functiondef, 2026-11-19) plus the placement column.
alter table public.cta_events add column if not exists placement text;

drop function if exists public.record_cta_click(text, text, text);

create or replace function public.record_cta_click(
  p_cta text,
  p_path text default null::text,
  p_lookup_key text default null::text,
  p_placement text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_headers jsonb;
  v_ua text; v_ip text; v_salt text; v_day text; v_hash text;
  v_cta text; v_path text; v_key text; v_place text; v_bot boolean;
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
  v_place := nullif(left(trim(coalesce(p_placement, '')), 50), '');

  v_bot := v_ua ~* '(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|lighthouse|preview|curl|wget|python-requests|axios|node-fetch|semrush|ahrefs|dataprovider)';

  v_day  := (now() at time zone 'America/Chicago')::date::text;
  select salt into v_salt from public.analytics_salt where id = 1;
  v_hash := left(encode(extensions.digest(v_ip || '|' || v_ua || '|' || coalesce(v_salt,'') || '|' || v_day, 'sha256'), 'hex'), 16);

  -- Soft flood cap (speed bump only: the hash changes with the user-agent).
  if (select count(*) from public.cta_events
       where visitor_hash = v_hash and occurred_at > now() - interval '1 minute') >= 60 then
    return;
  end if;

  insert into public.cta_events (cta, path, lookup_key, placement, visitor_hash, is_bot)
  values (v_cta, v_path, v_key, v_place, v_hash, coalesce(v_bot, false));
end;
$function$;

-- Live grants on the old function (has_function_privilege, 2026-11-19): anon, authenticated,
-- service_role; not PUBLIC. Same here, every role named.
revoke execute on function public.record_cta_click(text, text, text, text) from public;
grant execute on function public.record_cta_click(text, text, text, text) to anon, authenticated, service_role;
