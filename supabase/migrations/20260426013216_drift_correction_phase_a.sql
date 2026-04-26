-- ============================================================================
-- Drift correction Phase A — Galenic canonical 9 + vital force balanced
-- ============================================================================
-- Reconciles the v3.9 schema with the TS contract in src/lib/diagnosticProfile.ts
-- (shipped in PR #19) and Lock #37 wording ("9 temperaments per Galen").
--
-- Phase A (this migration): Galenic enum + vital force enum. Pure schema,
-- no clinical mapping decisions, no data dependencies. Both columns on
-- person_profiles + diagnostic_completions are empty (verified pre-apply).
--
-- Phase B (deferred — separate migration after founder clinical-mapping call):
--   - tissue_states / body_systems clinical_canonical boolean flag
--   - Mapping Cook's atony → existing TS09 Laxity (concept match)
--   - Mapping Cook's irritation → existing TS06 Acute Inflammation (concept match)
--   - Decision on missing Integumentary body system (add new row OR substitute
--     Immune/Endocrine OR ship 5 priority systems).
--   - Trigger enforcing clinical_canonical subset on person_profile_tissue_states.
-- ============================================================================

BEGIN;

-- ----- 0. Drop dependent view -----
-- diagnostic_profile_v references person_profiles.galenic_temperament and
-- person_profiles.vital_force_reading. Must drop before column drops; recreate
-- at end with identical definition.

DROP VIEW IF EXISTS public.diagnostic_profile_v;

-- ----- 1. Galenic temperament enum: 11 → 9 canonical -----
-- Drop columns first (empty), drop type, recreate, re-add columns.
-- Both tables verified empty pre-apply.

ALTER TABLE public.person_profiles       DROP COLUMN galenic_temperament;
ALTER TABLE public.diagnostic_completions DROP COLUMN galenic_temperament;
DROP TYPE  public.galenic_temperament_type;

CREATE TYPE public.galenic_temperament_type AS ENUM (
  'eukrasia',                       -- balanced (Galenic ideal)
  'simple_dyskrasia_hot',           -- hot quality dominant, humor unresolved
  'simple_dyskrasia_cold',          -- cold quality dominant, humor unresolved
  'simple_dyskrasia_dry',           -- dry quality dominant, humor unresolved
  'simple_dyskrasia_wet',           -- wet quality dominant, humor unresolved
  'compound_dyskrasia_hot_dry',     -- yellow bile dominant (classical "choleric")
  'compound_dyskrasia_hot_wet',     -- blood dominant (classical "sanguine")
  'compound_dyskrasia_cold_dry',    -- black bile dominant (classical "melancholic")
  'compound_dyskrasia_cold_wet'     -- phlegm dominant (classical "phlegmatic")
);

COMMENT ON TYPE public.galenic_temperament_type IS
  'Layer 2 of DiagnosticProfile (Lock #37). 9 canonical temperaments per Galen, De Temperamentis (~AD 175): eukrasia + 4 simple dyskrasias (single-quality dominant, humor unresolved — preserves diagnostic uncertainty step) + 4 compound dyskrasias (the classical 4 — choleric/sanguine/melancholic/phlegmatic). Matches src/lib/diagnosticProfile.ts contract. Replaces the v3.9 11-value enum which conflated humor-pair blends with canonical temperaments.';

ALTER TABLE public.person_profiles
  ADD COLUMN galenic_temperament public.galenic_temperament_type;
ALTER TABLE public.diagnostic_completions
  ADD COLUMN galenic_temperament public.galenic_temperament_type;

COMMENT ON COLUMN public.person_profiles.galenic_temperament IS
  'Layer 2 of DiagnosticProfile (Lock #37). One of 9 Galenic temperaments per Galen, De Temperamentis. Root tier only. NULL until 40-question diagnostic completes.';

-- ----- 2. Vital force reading enum: normotonic → balanced -----

ALTER TABLE public.person_profiles       DROP COLUMN vital_force_reading;
ALTER TABLE public.diagnostic_completions DROP COLUMN vital_force_reading;
DROP TYPE  public.vital_force_reading_type;

CREATE TYPE public.vital_force_reading_type AS ENUM (
  'sthenic',
  'balanced',
  'asthenic'
);

COMMENT ON TYPE public.vital_force_reading_type IS
  'Layer 4 of DiagnosticProfile (Lock #37). Per Cook 1869 (Physio-Medical Dispensatory) and Felter 1922 (Eclectic Materia Medica). sthenic = excessive vital force / hyper-reactive terrain; balanced = normotonic baseline (Cook also names this "normotonic" in some passages); asthenic = diminished vital force / hypo-reactive terrain. Matches src/lib/diagnosticProfile.ts contract.';

ALTER TABLE public.person_profiles
  ADD COLUMN vital_force_reading public.vital_force_reading_type;
ALTER TABLE public.diagnostic_completions
  ADD COLUMN vital_force_reading public.vital_force_reading_type;

COMMENT ON COLUMN public.person_profiles.vital_force_reading IS
  'Layer 4 of DiagnosticProfile (Lock #37). Cook 1869, Felter 1922. Root tier only. NULL until 40-question diagnostic completes.';

-- ----- 3. Recompile trigger function against new type OIDs -----
-- The function body references NEW.galenic_temperament + NEW.vital_force_reading.
-- After type drop/recreate, the cached query plan may still hold old type OIDs.
-- CREATE OR REPLACE forces recompilation against current OIDs.

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
  UPDATE public.person_profiles
    SET galenic_temperament     = NEW.galenic_temperament,
        vital_force_reading     = NEW.vital_force_reading,
        diagnostic_completed_at = NEW.completed_at
    WHERE id = NEW.person_profile_id;

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

COMMENT ON FUNCTION public.tg_diagnostic_completion_sync_profile() IS
  'AFTER INSERT trigger on diagnostic_completions. Fans values out to person_profiles 