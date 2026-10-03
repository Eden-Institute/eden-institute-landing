import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HerbDirectoryRow } from "@/hooks/useHerbsDirectory";
import { useCurrentTier } from "@/hooks/useCurrentTier";
import { isSubscriberTier } from "@/lib/tiers";
import { findHerbByParam, herbParamOrFilter } from "@/lib/herbLinks";

/**
 * Data hooks for the one-herb page, /apothecary/:herbId (HerbMonograph).
 *
 * WHY NOT useHerbsDirectory. That hook reads every row of herbs_directory_v,
 * which is right for the directory and wrong for a page about one plant:
 * 2026-10-03 it was 1.39 MB raw / ~540 KB gzipped on the wire for 299 herbs,
 * fetched on a hard load of every herb page, almost all of it thrown away.
 * useHerbByParam asks the same view for the rows the URL can match (at most
 * two today) and resolves the herb with the same findHerbByParam the page
 * always used, so the herb it renders is the one it rendered before.
 *
 * Tier gating is unchanged: the view still decides which columns come back
 * for the caller, and the query key still carries the resolved tier so
 * signing in or upgrading refetches.
 *
 * A reader arriving from the directory already has the whole view in the
 * TanStack cache; the herb is taken from there and nothing is fetched.
 */

const STALE_TIME = 60 * 60 * 1000;
const GC_TIME = 4 * 60 * 60 * 1000;

export function useHerbByParam(param: string | undefined) {
  const queryClient = useQueryClient();
  const tierQuery = useCurrentTier();
  const tier = tierQuery.data;
  const isSubscriber = isSubscriberTier(tier);
  const directoryKey = ["herbs_directory_v", tier ?? "anon"];
  const needle = (param ?? "").toLowerCase();

  const herbQuery = useQuery<HerbDirectoryRow | null>({
    queryKey: ["herbs_directory_v", "herb", tier ?? "anon", needle],
    queryFn: async () => {
      // null = no herb could carry this param (anything but [a-z0-9-]), the
      // not-found state, without a round trip.
      const filter = herbParamOrFilter(param);
      if (!filter) return null;
      const { data, error } = await supabase
        .from("herbs_directory_v")
        .select("*")
        .or(filter)
        // Same order as the directory, so when two candidates both match,
        // findHerbByParam picks the row it picked from the full list.
        .order("common_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return findHerbByParam((data ?? []) as HerbDirectoryRow[], param) ?? null;
    },
    initialData: () => {
      const directory = queryClient.getQueryData<HerbDirectoryRow[]>(directoryKey);
      return directory ? findHerbByParam(directory, param) ?? null : undefined;
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(directoryKey)?.dataUpdatedAt,
    enabled: tierQuery.isSuccess,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  return {
    tier,
    isSubscriber,
    data: herbQuery.data ?? null,
    // isPending, not isLoading. useCurrentTier waits for auth (enabled:
    // !authLoading), and a query waiting on `enabled` is pending but not
    // fetching, so isLoading reads false. The page then rendered "Herb not
    // found" for a moment on a hard load: a short page with the footer in
    // view, shoved down when the herb arrived. Lighthouse caught that as a
    // ~0.15-0.30 layout shift on about a third of runs (2026-10-03). A tier
    // error still ends loading, so the page shows not-found as it did before
    // rather than a skeleton forever.
    isLoading: !tierQuery.isError && (tierQuery.isPending || herbQuery.isPending),
    isError: herbQuery.isError,
  };
}

export interface HerbName {
  herb_id: string;
  common_name: string | null;
}

/**
 * herb_id -> name for the "Recently viewed" strip: two columns for the few
 * ids this device has viewed, instead of the full directory. common_name is
 * readable at every tier, so the key does not carry the tier. The previous
 * map is kept while a new id set loads, so the strip does not blink out
 * between herbs.
 */
export function useHerbNames(herbIds: readonly string[]) {
  const queryClient = useQueryClient();
  const ids = [...new Set(herbIds)].sort();

  const query = useQuery<HerbName[]>({
    queryKey: ["herbs_directory_v", "names", ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("herbs_directory_v")
        .select("herb_id, common_name")
        .in("herb_id", ids);
      if (error) throw error;
      return ((data ?? []) as HerbName[]).filter((h) => !!h.herb_id);
    },
    initialData: () => {
      // Any cached copy of the full directory already has every name.
      // Directory entries only: ["herbs_directory_v", tier]. The longer keys
      // under the same prefix are this file's own one-herb and name queries.
      const cached = queryClient
        .getQueriesData<HerbDirectoryRow[]>({
          predicate: (q) => q.queryKey[0] === "herbs_directory_v" && q.queryKey.length === 2,
        })
        .map(([, rows]) => rows)
        .find((rows): rows is HerbDirectoryRow[] => Array.isArray(rows));
      if (!cached) return undefined;
      const wanted = new Set(ids);
      return cached
        .filter((h) => h.herb_id && wanted.has(h.herb_id))
        .map((h) => ({ herb_id: h.herb_id as string, common_name: h.common_name }));
    },
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  const byId = new Map<string, HerbName>();
  for (const h of query.data ?? []) byId.set(h.herb_id, h);
  return byId;
}
