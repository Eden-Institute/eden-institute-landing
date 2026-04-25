/**
 * Stage 6.3.6 — back-compat shim over `useHerbsDirectory`.
 *
 * The Stage 6.3 dual-query composite (useHerbsPublic + useHerbsClinical
 * branched on tier) has been collapsed into a single view, herbs_directory_v,
 * which returns 100 rows always with tier-conditional column population.
 * This module re-exports the unified hook and types under the legacy names
 * so existing call sites (HerbCard, HerbDirectoryFilters, ApothecaryHome)
 * keep working without a churn-y rename.
 *
 * New code should import from `@/hooks/useHerbsDirectory` directly.
 */
export {
  useHerbsDirectory as useApothecaryHerbs,
  isSubscriberTier,
  type HerbDirectoryRow as HerbRow,
} from "@/hooks/useHerbsDirectory";
