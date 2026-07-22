import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EdenPatternName } from "@/lib/edenPattern";
import type { CuratedHerbPatternRow } from "@/lib/herbVerdict";

/**
 * useCuratedHerbVerdicts — loads the CURATED herb↔pattern verdicts for one
 * body pattern, keyed by herb_id for O(1) lookup while rendering a directory.
 *
 * WHY THIS HOOK EXISTS
 * public.herbs_eden_patterns has held the clinically-reviewed verdicts since
 * July 2026 (80 founder-canon pairings plus a 42-row clinical review, each
 * carrying dual citations per Lock #43) — and no client code ever read it. The
 * Apothecary recomputed every verdict in the browser instead, which is how a
 * Spent Candle reader ended up seeing a red AVOID banner on ginger and nettle,
 * the two herbs their own paid guide recommends most emphatically.
 *
 * ── THE FILTER THAT MATTERS ─────────────────────────────────────────────
 * `.eq("derivation", "curated")` is load-bearing and must not be removed.
 *
 * This table is NOT curated-only. As of 2026-07-21 it holds 2,292 SURFACED
 * rows with derivation='computed_energetics' — including 922 surfaced "avoid"
 * verdicts — written by a SQL mirror of the very equal-vote algorithm this
 * work exists to stop trusting (see 20260709170000_herbs_eden_patterns_bridge
 * .sql, which states it "mirror[s] src/lib/edenPattern.ts exactly"). Only 108
 * rows are genuinely curated.
 *
 * Those computed rows carry citations — that is how they satisfied the
 * surfacing constraint — so they look authoritative. Dropping this filter
 * would surface 922 machine-generated red flags with sources attached: the
 * original defect, laundered into looking evidence-backed. resolveHerbVerdict
 * independently re-checks `derivation` for defence in depth, but the filter
 * also keeps the payload small (108 rows, not 2,292).
 *
 * TIER: herbs_eden_patterns is RLS-gated (policy herbs_eden_patterns_seed_read).
 * Readers below that tier get an empty map and fall back to the computed path
 * — which, per resolveHerbVerdict, can never render a red "avoid". So a free
 * reader sees fewer curated verdicts, never a wrong one.
 */

export type CuratedVerdictMap = ReadonlyMap<string, CuratedHerbPatternRow>;

interface BridgeRow extends CuratedHerbPatternRow {
  herb_id: string;
}

export function useCuratedHerbVerdicts(
  patternName: EdenPatternName | null | undefined,
) {
  const query = useQuery<BridgeRow[]>({
    queryKey: ["herbs_eden_patterns", "curated", patternName ?? "none"],
    queryFn: async () => {
      if (!patternName) return [];
      // Filter on eden_patterns.name, which holds the canonical DISPLAY name
      // ("The Spent Candle") — exactly what useEdenPattern already resolves to.
      // The same pattern exists in six representations across this codebase
      // with ~11 conversion sites; matching on the form the caller already
      // holds means this hook adds no twelfth conversion to drift out of sync.
      const { data, error } = await supabase
        .from("herbs_eden_patterns")
        .select(
          "herb_id, relationship, derivation, rationale, benefit_note, condition_note, primary_citation, secondary_citation, eden_patterns!inner(name)",
        )
        .eq("derivation", "curated") // ← load-bearing; see the note above
        .eq("surfaced", true)
        .eq("eden_patterns.name", patternName);

      // FAIL SAFE, DO NOT CONVERT THIS BACK TO `throw`.
      //
      // Deploy ordering: benefit_note and condition_note arrive in
      // 20260721140000_herb_pattern_evidence_pass.sql. If this code reaches
      // production before that migration runs, PostgREST answers 400
      // ("column herbs_eden_patterns.benefit_note does not exist") — verified
      // against production on 2026-07-21. Throwing would surface a broken
      // directory to every reader over a column that is merely not there yet.
      //
      // Returning [] degrades to the computed path instead, which per
      // resolveHerbVerdict can never render a red "avoid". The failure mode is
      // "fewer curated verdicts", never "a wrong warning" — the right way for
      // a clinical surface to fail. The same guard covers a lapsed RLS grant
      // or a transient network fault.
      if (error) {
        console.warn(
          "[useCuratedHerbVerdicts] falling back to computed verdicts:",
          error.message,
        );
        return [];
      }
      return (data ?? []) as unknown as BridgeRow[];
    },
    // No retries: the dominant failure here is a schema/permission mismatch,
    // which retrying cannot fix and which would just delay the fallback.
    retry: false,
    enabled: Boolean(patternName),
    // Curated clinical data changes on the order of migrations, not minutes.
    staleTime: 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });

  const byHerbId = useMemo<CuratedVerdictMap>(() => {
    const map = new Map<string, CuratedHerbPatternRow>();
    for (const row of query.data ?? []) {
      if (row.herb_id) map.set(row.herb_id, row);
    }
    return map;
  }, [query.data]);

  return {
    byHerbId,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
