-- =============================================================================
-- Eden Apothecary — Row-Level Security + Tier-Gated Views
-- Migration date: 2026-04-21
-- Target: Supabase (Postgres), Sandbox first then Live (post-launch week)
-- Manual ref:  v1.6 §1.5, §7.2, §9.2, §16.2  (manual corrections land in v1.7)
-- =============================================================================
--
-- SCHEMA VERIFIED against live Sandbox on 2026-04-21. This file uses the
-- actual column/table names that exist in the Supabase project
-- noeqztssupewjidpvhar. No placeholders.
--
-- WHAT THIS DOES
--   (1) Helper functions  current_user_tier() and current_user_at_least()
--       for readable RLS expressions.
--   (2) profiles RLS       — user reads/writes own row; subscription fields
--                            are stripe-webhook-owned (service_role bypass).
--   (3) herbs base-table lockdown — no client reads. herbs_public is the
--       public read surface; herbs_clinical_v is the Seed+ read surface.
--   (4) herbs_public  — grant SELECT to anon + authenticated (already a
--                       curated 50-row table of free-tier herbs).
--   (5) herbs_clinical_v  — new VIEW joining herbs with clinical depth,
--                           RLS-gated to Seed+.
--   (6) Junction tables (12) — Seed+ reads. service_role writes.
--   (7) Dimension tables     — fully public read (terminology).
--   (8) contraindications    — severity 'high'|'absolute' public via view;
--                              full table Seed+.
--   (9) refer_out_triggers   — fully public read (clinical safety).
--  (10) Metadata (sources, citations, schema_*, synonyms) — public read.
--  (11) subscription_events — service_role only (webhook audit log).
--
-- WHAT THIS DOES NOT DO
--   • No quiz_completions / tier_2_waitlist policies — neither table exists
--     in this Supabase project (Institute side has not yet migrated them or
--     stores waitlist only in Resend audience 4860c1c5-...).
--   • No person_profiles / assessments — both are Phase 2 (Digestive sprint,
--     Fall 2026). DDL + RLS ship with that sprint.
--
-- ARCHITECTURAL DECISIONS (locked 2026-04-21)
--   A. profiles is canonical subscription state. No separate subscriptions
--      table. Manual §8.5 subscriptions entry is stale — remove in v1.7.
--   B. Tier gating is expressed at the Postgres layer via a helper function
--      (current_user_at_least) and RLS policies on every gated surface.
--      Client reads never bypass the database layer.
--   C. The public herb surface is an actual TABLE (herbs_public, 50 rows)
--      maintained separately from the full herbs table. Phase 1 semantics:
--      anon + free users see 50 free-tier monographs in the directory; the
--      other 50 herbs exist but are not surfaced publicly — their names are
--      visible only to Seed+.  (See §TODO-ANON-BROWSE-MODEL below — the
--      manual's §1.5 "full 100-herb directory with basic monographs" wording
--      implies 100 visible. If confirmed, populate herbs_public with all
--      100 rows — no schema change needed.)
--   D. Clinical-depth surface is a view (herbs_clinical_v) joining herbs
--      with junction tables + their dimension tables. Seed+ only.
--   E. Safety floor (severity high|absolute contraindications) is public
--      even for anon. Full contraindication detail (mechanism, guidance,
--      citation) is Seed+.
--
-- IDEMPOTENCY
--   All CREATE OR REPLACE / DROP IF EXISTS so re-running is safe.
--
-- =============================================================================


-- =============================================================================
-- 1 · Helper functions
-- =============================================================================
-- current_user_tier() returns the requesting user's subscription_tier enum
-- cast to text.  Returns 'free' for anon or if no profile row / no active sub.
-- SECURITY DEFINER so it can read profiles regardless of RLS state.
-- STABLE + sql so Postgres can inline it inside policies.

create or replace function public.current_user_tier()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.subscription_tier::text
       from public.profiles p
      where p.user_id = auth.uid()
        and p.subscription_status in ('active', 'trialing')),
    'free'
  );
$$;

revoke all on function public.current_user_tier() from public;
grant execute on function public.current_user_tier() to anon, authenticated, service_role;

comment on function public.current_user_tier() is
  'Returns requesting user tier for RLS gating. free | seed | root | practitioner. Manual §2.2.';

-- Ordinal comparator — hierarchical tier check.
-- Ordering: free(1) < seed(2) < root(3) < practitioner(4).

