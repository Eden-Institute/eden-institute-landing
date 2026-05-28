/**
 * src/lib/homeschool/data.ts — shared data for the /homeschool page (v1.5).
 *
 * Why this module exists
 * ──────────────────────
 * The /homeschool page is decomposed into 13 section components per
 * Eden_Table_Homeschool_Page_Implementation_Spec v1.5. Three categories of
 * data are shared across multiple sections:
 *
 *  • PRODUCTS — the 8 SKUs per band; rendered in §6 (Eight Products),
 *    §10 (À la Carte Table), and indirectly in §9 (the pricing centerpiece
 *    references the per-band SKU count and bundle savings vs à la carte).
 *  • BANDS — the 4-band K-12 roadmap; rendered in §8 (Four Bands ladder)
 *    and §1 (hero sub-detail mentions Cultivators 2027 / Practitioners 2028).
 *  • PRICING — bundle + à la carte + co-op tiers; lifted directly from
 *    Eden_Table_Pricing_Worksheet_v1_1.xlsx (Bundle Pricing tab,
 *    Individual Pricing tab, Co-op License tab). Margin-locked numbers.
 *
 * Section-specific prose (founder letter, weekly rhythm, FAQ, etc.) lives
 * inside the component that renders it — extracting it here would just add
 * indirection without any consumer overlap.
 *
 * Stripe checkout IDs intentionally left as TODO placeholders. The 26 live-
 * mode price IDs land in Phase 2 of the launch (POD Setup Timeline rows
 * 10-11). Until then, CTAs render with data-checkout-id attributes that
 * warn to console on click — discoverable + safe in production.
 */

export type HatName = "science" | "ela" | "math" | "theology" | "history" | "art";

/**
 * HAT_COLOR_MAP — maps each HAT to the CSS variable that backs its pill.
 * Science / ELA / Math reuse existing landing-page semantic tokens.
 * Theology + History got new tokens in this commit (src/index.css).
 * Art reuses the rust token (same family as Math in the spec's color logic).
 */
export const HAT_COLOR_MAP: Record<HatName, { label: string; cssVar: string }> = {
  science: { label: "Science Hat", cssVar: "--sage-border" },
  ela: { label: "ELA Hat", cssVar: "--honey" },
  math: { label: "Math Hat", cssVar: "--rust" },
  theology: { label: "Theology Hat", cssVar: "--hat-theology" },
  history: { label: "History Hat", cssVar: "--hat-history" },
  art: { label: "Art Hat", cssVar: "--rust" },
};

export type BandStatus = "available" | "waitlist";

export interface BandSpec {
  key: "sprouts" | "seedlings" | "cultivators" | "practitioners";
  name: string;
  grades: string;
  launch: string;
  status: BandStatus;
  description: string;
  /** Sub-line shown only on available bands. */
  contentLine?: string;
  ctaLabel: string;
  /** TODO: replace # with real Stripe checkout URL once Phase 2 SKUs are
   *  created (POD Setup Timeline row 10). The data-checkout-id attribute
   *  in the BandCard markup is what the placeholder click handler reads. */
  ctaHref: string;
  ctaCheckoutId: string;
}

export const BANDS: readonly BandSpec[] = [
  {
    key: "sprouts",
    name: "Sprouts",
    grades: "Grades K-2",
    launch: "Available August 1, 2026",
    status: "available",
    description:
      "Wonder, stories, simple plant identification. Kitchen labs and memory songs. Sensory first. Instant-prep recipes.",
    contentLine: "36 weeks · 15 herbs · 6 stories · 30 scripture readings",
    ctaLabel: "Reserve Sprouts Founders Edition →",
    ctaHref: "#",
    ctaCheckoutId: "sprouts_complete_founders",
  },
  {
    key: "seedlings",
    name: "Seedlings",
    grades: "Grades 3-5",
    launch: "Available August 1, 2026",
    status: "available",
    description:
      "Body systems basics. Slow medicines (oxymel, tincture, syrup). Scientific method introduced. Garden 50/50.",
    contentLine: "36 weeks · 15 herbs · 6 stories · 30 scripture readings",
    ctaLabel: "Reserve Seedlings Founders Edition →",
    ctaHref: "#",
    ctaCheckoutId: "seedlings_complete_founders",
  },
  {
    key: "cultivators",
    name: "Cultivators",
    grades: "Grades 6-8",
    launch: "Launching 2027",
    status: "waitlist",
    description:
      "Body pattern thinking. Terrain basics. Remedy + comparative analysis. Energetics introduced.",
    ctaLabel: "Join the Cultivators Waitlist →",
    ctaHref: "#",
    ctaCheckoutId: "cultivators_waitlist",
  },
  {
    key: "practitioners",
    name: "Practitioners",
    grades: "Grades 9-12",
    launch: "Launching 2028",
    status: "waitlist",
    description:
      "Clinical literacy. Materia medica depth. Formulation. Real-world application.",
    ctaLabel: "Join the Practitioners Waitlist →",
    ctaHref: "#",
    ctaCheckoutId: "practitioners_waitlist",
  },
] as const;

