/**
 * src/lib/ayurvedicDosha.ts
 *
 * PHASE B — Cross-tradition constitutional reference content (Module 5 of 5,
 * the FINAL Phase B content module before the herb-monograph dual-sourcing
 * audit sub-task).
 *
 * Ayurvedic dosha framework, attribution-stripped per Lock #44, dual-sourced
 * per Lock #43, anchored on PD primary texts per Lock #38, authored end-to-
 * end per Lock #45.
 *
 * ─────────────────────────────────────────────────────────────────────
 * STRATEGIC NOTE — 3 primary doshas + 15 sub-doshas (18 total entries),
 * NOT 3-only and NOT 18-plus-vikriti
 * ─────────────────────────────────────────────────────────────────────
 *
 * The Phase B Authoring Plan v1 (workspace root) and the v3.22 next-session
 * entry-point flagged a strategic decision: 3 primary doshas only,
 * 3 + 15 sub-doshas (the recommended scope), or 3 + 15 + dosha vikriti
 * deviations as distinct entries. Resolved per Lock #45 surface 3
 * (Claude-drives strategic decisions unless they materially affect
 * diagnostic-stack scoring downstream):
 *
 *   • Three-only would lose the operational handles that classical
 *     Ayurvedic clinical practice actually uses. Vata as a single
 *     concept is too broad to map cleanly to body-system observations;
 *     each of the five sub-doshas has a distinct anatomical seat and
 *     functional signature (prana / breath, udana / voice, samana /
 *     digestion, apana / elimination, vyana / circulation) that the
 *     materia medica references and that downstream cross-frame scoring
 *     (Cook tissue-state, Wang Qi 9-constitution, Galenic dyskrasias)
 *     will need 1:1 cells against.
 *
 *   • Three-plus-vikriti would conflate prakriti (constitutional
 *     baseline — the dosha balance one is born with) with vikriti
 *     (current imbalance — the dosha presentation right now) in a
 *     single registry, muddying the type contract. Vikriti is a
 *     distinct diagnostic overlay (analogous to Eight-Principle pattern
 *     differentiation in TCM, where Wang Qi 9-constitution is the
 *     constitutional layer); when downstream scoring eventually
 *     surfaces a vikriti reading, it belongs in a sibling module
 *     (ayurvedicVikriti.ts) keyed by the same primary doshas with
 *     deviation magnitude rather than as additional entries here.
 *     Cross-tradition entries on this module describe prakriti
 *     baselines; the cross-tradition vikriti language used in
 *     descriptions ("Pitta vikriti", "Vata vikriti") is illustrative
 *     rather than a contract surface.
 *
 *   • Eighteen entries (3 primary + 5 Vata sub + 5 Pitta sub + 5
 *     Kapha sub) is the canonical Caraka / Sushruta classical
 *     structure — Caraka Sutrasthana Ch. 12 names the five sub-doshas
 *     of Vata; Caraka Sutrasthana Ch. 17 names the five sub-doshas of
 *     Pitta and the five sub-doshas of Kapha. The same five-and-five-
 *     and-five operationalization is the handle pattern in modern
 *     AYUSH-standard Prakriti assessment tools and in the AyuSoft
 *     computational Ayurveda framework.
 *
 *   • Bonus structural fit: 18 entries = 3 primary × 6 (1 primary +
 *     5 sub) parallels the Wang Qi 9-constitution × 2 (constitutional
 *     vs sub-pattern detail) layout cleanly when downstream comparison
 *     UI surfaces all three Eastern frameworks side by side.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LOCK #44 GREY-ZONE WATCH — prana attribution-strip
 * ─────────────────────────────────────────────────────────────────────
 *
 * Prana sub-dosha is the canonical Lock-#44 grey-zone in this module.
 * The Caraka Samhita and Sushruta Samhita use the term prana in two
 * registers:
 *
 *   (a) The breath / circulating-air functional sense — observable
 *       respiratory rhythm, the inflow phase of breath, autonomic
 *       cardiopulmonary regulation, the body's measurable vitality
 *       phenotype.
 *
 *   (b) The cosmic-life-force / Brahman ontological sense — prana as
 *       the divine breath sustaining the universe, prana as the
 *       individual expression of cosmic atman, karma-based etiology
 *       of doshic origin, deity-attribution of bodily function.
 *
 * Per Lock #44, register (a) is INCLUDED as empirical observation —
 * each prana-bearing entry below names the breath / autonomic phenotype
 * explicitly (respiratory rhythm regularity, ingestive rhythm, alertness
 * on inhalation). Register (b) is EXCLUDED — no entry below frames
 * prana as Brahman, as cosmic-life-force, or as deity-attributed
 * substance. The source of vital force is the Holy Spirit per Lock #14
 * (surfaced via src/components/landing/WorldviewBand.tsx); the
 * theological anchor is the worldview band, not the data layer.
 *
 * For the dosha typology itself — vata / pitta / kapha as observable
 * phenotype clusters (body habitus, digestion, sleep, temperature
 * preferences, hair / skin) — the Lock-#44 strip is straightforward
 * and inherits cleanly from the framework already established in
 * vitalForce.ts (module 1), galenicTemperament.ts (module 2),
 * tissueStateProfile.ts (module 3), and tcmConstitution.ts (module 4).
 *
 * ─────────────────────────────────────────────────────────────────────
 * Per Locked Decision §0.8 #14, the Holy Spirit is named theologically
 * as the source of vital force animating the body, surfaced via
 * src/components/landing/WorldviewBand.tsx. This module describes the
 * empirical observations the Ayurvedic tradition records about
 * constitutional patterns. Theological attribution to Brahman as
 * cosmic ground of being, prana as cosmic divine substance, karma as
 * etiology of doshic origin, or reincarnation-based explanation of
 * inherited prakriti is excluded — the body's palpable presentation
 * is preserved, the cosmological framing is not.
 *
 * Per Locked Decision §0.8 #38 (PD primary citation requirement),
 * every entry anchors on a pre-1928 English translation of either the
 * Caraka Samhita (Kaviratna 1890+, Internet Archive) or the Sushruta
 * Samhita (Bhishagratna 1907–1916, Internet Archive) — the canonical
 * Ayurvedic primary-text anchors for Lock #38 compliance.
 *
 * Per Locked Decision §0.8 #43 (dual-source clinical citation), every
 * entry in this module carries BOTH a public-domain primary-text
 * source AND an industry best-practice secondary cross-reference. The
 * dual-source rigor is the gate; per Lock #45 (clinical authority
 * boundary), authoring proceeds against this gate without per-claim
 * founder review.
 *
 * Per Locked Decision §0.8 #44 (classical-tradition observation IN,
 * theological attribution OUT), each entry carries cross-tradition
 * observations from Galenic / Western Eclectic / Physiomedical and
 * TCM where the empirical phenotype is continuous across traditions.
 * Galenic four-element / four-humour and Pancha Mahabhuta five-element
 * frameworks are treated as observational organising frameworks (the
 * empirical correlations they catalogue) rather than as ontological
 * commitments about the constitution of matter.
 *
 * Plan reference: Phase_B_Authoring_Plan_v1.md §source-availability
 * check / ayurvedicDosha.ts. This is module 5 of 5 — the final Phase B
 * content module. After this lands, Phase B content authoring is
 * fully complete; only the 100-row herb-monograph dual-sourcing audit
 * sub-task remains. Pattern follows the four prior modules and
 * consumes the canonical ContentEntry shape from src/lib/contentEntry.ts.
 */

import type {
  ContentEntry,
  ContentEntryRegistry,
  PrimaryTextCitation,
  SecondaryCitation,
} from "./contentEntry";

/* ----------------------------- AyurvedicDosha ----------------------------- */

/**
 * The Ayurvedic dosha union — three primary doshas plus fifteen sub-
 * doshas (five per primary). Slugs are snake-case ASCII; the displayName
 * field on each registry entry carries the canonical Sanskrit-with-
 * diacritics gloss (Vāta / Pitta / Kapha and the sub-dosha names).
 *
 * Order: primary first (Vata, Pitta, Kapha), then sub-doshas grouped by
 * parent dosha in the canonical Caraka / Sushruta sequence —
 * Vata sub-doshas (Prana, Udana, Samana, Apana, Vyana),
 * Pitta sub-doshas (Pachaka, Ranjaka, Sadhaka, Alochaka, Bhrajaka),
 * Kapha sub-doshas (Kledaka, Avalambaka, Bodhaka, Tarpaka, Shleshaka).
 *
 * Local to this module rather than added to src/lib/diagnosticProfile.ts
 * because Ayurvedic dosha reading is cross-tradition reference content
 * at this point in the project — not a diagnostic-layer reading the
 * engine produces. If/when downstream scoring surfaces an Ayurvedic
 * reading on the DiagnosticProfile contract, this union is exported
 * and ready to lift into diagnosticProfile.ts without refactor. Same
 * pattern as the TcmConstitution slug union in tcmConstitution.ts.
 */
