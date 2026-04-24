import { useCurrentTier, type Tier } from "@/hooks/useCurrentTier";
import { useHerbsPublic, type HerbPublicRow } from "@/hooks/useHerbsPublic";
import {
  useHerbsClinical,
  type HerbClinicalRow,
} from "@/hooks/useHerbsClinical";

export type HerbRow = HerbPublicRow | HerbClinicalRow;

export function isClinicalRow(row: HerbRow): row is HerbClinicalRow {
  // herbs_clinical_v carries `system_affinity` (and a dozen other clinical
  // columns) that herbs_public does not expose. The discriminator is a
  // structural field check rather than a runtime flag so TypeScript can
  // narrow the row shape inside consuming components.
  return "system_affinity" in row;
}

const SUBSCRIBER_TIERS: ReadonlyArray<Tier> = ["seed", "root", "practitioner"];

export function isSubscriberTier(tier: Tier | undefined): boolean {
  return tier !== undefined && SUBSCRIBER_TIERS.includes(tier);
}

/**
 * Single entry point for the herb-directory read surface. Branches the read
 * path on the caller's current tier:
 *
 *   - anon / free  →  `public.herbs_public`        (50 rows, basic monograph)
 *   - seed / root+ →  `public.herbs_clinical_v`    (100 rows, full overlay)
 *
 * Returns a discriminated union so the directory and card components can
 * render tier-appropriate sections without duplicating query logic. Per
 * §25.1 the tier gate is enforced at the DB layer; this hook is a
 * convenience over the two underlying queries, not a second gate.
 */
export function useApothecaryHerbs() {
  const tierQuery = useCurrentTier();
  const tier = tierQuery.data;
  const isSubscriber = isSubscriberTier(tier);

  const publicQuery = useHerbsPublic();
  const clinicalQuery = useHerbsClinical(isSubscriber);

  const active = isSubscriber ? clinicalQuery : publicQuery;

  return {
    tier,
    isSubscriber,
    data: (active.data ?? []) as HerbRow[],
    isLoading: tierQuery.isLoading || active.isLoading,
    isError: active.isError,
    error: active.error as Error | null,
  };
}
