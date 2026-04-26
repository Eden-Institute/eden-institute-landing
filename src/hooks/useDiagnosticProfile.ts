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
 * active context's full layered diagnostic profile (v3.14 Layer 1 reactive
 * refactor; Layer 2-4 wire-in deferred until the deep-diagnostic frontend
 * authoring ships per Manual §0.8 #37/#38).
 *
 * v2 (this implementation) returns LAYER 1 only — Eden Pattern + axis
 * readings — but resolves it from the per-profile picker context rather
 * than the user-level account row. Layers 2-4 remain typed-but-undefined
 * until galenicTemperament.ts / tissueStateProfile.ts / vitalForce.ts
 * content modules + the typed 40-q quiz ship; at that point the same
 * DiagnosticProfile shape gains populated Layer 2-4 fields with no
 * consumer refactor needed (per the original v1 design pledge).
 *
 * Resolution strategy (per v3.14 Session Log + Lock #40):
 *
 *   1. Anonymous → null synchronously.
 *
 *   2. Authenticated, picker NOT mounted OR no active profile selected:
 *      → read user-level legacy `profiles.constitution_type`. Source =
 *        "marketing_quiz_12q".
 *
 *   3. Authenticated, picker mounted, active profile is SELF:
 *      → prefer `person_profiles.eden_constitution` (canonical, written by
 *        the in-app Pattern of Eden quiz via record-diagnostic-completion).
 *        Fall back to `profiles.constitution_type` when canonical is NULL
 *        (legacy onboarding bridge for accounts that pre-date PR #18's
 *        sync trigger).
 *
 *   4. Authenticated, picker mounted, active profile is NON-SELF:
 *      → read ONLY `person_profiles.eden_constitution`. No fallback. NULL
 *        canonical returns null + isEmptyForActiveProfile=true so the
 *        consumer surfaces the take-the-quiz empty state per Lock #39.
 *
 * Cache duration matches `useEdenPattern` (30 min stale, 4 hr GC) — keyed
 * on user.id + active person_profile.id so a picker switch or quiz
 * completion re-fetches.
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
        // for this profile that has eden_constitution NOT NULL.
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

      // Case D: non-self + canonical NULL → empty state.
      return { profile: null, isEmptyForActiveProfile: true };
    },
    enabled: true,
    staleTime: 30 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: query.data?.profile ?? null,
    isLoading: query.isLoading,
    isEmptyForActiveProfile: query.data?.isEmptyForActiveProfile ?? false,
  };
}

function resolveLayer1(
  raw: string | null,
  source: DiagnosticSource,
  isEmptyForActiveProfile: boolean,
): { profile: DiagnosticProfile | null; isEmptyForActiveProfile: boolean } {
  const pattern = resolveEdenPattern(raw);
  if (!pattern) {
    return { profile: null, isEmptyForActiveProfile };
  }
  const axesFromRaw = parseAxisReadingsFromRaw(raw);
  const profile = PATTERN_PROFILES[pattern];
  const edenAxes = axesFromRaw ?? {
    temperature: profile.temperature,
    moisture: profile.moisture,
    tone: profile.tone,
  };
  return {
    profile: {
      edenPattern: pattern,
      edenAxes,
      // Layers 2-4 intentionally undefined in v2 — the typed 40-q quiz
      // and content modules ship those. Source threaded honestly per
      // Lock #38 (citation integrity).
      source,
    },
    isEmptyForActiveProfile: false,
  };
}

/**
 * Resolve the provenance of the canonical eden_constitution on a given
 * person_profile by reading the most recent diagnostic_completions row
 * for that profile that has eden_constitution NOT NULL, and mapping its
 * quiz_version through diagnosticSource.provenanceForQuizVersion.
 *
 * Falls back to "in_app_diagnostic_12q" when no completion row is found
 * (extremely rare since the canonical value exists, but defensive).
 */
async function resolveCanonicalProvenance(
  personProfileId: string,
): Promise<DiagnosticSource> {
  try {
    const { data, error } = await supabase
      .from("diagnostic_completions")
      .select("quiz_version")
      .eq("person_profile_id", personProfileId)
      .not("eden_constitution", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return "in_app_diagnostic_12q";
    const quizVersion = (data as { quiz_version?: string | null }).quiz_version;
    return provenanceForQuizVersion(quizVersion ?? null).source;
  } catch (_err) {
    return "in_app_diagnostic_12q";
  }
}

async function readUserLevelConstitution(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("constitution_type")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[useDiagnosticProfile] readUserLevelConstitution failed", error);
    return null;
  }
  const v = (data as { constitution_type?: string | null } | null)
    ?.constitution_type;
  return typeof v === "string" ? v : null;
}
