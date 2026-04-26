-- =============================================================================
-- 20260426143000_diagnostic_contract_hardening.sql
-- =============================================================================
-- Stage 6.3.5 Phase B sub-task 4 follow-up — diagnostic-contract hardening.
-- Closes the architectural drift surfaced by the v3.15 independent audit:
--   • Layer 3 (tissue state profile) update semantics: REPLACE → UPSERT-per-pair
--     (additive across body systems; partial Layer-3 payloads now preserve
--     unrelated junction rows). Lock #42 (proposed).
--   • Single-write-surface for diagnostic_completions: REVOKE INSERT from
--     authenticated role; record-diagnostic-completion Edge Function (service-
--     role) becomes the sole write surface. SELECT permission unchanged.
--     Lock #41 (proposed).
--   • Junction-table citation provenance: ADD completion_id FK on
--     person_profile_tissue_states pointing at the diagnostic_completions row
--     that established each (body_system, tissue_state) pair. Lock #38
--     (citation integrity) reinforcement.
--   • diagnostic_completions.quiz_version DEFAULT 'v1' → 'v1-diagnostic'.
--     Reserves the v1 namespace for quiz_completions / marketing pipeline
--     per Lock #40 strict separation. EF will require the field explicitly
--     and validate against the allowlist (v1-diagnostic, v2-deep) — DEFAULT
--     is belt-and-suspenders for any future caller path.
--
-- Audit trail per established Apothecary pattern (Lock #14, Manual is source
-- of truth). All changes are idempotent (IF NOT EXISTS / ON CONFLICT) so
-- this migration can be applied through SQL Editor first and committed as
-- the audit-trail PR afterward without divergence.
--
-- Order matters:
--   1. Junction-table column adds (completion_id, updated_at)
--   2. Trigger rewrite (Layer 3 UPSERT-per-pair; Layers 1, 2, 4 unchanged COALESCE)
--   3. RLS revoke INSERT from authenticated (single-write-surface)
--   4. quiz_version DEFAULT change
--
-- Smoke tests (DO-block + RAISE EXCEPTION rollback per feedback_smoke_test_pattern.md)
-- are listed at the bottom of this file as commented examples; they are
-- intended for SQL Editor execution against test+seed fixture, not for the
-- migration body itself.

BEGIN;

-- =============================================================================
-- 1. Junction-table columns: completion_id (citation pointer), updated_at
-- =============================================================================
-- completion_id: each junction row records which diagnostic_completions row
-- established its (person_profile_id, body_system_id) value. Per Lock #38,
-- diagnostic claims are citation-anchored — this lets the surfaced UI label
-- "your nervous-system tissue state was assessed via [v2-deep diagnostic on
-- 2026-04-26]" trace back to a real audit row.
-- ON DELETE SET NULL: if the source completion is later purged (retention),
-- the junction row stays but loses its provenance pointer; this is a
-- deliberate trade — preserving the diagnosis matters more than the link.

ALTER TABLE public.person_profile_tissue_states
  ADD COLUMN IF NOT EXISTS completion_id uuid
    REFERENCES public.diagnostic_completions(id) ON DELETE SET NULL;

ALTER TABLE public.person_profile_tissue_states
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.person_profile_tissue_states.completion_id IS
  'FK to the diagnostic_completions row that established this (body_system, tissue_state) pair. Null when set by a completion that has since been purged. Per Lock #38 (citation integrity).';
COMMENT ON COLUMN public.person_profile_tissue_states.updated_at IS
  'Last UPSERT timestamp. Distinct from recorded_at (creation timestamp). Updated by tg_diagnostic_completion_sync_profile on every overwrite per Lock #42.';

