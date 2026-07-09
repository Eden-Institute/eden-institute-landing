-- Practitioner buildout Phase 0 (TL-2, PD-5, PD-6, PD-8): normalized
-- person-side constitutional storage. One completed assessment computes a
-- reading in all four framework lenses (PD-5); each lens stores a dominant
-- pattern plus a secondary when the margin is close (PD-6); a practitioner
-- override persists ALONGSIDE the computed reading, never over it (PD-8).
-- This junction carries all of that: (framework × role × reading_kind) per
-- person profile. Continuous axis positions live on diagnostic_completions
-- so re-takes keep their full spectrum for delta-tracking and recompute on
-- quiz-version bump (Lock #37 posture).
--
-- Write path: service-role Edge Functions only, per Lock #40/#41 (TL-4).
-- Clients get owner-scoped SELECT and nothing else.

CREATE TABLE IF NOT EXISTS public.person_profile_constitutions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_profile_id uuid NOT NULL REFERENCES public.person_profiles(id) ON DELETE CASCADE,
  framework         text NOT NULL CHECK (framework IN ('eden','western','ayurveda','tcm')),
  pattern_id        text NOT NULL,
  role              text NOT NULL CHECK (role IN ('primary','secondary')),
  reading_kind      text NOT NULL DEFAULT 'computed' CHECK (reading_kind IN ('computed','adjusted')),
  score             numeric,                                        -- lens-internal strength (engine-defined scale)
  confidence        numeric CHECK (confidence BETWEEN 0 AND 1),
  completion_id     uuid REFERENCES public.diagnostic_completions(id) ON DELETE SET NULL,
  adjusted_by       uuid,                                           -- auth.users id of the practitioner, when reading_kind='adjusted' (PD-8 audit)
  adjustment_note   text,                                           -- practitioner rationale, when adjusted
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_profile_id, framework, role, reading_kind)
);

COMMENT ON TABLE public.person_profile_constitutions IS
  'TL-2 person-side constitutional junction: one row per (profile × framework × primary/secondary × computed/adjusted). pattern_id resolves against the framework''s one-home reference table (eden_patterns / constitutions C01–C07 / doshas / tcm_patterns) — enforced by trigger since a single FK cannot span four tables. Writes are service-role EF only per Lock #40/#41; owner-scoped SELECT for clients. completion_id is the audit pointer to the diagnostic_completions row that established the reading (Lock #38).';

-- Polymorphic pattern_id: validate per-lens against the one-home table.
CREATE OR REPLACE FUNCTION public.tg_ppc_validate_pattern()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.framework = 'eden' THEN
    IF NOT EXISTS (SELECT 1 FROM public.eden_patterns WHERE pattern_id = NEW.pattern_id) THEN
      RAISE EXCEPTION 'person_profile_constitutions: unknown eden pattern_id %', NEW.pattern_id;
    END IF;
  ELSIF NEW.framework = 'western' THEN
    IF NOT EXISTS (SELECT 1 FROM public.constitutions
                    WHERE constitution_id = NEW.pattern_id
                      AND system = 'Western' AND deprecated = false) THEN
      RAISE EXCEPTION 'person_profile_constitutions: unknown western constitution_id %', NEW.pattern_id;
    END IF;
  ELSIF NEW.framework = 'ayurveda' THEN
    IF NOT EXISTS (SELECT 1 FROM public.doshas WHERE dosha_id = NEW.pattern_id) THEN
      RAISE EXCEPTION 'person_profile_constitutions: unknown dosha_id %', NEW.pattern_id;
    END IF;
  ELSIF NEW.framework = 'tcm' THEN
    IF NOT EXISTS (SELECT 1 FROM public.tcm_patterns WHERE pattern_id = NEW.pattern_id) THEN
      RAISE EXCEPTION 'person_profile_constitutions: unknown tcm pattern_id %', NEW.pattern_id;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ppc_validate_pattern
  BEFORE INSERT OR UPDATE ON public.person_profile_constitutions
  FOR EACH ROW EXECUTE FUNCTION public.tg_ppc_validate_pattern();

CREATE INDEX IF NOT EXISTS person_profile_constitutions_profile_idx
  ON public.person_profile_constitutions (person_profile_id, framework);

ALTER TABLE public.person_profile_constitutions ENABLE ROW LEVEL SECURITY;

-- Owner-scoped read; NO client write policies — the single write surface is
-- the practitioner/diagnostic EF running service-role (Lock #40/#41, TL-4).
CREATE POLICY person_profile_constitutions_select_own
  ON public.person_profile_constitutions FOR SELECT
  USING (EXISTS (SELECT 1
                   FROM public.person_profiles pp
                  WHERE pp.id = person_profile_constitutions.person_profile_id
                    AND pp.user_id = auth.uid()));

-- Continuous axis positions + full four-framework snapshot on the completion
-- row (TL-2 second half, TL-7). Scale: -1.0 … +1.0 per axis, signed toward
-- the "active" pole — temperature: -1 cold → +1 hot; moisture: -1 dry → +1
-- damp; tone: -1 relaxed → +1 tense. |score| below the engine's balanced
-- band resolves the axis to balanced/indeterminate rather than a pole
-- (TL-7 Genuinely-Balanced model; Lock #39 posture — never force a pole).
ALTER TABLE public.diagnostic_completions
  ADD COLUMN IF NOT EXISTS temperature_score  numeric CHECK (temperature_score BETWEEN -1 AND 1),
  ADD COLUMN IF NOT EXISTS moisture_score     numeric CHECK (moisture_score    BETWEEN -1 AND 1),
  ADD COLUMN IF NOT EXISTS tone_score         numeric CHECK (tone_score        BETWEEN -1 AND 1),
  ADD COLUMN IF NOT EXISTS axis_confidence    jsonb,
  ADD COLUMN IF NOT EXISTS framework_readings jsonb;

COMMENT ON COLUMN public.diagnostic_completions.framework_readings IS
  'Full multi-framework engine output for this completion (PD-5/PD-6/PD-10): per-lens primary + secondary + spectrum scores + confidence, plus the cross-framework disagreement set. Snapshot for audit + delta-tracking; the standing reading fans out to person_profile_constitutions.';
COMMENT ON COLUMN public.diagnostic_completions.axis_confidence IS
  'Per-axis confidence + balanced/indeterminate flags (TL-7): {temperature:{confidence, balanced}, moisture:{...}, tone:{...}}.';
