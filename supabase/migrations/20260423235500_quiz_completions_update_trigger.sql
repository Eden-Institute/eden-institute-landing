-- ============================================================
-- Stage 2 follow-up — quiz_completions AFTER UPDATE trigger
-- Companion to 20260423232500_waitlist_signups.sql.
--
-- The prior migration installed AFTER INSERT on quiz_completions →
-- waitlist_signups. That path covers the first time someone takes
-- the quiz. This migration closes the retake gap: if the existing
-- resend-waitlist Edge Function PATCHes a quiz_completions row
-- (retake with a different constitution), AFTER INSERT does not
-- fire, so waitlist_signups.metadata would stay frozen to the
-- first-take result.
--
-- Fix: add an AFTER UPDATE trigger that reuses the existing
-- public.quiz_completions_to_waitlist() function, gated by a WHEN
-- clause that only fires when constitution fields actually change.
-- The function already uses ON CONFLICT (email, entry_funnel) DO
-- UPDATE SET metadata = EXCLUDED.metadata, so entered_at is
-- preserved and the current-state projection refreshes.
--
-- Idempotent. Re-applying is a no-op.
-- ============================================================

DROP TRIGGER IF EXISTS quiz_completions_update_to_waitlist_trg
  ON public.quiz_completions;

CREATE TRIGGER quiz_completions_update_to_waitlist_trg
  AFTER UPDATE ON public.quiz_completions
  FOR EACH ROW
  WHEN (
    OLD.constitution_type     IS DISTINCT FROM NEW.constitution_type
    OR OLD.constitution_name     IS DISTINCT FROM NEW.constitution_name
    OR OLD.constitution_nickname IS DISTINCT FROM NEW.constitution_nickname
  )
  EXECUTE FUNCTION public.quiz_completions_to_waitlist();