create or replace function public.current_user_at_least(min_tier text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case public.current_user_tier()
      when 'practitioner' then 4
      when 'root'         then 3
      when 'seed'         then 2
      else                     1
    end
    >=
    case min_tier
      when 'practitioner' then 4
      when 'root'         then 3
      when 'seed'         then 2
      else                     1
    end;
$$;

revoke all on function public.current_user_at_least(text) from public;
grant execute on function public.current_user_at_least(text)
  to anon, authenticated, service_role;

comment on function public.current_user_at_least(text) is
  'Tier gate comparator. Example: where public.current_user_at_least(''seed'').';


-- =============================================================================
-- 2 · profiles  — self-scoped RLS
-- =============================================================================
-- Schema: user_id*, email, display_name, stripe_customer_id,
-- stripe_subscription_id, subscription_tier*, subscription_status,
-- current_period_start, current_period_end, cancel_at_period_end,
-- is_founding_member*, founding_rate_price_id, created_at*, updated_at*

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select"  on public.profiles;
drop policy if exists "profiles_self_update"  on public.profiles;

-- Read own row
create policy "profiles_self_select" on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

-- Update own row — but Stripe-owned fields are locked.
-- Client can change display_name (and email if you expose it in the UI).
-- Subscription/period/customer fields are written only by stripe-webhook
-- (service_role, which bypasses RLS).
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and stripe_customer_id       is not distinct from (select stripe_customer_id       from public.profiles where user_id = auth.uid())
    and stripe_subscription_id   is not distinct from (select stripe_subscription_id   from public.profiles where user_id = auth.uid())
    and subscription_tier        is not distinct from (select subscription_tier        from public.profiles where user_id = auth.uid())
    and subscription_status      is not distinct from (select subscription_status      from public.profiles where user_id = auth.uid())
    and current_period_start     is not distinct from (select current_period_start     from public.profiles where user_id = auth.uid())
    and current_period_end       is not distinct from (select current_period_end       from public.profiles where user_id = auth.uid())
    and cancel_at_period_end     is not distinct from (select cancel_at_period_end     from public.profiles where user_id = auth.uid())
    and is_founding_member       is not distinct from (select is_founding_member       from public.profiles where user_id = auth.uid())
    and founding_rate_price_id   is not distinct from (select founding_rate_price_id   from public.profiles where user_id = auth.uid())
  );

-- No INSERT / DELETE from client. Profiles are seeded by an auth trigger
-- (verify handle_new_user() exists — see §TODO-PROFILE-SEED at bottom).


-- =============================================================================
-- 3 · herbs base table — no client reads
-- =============================================================================
-- The full herbs row (clinical depth, sources, dosages) is never returned
-- to the client directly. Client reads go through either herbs_public (the
-- curated 50-row free surface) or herbs_clinical_v (the Seed+ view).

alter table public.herbs enable row level security;

drop policy if exists "herbs_no_client_read" on public.herbs;

create policy "herbs_no_client_read" on public.herbs
  for select to authenticated, anon
  using (false);

-- No client writes either. service_role bypass (used by admin loads + future
-- herb-editor Edge Functions) is automatic.


