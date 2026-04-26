/**
 * src/lib/vitalForce.ts
 *
 * LAYER 4 of the DiagnosticProfile — Vital Force readings.
 *
 * Three readings: sthenic, balanced, asthenic. The terminology is canonical
 * in the Eclectic and Physiomedical traditions: Felter (1922) names the
 * sthenic / asthenic distinction in his materia medica; Cook (1869)
 * frames the underlying vital-force doctrine in the Physio-Medical
 * Dispensatory.
 *
 * Per Locked Decision §0.8 #14, the Holy Spirit is named theologically as
 * the source of vital force, surfaced via src/components/landing/
 * WorldviewBand.tsx. This module describes the empirical readings of
 * vital-force expression — sthenic excess, dynamic balance, asthenic
 * depletion — without theological attribution to any cosmological agent.
 *
 * Per Locked Decision §0.8 #43 (dual-source clinical citation), every
 * entry in this module carries BOTH a public-domain primary-text source
 * AND an industry best-practice secondary cross-reference. The dual-
 * source rigor is the gate; per Lock #45 (clinical authority boundary),
 * authoring proceeds against this gate without per-claim founder review.
 *
 * Per Locked Decision §0.8 #44 (classical-tradition observation IN,
 * theological attribution OUT), each reading carries cross-tradition
 * observations from TCM (yang-excess / yin-yang harmony / qi-deficiency
 * patterns) and Ayurveda (Pitta-vikriti / samya-prakriti / ojas-kshaya).
 * Observations are attribution-stripped: the body's presentation is
 * preserved; karma-, qi-as-cosmic-Tao-, and prana-as-Brahman-style
 * etiology is excluded.
 *
 * Plan reference: Phase_B_Authoring_Plan_v1.md §source-availability
 * check / vitalForce.ts. This is the smallest of the five Phase B
 * content modules and establishes the canonical ContentEntry shape
 * (defined in src/lib/contentEntry.ts) for the four larger modules
 * that follow: galenicTemperament.ts, tissueStateProfile.ts,
 * tcmConstitution.ts, ayurvedicDosha.ts.
 */

import type { VitalForce } from "./diagnosticProfile";
import type {
  ContentEntry,
  ContentEntryRegistry,
  PrimaryTextCitation,
} from "./contentEntry";

/* ----------------- Shared primary-text source anchors ----------------- */
/* DRY: the same Felter / Cook / Huangdi Neijing / Caraka Samhita        */
/* anchors are referenced from multiple entries. Defining them once at   */
/* module top keeps the entry rows readable and lets a citation-         */
/* enrichment pass (excerpts, deeper locators) update one place.         */

const FELTER_1922: Omit<PrimaryTextCitation, "locator"> = {
  author: "Felter, H. W.",
  title: "The Eclectic Materia Medica, Pharmacology and Therapeutics",
  year: 1922,
  url: "https://www.henriettes-herb.com/eclectic/felter/",
};

const COOK_1869: Omit<PrimaryTextCitation, "locator"> = {
  author: "Cook, W. H.",
  title: "The Physio-Medical Dispensatory",
  year: 1869,
  url: "https://www.henriettes-herb.com/eclectic/cook/",
};

const HUANGDI_NEIJING: Omit<PrimaryTextCitation, "locator"> = {
  author: "Anonymous (compiled c. 100 BCE)",
  title: "Huangdi Neijing — Suwen (Basic Questions)",
  // The Suwen text predates 1928 by approximately two millennia; the
  // year field records the approximate compilation date of the received
  // text. Pre-1928 partial English translations are patchy; the Chinese
  // Text Project hosts the canonical Chinese with parallel translation.
  year: -100,
  url: "https://ctext.org/huangdi-neijing",
};

const CARAKA_SAMHITA_KAVIRATNA: Omit<PrimaryTextCitation, "locator"> = {
  author: "Agnivesa; trans. Avinash Chandra Kaviratna",
  title: "The Charaka-Samhita (English translation)",
  year: 1890,
  url: "https://archive.org/details/charakasamhitao01agnigoog",
};

/* ------------------------- The three readings ------------------------- */

/**
 * Registry keyed by the canonical VitalForce union from
 * src/lib/diagnosticProfile.ts ("sthenic" | "balanced" | "asthenic").
 *
 * Each entry conforms to the ContentEntry shape from
 * src/lib/contentEntry.ts: dual-source citations per Lock #43;
 * cross-tradition observations per Lock #44; attribution-stripped
 * framing throughout.
 */