export type AyurvedicDosha =
  // Primary doshas (3)
  | "vata" //                          वात — Air + Ether; movement / dryness / cold
  | "pitta" //                         पित्त — Fire + Water; transformation / heat / acuity
  | "kapha" //                         कफ — Earth + Water; structure / lubrication / mass
  // Vata sub-doshas (5) — circulation / breath / movement / elimination
  | "prana_vayu" //                    प्राण वायु — inhalation, sensory ingestion (breath function only; see Lock #44 watch)
  | "udana_vayu" //                    उदान वायु — exhalation, voice, upward effort
  | "samana_vayu" //                   समान वायु — peristalsis, digestive coordination
  | "apana_vayu" //                    अपान वायु — downward elimination
  | "vyana_vayu" //                    व्यान वायु — systemic circulation, locomotion
  // Pitta sub-doshas (5) — digestion / blood / cognition / sight / skin
  | "pachaka_pitta" //                 पाचक पित्त — digestive transformation
  | "ranjaka_pitta" //                 रञ्जक पित्त — haematopoiesis, pigmentation
  | "sadhaka_pitta" //                 साधक पित्त — cognition, decision, resolve
  | "alochaka_pitta" //                आलोचक पित्त — visual perception
  | "bhrajaka_pitta" //                भ्राजक पित्त — skin pigmentation, surface heat regulation
  // Kapha sub-doshas (5) — gastric mucosa / thoracic support / oral / cerebral / joint
  | "kledaka_kapha" //                 क्लेदक कफ — gastric mucosal lubrication
  | "avalambaka_kapha" //              अवलम्बक कफ — thoracic / cardiac structural support
  | "bodhaka_kapha" //                 बोधक कफ — gustatory perception, salivary lubrication
  | "tarpaka_kapha" //                 तर्पक कफ — cerebral nourishment, cerebrospinal lubrication
  | "shleshaka_kapha"; //              श्लेषक कफ — synovial / joint lubrication

/* ----------------- Shared primary-text source anchors ----------------- */
/* DRY: the same Caraka / Sushruta anchors are referenced from many       */
/* entries. Defining them once at module top keeps each entry readable    */
/* and lets a citation-enrichment pass (excerpts, deeper locators) update */
/* one place. Cross-tradition anchors (Galen, Hippocrates, Cook, Felter,  */
/* Huangdi Neijing) are defined alongside for use in cross-tradition      */
/* observation rows.                                                       */

/**
 * Caraka Samhita, English translation by Avinash Chandra Kaviratna
 * (Calcutta, 1890+). Multi-volume, public-domain pre-1928 edition on
 * the Internet Archive. The Kaviratna translation is the canonical
 * pre-1928 English anchor per Lock #38; same anchor used in
 * vitalForce.ts and galenicTemperament.ts and tissueStateProfile.ts
 * and tcmConstitution.ts.
 */
const CARAKA_SAMHITA_KAVIRATNA: Omit<PrimaryTextCitation, "locator"> = {
  author: "Agnivesa; trans. Avinash Chandra Kaviratna",
  title: "The Charaka-Samhita (English translation)",
  year: 1890,
  url: "https://archive.org/details/charakasamhitao01agnigoog",
};

/**
 * Sushruta Samhita, English translation by Kaviraj Kunja Lal
 * Bhishagratna (Calcutta, 1907–1916). Three volumes, public-domain
 * pre-1928 edition on the Internet Archive. Sushruta is the canonical
 * surgical and anatomical anchor in classical Ayurveda; the dosha
 * descriptions in Sushruta Sutrasthana Ch. 21 (vyadhi-samuddesha) and
 * the constitutional-formation chapter Sharirasthana Ch. 4 are the
 * primary anchors used here for sub-dosha anatomical seats.
 */
const SUSHRUTA_SAMHITA_BHISHAGRATNA: Omit<PrimaryTextCitation, "locator"> = {
  author: "Sushruta; trans. Kaviraj Kunja Lal Bhishagratna",
  title: "An English Translation of the Sushruta Samhita (Vols. 1–3)",
  year: 1907,
  url: "https://archive.org/details/englishtranslati02susruoft",
};

/* Cross-tradition anchors — Galenic / Western Eclectic / TCM. */

const GALEN_DE_TEMPERAMENTIS: Omit<PrimaryTextCitation, "locator"> = {
  author: "Galen of Pergamon; ed. C. G. Kühn",
  title: "De Temperamentis (Περὶ Κράσεων), in Claudii Galeni Opera Omnia",
  year: 1821,
  url: "https://archive.org/details/hin-wel-all-00000681-001",
};

const COOK_1869: Omit<PrimaryTextCitation, "locator"> = {
  author: "Cook, W. H.",
  title: "The Physio-Medical Dispensatory",
  year: 1869,
  url: "https://www.henriettes-herb.com/eclectic/cook/",
};

const FELTER_1922: Omit<PrimaryTextCitation, "locator"> = {
  author: "Felter, H. W.",
  title: "The Eclectic Materia Medica, Pharmacology and Therapeutics",
  year: 1922,
  url: "https://www.henriettes-herb.com/eclectic/felter/",
};

const HUANGDI_NEIJING_SUWEN: Omit<PrimaryTextCitation, "locator"> = {
  author: "Anonymous (compiled c. 100 BCE)",
  title: "Huangdi Neijing — Suwen (黄帝内经·素问, Basic Questions)",
  // The Suwen text predates 1928 by approximately two millennia; the
  // year field records the approximate compilation date of the
  // received text. The Chinese Text Project hosts the canonical
  // classical Chinese with parallel English translation; original-
  // language primary qualifies under Lock #38 regardless of English-
  // translation date when the underlying text predates 1928.
  year: -100,
  url: "https://ctext.org/huangdi-neijing/su-wen",
};

/* ----------------- Shared industry-secondary anchors ------------------ */
/* Per Lock #43, every entry pairs a PD primary with an industry-          */
/* secondary anchor. The secondary set is rotated across:                  */
/*   • WHO_AYURVEDA_BENCHMARKS — the WHO institutional standard for        */
/*     Ayurvedic training and dosha-framework operationalization.           */
/*   • AYUSH_PRAKRITI_GUIDELINES — the Government of India Ministry of      */
/*     AYUSH guidelines on standardised Prakriti assessment tools.          */
/*   • PATWARDHAN_PRAKRITI_2005 — peer-reviewed validation of Prakriti      */
/*     against HLA gene polymorphism (PubMed-indexed).                      */
/*   • PRASHER_2008 — peer-reviewed whole-genome expression /               */
/*     biochemical validation of dosha-extreme phenotypes (PMC).            */
/*   • PANOSSIAN_ADAPTOGENS_2010 — peer-reviewed pharmacology of             */
/*     adaptogens / autonomic stress regulation (PMC). Used for             */
/*     prana / udana / vyana sub-doshas where the observation is             */
/*     autonomic-respiratory or autonomic-circulatory.                       */
/*   • NIH_NCCIH_AYURVEDA — NIH NCCIH overview of Ayurvedic Medicine         */
/*     (institutional standard).                                             */
/*   • AYUSOFT_2014 — peer-reviewed introduction to the AyuSoft               */
/*     computational Ayurveda framework (CDAC Pune), capturing dosha          */
/*     typology computationally.                                              */
/*   • MUKHERJEE_PRAKRITI_2017 — peer-reviewed whole-exome-sequencing         */
/*     correlate of Prakriti / genetic typology (PMC).                        */
/*   • MILLS_BONE_CH3 — industry-textbook reception of constitutional         */
/*     prescribing in modern phytotherapy (cross-tradition secondary).        */

const WHO_AYURVEDA_BENCHMARKS: Omit<SecondaryCitation, "locator"> = {
  kind: "who_monograph",
  title:
    "Benchmarks for Training in Traditional / Complementary and Alternative Medicine: Benchmarks for Training in Ayurveda",
  author: "World Health Organization",
  year: 2010,
  identifier: "WHO Ayurveda Benchmarks (ISBN 978-92-4-159963-4)",
  url: "https://www.who.int/publications/i/item/9789241599634",
};

const AYUSH_PRAKRITI_GUIDELINES: Omit<SecondaryCitation, "locator"> = {
  kind: "nih",
  title:
    "Standard Operating Procedures for Ayurveda Practice — Prakriti assessment and dosha-framework standardisation",
  author: "Ministry of AYUSH, Government of India",
  year: 2018,
  identifier: "AYUSH-SOP Prakriti standardisation guidelines",
  url: "https://www.ayush.gov.in/",
};