-- =============================================================================
-- 4 · herbs_public — public read surface (VIEW, 50-row filtered subset)
-- =============================================================================
-- SCHEMA CORRECTION (2026-04-21): herbs_public is a VIEW, not a table.
-- Definition (verified live):
--   SELECT herb_id, common_name, latin_name, plant_family, part_used, taste,
--          temperature, moisture, pronunciation, image_filename,
--          energetics_summary, stewardship_note, cautions,
--          contraindications_general, pregnancy_safety, breastfeeding_safety,
--          children_safety, biblical_traditional_reference, status,
--          tier_visibility
--   FROM herbs
--   WHERE tier_visibility = 'free'::subscription_tier OR tier_visibility IS NULL;
--
-- Views do not support RLS policies directly. Security model here:
--   • herbs (the base table) is locked to no-client-reads in §3.
--   • herbs_public runs with security_invoker = FALSE (owner's privileges)
--     so the view BYPASSES the RLS on herbs and returns the 50 free rows
--     when queried by anon / authenticated.
--   • security_barrier = TRUE prevents query-predicate pushdown leaks.
--   • SELECT grant to anon + authenticated is how access is opened.
--   • No write path — views are read-only, and writes to herbs are blocked.

alter view public.herbs_public set (security_invoker = false, security_barrier = true);

grant select on public.herbs_public to anon, authenticated;

-- (Writes to herbs itself are blocked by §3. service_role bypasses RLS for
--  admin loads and future herb-editor Edge Functions.)


-- =============================================================================
-- 5 · herbs_clinical_v — clinical-depth view (Seed+)
-- =============================================================================
-- Joins the full herbs row with its junction-table relationships rendered as
-- aggregate arrays. Frontend receives one row per herb with arrays of actions,
-- tissue states, systems, complaints, etc.
--
-- CONSISTENCY WITH §3: herbs is locked with RLS using (false) — no client
-- reads via base table. For this clinical view to return rows to Seed+
-- callers, it must run with security_invoker = FALSE so the join cascade
-- executes under the view owner (bypasses herbs RLS and junction RLS).
--
-- Access control is enforced at TWO layers that do not rely on RLS:
--   (a) The WHERE clause of this view:
--         where public.current_user_at_least('seed')
--       evaluates against the CALLING session (via auth.jwt()/auth.uid()
--       inside current_user_tier()), so free / anon callers receive zero
--       rows even though the view runs as owner.
--   (b) security_barrier = TRUE prevents predicate-leakage optimizations.
--
-- The junction-table RLS (§6) is a defense-in-depth layer protecting
-- DIRECT client queries on junction tables outside this view.

drop view if exists public.herbs_clinical_v cascade;

create view public.herbs_clinical_v
with (security_invoker = false, security_barrier = true) as
select
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.taste,
  h.temperature,
  h.moisture,
  h.tissue_states_indicated,
  h.tissue_states_contraindicated,
  h.system_affinity,
  h.chief_complaints,
  h.western_constitution_match,
  h.ayurvedic_dosha_match,
  h.ayurvedic_dosha_aggravates,
  h.tcm_pattern_match,
  h.tcm_contraindicated_patterns,
  h.cautions,
  h.contraindications_general,
  h.pregnancy_safety,
  h.breastfeeding_safety,
  h.children_safety,
  h.drug_interactions,
  h.preparation_methods,
  h.dosage_notes,
  h.primary_sources,
  h.secondary_sources,
  h.tier_visibility,
  h.notes,
  h.biblical_traditional_reference,
  h.stewardship_note,
  h.energetics_summary,
  h.refer_threshold,
  h.pronunciation,
  h.image_filename,
  h.status,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'action_id', a.action_id, 'action_name', a.action_name,
      'strength', ha.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_actions ha
   join public.actions a on a.action_id = ha.action_id
   where ha.herb_id = h.herb_id) as actions,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'state_id', ts.state_id, 'state_name', ts.state_name,
      'strength', hts.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_tissue_states_indicated hts
   join public.tissue_states ts on ts.state_id = hts.state_id
   where hts.herb_id = h.herb_id) as tissue_states_indicated_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'state_id', ts.state_id, 'state_name', ts.state_name,
      'strength', htsc.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_tissue_states_contraindicated htsc
   join public.tissue_states ts on ts.state_id = htsc.state_id
   where htsc.herb_id = h.herb_id) as tissue_states_contraindicated_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'system_id', bs.system_id, 'system_name', bs.system_name,
      'strength', hs.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_systems hs
   join public.body_systems bs on bs.system_id = hs.system_id
   where hs.herb_id = h.herb_id) as systems_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'complaint_id', cpl.complaint_id, 'complaint_name', cpl.complaint_name,
      'strength', hc.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_complaints hc
   join public.complaints cpl on cpl.complaint_id = hc.complaint_id
   where hc.herb_id = h.herb_id) as complaints_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'taste_id', t.taste_id, 'taste_name', t.taste_name
    )), '[]'::jsonb)
   from public.herbs_tastes ht
   join public.tastes t on t.taste_id = ht.taste_id
   where ht.herb_id = h.herb_id) as tastes_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'constitution_id', c.constitution_id, 'name', c.name,
      'relationship', hc2.relationship,
      'strength', hc2.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_constitutions hc2
   join public.constitutions c on c.constitution_id = hc2.constitution_id
   where hc2.herb_id = h.herb_id) as constitutions_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'pattern_id', p.pattern_id, 'pattern_name', p.pattern_name,
      'strength', htci.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_tcm_indicated htci
   join public.tcm_patterns p on p.pattern_id = htci.pattern_id
   where htci.herb_id = h.herb_id) as tcm_indicated_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'pattern_id', p.pattern_id, 'pattern_name', p.pattern_name,
      'strength', htcc.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_tcm_contraindicated htcc
   join public.tcm_patterns p on p.pattern_id = htcc.pattern_id
   where htcc.herb_id = h.herb_id) as tcm_contraindicated_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'dosha_id', d.dosha_id, 'dosha_name', d.dosha_name,
      'strength', hdm.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_doshas_match hdm
   join public.doshas d on d.dosha_id = hdm.dosha_id
   where hdm.herb_id = h.herb_id) as doshas_match_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'dosha_id', d.dosha_id, 'dosha_name', d.dosha_name,
      'strength', hda.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_doshas_aggravates hda
   join public.doshas d on d.dosha_id = hda.dosha_id
   where hda.herb_id = h.herb_id) as doshas_aggravates_rel,
  (select coalesce(jsonb_agg(jsonb_build_object(
      'prep_id', pr.prep_id, 'preparation_name', pr.preparation_name,
      'strength', hp.strength_of_indication
    )), '[]'::jsonb)
   from public.herbs_preparations hp
   join public.preparations pr on pr.prep_id = hp.prep_id
   where hp.herb_id = h.herb_id) as preparations_rel
