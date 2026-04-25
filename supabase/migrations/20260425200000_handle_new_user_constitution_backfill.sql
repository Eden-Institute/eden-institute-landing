-- =============================================================================
-- Stage 6.3.5 Phase B sub-task 3 prerequisite — signup-side constitution back-fill
-- =============================================================================
--
-- Phase B sub-task 2 (PR #17) shipped an AFTER INSERT trigger on
-- public.quiz_completions that copies constitution_type into the matching
-- public.profiles row by email. That covers the post-signup quiz path:
-- a logged-in user retakes the quiz, profiles already exists, trigger updates.
--
-- It does NOT cover the dominant funnel: a marketing-surface visitor takes the
-- quiz first, lands a quiz_completions row with no matching profiles row (the
-- trigger no-ops), then signs up later — at which point profiles is created
-- by handle_new_user without ever consulting quiz_completions, leaving
-- constitution_type NULL forever unless they retake the quiz post-signup.
--
-- This migration extends public.handle_new_user to read the most recent
-- public.quiz_completions row for the new user's email at signup time and
-- populate profiles.constitution_type in the same INSERT. Atomic, idempotent,
-- preserves all prior behavior.
--
-- Closes the gap that the Phase B sub-task 3 personalization hero will sit
-- on top of. Without this, the hero would render the take-the-quiz fallback
-- for 100% of pre-signup quiz takers — which is the entire production funnel.
--
-- Architectural notes:
--   * Email match is case-insensitive (lower(email)) to mirror the Phase B
--     sub-task 2 trigger pattern and the quiz_completions_lower_email_idx
--     introduced in 20260423232500_waitlist_signups.sql.
--   * ORDER BY completed_at DESC LIMIT 1 picks the most recent attempt if a
--     user took the quiz multiple times pre-signup — consistent with the
--     "latest taken value wins" semantics the sync trigger enforces post-signup.
--   * SECURITY DEFINER + SET search_path TO 'public' inherited from prior
--     handle_new_user definition — this function reads from public.quiz_completions
--     across the auth.users → public.profiles boundary.
--   * ON CONFLICT (user_id) DO NOTHING preserves the pre-existing idempotency
--     guarantee — a re-run on an already-created profile is still a no-op.
--   * No change to the trigger wiring (on_auth_user_created remains attached
--     to auth.users AFTER INSERT EXECUTE FUNCTION public.handle_new_user()).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_constitution_type text := null;
begin
  -- Email-keyed back-fill: look up the most recent quiz_completions row for
  -- this email (case-insensitive). NULL if no pre-signup quiz attempt exists.
  select qc.constitution_type
    into v_constitution_type
    from public.quiz_completions qc
   where lower(qc.email) = lower(new.email)
     and qc.constitution_type is not null
   order by qc.completed_at desc
   limit 1;

  insert into public.profiles (user_id, email, subscription_tier, constitution_type)
  values (new.id, new.email, 'free', v_constitution_type)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- =============================================================================
-- Smoke verification (DO block + RAISE EXCEPTION rollback pattern)
-- =============================================================================
--
-- Run AFTER applying the migration to confirm the back-fill fires correctly.
-- This block:
--   1. Inserts a quiz_completions row for a synthetic email
--   2. Simulates the auth.users INSERT path by calling handle_new_user via
--      a trigger fire on a transient row (not actually creating a real user)
--   3. Inspects whether profiles.constitution_type was populated
--   4. RAISES EXCEPTION to roll back EVERYTHING so no test data persists.
--
-- Because handle_new_user fires on auth.users INSERT and we cannot easily
-- create-then-rollback an auth.users row from psql, the production smoke test
-- lives separately in the Step C smoke test (fires from the marketing quiz
-- against the test+seed fixture). This DO block is here as documentation of
-- the back-fill semantics; uncomment to run as a static schema check.
--
-- DO $smoke$
-- DECLARE
--   v_test_email text := 'smoke-backfill-' || gen_random_uuid()::text || '@example.com';
--   v_test_constitution text := 'The Burning Bowstring';
--   v_test_user_id uuid := gen_random_uuid();
--   v_resulting_constitution text;
-- BEGIN
--   -- Pre-stage: insert a quiz_completions row before signup
--   INSERT INTO public.quiz_completions (email, constitution_type, completed_at, purchased_course, purchased_guide)
--   VALUES (v_test_email, v_test_constitution, now(), false, false);
--
--   -- Simulate handle_new_user being called by directly inserting into profiles
--   -- the way the function would (we cannot easily fake an auth.users INSERT
--   -- from a regular DO block).
--   PERFORM public.handle_new_user() FROM (SELECT v_test_user_id AS id, v_test_email AS email) AS new;
--   -- (Direct PERFORM of trigger functions is not supported; this section is
--   --  illustrative only — see Step C smoke test for the real production path.)
--
--   RAISE EXCEPTION 'SMOKE_TEST_ROLLBACK: back-fill verification complete';
-- END
-- $smoke$;
