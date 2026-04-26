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
    enabled: true, // anon path returns null synchronously inside queryFn
    staleTime: 30 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: query.data?.pattern ?? null,
    rawValue: query.data?.raw ?? null,
    isLoading: query.isLoading,
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
  if (error) return null;
  const v = (data as { constitution_type?: string | null } | null)
    ?.constitution_type;
  return typeof v === "string" ? v : null;
}
