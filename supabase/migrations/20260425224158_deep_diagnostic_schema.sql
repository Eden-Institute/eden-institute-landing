-- =============================================================================
-- Migration: Deep-Diagnostic Schema (Lock #37 v3.8)
-- =============================================================================
-- Adds Layer 2 (Galenic temperament), Layer 3 (Tissue State Profile by Organ
-- System), and Layer 4 (Vital Force Reading) to person_profiles per the
-- v3.8 strategic-pivot diagnostic stack. Forward-compatible: Layers 2-4 are
-- nullable; PatternMatchHero v1 already renders Layer 1 unconditionally and
-- conditionally renders Layers 2-4 when populated (Stage 6.3.5 Phase B
-- sub-task 3, merged in PR #19 / commit 9206e12).
--
-- Contents:
--   1. Drop pre-pivot relic column (secondary_framework_match)
--   2. New enum types (galenic_temperament_type, vital_force_reading_type)
--   3. New columns on person_profiles
--   4. New junction table (person_profile_tissue_states) — Layer 3
--   5. New audit table (diagnostic_completions)
--   6. Trigger to fan diagnostic_completions → person_profiles + junction
--   7. View (diagnostic_profile_v) returning the full DiagnosticProfile shape
--
-- Provenance: per Lock #38, every diagnostic claim must include a primary-text
-- citation surfaceable in UI. Citations live in TypeScript content modules
-- (galenicTemperament.ts, tissueStateProfile.ts, vitalForce.ts), passed to UI
-- components for display. This migration creates the data SHAPE; content +
-- citations land in subsequent sessions.
--
-- Pre-pivot data retention: per Issue A scope (PR #19), Ayurvedic/TCM/dosha
-- schema (constitutions table rows with system='Ayurvedic'/'TCM',
-- doshas/tcm_patterns dimension tables, herbs_doshas_*, herbs_tcm_*) is
-- RETAINED. Cleanup is a separate architectural decision requiring founder
-- approval; out of scope for this migration.
--
-- Apply: SQL Editor (browser-first per established project pattern;
-- supabase_migrations.schema_migrations does not exist on this DB).
-- File-in-repo IS the audit record / spec of the schema change.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Drop pre-pivot relic column + refresh stale comment on eden_constitution
-- =============================================================================
-- secondary_framework_match was a pre-v3.8 single-text "Vata/Pitta/Kapha"-style
-- cross-reference column from the multi-framework era. Replaced by the 4-layer
-- DiagnosticProfile (Lock #37). Safe to drop:
--   - person_profiles is empty (0 rows verified 2026-04-25 evening UTC).
--   - No code reads this column (verified via repo-wide search 2026-04-25).
--   - tg_quiz_completion_sync_constitution writes only to eden_constitution.
ALTER TABLE public.person_profiles
  DROP COLUMN IF EXISTS secondary_framework_match;

-- The original comment on eden_constitution referenced secondary_framework_match
-- as a forward-looking dual-write. That speculative scope is retired by the
-- v3.8 layered diagnostic stack (Lock #37). Refresh comment to current truth.
COMMENT ON COLUMN public.person_profiles.eden_constitution IS
  'Layer 1 of DiagnosticProfile (Lock #37, Manual §0.8 #16). One of the eight Patterns of Eden, OR null/inconclusive. Written by tg_quiz_completion_sync_constitution at marketing-quiz completion (Seed+ tier). Layers 2-4 of the diagnostic stack are separate columns (galenic_temperament, vital_force_reading) and tables (person_profile_tissue_states), populated by tg_diagnostic_completion_sync_profile.';

-- =============================================================================
-- 2. New enum types
-- =============================================================================

-- Galenic temperaments per Galen, De Temperamentis (~AD 175). Includes the 4
-- base humoral temperaments, the 6 two-element blends Galen names, and
-- eukrasia (the genuinely-balanced constitution). Total: 11 values. NULL =
-- not yet diagnosed. The deep-diagnostic 40-question quiz produces one of
-- these 11 values OR returns inconclusive (no DB write per Lock #39).
CREATE TYPE public.galenic_temperament_type AS ENUM (
  'sanguine',                  -- Hot/Wet
  'choleric',                  -- Hot/Dry
  'melancholic',               -- Cold/Dry
  'phlegmatic',                -- Cold/Wet
  'sanguine_choleric',         -- Hot dominance
  'sanguine_phlegmatic',       -- Wet dominance
  'sanguine_melancholic',      -- Wet/Dry tension
  'choleric_melancholic',      -- Dry dominance
  'choleric_phlegmatic',       -- Hot/Cold tension
  'melancholic_phlegmatic',    -- Cold dominance
  'eukrasia'                   -- balanced (Galenic ideal)
);

COMMENT ON TYPE public.galenic_temperament_type IS
  'Layer 2 of DiagnosticProfile (Lock #37). 11 values per Galen De Temperamentis.';

-- Vital force readings per Cook 1869 (Physio-Medical Dispensatory) and
-- Felter 1922 (Eclectic Materia Medica). Three readings: sthenic (excessive
-- vital force / hyper-reactive terrain), asthenic (diminished vital force /
-- hypo-reactive terrain), normotonic (balanced reactivity).
CREATE TYPE public.vital_force_reading_type AS ENUM (
  'sthenic',
  'asthenic',
  'normotonic'
);

COMMENT ON TYPE public.vital_force_reading_type IS
  'Layer 4 of DiagnosticProfile (Lock #37). Per Cook 1869, Felter 1922.';

-- =============================================================================
-- 3. New columns on person_profiles
-- =============================================================================

ALTER TABLE public.person_profiles
  ADD COLUMN galenic_temperament      public.galenic_temperament_type,
  ADD COLUMN vital_force_reading      public.vital_force_reading_type,
  ADD COLUMN diagnostic_completed_at  timestamptz;

COMMENT ON COLUMN public.person_profiles.galenic_temperament IS
  'Layer 2 of DiagnosticProfile (Lock #37). Galen, De Temperamentis. Root tier only. NULL until 40-question diagnostic completes.';
COMMENT ON COLUMN public.person_profiles.vital_force_reading IS
  'Layer 4 of DiagnosticProfile (Lock #37). Cook 1869, Felter 1922. Root tier only. NULL until 40-question diagnostic completes.';
COMMENT ON COLUMN public.person_profiles.diagnostic_completed_at IS
  'Timestamp of most recent diagnostic_completions row that synced into this profile. NULL if no Root deep-diagnostic completed.';

-- =============================================================================
-- 4. Junction table: person_profile_tissue_states (Layer 3)
-- =============================================================================
-- One tissue state per organ system per profile. Per Lock #37: 7 tissue states
-- across 6 priority organ systems (Cook 1869 / Felter 1922). References the
-- existing dimension tables (body_systems, tissue_states) for FK integrity.
CREATE TABLE public.person_profile_tissue_states (
  person_profile_id uuid NOT NULL
    REFERENCES public.person_profiles(id) ON DELETE CASCADE,
  body_system_id    text NOT NULL
    REFERENCES public.body_systems(system_id) ON DELETE RESTRICT,
  tissue_state_id   text NOT NULL
    REFERENCES public.tissue_states(state_id) ON DELETE RESTRICT,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_profile_id, body_system_id)
);

CREATE INDEX idx_pp_tissue_states_profile_id
  ON public.person_profile_tissue_states(person_profile_id);

ALTER TABLE public.person_profile_tissue_states ENABLE ROW LEVEL SECURITY;

-- RLS: scoped via parent person_profiles.user_id ownership (no direct user_id
-- on this table; ownership is transitive). Mirrors the
-- person_profiles_<action>_own naming convention.
CREATE POLICY person_profile_tissue_states_select_own
  ON public.person_profile_tissue_states FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = person_profile_tissue_states.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY person_profile_tissue_states_insert_own
  ON public.person_profile_tissue_states FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = person_profile_tissue_states.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY person_profile_tissue_states_update_own
  ON public.person_profile_tissue_states FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = person_profile_tissue_states.person_profile_id
        AND pp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = person_profile_tissue_states.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY person_profile_tissue_states_delete_own
  ON public.person_profile_tissue_states FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.person_profiles pp
      WHERE pp.id = person_profile_tissue_states.person_profile_id
        AND pp.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.person_profile_tissue_states IS
  'Layer 3 of DiagnosticProfile (Lock #37). One tissue state per organ system per profile. FK-constrained to body_systems + tissue_states dimension tables.';

-- =============================================================================
-- 5. Audit table: diagnostic_completions
-- =============================================================================
-- Append-only audit log of Root deep-diagnostic submissions. Holds raw
-- responses for recompute on quiz-version bump and computed values. Sync to
-- person_profiles + junction via trigger (section 6).
CREATE TABLE public.diagnostic_completions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  person_profile_id     uuid        NOT NULL
    REFERENCES public.person_profiles(id) ON DELETE CASCADE,
  galenic_temperament   public.galenic_temperament_type,
  tissue_state_profile  jsonb       NOT NULL,
    -- Shape: { "<body_system_id>": "<tissue_state_id>", ... }
  vital_force_reading   public.vital_force_reading_type,
  raw_responses         jsonb       NOT NULL,
    -- Shape: { "<question_id>": "<response_value>", ... } — 40 keys when complete.
  quiz_version          text        NOT NULL DEFAULT 'v1',
  completed_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostic_completions_user_id
  ON public.diagnostic_completions(user_id);
CREATE INDEX idx_diagnostic_completions_profile_id
  ON public.diagnostic_completions(person_profile_id);
CREATE INDEX idx_diagnostic_completions_completed_at
  ON public.diagnostic_completions(completed_at DESC);

ALTER TABLE public.diagnostic_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY diagnostic_completions_select_own
  ON public.diagnostic_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY diagnostic_completions_insert_own
  ON public.diagnostic_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE / DELETE policies: completions are append-only audit records.

COMMENT ON TABLE public.diagnostic_completions IS
  'Append-only audit log of Root deep-diagnostic submissions. Per Lock #37: holds raw responses for recompute on quiz-version bump. Trigger tg_diagnostic_completion_sync_profile fans values out to person_profiles + person_profile_tissue_states.';

-- =============================================================================
-- 6. Trigger: sync diagnostic_completions → person_profiles + junction
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_diagnostic_completion_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_body_system_id  text;
  v_tissue_state_id text;
BEGIN
  -- Update person_profiles columns (Layers 2 + 4 + completed_at).
  UPDATE public.person_profiles
    SET galenic_temperament     = NEW.galenic_temperament,
        vital_force_reading     = NEW.vital_force_reading,
        diagnostic_completed_at = NEW.completed_at
    WHERE id = NEW.person_profile_id;

  -- Replace Layer 3 (per-organ tissue states) with the latest snapshot.
  -- Replace pattern: each diagnostic completion is a fresh full snapshot.
  DELETE FROM public.person_profile_tissue_states
    WHERE person_profile_id = NEW.person_profile_id;

  FOR v_body_system_id, v_tissue_state_id IN
    SELECT key, value
    FROM jsonb_each_text(NEW.tissue_state_profile)
  LOOP
    INSERT INTO public.person_profile_tissue_states
      (person_profile_id, body_system_id, tissue_state_id, recorded_at)
    VALUES
      (NEW.person_profile_id, v_body_system_id, v_tissue_state_id, NEW.completed_at);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_diagnostic_completion_sync_profile
  AFTER INSERT ON public.diagnostic_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_diagnostic_completion_sync_profile();

COMMENT ON FUNCTION public.tg_diagnostic_completion_sync_profile() IS
  'AFTER INSERT trigger on diagnostic_completions. Fans values out to person_profiles (Layers 2+4 + diagnostic_completed_at) and person_profile_tissue_states (Layer 3, replace-pattern). SECURITY DEFINER so RLS does not block writes.';

-- =============================================================================
-- 7. View: diagnostic_profile_v (full DiagnosticProfile shape)
-- =============================================================================
-- Single view returning all 4 layers per profile. Layer 3 is aggregated as
-- jsonb so the consumer reads { body_system_id: tissue_state_id, ... }.
-- security_invoker = true so RLS on person_profiles + person_profile_tissue_states
-- applies through the view (matches the visible-but-gated pattern in §0.8).
CREATE OR REPLACE VIEW public.diagnostic_profile_v
WITH (security_invoker = true)
AS
SELECT
  pp.id                            AS person_profile_id,
  pp.user_id,
  pp.eden_constitution             AS pattern,                 -- Layer 1
  pp.galenic_temperament,                                       -- Layer 2
  COALESCE(
    (SELECT jsonb_object_agg(t.body_system_id, t.tissue_state_id)
     FROM public.person_profile_tissue_states t
     WHERE t.person_profile_id = pp.id),
    '{}'::jsonb
  )                                AS tissue_state_profile,    -- Layer 3
  pp.vital_force_reading,                                       -- Layer 4
  pp.diagnostic_completed_at,
  (
    pp.galenic_temperament IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.person_profile_tissue_states t
      WHERE t.person_profile_id = pp.id
    )
    AND pp.vital_force_reading IS NOT NULL
  )                                AS has_full_diagnostic_depth
FROM public.person_profiles pp;

COMMENT ON VIEW public.diagnostic_profile_v IS
  'Full DiagnosticProfile (Lock #37). Layer 1 (pattern) always populated for authed-with-quiz users. Layers 2-4 populated only after Root deep-diagnostic completes. Frontend reads this; v1 PatternMatchHero always typed against this shape.';

COMMIT;

-- =============================================================================
-- Smoke-test (run separately after apply, NOT inside the BEGIN/COMMIT above):
-- =============================================================================
-- Per feedback_smoke_test_pattern.md (DO-block + RAISE EXCEPTION rollback):
--
-- DO $$
-- DECLARE
--   v_test_user_id uuid := 'eb281f8c-e417-45d3-ac5f-fc8d6650c8eb';  -- test+seed
--   v_test_profile_id uuid;
--   v_temp_before text;
--   v_temp_after  text;
--   v_tissue_count int;
-- BEGIN
--   SELECT id INTO v_test_profile_id FROM public.person_profiles WHERE user_id = v_test_user_id LIMIT 1;
--   IF v_test_profile_id IS NULL THEN
--     RAISE EXCEPTION 'SMOKE_TEST_SKIP: no person_profile for test+seed user';
--   END IF;
--
--   SELECT galenic_temperament::text INTO v_temp_before FROM public.person_profiles WHERE id = v_test_profile_id;
--
--   INSERT INTO public.diagnostic_completions
--     (user_id, person_profile_id, galenic_temperament, tissue_state_profile, vital_force_reading, raw_responses)
--   VALUES (v_test_user_id, v_test_profile_id, 'choleric',
--           '{"DIGESTIVE":"TENSE_EXCITATION","NERVOUS":"DEPRESSED_EXCITATION"}'::jsonb,
--           'sthenic',
--           '{"q1":"a"}'::jsonb);
--
--   SELECT galenic_temperament::text INTO v_temp_after FROM public.person_profiles WHERE id = v_test_profile_id;
--   SELECT count(*) INTO v_tissue_count FROM public.person_profile_tissue_states WHERE person_profile_id = v_test_profile_id;
--
--   RAISE EXCEPTION 'SMOKE_TEST_RESULT: temp_before=[%], temp_after=[%], tissue_rows=[%]', v_temp_before, v_temp_after, v_tissue_count;
-- END $$;