from public.herbs h
where public.current_user_at_least('seed');

comment on view public.herbs_clinical_v is
  'Full clinical monograph with relational depth. Seed+ only. Manual §7.2.';

grant select on public.herbs_clinical_v to authenticated;


-- =============================================================================
-- 6 · Junction tables — Seed+ reads
-- =============================================================================
-- 12 junction tables. Clinical IP. Direct access Seed+.
-- (herbs_clinical_v reads them via security_invoker so authenticated-Seed+
-- users get the joined rows; anon/free get nothing.)

do $$
declare jt text;
declare junction_tables text[] := array[
  'herbs_actions',
  'herbs_complaints',
  'herbs_constitutions',
  'herbs_doshas_aggravates',
  'herbs_doshas_match',
  'herbs_preparations',
  'herbs_systems',
  'herbs_tastes',
  'herbs_tcm_contraindicated',
  'herbs_tcm_indicated',
  'herbs_tissue_states_contraindicated',
  'herbs_tissue_states_indicated'
];
begin
  foreach jt in array junction_tables
  loop
    execute format('alter table public.%I enable row level security;', jt);
    execute format('drop policy if exists "%I_seed_read" on public.%I;', jt, jt);
    execute format(
      $p$create policy "%I_seed_read" on public.%I for select to authenticated using (public.current_user_at_least('seed'));$p$,
      jt, jt
    );
  end loop;
end$$;


-- =============================================================================
-- 7 · Dimension tables — public read (terminology)
-- =============================================================================

do $$
declare dt text;
declare dimension_tables text[] := array[
  'actions',
  'body_systems',
  'complaints',
  'conditions',
  'constitutions',
  'doshas',
  'preparations',
  'tastes',
  'tcm_patterns',
  'tissue_states'
];
begin
  foreach dt in array dimension_tables
  loop
    execute format('alter table public.%I enable row level security;', dt);
    execute format('drop policy if exists "%I_public_read" on public.%I;', dt, dt);
    execute format(
      'create policy "%I_public_read" on public.%I for select to anon, authenticated using (true);',
      dt, dt
    );
  end loop;
end$$;


-- =============================================================================
-- 8 · contraindications — safety floor public, full detail Seed+
-- =============================================================================
-- severity_level enum:  low | moderate | high | absolute
-- contraindication_kind enum:  drug_interaction | condition | population
--                              | pregnancy | breastfeeding | pediatric
--                              | geriatric | other
--
-- Safety reasoning: any contraindication tagged 'high' or 'absolute' is shown
-- to anon + free (they must know before using). Lower-severity entries and
-- mechanism/rationale/citation detail require Seed+.

alter table public.contraindications enable row level security;

drop policy if exists "contra_seed_read" on public.contraindications;

create policy "contra_seed_read" on public.contraindications
  for select to authenticated
  using (public.current_user_at_least('seed'));

-- Public safety-floor view
drop view if exists public.contraindications_safety_v cascade;

create view public.contraindications_safety_v
with (security_invoker = false, security_barrier = true) as
select
  c.contraindication_id,
  c.herb_id,
  c.type,
  c.interacting_entity,
  c.severity,
  c.clinical_guidance
from public.contraindications c
where c.severity in ('high', 'absolute');

comment on view public.contraindications_safety_v is
  'Safety floor: high + absolute severity contraindications. Public read.';

grant select on public.contraindications_safety_v to anon, authenticated;


-- =============================================================================
-- 9 · refer_out_triggers — public (clinical safety)
-- =============================================================================