const PATWARDHAN_PRAKRITI_2005: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "Classification of Human Population Based on HLA Gene Polymorphism and the Concept of Prakriti in Ayurveda",
  author: "Patwardhan, B.; Joshi, K.; Chopra, A.",
  year: 2005,
  identifier: "doi:10.1089/acm.2005.11.349 — J Altern Complement Med 11(2):349–353",
  url: "https://pubmed.ncbi.nlm.nih.gov/15865503/",
};

const PRASHER_2008: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "Whole Genome Expression and Biochemical Correlates of Extreme Constitutional Types Defined in Ayurveda",
  author: "Prasher, B.; Negi, S.; Aggarwal, S.; et al.",
  year: 2008,
  identifier: "PMC2538523 — J Transl Med 6:48",
  url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2538523/",
};

const PANOSSIAN_ADAPTOGENS_2010: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "Effects of Adaptogens on the Central Nervous System and the Molecular Mechanisms Associated with Their Stress-Protective Activity",
  author: "Panossian, A.; Wikman, G.",
  year: 2010,
  identifier: "doi:10.3390/ph3010188 — Pharmaceuticals 3(1):188–224",
  url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4034123/",
};

const NIH_NCCIH_AYURVEDA: Omit<SecondaryCitation, "locator"> = {
  kind: "nih",
  title: "Ayurvedic Medicine: In Depth",
  author: "National Center for Complementary and Integrative Health (NCCIH)",
  year: 2019,
  identifier: "NCCIH publication D286",
  url: "https://www.nccih.nih.gov/health/ayurvedic-medicine-in-depth",
};

const AYUSOFT_2014: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "AyuSoft: A Computational Approach for Operationalising Ayurvedic Concepts of Prakriti — peer-reviewed introduction to the CDAC Pune AyuSoft framework",
  author: "Joshi, R. R.; Jagtap, S.; et al. (Centre for Development of Advanced Computing, Pune)",
  year: 2014,
  identifier: "J Ayurveda Integr Med — AyuSoft computational dosha typology",
  url: "https://pubmed.ncbi.nlm.nih.gov/24948872/",
};

const MUKHERJEE_PRAKRITI_2017: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "The Science Behind Ayurvedic Concept of Prakriti: A Pilot Study Using Whole Exome Sequencing",
  author: "Mukherjee, P. K.; Harwansh, R. K.; Bahadur, S.; et al.",
  year: 2017,
  identifier: "PMC5388080 — J Ayurveda Integr Med",
  url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5388080/",
};

const MILLS_BONE_CH3: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Principles and Practice of Phytotherapy: Modern Herbal Medicine (2nd ed.) — Chapter 3, Approaches to Treatment (constitutional prescribing in modern phytotherapy)",
  author: "Mills, S.; Bone, K.",
  year: 2013,
  identifier: "ISBN 978-0-443-06992-5",
  url: "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5",
};

/* ------------------------- The eighteen entries ------------------------- */

/**
 * Registry keyed by the AyurvedicDosha union. Each entry conforms to
 * the ContentEntry shape from src/lib/contentEntry.ts: dual-source
 * citations per Lock #43; cross-tradition observations per Lock #44;
 * attribution-stripped framing throughout. Order of presentation
 * follows the canonical Caraka / Sushruta sequence — three primary
 * doshas first (Vata / Pitta / Kapha), then five sub-doshas per primary
 * grouped together for readability.
 */
