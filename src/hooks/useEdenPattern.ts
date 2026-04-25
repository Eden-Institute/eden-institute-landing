import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveEdenPattern, type EdenPatternName } from "@/lib/edenPattern";

/**
 * Stage 6.3.5 — useEdenPattern.
 *
 * Reads the active user's `profiles.constitution_type` and resolves it to a
 * canonical EdenPatternName via `resolveEdenPattern`. Anonymous callers
 * resolve to `null` immediately (no query). Authenticated callers run a
 * single SELECT against `public.profiles` for their own row (RLS enforces
 * own-row visibility).
 *
 * The constitution_type column may legitimately hold legacy values that
 * aren't current Eden Pattern names. Per worldview lock §0.8, only Western
 * classical frameworks are surfaced. `resolveEdenPattern` returns null for
 * unrecognized values — the directory then offers the take-the-quiz
 * affordance instead of surfacing a wrong-but-confident badge.
 *
 * Cache duration matches `useCurrentTier` (30 min stale, 4 hr GC) — a user's
 * Pattern doesn't change between page loads in practice; we refetch on
 * window focus only when the cache expires.
 */
export function useEdenPattern(): {
  data: EdenPatternName | null;
  rawValue: string | null;
  isLoading: boolean;
} {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["profiles_constitution_type", user?.id ?? "anon"],
    queryFn: async (): Promise<{
      pattern: EdenPatternName | null;
      raw: string | null;
    }> => {
      if (!user) return { pattern: null, raw: null };
      const { data, error } = await supabase
        .from("profiles")
        .select("constitution_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        // Surface read errors as no-pattern; this is a soft-failure surface
        // (UI degrades to no-badge state) rather than a launch-blocking one.
        return { pattern: null, raw: null };
      }
      const raw =
        typeof (data as { constitution_type?: string | null } | null)
          ?.constitution_type === "string"
          ? ((data as { constitution_type?: string | null }).constitution_type ??
            null)
          : null;
      return { pattern: resolveEdenPattern(raw), raw };
    },
    enabled: true, // anon path returns null synchronously inside queryFn
    staleTime: 30 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    data: query.data?.pattern ?? null,
    rawValue: query.data?.raw ?? null,
    isLoading: query.isLoading,
  };
}
