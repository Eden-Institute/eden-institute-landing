-- Stage 6.3.5 Phase B sub-task 2 — quiz-completion -> constitution sync trigger
-- Per Manual §0.8 #31: quiz result writes back to profiles.constitution_type and
-- person_profiles.eden_constitution (self-profile only).
-- Keyed by email because quiz_completions has no user_id (quiz lives on marketing surface,
-- email-binding lets pre-signup quiz results re-attach when the user creates an account).
-- Applied to noeqztssupewjidpvhar via SQL Editor on 2026-04-25 prior to this PR.

CREATE OR REPLACE FUNCTION public.tg_quiz_completion_sync_constitution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.constitution_type IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
     SET constitution_type = NEW.constitution_type
   WHERE email = NEW.email
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.person_profiles
       SET eden_constitution = NEW.constitution_type
     WHERE user_id = v_user_id AND is_self IS TRUE;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER quiz_completion_sync_constitution_insert_trg
AFTER INSERT ON public.quiz_completions
FOR EACH ROW EXECUTE FUNCTION public.tg_quiz_completion_sync_constitution();

CREATE TRIGGER quiz_completion_sync_constitution_update_trg
AFTER UPDATE OF constitution_type ON public.quiz_completions
FOR EACH ROW
WHEN (OLD.constitution_type IS DISTINCT FROM NEW.constitution_type)
EXECUTE FUNCTION public.tg_quiz_completion_sync_constitution();

COMMENT ON FUNCTION public.tg_quiz_completion_sync_constitution IS 'Stage 6.3.5 Phase B. Mirrors the latest constitutional quiz result into profiles.constitution_type (email match) and person_profiles.eden_constitution (self-profile of that user). No-op if email matches no profile (pre-signup quiz result remains in quiz_completions until the user creates an account). Manual §0.8 #31.';
