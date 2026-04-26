/**
 * src/lib/contentEntry.ts
 *
 * Canonical content-entry shape for Phase B clinical content modules.
 *
 * Per Locked Decision §0.8 #43 (dual-source clinical citation), every
 * clinical claim surfaced in Eden Apothecary content cites BOTH:
 *   (a) a public-domain primary-text source per Lock #38
 *       (Hippocratic Corpus; Galen, De Temperamentis; Cook 1869;
 *        Scudder 1870; King's American Dispensatory 1898;
 *        Felter, Eclectic Materia Medica 1922; Thomson 1822;
 *        pre-1928 English translations only), AND
 *   (b) an industry best-practice secondary cross-reference
 *       (peer-reviewed pharmacology/clinical literature on PubMed;
 *        WHO Monographs on Selected Medicinal Plants;
 *        ESCOP monographs; NIH/NCCIH; USDA; university extension
 *        services; AHG, NIMH, AHPA Botanical Safety Handbook standards).
 *
 * Per Locked Decision §0.8 #44 (classical-tradition observation IN,
 * theological attribution OUT), entries may carry structured
 * cross-tradition observations from any classical medicine system
 * (Western Eclectic / Physiomedical / Vitalist; TCM; Ayurveda; Unani;
 * Tibetan; etc.) where the description represents empirical pattern
 * observation. Spiritual attribution of vital-force origin
 * (karma; planetary deities; qi-as-cosmic-divine; prana-as-Brahman;
 * the Tao as ground of being) is excluded — the Holy Spirit is named
 * as the source of vital force per Lock #14, surfaced through
 * src/components/landing/WorldviewBand.tsx.
 *
 * Per Locked Decision §0.8 #45 (clinical authority boundary), authoring
 * of these entries proceeds against the Lock #43 dual-source standard
 * without per-claim founder review. The dual-source rigor IS the gate.
 *
 * This module is type-only. It is consumed by every Phase B content
 * module: vitalForce.ts, galenicTemperament.ts, tissueStateProfile.ts,
 * tcmConstitution.ts, ayurvedicDosha.ts (and unaniMizaj.ts if scope
 * holds in v2 of the plan). Each downstream module exports a
 * Record<slug, ContentEntry> registry plus a typed getter.
 *
 * Plan reference: Phase_B_Authoring_Plan_v1.md at workspace root.
 */

/* ----------------------------- Citations ------------------------------ */

/**
 * Per Lock #43, the secondary (industry best-practice) citation must be
 * categorized so the UI can render an appropriate provenance label.
 *
 *   - "pubmed"               peer-reviewed article on PubMed / PMC.
 *   - "who_monograph"        WHO Monographs on Selected Medicinal Plants.
 *   - "escop"                ESCOP monograph.
 *   - "nih"                  NIH / NCCIH / NCBI Bookshelf publication.
 *   - "usda"                 USDA / FDA monograph or extension document.
 *   - "university_extension" university extension service publication.
 *   - "ahg_standard"         American Herbalists Guild standard.
 *   - "nimh_standard"        National Institute of Medical Herbalists standard.
 *   - "ahpa_safety"          AHPA Botanical Safety Handbook entry.
 *   - "industry_textbook"    widely-adopted industry standard textbook
 *                            (Mills & Bone Principles and Practice of
 *                            Phytotherapy; Hoffmann Medical Herbalism;
 *                            Bensky & Gamble Materia Medica; etc.).
 */
export type SecondaryCitationKind =
  | "pubmed"
  | "who_monograph"
  | "escop"
  | "nih"
  | "usda"
  | "university_extension"
  | "ahg_standard"
  | "nimh_standard"
  | "ahpa_safety"
  | "industry_textbook";

/**
 * Public-domain primary-text citation per Lock #38. Only pre-1928 English
 * translations qualify; primary texts in their original language qualify
 * regardless of date when the text itself predates 1928.
 */
export interface PrimaryTextCitation {
  /** Author of the primary work (e.g. "Felter, H. W."). */
  author: string;
  /** Title of the primary work (e.g. "Eclectic Materia Medica"). */
  title: string;
  /** Publication year of the cited edition (e.g. 1922). */
  year: number;
  /**
   * URL to the public-domain digital edition. Stable hosts only:
   * Henriette's Herbal Homepage, Lloyd Library, Internet Archive,
   * Chinese Text Project (ctext.org), Wikisource.
   */
  url: string;
  /**
   * Optional short verbatim excerpt from the primary text, used by the
   * UI to surface the original phrasing in tooltips and citation drawers.
   * Should be quoted accurately and bounded to fair-use length.
   */
  excerpt?: string;
  /** Optional locator within the work (e.g. "§asthenic debility"). */
  locator?: string;
}

/**
 * Industry best-practice secondary citation per Lock #43.
 */
export interface SecondaryCitation {
  kind: SecondaryCitationKind;
  /** Title of the article, monograph, or chapter. */
  title: string;
  /** Lead author / editors (optional for institutional documents). */
  author?: string;
  /** Publication year. */
  year?: number;
  /**
   * Stable identifier — DOI, PubMed ID (PMID), PMC ID, NCBI Bookshelf
   * NBK ID, WHO publication ID, ISBN. Used for UI provenance labels and
   * archival stability.
   */
  identifier: string;
  /** Stable URL to the source. */
  url: string;
  /** Optional verbatim excerpt for citation drawer / tooltip. */
  excerpt?: string;
  /** Optional locator (e.g. "Ch. 3, Constitutional Prescribing"). */
  locator?: string;
}