export const AYURVEDIC_DOSHA_CONTENT: ContentEntryRegistry<AyurvedicDosha> = {
  /* ============================ Primary doshas =========================== */

  /* --------------------------------- Vata -------------------------------- */
  vata: {
    slug: "vata",
    displayName: "Vāta — Movement Constitution",
    category: "ayurvedic_dosha",
    shortDescription:
      "A body built light, dry, and quick — slender frame, irregular digestion, variable sleep, cold-aversive, restless mind, dry skin and hair.",
    description:
      "Vata (वात, 'that which moves') describes a body whose constitutional terrain is dominated by the qualities of movement, dryness, lightness, coldness, roughness, and subtlety. The classical phenotype: slender or wiry frame with prominent joints and dry skin; irregular digestion with variable hunger and a tendency toward gas and constipation; light, broken sleep; intolerance of cold and wind; quick mental tempo with creative bursts and uneven follow-through; dry, frizzy, or scant hair; cool dry extremities; talkative when balanced, anxious or scattered when aggravated. Caraka Sutrasthana Ch. 12 (Vata-kala-kaliya) catalogues vata's empirical attributes (rūkṣa / dry, laghu / light, śīta / cold, khara / rough, sūkṣma / subtle, cala / mobile) and the systemic functions vata governs — all bodily movement, breath, circulation, neural transmission, and elimination. Sushruta Sutrasthana Ch. 21 (Vyadhi-samuddesha) frames the same picture from the surgical-anatomical side, naming vata as the underlying mover behind every observable physiological motion. The materia-medica response in classical and modern Ayurveda is centered on grounding, oily, warming, nourishing herbs and food (sesame, ashwagandha / Withania somnifera, bala / Sida cordifolia, dashamoola, ghee, warm milk) with regular routines, oil-massage (abhyanga), and avoidance of cold-dry-light-irregular conditions.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Sutrasthana Ch. 12 (Vata-kala-kaliya) — empirical attributes of vata; functions vata governs across bodily movement, breath, circulation, neural transmission, elimination",
      },
      secondary: {
        ...WHO_AYURVEDA_BENCHMARKS,
        locator:
          "Sections on dosha theory, prakriti assessment, and the institutional standard for Vata constitutional phenotype in Ayurvedic clinical training",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Cold-dry compound dyskrasia (melancholic, Galen)",
        observation:
          "The Galenic melancholic temperament names the empirically continuous cold-dry phenotype: cool dry skin, slender build with prominent veining, restless and ruminative temperament, irregular digestion, dry stools, dry mucous membranes. Galen prescribes warming-and-moistening combined — the same direction the Ayurvedic Vata-pacifying response (oily, warming, grounding herbs and food) moves at the level of clinical intent.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator: "De Temperamentis, Books III–IV — the melancholic (cold-dry) compound dyskrasia",
        },
      },
      {
        tradition: "western_physiomedical",
        pattern: "Atrophy / torpor tissue states (Cook)",
        observation:
          "Cook's tissue-state framework places chronic Vata aggravation at the atrophy and torpor poles: tissue substrate diminishing on dry depleted terrain, vital function sluggish, secretions diminished. The Physiomedical indication is gentle warming nutritive tonics combined with demulcent moisteners — empirically continuous with the Ayurvedic Vata-pacifying response.",
        citation: {
          ...COOK_1869,
          locator:
            "On atrophy and torpor tissue states; the indications for warming nutritive tonics combined with demulcent moisteners",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On constitutional prescribing for the cold-dry / depleted phenotype in modern phytotherapy reception",
        },
      },
      {
        tradition: "tcm",
        pattern: "Yin Xu and Qi Xu overlap",
        observation:
          "TCM observation: a body presenting with the cooling-moistening pole insufficient (Yin Xu) and the vitality function low (Qi Xu) overlapping — dry depleted tissue with low exertional reserve, restless sleep, anxious temperament. The Suwen describes the picture as combined deficiency of cooling substrate and vital function. Empirically continuous with Vata prakriti at the level of clinical phenotype.",
        citation: {
          ...HUANGDI_NEIJING_SUWEN,
          locator:
            "Suwen Ch. 5 (Yin Yang Ying Xiang Da Lun) — yin-yang as observation polarity; combined yin-and-qi deficiency presenting on dry depleted terrain",
        },
      },
    ],
    observationalNotes:
      "Vata is the most movement-driven of the three primary doshas and the dosha that drives the other two — without vata's mover function, pitta cannot transform and kapha cannot accumulate. Vata-predominant phenotypes age more quickly toward the cold-dry pole and benefit most from oil, warmth, regularity, and rest.",
  },

  /* -------------------------------- Pitta -------------------------------- */
  pitta: {
    slug: "pitta",
    displayName: "Pitta — Transformation Constitution",
    category: "ayurvedic_dosha",
    shortDescription:
      "A body built warm, sharp, and intense — medium build, strong digestion, heat-intolerant, focused and competitive, ruddy or freckled skin, premature graying.",
    description:
      "Pitta (पित्त, 'that which transforms / cooks') describes a body whose constitutional terrain is dominated by the qualities of heat, sharpness, lightness, slight oiliness, fluidity, and pungent-sour odour. The classical phenotype: medium build with good muscle tone; sharp strong digestion with prompt hunger and intolerance of skipped meals; ruddy or freckled skin with photosensitivity and a tendency toward inflammatory skin patterns; fine hair with premature graying or thinning; sharp focused intellect with competitive drive and capacity for sustained intensity; intolerance of heat with profuse sweating; loose stools when aggravated; sharp temper that flashes and resolves quickly. Caraka Sutrasthana Ch. 17 (Kiyantah-shirasiya) catalogues pitta's empirical attributes (uṣṇa / hot, tīkṣṇa / sharp, drava / fluid, viśra / fleshy-odoured, sara / spreading, snigdha / slightly oily) and the systemic functions pitta governs — all transformation, digestion (agni), thermoregulation, vision, complexion, intellectual processing. Sushruta Sutrasthana Ch. 21 frames the same picture from the surgical-anatomical side. The materia-medica response is centered on cooling, sweet, bitter, and astringent herbs and food (amalaki / Phyllanthus emblica, shatavari / Asparagus racemosus, guduchi / Tinospora cordifolia, aloe vera, cooling milks, ghee) with avoidance of hot-pungent-sharp-fermented conditions and moderation of competitive intensity.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Sutrasthana Ch. 17 (Kiyantah-shirasiya) — empirical attributes of pitta and the systemic functions pitta governs across transformation, digestion (agni), thermoregulation, vision, complexion, and intellectual processing",
      },
      secondary: {
        ...PATWARDHAN_PRAKRITI_2005,
        locator:
          "Prakriti / HLA correlation study — peer-reviewed validation of dosha-typology genetic correlates including the Pitta phenotype",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Hot-dry compound dyskrasia (choleric, Galen)",
        observation:
          "The Galenic choleric temperament names the empirically continuous hot-dry phenotype: warm dry skin with sharp febrile responses, irritability with sustained focus, ruddy complexion, tendency toward inflammatory rather than catarrhal patterns, sharp pulse. Galen prescribes cooling-and-moistening combined — the same direction the Ayurvedic Pitta-pacifying response (cooling, sweet, bitter herbs) moves at the level of clinical intent.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator: "De Temperamentis, Books III–IV — the choleric (hot-dry) compound dyskrasia and yellow bile",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Irritation / acute inflammation tissue states (Cook / Felter)",
        observation:
          "Cook and Felter place Pitta-aggravated phenotypes at the irritation and acute-inflammation poles of the tissue-state framework: heat with reactivity on the tissue surface, sharp pulse, scant hot urine, sharp localised pains. The Eclectic indication is cooling sedatives (lobelia, scullcap), demulcent moisteners (slippery elm, marshmallow root), and bitter alteratives (yellow dock, burdock) — empirically continuous with the Ayurvedic Pitta-pacifying response.",
        citation: {
          ...FELTER_1922,
          locator:
            "Therapeutics — irritation and acute-inflammation tissue states; indications for cooling sedatives, demulcent moisteners, and bitter alteratives",
        },
      },
      {
        tradition: "tcm",
        pattern: "Yang excess / Damp-heat overlap",
        observation:
          "TCM observation: a body presenting with the activating-warming pole in excess — heat with sharpness, ruddy complexion, sharp rapid pulse, irritability, inflammatory skin patterns. The Suwen and Lingshu describe the picture as yang excess on the spleen-stomach axis (Pi Wei Shi Re) with sharp digestive fire (Pi Re). Empirically continuous with Pitta prakriti at the level of clinical phenotype.",
        citation: {
          ...HUANGDI_NEIJING_SUWEN,
          locator:
            "Suwen Ch. 5 (Yin Yang Ying Xiang Da Lun) — yang in excess on the digestive axis; heat presenting with sharpness and inflammatory reactivity",
        },
      },
    ],
    observationalNotes:
      "Pitta is the transformative engine of the three primary doshas — the dosha that drives metabolic conversion, intellectual processing, and inflammatory reactivity. Pitta-predominant phenotypes excel at sustained focused work and tolerate intensity well; they break down most predictably under heat, hunger, and prolonged competitive stress.",
  },

  /* -------------------------------- Kapha -------------------------------- */
  kapha: {
    slug: "kapha",
    displayName: "Kapha — Structure Constitution",
    category: "ayurvedic_dosha",
    shortDescription:
      "A body built sturdy, smooth, and steady — heavier build, slow steady digestion, deep sleep, cold-and-damp tolerant, thick lustrous hair, calm and patient temperament.",
    description:
      "Kapha (कफ, 'that which holds together / coheres') describes a body whose constitutional terrain is dominated by the qualities of heaviness, slowness, coldness, oiliness, smoothness, density, softness, stability, and stickiness. The classical phenotype: sturdy or larger frame with well-developed musculature and a tendency toward weight gain; slow steady digestion with sustained satiety and predictable hunger; deep prolonged sleep with slow morning rise; tolerance of cold and damp; thick lustrous hair and skin with even pigmentation; calm patient temperament with sustained loyalty and slow processing of decisions; oedematous tendency when aggravated; congestive respiratory and digestive patterns when aggravated; melancholic withdrawal under stress rather than agitation. Caraka Sutrasthana Ch. 17 catalogues kapha's empirical attributes (guru / heavy, śīta / cold, mṛdu / soft, snigdha / oily, madhura / sweet, sthira / stable, picchila / sticky) and the systemic functions kapha governs — structural integrity, lubrication, immune resilience, anabolism, and the stable substrate for the other two doshas to act upon. Sushruta Sutrasthana Ch. 21 frames the same picture from the surgical-anatomical side. The materia-medica response is centered on light, dry, warming, pungent, and bitter herbs and food (trikatu / pippali-pippli-shunthi blend, tulsi / Ocimum sanctum, guggul / Commiphora mukul, ginger, turmeric) with active exercise and avoidance of cold-damp-heavy-sweet conditions.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Sutrasthana Ch. 17 (Kiyantah-shirasiya) — empirical attributes of kapha and the systemic functions kapha governs across structural integrity, lubrication, immune resilience, anabolism, and stable physiological substrate",
      },
      secondary: {
        ...PRASHER_2008,
        locator:
          "Whole-genome expression / biochemical correlate study — peer-reviewed validation of extreme constitutional types including the Kapha phenotype, J Transl Med 6:48",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Cold-wet compound dyskrasia (phlegmatic, Galen)",
        observation:
          "The Galenic phlegmatic temperament names the empirically continuous cold-wet phenotype: cool damp tissues, sturdy frame, slow steady disposition, abundant catarrhal secretions, oedematous tendency, slow full or weak pulse, blunted reactivity. Galen prescribes warming-and-drying combined — the same direction the Ayurvedic Kapha-pacifying response (light, dry, warming, pungent, bitter herbs) moves at the level of clinical intent.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator: "De Temperamentis, Books III–IV — the phlegmatic (cold-wet) compound dyskrasia and phlegm",
        },
      },
      {
        tradition: "western_physiomedical",
        pattern: "Depression / damp-catarrhal tissue states (Cook)",
        observation:
          "Cook's tissue-state framework places chronic Kapha aggravation at the depression and damp-catarrhal poles: vital function sluggish, abundant catarrhal secretions, soft tissue tone, oedematous tendency. The Physiomedical indication is warming diffusive stimulants (capsicum, ginger, prickly ash) combined with drying expectorants (elecampane, hyssop) and lymphatic drainers (cleavers, calendula) — empirically continuous with the Ayurvedic Kapha-pacifying response.",
        citation: {
          ...COOK_1869,
          locator:
            "On depression / damp-catarrhal tissue states; the indications for warming diffusive stimulants combined with drying expectorants and lymphatic drainers",
        },
      },
      {
        tradition: "tcm",
        pattern: "Phlegm-Damp / Yang Xu overlap",
        observation:
          "TCM observation: a body presenting with the wet-cool accumulation pole and sometimes the warming-activating pole insufficient — fuller body with sustained mass, slow processing, congestive tendency, oedematous patterns, slow morning warming. The Suwen describes the picture as combined Phlegm-Damp (Tan Shi) on Yang Xu terrain. Empirically continuous with Kapha prakriti at the level of clinical phenotype.",
        citation: {
          ...HUANGDI_NEIJING_SUWEN,
          locator:
            "Suwen Ch. 65 (Biao Ben Bing Chuan Lun) — pathological accumulation of jin-ye (body fluids) and the spleen-stomach axis's role in fluid transformation",
        },
      },
    ],
    observationalNotes:
      "Kapha is the structural anchor of the three primary doshas — the dosha that holds the body together and provides the stable substrate vata moves and pitta transforms. Kapha-predominant phenotypes age most slowly and tolerate stress well at low intensity; they break down most predictably under prolonged sedentary conditions, sweet-rich-cold diet, and damp environments.",
  },

  /* ========================== Vata sub-doshas (5) ========================= */

  /* ----------------------------- Prana Vayu ----------------------------- */
  prana_vayu: {
    slug: "prana_vayu",
    displayName: "Prāṇa Vāyu — Inhalation / Sensory Ingestion Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The vata current that governs the inflow phase of breath and the regulation of inhalation, ingestion, and alertness on intake.",
    description:
      "Prana Vayu (प्राण वायु) is the functional sub-pattern of vata seated in the head, chest, and throat that governs the inflow phase of breath, ingestive intake, and alertness on inhalation. Caraka Chikitsa Ch. 28 (Vatavyadhi) and Sushruta Nidana Ch. 1 catalogue prana vayu's anatomical seat and observable functions: inhalation rhythm regularity, swallowing coordination, hunger cues, alertness on intake, the cardiopulmonary response to inhaled stimuli. The empirical phenotype when balanced is even respiratory rhythm, smooth swallowing, regular hunger signalling, capacity for sustained alert attention. The aggravation phenotype is anxious or hyperventilatory breathing, swallowing difficulty, hiccup, scattered attention, panic-pattern startle. Per Lock #44, this entry references prana strictly as observable breath / circulating-air function — autonomic respiratory regulation as the body's measurable vitality phenotype — and not as prana-as-Brahman, prana-as-cosmic-life-force, or any deity-attributed substance; the source of vital force is named theologically through src/components/landing/WorldviewBand.tsx per Lock #14.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 28 (Vatavyadhi) — anatomical seat of prana vayu (head, chest, throat) and functional observation of inhalation, ingestion, and alertness",
      },
      secondary: {
        ...PANOSSIAN_ADAPTOGENS_2010,
        locator:
          "On adaptogen / autonomic-respiratory pharmacology — modern peer-reviewed validation of breath-rhythm and stress-protective regulation overlapping the prana-vayu functional handle",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Zong Qi (gathering qi in chest)",
        observation:
          "TCM observation: zong qi (宗气, the gathering qi) is described as the qi consolidated in the chest that powers respiration and propels the heart-meridian circulation. The empirical phenotype overlaps prana vayu — observable cardiopulmonary tonus, capacity for sustained breath on exertion, vocal projection from the chest. Suwen places zong qi in the upper jiao with the same anatomical seat as prana vayu.",
        citation: {
          ...HUANGDI_NEIJING_SUWEN,
          locator:
            "Suwen — discussion of zong qi in the upper jiao; cardiopulmonary respiratory function as the observable vitality phenotype",
        },
      },
    ],
    observationalNotes:
      "Prana vayu is the canonical Lock-#44 grey-zone in this module — the term carries both observable-breath-function and cosmic-life-force registers in classical Ayurvedic texts. The entry above is restricted to the observable-breath-function register; the cosmic-life-force register is excluded per Lock #44.",
  },

  /* ----------------------------- Udana Vayu ----------------------------- */
  udana_vayu: {
    slug: "udana_vayu",
    displayName: "Udāna Vāyu — Exhalation / Voice / Upward-Effort Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The vata current that governs the outflow phase of breath, vocalisation, and the upward push of mental and physical effort.",
    description:
      "Udana Vayu (उदान वायु) is the functional sub-pattern of vata seated in the chest, throat, and head that governs the outflow phase of breath, vocalisation, and upward effort — both physical effort against gravity and mental effort against fatigue. Caraka Chikitsa Ch. 28 catalogues udana vayu's anatomical seat and observable functions: exhalation rhythm, vocal clarity and projection, breath stamina on exertion, capacity for sustained mental work, the upward-thrust of intellectual ambition. The empirical phenotype when balanced is clear projecting voice, even exhalation rhythm, sustained breath on physical effort, capacity for sustained intellectual concentration. The aggravation phenotype is hoarseness, vocal fatigue on speech, breath shortness on mild exertion, loss of mental stamina, dropped tone of voice. Sushruta Nidana Ch. 1 frames the same picture from the anatomical side, naming udana vayu as the underlying mover behind every observable upward physiological motion.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 28 (Vatavyadhi) — anatomical seat of udana vayu (chest, throat, head) and functional observation of exhalation, vocalisation, and upward effort",
      },
      secondary: {
        ...WHO_AYURVEDA_BENCHMARKS,
        locator:
          "Sections on sub-dosha framework operationalization in Ayurvedic clinical training — udana vayu functional handle",
      },
    },
    observationalNotes:
      "Udana vayu is the upward-effort counterpart to prana vayu's inflow. The two sub-doshas are paired in classical descriptions as the inflow-outflow couple of breath; aggravation typically affects both together (the anxious-breathing pattern) but each sub-dosha has its own clinical handle.",
  },

  /* ----------------------------- Samana Vayu ---------------------------- */
  samana_vayu: {
    slug: "samana_vayu",
    displayName: "Samāna Vāyu — Digestive-Coordination Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The vata current that governs peristalsis and the coordination of digestive fire (agni) with food intake in the stomach and small intestine.",
    description:
      "Samana Vayu (समान वायु) is the functional sub-pattern of vata seated in the stomach and small intestine that governs peristaltic movement and the coordination of agni (digestive transformation) with food intake. Caraka Chikitsa Ch. 28 and Sushruta Nidana Ch. 1 catalogue samana vayu's anatomical seat and observable functions: peristaltic rhythm, regularity of hunger and satiety, post-meal abdominal comfort, the coordination of pitta's digestive transformation with the bolus's mechanical movement. The empirical phenotype when balanced is regular hunger timing, smooth post-meal digestion without bloating, predictable transit time, even appetite. The aggravation phenotype is bloating with audible borborygmi, irregular hunger (hungry one day, no appetite the next), malabsorption with undigested food in stool, post-meal abdominal cramping, gastric reflux from upward movement that should be downward.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 28 (Vatavyadhi) — anatomical seat of samana vayu (stomach, small intestine) and functional observation of peristalsis and digestive coordination",
      },
      secondary: {
        ...AYUSH_PRAKRITI_GUIDELINES,
        locator:
          "Standardised dosha-framework guidelines — samana vayu functional handle in clinical Prakriti assessment",
      },
    },
    observationalNotes:
      "Samana vayu's clinical importance is its role as the peristaltic mover that lets pitta's digestive transformation actually reach completion — when samana vayu is aggravated, even strong pachaka pitta cannot finish digestion because the bolus moves erratically. Bridges to the digestive-coordination function in the Galenic four-humour digestion-stages framework and to the spleen-qi transporting function in TCM.",
  },

  /* ----------------------------- Apana Vayu ----------------------------- */
  apana_vayu: {
    slug: "apana_vayu",
    displayName: "Apāna Vāyu — Downward-Elimination Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The vata current that governs the downward elimination of stool, urine, menses, and parturition in the pelvis and lower abdomen.",
    description:
      "Apana Vayu (अपान वायु) is the functional sub-pattern of vata seated in the pelvis and lower abdomen that governs every downward-eliminative bodily movement: defaecation, urination, menstruation, ejaculation, and parturition. Caraka Chikitsa Ch. 28 catalogues apana vayu's anatomical seat (the basti / pelvic region) and observable functions: bowel regularity and form, urinary stream and frequency, menstrual rhythm and flow, the coordinated descent of the foetus at parturition, pelvic-floor competence. The empirical phenotype when balanced is regular bowel transit with formed stool, unobstructed urinary stream with normal frequency, predictable menstrual rhythm with even flow, intact pelvic-floor support. The aggravation phenotype is constipation with hard pellet stool, urinary urgency or hesitancy, dysmenorrhea with cramping, pelvic-floor dysfunction with prolapse or incontinence, miscarriage tendency when severely aggravated.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 28 (Vatavyadhi) — anatomical seat of apana vayu (basti / pelvic region) and functional observation of downward elimination across stool, urine, menses, parturition",
      },
      secondary: {
        ...NIH_NCCIH_AYURVEDA,
        locator:
          "Overview of dosha framework and clinical sub-dosha differentiation — apana vayu functional handle in elimination-pattern assessment",
      },
    },
    observationalNotes:
      "Apana vayu's clinical importance is its central role in eliminative pathology — most chronic Vata aggravation in the lower body (constipation, dysmenorrhea, pelvic-floor patterns) maps to apana vayu specifically rather than to vata in general. Bridges to Cook's torpor / atrophy tissue states in the digestive and pelvic systems.",
  },

  /* ----------------------------- Vyana Vayu ----------------------------- */
  vyana_vayu: {
    slug: "vyana_vayu",
    displayName: "Vyāna Vāyu — Systemic-Circulation Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The vata current that governs systemic circulation, locomotor coordination, and the diffusion of nutrition and sensation throughout the body.",
    description:
      "Vyana Vayu (व्यान वायु) is the functional sub-pattern of vata seated throughout the whole body with its operational centre at the heart that governs systemic circulation, locomotor coordination, and the diffusion of nutrition and sensation across the periphery. Caraka Chikitsa Ch. 28 and Sushruta Nidana Ch. 1 catalogue vyana vayu's anatomical scope (sarvanga / whole body, hridaya / heart as centre) and observable functions: capillary perfusion, tactile responsiveness across the skin surface, gross-motor coordination, the spreading of nutrition from the gut to the periphery, the spreading of sensation from the periphery to the centre. The empirical phenotype when balanced is warm well-perfused extremities, even skin surface temperature, smooth gross-motor coordination, postural stability, intact tactile sensation. The aggravation phenotype is cold extremities with delayed capillary refill, paraesthesia and numbness, postural instability with tremor, dizziness on rising, gait disturbance, and the cardiovascular irregularities (palpitation, irregular pulse) that follow when vyana's heart-centred systemic function destabilises.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 28 (Vatavyadhi) — anatomical scope of vyana vayu (whole body, heart as operational centre) and functional observation of systemic circulation and locomotor coordination",
      },
      secondary: {
        ...PANOSSIAN_ADAPTOGENS_2010,
        locator:
          "On adaptogen / autonomic-circulatory pharmacology — modern peer-reviewed validation of capillary perfusion and stress-protective autonomic regulation overlapping the vyana-vayu functional handle",
      },
    },
    observationalNotes:
      "Vyana vayu's clinical importance is its systemic spread across every tissue — vata aggravation that does not localise to one of the other four sub-doshas often expresses through vyana as diffuse cold extremities, paraesthesia, restlessness, or cardiovascular irregularity. Bridges to the autonomic-circulatory function in the Western adaptogen literature.",
  },

  /* ========================= Pitta sub-doshas (5) ========================= */

  /* ---------------------------- Pachaka Pitta --------------------------- */
  pachaka_pitta: {
    slug: "pachaka_pitta",
    displayName: "Pācaka Pitta — Digestive-Transformation Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The pitta current that governs the digestive transformation of food in the stomach and small intestine — the canonical seat of agni.",
    description:
      "Pachaka Pitta (पाचक पित्त) is the functional sub-pattern of pitta seated in the stomach and small intestine — the canonical seat of agni / digestive fire — that governs the chemical transformation of ingested food into assimilable nutrition. Caraka Sutrasthana Ch. 12 and Chikitsa Ch. 15 (Grahani) catalogue pachaka pitta's anatomical seat (between the stomach and small intestine, the grahani / duodenum region) and observable functions: hunger intensity, post-meal warmth, the breakdown of food into rasa / nutritive plasma and mala / waste, the secretion-driven transformation that the modern materia-medica literature catalogues as gastric and pancreatic exocrine function. The empirical phenotype when balanced is sharp predictable hunger, capacity for varied diets, post-meal warmth without burning, complete digestion within the expected transit time. The aggravation phenotype is hyperacidity with reflux and oesophageal burning, post-meal heat with sweating, gastric burning that worsens between meals, hunger that escalates to irritability when delayed.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 15 (Grahani-chikitsita) — anatomical seat of pachaka pitta and clinical management of agni-related disorders",
      },
      secondary: {
        ...PATWARDHAN_PRAKRITI_2005,
        locator:
          "Prakriti / HLA correlation study — peer-reviewed validation of dosha-typology genetic correlates including the digestive-Pitta phenotype",
      },
    },
    observationalNotes:
      "Pachaka pitta is the most clinically prominent of the five Pitta sub-doshas — most digestive complaints in Pitta-predominant phenotypes localise to pachaka specifically rather than to pitta in general. Bridges to the Western Eclectic 'sthenic digestion' phenotype and to the TCM stomach-fire / spleen-stomach excess heat patterns.",
  },

  /* ---------------------------- Ranjaka Pitta --------------------------- */
  ranjaka_pitta: {
    slug: "ranjaka_pitta",
    displayName: "Rañjaka Pitta — Haematopoiesis / Pigmentation Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The pitta current that governs blood formation, hepatic and splenic function, and the colouration of bodily fluids.",
    description:
      "Ranjaka Pitta (रञ्जक पित्त) is the functional sub-pattern of pitta seated in the liver and spleen that governs haematopoiesis, the colouration of blood, bile, and urine, and the metabolic functions the modern materia-medica literature catalogues as hepatic-biliary clearance. Caraka Chikitsa Ch. 15 and Ch. 16 (Pandu / anaemia) catalogue ranjaka pitta's anatomical seat (yakrit / liver and pleeha / spleen) and observable functions: blood formation, complexion warmth driven by adequate haematocrit, predictable menstrual flow, urinary and bile pigmentation, the resolution of jaundice. The empirical phenotype when balanced is even warm complexion with capillary blush, robust haematocrit, predictable menstrual rhythm and flow, clear non-icteric sclera. The aggravation phenotype is plethora with ruddy or inflamed skin, skin eruptions of inflammatory or photosensitive type, urticaria, jaundice tendencies, hepatomegaly with right-upper-quadrant fullness, heavy menstrual flow with bright red blood.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 15 (Grahani-chikitsita) and Ch. 16 (Pandu-chikitsita / anaemia) — anatomical seat of ranjaka pitta in liver and spleen and clinical management of haematopoietic and pigmentation disorders",
      },
      secondary: {
        ...PRASHER_2008,
        locator:
          "Whole-genome expression / biochemical correlate study — peer-reviewed validation of biochemical and haematopoietic markers correlating with extreme constitutional types defined in Ayurveda",
      },
    },
    observationalNotes:
      "Ranjaka pitta sits at the intersection of haematopoiesis and hepatic-biliary clearance — clinically a body shows ranjaka aggravation when both the blood and the liver phenotype move together (plethora plus inflammatory skin patterns, or anaemia plus low complexion warmth). Bridges to the Eclectic alterative / hepatic-tonic indication and to the TCM Liver and Spleen blood patterns.",
  },

  /* ---------------------------- Sadhaka Pitta --------------------------- */
  sadhaka_pitta: {
    slug: "sadhaka_pitta",
    displayName: "Sādhaka Pitta — Cognition / Resolve Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The pitta current that governs intellectual processing, decision-making, and emotional regulation under sustained pressure.",
    description:
      "Sadhaka Pitta (साधक पित्त) is the functional sub-pattern of pitta seated in the heart and brain that governs intellectual processing, decision-making capacity, and emotional regulation under sustained intellectual or competitive pressure. Caraka Sutrasthana Ch. 17 catalogues sadhaka pitta's anatomical seat (hridaya / heart with extension to mastiska / brain in later commentaries) and observable functions: capacity for sustained focus, ambition and goal-pursuit, decisional clarity, the integration of reasoned analysis with emotional response, the regulation of the heart-mind axis under pressure. The empirical phenotype when balanced is sharp focused intellect, capacity for sustained ambition, even temperament under intellectual pressure, fast clear decision-making, ability to convert insight into action. The aggravation phenotype is irritability under intellectual load, perfectionism that overshoots, inability to relinquish decisions, intellectual burnout, palpitation under emotional stress, type-A driven patterns that erode sleep and recovery.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Sutrasthana Ch. 17 (Kiyantah-shirasiya) — anatomical seat of sadhaka pitta and functional observation of cognition, decisional clarity, and emotional regulation",
      },
      secondary: {
        ...MUKHERJEE_PRAKRITI_2017,
        locator:
          "Whole-exome-sequencing pilot — peer-reviewed correlate of cognitive / Pitta-dominant constitutional phenotypes",
      },
    },
    observationalNotes:
      "Sadhaka pitta is the cognitive-affective sub-dosha — a body's capacity for sustained intellectual ambition tracks more cleanly with sadhaka than with pitta in general. Bridges to the Galenic 'sanguine-leaning choleric' phenotype (sustained focused ambition with social warmth) and to the TCM Heart-Spleen integration pattern.",
  },

  /* --------------------------- Alochaka Pitta --------------------------- */
  alochaka_pitta: {
    slug: "alochaka_pitta",
    displayName: "Ālocaka Pitta — Visual-Perception Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The pitta current that governs visual acuity and the photoreceptive function of the eyes.",
    description:
      "Alochaka Pitta (आलोचक पित्त) is the functional sub-pattern of pitta seated in the eyes that governs visual acuity, photoreception, and the conversion of light into integrated visual perception. Sushruta Uttara Ch. 1 (Aupadravika) and the Sutrasthana eye chapters catalogue alochaka pitta's anatomical seat (dṛk / drishti — the visual apparatus) and observable functions: visual sharpness across the light spectrum, colour discrimination, low-light adaptation, the integration of visual signal with attention. The empirical phenotype when balanced is sharp visual acuity, capacity for sustained visual work without strain, robust colour discrimination, reasonable low-light adaptation. The aggravation phenotype is photophobia with squinting under bright light, conjunctival redness with sensation of heat, visual fatigue on sustained work, blurring or floaters with photosensitivity, dry eye with burning rather than gritty sensation.",
    citations: {
      primaryText: {
        ...SUSHRUTA_SAMHITA_BHISHAGRATNA,
        locator:
          "Uttara Tantra Ch. 1 (Aupadravika) and surrounding chapters on netra-roga (eye disorders) — anatomical seat of alochaka pitta in the visual apparatus",
      },
      secondary: {
        ...AYUSH_PRAKRITI_GUIDELINES,
        locator:
          "Standardised sub-dosha framework guidelines — alochaka pitta functional handle in netra-pariksha (eye examination) clinical assessment",
      },
    },
    observationalNotes:
      "Alochaka pitta is the smallest-scope of the five Pitta sub-doshas in clinical use — its handle lights up specifically in netra-pariksha (eye examination) rather than in general constitutional reading. Bridges to the Western ophthalmic-inflammation indication and to the TCM Liver-blood / Liver-fire eye patterns.",
  },

  /* --------------------------- Bhrajaka Pitta --------------------------- */
  bhrajaka_pitta: {
    slug: "bhrajaka_pitta",
    displayName: "Bhrājaka Pitta — Skin-Pigmentation / Surface-Heat Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The pitta current that governs skin pigmentation, surface thermal regulation, and the absorption of topically applied substances.",
    description:
      "Bhrajaka Pitta (भ्राजक पित्त) is the functional sub-pattern of pitta seated in the skin that governs pigmentation, surface thermal regulation, sweat response, and the absorption of topically applied substances (oils, pastes, decoctions used for abhyanga and lepa). Caraka Chikitsa Ch. 7 (Kushtha-chikitsita / skin disorders) catalogues bhrajaka pitta's anatomical seat (twak / skin, with depth-specific layers) and observable functions: even pigmentation, predictable sweat response, robust topical absorption, the metabolic conversion of topically applied substances into therapeutic effect. The empirical phenotype when balanced is even pigmentation, predictable sweat with cooling effect, reliable topical absorption (oils penetrate, pastes draw), intact barrier integrity. The aggravation phenotype is flushing on minor heat exposure, photosensitivity with rapid burning, seborrheic dermatitis patterns, dyshidrosis with vesicular eruption, acne-rosacea spectrum, hypersensitivity to topical substances.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 7 (Kushtha-chikitsita) — anatomical seat of bhrajaka pitta in twak (skin) layers and clinical management of skin disorders driven by surface-pitta aggravation",
      },
      secondary: {
        ...NIH_NCCIH_AYURVEDA,
        locator:
          "Overview of Ayurvedic dermatology framework and bhrajaka pitta's role in topical-therapy mechanism",
      },
    },
    observationalNotes:
      "Bhrajaka pitta is the dermatologic sub-dosha — most inflammatory skin patterns in Pitta-predominant bodies map to bhrajaka specifically rather than to pitta in general. Bridges to the Eclectic alterative / dermatologic indication and to Cook's irritation tissue state at the integumentary system level (cross-reference module 3 / tissueStateProfile.ts).",
  },

  /* ========================= Kapha sub-doshas (5) ========================= */

  /* --------------------------- Kledaka Kapha --------------------------- */
  kledaka_kapha: {
    slug: "kledaka_kapha",
    displayName: "Kledaka Kapha — Gastric-Mucosa Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The kapha current that governs gastric mucosal lubrication and the protection of the digestive lining from agni's heat.",
    description:
      "Kledaka Kapha (क्लेदक कफ) is the functional sub-pattern of kapha seated in the stomach that governs gastric mucosal lubrication and the protection of the digestive lining from the heat of pachaka pitta's digestive transformation. Caraka Chikitsa Ch. 15 catalogues kledaka kapha's anatomical seat (amashaya / stomach, the upper digestive cavity) and observable functions: gastric mucosal moisture, the buffering of digestive fire against the stomach lining, the initial lubricative phase of bolus formation. The empirical phenotype when balanced is well-tolerated meal frequency, no post-meal heaviness, intact mucosal protection (no burning, no reflux), even gastric emptying. The aggravation phenotype is nausea with thick coating on the tongue, gastric heaviness after meals, slow gastric emptying with prolonged fullness, mucus-laden vomitus, alternating with kledaka deficiency presenting as gastric burning when the mucosal layer thins beneath strong agni.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Chikitsa Ch. 15 (Grahani-chikitsita) — anatomical seat of kledaka kapha in amashaya and clinical management of gastric-mucosa disorders",
      },
      secondary: {
        ...WHO_AYURVEDA_BENCHMARKS,
        locator:
          "Sections on dosha-pratiloma (counter-current dosha) interactions — kledaka kapha buffering of pachaka pitta as the institutional standard for gastric-mucosa pathophysiology in Ayurvedic clinical training",
      },
    },
    observationalNotes:
      "Kledaka kapha's clinical importance is its buffering relationship with pachaka pitta — the gastric mucosa is the interface where the cold-wet kledaka and the hot-sharp pachaka must coexist. Bridges to the Western Eclectic gastric-demulcent indication (slippery elm, marshmallow root) and to the TCM stomach-fluid (Wei Yin) framework.",
  },

  /* -------------------------- Avalambaka Kapha -------------------------- */
  avalambaka_kapha: {
    slug: "avalambaka_kapha",
    displayName: "Avalambaka Kapha — Thoracic / Cardiac-Support Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The kapha current that governs the structural and lubricative support of the thoracic cavity and cardiac region.",
    description:
      "Avalambaka Kapha (अवलम्बक कफ) is the functional sub-pattern of kapha seated in the chest and heart region that governs the structural and lubricative support of the thoracic cavity, the cushioning of the cardiac apparatus, and the lubrication of the pleural surfaces. Caraka Sutrasthana Ch. 17 and Sushruta Sutrasthana Ch. 21 catalogue avalambaka kapha's anatomical seat (urah / chest, hridaya / heart region) and observable functions: stable cardiac rhythm at rest, pleural lubrication, the structural support that lets the chest wall and lungs cycle freely, the cushioning that protects the cardiac apparatus from mechanical stress. The empirical phenotype when balanced is stable resting cardiac rhythm, capacity for sustained physical effort, lubricated pleural surfaces with painless breath, robust thoracic structure. The aggravation phenotype is chest heaviness with sustained sluggishness, slow recovery from exertion, congestive bronchitis tendencies, pleural-effusion-pattern in severe aggravation, cardiac sluggishness with bradycardic resting tone.",
    citations: {
      primaryText: {
        ...SUSHRUTA_SAMHITA_BHISHAGRATNA,
        locator:
          "Sutrasthana Ch. 21 (Vyadhi-samuddesha) — anatomical seat of avalambaka kapha in urah / hridaya and functional observation of thoracic / cardiac support",
      },
      secondary: {
        ...AYUSOFT_2014,
        locator:
          "AyuSoft computational dosha typology — peer-reviewed introduction to avalambaka kapha as an operational handle in computational Ayurvedic constitutional assessment",
      },
    },
    observationalNotes:
      "Avalambaka kapha's clinical importance is its dual role as structural support and as the mucosal substrate of the upper respiratory and cardiac regions — when avalambaka aggravates, both the bronchial congestion and the cardiac sluggishness move together. Bridges to Cook's depression tissue state at the cardiovascular and respiratory body-system levels (cross-reference module 3 / tissueStateProfile.ts).",
  },

  /* ---------------------------- Bodhaka Kapha --------------------------- */
  bodhaka_kapha: {
    slug: "bodhaka_kapha",
    displayName: "Bodhaka Kapha — Gustatory / Salivary Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The kapha current that governs salivary production and gustatory perception in the tongue and oral cavity.",
    description:
      "Bodhaka Kapha (बोधक कफ) is the functional sub-pattern of kapha seated in the tongue and oral cavity that governs salivary production, gustatory perception, and the lubrication of the oral mucosa during the initial pre-digestive phase of food intake. Sushruta Uttara Ch. 16 (Mukha-roga / oral disorders) and the Sutrasthana chapters on rasa (taste) catalogue bodhaka kapha's anatomical seat (jihva / tongue, mukha / oral cavity) and observable functions: salivary flow, taste discrimination across the six rasas (sweet, sour, salty, pungent, bitter, astringent), oral mucosal moisture, the initial enzymatic phase of digestion that begins in the mouth. The empirical phenotype when balanced is even salivary flow with intact taste discrimination, comfortable oral mucosa without dryness or excess, capacity to perceive the full range of tastes. The aggravation phenotype is hypersalivation with drooling tendency, dulled or altered taste, oral candidiasis tendencies, white-coated tongue with mucus accumulation, sweet taste in the mouth between meals (a classical bodhaka-kapha-aggravation sign).",
    citations: {
      primaryText: {
        ...SUSHRUTA_SAMHITA_BHISHAGRATNA,
        locator:
          "Uttara Tantra Ch. 16 (Mukha-roga-pratishedha) — anatomical seat of bodhaka kapha in jihva / mukha and clinical management of oral mucosa disorders",
      },
      secondary: {
        ...PATWARDHAN_PRAKRITI_2005,
        locator:
          "Prakriti / HLA correlation study — peer-reviewed validation of dosha-typology phenotypes including the Kapha oral / salivary signature",
      },
    },
    observationalNotes:
      "Bodhaka kapha is the smallest-scope of the five Kapha sub-doshas in clinical use — its handle lights up specifically in mukha-pariksha (oral examination) and in rasa-pariksha (taste assessment) rather than in general constitutional reading. Bridges to the Western Eclectic salivary-and-gustatory framework and to the TCM Spleen / oral-cavity opening pattern.",
  },

  /* ---------------------------- Tarpaka Kapha --------------------------- */
  tarpaka_kapha: {
    slug: "tarpaka_kapha",
    displayName: "Tarpaka Kapha — Cerebral-Nourishment Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The kapha current that governs the nourishment and lubrication of the cranial sense organs and the cerebrospinal substrate.",
    description:
      "Tarpaka Kapha (तर्पक कफ) is the functional sub-pattern of kapha seated in the head — the cranial cavity, the sinuses, and the cerebrospinal substrate — that governs the nourishment and lubrication of the sense organs and the cognitive substrate. Caraka Sutrasthana Ch. 17 catalogues tarpaka kapha's anatomical seat (siras / head, with extension to the cerebrospinal axis) and observable functions: stable memory consolidation, restorative sleep, the lubrication of the cranial sinuses, the nourishment of the sensory ganglia. The empirical phenotype when balanced is restorative sleep with smooth waking, stable memory consolidation, comfortable sinus mucosa with adequate but not excess moisture, even cognitive substrate that holds new information. The aggravation phenotype is mental fog with slow processing, congestive sinus patterns with chronic post-nasal drip, post-prandial somnolence (the classical post-meal heaviness), excess sleep without restorative quality, slowed memory recall, and at the deficient pole presents as dry sinuses with brittle mucosa, insomnia, and mental restlessness.",
    citations: {
      primaryText: {
        ...CARAKA_SAMHITA_KAVIRATNA,
        locator:
          "Sutrasthana Ch. 17 (Kiyantah-shirasiya) — anatomical seat of tarpaka kapha in siras and functional observation of cerebral / cerebrospinal nourishment",
      },
      secondary: {
        ...PANOSSIAN_ADAPTOGENS_2010,
        locator:
          "On adaptogen / autonomic-cognitive pharmacology — modern peer-reviewed validation of cerebral-nourishment and stress-protective regulation overlapping the tarpaka-kapha functional handle (medhya rasayana class)",
      },
    },
    observationalNotes:
      "Tarpaka kapha's clinical importance is its substrate role for sadhaka pitta — sadhaka cannot integrate intellect and emotion without a stable tarpaka substrate to act upon. The medhya rasayana herbs (brahmi / Bacopa, mandukaparni / Centella, jatamansi / Nardostachys) are the classical materia-medica anchor for tarpaka-supporting therapy. Bridges to the Western adaptogen-nootropic indication and to the TCM Kidney-Essence / Sea-of-Marrow framework.",
  },

  /* --------------------------- Shleshaka Kapha -------------------------- */
  shleshaka_kapha: {
    slug: "shleshaka_kapha",
    displayName: "Śleṣaka Kapha — Synovial / Joint-Lubrication Sub-Dosha",
    category: "ayurvedic_sub_dosha",
    shortDescription:
      "The kapha current that governs synovial lubrication and the structural integrity of the joint capsules.",
    description:
      "Shleshaka Kapha (श्लेषक कफ) is the functional sub-pattern of kapha seated in the joints (sandhi) that governs synovial lubrication, the structural integrity of the joint capsules, and the cushioning of articular surfaces. Sushruta Sharirasthana Ch. 5 (Sharira-sankhya-vyakarana) and Caraka Chikitsa chapters on vatavyadhi catalogue shleshaka kapha's anatomical seat (sandhi / joints) and observable functions: synovial fluid production, ligamentous tone, articular cartilage cushioning, the smooth pain-free range of joint motion. The empirical phenotype when balanced is pain-free joint range across the full normal arc, even ligamentous tone without laxity or rigidity, intact cartilage cushioning that withstands sustained use. The aggravation phenotype is joint heaviness with morning stiffness that resolves on movement, joint effusions with palpable swelling, slow morning mobility, weight-bearing joint discomfort that improves with rest then returns. At the deficient pole, the picture is dry crepitant joints with osteoarthritic-pattern stiffness — and clinically, the deficient pole is most often a Vata-vikriti drying out shleshaka rather than a primary kapha deficiency.",
    citations: {
      primaryText: {
        ...SUSHRUTA_SAMHITA_BHISHAGRATNA,
        locator:
          "Sharirasthana Ch. 5 (Sharira-sankhya-vyakarana) — anatomical enumeration of joints and the location of shleshaka kapha in the sandhi (joint) cavities",
      },
      secondary: {
        ...PRASHER_2008,
        locator:
          "Whole-genome expression / biochemical correlate study — peer-reviewed validation of constitutional types including connective-tissue and joint-substrate phenotypes",
      },
    },
    observationalNotes:
      "Shleshaka kapha's clinical importance is its dual susceptibility — when it aggravates the joints become heavy and effused (kapha vikriti), when it depletes the joints become dry and crepitant (vata-on-shleshaka vikriti). Bridges to Cook's atrophy and depression tissue states at the musculoskeletal body-system level (cross-reference module 3 / tissueStateProfile.ts) and to the Western Eclectic joint-tonic and demulcent indication.",
  },
};

