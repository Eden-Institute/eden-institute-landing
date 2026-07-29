import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useCurrentTier } from "@/hooks/useCurrentTier";
import { isSubscriberTier } from "@/lib/tiers";

/**
 * Row shape returned by `public.herbs_directory_v` — Stage 6.3.6 unified
 * directory view. Every herb row is always returned (300 as of the herb-DB
 * expansion); tier-conditional column population
 * (visible-but-gated). Anon/free see identity + body for free rows,
 * identity-only for seed rows (is_locked = true). Seed+ see full content
 * across all rows.
 *
 * Per Locked Decision §0.8 #17, this view supersedes the Stage 6.3
 * dual-query (herbs_public + herbs_clinical_v) read pattern.
 */
export type HerbDirectoryRow =
  Database["public"]["Views"]["herbs_directory_v"]["Row"];

// Moved to `@/lib/tiers` so that importing this predicate no longer drags in
// the Supabase client (which this module imports, and which constructs itself
// at import time). Imported as well as re-exported: `export { x } from "..."`
// alone creates no local binding, and useHerbsDirectory() below calls it.
export { isSubscriberTier };

/**
 * Single entry point for the herb-directory read surface.
 *
 * The view itself enforces tier gating server-side via
 * `current_user_at_least('seed')`, so the hook does not branch on tier.
 * The TanStack Query `queryKey` does include the resolved tier, however,
 * so that re-rendering after sign-in / tier change refetches the view and
 * the caller sees clinical content unlock without a hard reload.
 *
 * Per Locked Decision §25.1 the tier gate is enforced at the DB layer;
 * this hook is a thin TanStack Query wrapper, not a second gate.
 */
export function useHerbsDirectory() {
  const tierQuery = useCurrentTier();
  const tier = tierQuery.data;
  const isSubscriber = isSubscriberTier(tier);

  const directoryQuery = useQuery<HerbDirectoryRow[]>({
    // Cache key includes resolved tier so signing in / upgrading triggers
    // a refetch — the view returns different columns based on the caller's
    // JWT, so cached anon data must not be served to a freshly-authed user.
    queryKey: ["herbs_directory_v", tier ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("herbs_directory_v")
        .select("*")
        .order("common_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: tierQuery.isSuccess,
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  return {
    tier,
    isSubscriber,
    data: (directoryQuery.data ?? []) as HerbDirectoryRow[],
    isLoading: tierQuery.isLoading || directoryQuery.isLoading,
    isError: directoryQuery.isError,
    error: directoryQuery.error as Error | null,
  };
}
