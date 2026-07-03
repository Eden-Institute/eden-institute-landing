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
 * paid tiers from Free; (2) a new Practitioner card framed as
 * "clinical-grade" (NOT "premium"), with no public price — waitlist
 * only until end of 2027.
 *
 * Practitioner copy here is provisional; Camila has the final word on
 * Practitioner public copy and may redirect after seeing it rendered.
 *
 * If this file is updated in the future, the corresponding Manual
 * section MUST be updated in lockstep — the landing page is the public
 * canonical surface.
 */

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
   * Public price string (e.g. "$7.99"). Practitioner returns null —
   * waitlist-gated until end of 2027 per founder direction; no public
   * price is committed to.
   */
  monthlyPrice: string | null;
  /**
   * Availability / cadence subtitle under the price. For Free this
   * reads "free for as long as you'd like"; for Seed/Root, "per month";
   * for Practitioner, "Waitlist now · opens end of 2027".
   */
  availability: string;
  /**
   * Bullet list of features. Each bullet is one short sentence; longer
   * explanatory content (e.g. the multi-profile clarification on Seed
   * and Root) is intentionally allowed — see Start.tsx for length
   * precedent.
   */
  features: readonly string[];
  /**
   * True for waitlist-gated tiers. The TierCard renders a waitlist CTA
   * (modal trigger) instead of a checkout / signup link. Today only
   * Practitioner uses this branch.
   */
  waitlist?: boolean;
}

export const PUBLIC_TIERS: readonly PublicTierSpec[] = [
  {
    id: "free",
    displayName: "Free",
    persona: "The home herbalist",
    tagline: "Identity, energetics, and population safety for every herb.",
    monthlyPrice: "$0",
    availability: "Available now · free for as long as you'd like",
    features: [
      "All 100 herb monographs (basic profile)",
      "The Pattern of Eden quiz + your result",
      "The Five Tenets overview",
      "Pregnancy, lactation, and absolute cautions",
    ],
  },
  {
    id: "seed",
    displayName: "Seed",
    persona: "The serious student",
    tagline:
      "Clinical depth — actions, tissue states, constitutional matches.",
    monthlyPrice: "$7.99",
    availability: "Available now · per month",
    features: [
      "Unlock the clinical body of every monograph",
      "Tissue state indications and energetic actions",
      "Western, Ayurvedic, and TCM constitutional overlays plus Pattern of Eden",
      "Save your constitutional result and revisit it",
      "Create up to 5 person-profiles for yourself and family members. Each profile holds its own pattern; switching profiles surfaces matched herbs for that profile's pattern.",
    ],
  },
  {
    id: "root",
    displayName: "Root",
    persona: "The seasoned lay herbalist",
    tagline: "Drug interactions, refer thresholds, sources.",
    monthlyPrice: "$24.99",
    availability: "Available now · per month",
    features: [
      "Everything in Seed",
      "Herb-drug interaction surfaces",
      "Refer-out thresholds with mechanism rationale",
      "Source citations and classical materia medica links",
      "Create up to 10 person-profiles for family plus a few friends or clients you want to help. Each profile holds its own pattern; switching profiles surfaces matched herbs for that profile's pattern. Built for the practicing herbalist supporting a circle wider than just family.",
    ],
  },
  {
    id: "practitioner",
    displayName: "Practitioner",
    persona: "The clinical herbalist",
    tagline: "Clinical-grade workflow for the practicing clinician.",
    monthlyPrice: null,
    availability: "Waitlist now · opens end of 2027",
    waitlist: true,
    features: [
      "Everything in Root",
      "Clinical formulary builder",
      "Multi-system terrain analysis",
      "Session notes and exportable PDFs",
      "Recipe prescriptions, dosing guidance, and blends",
      "Up to 500 person-profiles for full clinical caseload",
      "Founding pricing announced to the waitlist first",
    ],
  },
] as const;
