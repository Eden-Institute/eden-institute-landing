/**
 * Display prices and Stripe lookup keys for the Eden Apothecary tiers.
 *
 * Runtime-import-free on purpose (like src/lib/tiers.ts), so the Pricing and
 * Start pages, the tier marketing copy, the monograph/results upsells and the
 * Astro results page can all read the same strings.
 *
 * Values copied verbatim from src/pages/apothecary/Pricing.tsx on 2026-09-14.
 * These are DISPLAY strings only: create-checkout charges whatever Stripe
 * resolves the lookup_key to (supabase/functions/create-checkout/index.ts,
 * "Resolve the Stripe price"), and nothing reconciles the two. A price change
 * must be made in Stripe AND here.
 */
export const APOTHECARY_PRICES = {
  seed: {
    monthly: "$7.99",
    yearly: "$79.99",
    monthlyLookupKey: "seed_monthly",
    yearlyLookupKey: "seed_yearly",
  },
  root: {
    monthly: "$24.99",
    yearly: "$249.99",
    monthlyLookupKey: "root_monthly",
    yearlyLookupKey: "root_yearly",
  },
  practitioner: {
    monthly: "$49.99",
    yearly: "$499",
    standardMonthly: "$59.99",
    standardYearly: "$599",
    monthlyLookupKey: "practitioner_solo_monthly",
    yearlyLookupKey: "practitioner_solo_yearly",
  },
} as const;
