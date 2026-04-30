-- Tier-cap restructure v2 (2026-04-30)
--
-- Per Camila's confirmed Decision 1 (post-launch family-care strategy):
-- bump per-tier person_profiles caps from the launch baseline to the
-- v2 schedule that reflects the actual product positioning of each tier.
--
--   Tier            v1 cap   v2 cap   Δ
--   ─────────────── ──────── ──────── ────
--   anon            0        0        —
--   free            0        0        —
--   seed            1        5        +4
--   root            6        10       +4
--   practitioner    500      500      —
--
-- Lock context: supersedes Manual §0.8 #28-#34 / Lock #19 cap schedule.
-- Replace, don't extend, the existing schedule. The trigger
-- tg_person_profiles_enforce_cap calls this function on every INSERT,
-- so the change is immediately live for every Seed/Root signup going
-- forward AND for every existing Seed/Root user trying to add their
-- 2nd / 7th profile (formerly the cap-exceeded boundary).
--
-- Frontend mirror: src/pages/apothecary/ProfilesPage.tsx TIER_CAP
-- constant ships in lockstep with this migration. RequireTier on the
-- ProfilesPage route ungates from {root, practitioner} to {seed, root,
-- practitioner} so Seed users with their new 5-cap can actually reach
-- the management surface.
--
-- Idempotency: CREATE OR REPLACE FUNCTION is idempotent. Function
-- signature unchanged, so the BEFORE INSERT trigger keeps working
-- without rebinding.

CREATE OR REPLACE FUNCTION public.person_profile_cap_for_tier(tier text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE tier
    WHEN 'anon' THEN 0
    WHEN 'free' THEN 0
    WHEN 'seed' THEN 5
    WHEN 'root' THEN 10
    WHEN 'practitioner' THEN 500
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION public.person_profile_cap_for_tier(text) IS
  'Per-tier person_profiles cap. v2 schedule (2026-04-30): Free=0, Seed=5, Root=10, Practitioner=500. Replaces v1 (Seed=1, Root=6) per Camila Decision 1 post-launch positioning. Called by tg_person_profiles_enforce_cap BEFORE INSERT trigger.';