export const VITAL_FORCE_CONTENT: ContentEntryRegistry<VitalForce> = {
  /* ------------------------------- Sthenic ----------------------------- */
  sthenic: {
    slug: "sthenic",
    displayName: "Sthenic",
    category: "vital_force",
    shortDescription:
      "Your vital force is running strong and high — the body responds quickly, with intensity, and sometimes more than the situation calls for.",
    description:
      "Sthenic states are characterized by an excess of vital action: hyperreactive tissue tone, elevated arterial tension, sharp febrile response, and a quick, full pulse. Felter (1922) describes sthenic conditions as those in which the vital force is in surplus and circulation is overstrong — the indication is sedating, cooling, and relaxing rather than stimulating. Cook (1869) frames the same picture under the Physiomedical doctrine of vital-force excess: tissues braced, secretions held, and inflammation tending to acuteness rather than depletion. Modern clinical literature on sympathetic-dominant phenotypes and the role of nervine relaxants and bitter-cooling herbs aligns with this picture. Sthenic terrain calls for restoration toward equilibrium, not reinforcement of the existing surplus.",
    citations: {
      primaryText: {
        ...FELTER_1922,
        locator:
          "Therapeutics — sthenic conditions; indications for sedating and relaxing agents",
      },
      secondary: {
        kind: "nih",
        title:
          "Herbal Medicine: Biomolecular and Clinical Aspects (2nd ed.) — Integration of Herbal Medicine into Evidence-Based Clinical Practice",
        author: "Wachtel-Galor, S.; Benzie, I. F. F.",
        year: 2011,
        identifier: "NBK92760",
        url: "https://www.ncbi.nlm.nih.gov/books/NBK92760/",
        locator:
          "Constitutional / terrain framing within evidence-based herbal practice",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_physiomedical",
        pattern: "Vital-force excess (Cook)",
        observation:
          "Cook describes the same phenotype within Physiomedical doctrine: hyperreactive tissue, sustained arterial tension, secretions held under pressure. The therapeutic indication is relaxation and elimination, not stimulation.",
        citation: {
          ...COOK_1869,
          locator: "On the vital force and its excess; sedating indications",
        },
      },
      {
        tradition: "tcm",
        pattern: "Yang Excess / Repletion-Heat (实热, shi re)",
        observation:
          "TCM observation: a body presenting with strong, full, rapid pulse; red tongue with yellow coating; restlessness; sensation of heat; constipation with hard stool; concentrated dark urine. The clinical picture overlaps the Western sthenic reading at the level of palpable presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — pulse and tongue diagnostics for repletion-heat patterns",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Pitta vikriti (Pitta in excess)",
        observation:
          "Ayurvedic observation: a body presenting with elevated heat, sharp digestive fire, inflammatory tissue tendencies, irritability, and high-strung reactivity. The clinical picture overlaps the Western sthenic reading at the level of palpable presentation; the Caraka Samhita's description of Pitta-excess phenotype is empirically continuous with Felter's sthenic.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana — descriptions of Pitta-dominant and Pitta-aggravated states",
        },
      },
    ],
    observationalNotes:
      "Sthenic excess and constitutional Hot/Tense Eden Patterns frequently co-present; the vital-force reading qualifies the Pattern with respect to overall vital surplus vs. balance vs. depletion, not to terrain axes directly.",
  },

  /* ------------------------------ Balanced ---------------------------- */
  balanced: {
    slug: "balanced",
    displayName: "Balanced",
    category: "vital_force",
    shortDescription:
      "Your vital force is in good proportion right now — strong enough to respond, restrained enough not to overshoot. This is the working middle of health.",
    description:
      "The balanced reading describes vital force in dynamic equilibrium: tissues responsive but not hyperreactive, pulse full and regular, secretions appropriate to demand, and recovery from acute insult prompt and complete. Felter (1922) treats this state implicitly as the absence of dyskrasia — the working norm against which sthenic and asthenic deviations are measured. Cook (1869) describes the same condition as the vital force expressing in proper proportion to the body's physiological tasks. Modern phytotherapy literature recognizes this state as the goal of constitutional prescribing — the terrain at which adaptogens, tonics, and constitutional herbs are seeking to maintain rather than to correct.",
    citations: {
      primaryText: {
        ...FELTER_1922,
        locator:
          "General therapeutics — health as the absence of dyskrasia; the terrain at which prescribing aims",
      },
      secondary: {
        kind: "who_monograph",
        title:
          "WHO Traditional Medicine Strategy 2014-2023 — constitutional and holistic frameworks in traditional medicine practice",
        author: "World Health Organization",
        year: 2013,
        identifier: "9789241506096",
        url: "https://www.who.int/publications/i/item/9789241506096",
        locator:
          "Sections on constitutional prescribing and dynamic-equilibrium models in traditional medicine systems worldwide",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_physiomedical",
        pattern: "Vital force in proper proportion (Cook)",
        observation:
          "Cook frames the balanced state as the vital force expressing in proportion to the body's physiological tasks — neither overstrong nor depleted. The indication is maintenance: nourishing, stabilizing, and protective herbs rather than corrective ones.",
        citation: {
          ...COOK_1869,
          locator: "On the vital force and its proper proportion",
        },
      },
      {
        tradition: "tcm",
        pattern: "Yin-Yang Harmony (阴阳平衡, yin yang ping heng)",
        observation:
          "TCM observation: a body presenting with regulated pulse and tongue, balanced thermoregulation, normal sleep-wake rhythm, regular elimination, and prompt recovery from minor stressors. The Suwen describes this as the state of dynamic equipoise between yin and yang functions — empirically continuous with the Western balanced reading.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — descriptions of the harmonious state and pulse / tongue baselines",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Samya prakriti (dosha in equilibrium)",
        observation:
          "Ayurvedic observation: a body in which the three doshas express in their proper proportions for the individual's constitutional type, with strong agni (digestive fire), regular elimination, stable mental clarity, and resilient sleep. The Caraka Samhita describes samya prakriti as the maintenance terrain — empirically continuous with the Western balanced reading.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Vimanasthana 8 — description of samya prakriti and the maintained constitutional state",
        },
      },
    ],
    observationalNotes:
      "The balanced reading is the rarest in clinical practice — most assessments fall sthenic or asthenic at presentation. When a balanced reading is recorded, the Layer 1-3 readings (Eden Pattern, temperament, tissue states) describe the constitutional baseline rather than an active terrain disturbance.",
  },

  /* ------------------------------ Asthenic ---------------------------- */
  asthenic: {
    slug: "asthenic",
    displayName: "Asthenic",
    category: "vital_force",
    shortDescription:
      "Your vital force is running low — the body's responses are slow, weak, or incomplete, and reserves feel depleted.",
    description:
      "Asthenic states are characterized by a deficiency of vital action: weak and slow pulse, low arterial tension, blunted febrile response, sluggish circulation, and incomplete recovery from physiological stress. Felter (1922) describes asthenic debility as the canonical indication for tonics, restoratives, and warming stimulants — the vital force being insufficient to drive the body's ordinary tasks. Cook (1869) frames the same picture as vital-force depletion, with tissues passing through depression and torpor toward atrophy. Modern phytotherapy literature on adaptogen pharmacology — particularly the homeostatic and stress-protective mechanisms documented for Rhodiola rosea, Eleutherococcus senticosus, Withania somnifera, and Schisandra chinensis — describes the molecular substrate of restoration from this state. Asthenic terrain calls for slow, sustained rebuilding rather than aggressive stimulation, which the depleted system cannot sustain.",
    citations: {
      primaryText: {
        ...FELTER_1922,
        locator:
          "Therapeutics — asthenic debility; indications for tonics, restoratives, and warming stimulants",
      },
      secondary: {
        kind: "pubmed",
        title:
          "Effects of Adaptogens on the Central Nervous System and the Molecular Mechanisms Associated with Their Stress-Protective Activity",
        author: "Panossian, A.; Wikman, G.",
        year: 2010,
        identifier: "10.3390/ph3010188",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3991026/",
        locator:
          "HPA-axis modulation; HSP70 / FOXO / JNK1 stress-protective pathways underlying adaptogen action on depleted vital reserves",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_physiomedical",
        pattern: "Vital-force depletion (Cook)",
        observation:
          "Cook describes the same phenotype within Physiomedical doctrine: tissues passing through depression and torpor toward atrophy as vital force fails to drive function. The therapeutic indication is restoration — sustained, gentle, and rebuilding — not aggressive stimulation that the depleted system cannot sustain.",
        citation: {
          ...COOK_1869,
          locator: "On vital-force depletion; tissue states of depression, torpor, and atrophy",
        },
      },
      {
        tradition: "tcm",
        pattern: "Qi Deficiency (气虚, qi xu)",
        observation:
          "TCM observation: a body presenting with weak, thin, slow pulse; pale tongue with thin coating; soft low voice; spontaneous sweating; chronic fatigue; pallor; loose stools; cold extremities. The clinical picture overlaps the Western asthenic reading at the level of palpable presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — pulse and tongue diagnostics for qi-deficiency patterns",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Ojas kshaya (depletion of vital essence)",
        observation:
          "Ayurvedic observation: a body presenting with low immunity, chronic exhaustion, weak agni, pallor, dry tissue, brittle hair and nails, and emotional fragility. The Caraka Samhita describes ojas-kshaya as the depletion phenotype — empirically continuous with the Western asthenic reading and with TCM qi-xu at the level of clinical presentation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana — description of ojas, its depletion, and the resulting clinical phenotype",
        },
      },
    ],
    observationalNotes:
      "Asthenic depletion frequently co-presents with constitutional Cold/Relaxed Eden Patterns (especially The Spent Candle and The Still Water); the vital-force reading qualifies the Pattern with respect to overall reserve depletion. Aggressive stimulation of an asthenic terrain commonly worsens it — slow restoration is the indicated direction.",
  },
};

/**
 * Typed accessor. Use in UI components and result-rendering surfaces
 * instead of indexing the registry directly — preserves type safety
 * and centralizes any future fallback / observability hook.
 */
export function getVitalForceContent(reading: VitalForce): ContentEntry {
  return VITAL_FORCE_CONTENT[reading];
}

/**
 * Stable ordered list — useful for rendering all three readings in
 * comparison cards, deep-diagnostic explainers, and the citation
 * manifest review UI.
 */
export const VITAL_FORCE_READINGS: readonly VitalForce[] = [
  "sthenic",
  "balanced",
  "asthenic",
] as const;
