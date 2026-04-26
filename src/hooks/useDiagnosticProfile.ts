import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveEdenPattern, PATTERN_PROFILES } from "@/lib/edenPattern";
import {
  type DiagnosticProfile,
  type DiagnosticSource,
  parseAxisReadingsFromRaw,
} from "@/lib/diagnosticProfile";
import { provenanceForQuizVersion } from "@/lib/diagnosticSource";
import { useActiveProfileOptional } from "@/contexts/ActiveProfileContext";

/**
 * useDiagnosticProfile — the canonical Apothecary hook for reading the
 * active context's full layered diagnostic profile.
 *
 * v2 (this implementation) returns LAYER 1 only — Eden Pattern + axis
 * readings — but resolves it from the per-profile picker context rather
 * than the user-level account row. Layers 2-4 remain typed-but-undefined
 * until the deep-diagnostic content modules + 40-q quiz ship; at that point
 * the same DiagnosticProfile shape gains populated Layer 2-4 fields with no
 * consumer refactor needed.
 *
 * Per Lock #37 layer numbering:
 *   Layer 1 — Eden Pattern (PRIMARY, all authed tiers)
 *   Layer 2 — Galenic Temperament (Root)
 *   Layer 3 — Tissue State Profile by organ system (Root, junction-stored)
 *   Layer 4 — Vital Force Reading (Root)
 *
 * Resolution strategy:
 *
 *   1. Anonymous → null synchronously.
 *
 *   2. Authenticated, picker NOT mounted OR no active profile selected:
 *      → read user-level legacy `profiles.constitution_type`. Provenance
 *        is the legacy bridge fallback — Lock #38 honest labeling.
 *
 *   3. Authenticated, picker mounted, active profile is SELF:
 *      → prefer `person_profiles.eden_constitution` (canonical, written by
 *        the in-app diagnostic via record-diagnostic-completion). The
 *        provenance for this canonical read comes from the most-recent
 *        diagnostic_completions row (quiz_version → diagnosticSource).
 *      → fall back to `profiles.constitution_type` when canonical is NULL
 *        (legacy bridge for accounts that pre-date the v3.10 sync trigger).
 *        Provenance: marketing_quiz_12q_legacy_bridge.
 *
 *   4. Authenticated, picker mounted, active profile is NON-SELF:
 *      → read ONLY `person_profiles.eden_constitution`. No fallback. NULL
 *        canonical returns null + isEmptyForActiveProfile=true so the
 *        consumer surfaces the take-the-quiz empty state per Lock #39.
 *
 * Provenance threading (v3.16 audit-fix pass / Major #4): the `source`
 * field of the returned DiagnosticProfile is derived from the actual
 * diagnostic_completions row that established the canonical value, NOT
 * hardcoded. See src/lib/diagnosticSource.ts for the version → source
 * mapper. This makes Lock #38 (citation integrity) honestly enforceable
 * across the EF write surface and the read surface.
 */
export function useDiagnosticProfile(): {
  data: DiagnosticProfile | null;
  isLoading: boolean;
  isEmptyForActiveProfile: boolean;
} {
  const { user } = useAuth();
  const profileCtx = useActiveProfileOptional();
  const activeProfile = profileCtx?.activeProfile ?? null;

  const query = useQuery({
    queryKey: [
      "diagnostic_profile_v2",
      user?.id ?? "anon",
      activeProfile?.id ?? "no-active-profile",
    ],
    queryFn: async (): Promise<{
      profile: DiagnosticProfile | null;
      isEmptyForActiveProfile: boolean;
    }> => {
      if (!user) return { profile: null, isEmptyForActiveProfile: false };

      // Case A: no picker context → legacy user-level read (legacy bridge).
      if (!activeProfile) {
        const raw = await readUserLevelConstitution(user.id);
        return resolveLayer1(
          raw,
          /* provenance source */ "marketing_quiz_12q_legacy_bridge",
          /* isEmpty */ false,
        );
      }

      // Case B: picker mounted, active profile has a canonical Pattern.
      if (activeProfile.eden_constitution) {
        // Provenance derived from the most-recent diagnostic_completions row
        // for this profile that has eden_constitution NOT NULL. If the lookup
        // fails or returns no row (which would be unusual since the canonical
        // value exists), fall back to in_app_diagnostic_12q (the EF default
        // and the single most likely write path post-v3.16).
        const provenance = await resolveCanonicalProvenance(activeProfile.id);
        return resolveLayer1(
          activeProfile.eden_constitution,
          provenance,
          /* isEmpty */ false,
        );
      }

      // Case C: SELF + canonical NULL → legacy bridge fallback.
      if (activeProfile.is_self) {
        const legacy = await readUserLevelConstitution(user.id);
        const resolved = resolveLayer1(
          legacy,
          /* provenance source */ "marketing_quiz_12q_legacy_bridge",
          /* isEmpty */ false,
        );
        if (resolved.profile) return resolved;
        return { profile: null, isEmptyForActiveProfile: true };
      }

      // Case D: non-self + canonical NULL → empty state per Lock #39.
      return { profile: null, isEmptyForActiveProfile: true };
    },
    enabled: true,
    staleTime: 30 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: query.data?.profile ?? null,
    isLoading: query.isLoading,
    isEmptyForActiveProfile: query.data?.isEmpt