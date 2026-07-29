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
