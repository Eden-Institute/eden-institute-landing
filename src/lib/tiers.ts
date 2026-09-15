/**
 * Tier predicates, deliberately kept in a module with NO runtime imports.
 *
 * `isSubscriberTier` used to live in `@/hooks/useHerbsDirectory`, which imports
 * the Supabase client. That client calls `createClient()` at module top level,
 * so anything importing this two-line predicate also constructed a network
 * client at import time. On CI there is no `.env` (it is gitignored), so
 * `VITE_SUPABASE_URL` was undefined and supabase-js threw "supabaseUrl is
 * required" while merely COLLECTING `src/test/herbDirectoryFilters.test.ts`.
 * Its 7 tests never ran, and the whole suite went red on every run.
 *
 * The `Tier` import below is type-only, so it is erased at compile time and
 * this module stays free of runtime dependencies. Keep it that way: anything
 * imported here is imported by every consumer of the predicate, including
 * tests that have no business talking to Supabase.
 */
import type { Tier } from "@/hooks/useCurrentTier";

const SUBSCRIBER_TIERS: ReadonlyArray<Tier> = ["seed", "root", "practitioner"];

export function isSubscriberTier(tier: Tier | undefined): boolean {
  return tier !== undefined && SUBSCRIBER_TIERS.includes(tier);
}

const ROOT_TIERS: ReadonlyArray<Tier> = ["root", "practitioner"];

/**
 * Root or above. Root is where herb-drug interactions, refer-out thresholds
 * and source citations open (herbs_directory_v gates those columns with
 * current_user_at_least('root'); see
 * supabase/migrations/20260916100000_herb_tier_model.sql). UI gating only;
 * the view is the real gate.
 */
export function isRootOrAboveTier(tier: Tier | undefined): boolean {
  return tier !== undefined && ROOT_TIERS.includes(tier);
}

/**
 * Per-tier person_profiles cap. UX gating ONLY (disabled 'Add profile',
 * 'X of Y profiles used' readouts, the picker's cap label). The backend
 * source of truth is public.person_profile_cap_for_tier(text), enforced by
 * the BEFORE INSERT trigger tg_person_profiles_enforce_cap; see
 * supabase/migrations/20260430140000_tier_cap_restructure_v2.sql. When that
 * function changes, change this table in the same PR (src/test/tiers.test.ts
 * fails if they drift).
 *
 * Free is 0, so Free users never see the profile picker (nothing to switch
 * between). Practitioner is included for forward-compat with its tier gate.
 */
export const PERSON_PROFILE_CAP_BY_TIER: Readonly<Record<Tier, number>> = {
  anon: 0,
  free: 0,
  seed: 5,
  root: 10,
  practitioner: 500,
};

export function personProfileCap(tier: Tier | undefined): number {
  return tier ? PERSON_PROFILE_CAP_BY_TIER[tier] ?? 0 : 0;
}
