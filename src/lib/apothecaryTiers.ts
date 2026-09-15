/**
 * src/lib/apothecaryTiers.ts — single source of truth for the public
 * Apothecary tier-feature breakdown.
 *
 * Why this file exists
 * ────────────────────
 * Through 2026 the public-facing tier copy was duplicated across three
 * surfaces: Pricing.tsx (3-tier auth-aware subscribe flow with monthly↔
 * yearly toggle and Stripe lookup keys), Start.tsx (3-tier "Learn More"
 * cards with persona labels), and AppSection.tsx (homepage 3-tier
 * teaser with stale beta-tester pricing). None included Practitioner as
 * a comparable card; Practitioner only appeared as a deferral footnote.
 *
 * For the public Apothecary value page (/apothecary, ApothecaryWelcome.tsx)
 * we now surface all four tiers — Free, Seed, Root, Practitioner —
 * with prices, persona labels, taglines, and feature lists, so a
 * visitor can see what they get before tapping "Open Apothecary."
 *
 * This module is the canonical source for that public marketing copy.
 * It is intentionally NOT consumed by the auth-aware Pricing.tsx
 * subscribe flow (which keeps its own copy because it also wires the
 * monthly/yearly toggle and Stripe lookupKey) — the two surfaces have
 * different concerns, and conflating them would couple the marketing
 * tier ladder to the billing wiring.
 *
 * Source of truth
 * ───────────────
 * Camila lockdown 2026-05-03: existing inline Free/Seed/Root copy in
 * Start.tsx is canonically correct (matches Manual v4.1 §0.8). Two
 * additions: (1) a person-profile bullet on Seed (cap = 5) and Root
 * (cap = 10) since multi-profile is the killer feature distinguishing
 * paid tiers from Free; (2) a Practitioner card framed as
 * "clinical-grade" (NOT "premium"), launched 2026-07-09 at the
 * founding rate ($49.99/mo, reg. $59.99), locked for life.
 *
 * If this file is updated in the future, the corresponding Manual
 * section MUST be updated in lockstep — the landing page is the public
 * canonical surface.
 */

import { APOTHECARY_PRICES } from "@/lib/apothecaryPrices";
import { HERB_CATALOG_SIZE } from "@/lib/herbCatalog";

/**
 * What each tier can READ in a herb monograph. Mirrors the column gates in
 * public.herbs_directory_v (supabase/migrations/20260916100000_herb_tier_model.sql,
 * founder decision 2026-09-15). The public tier cards below, Start.tsx and
 * Pricing.tsx all build their depth bullets from these lists, so the tier
 * ladder cannot promise a field at one tier on one page and another tier on
 * the next. Change the view and these lists together.
 */
export const TIER_DEPTH = {
  free: [
    `All ${HERB_CATALOG_SIZE} herbs: identity, taste, temperature, moisture, and energetics`,
    "Cautions, contraindications, and pregnancy, nursing, and children's safety",
    "Biblical and traditional context with stewardship notes",
  ],
  seed: [
    "Actions and tissue states, indicated and contraindicated",
    "Body systems, chief complaints, and pattern matches: Western, Ayurvedic, TCM, and Pattern of Eden",
    "Preparation methods and dosage notes",
  ],
  root: [
    "Herb-drug interactions",
    "When to refer out, with the threshold for each herb",
    "Source citations: primary texts and secondary references",
  ],
} as const;

/** One-line tier taglines shared by the public tier cards and Start.tsx. */
export const TIER_TAGLINES = {
  free: "Identity, energetics, and safety for every herb.",
  seed: "Clinical depth: actions, tissue states, pattern matches, preparation, and dosage.",
  root: "Drug interactions, when to refer out, and sources.",
} as const;

export type PublicTier = "free" | "seed" | "root" | "practitioner";

export interface PublicTierSpec {
  /** Stable tier id; used for anchor ids (`tier-{id}`) and CTA wiring. */
  id: PublicTier;
  /** Capitalized display name. */
  displayName: string;
  /**
   * Persona / audience label — small all-caps eyebrow above the tier
   * name. Per Locked Decision §0.8 v3.3 #22, the tier IS the persona
   * ladder; using persona language reinforces that the choice is about
   * who you're stewarding, not which "plan" you're on.
   */
  persona: string;
  /** One-line tagline shown under the tier name. */
  tagline: string;
  /**
   * Public price string (e.g. "$7.99"). Practitioner shows its founding
   * monthly rate ("$49.99"); the launched-tier detail lives in
   * `availability`.
   */
  monthlyPrice: string | null;
  /**
   * Availability / cadence subtitle under the price. For Free this
   * reads "free for as long as you'd like"; for Seed/Root, "per month";
   * for Practitioner, the founding-rate line ("Open now · founding rate
   * $49.99/mo (reg. $59.99), locked for life").
   */
  availability: string;
  /**
   * Bullet list of features. Each bullet is one short sentence; longer
   * explanatory content (e.g. the multi-profile clarification on Seed
   * and Root) is intentionally allowed — see Start.tsx for length
   * precedent.
   */
  features: readonly string[];
}

export const PUBLIC_TIERS: readonly PublicTierSpec[] = [
  {
    id: "free",
    displayName: "Free",
    persona: "The home herbalist",
    tagline: TIER_TAGLINES.free,
    monthlyPrice: "$0",
    availability: "Available now · free for as long as you'd like",
    features: [
      ...TIER_DEPTH.free,
      "The Pattern of Eden quiz + your result",
      "The Five Tenets overview",
    ],
  },
  {
    id: "seed",
    displayName: "Seed",
    persona: "The serious student",
    tagline: TIER_TAGLINES.seed,
    monthlyPrice: APOTHECARY_PRICES.seed.monthly,
    availability: "Available now · per month",
    features: [
      "Everything in Free",
      ...TIER_DEPTH.seed,
      "Save your Pattern result and revisit it",
      "Create up to 5 person-profiles for yourself and family members. Each profile holds its own pattern; switching profiles surfaces matched herbs for that profile's pattern.",
    ],
  },
  {
    id: "root",
    displayName: "Root",
    persona: "The seasoned lay herbalist",
    tagline: TIER_TAGLINES.root,
    monthlyPrice: APOTHECARY_PRICES.root.monthly,
    availability: "Available now · per month",
    features: [
      "Everything in Seed",
      ...TIER_DEPTH.root,
      "Create up to 10 person-profiles for family plus a few friends or clients you want to help. Each profile holds its own pattern; switching profiles surfaces matched herbs for that profile's pattern. Built for the practicing herbalist supporting a circle wider than just family.",
    ],
  },
  {
    id: "practitioner",
    displayName: "Practitioner",
    persona: "The clinical herbalist",
    tagline: "See a patient, read their pattern, and hand them a safe, cited plan before they leave the room.",
    monthlyPrice: APOTHECARY_PRICES.practitioner.monthly,
    availability: `Open now · founding rate ${APOTHECARY_PRICES.practitioner.monthly}/mo (reg. ${APOTHECARY_PRICES.practitioner.standardMonthly}), locked for life`,
    features: [
      "Everything in Root",
      "One-screen clinical matching: the patient's pattern to a safety-screened herb list in seconds",
      "Red-flag screening runs first, so referral cases never become herb cases",
      "All four lenses on every herb: Pattern of Eden, Western, Ayurvedic, TCM, each claim backed by two named sources",
      "Encounters, SOAP notes, formulary builder with dosing, printable case files",
      "Up to 500 patient profiles for a full clinical caseload",
    ],
  },
] as const;
