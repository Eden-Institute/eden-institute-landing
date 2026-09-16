import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTier } from "@/hooks/useCurrentTier";
import type { HerbEnergeticsEvidence } from "@/lib/energeticsEvidence";

/**
 * useHerbEnergeticsEvidence — the pre-1900 sources behind each herb's
 * temperature and moisture, keyed by herb_id.
 *
 * Reads public.herb_energetics_evidence_v, which holds a row ONLY for the
 * herbs that have been through the source research (50 as of the 2026-09-15
 * batches). A herb with no row renders no evidence line at all: silence is the
 * honest state for a herb nobody has searched yet, and it must not be confused
 * with "no pre-1900 source found", which is a researched result and has its
 * own flag.
 *
 * TIER: the view is the gate, exactly as herbs_directory_v is. Free and anon
 * receive the agreement state, the founder's disagreement sentence, the
 * no-source flag and the basis line; `sources`, `checked_no_reading` and
 * `counted_readings` come back NULL below Root. The query key carries the
 * resolved tier so signing in or upgrading refetches instead of serving the
 * cached anon payload.
 */

export type EnergeticsEvidenceMap = ReadonlyMap<string, HerbEnergeticsEvidence>;

export function useHerbEnergeticsEvidence() {
  const tierQuery = useCurrentTier();
  const tier = tierQuery.data;

  const query = useQuery<HerbEnergeticsEvidence[]>({
    queryKey: ["herb_energetics_evidence_v", tier ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("herb_energetics_evidence_v")
        .select("*");

      // FAIL SAFE, DO NOT CONVERT THIS BACK TO `throw`.
      //
      // Deploy ordering: the view arrives in
      // 20260916190000_energetics_sources_batches_1_2.sql. If this code reaches
      // production before that migration runs, PostgREST answers 404 for the
      // relation and every herb page would break over a section that is merely
      // not there yet. Returning [] degrades to rendering no evidence line,
      // which is the same thing a reader sees for the 250 herbs that have not
      // been researched. The failure mode is "says nothing", never "says
      // something wrong" — the right way for an evidence surface to fail.
      if (error) {
        console.warn(
          "[useHerbEnergeticsEvidence] no energetics evidence available:",
          error.message,
        );
        return [];
      }
      return (data ?? []) as unknown as HerbEnergeticsEvidence[];
    },
    // No retries: the dominant failure is a missing relation or a permission
    // mismatch, which retrying cannot fix.
    retry: false,
    enabled: tierQuery.isSuccess,
    // Sources change on the order of migrations, not minutes.
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  const byHerbId = useMemo<EnergeticsEvidenceMap>(() => {
    const map = new Map<string, HerbEnergeticsEvidence>();
    for (const row of query.data ?? []) {
      if (row?.herb_id) map.set(row.herb_id, row);
    }
    return map;
  }, [query.data]);

  return {
    byHerbId,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
