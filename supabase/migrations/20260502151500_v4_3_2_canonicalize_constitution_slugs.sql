-- v4.3.2 — Canonicalize legacy constitution slugs to the_* snake_case form.
--
-- Background. Two writer pipelines reach the same columns with different
-- slug shapes:
--   record-quiz-completion + resend-waitlist (marketing) → "pressure-cooker"
--   record-diagnostic-completion (in-app)                → "the_pressure_cooker"
--
-- Resolver tolerance was patched in PR #112 (src/lib/edenPattern.ts) so both
-- shapes resolve correctly. This migration normalizes existing data to the
-- canonical snake_case-with-the_-prefix form so the database stops carrying
-- drift across writers. Canonical = the form record-diagnostic-completion's
-- normalizeEdenConstitution allowlist accepts (the more rigorous writer).
--
-- Idempotent. CASE rewrites match exact legacy strings; rows already in
-- canonical form (no match) pass through unchanged. Re-running this migration
-- is a no-op once the dataset is canonicalized.
--
-- Sync-trigger bypass. profiles.constitution_type → person_profiles.eden_constitution
-- has a sync trigger (Lock #41). For data cleanup we bypass via
-- session_replication_role='replica' so the trigger does not re-fan and
-- does not interpret the rewrite as a fresh diagnostic reading.

BEGIN;

-- Bypass triggers for data cleanup.
SET LOCAL session_replication_role = 'replica';

-- profiles.constitution_type — five expected rewrites per pre-migration audit.
UPDATE public.profiles
SET constitution_type = CASE constitution_type
  WHEN 'burning-bowstring' THEN 'the_burning_bowstring'
  WHEN 'open-flame'        THEN 'the_open_flame'
  WHEN 'pressure-cooker'   THEN 'the_pressure_cooker'
  WHEN 'overflowing-cup'   THEN 'the_overflowing_cup'
  WHEN 'drawn-bowstring'   THEN 'the_drawn_bowstring'
  WHEN 'spent-candle'      THEN 'the_spent_candle'
  WHEN 'frozen-knot'       THEN 'the_frozen_knot'
  WHEN 'still-water'       THEN 'the_still_water'
  ELSE constitution_type
END
WHERE constitution_type IN (
  'burning-bowstring', 'open-flame', 'pressure-cooker', 'overflowing-cup',
  'drawn-bowstring', 'spent-candle', 'frozen-knot', 'still-water'
);

-- person_profiles.eden_constitution — two expected rewrites per audit.
UPDATE public.person_profiles
SET eden_constitution = CASE eden_constitution
  WHEN 'burning-bowstring' THEN 'the_burning_bowstring'
  WHEN 'open-flame'        THEN 'the_open_flame'
  WHEN 'pressure-cooker'   THEN 'the_pressure_cooker'
  WHEN 'overflowing-cup'   THEN 'the_overflowing_cup'
  WHEN 'drawn-bowstring'   THEN 'the_drawn_bowstring'
  WHEN 'spent-candle'      THEN 'the_spent_candle'
  WHEN 'frozen-knot'       THEN 'the_frozen_knot'
  WHEN 'still-water'       THEN 'the_still_water'
  ELSE eden_constitution
END
WHERE eden_constitution IN (
  'burning-bowstring', 'open-flame', 'pressure-cooker', 'overflowing-cup',
  'drawn-bowstring', 'spent-candle', 'frozen-knot', 'still-water'
);

-- diagnostic_completions.eden_constitution — same legacy values may exist
-- here from any path that bypassed record-diagnostic-completion's normalizer.
UPDATE public.diagnostic_completions
SET eden_constitution = CASE eden_constitution
  WHEN 'burning-bowstring' THEN 'the_burning_bowstring'
  WHEN 'open-flame'        THEN 'the_open_flame'
  WHEN 'pressure-cooker'   THEN 'the_pressure_cooker'
  WHEN 'overflowing-cup'   THEN 'the_overflowing_cup'
  WHEN 'drawn-bowstring'   THEN 'the_drawn_bowstring'
  WHEN 'spent-candle'      THEN 'the_spent_candle'
  WHEN 'frozen-knot'       THEN 'the_frozen_knot'
  WHEN 'still-water'       THEN 'the_still_water'
  ELSE eden_constitution
END
WHERE eden_constitution IN (
  'burning-bowstring', 'open-flame', 'pressure-cooker', 'overflowing-cup',
  'drawn-bowstring', 'spent-candle', 'frozen-knot', 'still-water'
);

-- Schema_migrations register-INSERT (per Lock #15 — Supabase as source of truth +
-- migration tracking memory). Bypassed RLS already by replica role.
INSERT INTO public.schema_migrations (version, statements, name)
VALUES (
  '20260502151500',
  ARRAY['-- canonicalize legacy constitution slugs to the_* snake_case form'],
  'v4_3_2_canonicalize_constitution_slugs'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
