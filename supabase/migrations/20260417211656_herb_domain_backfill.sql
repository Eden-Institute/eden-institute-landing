-- ============================================================================
-- 20260417211656_herb_domain_backfill.sql
-- ============================================================================
-- Purpose: Retroactively version-control the herb-domain schema that was
-- authored directly against noeqzts between March and April 17, 2026 via
-- Lovable/Supabase dashboard SQL and never committed as a migration.
--
-- Covers: 4 enums, 5 functions, 34 tables (columns, PKs, FKs, UNIQUE, CHECK),
-- indexes, 1 trigger, 1 view (herbs_public).
--
-- Excludes (already covered by committed migrations):
--   - quiz_completions (migration 20260304192045 + alterations)
--   - tier_2_waitlist (migration 20260417211655)
--   - Views herbs_clinical_v, contraindications_safety_v (PR #2 2026-04-21)
--   - Functions current_user_tier, current_user_at_least, handle_new_user (PR #2)
--   - Trigger on_auth_user_created (PR #2)
--   - RLS policies on profiles/herbs/contraindications/refer_out_triggers/subscription_events (PR #2)
--   - pg_trgm extension functions (installed by CREATE EXTENSION)
--
-- Idempotent. Timestamp 20260417211656 places this one second after tier_2_waitlist
-- creation and before the April 21 PR #2 migrations, so a fresh DB rebuild runs:
--   migrations 1-9 (quiz + tier_2_waitlist) -> this backfill (34 tables + herbs_public)
--   -> April 21 migrations (RLS + herbs_clinical_v + contraindications_safety_v + severity remap).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Extensions
-- --------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- --------------------------------------------------------------------------
-- 2. Enum types
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contraindication_kind' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.contraindication_kind AS ENUM ('drug_interaction', 'condition', 'population', 'pregnancy', 'breastfeeding', 'pediatric', 'geriatric', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_domain_flag' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.public_domain_flag AS ENUM ('yes', 'no', 'partial');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_level' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.severity_level AS ENUM ('low', 'moderate', 'high', 'absolute');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.subscription_tier AS ENUM ('free', 'seed', 'root', 'practitioner');
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 3. Tables (idempotent CREATE TABLE IF NOT EXISTS)
-- --------------------------------------------------------------------------

-- actions
CREATE TABLE IF NOT EXISTS public.actions (
  action_id text NOT NULL,
  action_name text NOT NULL,
  description text,
  clinical_examples text
);

-- body_systems
CREATE TABLE IF NOT EXISTS public.body_systems (
  system_id text NOT NULL,
  system_name text NOT NULL,
  description text
);

-- citations
CREATE TABLE IF NOT EXISTS public.citations (
  citation_id text NOT NULL,
  source_id text NOT NULL,
  page_section text,
  quote text NOT NULL
);

-- citations_herbs
CREATE TABLE IF NOT EXISTS public.citations_herbs (
  link_id bigint NOT NULL DEFAULT nextval('citations_herbs_link_id_seq'::regclass),
  citation_id text NOT NULL,
  herb_id text NOT NULL,
  field_cited text
);

-- complaint_synonyms
CREATE TABLE IF NOT EXISTS public.complaint_synonyms (
  synonym_id text NOT NULL,
  complaint_id text NOT NULL,
  synonym_phrase text NOT NULL
);

-- complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  complaint_id text NOT NULL,
  complaint_name text NOT NULL,
  body_system_id text,
  acuity text,
  refer_threshold text,
  stewardship_note text,
  description text,
  status text DEFAULT 'active'::text
);

-- conditions
CREATE TABLE IF NOT EXISTS public.conditions (
  condition_id text NOT NULL,
  name text NOT NULL,
  body_system_id text,
  icd_10 text,
  description text,
  refer_threshold text
);

-- constitutions
CREATE TABLE IF NOT EXISTS public.constitutions (
  constitution_id text NOT NULL,
  system text,
  name text NOT NULL,
  description text
);

-- contraindications
CREATE TABLE IF NOT EXISTS public.contraindications (
  contraindication_id text NOT NULL,
  herb_id text NOT NULL,
  type contraindication_kind NOT NULL,
  interacting_entity text NOT NULL,
  severity severity_level NOT NULL,
  mechanism_rationale text,
  clinical_guidance text,
  source_citation text
);

-- doshas
CREATE TABLE IF NOT EXISTS public.doshas (
  dosha_id text NOT NULL,
  system text NOT NULL DEFAULT 'Ayurveda'::text,
  dosha_name text NOT NULL,
  description text
);

-- herb_synonyms
CREATE TABLE IF NOT EXISTS public.herb_synonyms (
  synonym_id text NOT NULL,
  herb_id text NOT NULL,
  synonym_phrase text NOT NULL,
  type text
);

-- herbs
CREATE TABLE IF NOT EXISTS public.herbs (
  herb_id text NOT NULL,
  common_name text NOT NULL,
  latin_name text NOT NULL,
  plant_family text,
  part_used text,
  taste text,
  temperature text,
  moisture text,
  tissue_states_indicated text,
  tissue_states_contraindicated text,
  system_affinity text,
  chief_complaints text,
  western_constitution_match text,
  ayurvedic_dosha_match text,
  ayurvedic_dosha_aggravates text,
  tcm_pattern_match text,
  tcm_contraindicated_patterns text,
  cautions text,
  contraindications_general text,
  pregnancy_safety text,
  breastfeeding_safety text,
  children_safety text,
  drug_interactions text,
  preparation_methods text,
  dosage_notes text,
  primary_sources text,
  secondary_sources text,
  tier_visibility subscription_tier NOT NULL DEFAULT 'free'::subscription_tier,
  notes text,
  biblical_traditional_reference text,
  stewardship_note text,
  energetics_summary text,
  refer_threshold text,
  pronunciation text,
  image_filename text,
  status text,
  created_date date,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);

-- herbs_actions
CREATE TABLE IF NOT EXISTS public.herbs_actions (
  link_id bigint NOT NULL DEFAULT nextval('herbs_actions_link_id_seq'::regclass),
  herb_id text NOT NULL,
  action_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_complaints
CREATE TABLE IF NOT EXISTS public.herbs_complaints (
  link_id bigint NOT NULL DEFAULT nextval('herbs_complaints_link_id_seq'::regclass),
  herb_id text NOT NULL,
  complaint_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_constitutions
CREATE TABLE IF NOT EXISTS public.herbs_constitutions (
  link_id bigint NOT NULL DEFAULT nextval('herbs_constitutions_link_id_seq'::regclass),
  herb_id text NOT NULL,
  constitution_id text NOT NULL,
  relationship text,
  strength_of_indication text,
  notes text
);

-- herbs_doshas_aggravates
CREATE TABLE IF NOT EXISTS public.herbs_doshas_aggravates (
  link_id bigint NOT NULL DEFAULT nextval('herbs_doshas_aggravates_link_id_seq'::regclass),
  herb_id text NOT NULL,
  dosha_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_doshas_match
CREATE TABLE IF NOT EXISTS public.herbs_doshas_match (
  link_id bigint NOT NULL DEFAULT nextval('herbs_doshas_match_link_id_seq'::regclass),
  herb_id text NOT NULL,
  dosha_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_preparations
CREATE TABLE IF NOT EXISTS public.herbs_preparations (
  link_id bigint NOT NULL DEFAULT nextval('herbs_preparations_link_id_seq'::regclass),
  herb_id text NOT NULL,
  prep_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_systems
CREATE TABLE IF NOT EXISTS public.herbs_systems (
  link_id bigint NOT NULL DEFAULT nextval('herbs_systems_link_id_seq'::regclass),
  herb_id text NOT NULL,
  system_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_tastes
CREATE TABLE IF NOT EXISTS public.herbs_tastes (
  link_id bigint NOT NULL DEFAULT nextval('herbs_tastes_link_id_seq'::regclass),
  herb_id text NOT NULL,
  taste_id text NOT NULL
);

-- herbs_tcm_contraindicated
CREATE TABLE IF NOT EXISTS public.herbs_tcm_contraindicated (
  link_id bigint NOT NULL DEFAULT nextval('herbs_tcm_contraindicated_link_id_seq'::regclass),
  herb_id text NOT NULL,
  pattern_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_tcm_indicated
CREATE TABLE IF NOT EXISTS public.herbs_tcm_indicated (
  link_id bigint NOT NULL DEFAULT nextval('herbs_tcm_indicated_link_id_seq'::regclass),
  herb_id text NOT NULL,
  pattern_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_tissue_states_contraindicated
CREATE TABLE IF NOT EXISTS public.herbs_tissue_states_contraindicated (
  link_id bigint NOT NULL DEFAULT nextval('herbs_tissue_states_contraindicated_link_id_seq'::regclass),
  herb_id text NOT NULL,
  state_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- herbs_tissue_states_indicated
CREATE TABLE IF NOT EXISTS public.herbs_tissue_states_indicated (
  link_id bigint NOT NULL DEFAULT nextval('herbs_tissue_states_indicated_link_id_seq'::regclass),
  herb_id text NOT NULL,
  state_id text NOT NULL,
  strength_of_indication text,
  notes text
);

-- preparations
CREATE TABLE IF NOT EXISTS public.preparations (
  prep_id text NOT NULL,
  preparation_name text NOT NULL,
  description text
);

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid NOT NULL,
  email text,
  display_name text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free'::subscription_tier,
  subscription_status text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  is_founding_member boolean NOT NULL DEFAULT false,
  founding_rate_price_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- refer_out_triggers
CREATE TABLE IF NOT EXISTS public.refer_out_triggers (
  trigger_id text NOT NULL,
  trigger_description text NOT NULL,
  severity severity_level NOT NULL,
  action text NOT NULL
);

-- schema_fields
CREATE TABLE IF NOT EXISTS public.schema_fields (
  field_id text NOT NULL,
  sheet text,
  column_name text,
  tier text,
  display_name text,
  description text
);

-- schema_version
CREATE TABLE IF NOT EXISTS public.schema_version (
  version text NOT NULL,
  release_date date,
  description text,
  migration_notes text
);

-- sources
CREATE TABLE IF NOT EXISTS public.sources (
  source_id text NOT NULL,
  short_name text NOT NULL,
  full_citation text NOT NULL,
  year text,
  tradition text,
  public_domain public_domain_flag,
  url text
);

-- subscription_events
CREATE TABLE IF NOT EXISTS public.subscription_events (
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  stripe_event_id text,
  stripe_event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now()
);

-- tastes
CREATE TABLE IF NOT EXISTS public.tastes (
  taste_id text NOT NULL,
  taste_name text NOT NULL
);

-- tcm_patterns
CREATE TABLE IF NOT EXISTS public.tcm_patterns (
  pattern_id text NOT NULL,
  pattern_name text NOT NULL,
  category text,
  description text
);

-- tissue_states
CREATE TABLE IF NOT EXISTS public.tissue_states (
  state_id text NOT NULL,
  state_name text NOT NULL,
  description text,
  opposing_state_id text
);

-- --------------------------------------------------------------------------
-- 4. Constraints (idempotent)
-- --------------------------------------------------------------------------
-- Order: primary keys, unique constraints, check constraints, foreign keys.
-- FKs last so referenced tables and their PKs exist first.


-- --- PRIMARY KEY constraints ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actions_pkey' AND conrelid = 'public.actions'::regclass) THEN
    ALTER TABLE public.actions ADD CONSTRAINT actions_pkey PRIMARY KEY (action_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'body_systems_pkey' AND conrelid = 'public.body_systems'::regclass) THEN
    ALTER TABLE public.body_systems ADD CONSTRAINT body_systems_pkey PRIMARY KEY (system_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citations_pkey' AND conrelid = 'public.citations'::regclass) THEN
    ALTER TABLE public.citations ADD CONSTRAINT citations_pkey PRIMARY KEY (citation_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citations_herbs_pkey' AND conrelid = 'public.citations_herbs'::regclass) THEN
    ALTER TABLE public.citations_herbs ADD CONSTRAINT citations_herbs_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaint_synonyms_pkey' AND conrelid = 'public.complaint_synonyms'::regclass) THEN
    ALTER TABLE public.complaint_synonyms ADD CONSTRAINT complaint_synonyms_pkey PRIMARY KEY (synonym_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_pkey' AND conrelid = 'public.complaints'::regclass) THEN
    ALTER TABLE public.complaints ADD CONSTRAINT complaints_pkey PRIMARY KEY (complaint_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conditions_pkey' AND conrelid = 'public.conditions'::regclass) THEN
    ALTER TABLE public.conditions ADD CONSTRAINT conditions_pkey PRIMARY KEY (condition_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constitutions_pkey' AND conrelid = 'public.constitutions'::regclass) THEN
    ALTER TABLE public.constitutions ADD CONSTRAINT constitutions_pkey PRIMARY KEY (constitution_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contraindications_pkey' AND conrelid = 'public.contraindications'::regclass) THEN
    ALTER TABLE public.contraindications ADD CONSTRAINT contraindications_pkey PRIMARY KEY (contraindication_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doshas_pkey' AND conrelid = 'public.doshas'::regclass) THEN
    ALTER TABLE public.doshas ADD CONSTRAINT doshas_pkey PRIMARY KEY (dosha_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herb_synonyms_pkey' AND conrelid = 'public.herb_synonyms'::regclass) THEN
    ALTER TABLE public.herb_synonyms ADD CONSTRAINT herb_synonyms_pkey PRIMARY KEY (synonym_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_pkey' AND conrelid = 'public.herbs'::regclass) THEN
    ALTER TABLE public.herbs ADD CONSTRAINT herbs_pkey PRIMARY KEY (herb_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_actions_pkey' AND conrelid = 'public.herbs_actions'::regclass) THEN
    ALTER TABLE public.herbs_actions ADD CONSTRAINT herbs_actions_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_complaints_pkey' AND conrelid = 'public.herbs_complaints'::regclass) THEN
    ALTER TABLE public.herbs_complaints ADD CONSTRAINT herbs_complaints_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_constitutions_pkey' AND conrelid = 'public.herbs_constitutions'::regclass) THEN
    ALTER TABLE public.herbs_constitutions ADD CONSTRAINT herbs_constitutions_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_aggravates_pkey' AND conrelid = 'public.herbs_doshas_aggravates'::regclass) THEN
    ALTER TABLE public.herbs_doshas_aggravates ADD CONSTRAINT herbs_doshas_aggravates_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_match_pkey' AND conrelid = 'public.herbs_doshas_match'::regclass) THEN
    ALTER TABLE public.herbs_doshas_match ADD CONSTRAINT herbs_doshas_match_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_preparations_pkey' AND conrelid = 'public.herbs_preparations'::regclass) THEN
    ALTER TABLE public.herbs_preparations ADD CONSTRAINT herbs_preparations_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_systems_pkey' AND conrelid = 'public.herbs_systems'::regclass) THEN
    ALTER TABLE public.herbs_systems ADD CONSTRAINT herbs_systems_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tastes_pkey' AND conrelid = 'public.herbs_tastes'::regclass) THEN
    ALTER TABLE public.herbs_tastes ADD CONSTRAINT herbs_tastes_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_contraindicated_pkey' AND conrelid = 'public.herbs_tcm_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_contraindicated ADD CONSTRAINT herbs_tcm_contraindicated_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_indicated_pkey' AND conrelid = 'public.herbs_tcm_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_indicated ADD CONSTRAINT herbs_tcm_indicated_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_contraindicated_pkey' AND conrelid = 'public.herbs_tissue_states_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_contraindicated ADD CONSTRAINT herbs_tissue_states_contraindicated_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_indicated_pkey' AND conrelid = 'public.herbs_tissue_states_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_indicated ADD CONSTRAINT herbs_tissue_states_indicated_pkey PRIMARY KEY (link_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preparations_pkey' AND conrelid = 'public.preparations'::regclass) THEN
    ALTER TABLE public.preparations ADD CONSTRAINT preparations_pkey PRIMARY KEY (prep_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refer_out_triggers_pkey' AND conrelid = 'public.refer_out_triggers'::regclass) THEN
    ALTER TABLE public.refer_out_triggers ADD CONSTRAINT refer_out_triggers_pkey PRIMARY KEY (trigger_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schema_fields_pkey' AND conrelid = 'public.schema_fields'::regclass) THEN
    ALTER TABLE public.schema_fields ADD CONSTRAINT schema_fields_pkey PRIMARY KEY (field_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schema_version_pkey' AND conrelid = 'public.schema_version'::regclass) THEN
    ALTER TABLE public.schema_version ADD CONSTRAINT schema_version_pkey PRIMARY KEY (version);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sources_pkey' AND conrelid = 'public.sources'::regclass) THEN
    ALTER TABLE public.sources ADD CONSTRAINT sources_pkey PRIMARY KEY (source_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_events_pkey' AND conrelid = 'public.subscription_events'::regclass) THEN
    ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tastes_pkey' AND conrelid = 'public.tastes'::regclass) THEN
    ALTER TABLE public.tastes ADD CONSTRAINT tastes_pkey PRIMARY KEY (taste_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tcm_patterns_pkey' AND conrelid = 'public.tcm_patterns'::regclass) THEN
    ALTER TABLE public.tcm_patterns ADD CONSTRAINT tcm_patterns_pkey PRIMARY KEY (pattern_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tissue_states_pkey' AND conrelid = 'public.tissue_states'::regclass) THEN
    ALTER TABLE public.tissue_states ADD CONSTRAINT tissue_states_pkey PRIMARY KEY (state_id);
  END IF;
END $$;

-- --- UNIQUE constraints ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citations_herbs_citation_id_herb_id_field_cited_key' AND conrelid = 'public.citations_herbs'::regclass) THEN
    ALTER TABLE public.citations_herbs ADD CONSTRAINT citations_herbs_citation_id_herb_id_field_cited_key UNIQUE (citation_id, herb_id, field_cited);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_actions_herb_id_action_id_key' AND conrelid = 'public.herbs_actions'::regclass) THEN
    ALTER TABLE public.herbs_actions ADD CONSTRAINT herbs_actions_herb_id_action_id_key UNIQUE (herb_id, action_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_complaints_herb_id_complaint_id_key' AND conrelid = 'public.herbs_complaints'::regclass) THEN
    ALTER TABLE public.herbs_complaints ADD CONSTRAINT herbs_complaints_herb_id_complaint_id_key UNIQUE (herb_id, complaint_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_constitutions_herb_id_constitution_id_relationship_key' AND conrelid = 'public.herbs_constitutions'::regclass) THEN
    ALTER TABLE public.herbs_constitutions ADD CONSTRAINT herbs_constitutions_herb_id_constitution_id_relationship_key UNIQUE (herb_id, constitution_id, relationship);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_aggravates_herb_id_dosha_id_key' AND conrelid = 'public.herbs_doshas_aggravates'::regclass) THEN
    ALTER TABLE public.herbs_doshas_aggravates ADD CONSTRAINT herbs_doshas_aggravates_herb_id_dosha_id_key UNIQUE (herb_id, dosha_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_match_herb_id_dosha_id_key' AND conrelid = 'public.herbs_doshas_match'::regclass) THEN
    ALTER TABLE public.herbs_doshas_match ADD CONSTRAINT herbs_doshas_match_herb_id_dosha_id_key UNIQUE (herb_id, dosha_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_preparations_herb_id_prep_id_key' AND conrelid = 'public.herbs_preparations'::regclass) THEN
    ALTER TABLE public.herbs_preparations ADD CONSTRAINT herbs_preparations_herb_id_prep_id_key UNIQUE (herb_id, prep_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_systems_herb_id_system_id_key' AND conrelid = 'public.herbs_systems'::regclass) THEN
    ALTER TABLE public.herbs_systems ADD CONSTRAINT herbs_systems_herb_id_system_id_key UNIQUE (herb_id, system_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tastes_herb_id_taste_id_key' AND conrelid = 'public.herbs_tastes'::regclass) THEN
    ALTER TABLE public.herbs_tastes ADD CONSTRAINT herbs_tastes_herb_id_taste_id_key UNIQUE (herb_id, taste_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_contraindicated_herb_id_pattern_id_key' AND conrelid = 'public.herbs_tcm_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_contraindicated ADD CONSTRAINT herbs_tcm_contraindicated_herb_id_pattern_id_key UNIQUE (herb_id, pattern_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_indicated_herb_id_pattern_id_key' AND conrelid = 'public.herbs_tcm_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_indicated ADD CONSTRAINT herbs_tcm_indicated_herb_id_pattern_id_key UNIQUE (herb_id, pattern_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_contraindicated_herb_id_state_id_key' AND conrelid = 'public.herbs_tissue_states_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_contraindicated ADD CONSTRAINT herbs_tissue_states_contraindicated_herb_id_state_id_key UNIQUE (herb_id, state_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_indicated_herb_id_state_id_key' AND conrelid = 'public.herbs_tissue_states_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_indicated ADD CONSTRAINT herbs_tissue_states_indicated_herb_id_state_id_key UNIQUE (herb_id, state_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_customer_id_key' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_events_stripe_event_id_key' AND conrelid = 'public.subscription_events'::regclass) THEN
    ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_stripe_event_id_key UNIQUE (stripe_event_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tastes_taste_name_key' AND conrelid = 'public.tastes'::regclass) THEN
    ALTER TABLE public.tastes ADD CONSTRAINT tastes_taste_name_key UNIQUE (taste_name);
  END IF;
END $$;

-- --- FOREIGN KEY constraints ---
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citations_source_id_fkey' AND conrelid = 'public.citations'::regclass) THEN
    ALTER TABLE public.citations ADD CONSTRAINT citations_source_id_fkey FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citations_herbs_citation_id_fkey' AND conrelid = 'public.citations_herbs'::regclass) THEN
    ALTER TABLE public.citations_herbs ADD CONSTRAINT citations_herbs_citation_id_fkey FOREIGN KEY (citation_id) REFERENCES citations(citation_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citations_herbs_herb_id_fkey' AND conrelid = 'public.citations_herbs'::regclass) THEN
    ALTER TABLE public.citations_herbs ADD CONSTRAINT citations_herbs_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaint_synonyms_complaint_id_fkey' AND conrelid = 'public.complaint_synonyms'::regclass) THEN
    ALTER TABLE public.complaint_synonyms ADD CONSTRAINT complaint_synonyms_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_body_system_id_fkey' AND conrelid = 'public.complaints'::regclass) THEN
    ALTER TABLE public.complaints ADD CONSTRAINT complaints_body_system_id_fkey FOREIGN KEY (body_system_id) REFERENCES body_systems(system_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conditions_body_system_id_fkey' AND conrelid = 'public.conditions'::regclass) THEN
    ALTER TABLE public.conditions ADD CONSTRAINT conditions_body_system_id_fkey FOREIGN KEY (body_system_id) REFERENCES body_systems(system_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contraindications_herb_id_fkey' AND conrelid = 'public.contraindications'::regclass) THEN
    ALTER TABLE public.contraindications ADD CONSTRAINT contraindications_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herb_synonyms_herb_id_fkey' AND conrelid = 'public.herb_synonyms'::regclass) THEN
    ALTER TABLE public.herb_synonyms ADD CONSTRAINT herb_synonyms_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_actions_action_id_fkey' AND conrelid = 'public.herbs_actions'::regclass) THEN
    ALTER TABLE public.herbs_actions ADD CONSTRAINT herbs_actions_action_id_fkey FOREIGN KEY (action_id) REFERENCES actions(action_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_actions_herb_id_fkey' AND conrelid = 'public.herbs_actions'::regclass) THEN
    ALTER TABLE public.herbs_actions ADD CONSTRAINT herbs_actions_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_complaints_complaint_id_fkey' AND conrelid = 'public.herbs_complaints'::regclass) THEN
    ALTER TABLE public.herbs_complaints ADD CONSTRAINT herbs_complaints_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_complaints_herb_id_fkey' AND conrelid = 'public.herbs_complaints'::regclass) THEN
    ALTER TABLE public.herbs_complaints ADD CONSTRAINT herbs_complaints_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_constitutions_constitution_id_fkey' AND conrelid = 'public.herbs_constitutions'::regclass) THEN
    ALTER TABLE public.herbs_constitutions ADD CONSTRAINT herbs_constitutions_constitution_id_fkey FOREIGN KEY (constitution_id) REFERENCES constitutions(constitution_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_constitutions_herb_id_fkey' AND conrelid = 'public.herbs_constitutions'::regclass) THEN
    ALTER TABLE public.herbs_constitutions ADD CONSTRAINT herbs_constitutions_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_aggravates_dosha_id_fkey' AND conrelid = 'public.herbs_doshas_aggravates'::regclass) THEN
    ALTER TABLE public.herbs_doshas_aggravates ADD CONSTRAINT herbs_doshas_aggravates_dosha_id_fkey FOREIGN KEY (dosha_id) REFERENCES doshas(dosha_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_aggravates_herb_id_fkey' AND conrelid = 'public.herbs_doshas_aggravates'::regclass) THEN
    ALTER TABLE public.herbs_doshas_aggravates ADD CONSTRAINT herbs_doshas_aggravates_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_match_dosha_id_fkey' AND conrelid = 'public.herbs_doshas_match'::regclass) THEN
    ALTER TABLE public.herbs_doshas_match ADD CONSTRAINT herbs_doshas_match_dosha_id_fkey FOREIGN KEY (dosha_id) REFERENCES doshas(dosha_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_doshas_match_herb_id_fkey' AND conrelid = 'public.herbs_doshas_match'::regclass) THEN
    ALTER TABLE public.herbs_doshas_match ADD CONSTRAINT herbs_doshas_match_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_preparations_herb_id_fkey' AND conrelid = 'public.herbs_preparations'::regclass) THEN
    ALTER TABLE public.herbs_preparations ADD CONSTRAINT herbs_preparations_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_preparations_prep_id_fkey' AND conrelid = 'public.herbs_preparations'::regclass) THEN
    ALTER TABLE public.herbs_preparations ADD CONSTRAINT herbs_preparations_prep_id_fkey FOREIGN KEY (prep_id) REFERENCES preparations(prep_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_systems_herb_id_fkey' AND conrelid = 'public.herbs_systems'::regclass) THEN
    ALTER TABLE public.herbs_systems ADD CONSTRAINT herbs_systems_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_systems_system_id_fkey' AND conrelid = 'public.herbs_systems'::regclass) THEN
    ALTER TABLE public.herbs_systems ADD CONSTRAINT herbs_systems_system_id_fkey FOREIGN KEY (system_id) REFERENCES body_systems(system_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tastes_herb_id_fkey' AND conrelid = 'public.herbs_tastes'::regclass) THEN
    ALTER TABLE public.herbs_tastes ADD CONSTRAINT herbs_tastes_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tastes_taste_id_fkey' AND conrelid = 'public.herbs_tastes'::regclass) THEN
    ALTER TABLE public.herbs_tastes ADD CONSTRAINT herbs_tastes_taste_id_fkey FOREIGN KEY (taste_id) REFERENCES tastes(taste_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_contraindicated_herb_id_fkey' AND conrelid = 'public.herbs_tcm_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_contraindicated ADD CONSTRAINT herbs_tcm_contraindicated_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_contraindicated_pattern_id_fkey' AND conrelid = 'public.herbs_tcm_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_contraindicated ADD CONSTRAINT herbs_tcm_contraindicated_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES tcm_patterns(pattern_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_indicated_herb_id_fkey' AND conrelid = 'public.herbs_tcm_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_indicated ADD CONSTRAINT herbs_tcm_indicated_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tcm_indicated_pattern_id_fkey' AND conrelid = 'public.herbs_tcm_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tcm_indicated ADD CONSTRAINT herbs_tcm_indicated_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES tcm_patterns(pattern_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_contraindicated_herb_id_fkey' AND conrelid = 'public.herbs_tissue_states_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_contraindicated ADD CONSTRAINT herbs_tissue_states_contraindicated_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_contraindicated_state_id_fkey' AND conrelid = 'public.herbs_tissue_states_contraindicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_contraindicated ADD CONSTRAINT herbs_tissue_states_contraindicated_state_id_fkey FOREIGN KEY (state_id) REFERENCES tissue_states(state_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_indicated_herb_id_fkey' AND conrelid = 'public.herbs_tissue_states_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_indicated ADD CONSTRAINT herbs_tissue_states_indicated_herb_id_fkey FOREIGN KEY (herb_id) REFERENCES herbs(herb_id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'herbs_tissue_states_indicated_state_id_fkey' AND conrelid = 'public.herbs_tissue_states_indicated'::regclass) THEN
    ALTER TABLE public.herbs_tissue_states_indicated ADD CONSTRAINT herbs_tissue_states_indicated_state_id_fkey FOREIGN KEY (state_id) REFERENCES tissue_states(state_id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_events_user_id_fkey' AND conrelid = 'public.subscription_events'::regclass) THEN
    ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tissue_states_opposing_state_id_fkey' AND conrelid = 'public.tissue_states'::regclass) THEN
    ALTER TABLE public.tissue_states ADD CONSTRAINT tissue_states_opposing_state_id_fkey FOREIGN KEY (opposing_state_id) REFERENCES tissue_states(state_id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
-- --------------------------------------------------------------------------
-- 5. Indexes (non-PK, non-unique-constraint-backed)
-- --------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'actions_name_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX actions_name_trgm ON public.actions USING gin (action_name gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'citations_source_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX citations_source_idx ON public.citations USING btree (source_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ch_citation_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ch_citation_idx ON public.citations_herbs USING btree (citation_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ch_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ch_herb_idx ON public.citations_herbs USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'cp_syn_cp_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX cp_syn_cp_idx ON public.complaint_synonyms USING btree (complaint_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'cp_syn_phrase_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX cp_syn_phrase_trgm ON public.complaint_synonyms USING gin (synonym_phrase gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'complaints_name_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX complaints_name_trgm ON public.complaints USING gin (complaint_name gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'complaints_system_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX complaints_system_idx ON public.complaints USING btree (body_system_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'conditions_name_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX conditions_name_trgm ON public.conditions USING gin (name gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ci_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ci_herb_idx ON public.contraindications USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ci_severity_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ci_severity_idx ON public.contraindications USING btree (severity)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ci_type_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ci_type_idx ON public.contraindications USING btree (type)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herb_syn_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herb_syn_herb_idx ON public.herb_synonyms USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herb_syn_phrase_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herb_syn_phrase_trgm ON public.herb_synonyms USING gin (synonym_phrase gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herbs_common_name_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herbs_common_name_trgm ON public.herbs USING gin (common_name gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herbs_latin_name_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herbs_latin_name_trgm ON public.herbs USING gin (latin_name gin_trgm_ops)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herbs_status_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herbs_status_idx ON public.herbs USING btree (status)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herbs_tier_visibility_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herbs_tier_visibility_idx ON public.herbs USING btree (tier_visibility)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ha_act_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ha_act_idx ON public.herbs_actions USING btree (action_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ha_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX ha_herb_idx ON public.herbs_actions USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hcp_cp_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hcp_cp_idx ON public.herbs_complaints USING btree (complaint_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hcp_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hcp_herb_idx ON public.herbs_complaints USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hc_con_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hc_con_idx ON public.herbs_constitutions USING btree (constitution_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hc_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hc_herb_idx ON public.herbs_constitutions USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hda_dosha_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hda_dosha_idx ON public.herbs_doshas_aggravates USING btree (dosha_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hda_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hda_herb_idx ON public.herbs_doshas_aggravates USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hdm_dosha_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hdm_dosha_idx ON public.herbs_doshas_match USING btree (dosha_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hdm_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hdm_herb_idx ON public.herbs_doshas_match USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hp_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hp_herb_idx ON public.herbs_preparations USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hp_prep_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hp_prep_idx ON public.herbs_preparations USING btree (prep_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hs_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hs_herb_idx ON public.herbs_systems USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hs_sys_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hs_sys_idx ON public.herbs_systems USING btree (system_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herbs_tastes_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herbs_tastes_herb_idx ON public.herbs_tastes USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'herbs_tastes_taste_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX herbs_tastes_taste_idx ON public.herbs_tastes USING btree (taste_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'htcmc_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX htcmc_herb_idx ON public.herbs_tcm_contraindicated USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'htcmc_pat_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX htcmc_pat_idx ON public.herbs_tcm_contraindicated USING btree (pattern_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'htcmi_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX htcmi_herb_idx ON public.herbs_tcm_indicated USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'htcmi_pat_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX htcmi_pat_idx ON public.herbs_tcm_indicated USING btree (pattern_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hts_ctr_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hts_ctr_herb_idx ON public.herbs_tissue_states_contraindicated USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hts_ctr_state_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hts_ctr_state_idx ON public.herbs_tissue_states_contraindicated USING btree (state_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hts_ind_herb_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hts_ind_herb_idx ON public.herbs_tissue_states_indicated USING btree (herb_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hts_ind_state_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX hts_ind_state_idx ON public.herbs_tissue_states_indicated USING btree (state_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'profiles_status_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX profiles_status_idx ON public.profiles USING btree (subscription_status)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'profiles_stripe_cust_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX profiles_stripe_cust_idx ON public.profiles USING btree (stripe_customer_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'profiles_tier_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX profiles_tier_idx ON public.profiles USING btree (subscription_tier)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sub_ev_time_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX sub_ev_time_idx ON public.subscription_events USING btree (received_at DESC)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sub_ev_type_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX sub_ev_type_idx ON public.subscription_events USING btree (stripe_event_type)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sub_ev_user_idx' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX sub_ev_user_idx ON public.subscription_events USING btree (user_id)$idx$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tissue_states_name_trgm' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE $idx$CREATE INDEX tissue_states_name_trgm ON public.tissue_states USING gin (state_name gin_trgm_ops)$idx$;
  END IF;
END $$;
-- --------------------------------------------------------------------------
-- 6. Enable Row Level Security on all backfilled tables
-- --------------------------------------------------------------------------
-- Policies for profiles, herbs, contraindications, refer_out_triggers, and
-- subscription_events are set in 20260421100000_rls_and_views.sql (PR #2).
-- For all other tables, RLS is enabled here so stray selects deny by default
-- until policies are added.

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations_herbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contraindications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doshas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herb_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_constitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_doshas_aggravates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_doshas_match ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_tastes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_tcm_contraindicated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_tcm_indicated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_tissue_states_contraindicated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.herbs_tissue_states_indicated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refer_out_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tastes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcm_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tissue_states ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 7. Custom functions
-- --------------------------------------------------------------------------
-- Excludes current_user_tier, current_user_at_least, handle_new_user (PR #2).
-- Excludes pg_trgm extension functions (installed by CREATE EXTENSION above).

-- tier_rank: maps subscription_tier enum to integer 0-3 for comparison
CREATE OR REPLACE FUNCTION public.tier_rank(t subscription_tier)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case t
    when 'free'         then 0
    when 'seed'         then 1
    when 'root'         then 2
    when 'practitioner' then 3
  end;
$function$;

-- current_tier: returns the subscription_tier for auth.uid() (defaults free)
CREATE OR REPLACE FUNCTION public.current_tier()
 RETURNS subscription_tier
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select subscription_tier from public.profiles where user_id = auth.uid()),
    'free'::subscription_tier
  );
$function$;

-- has_tier: boolean helper, true when current_tier >= required
CREATE OR REPLACE FUNCTION public.has_tier(required subscription_tier)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.tier_rank(public.current_tier()) >= public.tier_rank(required);
$function$;

-- set_updated_at: trigger function, sets NEW.updated_at = now()
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- rls_auto_enable: event trigger, enables RLS on any newly-created public table
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- --------------------------------------------------------------------------
-- 8. Triggers
-- --------------------------------------------------------------------------
-- on_auth_user_created is defined in 20260421100000_rls_and_views.sql.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at' AND tgrelid = 'public.profiles'::regclass) THEN
    CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Event trigger attached to rls_auto_enable, fires on DDL commands
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'rls_auto_enable_trg') THEN
    CREATE EVENT TRIGGER rls_auto_enable_trg
      ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 9. Views: herbs_public (anon-tier 50-herb surface)
-- --------------------------------------------------------------------------
-- herbs_clinical_v and contraindications_safety_v are created by PR #2.

CREATE OR REPLACE VIEW public.herbs_public
WITH (security_invoker = true)
AS
SELECT herb_id,
    common_name,
    latin_name,
    plant_family,
    part_used,
    taste,
    temperature,
    moisture,
    pronunciation,
    image_filename,
    energetics_summary,
    stewardship_note,
    cautions,
    contraindications_general,
    pregnancy_safety,
    breastfeeding_safety,
    children_safety,
    biblical_traditional_reference,
    status,
    tier_visibility
   FROM herbs
  WHERE tier_visibility = 'free'::subscription_tier OR tier_visibility IS NULL;

-- End of backfill