-- =============================================================================
-- 2. Trigger rewrite: Layer 3 UPSERT-per-pair (Lock #42)
-- =============================================================================
-- Replaces v3.14 PR #24 trigger body. Layer 1, 2, 4 fan-out via COALESCE is
-- unchanged. Layer 3 fan-out changes from DELETE+INSERT (REPLACE) to
-- INSERT … ON CONFLICT DO UPDATE (UPSERT-per-pair).
--
-- Why UPSERT: tissue-state assessment is iterative per body system. A Root
-- user updating one body system's tissue state must NOT lose unrelated
-- assessments. Symmetry with Layers 1, 2, 4 (already COALESCE-additive).
-- Citation provenance preserved: completion_id is propagated on each insert
-- and updated on conflict.
--
-- Backward compatibility: existing junction rows that pre-date this
-- migration have completion_id NULL (no provenance pointer). New writes
-- populate it. The frontend tolerates NULL completion_id and surfaces the
-- pre-migration rows as "provenance unknown" if the UI ever asks.

CREATE OR REPLACE FUNCTION public.tg_diagnostic_completion_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Layers 1, 2, 4 + completed_at: COALESCE-fan into person_profiles.
  -- Each layer is independently optional in any given completion row;
  -- COALESCE preserves prior values when a layer is omitted from this call.
  UPDATE public.person_profiles
    SET eden_constitution        = COALESCE(NEW.eden_constitution, eden_constitution),
        galenic_temperament      = COALESCE(NEW.galenic_temperament, galenic_temperament),
        vital_force_reading      = COALESCE(NEW.vital_force_reading, vital_force_reading),
        diagnostic_completed_at  = COALESCE(NEW.completed_at, diagnostic_completed_at)
    WHERE id = NEW.person_profile_id;

  -- Layer 3 (tissue state profile by organ system): UPSERT-per-pair into
  -- person_profile_tissue_states junction. Each (body_system_id, tissue_state_id)
  -- entry in the JSONB payload is an independent assertion — partial submissions
  -- (e.g. updating only the nervous-system tissue state) preserve unrelated
  -- body-system rows. Per Lock #42.
  IF NEW.tissue_state_profile IS NOT NULL THEN
    INSERT INTO public.person_profile_tissue_states
        (person_profile_id, body_system_id, tissue_state_id, completion_id, recorded_at, updated_at)
    SELECT NEW.person_profile_id,
           key,
           value,
           NEW.id,
           NEW.completed_at,
           now()
      FROM jsonb_each_text(NEW.tissue_state_profile)
    ON CONFLICT (person_profile_id, body_system_id) DO UPDATE
      SET tissue_state_id = EXCLUDED.tissue_state_id,
          completion_id   = EXCLUDED.completion_id,
          updated_at      = now();
    -- recorded_at intentionally NOT touched on conflict: it represents the
    -- first-assessment timestamp for that body system; subsequent overwrites
    -- bump updated_at only.
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_diagnostic_completion_sync_profile() IS
  'AFTER INSERT trigger on diagnostic_completions. Fans Layers 1+2+4 into person_profiles (COALESCE — partial calls preserve unspecified columns). Fans Layer 3 (tissue_state_profile JSONB) into person_profile_tissue_states junction via UPSERT-per-pair (additive — partial Layer-3 payloads preserve unrelated body systems). Per Lock #37 (layer numbering), Lock #38 (citation provenance via completion_id), Lock #42 (UPSERT semantics). SECURITY DEFINER so RLS does not block writes.';

-- =============================================================================
-- 3. RLS: revoke INSERT from authenticated; service-role becomes sole writer
-- =============================================================================
-- Per Lock #41 (proposed): record-diagnostic-completion Edge Function is the
-- only write surface for diagnostic_completions. The EF authenticates the
-- caller via JWT (auth.uid()), validates ownership of the supplied
-- person_profile_id, and only then performs a service-role INSERT. Direct
-- PostgREST INSERT from authenticated is structurally disallowed.
--
-- Closes the cross-user write hole identified in the v3.15 audit (an
-- authenticated user with knowledge of another user's person_profile_id
-- could INSERT into diagnostic_completions and trigger SECURITY DEFINER
-- fan-out into the target user's row — RLS WITH CHECK validated only
-- user_id, not person_profile_id ownership).
--
-- Strict reading of Lock #40 (id-keyed clinical writes via Edge Functions).
--
-- The diagnostic_completions_insert_own POLICY remains in place; revoking
-- the table privilege is the actual block. Policies don't grant privilege —
-- they restrict it. Without the table privilege, the policy is moot for
-- authenticated callers; service_role bypasses RLS entirely so the EF's
-- service-role INSERT continues to work.

REVOKE INSERT ON public.diagnostic_completions FROM authenticated;

-- SELECT remains for owners (RLS-scoped by diagnostic_completions_select_own).
-- Verify this is still in effect (no-op if already granted; idempotent guard).
GRANT SELECT ON public.diagnostic_completions TO authenticated;

-- The diagnostic_completions_insert_own policy is left in place as a
-- defense-in-depth artifact: even if a future migration accidentally
-- re-grants INSERT, the policy still requires auth.uid() = user_id.

-- =============================================================================
-- 4. quiz_version DEFAULT: 'v1' → 'v1-diagnostic'
-- =============================================================================
-- Per Lock #40 strict separation: 'v1' belongs to the marketing pipeline
-- (quiz_completions table). diagnostic_completions writes are the in-app
-- diagnostic surface and should be tagged distinctly. EF validates against
-- the allowlist {v1-diagnostic, v2-deep}; DEFAULT covers the no-EF future
-- caller (none should exist post-#3 above, but defaulting to a sensible
-- in-app-namespace value is the right posture).

ALTER TABLE public.diagnostic_completions
  ALTER COLUMN quiz_version SET DEFAULT 'v1-diagnostic';

COMMENT ON COLUMN public.diagnostic_completions.quiz_version IS
  'Diagnostic quiz version that produced this row. Allowlist: v1-diagnostic (in-app 12-q diagnostic), v2-deep (Root 40-q deep diagnostic). Marketing-pipeline quiz_version = v1 lives on quiz_completions, never here. Per Lock #40.';

COMMIT;

-- =============================================================================
-- Smoke tests (run separately after migration apply, NOT inside the BEGIN/COMMIT).
-- All use DO-block + RAISE EXCEPTION 'SMOKE_TEST_RESULT: …' rollback so they
-- exercise mutation paths without leaving artifacts in production data.
-- =============================================================================

-- ── Smoke #1: cross-user write rejection (Major #2 audit finding) ──
-- After REVOKE INSERT, an authenticated direct PostgREST INSERT must fail.
-- Run as authenticated role (set role authenticated; … reset role).
--
-- DO $$
-- DECLARE
--   v_test_user_id uuid := 'eb281f8c-e417-45d3-ac5f-fc8d6650c8eb'; -- test+seed
--   v_other_profile_id uuid;
-- BEGIN
--   -- Pick any person_profile not owned by test+seed (should fail anyway because
--   -- of REVOKE; we don't even need a real cross-user target).
--   SELECT id INTO v_other_profile_id FROM public.person_profiles
--     WHERE user_id <> v_test_user_id LIMIT 1;
--   IF v_other_profile_id IS NULL THEN
--     v_other_profile_id := gen_random_uuid();
--   END IF;
--
--   SET LOCAL ROLE authenticated;
--   PERFORM set_config('request.jwt.claim.sub', v_test_user_id::text, true);
--
--   INSERT INTO public.diagnostic_completions
--     (user_id, person_profile_id, eden_constitution, tissue_state_profile, raw_responses, quiz_version)
--   VALUES (v_test_user_id, v_other_profile_id, 'the_burning_bowstring', NULL, NULL, 'v1-diagnostic');
--
--   RESET ROLE;
--   RAISE EXCEPTION 'SMOKE_TEST_FAIL: authenticated INSERT was permitted but should have been blocked by REVOKE';
-- EXCEPTION
--   WHEN insufficient_privilege THEN
--     RESET ROLE;
--     RAISE EXCEPTION 'SMOKE_TEST_PASS: authenticated INSERT correctly blocked (insufficient_privilege)';
-- END $$;

-- ── Smoke #3: Layer 3 UPSERT preserves unrelated body systems (Major #3) ──
-- DO $$
-- DECLARE
--   v_test_user_id uuid := 'eb281f8c-e417-45d3-ac5f-fc8d6650c8eb';
--   v_test_profile_id uuid;
--   v_count_after_first int;
--   v_count_after_second int;
--   v_sy01_state text;
--   v_sy07_state text;
-- BEGIN
--   SELECT id INTO v_test_profile_id FROM public.person_profiles
--     WHERE user_id = v_test_user_id AND is_self LIMIT 1;
--   IF v_test_profile_id IS NULL THEN
--     RAISE EXCEPTION 'SMOKE_TEST_SKIP: no self person_profile for test+seed';
--   END IF;
--
--   -- Completion 1: write SY01 + SY07.
--   INSERT INTO public.diagnostic_completions
--     (user_id, person_profile_id, tissue_state_profile, raw_responses, quiz_version)
--   VALUES (v_test_user_id, v_test_profile_id,
--           '{"SY01":"TS06","SY07":"TS09"}'::jsonb,
--           '{"q":"a"}'::jsonb,
--           'v1-diagnostic');
--   SELECT count(*) INTO v_count_after_first FROM public.person_profile_tissue_states
--     WHERE person_profile_id = v_test_profile_id;
--
--   -- Completion 2: write only SY01 (different state). Expectation: SY07 preserved, SY01 updated.
--   INSERT INTO public.diagnostic_completions
--     (user_id, person_profile_id, tissue_state_profile, raw_responses, quiz_version)
--   VALUES (v_test_user_id, v_test_profile_id,
--           '{"SY01":"TS10"}'::jsonb,
--           '{"q":"b"}'::jsonb,
--           'v1-diagnostic');
--   SELECT count(*) INTO v_count_after_second FROM public.person_profile_tissue_states
--     WHERE person_profile_id = v_test_profile_id;
--   SELECT tissue_state_id INTO v_sy01_state FROM public.person_profile_tissue_states
--     WHERE person_profile_id = v_test_profile_id AND body_system_id = 'SY01';
--   SELECT tissue_state_id INTO v_sy07_state FROM public.person_profile_tissue_states
--     WHERE person_profile_id = v_test_profile_id AND body_system_id = 'SY07';
--
--   RAISE EXCEPTION 'SMOKE_TEST_RESULT: after_first=%, after_second=%, sy01=%, sy07=%',
--     v_count_after_first, v_count_after_second, v_sy01_state, v_sy07_state;
--   -- Expected: after_first=2, after_second=2 (preserved), sy01=TS10 (updated), sy07=TS09 (preserved)
-- END $$;
