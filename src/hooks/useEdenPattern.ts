import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveEdenPattern, type EdenPatternName } from "@/lib/edenPattern";
import {
  useActiveProfileOptional,
  type PersonProfile,
} from "@/contexts/ActiveProfileContext";

/**
 * Stage 6.3.5 — useEdenPattern (v3.14 Layer 1 reactive refactor).
 *
 * Resolves the Pattern of Eden for the active context — either the active
 * person_profile when the picker is mounted, or the user-level profile
 * otherwise.
 *
 * Resolution strategy (per v3.14 Session Log + Lock #40 + the durable
 * finding from PR #24 smoke):
 *
 *   1. Anonymous callers → null synchronously.
 *
 *   2. Authenticated, picker NOT mounted (e.g. pre-apothecary surfaces) OR
 *      active profile not yet hydrated:
 *      → read `profiles.constitution_type` (legacy/marketing source).
 *
 *   3. Authenticated, picker mounted, active profile is SELF:
 *      → prefer `person_profiles.eden_constitution` (canonical, written
 *        by the in-app deeper diagnostic via record-diagnostic-completion);
 *      → fall back to `profiles.constitution_type` when canonical is
 *        NULL (legacy onboarding bridge for accounts that pre-date PR #18's
 *        sync trigger; see v3.14 durable architectural finding).
 *
 *   4. Authenticated, picker mounted, active profile is NON-SELF:
 *      → read ONLY `person_profiles.eden_constitution`. NO fallback to
 *        `profiles.constitution_type` — that column belongs to the account
 *        holder, not to the family member the picker is pointed at. Per
 *        Lock #39 (no silent defaults), a non-self profile with NULL
 *        canonical surfaces as the empty state, not as a wrong-but-confident
 *        Pattern. Consumers branch on `isEmptyForActiveProfile` to render
 *        the PatternQuizCTA.
 *
 * PR δ (2026-05-02) hydration race fix: when an ActiveProfileProvider is
 * mounted but its profile list is still loading, this hook now defers
 * resolution rather than short-circuiting through Case 2's user-level
 * read. The previous behavior produced Camila's reproducible "Olivia
 * reverts to Burning Bowstring on /" launch-blocker bug — during the
 * brief window before the provider hydrated, the homepage's
 * WelcomeBackBanner and JourneyCTA both rendered the signed-in user's
 * primary Pattern, even though the picker was pointed at a non-self
 * profile. The gate is implemented via TanStack Query's `enabled` flag
 * keyed on the context's isLoading; when no provider is mounted at all,
 * the gate defaults to enabled and Case 2's user-level read continues
 * to fire as before (backward-compat for legacy surfaces).
 *
 * Cache duration matches `useCurrentTier` (30 min stale, 4 hr GC) — a
 * Pattern doesn't change between page loads in practice; the hook
 * invalidates on the user.id and active person_profile id keys, so a
 * picker switch or quiz completion re-fetches.
 */
export function useEdenPattern(): {
  data: EdenPatternName | null;
  rawValue: string | null;
  isLoading: boolean;
  isEmptyForActiveProfile: boolean;
  activeProfile: PersonProfile | null;
} {
  const { user } = useAuth();
  const profileCtx = useActiveProfileOptional();
  const activeProfile = profileCtx?.activeProfile ?? null;
  // PR δ: gate the Pattern query on the context's hydration state. While
  // the profile list is loading, we don't yet know whether a non-self
  // profile will resolve as active — firing a user-level read in that
  // window risks rendering the WRONG Pattern for the visible UI. When
  // there's no provider at all (profileCtx === null) we default to
  // "ready" so Case 2 (user-level marketing read) continues to fire.
  const profileCtxLoading = profileCtx?.isLoading ?? false;

  const query = useQuery({
    queryKey: [
      "eden_pattern_v2",
      user?.id ?? "anon",
      activeProfile?.id ?? "no-active-profile",
    ],
    queryFn: async (): Promise<{
      pattern: EdenPatternName | null;
      raw: string | null;
      isEmptyForActiveProfile: boolean;
    }> => {
      if (!user) {
        return { pattern: null, raw: null, isEmptyForActiveProfile: false };
      }

      // Branch on picker context.
      // Case A: no active profile (picker not mounted, or user has 0 profiles)
      //   → user-level read.
      // Case B: active profile present → person_profiles read with SELF
      //   fallback to user-level when SELF + canonical is NULL.
      if (!activeProfile) {
        const raw = await readUserLevelConstitution(user.id);
        return {
          pattern: resolveEdenPattern(raw),
          raw,
          isEmptyForActiveProfile: false,
        };
      }

      const canonical = activeProfile.eden_constitution;
      const pattern = resolveEdenPattern(canonical);
      if (pattern) {
        return {
          pattern,
          raw: canonical,
          isEmptyForActiveProfile: false,
        };
      }

      if (activeProfile.is_self) {
        // SELF + canonical NULL → legacy bridge fallback.
        const legacy = await readUserLevelConstitution(user.id);
        const legacyPattern = resolveEdenPattern(legacy);
        return {
          pattern: legacyPattern,
          raw: legacy,
          isEmptyForActiveProfile: legacyPattern === null,
        };
      }

      // Non-self + canonical NULL → empty state. No fallback.
      return {
        pattern: null,
        raw: null,
        isEmptyForActiveProfile: true,
      };
    },
    // PR δ: hold the query in pending state until the active-profile
    // context finishes hydrating its profile list. This prevents the
    // brief wrong-Pattern flash that surfaced as Camila's launch-blocker.
    // When no provider is mounted (profileCtx === null → profileCtxLoading
    // === false), the gate is open and the legacy user-level read fires
    // immediately as before.
    enabled: !profileCtxLoading,
    staleTime: 30 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: query.data?.pattern ?? null,
    rawValue: query.data?.raw ?? null,
    // Surface either context-hydration loading OR query loading so
    // consumers (PatternQuizCTA, skeleton-rendering surfaces) can render
    // a single coherent loading state.
    isLoading: profileCtxLoading || query.isLoading,
    isEmptyForActiveProfile: query.data?.isEmptyForActiveProfile ?? false,
    activeProfile,
  };
}

async function readUserLevelConstitution(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("constitution_type")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[useEdenPattern] readUserLevelConstitution failed", error);
    return null;
  }
  const v = (data as { constitution_type?: string | null } | null)
    ?.constitution_type;
  return typeof v === "string" ? v : null;
}