alter table public.refer_out_triggers enable row level security;

drop policy if exists "refer_out_public_read" on public.refer_out_triggers;

create policy "refer_out_public_read" on public.refer_out_triggers
  for select to anon, authenticated
  using (true);


-- =============================================================================
-- 10 · Metadata tables — public read
-- =============================================================================
-- Sources, citations, synonyms, schema_fields, schema_version are all
-- reference/provenance data. Public read supports search + transparency.

do $$
declare mt text;
declare meta_tables text[] := array[
  'sources',
  'citations',
  'citations_herbs',
  'herb_synonyms',
  'complaint_synonyms',
  'schema_fields',
  'schema_version'
];
begin
  foreach mt in array meta_tables
  loop
    execute format('alter table public.%I enable row level security;', mt);
    execute format('drop policy if exists "%I_public_read" on public.%I;', mt, mt);
    execute format(
      'create policy "%I_public_read" on public.%I for select to anon, authenticated using (true);',
      mt, mt
    );
  end loop;
end$$;


-- =============================================================================
-- 11 · subscription_events — service_role only (webhook audit log)
-- =============================================================================
-- Columns: event_id (uuid PK), user_id (uuid, nullable),
-- stripe_event_id (text), stripe_event_type (text),
-- payload (jsonb), received_at (timestamptz).
-- No client reads. No client writes. service_role bypass handles inserts.

alter table public.subscription_events enable row level security;

-- No policies created => no client access. service_role bypasses RLS.


-- =============================================================================
-- §TODO-PROFILE-SEED  (verification, not a blocker for this migration)
-- =============================================================================
-- Confirm an auth trigger inserts a default profiles row on every
-- auth.users insert. If not, paste the following after the main migration.
-- (Likely already in place since Stripe checkout succeeded for test users.)
--
-- create or replace function public.handle_new_user()
-- returns trigger language plpgsql security definer set search_path = public
-- as $$ begin
--   insert into public.profiles (user_id, email, subscription_tier, subscription_status, created_at, updated_at)
--   values (new.id, new.email, 'free', 'active', now(), now())
--   on conflict (user_id) do nothing;
--   return new;
-- end $$;
--
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();


-- =============================================================================
-- §TODO-ANON-BROWSE-MODEL  (data question, not schema)
-- =============================================================================
-- herbs_public currently holds 50 rows (the 50 free-tier herbs). Manual §1.5
-- implies all 100 herbs should appear in the public directory with basic
-- monographs, with clinical depth gated. Options:
--   (a) Leave herbs_public at 50 rows. Anon + free see 50 herbs;
--       the other 50 appear as Seed+ locked cards in the directory UI,
--       populated from a view exposing herb_id + common_name + latin_name only.
--   (b) Populate herbs_public with all 100 rows (basic-monograph subset of
--       every herb). No schema change; a one-time upsert from herbs.
-- Decide before July 7 launch. Affects the frontend directory component.


-- =============================================================================
-- 12 · Verification queries — run manually after applying
-- =============================================================================
-- Use the Supabase SQL editor's "Role" dropdown (bottom-right) to switch
-- between the postgres role (service_role, bypasses RLS), authenticator →
-- anon, and authenticator → authenticated with specific JWTs.

-- ----- Row counts under service_role (sanity) -----
-- select 'profiles',     count(*) from public.profiles union all
-- select 'herbs',        count(*) from public.herbs union all
-- select 'herbs_public', count(*) from public.herbs_public;

-- ----- As anon -----
-- Expected: herbs_public returns 50 rows; herbs returns 0; herbs_clinical_v
-- returns 0; contraindications_safety_v returns rows tagged high|absolute;
-- dimension tables return all rows.
-- select count(*) from public.herbs_public;
-- select count(*) from public.herbs;
-- select count(*) from public.herbs_clinical_v;
-- select count(*) from public.contraindications_safety_v;
-- select count(*) from public.body_systems;

-- ----- As authenticated free-tier user -----
-- Same as anon. current_user_tier() returns 'free'.
-- select public.current_user_tier();

-- ----- As authenticated Seed user -----
-- Expected: herbs_public 50; herbs_clinical_v 100; full contraindications
-- visible (not just the safety-floor view); all junction tables readable.
-- select count(*) from public.herbs_clinical_v;
-- select count(*) from public.contraindications;
-- select count(*) from public.herbs_tastes;

-- ----- Tier comparator sanity -----
-- select public.current_user_at_least('seed'), public.current_user_at_least('root');


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