export interface ProductSpec {
  /** Two-to-three letter SKU code from the pricing worksheet. */
  code: "TG" | "NB" | "SB" | "GJ" | "FD" | "FC" | "RC" | "ATT";
  /** Display name shown on the product card heading. */
  name: string;
  /** Italic one-liner shown below the heading on each product card. */
  tagline: string;
  /** Bulleted physical specs (format, page count, vendor). */
  specs: readonly string[];
  /** Bulleted "what's inside" content. */
  inside: readonly string[];
  /** HAT subjects each product engages, per spec §6. */
  hats: readonly HatName[];
  /** Founders / Public à la carte prices from Pricing Worksheet v1.1. */
  foundersPrice: number;
  publicPrice: number;
  /** À la carte table label (matches the worksheet's display name). */
  alaCarteLabel: string;
}

export const PRODUCTS: readonly ProductSpec[] = [
  {
    code: "TG",
    name: "Teacher Guide",
    tagline:
      "Your parent guide. Scripted but never rigid. Open the page Monday, teach the lesson, close the book.",
    specs: [
      "8.5×11 spiral coil bound · ~220 pages full color",
      "6 pages per week (Week-at-a-Glance + 5 day pages) · 36 weeks",
      "Printed (POD via Lulu Direct) + bonus digital PDF",
    ],
    inside: [
      "Daily lesson script + Today's Word",
      "Discussion questions + Bear Moments",
      "Teaching progression + safety notes",
      "Today's threads (subject map)",
    ],
    hats: ["science", "theology", "ela", "history"],
    foundersPrice: 69,
    publicPrice: 99,
    alaCarteLabel: "Teacher Guide",
  },
  {
    code: "NB",
    name: "Student Notebook",
    tagline:
      "Your child's daily workbook. Hands-on by design. Draw the plant, write the chant, measure the recipe, taste the tea.",
    specs: [
      "8.5×11 spiral coil bound · ~180 pages full color",
      "5 pages per week · 36 weeks",
      "Printed (POD via Lulu Direct) + bonus digital PDF",
    ],
    inside: [
      "Draw boxes for plant ID",
      "Sentence starters for write-in prompts",
      "Wednesday Kitchen Lab measurement fields",
      "Friday review questions + scripture strips",
    ],
    hats: ["ela", "science", "math", "art"],
    foundersPrice: 59,
    publicPrice: 84,
    alaCarteLabel: "Student Notebook",
  },
  {
    code: "SB",
    name: "Storybook",
    tagline:
      "Six original stories per band. Your children meet Gracie, Bear, and Vovó on Story Mondays.",
    specs: [
      "8.5×11 perfect bound · ~48 pages full color",
      "6 chapters",
      "Printed (POD via Lulu Direct) + bonus digital PDF",
    ],
    inside: [
      "Six stories featuring the Eden family",
      "Vovó's wisdom passages + Bear's plant adventures",
      "Original illustrations",
      "Discussion-ready pacing",
    ],
    hats: ["ela", "theology"],
    foundersPrice: 24,
    publicPrice: 34,
    alaCarteLabel: "Storybook",
  },
  {
    code: "GJ",
    name: "Garden Journal",
    tagline:
      "For every plant your child meets, a place to write what they observed. The journal that grows with the curriculum.",
    specs: [
      "8.5×11 spiral coil bound · ~80 pages B&W fillable",
      "Printed (POD via Lulu Direct) + bonus digital PDF",
    ],
    inside: [
      "Per-week fillable headers (band / week / day / activity)",
      "Observation pages + garden plot diagrams",
      "Harvest log",
      "Year-end reflection",
    ],
    hats: ["science", "ela"],
    foundersPrice: 27,
    publicPrice: 39,
    alaCarteLabel: "Garden Journal",
  },
  {
    code: "FD",
    name: "Family Devotional",
    tagline:
      "Thirty scripture readings per band, mapped to the Monday rhythm. Read at breakfast. Discuss at dinner.",
    specs: [
      "5.5×8.5 perfect bound · ~72 pages full color",
      "30 readings · NASB",
      "Printed (POD via Lulu Direct) + bonus digital PDF",
    ],
    inside: [
      "One reading per scripture-anchored Monday",
      "Reflection prompts",
      "Family discussion questions",
      "Memory verses",
    ],
    hats: ["theology", "ela"],
    foundersPrice: 17,
    publicPrice: 24,
    alaCarteLabel: "Family Devotional",
  },
  {
    code: "FC",
    name: "Herb Field Cards",
    tagline:
      "Botanical identification cards. One per herb. Build your child's materia medica deck over the year.",
    specs: [
      "15 cards 4×6 portrait · full color, laminated",
      "In a tuck box",
      "Printed (POD via The Game Crafter)",
    ],
    inside: [
      "Köhler-style botanical illustration + Latin name pair",
      "Identification features + properties",
      "Preparation methods (band-appropriate)",
      "Safety notes",
    ],
    hats: ["science", "art"],
    foundersPrice: 24,
    publicPrice: 34,
    alaCarteLabel: "Herb Field Cards (set of 15)",
  },
  {
    code: "RC",
    name: "Recipe Cards",
    tagline:
      "Signature preparation cards. Display-worthy. Built to live on your kitchen counter.",
    specs: [
      "15 cards 4×6 landscape · full color, matte laminated",
      "In a tuck box",
      "Printed (POD via The Game Crafter)",
    ],
    inside: [
      "One signature preparation per herb",
      "Ingredient list + numbered method",
      "Vovó's tip + scripture",
      "Chant reference",
    ],
    hats: ["science", "math", "theology"],
    foundersPrice: 24,
    publicPrice: 34,
    alaCarteLabel: "Recipe Cards (set of 15)",
  },
  {
    code: "ATT",
    name: "Around the Table Cards",
    tagline:
      "Family conversation deck. Four categories: Body, Faith, Family, Wonder. No rules, no score, no winner.",
    specs: [
      "144 cards 2.5×3.5 (poker size) · 310gsm playing card stock",
      "Rigid box with 4 category dividers",
      "Printed (POD via The Game Crafter)",
    ],
    inside: [
      "36 cards per category (Body Green / Faith Elderberry / Family Gold / Wonder Garden Earth)",
      "Conversation prompts",
      "Vovó's closing phrases",
      "Imagination prompts",
    ],
    hats: ["theology", "ela"],
    foundersPrice: 44,
    publicPrice: 64,
    alaCarteLabel: "Around the Table (144-card deck)",
  },
] as const;

