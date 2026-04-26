-- Phase B drift correction: clinical_canonical flag + SY15 Integumentary + FK trigger
-- Per reference_drift_phase_b_answers.md and Manual v3.13 Session Log.
-- Audit-trail PR: schema is already live in production (applied via SQL Editor April 26, 2026 early-morning UTC).
-- Idempotent: ADD COLUMN IF NOT EXISTS, INSERT ... ON CONFLICT, DROP TRIGGER IF EXISTS so re-run is safe.

BEGIN;

ALTER TABLE public.body_systems ADD COLUMN IF NOT EXISTS clinical_canonical boolean NOT NULL DEFAULT false;
ALTER TABLE public.tissue_states ADD COLUMN IF NOT EXISTS clinical_canonical boolean NOT NULL DEFAULT false;

-- Add SY15 Integumentary (Q3 founder answer: priority organ system per Lock #37; Cook 1869 / Felter 1922 emphasize integumentary as a primary terrain marker)
INSERT INTO public.body_systems (system_id, system_name, description) VALUES
  ('SY15', 'Integumentary', 'Skin, hair, nails — boundary organ + elimination route. Cook 1869 / Felter 1922 emphasize integumentary as a primary terrain marker. Lock #37 priority organ system.')
ON CONFLICT (system_id) DO NOTHING;

-- Flag the 6 priority body systems (nervous, musculoskeletal, cardiovascular, respiratory, digestive, integumentary)
UPDATE public.body_systems SET clinical_canonical = true
  WHERE system_id IN ('SY01','SY04','SY06','SY07','SY08','SY15');

-- Flag Cook's 7 canonical tissue states (with concept-mapping per founder Q1, Q2 answers in reference_drift_phase_b_answers.md)
-- TS02 atrophy, TS06 Acute Inflammation (=Cook's irritation), TS09 Laxity (=Cook's atony), TS10 excitation, TS11 depression, TS12 constriction, TS19 torpor
UPDATE public.tissue_states SET clinical_canonical = true
  WHERE state_id IN ('TS02','TS06','TS09','TS10','TS11','TS12','TS19');

-- Trigger function: enforce that person_profile_tissue_states inserts/updates only reference clinical_canonical entries
CREATE OR REPLACE FUNCTION public.tg_pp_tissue_states_enforce_canonical()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.body_systems
    WHERE system_id = NEW.body_system_id AND clinical_canonical = true
  ) THEN
    RAISE EXCEPTION 'body_system_id % not clinical_canonical', NEW.body_system_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tissue_states
    WHERE state_id = NEW.tissue_state_id AND clinical_canonical = true
  ) THEN
    RAISE EXCEPTION 'tissue_state_id % not clinical_canonical', NEW.tissue_state_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$func$;

-- Trigger (drop-recreate for idempotency)
DROP TRIGGER IF EXISTS trg_pp_tissue_states_enforce_canonical ON public.person_profile_tissue_states;
CREATE TRIGGER trg_pp_tissue_states_enforce_canonical
  BEFORE INSERT OR UPDATE ON public.person_profile_tissue_states
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pp_tissue_states_enforce_canonical();

-- Verification: 6 canonical body systems, 7 canonical tissue states. Raises and aborts the transaction if counts don't match.
DO $verify$
DECLARE v_bs int; v_ts int;
BEGIN
  SELECT count(*) INTO v_bs FROM public.body_systems WHERE clinical_canonical = true;
  SELECT count(*) INTO v_ts FROM public.tissue_states WHERE clinical_canonical = true;
  IF v_bs <> 6 OR v_ts <> 7 THEN
    RAISE EXCEPTION 'Expected 6 bs + 7 ts canonical, got % bs + % ts', v_bs, v_ts;
  END IF;
END $verify$;

COMMIT;
