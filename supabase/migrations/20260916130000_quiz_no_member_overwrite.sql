-- Founder decision 2026-09-15: the free quiz cannot overwrite a member.
--
-- Before: public.tg_quiz_completion_sync_constitution (AFTER INSERT, and AFTER
-- UPDATE OF constitution_type, on public.quiz_completions) copied every quiz
-- result onto public.profiles.constitution_type and the member's self
-- person_profiles.eden_constitution, matched ONLY by email. The quiz is public
-- and signed out, so anyone who typed a member's email changed that member's
-- saved Pattern.
--
-- After: the trigger only FILLS values that are empty.
--   * profiles.constitution_type  is set only when NULL or blank
--   * person_profiles.eden_constitution (is_self row) is set only when NULL
--   * profiles.display_name keeps its existing fill-if-empty rule (unchanged)
-- The quiz_completions row itself (the lead record) still stores the new
-- result, and the quiz_completions_to_waitlist trigger is untouched.
--
-- A signed-in retake still updates the member's own Pattern: resend-waitlist
-- verifies the caller's JWT and, when the account email matches the submitted
-- email, writes profiles / person_profiles by user_id
-- (supabase/functions/_shared/quiz-member-retake.ts). The in-app diagnostic
-- (record-diagnostic-completion -> diagnostic_completions ->
-- tg_diagnostic_completion_sync_profile) is a separate path and is unchanged.
--
-- Body verified against production (pg_get_functiondef) on 2026-09-15 before
-- this change; only the two SET/WHERE rules below differ. Settings kept exactly:
-- SECURITY DEFINER, search_path public, pg_temp. CREATE OR REPLACE keeps the
-- existing ACL and the two triggers that call it; production grants EXECUTE to
-- PUBLIC, anon, authenticated and service_role and revokes nothing (a trigger
-- function cannot be called outside a trigger, so the grant is inert), so no
-- grant or revoke is issued here. Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.tg_quiz_completion_sync_constitution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_slug    text;
BEGIN
  IF NEW.constitution_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2026-09-15: fill-if-empty only. An anonymous quiz submission must never
  -- replace a Pattern the account already has.
  -- v3.33.2: also propagate first_name -> display_name where display_name is unset.
  UPDATE public.profiles
     SET constitution_type = CASE
                               WHEN NULLIF(btrim(profiles.constitution_type), '') IS NULL
                                 THEN NEW.constitution_type
                               ELSE profiles.constitution_type
                             END,
         display_name = COALESCE(NULLIF(profiles.display_name, ''), NEW.first_name)
   WHERE email = NEW.email
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    v_slug := public.eden_pattern_canonical_slug(NEW.constitution_type);
    IF v_slug IS NOT NULL THEN
      UPDATE public.person_profiles
         SET eden_constitution = v_slug
       WHERE user_id = v_user_id
         AND is_self IS TRUE
         AND eden_constitution IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_quiz_completion_sync_constitution() IS
  'Quiz -> account bridge. Fill-if-empty only (2026-09-15): an anonymous quiz submission never overwrites profiles.constitution_type or person_profiles.eden_constitution. Signed-in retakes are applied by user_id in resend-waitlist.';