/**
 * Dual-source citation pair. Per Lock #43, both halves are required for
 * any clinical claim that ships. Authoring rule: if one half cannot be
 * sourced, the claim does not ship — flag for founder strategic decision.
 */
export interface DualSourceCitation {
  primaryText: PrimaryTextCitation;
  secondary: SecondaryCitation;
}

/* ------------------- Cross-tradition observations -------------------- */

/**
 * Classical medicine traditions whose empirical pattern observations are
 * INCLUDED per Lock #44 with theological attribution stripped. The list
 * is intentionally narrow at type-time (canonical traditions) but extends
 * via "other" with a free-form `traditionLabel` for less-common systems
 * (Tibetan, Egyptian, Mesoamerican, etc.) where a structured slug is not
 * yet warranted.
 */
export type ClassicalTradition =
  | "western_eclectic"
  | "western_physiomedical"
  | "tcm"
  | "ayurveda"
  | "unani"
  | "tibetan"
  | "other";

/**
 * Structured cross-tradition observation, per Lock #44.
 *
 * The `pattern` field carries the tradition's term for the phenotype
 * (e.g. "Yang Excess (实热)", "Pitta Vikriti", "Mizaj-i-Har"). The
 * `observation` field is attribution-stripped clinical description — what
 * the tradition observed about how the body actually behaves, NOT
 * spiritual causation. The `citation` field anchors the observation to a
 * pre-1928 primary text per Lock #38; an industry secondary may be
 * carried alongside via the parent ContentEntry's `citations.secondary`
 * when the same secondary covers cross-tradition validation, or via a
 * dedicated `secondary` field here when the cross-tradition observation
 * has its own dedicated industry-secondary anchor.
 */
export interface TraditionalObservation {
  tradition: ClassicalTradition;
  /**
   * Optional free-form tradition label, used when `tradition` is "other"
   * or when the canonical slug needs a more specific qualifier
   * (e.g. "Egyptian Kemetic medicine"). Otherwise omit.
   */
  traditionLabel?: string;
  /** The tradition's term for the pattern (preserved as the tradition uses it). */
  pattern: string;
  /**
   * Attribution-stripped clinical description per Lock #44. Observation
   * IN: how the body presents, what is palpable / visible / measurable.
   * Theological attribution OUT: not "qi flowing through cosmic Tao",
   * not "prana as Brahman", not karma-based etiology.
   */
  observation: string;
  /** Pre-1928 primary-text citation per Lock #38 anchoring this observation. */
  citation: PrimaryTextCitation;
  /**
   * Optional industry-secondary citation specific to this cross-tradition
   * observation, carried per Lock #43 when the cross-tradition claim
   * needs its own modern validation distinct from the parent entry's
   * primary secondary.
   */
  secondary?: SecondaryCitation;
}

/* --------------------------- Content entry --------------------------- */

/**
 * Canonical entry shape. Every Phase B clinical content module exports a
 * `Record<slug, ContentEntry>` keyed by the slug field, plus a typed
 * accessor. UI components consume the entry's description fields and
 * render the citation triple (primary + secondary + cross-tradition) via
 * the citation drawer / tooltip pattern surfaced in
 * src/components/apothecary/HerbCard.tsx (post-PR-#27 Constitutional-match
 * relight).
 */
export interface ContentEntry {
  /** Canonical key — kebab or snake-case ASCII. Stable across releases. */
  slug: string;
  /** UI-displayable label (e.g. "Sthenic"). */
  displayName: string;
  /**
   * Optional category slug for grouping in registries
   * (e.g. "vital_force", "galenic_simple_dyskrasia",
   * "tissue_state", "tcm_pattern", "ayurvedic_dosha").
   */
  category?: string;
  /**
   * 1–2 sentence plain-language framing for the lay register
   * (homeschool-mama-tipping-her-toe-into-herbalism). No clinical jargon.
   * Surfaced in initial result reveals, badge tooltips, and onboarding.
   */
  shortDescription: string;
  /**
   * 3–5 sentence clinical description. Terminology preserved (sthenic,
   * atony, irritation, dyskrasia, vikriti, etc.). Surfaced in detail
   * cards, deep-diagnostic result pages, and Root-tier guides.
   */
  description: string;
  /**
   * Dual-source citation per Lock #43. Both halves required.
   */
  citations: DualSourceCitation;
  /**
   * Optional cross-tradition observations per Lock #44. Each observation
   * carries its own primary-text citation; the parent `citations` field
   * carries the canonical Western-tradition pair.
   */
  traditionalObservations?: TraditionalObservation[];
  /**
   * Optional unstructured observational notes — longer-form commentary
   * that doesn't fit either the dual-citation block or a structured
   * cross-tradition observation. Use sparingly; structured fields are
   * preferred for everything that consuming UI surfaces directly.
   */
  observationalNotes?: string;
}

/**
 * Helper type for downstream registries. Each Phase B module exports
 * its registry as `Record<TKey, ContentEntry>` where TKey is the
 * module-specific slug union (e.g. VitalForce, GalenicTemperament).
 */
export type ContentEntryRegistry<TKey extends string> = Record<TKey, ContentEntry>;