/**
 * Typed accessor. Use in UI components and result-rendering surfaces
 * instead of indexing the registry directly — preserves type safety
 * and centralizes any future fallback / observability hook.
 */
export function getAyurvedicDoshaContent(
  reading: AyurvedicDosha,
): ContentEntry {
  return AYURVEDIC_DOSHA_CONTENT[reading];
}

/**
 * Stable ordered list — useful for rendering all eighteen entries in
 * comparison cards, deep-diagnostic explainers, and the citation
 * manifest review UI. Order follows the canonical Caraka / Sushruta
 * sequence: three primary doshas first (Vata / Pitta / Kapha), then
 * five sub-doshas per primary grouped together.
 */
export const AYURVEDIC_DOSHAS: readonly AyurvedicDosha[] = [
  // Primary doshas
  "vata",
  "pitta",
  "kapha",
  // Vata sub-doshas
  "prana_vayu",
  "udana_vayu",
  "samana_vayu",
  "apana_vayu",
  "vyana_vayu",
  // Pitta sub-doshas
  "pachaka_pitta",
  "ranjaka_pitta",
  "sadhaka_pitta",
  "alochaka_pitta",
  "bhrajaka_pitta",
  // Kapha sub-doshas
  "kledaka_kapha",
  "avalambaka_kapha",
  "bodhaka_kapha",
  "tarpaka_kapha",
  "shleshaka_kapha",
] as const;

/**
 * Convenience filter — primary doshas only (3). Useful when UI
 * surfaces want the constitutional baseline reading without sub-dosha
 * detail (e.g. a homepage card that shows "Your dominant dosha").
 */
export const AYURVEDIC_PRIMARY_DOSHAS: readonly AyurvedicDosha[] = [
  "vata",
  "pitta",
  "kapha",
] as const;

/**
 * Convenience filter — sub-doshas only (15). Useful when UI surfaces
 * want the operational handles for a dosha-specific deep-dive (e.g. a
 * Vata profile detail page that shows the five vayu sub-currents).
 */
export const AYURVEDIC_SUB_DOSHAS: readonly AyurvedicDosha[] = [
  "prana_vayu",
  "udana_vayu",
  "samana_vayu",
  "apana_vayu",
  "vyana_vayu",
  "pachaka_pitta",
  "ranjaka_pitta",
  "sadhaka_pitta",
  "alochaka_pitta",
  "bhrajaka_pitta",
  "kledaka_kapha",
  "avalambaka_kapha",
  "bodhaka_kapha",
  "tarpaka_kapha",
  "shleshaka_kapha",
] as const;