/**
 * PRICING — locked numbers from Eden_Table_Pricing_Worksheet_v1_1.xlsx,
 * tabs "Bundle Pricing" + "Co-op License". 20% gross margin floor on bundles,
 * confirmed in the Pricing Execution Plan v1.0 §3.2 + §3.3.
 *
 * The à la carte total at Founders ($288) drives the "saves $39 vs bundle"
 * footnote under the à la carte table in §10. Don't drift these without
 * updating the worksheet first.
 */
export const PRICING = {
  bundles: {
    sprouts: { founders: 249, public: 397, sku: "sprouts_complete_founders" },
    seedlings: { founders: 249, public: 397, sku: "seedlings_complete_founders" },
    twoBand: { founders: 479, public: 747, sku: "two_band_family_founders" },
  },
  motherFamilyCombo: {
    founders: 329,
    public: 547,
    sku: "mother_family_combo_founders",
  },
  alaCarteTotalFounders: 288,
  shippingFreeThreshold: 149,
  shippingFlatBelowThreshold: 9.99,
  coop: [
    { tierLabel: "5-family", families: "up to 5", founders: 397, public: 597, sku: "coop_5_family_founders" },
    { tierLabel: "10-family", families: "up to 10", founders: 697, public: 997, sku: "coop_10_family_founders" },
    { tierLabel: "20-family", families: "up to 20", founders: 1297, public: 1797, sku: "coop_20_family_founders" },
  ],
  /** Foundations Course (Eden Institute Tier 1) for the Parent Track + Mother+Family combo. */
  foundationsCourse: { founders: 97, public: 197 },
} as const;
