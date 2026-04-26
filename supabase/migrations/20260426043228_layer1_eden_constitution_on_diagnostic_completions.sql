-- Layer 1+2 schema: extend diagnostic_completions to support Layer 1 (Eden Pattern)
-- Per Manual v3.13 Lock #40 and signed-off Layer 2 architectural recommendation.
-- Audit-trail PR: schema is already live in production (applied via SQL Editor April 26, 2026 early-morning UTC).
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE for trigger function, ALTER COLUMN DROP NOT NULL is naturally idempotent.

BEGIN;

-- Layer 1 column on the audit table
ALTER TABLE public.diagnostic_completions ADD COLUMN IF NOT EXISTS eden_constitution text;

-- Relax NOT NULL on tissue_state_profile + raw_responses so Layer-1-only diagnostic_completions rows
-- (eden_constitution set, others NULL) can land. Existing Layer 2-4 INSERTs continue to provide values.
ALTER TABLE public.diagnostic_completions ALTER COLUMN tissue_state_profile DROP NOT NULL;
ALTER TABLE public.diagnostic_completions ALTER COLUMN raw_responses DROP NOT NULL;

-- Recompile the sync trigger to fan eden_constitution into person_profiles via COALESCE pattern.
-- Each layer column is now optional in any given diagnostic_completions row:
--   Layer-1-only row → updates only eden_constitution
--   Layers-2-4-only row → updates only the deep columns
--   Full Layers-1-4 row → updates everything
CREATE OR REPLACE FUNCTION public.tg_diagnostic_completion_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.person_profiles SET
    eden_constitution      = COALESCE(NEW.eden_constitution,      eden_constitution),
    galenic_temperament    = COALESCE(NEW.galenic_temperament,    galenic_temperament),
    vital_force_reading    = COALESCE(NEW.vital_force_reading,    vital_force_reading),
    diagnostic_completed_at = NEW.completed_at
  WHERE id = NEW.person_profile_id;

  IF NEW.tissue_state_profile IS NOT NULL THEN
    DELETE FROM public.person_profile_tissue_states WHERE person_profile_id = NEW.person_profile_id;
    INSERT INTO public.person_profile_tissue_states (person_profile_id, body_system_id, tissue_state_id)
    SELECT NEW.person_profile_id, key, value
    FROM jsonb_each_text(NEW.tissue_state_profile);
  END IF;

  RETURN NEW;
END;
$func$;

-- Verify
DO $verify$
DECLARE v_col_exists boolean; v_func_exists boolean; v_tsp_nullable text; v_rr_nullable text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='diagnostic_completions' AND column_name='eden_constitution') INTO v_col_exists;
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='tg_diagnostic_completion_sync_profile' AND pronamespace='public'::regnamespace) INTO v_func_exists;
  SELECT is_nullable INTO v_tsp_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='diagnostic_completions' AND column_name='tissue_state_profile';
  SELECT is_nullable INTO v_rr_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='diagnostic_completions' AND column_name='raw_responses';
  IF NOT v_col_exists THEN RAISE EXCEPTION 'eden_constitution column missing'; END IF;
  IF NOT v_func_exists THEN RAISE EXCEPTION 'sync trigger function missing'; END IF;
  IF v_tsp_nullable <> 'YES' OR v_rr_nullable <> 'YES' THEN RAISE EXCEPTION 'Expected nullable; got tsp=% rr=%', v_tsp_nullable, v_rr_nullable; END IF;
END $verify$;

COMMIT;
