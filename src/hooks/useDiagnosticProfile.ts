import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveEdenPattern, PATTERN_PROFILES } from "@/lib/edenPattern";
import {
  type DiagnosticProfile,
  parseAxisReadingsFromRaw,
} from "@/lib/diagnosticProfile";

/**
 * useDiagnosticProfile — the canonical Apothecary hook for reading the
 * active user's full layered diagnostic profile.
 *
 * v1 (this implementation) returns LAYER 1 only — Eden Pattern + axis
 * readings — derived from `profiles.constitution_type` (the column the
 * 12-question marketing quiz writes via record-quiz-completion). Layers
 * 2-4 (Galenic temperament, tissue state profile, vital force) are typed
 * but undefined.
 *
 * When the Root-tier deep diagnostic ships, this hook will additionally
 * read `profiles.galenic_temperament`, `profiles.tissue_state_profile`,
 * and `profiles.vital_force_reading`, populate Layers 2-4, and flip the
 * `source` field to "deep_diagnostic_40q" when those columns are present.
 * Consuming components (PatternMatchHero, ProfileLayer cards) read from
 * the same DiagnosticProfile shape and gracefully render whichever layers
 * are populated — no consumer refactor required.
 *
 * Anonymous callers and authenticated callers without a resolved Pattern
 * receive `null` — the consuming UI then surfaces the take-the-quiz
 * affordance rather than a wrong-but-confident badge.
 *
 * Cache duration matches `useEdenPattern` (30 min stale, 4 hr GC) — a
 * user's profile doesn't change between page loads in practice.
 */
export function useDiagnosticProfile(): {
  data: DiagnosticProfile | null;
  isLoading: boolean;
} {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["diagnostic_profile_v1", user?.id ?? "anon"],
    queryFn: async (): Promise<DiagnosticProfile | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("constitution_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return null;

      const raw =
        typeof (data as { constitution_type?: string | null } | null)
          ?.constitution_type === "string"
          ? ((data as { constitution_type?: string | null }).constitution_type ??
            null)
          : null;

      const pattern = resolveEdenPattern(raw);
      if (!pattern) return null;

      // Derive axis readings: prefer parsing the raw axis-label shape
      // (what the 12-q quiz writes); fall back to looking up the canonical
      // axes from PATTERN_PROFILES when raw is the Pattern-name shape.
      const axesFromRaw = parseAxisReadingsFromRaw(raw);
      const profile = PATTERN_PROFILES[pattern];
      const edenAxes = axesFromRaw ?? {
        temperature: profile.temperature,
        moisture: profile.moisture,
        tone: profile.tone,
      };

      return {
        edenPattern: pattern,
        edenAxes,
        // Layers 2-4 intentionally undefined in v1. Populated when the
        // Root-tier deep diagnostic ships and writes its columns.
        source: "marketing_quiz_12q",
      };
    },
    enabled: true,
    staleTime: 30 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
  };
}
