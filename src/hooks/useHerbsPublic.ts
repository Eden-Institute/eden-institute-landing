import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type HerbPublicRow = Database["public"]["Views"]["herbs_public"]["Row"];

/**
 * Anon / free-tier herb directory read path.
 *
 * Reads from `public.herbs_public` — the 20-column, 50-row view that exposes
 * tier_visibility='free' herbs to visitors without a Seed+ subscription. RLS
 * and the view filter enforce gating at the DB layer (Locked Decision §0.8 —
 * frontend never reads base tables; views are the only client-facing read
 * surface). No junction data is exposed in this view; that lives in
 * herbs_clinical_v (Stage 6.3, Seed+ tier).
 *
 * The herb ontology is effectively static content; staleTime is generous.
 */
export function useHerbsPublic() {
  return useQuery<HerbPublicRow[]>({
    queryKey: ["herbs_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("herbs_public")
        .select("*")
        .order("common_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });
}
