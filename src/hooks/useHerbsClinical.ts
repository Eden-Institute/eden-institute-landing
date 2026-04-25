import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type HerbClinicalRow =
  Database["public"]["Views"]["herbs_clinical_v"]["Row"];

/**
 * Seed+ herb directory read path.
 *
 * Reads from `public.herbs_clinical_v` — the 47-column, 100-row view that
 * exposes the full clinical overlay (tissue states, organ systems, chief
 * complaints, Western constitutional matches,
 * drug interactions, preparations, dosage, citations) plus twelve jsonb
 * `_rel` columns carrying denormalized junction data for the eventual
 * detail-page render.
 *
 * The view is gated at the DB layer per Locked Decision §0.8 — callers
 * without a `seed`, `root`, or `practitioner` tier receive zero rows. UI
 * branching lives in `useApothecaryHerbs`; consumers of this hook should
 * assume the caller has already been qualified as Seed+.
 */
export function useHerbsClinical(enabled = true) {
  return useQuery<HerbClinicalRow[]>({
    queryKey: ["herbs_clinical_v"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("herbs_clinical_v")
        .select("*")
        .order("common_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });
}
