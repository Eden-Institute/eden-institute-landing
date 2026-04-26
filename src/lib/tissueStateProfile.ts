/**
 * src/lib/tissueStateProfile.ts
 *
 * LAYER 3 of the DiagnosticProfile — Tissue State by Body System.
 *
 * This module ships PHASE 1 + PHASE 2 of Layer 3 content. Phase 1 (PR #31,
 * v3.20): the seven canonical Cook tissue-state descriptions and the six
 * priority body-system descriptions — thirteen registry entries total.
 * Phase 2 (this PR, v3.21): the 42 cell-level entries (one per (TissueState
 * × OrganSystem) combination) that describe how each state manifests in
 * each specific system. The phased ship matches the Phase_B_Authoring_Plan_v1.md
 * scope estimate of 2–3 sessions for the largest of the five Phase B modules.
 *
 * The seven tissue states are canonical in the Physiomedicalist tradition
 * Cook codified in The Physio-Medical Dispensatory (1869) and Felter
 * extended in The Eclectic Materia Medica (1922): depression, torpor,
 * atrophy, atony, excitation, irritation, constriction. The eighth slug
 * "mixed" on the TissueState union is a structural fall-back rather than
 * a discrete state and is not authored here.
 *
 * The six priority body systems are the canonical Apothecary scoping for
 * Layer 3: nervous, digestive, cardiovascular, respiratory, musculoskeletal,
 * integumentary. Cook treats each system as terrain with its own
 * physiological remit, characteristic tissue-state susceptibilities, and
 * indicated herb classes. Felter cross-references the same systems from
 * the Eclectic materia-medica side.
 *
 * Per Locked Decision §0.8 #14, the Holy Spirit is named theologically as
 * the source of vital force animating tissue function, surfaced via
 * src/components/landing/WorldviewBand.tsx. This module describes the
 * empirical readings of tissue-state expression and body-system terrain
 * without theological attribution to any cosmological agent.
 *
 * Per Locked Decision §0.8 #43 (dual-source clinical citation), every
 * entry carries BOTH a public-domain primary-text source AND an industry
 * best-practice secondary cross-reference. The dual-source rigor is the
 * gate; per Lock #45 (clinical authority boundary), authoring proceeds
 * against this gate without per-claim founder review.
 *
 * Per Locked Decision §0.8 #44 (classical-tradition observation IN,
 * theological attribution OUT), each entry carries cross-tradition
 * observations from TCM (zang-fu correspondence per body system; Eight-
 * Principle pattern overlays per tissue state) and Ayurveda (sapta-dhatu
 * — the seven tissues — per body system; tissue-state correspondences
 * per dosha vikriti). Observations are attribution-stripped: the body's
 * presentation is preserved; karma-, qi-as-cosmic-Tao-, and prana-as-
 * Brahman-style etiology is excluded.
 *
 * Plan reference: Phase_B_Authoring_Plan_v1.md §source-availability
 * check / tissueStateProfile.ts. This is module 3 of 5 (phase 1 of 2);
 * pattern follows src/lib/vitalForce.ts (module 1) and
 * src/lib/galenicTemperament.ts (module 2) and consumes the canonical
 * ContentEntry shape from src/lib/contentEntry.ts.
 */

import type { OrganSystem, TissueState } from "./diagnosticProfile";
import type {
  ContentEntry,
  ContentEntryRegistry,
  PrimaryTextCitation,
  SecondaryCitation,
} from "./contentEntry";

/* ----------------- Shared primary-text source anchors ----------------- */

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

const HUANGDI_NEIJING: Omit<PrimaryTextCitation, "locator"> = {
  author: "Anonymous (compiled c. 100 BCE)",
  title: "Huangdi Neijing — Suwen (Basic Questions)",
  year: -100,
  url: "https://ctext.org/huangdi-neijing",
};

const CARAKA_SAMHITA_KAVIRATNA: Omit<PrimaryTextCitation, "locator"> = {
  author: "Agnivesa; trans. Avinash Chandra Kaviratna",
  title: "The Charaka-Samhita (English translation)",
  year: 1890,
  url: "https://archive.org/details/charakasamhitao01agnigoog",
};

/* ----------------- Shared industry-secondary anchors ------------------ */

const MILLS_BONE_CH3: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Principles and Practice of Phytotherapy: Modern Herbal Medicine (2nd ed.) — Chapter 3, Approaches to Treatment",
  author: "Mills, S.; Bone, K.",
  year: 2013,
  identifier: "ISBN 978-0-443-06992-5",
  url: "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5",
};

const HOFFMANN_MEDICAL_HERBALISM: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Medical Herbalism: The Science and Practice of Herbal Medicine — Tissue States and the Western Energetic Tradition",
  author: "Hoffmann, D.",
  year: 2003,
  identifier: "ISBN 978-0-89281-749-8",
  url: "https://www.innertraditions.com/books/medical-herbalism",
};

const AHPA_BOTANICAL_SAFETY: Omit<SecondaryCitation, "locator"> = {
  kind: "ahpa_safety",
  title:
    "American Herbal Products Association Botanical Safety Handbook (2nd ed.)",
  author: "American Herbal Products Association",
  year: 2013,
  identifier: "ISBN 978-1-4665-1694-1",
  url: "https://www.ahpa.org/Resources/Botanical-Safety-Handbook",
};

const NCCIH_HERBS_AT_A_GLANCE: Omit<SecondaryCitation, "locator"> = {
  kind: "nih",
  title:
    "Herbs at a Glance — National Center for Complementary and Integrative Health",
  author: "National Center for Complementary and Integrative Health (NIH)",
  year: 2020,
  identifier: "NCCIH",
  url: "https://www.nccih.nih.gov/health/herbsataglance",
};

/**
 * PubMed peer-reviewed review on adaptogen pharmacology and HPA-axis
 * modulation. Used as the secondary anchor for nervous-system cells where
 * the Cook / Felter framework's modern correlate is the adaptogen and HPA-
 * axis stress-response literature (depression, torpor, atrophy, atony of
 * the nervous system).
 */
const PANOSSIAN_ADAPTOGENS_2010: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "Effects of Adaptogens on the Central Nervous System and the Molecular Mechanisms Associated with Their Stress-Protective Activity",
  author: "Panossian, A.; Wikman, G.",
  year: 2010,
  identifier: "PMC4034123",
  url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4034123/",
};

/**
 * WHO Monographs on Selected Medicinal Plants Vol. 2, hawthorn (Crataegus)
 * monograph. Used as the secondary anchor for cardiovascular cells where
 * the Cook / Felter cardiac-tonic framework's modern correlate is the
 * hawthorn literature reviewed by WHO (depression, atrophy, excitation of
 * the cardiovascular system).
 */
const WHO_HAWTHORN_VOL2: Omit<SecondaryCitation, "locator"> = {
  kind: "who_monograph",
  title:
    "WHO Monographs on Selected Medicinal Plants — Vol. 2: Folium cum Flore Crataegi",
  author: "World Health Organization",
  year: 2002,
  identifier: "WHO/EDM/TRM/2002.1",
  url: "https://apps.who.int/iris/handle/10665/42052",
};

/* --------------------- Cook's seven tissue states --------------------- */

/**
 * Registry keyed by the seven authored slugs of the canonical TissueState
 * union from src/lib/diagnosticProfile.ts. The eighth slug "mixed" is a
 * structural fall-back and is not authored as a discrete state — clinical
 * presentations that mix multiple states render via the multi-cell layout
 * downstream rather than as a single "mixed" content entry.
 */
type AuthoredTissueState = Exclude<TissueState, "mixed">;

export const TISSUE_STATE_CONTENT: ContentEntryRegistry<AuthoredTissueState> = {
  /* ----------------------------- Depression ---------------------------- */
  depression: {
    slug: "depression",
    displayName: "Depression",
    category: "tissue_state",
    shortDescription:
      "Tissue function is running below par — slower, weaker, less responsive than the body's own baseline, but the structure itself is still intact.",
    description:
      "Cook (1869) defines depression as the tissue state in which vital action is diminished beneath the body's baseline without yet showing wasting or structural loss. The presentation is sluggishness: weaker contractile response, slower metabolic turnover, diminished glandular output, and incomplete recovery from physiological tasks the tissue ordinarily handles. Depression is the entry-state from which torpor and atrophy follow if the depleted vital force is not restored. Felter (1922) carries the framework forward and prescribes mild restoratives, gentle warming stimulants, and nourishing tonics — agents that lift function without overdriving a tissue that is already running below capacity.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On tissue states — depression as diminished vital action without structural loss",
      },
      secondary: {
        ...HOFFMANN_MEDICAL_HERBALISM,
        locator:
          "On the Cook / Physiomedical tissue-state framework and modern energetic-tradition reception",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Qi Deficiency at the tissue level (气虚, qi xu)",
        observation:
          "TCM observation: tissue presenting with low function, weak response, fatigue under demand, and slow recovery — without yet wasting or atrophying. Empirically continuous with Cook's depression at the level of clinical presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — patterns of qi-deficiency at the level of tissue and organ function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mild dhatu-dushti (tissue impairment) without dhatu-kshaya",
        observation:
          "Ayurvedic observation: tissue (dhatu) showing mild functional impairment without yet entering kshaya (depletion) — empirically continuous with Cook's depression. The Caraka Samhita Sutrasthana describes the spectrum of dhatu-dushti from mild functional decline through severe depletion.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — spectrum of dhatu impairment",
        },
      },
    ],
    observationalNotes:
      "Depression is the most common tissue-state reading at presentation in modern Western practice — the bulk of constitutional cases land here rather than in the deeper depletion states of torpor or atrophy. Slow restoration is the indicated direction; aggressive stimulation commonly worsens depression by overdriving an already weakened tissue.",
  },

  /* ------------------------------- Torpor ------------------------------ */
  torpor: {
    slug: "torpor",
    displayName: "Torpor",
    category: "tissue_state",
    shortDescription:
      "Tissue function has settled into sustained low gear — inertness, dullness, reduced reactivity over time, but still without structural wasting.",
    description:
      "Cook (1869) describes torpor as the tissue state in which depression has persisted long enough that the tissue is no longer merely below baseline but is settled into sustained inertness: dull reactivity, slow metabolic and circulatory turnover, secretions reduced and stagnant, and a generally low-amplitude physiological response. Torpor is more entrenched than depression but precedes the structural loss of atrophy. Felter (1922) prescribes warming diffusive stimulants combined with restoratives — capsicum, ginger, prickly ash with nourishing tonics — to break the inertness and lift the tissue back toward responsive function.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On tissue states — torpor as sustained low function without structural loss",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On modern phytotherapy reception of stimulant and warming-restorative protocols for depleted tissue",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Yang Deficiency (阳虚, yang xu)",
        observation:
          "TCM observation: tissue presenting with cold, slow, inert function, reduced responsiveness, dull pulse, pale tongue. Empirically continuous with Cook's torpor at the level of clinical presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — patterns of yang-deficiency at the level of tissue and organ function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Vata-Kapha samsarga at the dhatu level (cold-stagnant pattern)",
        observation:
          "Ayurvedic observation: tissue presenting with the cold-quality of Vata combined with the stagnant-quality of Kapha — slow, dull, inert function. The Caraka Samhita describes this as a recognized dhatu-dushti phenotype.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — Vata-Kapha samsarga at the tissue level",
        },
      },
    ],
  },

  /* ------------------------------ Atrophy ------------------------------ */
  atrophy: {
    slug: "atrophy",
    displayName: "Atrophy",
    category: "tissue_state",
    shortDescription:
      "Tissue is wasting — losing substance, mass, and structural integrity. Function is diminished AND the tissue itself is shrinking.",
    description:
      "Cook (1869) defines atrophy as the tissue state in which depression and torpor have progressed into structural loss: the tissue itself is shrinking, losing mass and substance, with diminished function plus diminished structure. Atrophy is the deepest of the three depletion states (depression → torpor → atrophy) and calls for the most patient, sustained restorative protocol. Felter (1922) prescribes nutritive tonics, mineral-rich nervines, slow rebuilders such as the trophorestoratives — agents that supply substrate for tissue rebuilding rather than merely stimulating function. Aggressive stimulation of atrophic tissue is commonly worse than no intervention; the tissue lacks the substrate to respond.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator: "On tissue states — atrophy as wasting and structural loss",
      },
      secondary: {
        ...HOFFMANN_MEDICAL_HERBALISM,
        locator:
          "On trophorestorative protocols and the modern reception of Cook's atrophy framework",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Yin Deficiency with atrophic features (阴虚, yin xu)",
        observation:
          "TCM observation: tissue presenting with substance loss, dryness, atrophic features, weak weak pulse, dry tongue with little coating. Empirically continuous with Cook's atrophy.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — patterns of yin-deficiency with atrophic features",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Dhatu-kshaya (tissue depletion) and ojas-kshaya",
        observation:
          "Ayurvedic observation: tissue (dhatu) showing kshaya — depletion of substance and structure, often paired with ojas-kshaya at the deepest level. The Caraka Samhita Sutrasthana describes dhatu-kshaya as the structural-loss phenotype across the seven dhatus.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — dhatu-kshaya across the seven tissues",
        },
      },
    ],
  },

  /* ------------------------------- Atony ------------------------------- */
  atony: {
    slug: "atony",
    displayName: "Atony",
    category: "tissue_state",
    shortDescription:
      "Tissue is lax and slack — the tone that holds it firm has dropped. Tissue is still present but no longer braced, leading to flaccidity, prolapse-tendency, and weak elastic recoil.",
    description:
      "Cook (1869) defines atony as the tissue state in which the tone that holds tissue firm has dropped: the tissue is structurally present but slack, soft, and unbraced, with poor elastic recoil and a tendency toward prolapse, varicosity, and gravitational pooling. Atony is distinct from atrophy — atony is loss of tone, atrophy is loss of substance — and is distinct from depression — atony is loss of structural firmness, depression is loss of functional drive. Felter (1922) prescribes astringents and tonic herbs that consolidate tissue (yellow dock, witch hazel, bayberry) combined with nutritive nervines and bitters that restore tone without additional stimulation.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On tissue states — atony as loss of tone and structural firmness",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On astringent and tonic protocols for atonic tissue states in modern phytotherapy",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Spleen-Qi Sinking / Middle-Qi Collapse (中气下陷, zhong qi xia xian)",
        observation:
          "TCM observation: tissue presenting with prolapse, gravitational pooling, weak elastic recoil, fatigue worsened by standing — the Spleen-Qi-Sinking pattern. Empirically continuous with Cook's atony.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — patterns of qi-sinking with prolapse and tone-loss",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mamsa-dhatu / Meda-dhatu laxity in Kapha vikriti",
        observation:
          "Ayurvedic observation: muscle tissue (mamsa-dhatu) and adipose tissue (meda-dhatu) showing slackness and lax tone within Kapha-aggravated terrain. The Caraka Samhita Sutrasthana describes this phenotype within the dhatu-dushti spectrum.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — mamsa-dhatu and meda-dhatu laxity in Kapha vikriti",
        },
      },
    ],
    observationalNotes:
      "Per the Eden Pattern mapping (reference_drift_phase_b_answers.md), atony corresponds to TS09 Laxity in the Apothecary's terrain-axis vocabulary — the slack-tone pole on the Tone axis.",
  },

  /* ----------------------------- Excitation ---------------------------- */
  excitation: {
    slug: "excitation",
    displayName: "Excitation",
    category: "tissue_state",
    shortDescription:
      "Tissue function is running heightened — quicker, stronger, more reactive than the body's own baseline. Acute increase in vital action above the normal range.",
    description:
      "Cook (1869) defines excitation as the tissue state in which vital action is heightened above baseline: stronger contractile response, faster metabolic turnover, sharper reactivity, and amplified glandular or nervous response. Excitation is the entry-state from which irritation follows if the heightened activity is not relaxed back toward baseline. The presentation may be acute (rapid pulse, sharp pain, brisk reflex) or sub-acute (heightened sensitivity, hyperreactivity, easy provocation). Felter (1922) prescribes nervine relaxants, sedating bitters, and refrigerant diaphoretics — agents that calm overactive tissue without depressing baseline function.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator: "On tissue states — excitation as heightened vital action",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On nervine-relaxant and sedating-bitter protocols for excitable tissue states",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Yang Excess at the tissue level (阳实, yang shi)",
        observation:
          "TCM observation: tissue presenting with heightened reactivity, sharp pulse, red tongue, sensation of heat — empirically continuous with Cook's excitation at the level of clinical presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — patterns of yang-excess at the level of tissue and organ function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mild Pitta-Vata aggravation at the dhatu level",
        observation:
          "Ayurvedic observation: tissue presenting with heightened reactivity from the heat-quality of Pitta combined with the mobility-quality of Vata — empirically continuous with Cook's excitation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana — Pitta-Vata samsarga at the tissue level (heightened-reactivity phenotype)",
        },
      },
    ],
  },

  /* ----------------------------- Irritation ---------------------------- */
  irritation: {
    slug: "irritation",
    displayName: "Irritation",
    category: "tissue_state",
    shortDescription:
      "Tissue is sustained over-reactive — heightened activity has settled in and tipped toward inflammation, swelling, redness, and pain. The body's defensive reactions are running hot.",
    description:
      "Cook (1869) defines irritation as the tissue state in which excitation has persisted long enough that the tissue has tipped into sustained over-reactivity: characteristic features include redness, swelling, heat, pain, and the inflammatory cascade Cook frames within the Physiomedical doctrine of vital force overdriving tissue. Irritation differs from acute excitation by chronicity and structural change — irritation begins to alter tissue rather than merely heighten its activity. Felter (1922) prescribes anti-inflammatory and demulcent protocols (chamomile, marshmallow root, cleavers, slippery elm) combined with nervine relaxants and refrigerant alteratives to cool sustained inflammation without further stimulation.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator: "On tissue states — irritation as sustained inflammatory over-reactivity",
      },
      secondary: {
        ...AHPA_BOTANICAL_SAFETY,
        locator:
          "On anti-inflammatory herbs and contraindications in irritated-tissue protocols",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Heat / Fire patterns with inflammation (热证 / 火证)",
        observation:
          "TCM observation: tissue presenting with redness, swelling, sensation of heat, sharp pain — empirically continuous with Cook's irritation at the level of clinical presentation. Heat- and Fire-pattern literature describe the same inflammatory phenotype.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — Heat and Fire patterns at the tissue level with inflammatory features",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Pitta-aggravated dhatu-dushti (inflammatory tissue impairment)",
        observation:
          "Ayurvedic observation: tissue showing inflammation, swelling, heat, sharp pain — empirically continuous with Cook's irritation. The Caraka Samhita describes this phenotype as Pitta-dominant dhatu-dushti.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — Pitta-dominant dhatu-dushti with inflammatory features",
        },
      },
    ],
    observationalNotes:
      "Per the Eden Pattern mapping (reference_drift_phase_b_answers.md), irritation corresponds to TS06 Acute Inflammation in the Apothecary's terrain-axis vocabulary.",
  },

  /* ---------------------------- Constriction --------------------------- */
  constriction: {
    slug: "constriction",
    displayName: "Constriction",
    category: "tissue_state",
    shortDescription:
      "Tissue is contracted, tight, and restricted — held under tension. Function may continue but the channels through which it operates are narrowed and braced.",
    description:
      "Cook (1869) defines constriction as the tissue state in which vital tension has held the tissue contracted: vessels narrowed, smooth muscle gripping, ducts and channels restricted, and a general bracing tone that limits free flow of fluids, secretions, and movement. Constriction differs from atony in direction (atony is loss of tone, constriction is excess of tone) and from irritation in mechanism (irritation is over-reactivity to stimulus, constriction is sustained contractile bracing). Felter (1922) prescribes antispasmodics and nervine relaxants (lobelia, scullcap, cramp bark, valerian) combined with diffusive warmth (ginger, prickly ash) to release tension without depleting the vital force the tension was guarding.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On tissue states — constriction as sustained contractile bracing and channel narrowing",
      },
      secondary: {
        ...HOFFMANN_MEDICAL_HERBALISM,
        locator:
          "On antispasmodic and nervine-relaxant protocols for constricted-tissue states",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Liver-Qi Stagnation / Constraint (肝郁, gan yu)",
        observation:
          "TCM observation: tissue presenting with constraint, tightness, channel-narrowing, distending pain that moves with emotional state — empirically continuous with Cook's constriction.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — patterns of qi-stagnation with constriction and constraint",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Vata-aggravated srotas (channel) constriction",
        observation:
          "Ayurvedic observation: srotas (channels of circulation) showing the dry-constricting quality of aggravated Vata — channels narrowed, flow restricted. The Caraka Samhita Vimanasthana describes srotas-rodha and srotas-sankocha (channel obstruction and contraction) within Vata vikriti.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Vimanasthana — srotas-sankocha within Vata vikriti",
        },
      },
    ],
  },
};

/* --------------------- Six priority body systems --------------------- */

export const ORGAN_SYSTEM_CONTENT: ContentEntryRegistry<OrganSystem> = {
  /* ------------------------------- Nervous ----------------------------- */
  nervous: {
    slug: "nervous",
    displayName: "Nervous System",
    category: "organ_system",
    shortDescription:
      "The system that carries signals — sensing, thinking, feeling, sleeping, moving. The nervous system is where excess wear shows up first as anxiety, insomnia, and over-reactivity, and where depletion shows up as fatigue, fog, and burnout.",
    description:
      "The nervous system in the Eclectic / Physiomedical framework is treated as the body's primary signal-carrying terrain — central, autonomic, and peripheral — and is the system where vital-force imbalance most often presents first and most readably. Cook (1869) treats nervine herbs (relaxants, stimulants, trophorestoratives) as the workhorse class for both the heightened states (excitation, irritation, constriction) and the depleted states (depression, torpor, atrophy). Felter (1922) extends the framework with the trophorestorative subclass (oat straw, milky oats, skullcap, vervain) for nervous-system rebuilding. Modern phytotherapy literature (Mills & Bone Ch. 3; PubMed adaptogen reviews) anchors the same protocol space to HPA-axis physiology and the autonomic nervous-system stress response.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On the nervous system as therapeutic terrain; nervine herb classifications",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On nervine and adaptogen protocols and HPA-axis modulation in modern phytotherapy",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Heart / Liver / Kidney — the three zang-fu of nervous-system function",
        observation:
          "TCM observation: nervous-system function is distributed across the Heart (shen, mind / consciousness), Liver (governing free flow of qi and emotion), and Kidney (Marrow / brain / will). Imbalance in any of the three reads at the nervous-system level. Empirical correlations to the Western framework: Heart-shen disturbance ≈ excitation/irritation in the central nervous system; Liver-qi stagnation ≈ constriction; Kidney essence depletion ≈ atrophy.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — Heart / Liver / Kidney correspondences for nervous-system function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Majja-dhatu (nerve tissue) and Vata's seat in the nervous system",
        observation:
          "Ayurvedic observation: nerve tissue is named majja-dhatu (the seventh and innermost of the seven dhatus); Vata is the dosha governing nervous-system function. Vata vikriti maps closely to the depleted and constricted Western states; Pitta vikriti at the nervous system maps to excitation and irritation; Kapha vikriti maps to torpor and depression.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana / Sharirasthana — majja-dhatu and Vata's nervous-system seat",
        },
      },
    ],
  },

  /* ------------------------------ Digestive ---------------------------- */
  digestive: {
    slug: "digestive",
    displayName: "Digestive System",
    category: "organ_system",
    shortDescription:
      "The system that takes in, breaks down, and absorbs — from mouth to colon. The digestive system is where most tissue states show up early through changes in appetite, digestion, elimination, and energy from food.",
    description:
      "The digestive system in the Eclectic / Physiomedical framework is treated as the body's fuel-and-substrate terrain — mouth, stomach, small intestine, colon, plus the biliary and pancreatic exocrine drainage. Cook (1869) anchors the framework with bitter tonics (gentian, dandelion, wormwood) for depression-and-torpor presentations, demulcents (slippery elm, marshmallow) for irritation presentations, astringents (yellow dock, blackberry root) for atony presentations, and antispasmodics (chamomile, fennel) for constriction presentations. Felter (1922) extends the protocol space with the carminatives and aromatic stimulants. Modern integrative-medicine literature anchors the framework to gut-brain-axis physiology, microbiome science, and bile-flow / hepatic-metabolism research.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On the digestive system as therapeutic terrain; bitter / demulcent / astringent / carminative classifications",
      },
      secondary: {
        ...HOFFMANN_MEDICAL_HERBALISM,
        locator:
          "On the digestive-system framework in modern Western herbalism with reception of Cook / Felter",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Spleen / Stomach / Liver / Large Intestine — the digestive zang-fu",
        observation:
          "TCM observation: digestive function is distributed across the Spleen (transformation and transportation of food essence), Stomach (rotting and ripening), Liver (free flow that supports digestion), and Large Intestine (passage of waste). Imbalance reads at the digestive system in characteristic patterns: Spleen-Qi deficiency ≈ depression / torpor; Stomach-Heat ≈ irritation; Liver-overacting-on-Spleen ≈ constriction with depression; Large-Intestine-Damp-Heat ≈ irritation in the colon.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — Spleen / Stomach / Liver / LI correspondences for digestive function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Agni and the digestive dhatus (rasa, mamsa, meda, asthi)",
        observation:
          "Ayurvedic observation: digestive function is governed by agni (digestive fire) and feeds the formation of all seven dhatus through the rasa-dhatu (plasma / nutritive juice). Mandagni (low agni) maps to Western depression / torpor; tikshnagni (sharp agni) maps to irritation / Pitta states; vishamagni (irregular agni) maps to constriction / Vata states; samagni is the balanced state.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Vimanasthana — agni typology and dhatu formation from rasa onward",
        },
      },
    ],
  },

  /* ---------------------------- Cardiovascular ------------------------- */
  cardiovascular: {
    slug: "cardiovascular",
    displayName: "Cardiovascular System",
    category: "organ_system",
    shortDescription:
      "The system that moves blood — heart, arteries, veins, capillaries. The cardiovascular system is where vital tension shows up as high or low pressure, where stagnation shows up as pooling and varicosities, and where depleted vital force shows up as weak pulse and cold extremities.",
    description:
      "The cardiovascular system in the Eclectic / Physiomedical framework is treated as the body's circulatory terrain — heart muscle, conducting system, arterial tone, venous return, and capillary microcirculation. Cook (1869) prescribes cardiac tonics (hawthorn, motherwort, lily of the valley historically) for depression of cardiac function, refrigerant relaxants for irritation/excitation states, vascular tonics and astringents (yellow dock, witch hazel, butcher's broom) for atonic venous return, and circulatory stimulants (capsicum, ginger, prickly ash) for cold extremities and torpor. Felter (1922) extends the protocol with attention to arterial tension and the vasodilator / vasoconstrictor classes. Modern cardiovascular pharmacology cross-anchors the protocol space (PubMed reviews on hawthorn, garlic, hibiscus).",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On the cardiovascular system as therapeutic terrain; cardiac tonic and circulatory stimulant classifications",
      },
      secondary: {
        ...NCCIH_HERBS_AT_A_GLANCE,
        locator:
          "On hawthorn, garlic, hibiscus and other cardiovascular herbs in NIH-curated overviews",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Heart and Pericardium — Heart-Qi / Heart-Yang / Heart-Yin / Heart-Blood",
        observation:
          "TCM observation: cardiovascular function is distributed across the Heart (governs Blood and houses Shen) and Pericardium. Imbalance reads at characteristic patterns: Heart-Qi deficiency ≈ depression with weak pulse; Heart-Yang deficiency ≈ torpor with cold extremities; Heart-Yin deficiency ≈ irritation with rapid thready pulse; Heart-Blood stasis ≈ constriction with sharp fixed pain.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — Heart and Pericardium correspondences for cardiovascular function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Rakta-dhatu (blood) and Hridaya (heart) — Vyana Vata's seat",
        observation:
          "Ayurvedic observation: blood is named rakta-dhatu (the second of seven dhatus); the heart (hridaya) is the seat of Vyana Vata (the sub-dosha of Vata governing circulation). Imbalance reads at characteristic patterns: rakta-kshaya ≈ Western depression / atrophy of cardiovascular function; rakta-dushti with Pitta ≈ irritation / inflammatory cardiovascular states; Vyana Vata vikriti ≈ constriction or arrhythmic patterns.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — rakta-dhatu and Vyana Vata's cardiovascular seat",
        },
      },
    ],
  },

  /* ----------------------------- Respiratory --------------------------- */
  respiratory: {
    slug: "respiratory",
    displayName: "Respiratory System",
    category: "organ_system",
    shortDescription:
      "The system that exchanges breath — nose, throat, bronchi, lungs. The respiratory system is where moisture and dryness show up most plainly, where catarrh and dryness mark the wet and dry tissue states, and where vital force is taken in with each breath.",
    description:
      "The respiratory system in the Eclectic / Physiomedical framework is treated as the body's breath-and-exchange terrain — upper respiratory (nose, sinus, pharynx, larynx), lower respiratory (trachea, bronchi, alveoli), and pleural envelope. Cook (1869) prescribes expectorants (lobelia, mullein, elecampane) for catarrhal/torpid presentations, demulcent moistening agents (slippery elm, marshmallow, licorice) for dry/irritated presentations, antispasmodics (lobelia again, valerian) for spasmodic / constrictive presentations such as asthma, and warming diaphoretics (boneset, yarrow, ginger) for cold presentations. Felter (1922) extends the framework with attention to the diffusible-stimulant role in cold respiratory states. Modern phytotherapy literature anchors the same protocol space.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On the respiratory system as therapeutic terrain; expectorant / demulcent / antispasmodic classifications",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On respiratory-system protocols in modern phytotherapy with Cook / Felter reception",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Lung and Large Intestine — Lung-Qi / Lung-Yin / Lung-Heat / Phlegm-Damp",
        observation:
          "TCM observation: respiratory function is distributed primarily across the Lung (governs Qi and breathing, descends and disperses) with paired-organ relationship to the Large Intestine. Imbalance reads at characteristic patterns: Lung-Qi deficiency ≈ depression / torpor with weak voice and shortness of breath; Lung-Yin deficiency ≈ atrophy with dry cough; Lung-Heat ≈ irritation with productive yellow phlegm; Phlegm-Damp ≈ wet-tissue presentation with copious mucus.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — Lung and Large Intestine correspondences for respiratory function",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Prana Vata and Kapha's seat in the chest",
        observation:
          "Ayurvedic observation: respiration is governed by Prana Vata (the sub-dosha of Vata governing intake of breath) with the chest as Kapha's primary seat (Kapha governs mucus and lubrication of the airway). Imbalance reads at characteristic patterns: Vata vikriti at the lung ≈ dry cough, atrophy, depression; Pitta vikriti ≈ irritation with inflammation; Kapha vikriti ≈ wet/torpid states with copious phlegm.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — Prana Vata and Kapha's seat in the chest",
        },
      },
    ],
  },

  /* --------------------------- Musculoskeletal ------------------------- */
  musculoskeletal: {
    slug: "musculoskeletal",
    displayName: "Musculoskeletal System",
    category: "organ_system",
    shortDescription:
      "The system that holds the body up and lets it move — muscles, tendons, ligaments, fascia, bones, joints. The musculoskeletal system is where chronic tension shows up as constriction, where depletion shows up as weakness and atrophy, and where inflammatory irritation shows up as joint pain.",
    description:
      "The musculoskeletal system in the Eclectic / Physiomedical framework is treated as the body's structural-and-locomotor terrain — skeletal muscle, tendon, ligament, fascia, bone, joint, and intervertebral disc. Cook (1869) prescribes antispasmodics (cramp bark, lobelia, black cohosh) for constrictive states, anti-inflammatory and demulcent protocols (devil's claw historically, marshmallow root, willow bark, meadowsweet) for irritation states, mineral-rich nutritives (horsetail, nettle, alfalfa, oat straw) for atrophic states, and warming circulatory stimulants for cold-and-torpid joint presentations. Felter (1922) cross-references the rheumatic-and-arthritic protocols. AHPA Botanical Safety Handbook entries anchor the modern safety-and-contraindication framework for the same agents.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On the musculoskeletal system as therapeutic terrain; antispasmodic / anti-inflammatory / mineral-nutritive classifications",
      },
      secondary: {
        ...AHPA_BOTANICAL_SAFETY,
        locator:
          "On safety and contraindications for musculoskeletal-system herbs",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Liver / Kidney / Spleen — sinews / bones / muscles correspondences",
        observation:
          "TCM observation: musculoskeletal tissues are distributed across three zang-fu correspondences: the Liver governs the sinews (tendons / ligaments); the Kidney governs the bones; the Spleen governs the muscles. Imbalance reads at characteristic patterns: Liver-Blood deficiency ≈ atrophy of sinews with stiffness and cramping; Kidney essence depletion ≈ atrophy of bones; Spleen-Qi deficiency ≈ atony of muscles with weakness; Wind-Damp obstruction ≈ irritation with joint pain.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — Liver/Kidney/Spleen correspondences for sinews / bones / muscles",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Asthi-dhatu (bone) / Mamsa-dhatu (muscle) / Majja-dhatu (marrow) / Snayu (sinew)",
        observation:
          "Ayurvedic observation: musculoskeletal tissues are distributed across asthi-dhatu (bone), mamsa-dhatu (muscle), majja-dhatu (marrow within bone), and snayu (sinew / ligament). Vata vikriti at these tissues maps to Western atrophy and constriction (cracking joints, dry tissue, cramping); Pitta vikriti ≈ inflammatory joint irritation; Kapha vikriti ≈ swelling, stiffness, and lax tone.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sharirasthana — asthi / mamsa / majja-dhatu and the dosha vikriti correspondences",
        },
      },
    ],
  },

  /* --------------------------- Integumentary --------------------------- */
  integumentary: {
    slug: "integumentary",
    displayName: "Integumentary System",
    category: "organ_system",
    shortDescription:
      "The system that wraps the body — skin, hair, nails, sweat, sebaceous, and the skin's immune layer. The integumentary system is where many internal terrain states show up visibly first, and where elimination, moisture, and inflammation surface together.",
    description:
      "The integumentary system in the Eclectic / Physiomedical framework is treated as the body's outer terrain — skin, hair, nails, sweat and sebaceous glands, and the cutaneous immune layer (the largest immune organ in the body). Cook (1869) treats the skin as both a presenting surface and an active eliminative organ; the alterative (\"blood-purifying\") and lymphatic-drainage protocols (yellow dock, burdock, cleavers, red clover, calendula) work on internal terrain through the skin as much as on the skin itself. Felter (1922) extends the framework with attention to chronic skin conditions (eczema, psoriasis, slow-healing ulceration) as terrain readouts. Modern dermatology and integrative-medicine literature anchors the same protocol space.",
    citations: {
      primaryText: {
        ...COOK_1869,
        locator:
          "On the integumentary system as terrain readout and eliminative organ; alterative / lymphatic / vulnerary classifications",
      },
      secondary: {
        ...HOFFMANN_MEDICAL_HERBALISM,
        locator:
          "On the integumentary system in modern Western herbalism with Cook / Felter alterative reception",
      },
    },
    traditionalObservations: [
      {
        tradition: "tcm",
        pattern: "Lung / Spleen / Heart — skin correspondences",
        observation:
          "TCM observation: skin is governed primarily by the Lung (the Lung's outer manifestation, controlling the body surface and Wei-Qi defensive layer); the Spleen contributes to flesh and skin tone; the Heart manifests on the face and tongue. Imbalance reads at characteristic patterns: Lung Wei-Qi deficiency ≈ pale dry skin with susceptibility to surface infection; Damp-Heat ≈ irritation with eczematous and inflammatory dermatoses; Blood-Heat ≈ red lesions; Blood-deficiency ≈ atrophy with dry cracking skin.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — Lung / Spleen / Heart correspondences for the skin",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Tvak (skin) and Bhrajaka Pitta",
        observation:
          "Ayurvedic observation: skin is named tvak and is governed by Bhrajaka Pitta (the sub-dosha of Pitta giving the skin its color, lustre, and metabolic exchange with the environment). Imbalance reads at characteristic patterns: Bhrajaka Pitta vikriti ≈ inflammatory irritation, redness, photosensitivity; Vata vikriti ≈ atrophy with dry cracking skin; Kapha vikriti ≈ pallor, oiliness, and torpid healing.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — tvak and Bhrajaka Pitta",
        },
      },
    ],
    observationalNotes:
      "Per the Eden Pattern mapping (reference_drift_phase_b_answers.md), the integumentary system was added as SY15 Integumentary in the Apothecary's body-system vocabulary at the Phase B drift-correction pass — an explicit founder strategic decision per Lock #45 surface 3 (strategic decisions).",
  },
};

/* ============================================================================
 * Phase 2 — Tissue-state × Body-system cells (42 entries)
 *
 * Outer key: OrganSystem (matches ORGAN_SYSTEM_KEYS order).
 * Inner key: AuthoredTissueState (matches TISSUE_STATE_KEYS order).
 *
 * Each cell carries:
 *   • slug          — "{system}_{state}", stable canonical key.
 *   • displayName   — "{State} of the {System}".
 *   • category      — "tissue_state_by_system".
 *   • shortDescription — 1–2 sentence lay-register framing per ContentEntry.
 *   • description    — 3–5 sentence clinical description, terminology preserved.
 *   • citations      — dual-source per Lock #43 (Cook/Felter primary +
 *                      industry-best-practice secondary, locator-specific).
 *   • traditionalObservations — TCM + Ayurveda observation specific to the
 *                      cell's system × state combination per Lock #44.
 *
 * The Partial<Record<...>> shape at the inner level is a forward-compatible
 * escape hatch — Phase 2 ships every cell populated, so the runtime read
 * always returns a defined entry for every known (system, state) pair.
 * ========================================================================== */

export const TISSUE_STATE_BY_SYSTEM: Record<
  OrganSystem,
  Partial<Record<AuthoredTissueState, ContentEntry>>
> = {
  /* ====================== NERVOUS SYSTEM (7 cells) ====================== */
  nervous: {
    depression: {
      slug: "nervous_depression",
      displayName: "Depression of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system is running below par — low affect, slow processing, weak reflexes, fatigue with light demand. The signal is dim but the substrate is intact.",
      description:
        "Cook (1869) describes nervous-system depression as the entry-state of nervous diminishment: low affect, slowed processing, weak reflexive response, fatigue under ordinary cognitive or emotional load, and incomplete recovery — without yet entering torpor or atrophy. The presentation is sluggishness of the signal-carrying terrain rather than wasting of the substrate. Felter (1922) prescribes mild restoratives, gentle warming nervines (oats, vervain, lemon balm) paired with low-dose stimulant nervines, and nutritive trophorestoratives that lift function without overdriving the already-weakened tissue. Aggressive stimulation commonly worsens nervous-system depression by exhausting the reserve the tissue still holds.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Nervous-system chapter — diminished nervous action and the gentle-restorative protocol",
        },
        secondary: {
          ...PANOSSIAN_ADAPTOGENS_2010,
          locator:
            "On adaptogens and HPA-axis modulation in low-tone / low-affect presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Qi Deficiency / Spleen-Qi Deficiency",
          observation:
            "TCM observation: nervous-system function presenting with low affect, fatigue, weak voice, easy worry, slow recovery from mental load — empirically continuous with Cook's depression of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Qi and Spleen-Qi deficiency at nervous-system function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mild dushti at majja-dhatu within mandagni terrain",
          observation:
            "Ayurvedic observation: nerve tissue (majja-dhatu) showing mild functional impairment paired with weak digestive fire (mandagni) — an early-stage pattern of nervous-system depletion before kshaya sets in.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — early dhatu-dushti at majja with mandagni",
          },
        },
      ],
    },
    torpor: {
      slug: "nervous_torpor",
      displayName: "Torpor of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system has settled into sustained low gear — heavy fatigue, anhedonia, slow cognition, reduced reactivity over time, but still without structural wasting.",
      description:
        "Cook (1869) describes nervous-system torpor as depression that has persisted long enough that the tissue no longer merely runs below baseline but is settled into sustained dullness: low cognitive throughput, anhedonia, slow recovery from physical or emotional load, and a generally low-amplitude nervous response. Torpor is more entrenched than depression but precedes the structural loss of atrophy. Felter (1922) prescribes warming diffusive nervines (capsicum, ginger, prickly ash) paired with stimulant nervines (rosemary, peppermint) and nutritive restoratives — agents that break the inertness and lift the tissue back toward responsive function without further depleting the vital force.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Nervous-system chapter — sustained nervous inertness and the warming-diffusive protocol",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On warming nervines and stimulant trophorestorative protocols for chronic low-amplitude nervous-system function",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Yang Deficiency / Kidney-Yang Deficiency",
          observation:
            "TCM observation: sustained low nervous function with cold extremities, deep fatigue, slow cognition, low willpower — empirically continuous with Cook's torpor of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Yang and Kidney-Yang deficiency at the nervous system",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Kapha vikriti at majja-dhatu with cold-stagnant features",
          observation:
            "Ayurvedic observation: nerve tissue showing the cold-heavy-slow qualities of aggravated Kapha at majja — sustained dullness, weight, sluggishness — empirically continuous with Cook's torpor.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Kapha vikriti at majja-dhatu",
          },
        },
      ],
    },
    atrophy: {
      slug: "nervous_atrophy",
      displayName: "Atrophy of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system is losing substance — cognitive decline, paresthesias, structural decline of nerve tissue. Function is diminished and the tissue itself is shrinking.",
      description:
        "Cook (1869) describes nervous-system atrophy as the structural-loss endpoint of the depletion progression (depression → torpor → atrophy): nerve tissue itself is wasting, with diminished function plus diminished structure — cognitive decline, paresthesias, weakened reflexes, and degenerative changes that exceed simple low function. Felter (1922) prescribes the trophorestorative subclass — milky oats, oat straw, skullcap, vervain, with nutritive mineralizers (nettle, alfalfa) — agents that supply substrate for nervous-system rebuilding rather than merely stimulating function. Aggressive stimulation of atrophic nervous tissue is commonly worse than no intervention; the tissue lacks the substrate to respond.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Trophorestoratives section — Avena sativa (milky oats / oat straw), Scutellaria, Verbena for nervous-system rebuilding",
        },
        secondary: {
          ...PANOSSIAN_ADAPTOGENS_2010,
          locator:
            "On adaptogen pharmacology and neurotrophic effects in chronically depleted nervous-system terrain",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Kidney Essence Depletion (肾精虚 — Marrow / Brain depletion)",
          observation:
            "TCM observation: nervous-system substance loss with cognitive decline, weakness of will, depletion of the Sea of Marrow (the brain), graying / loss of hair — empirically continuous with Cook's atrophy of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Kidney essence depletion and Marrow / brain wasting",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Majja-dhatu kshaya with ojas-kshaya",
          observation:
            "Ayurvedic observation: nerve tissue (majja-dhatu) showing kshaya — substance depletion — paired with ojas-kshaya at the deepest level. The Caraka Samhita Sutrasthana describes this phenotype within the dhatu-kshaya spectrum.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — majja-dhatu kshaya with ojas-kshaya",
          },
        },
      ],
    },
    atony: {
      slug: "nervous_atony",
      displayName: "Atony of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system has lost tone — weak reflexes, autonomic flaccidity, postural hypotension, sluggish smooth-muscle response. The tissue is present but no longer braced.",
      description:
        "Cook (1869) describes nervous-system atony as loss of nervous tone distinct from loss of nervous drive: reflexes are weak rather than slow, autonomic regulation is flaccid (postural hypotension, weak smooth-muscle response, neurogenic prolapse-tendency), and the bracing tone that ordinarily holds the nervous response firm has dropped. Atony is distinct from atrophy (substance loss) and from depression (drive loss). Felter (1922) prescribes nervine tonics paired with bitter aromatic stimulants (gentian, calamus, vervain) and astringent nutritives that consolidate tone without further stimulation of an already-flaccid system.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Nervous-system chapter — nervous laxity and the tonic-bitter consolidation protocol",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On tonic and astringent protocols for atonic neuromuscular and autonomic presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Sinking with neurological prolapse features",
          observation:
            "TCM observation: weak nervous-tone with prolapse-tendency, postural hypotension on rising, fatigue worsened by standing — empirically continuous with Cook's atony of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi sinking with prolapse and tone-loss",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata vikriti with mamsa-dhatu laxity at neuromuscular junction",
          observation:
            "Ayurvedic observation: muscle tissue (mamsa-dhatu) showing laxity within Vata-aggravated terrain — weak tone, dropping reflexes, autonomic flaccidity. The Caraka Samhita describes this phenotype within the dhatu-dushti spectrum.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — mamsa-dhatu laxity in Vata vikriti at the neuromuscular layer",
          },
        },
      ],
    },
    excitation: {
      slug: "nervous_excitation",
      displayName: "Excitation of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system is running heightened — anxiety, sympathetic dominance, hyperarousal, jumpy reflexes, sleep-onset insomnia. Reactivity is amplified above baseline.",
      description:
        "Cook (1869) describes nervous-system excitation as heightened nervous action above baseline: stronger reflexive response, faster cognitive throughput tipping toward racing, sympathetic dominance with tachycardia and easy startle, hyperarousal, and sleep-onset insomnia. Excitation is the entry-state from which irritation follows if the heightened activity is not relaxed back toward baseline. Felter (1922) prescribes nervine relaxants (passionflower, scullcap, valerian, hops, lemon balm), sedating bitters, and warm-relaxant baths — agents that calm the overactive tissue without depressing baseline function.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Nervous-system chapter — heightened nervous action and the relaxant-nervine protocol",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On nervine-relaxant protocols and parasympathetic-promoting phytotherapy in hyperaroused presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Yang Excess / Liver-Yang Rising (肝阳上亢)",
          observation:
            "TCM observation: heightened nervous reactivity with rapid pulse, red tongue, irritability, headaches, sleep-onset insomnia — empirically continuous with Cook's excitation of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Yang excess and Liver-Yang rising at the nervous system",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-Vata aggravation at majja-dhatu (Prana Vata excitation)",
          observation:
            "Ayurvedic observation: nerve tissue presenting with the heat-quality of Pitta combined with the mobility-quality of Vata — racing thoughts, hyperreactivity, sleep onset disturbance — empirically continuous with Cook's excitation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Pitta-Vata samsarga at majja-dhatu / Prana Vata aggravation",
          },
        },
      ],
    },
    irritation: {
      slug: "nervous_irritation",
      displayName: "Irritation of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system is sustained over-reactive — neuropathic burning, neuralgia, chronic insomnia, sustained sympathetic overdrive that has tipped toward neuro-inflammation.",
      description:
        "Cook (1869) describes nervous-system irritation as excitation that has persisted long enough that the tissue has tipped into sustained over-reactivity with inflammatory features: neuropathic burning sensations, neuralgia, sustained insomnia, and the chronic sympathetic overdrive that modern neuroscience frames as neuro-inflammation. Irritation differs from excitation by chronicity and by the inflammatory cascade it triggers. Felter (1922) prescribes anti-inflammatory nervines (St. John's wort historically for neuralgia, oats for chronic depletion-driven irritation, scullcap for sustained relaxation) combined with refrigerant alteratives and demulcent supports.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Hypericum perforatum (St. John's wort) and Scutellaria for sustained neuralgic irritation",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On anti-inflammatory nervine protocols for chronic neuro-inflammatory presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Fire / Liver-Fire (心火 / 肝火)",
          observation:
            "TCM observation: sustained inflammatory nervous-tissue states with red tongue tip, rapid wiry pulse, burning sensations, sustained insomnia, mouth ulcers — empirically continuous with Cook's irritation of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Fire and Liver-Fire patterns at the nervous system",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-aggravated majja-dushti",
          observation:
            "Ayurvedic observation: nerve tissue showing chronic inflammation, burning, sharp pain — empirically continuous with Cook's irritation. The Caraka Samhita describes this phenotype as Pitta-dominant majja-dushti.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Pitta-aggravated majja-dushti with inflammatory features",
          },
        },
      ],
    },
    constriction: {
      slug: "nervous_constriction",
      displayName: "Constriction of the Nervous System",
      category: "tissue_state_by_system",
      shortDescription:
        "The nervous system is held under tension — chronic clenching, jaw and shoulder bracing, tension headaches, smooth-muscle spasm, neurogenic IBS or neurogenic asthma. The signal is gripping rather than flowing.",
      description:
        "Cook (1869) describes nervous-system constriction as sustained contractile bracing of nervous-mediated tone: chronic clenching of jaw and shoulders, tension-pattern headaches, smooth-muscle spasm under nervous control (neurogenic IBS, neurogenic bronchospasm), and a general bracing posture that limits free flow. Constriction differs from atony in direction (atony is loss of tone; constriction is excess of tone) and from irritation in mechanism (irritation is over-reactivity; constriction is sustained gripping). Felter (1922) prescribes antispasmodics paired with relaxant nervines (lobelia, scullcap, cramp bark, valerian, black cohosh) plus diffusive warmth (ginger, prickly ash) to release the bracing without depleting the vital force the tension was guarding.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Nervous-system chapter — antispasmodic protocol for sustained nervous bracing",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On antispasmodic and nervine-relaxant protocols for chronic somatic-tension presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Qi Stagnation (肝郁) at the somatic level",
          observation:
            "TCM observation: chronic somatic clenching with distending pain that moves with emotional state, sighing, irritability, jaw and shoulder bracing — empirically continuous with Cook's constriction of the nervous system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Qi stagnation at the sinews and nervous-mediated tone",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-aggravated srotas-sankocha at majja",
          observation:
            "Ayurvedic observation: nervous-mediated channels (srotas) showing the dry-constricting quality of aggravated Vata — channels narrowed, smooth muscle gripping. The Caraka Samhita Vimanasthana describes srotas-sankocha at the level of nervous tone.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — srotas-sankocha within Vata vikriti at majja",
          },
        },
      ],
    },
  },

  /* ===================== DIGESTIVE SYSTEM (7 cells) ===================== */
  digestive: {
    depression: {
      slug: "digestive_depression",
      displayName: "Depression of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "Digestion is running below par — weak appetite, slow gastric emptying, post-prandial fatigue, low bile flow, gas and belching from incomplete breakdown.",
      description:
        "Cook (1869) describes digestive-system depression as diminished digestive vital action: weak appetite, slow gastric emptying, low bile flow, post-prandial fatigue, gas and belching from incomplete breakdown — without yet entering torpor or atrophy of the gut wall. Felter (1922) prescribes bitter tonics as the cornerstone class (gentian, dandelion root, wormwood, calumba) taken before meals to provoke vagal-mediated digestive secretion, paired with mild aromatic stimulants (cardamom, fennel, ginger) to lift digestive function without overdriving the gut.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Digestive-system chapter — bitter tonic protocol for diminished digestive action",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On the bitter tonic protocol and the modern reception of Cook / Felter digestive depression framework",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Deficiency (脾气虚)",
          observation:
            "TCM observation: weak appetite, post-prandial fatigue, soft stools, easy gas, pale tongue with thin coat — empirically continuous with Cook's depression of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi deficiency at digestive function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mandagni (low digestive fire)",
          observation:
            "Ayurvedic observation: agni (digestive fire) presenting as mandagni — weak appetite, slow digestion, post-prandial heaviness, ama (undigested residue) accumulation. Empirically continuous with Cook's depression of the digestive system.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — mandagni typology and weak digestive fire",
          },
        },
      ],
    },
    torpor: {
      slug: "digestive_torpor",
      displayName: "Torpor of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "Digestion has settled into sustained sluggishness — chronic constipation, full feeling, cold abdomen, food sits like a stone, slow recovery from heavy meals.",
      description:
        "Cook (1869) describes digestive-system torpor as depression that has settled into sustained inertness: chronic constipation, persistent fullness, cold abdomen, food that sits like a stone, slow biliary flow with right-upper-quadrant heaviness. Felter (1922) prescribes warming diffusive stimulants combined with bitters (capsicum, ginger, prickly ash, with gentian) to break the inertness, plus cholagogues (dandelion root, fringe tree) to restore bile flow and bowel transit without over-stimulating an already sluggish digestive terrain.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Digestive-system chapter — warming-diffusive plus bitter protocol for sustained digestive torpor",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On cholagogue and warming-stimulant protocols for chronic biliary and digestive sluggishness",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Yang Deficiency (脾阳虚)",
          observation:
            "TCM observation: cold abdomen, chronic constipation with cold features, sluggish digestion worsened by cold food, pale tongue with thick wet coat — empirically continuous with Cook's torpor of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Yang deficiency at digestive function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Kapha aggravation at agni with sustained ama",
          observation:
            "Ayurvedic observation: agni overwhelmed by Kapha's heavy-cold-slow qualities — persistent ama, heavy belly, dull appetite, sluggish elimination. Empirically continuous with Cook's torpor.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — Kapha-aggravation at agni with sustained ama",
          },
        },
      ],
    },
    atrophy: {
      slug: "digestive_atrophy",
      displayName: "Atrophy of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "Digestive tissue is wasting — mucosal thinning, low stomach acid, malabsorption, weight loss the body cannot recover. Function is diminished and the lining itself has thinned.",
      description:
        "Cook (1869) describes digestive-system atrophy as the wasting endpoint of the depletion progression: gastric and intestinal mucosa have thinned, secretory function (hydrochloric acid, pancreatic enzymes, bile) is diminished, and malabsorption produces weight loss the body cannot recover. The atrophic-gastritis spectrum and chronic malabsorption phenotypes sit here. Felter (1922) prescribes nutritive bitters at low dose (gentian, calumba) paired with demulcents that protect and rebuild mucosa (slippery elm, marshmallow root, comfrey leaf historically), plus mineral-rich nutritives (nettle, alfalfa) to supply substrate. Aggressive bittering of atrophic gut is contraindicated.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Demulcent and nutritive-bitter protocols for atrophic gastritis and malabsorption presentations",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On mucosal-rebuilding protocols and the modern reception of Cook / Felter digestive atrophy framework",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Stomach-Yin Deficiency / Spleen Exhaustion (胃阴虚)",
          observation:
            "TCM observation: gastric atrophic features with dryness, low appetite, glossy red tongue with little coat, mucosal thinning — empirically continuous with Cook's atrophy of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Stomach-Yin deficiency with mucosal atrophy",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Rasa-dhatu kshaya with chronic agni-mandya",
          observation:
            "Ayurvedic observation: rasa-dhatu (plasma / nutritive juice) showing kshaya — depletion that propagates through the dhatu chain — paired with chronically weak agni. The Caraka Samhita describes the dhatu-kshaya cascade originating from rasa.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — rasa-dhatu kshaya and the dhatu-kshaya cascade",
          },
        },
      ],
    },
    atony: {
      slug: "digestive_atony",
      displayName: "Atony of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "The digestive tract has lost tone — lax gut wall, hiatal hernia tendency, gastroptosis, slow peristalsis from lack of bracing rather than lack of drive, distension after meals.",
      description:
        "Cook (1869) describes digestive-system atony as loss of tone in the gut wall and supporting structures: lax gastric and intestinal walls, hiatal hernia tendency, gastroptosis, slow peristalsis from absence of bracing tone (distinct from torpor's absence of drive), post-prandial distension, and the prolapse-tendency that follows from sustained tone loss. Felter (1922) prescribes astringent bitters (yellow dock, blackberry root, agrimony, oak bark) paired with tonic carminatives (calamus, cardamom) to consolidate tone without further stimulation of an already-flaccid gut wall.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Digestive-system chapter — astringent-bitter protocol for atonic gut presentations",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On astringent and tonic protocols for atonic digestive presentations in modern phytotherapy",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Sinking with digestive prolapse features",
          observation:
            "TCM observation: organ-prolapse-tendency at the gut (gastroptosis, hemorrhoids), bearing-down sensation, fatigue worsened by standing, post-prandial heaviness — empirically continuous with Cook's atony of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi sinking with digestive prolapse",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mamsa-dhatu laxity at the gut wall in Kapha vikriti",
          observation:
            "Ayurvedic observation: muscle tissue (mamsa-dhatu) of the gut wall showing slackness within Kapha-aggravated terrain — distension, slow tone, prolapse-tendency. Empirically continuous with Cook's atony.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — mamsa-dhatu laxity at the gut in Kapha vikriti",
          },
        },
      ],
    },
    excitation: {
      slug: "digestive_excitation",
      displayName: "Excitation of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "Digestion is running heightened — hyperacidity, hyperperistalsis, urgency, sharp hunger pangs, food cravings, easy reflux. Reactivity is amplified above baseline.",
      description:
        "Cook (1869) describes digestive-system excitation as heightened digestive action above baseline: hyperacidity, hyperperistalsis with urgency, sharp hunger pangs, intensified food cravings, gastroesophageal reflux from sphincter over-reactivity, and rapid post-prandial gastric emptying that overwhelms small-intestinal capacity. Excitation precedes irritation as the entry-state of digestive over-reactivity. Felter (1922) prescribes demulcents (slippery elm, marshmallow root) to coat over-reactive mucosa, carminatives (fennel, chamomile, peppermint) to settle hyperperistalsis, and relaxant nervines to address the neurogenic component without depressing baseline digestive function.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Digestive-system chapter — demulcent-carminative protocol for excited digestive states",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On demulcent and carminative protocols in hyperreactive gut presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Stomach-Heat Rising (胃热)",
          observation:
            "TCM observation: heightened gastric activity with hyperacidity, sharp hunger, gastroesophageal reflux, red tongue with yellow coat — empirically continuous with Cook's excitation of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Stomach-Heat rising at digestive function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Tikshnagni (sharp digestive fire) / Pitta at agni",
          observation:
            "Ayurvedic observation: agni presenting as tikshnagni — sharp digestive fire with intense hunger, hyperacidity, rapid digestion, easy heat — empirically continuous with Cook's excitation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — tikshnagni typology under Pitta-aggravation",
          },
        },
      ],
    },
    irritation: {
      slug: "digestive_irritation",
      displayName: "Irritation of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "The digestive lining is sustained inflamed — gastritis, esophagitis, IBD-spectrum, mouth ulcers, mucosal redness and pain. The body's defensive reactions in the gut have tipped hot.",
      description:
        "Cook (1869) describes digestive-system irritation as excitation that has settled into sustained mucosal inflammation: gastritis, esophagitis, IBD-spectrum chronic inflammation, mouth ulceration, and mucosal redness with pain. The presentation differs from excitation by chronicity and by structural change to the mucosa rather than mere heightened secretion. Felter (1922) prescribes demulcents as the cornerstone class (slippery elm, marshmallow root, plantain) paired with anti-inflammatory alteratives (calendula, yellow dock at low dose) and refrigerant relaxants — agents that cool and protect inflamed mucosa without further stimulation.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Ulmus fulva (slippery elm) and Althaea officinalis demulcent protocol for inflamed digestive mucosa",
        },
        secondary: {
          ...AHPA_BOTANICAL_SAFETY,
          locator:
            "On safety and contraindications for demulcent and anti-inflammatory protocols in inflammatory gut presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Damp-Heat in the Middle Jiao / Stomach-Fire (胃火 / 中焦湿热)",
          observation:
            "TCM observation: sustained gastric inflammation with mucosal redness, mouth ulcers, foul breath, yellow greasy tongue coat, urgent loose stools — empirically continuous with Cook's irritation of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Damp-Heat in the Middle Jiao and Stomach-Fire",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-aggravated dushti at annavaha srotas",
          observation:
            "Ayurvedic observation: annavaha srotas (food-channel) showing chronic Pitta-dushti — inflammation, burning, mucosal heat. Empirically continuous with Cook's irritation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — Pitta-dushti at annavaha srotas",
          },
        },
      ],
    },
    constriction: {
      slug: "digestive_constriction",
      displayName: "Constriction of the Digestive System",
      category: "tissue_state_by_system",
      shortDescription:
        "The digestive tract is held under spasm — IBS-cramping, esophageal spasm, pyloric or biliary spasm, gripping pain that comes and goes with stress.",
      description:
        "Cook (1869) describes digestive-system constriction as sustained contractile bracing of digestive smooth muscle: IBS-pattern cramping, esophageal spasm, pyloric or biliary spasm, sphincter-of-Oddi tension restricting bile flow, and the gripping pain that comes and goes with neurogenic provocation. Constriction differs from atony in direction (atony loses tone; constriction grips) and from irritation in mechanism (irritation inflames; constriction spasms). Felter (1922) prescribes carminative antispasmodics (chamomile, fennel, peppermint, lobelia at low dose, cramp bark) paired with relaxant nervines and warming diffusives to release the bracing without depleting digestive vital force.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Digestive-system chapter — carminative-antispasmodic protocol for spasmodic digestive presentations",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On antispasmodic and carminative protocols for IBS-spectrum and biliary-spasm presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Qi Stagnation Invading the Spleen / Stomach (肝气犯脾)",
          observation:
            "TCM observation: digestive spasm and cramping that worsens with emotional stress, alternating constipation and loose stools (IBS pattern), bloating and sighing — empirically continuous with Cook's constriction of the digestive system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Qi stagnation invading the digestive sphere",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-aggravated srotas-sankocha at annavaha and purishavaha",
          observation:
            "Ayurvedic observation: digestive channels (annavaha, purishavaha) showing the dry-constricting quality of aggravated Vata — spasm, cramping, irregular elimination. Empirically continuous with Cook's constriction.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — srotas-sankocha at annavaha and purishavaha within Vata vikriti",
          },
        },
      ],
    },
  },

  /* ==================== CARDIOVASCULAR SYSTEM (7 cells) ==================== */
  cardiovascular: {
    depression: {
      slug: "cardiovascular_depression",
      displayName: "Depression of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "The cardiovascular system is running below par — weak pulse, low blood pressure, postural fatigue, slow recovery from exertion, cold extremities. The pump is intact but the drive is dim.",
      description:
        "Cook (1869) describes cardiovascular depression as diminished cardiac vital action: weak pulse, low resting blood pressure, postural fatigue, slow recovery from exertion, and cold extremities — without yet entering torpor or structural change to the cardiac muscle. Felter (1922) prescribes cardiac tonics as the cornerstone class (hawthorn berry and flower, motherwort, lily of the valley historically with strict safety bounds) paired with mild aromatic stimulants and nutritive supports — agents that lift cardiac function and circulation without overdriving an already-weakened pump.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Cardiovascular-system chapter — cardiac tonic protocol for diminished cardiac action",
        },
        secondary: {
          ...WHO_HAWTHORN_VOL2,
          locator:
            "On Crataegus folium cum flore in mild cardiac insufficiency and the modern hawthorn evidence base",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Qi Deficiency (心气虚)",
          observation:
            "TCM observation: weak pulse, palpitations on exertion, post-exertion fatigue, low voice, easy sweating, pale tongue — empirically continuous with Cook's depression of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Qi deficiency at cardiovascular function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mild Vyana Vata weakness with rasa-dushti",
          observation:
            "Ayurvedic observation: Vyana Vata (the sub-dosha governing systemic circulation) showing weak amplitude paired with mild rasa-dushti — empirically continuous with Cook's depression of the cardiovascular system.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — early Vyana Vata weakness and rasa-dushti",
          },
        },
      ],
    },
    torpor: {
      slug: "cardiovascular_torpor",
      displayName: "Torpor of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "Circulation has settled into sustained low gear — chronic cold deep extremities, livedo reticularis, slow-to-warm tissue, sluggish capillary return. The pump runs but the periphery is cold.",
      description:
        "Cook (1869) describes cardiovascular torpor as depression that has settled into sustained low circulatory amplitude: chronic cold deep extremities, livedo reticularis, slow capillary return on blanching, sluggish peripheral perfusion that does not lift even with movement. Felter (1922) prescribes warming circulatory stimulants as the cornerstone class (capsicum, ginger, prickly ash, rosemary) paired with cardiac tonics (hawthorn) to break the circulatory inertness and restore peripheral perfusion without overdriving the cardiac pump itself.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Cardiovascular-system chapter — warming circulatory stimulant protocol for sustained circulatory torpor",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On circulatory stimulant protocols for chronic cold-extremity and peripheral-perfusion presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Yang Deficiency (心阳虚)",
          observation:
            "TCM observation: cold extremities, slow circulation, pale-bluish lips, weak slow pulse, sustained low cardiac drive — empirically continuous with Cook's torpor of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Yang deficiency at cardiovascular function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Kapha aggravation at hridaya with Vata-cold features",
          observation:
            "Ayurvedic observation: heart (hridaya) showing the heavy-cold-slow qualities of Kapha aggravation paired with Vata's cold-quality at the periphery — sustained low circulation. Empirically continuous with Cook's torpor.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Kapha-Vata samsarga at hridaya with peripheral cold",
          },
        },
      ],
    },
    atrophy: {
      slug: "cardiovascular_atrophy",
      displayName: "Atrophy of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "The cardiovascular tissue is wasting — vascular wall thinning, structural cardiac decline, the cardiomyopathy and chronic-heart-failure spectrum. Function is diminished and the muscle itself has thinned.",
      description:
        "Cook (1869) describes cardiovascular atrophy as the structural-loss endpoint of the cardiac depletion progression: thinning of vascular walls, cardiac muscle losing mass and contractile reserve, and the chronic-heart-failure spectrum where compensation is exhausted. Felter (1922) prescribes hawthorn as the long-haul restorative paired with nutritive mineralizers (nettle, alfalfa) and protective demulcents — agents that supply substrate for cardiovascular rebuilding rather than merely pushing the failing pump. Aggressive stimulation of atrophic cardiac tissue is contraindicated; the tissue lacks the substrate to respond and the reserve to absorb the demand.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Crataegus oxyacantha (hawthorn) protocol for chronic cardiac insufficiency and cardiovascular atrophy",
        },
        secondary: {
          ...WHO_HAWTHORN_VOL2,
          locator:
            "On Crataegus folium cum flore in chronic heart failure (NYHA II) and the modern evidence base",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Yin / Heart-Blood Deficiency with structural feature (心阴虚 / 心血虚)",
          observation:
            "TCM observation: cardiac atrophic features with thready weak pulse, palpitations, structural cardiac decline, glossy red tongue with peeled coat — empirically continuous with Cook's atrophy of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Yin and Heart-Blood deficiency with structural decline",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Rakta-kshaya and mamsa-kshaya at hridaya",
          observation:
            "Ayurvedic observation: blood (rakta-dhatu) and cardiac muscle (mamsa-dhatu at hridaya) showing kshaya — structural depletion of the cardiovascular substrate. Empirically continuous with Cook's atrophy.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — rakta-kshaya and mamsa-kshaya at the cardiac substrate",
          },
        },
      ],
    },
    atony: {
      slug: "cardiovascular_atony",
      displayName: "Atony of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "The vascular walls have lost tone — varicosities, hemorrhoids, dependent edema, spider veins, gravitational pooling. Vessels are present but no longer braced against gravity.",
      description:
        "Cook (1869) describes cardiovascular atony as loss of vascular tone — primarily on the venous side: varicose veins, hemorrhoids, dependent edema, spider veins, gravitational pooling, and the venous-insufficiency spectrum. Atony is distinct from atrophy (substance loss) and from depression (drive loss); the vessels are structurally present but the bracing tone that ordinarily resists hydrostatic pressure has dropped. Felter (1922) prescribes vascular astringents (witch hazel, butcher's broom, horse chestnut, yellow dock) paired with venous tonics (ginkgo historically, hawthorn at tonic dose) and nutritive supports to consolidate vessel-wall tone.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Cardiovascular-system chapter — vascular astringent protocol for atonic venous presentations",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On venous-tonic and astringent protocols for chronic venous insufficiency in modern phytotherapy",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Sinking with vascular prolapse features",
          observation:
            "TCM observation: vascular prolapse-tendency (varicose veins, hemorrhoids), bearing-down sensation, fatigue worsened by standing, dependent edema — empirically continuous with Cook's atony of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi sinking with vascular tone-loss",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vyana Vata vikriti with mamsa-laxity at vascular tunics",
          observation:
            "Ayurvedic observation: Vyana Vata (governing circulation) presenting with weak amplitude paired with muscle-tissue laxity at vascular walls — varicosity, edema, gravitational pooling. Empirically continuous with Cook's atony.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Vyana Vata vikriti with mamsa-laxity at the vascular tunics",
          },
        },
      ],
    },
    excitation: {
      slug: "cardiovascular_excitation",
      displayName: "Excitation of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "The cardiovascular system is running heightened — tachycardia, palpitations, surges of blood pressure, hot flushes, sympathetic-driven cardiac reactivity above baseline.",
      description:
        "Cook (1869) describes cardiovascular excitation as heightened cardiac and vascular activity above baseline: tachycardia, palpitations, surges of blood pressure with stress, hot flushes, sympathetic-driven cardiac reactivity, and the easy startle pattern with cardiovascular signature. Excitation precedes irritation as the entry-state of cardiovascular over-reactivity. Felter (1922) prescribes cardiac sedatives and relaxant nervines (motherwort as the workhorse, hawthorn at relaxant dose, lemon balm, scullcap) paired with refrigerant supports — agents that calm cardiac over-reactivity without depressing baseline cardiac function.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Leonurus cardiaca (motherwort) and Crataegus protocol for cardiac excitation and palpitations",
        },
        secondary: {
          ...WHO_HAWTHORN_VOL2,
          locator:
            "On Crataegus in mild palpitations and cardiac-anxiety presentations within the WHO evidence base",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heart-Fire / Heart-Yin Deficiency with Empty Heat (心火 / 心阴虚火旺)",
          observation:
            "TCM observation: heightened cardiac activity with rapid pulse, palpitations, restless sleep, red tongue tip — empirically continuous with Cook's excitation of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heart-Fire and Heart-Yin deficiency with empty heat",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Sadhaka Pitta surge at hridaya with Pitta-rakta aggravation",
          observation:
            "Ayurvedic observation: Sadhaka Pitta (sub-dosha of Pitta seated at the heart) surging with rakta-dhatu Pitta aggravation — palpitations, hot flushes, easy emotional reactivity at the cardiac level. Empirically continuous with Cook's excitation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Sadhaka Pitta and rakta Pitta at hridaya",
          },
        },
      ],
    },
    irritation: {
      slug: "cardiovascular_irritation",
      displayName: "Irritation of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "Cardiovascular tissue is sustained inflamed — chronic vascular inflammation, vasculitis spectrum, endothelial dysfunction. The defensive cascade in the vessels has tipped hot and stayed hot.",
      description:
        "Cook (1869) describes cardiovascular irritation as excitation that has tipped into sustained inflammation of cardiovascular tissue: chronic vascular inflammation, vasculitis spectrum, endothelial dysfunction with the modern atherosclerosis-precursor phenotype, and the inflammatory cardiomyopathy patterns. Irritation differs from excitation by chronicity and by structural change to the vessel wall. Felter (1922) prescribes refrigerant alteratives (red clover, cleavers, burdock root) paired with anti-inflammatory cardiotonics (hawthorn at sustained dose) and nervine relaxants — agents that cool sustained inflammation without further driving cardiac reactivity.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Cardiovascular-system chapter — refrigerant-alterative protocol for chronic cardiovascular inflammation",
        },
        secondary: {
          ...NCCIH_HERBS_AT_A_GLANCE,
          locator:
            "On hawthorn, garlic, hibiscus and cardiovascular anti-inflammatory phytotherapy in NIH-curated overviews",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Heat in the Blood / Liver-Fire Affecting the Heart (血热 / 肝火攻心)",
          observation:
            "TCM observation: chronic inflammatory cardiovascular state with red lesions, hot face, surging pulse, sustained vascular inflammation — empirically continuous with Cook's irritation of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Heat in the Blood and Liver-Fire affecting cardiovascular tissue",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-rakta with chronic dhatu-dushti at vascular tissue",
          observation:
            "Ayurvedic observation: Pitta-aggravated rakta-dhatu showing chronic dushti at vascular substrate — sustained heat, inflammation, structural change. Empirically continuous with Cook's irritation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Pitta-rakta with chronic vascular dhatu-dushti",
          },
        },
      ],
    },
    constriction: {
      slug: "cardiovascular_constriction",
      displayName: "Constriction of the Cardiovascular System",
      category: "tissue_state_by_system",
      shortDescription:
        "The vascular tone is gripping — vasoconstrictive hypertension, Raynaud-spectrum cold-driven constriction, blood pressure surges with stress. Vessels are narrowed and braced.",
      description:
        "Cook (1869) describes cardiovascular constriction as sustained contractile bracing of the vascular wall: vasoconstrictive hypertension, Raynaud-spectrum cold-driven peripheral constriction, blood pressure surges with stress, and the smooth-muscle gripping that narrows the vascular bed. Constriction differs from atony in direction (atony loses tone; constriction grips) and from irritation in mechanism (irritation inflames; constriction spasms). Felter (1922) prescribes vasodilator antispasmodics (lobelia at low dose, valerian, cramp bark, hawthorn at relaxant dose) paired with relaxant nervines and warming peripheral diffusives to release the bracing without depleting cardiac reserve.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Cardiovascular-system chapter — vasodilator-antispasmodic protocol for constrictive vascular presentations",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On vasodilator-antispasmodic protocols for hypertensive and Raynaud-spectrum presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Qi Stagnation Affecting the Heart / Heart-Blood Stasis (心血瘀)",
          observation:
            "TCM observation: vascular constriction with sharp fixed cardiac pain, dark tongue, wiry pulse, blood-pressure surges with emotional stress — empirically continuous with Cook's constriction of the cardiovascular system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Qi stagnation and Heart-Blood stasis at vascular tone",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-aggravated srotas-sankocha at rakta-vaha",
          observation:
            "Ayurvedic observation: rakta-vaha srotas (blood-carrying channels) showing the dry-constricting quality of aggravated Vata — vessels narrowed, peripheral cold, surges of pressure. Empirically continuous with Cook's constriction.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — srotas-sankocha at rakta-vaha within Vata vikriti",
          },
        },
      ],
    },
  },

  /* ===================== RESPIRATORY SYSTEM (7 cells) ===================== */
  respiratory: {
    depression: {
      slug: "respiratory_depression",
      displayName: "Depression of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "Breathing is running below par — shallow breath, weak voice, easy shortness of breath with exertion, low oxygen tolerance. The lungs are intact but the drive is dim.",
      description:
        "Cook (1869) describes respiratory depression as diminished respiratory vital action: shallow breathing, weak voice, easy shortness of breath with light exertion, and low oxygen tolerance — without yet entering torpor or atrophy of the lung tissue. Felter (1922) prescribes respiratory tonics (elecampane, mullein, hyssop) paired with mild diaphoretics (yarrow, boneset at low dose) and warming circulatory supports — agents that lift respiratory function without overdriving an already-weakened system.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Respiratory-system chapter — respiratory tonic protocol for diminished pulmonary action",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On respiratory-tonic protocols for low-tone pulmonary presentations in modern Western herbalism",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung-Qi Deficiency (肺气虚)",
          observation:
            "TCM observation: weak voice, shallow breathing, easy shortness of breath, easy spontaneous sweating, pale tongue — empirically continuous with Cook's depression of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Lung-Qi deficiency at respiratory function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Prana Vata weakness with mild dushti at pranavaha srotas",
          observation:
            "Ayurvedic observation: Prana Vata (sub-dosha governing intake of breath) presenting with weak amplitude — shallow breath, weak voice, low respiratory drive. Empirically continuous with Cook's depression.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — early Prana Vata weakness at pranavaha srotas",
          },
        },
      ],
    },
    torpor: {
      slug: "respiratory_torpor",
      displayName: "Torpor of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "The respiratory system has settled into sustained congestion — chronic catarrh, productive cough, congested chest, mucus that is slow to clear. The wet-cold state has settled in.",
      description:
        "Cook (1869) describes respiratory torpor as depression that has settled into sustained chest congestion: chronic catarrh, productive cough with copious mucus, congested chest with slow clearance, and the cold-wet pulmonary terrain that ordinary breathing cannot lift. Felter (1922) prescribes warming expectorants as the cornerstone class (elecampane, hyssop, thyme, garlic, ginger) paired with stimulating diaphoretics — agents that break the inertness, stimulate ciliary function, and clear stagnant phlegm without further chilling the lung.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Respiratory-system chapter — warming-expectorant protocol for chronic catarrhal torpor",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On warming-expectorant protocols for chronic catarrhal and phlegm-cold pulmonary presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Phlegm-Cold Obstructing the Lung (寒痰阻肺)",
          observation:
            "TCM observation: chronic copious clear or white phlegm, cold chest, productive cough worse with cold, white greasy tongue coat — empirically continuous with Cook's torpor of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Phlegm-Cold obstructing the Lung",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Kapha vikriti with kapha-srotas-sanga at pranavaha",
          observation:
            "Ayurvedic observation: pranavaha srotas (breath channel) obstructed by Kapha's heavy-cold-sticky qualities — chronic congestion, copious mucus, sluggish breath. Empirically continuous with Cook's torpor.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — Kapha-srotas-sanga at pranavaha",
          },
        },
      ],
    },
    atrophy: {
      slug: "respiratory_atrophy",
      displayName: "Atrophy of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "Lung tissue is wasting — alveolar thinning, emphysematous spectrum, atrophic rhinitis, dry mucosa with persistent dry cough. Function is diminished and the tissue itself has thinned.",
      description:
        "Cook (1869) describes respiratory atrophy as the wasting endpoint of the pulmonary depletion progression: alveolar thinning (the emphysematous spectrum), atrophic rhinitis with dry crusting mucosa, dry persistent unproductive cough, and progressive loss of respiratory reserve. Felter (1922) prescribes demulcent restoratives as the cornerstone class (slippery elm, marshmallow root, licorice root, comfrey leaf historically) paired with nutritive mineralizers (nettle, alfalfa) and gentle expectorant supports — agents that supply substrate for mucosal rebuilding rather than further drying an already-atrophic system.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Demulcent restorative protocol — Althaea, Glycyrrhiza, Ulmus for atrophic and dry pulmonary presentations",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On demulcent and mucosal-rebuilding protocols for chronic dry-atrophic pulmonary presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung-Yin Deficiency (肺阴虚)",
          observation:
            "TCM observation: dry persistent cough, atrophic mucosa, dry throat, low afternoon fevers, glossy red tongue with peeled coat — empirically continuous with Cook's atrophy of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Lung-Yin deficiency with mucosal atrophy",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata aggravation at pranavaha srotas with mucosal kshaya",
          observation:
            "Ayurvedic observation: pranavaha srotas showing the dry-rough quality of aggravated Vata paired with mucosal substrate depletion — dry cough, mucosal thinning, atrophic features. Empirically continuous with Cook's atrophy.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Vata vikriti at pranavaha with mucosal kshaya",
          },
        },
      ],
    },
    atony: {
      slug: "respiratory_atony",
      displayName: "Atony of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "The lungs and bronchi have lost tone — loose cough without strength to clear, weak diaphragm, lax bronchial wall, dependent rales in elderly. Tissue is present but no longer braced.",
      description:
        "Cook (1869) describes respiratory atony as loss of tone in the bronchial wall and respiratory musculature: loose productive cough without sufficient strength to clear, weak diaphragmatic excursion, lax bronchial wall with poor recoil, dependent rales in the elderly, and the prolapse-tendency that follows from sustained tone loss. Felter (1922) prescribes tonic expectorants (mullein, horehound, elecampane, hyssop) paired with astringent supports and warming diffusives to consolidate respiratory tone without depleting an already-flaccid pulmonary terrain.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Respiratory-system chapter — tonic-expectorant protocol for atonic pulmonary presentations",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On tonic-expectorant and respiratory-strengthening protocols in modern phytotherapy",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung-Qi Sinking with respiratory prolapse features",
          observation:
            "TCM observation: weak ineffectual cough, prolapse-tendency at the lung, fatigue worsened by speaking, dependent rales — empirically continuous with Cook's atony of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Lung-Qi sinking with respiratory tone-loss",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mamsa-laxity at bronchial wall within Kapha vikriti",
          observation:
            "Ayurvedic observation: bronchial muscle (mamsa-dhatu at pranavaha) showing slackness within Kapha-aggravated terrain — weak recoil, lax bronchial wall. Empirically continuous with Cook's atony.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — mamsa-laxity at the bronchial wall in Kapha vikriti",
          },
        },
      ],
    },
    excitation: {
      slug: "respiratory_excitation",
      displayName: "Excitation of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "The respiratory system is running heightened — hyperventilation, dry hacking cough, tickly throat, allergic-spectrum reactivity. Sensitivity is amplified above baseline.",
      description:
        "Cook (1869) describes respiratory excitation as heightened pulmonary reactivity above baseline: hyperventilation, dry hacking unproductive cough, tickly throat, allergic-spectrum reactivity (hay fever pattern), and easy provocation by inhaled stimuli. Excitation precedes irritation as the entry-state of pulmonary over-reactivity. Felter (1922) prescribes relaxant demulcents (marshmallow root, licorice, slippery elm) paired with low-dose lobelia (the canonical respiratory antispasmodic) and sedating nervines — agents that calm pulmonary over-reactivity without depressing baseline respiratory drive.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Lobelia inflata low-dose protocol for excited pulmonary states with bronchial reactivity",
        },
        secondary: {
          ...AHPA_BOTANICAL_SAFETY,
          locator:
            "On lobelia safety and contraindications in excited pulmonary protocols",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung-Heat / Wind-Heat Invading the Lung (肺热 / 风热犯肺)",
          observation:
            "TCM observation: hyperreactive lung function with dry cough, tickly throat, easy provocation by allergens, red tongue tip, rapid pulse — empirically continuous with Cook's excitation of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Lung-Heat and Wind-Heat at respiratory function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-aggravated pranavaha with Vata reactivity",
          observation:
            "Ayurvedic observation: pranavaha srotas showing Pitta heat with Vata's reactive-mobility quality — dry hacking cough, hypersensitive lung, allergic surge. Empirically continuous with Cook's excitation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Pitta-Vata samsarga at pranavaha srotas",
          },
        },
      ],
    },
    irritation: {
      slug: "respiratory_irritation",
      displayName: "Irritation of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "The respiratory mucosa is sustained inflamed — bronchitis, sinusitis, throat ulceration, sustained inflammatory cough with productive yellow phlegm. The defensive cascade has tipped hot.",
      description:
        "Cook (1869) describes respiratory irritation as excitation that has tipped into sustained mucosal inflammation: bronchitis-spectrum chronic inflammation, sinusitis with thickened secretions, throat ulceration, productive yellow or green phlegm signaling pus and inflammation, and the wet-hot pulmonary terrain. Felter (1922) prescribes anti-inflammatory demulcents (marshmallow, slippery elm, plantain, calendula) paired with refrigerant alteratives (yellow dock, burdock) and gentle anti-microbial supports — agents that cool sustained inflammation without further drying or stimulating the inflamed mucosa.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Respiratory-system chapter — anti-inflammatory demulcent protocol for inflamed pulmonary mucosa",
        },
        secondary: {
          ...AHPA_BOTANICAL_SAFETY,
          locator:
            "On safety bounds for anti-inflammatory and alterative protocols in inflammatory pulmonary presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung-Heat / Damp-Heat in Lung (肺热 / 湿热壅肺)",
          observation:
            "TCM observation: productive yellow or green phlegm, bronchial inflammation, throat ulceration, yellow greasy tongue coat — empirically continuous with Cook's irritation of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Damp-Heat in the Lung with productive inflammation",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-Kapha samsarga at pranavaha (chronic inflammatory mucus)",
          observation:
            "Ayurvedic observation: pranavaha srotas showing Pitta heat combined with Kapha's mucus-substrate — chronic inflammatory mucus, productive cough, mucosal redness. Empirically continuous with Cook's irritation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Pitta-Kapha samsarga at pranavaha srotas",
          },
        },
      ],
    },
    constriction: {
      slug: "respiratory_constriction",
      displayName: "Constriction of the Respiratory System",
      category: "tissue_state_by_system",
      shortDescription:
        "The airways are gripping — bronchospasm, asthma-spectrum constriction, wheeze, chest tightness, smooth-muscle spasm in the bronchi. Channels are narrowed and braced.",
      description:
        "Cook (1869) describes respiratory constriction as sustained contractile bracing of bronchial smooth muscle: bronchospasm, asthma-spectrum constriction with wheeze, chest tightness, neurogenic asthma triggered by emotional or sensory stimulus, and the gripping that narrows airways without necessarily inflaming them. Constriction differs from atony in direction (atony loses tone; constriction grips) and from irritation in mechanism (irritation inflames; constriction spasms — though the two often coexist in chronic asthma). Felter (1922) prescribes respiratory antispasmodics as the cornerstone class (lobelia at clinical dose, ephedra historically with strict bounds, cramp bark) paired with relaxant nervines and warming diffusives.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Lobelia inflata clinical-dose protocol for bronchospasm and asthma-spectrum presentations",
        },
        secondary: {
          ...AHPA_BOTANICAL_SAFETY,
          locator:
            "On lobelia and ephedra safety and contraindications in asthma and bronchospasm protocols",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Qi Stagnation Invading Lung / Cold-Damp Constraint (肝气犯肺)",
          observation:
            "TCM observation: bronchospasm worsened by emotional stress, chest tightness, wheeze, sighing, deep slow tense pulse — empirically continuous with Cook's constriction of the respiratory system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Qi stagnation invading the Lung",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-aggravated pranavaha srotas-sankocha (Tamaka Shvasa)",
          observation:
            "Ayurvedic observation: pranavaha srotas showing the dry-constricting quality of aggravated Vata — bronchospasm, wheeze, chest tightness. The Caraka Samhita names the asthma phenotype Tamaka Shvasa. Empirically continuous with Cook's constriction.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Chikitsasthana — Tamaka Shvasa within Vata-aggravated pranavaha",
          },
        },
      ],
    },
  },

  /* ==================== MUSCULOSKELETAL SYSTEM (7 cells) ==================== */
  musculoskeletal: {
    depression: {
      slug: "musculoskeletal_depression",
      displayName: "Depression of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "The musculoskeletal system is running below par — weakness, low muscular drive, easy fatigue with light load, slow recovery from exertion. The structure is intact but the drive is dim.",
      description:
        "Cook (1869) describes musculoskeletal depression as diminished muscular vital action: weakness with light load, low contractile drive, easy fatigue, slow recovery from exertion — without yet entering torpor or wasting of muscle substance. Felter (1922) prescribes mineral nutritives as the cornerstone class (alfalfa, nettle, oat straw, horsetail) paired with mild warming circulatory stimulants (ginger, prickly ash) — agents that lift muscular function and supply substrate without overdriving an already-weakened structural terrain.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Musculoskeletal-system chapter — nutritive-mineral protocol for diminished muscular action",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On nutritive-mineralizer protocols for low-tone musculoskeletal presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Deficiency at the Muscles (脾主肌肉)",
          observation:
            "TCM observation: muscle weakness, easy fatigue, weak limbs, diminished muscular drive (the Spleen governs the muscles in TCM correspondence) — empirically continuous with Cook's depression of the musculoskeletal system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi deficiency at muscle function",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mild dushti at mamsa-dhatu",
          observation:
            "Ayurvedic observation: muscle tissue (mamsa-dhatu) showing mild functional impairment without yet entering kshaya — weakness, low contractile reserve, slow recovery. Empirically continuous with Cook's depression.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — early mamsa-dhatu dushti",
          },
        },
      ],
    },
    torpor: {
      slug: "musculoskeletal_torpor",
      displayName: "Torpor of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "The musculoskeletal system has settled into sustained heaviness — cold deep aching, stiffness on rising, slow-warming muscles, sustained heavy fatigue in the limbs.",
      description:
        "Cook (1869) describes musculoskeletal torpor as depression that has settled into sustained heaviness and cold: chronic deep aching, morning stiffness that takes prolonged movement to lift, slow-warming muscles, joint heaviness in cold weather, and the cold-damp impediment phenotype. Felter (1922) prescribes warming circulatory stimulants (capsicum, ginger, prickly ash, cayenne) paired with diaphoretic nutritives (yarrow, alfalfa) and topical warming counter-irritants — agents that break the inertness and restore peripheral circulation to cold-stagnant musculoskeletal tissue.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Musculoskeletal-system chapter — warming-stimulant protocol for cold-damp musculoskeletal torpor",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On warming circulatory protocols for chronic cold-damp musculoskeletal presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Cold-Damp Bi (寒湿痹) — cold-damp impediment",
          observation:
            "TCM observation: heavy aching joints worsened by cold and damp, morning stiffness that takes time to lift, deep cold sensation, white greasy tongue coat — empirically continuous with Cook's torpor of the musculoskeletal system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Cold-Damp Bi at the joints and muscles",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Kapha-Vata samsarga at mamsa with cold-stagnant features",
          observation:
            "Ayurvedic observation: muscle tissue showing Kapha's heavy-cold-slow qualities paired with Vata's cold quality — sustained heavy aching, slow warming, stiff joints. Empirically continuous with Cook's torpor.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Kapha-Vata samsarga at mamsa-dhatu and sandhi",
          },
        },
      ],
    },
    atrophy: {
      slug: "musculoskeletal_atrophy",
      displayName: "Atrophy of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "Musculoskeletal tissue is wasting — sarcopenia, osteoporosis, thinning bones, structural muscle loss. Function is diminished and the structure itself is shrinking.",
      description:
        "Cook (1869) describes musculoskeletal atrophy as the wasting endpoint of the musculoskeletal depletion progression: sarcopenia (structural muscle wasting), osteoporosis (bone thinning), tendinous degeneration, and the cumulative substance loss that progressive disuse, age, or chronic illness produces. Felter (1922) prescribes mineral nutritives as the cornerstone class (horsetail, nettle, oat straw, alfalfa, chickweed) paired with trophic restoratives — agents that supply substrate for bone, muscle, and connective-tissue rebuilding rather than merely stimulating an already-substrate-depleted structural terrain.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Mineral-nutritive protocol — Equisetum, Urtica, Avena, Medicago for musculoskeletal substrate rebuilding",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On mineral-nutritive and trophorestorative protocols for sarcopenia and osteoporosis presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Kidney Essence Depletion at Bones / Liver-Blood Deficiency at Sinews",
          observation:
            "TCM observation: bone substance loss (Kidney governs the bones), sinew weakness with cramping (Liver governs the sinews), structural muscle wasting (Spleen governs the muscles) — empirically continuous with Cook's atrophy of the musculoskeletal system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Kidney essence depletion at bones; Liver-Blood deficiency at sinews",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Asthi-kshaya, mamsa-kshaya, majja-kshaya",
          observation:
            "Ayurvedic observation: bone (asthi-dhatu), muscle (mamsa-dhatu), and marrow (majja-dhatu) showing kshaya — substance depletion across the structural dhatus. Empirically continuous with Cook's atrophy.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sharirasthana — asthi / mamsa / majja-dhatu kshaya",
          },
        },
      ],
    },
    atony: {
      slug: "musculoskeletal_atony",
      displayName: "Atony of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "Musculoskeletal tissue has lost tone — lax tendons and ligaments, hypermobility, joint instability, prolapse-prone joints. Tissue is present but no longer braced.",
      description:
        "Cook (1869) describes musculoskeletal atony as loss of tone in tendons, ligaments, and muscle without yet substance loss: lax connective tissue, hypermobile joints with instability, prolapse-prone joints, weak elastic recoil at the joint capsule, and the chronic-instability presentation distinct from acute injury. Felter (1922) prescribes astringent nutritives (yellow dock, horsetail, nettle, oak bark) paired with mineral and trophic supports to consolidate connective-tissue tone without further stimulation of an already-flaccid structural terrain.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Musculoskeletal-system chapter — astringent-nutritive protocol for atonic connective tissue",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On connective-tissue tonic protocols for hypermobility and joint-instability presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Deficiency with Liver-Blood Deficiency at the Sinews",
          observation:
            "TCM observation: lax sinews with weak grip, hypermobility, joint instability, dropping reflexes (Spleen weakness at muscle paired with Liver-Blood deficiency at sinew) — empirically continuous with Cook's atony of the musculoskeletal system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi deficiency and Liver-Blood deficiency at sinews",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Snayu-laxity / mamsa-laxity in Kapha vikriti",
          observation:
            "Ayurvedic observation: snayu (sinew / ligament) and mamsa (muscle) tissues showing slackness within Kapha-aggravated terrain — hypermobility, joint instability, weak tone. Empirically continuous with Cook's atony.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sharirasthana — snayu and mamsa laxity in Kapha vikriti",
          },
        },
      ],
    },
    excitation: {
      slug: "musculoskeletal_excitation",
      displayName: "Excitation of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "The musculoskeletal system is running heightened — muscle twitching, fasciculations, restless legs, hyperreflexia, jumpy muscles. Reactivity is amplified above baseline.",
      description:
        "Cook (1869) describes musculoskeletal excitation as heightened muscular reactivity above baseline: muscle twitching, fasciculations, restless legs, hyperreflexia, jumpy easily-startled muscles, and the irritable-muscle phenotype that often signals mineral imbalance or sympathetic overdrive. Excitation precedes irritation as the entry-state of musculoskeletal over-reactivity. Felter (1922) prescribes muscular relaxants and antispasmodics (cramp bark, lobelia at low dose, scullcap, valerian) paired with magnesium-rich nutritives (oat straw, nettle) — agents that calm overactive muscle without depressing baseline contractile drive.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Musculoskeletal-system chapter — antispasmodic-nutritive protocol for excited muscular states",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On antispasmodic and mineral-nutritive protocols for muscle hyperreactivity and restless-legs presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Wind Stirring (肝风内动)",
          observation:
            "TCM observation: muscle twitching, tremor, restless limbs, fasciculations, hyperreflexia — empirically continuous with Cook's excitation of the musculoskeletal system. Liver-Wind is the canonical TCM correlate.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Wind stirring at the muscles and sinews",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-Pitta aggravation at mamsa-dhatu (heightened reactivity)",
          observation:
            "Ayurvedic observation: muscle tissue showing Vata's mobility quality combined with Pitta's heat — twitching, restless, hyperreactive. Empirically continuous with Cook's excitation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Vata-Pitta samsarga at mamsa with hyperreactive features",
          },
        },
      ],
    },
    irritation: {
      slug: "musculoskeletal_irritation",
      displayName: "Irritation of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "Musculoskeletal tissue is sustained inflamed — arthritis-spectrum joint inflammation, chronic synovitis, fibromyalgia-spectrum hyperalgesia, sustained joint pain and redness.",
      description:
        "Cook (1869) describes musculoskeletal irritation as excitation that has tipped into sustained inflammation: arthritis-spectrum joint inflammation, chronic synovitis with effusion, fibromyalgia-spectrum hyperalgesia, sustained joint pain with redness and heat, and the inflammatory rheumatic phenotype. Felter (1922) prescribes anti-inflammatory and analgesic herbs (devil's claw historically, willow bark, meadowsweet) paired with demulcents (marshmallow root) and alteratives (yellow dock, burdock) — agents that cool sustained inflammation and modulate the inflammatory cascade without further driving an already-inflamed musculoskeletal terrain.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Musculoskeletal-system chapter — anti-inflammatory and alterative protocol for chronic rheumatic inflammation",
        },
        secondary: {
          ...AHPA_BOTANICAL_SAFETY,
          locator:
            "On anti-inflammatory herbs (willow bark, devil's claw, meadowsweet) safety and contraindications in chronic inflammatory presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Damp-Heat Bi / Wind-Damp-Heat (湿热痹)",
          observation:
            "TCM observation: sustained joint inflammation with redness, swelling, heat, restricted movement, yellow greasy tongue coat — empirically continuous with Cook's irritation of the musculoskeletal system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Damp-Heat Bi with chronic joint inflammation",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Ama-Vata / Pitta-aggravated dhatu-dushti at sandhi (joints)",
          observation:
            "Ayurvedic observation: sandhi (joints) showing chronic inflammation from ama-vata (the rheumatoid-equivalent phenotype) and Pitta-aggravated dhatu-dushti. The Caraka Samhita Chikitsasthana describes ama-vata explicitly.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Chikitsasthana — ama-vata and Pitta-dushti at sandhi",
          },
        },
      ],
    },
    constriction: {
      slug: "musculoskeletal_constriction",
      displayName: "Constriction of the Musculoskeletal System",
      category: "tissue_state_by_system",
      shortDescription:
        "Musculoskeletal tissue is held under sustained bracing — chronic muscle spasm, cramping, fascia adhesion, postural holding patterns, TMJ tension, the chronic-tension phenotype.",
      description:
        "Cook (1869) describes musculoskeletal constriction as sustained contractile bracing of skeletal muscle and fascia: chronic muscle spasm, cramping, fascia adhesion, postural holding patterns (the rounded-shoulder bracing pattern), TMJ tension, and the gripping pattern that limits joint range without inflammation as the primary driver. Constriction differs from atony in direction (atony loses tone; constriction grips) and from irritation in mechanism (irritation inflames; constriction spasms — though chronic constriction often produces secondary inflammation). Felter (1922) prescribes the antispasmodic class as cornerstone (cramp bark, black cohosh, lobelia, valerian) paired with relaxant nervines and topical warmth.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Viburnum opulus (cramp bark), Cimicifuga, Lobelia antispasmodic protocol for chronic musculoskeletal constriction",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On antispasmodic and nervine-relaxant protocols for chronic musculoskeletal-tension presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Qi Stagnation at the Sinews (the Liver governs sinews in TCM)",
          observation:
            "TCM observation: chronic muscle bracing, cramping, fascia tightness, sighing, jaw / shoulder holding — empirically continuous with Cook's constriction of the musculoskeletal system. The Liver governs the sinews in TCM correspondence.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Qi stagnation at sinews / fascia",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-aggravated srotas-sankocha at mamsa-vaha and snayu",
          observation:
            "Ayurvedic observation: muscle and sinew channels (mamsa-vaha srotas, snayu) showing the dry-constricting quality of aggravated Vata — spasm, cramping, fascia tightness. Empirically continuous with Cook's constriction.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — srotas-sankocha at mamsa-vaha and snayu in Vata vikriti",
          },
        },
      ],
    },
  },

  /* ==================== INTEGUMENTARY SYSTEM (7 cells) ==================== */
  integumentary: {
    depression: {
      slug: "integumentary_depression",
      displayName: "Depression of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "The skin is running below par — pallor, slow healing of minor wounds, weak sweat response, dull complexion. Function is diminished but the skin's structure is intact.",
      description:
        "Cook (1869) describes integumentary depression as diminished cutaneous vital action: pallor, slow healing of minor wounds, weak diaphoretic response, dull complexion, low surface immunity — without yet entering torpor or atrophy. Cook treats the skin as both a presenting surface and an active eliminative organ; depression diminishes both functions. Felter (1922) prescribes mild alteratives (cleavers, calendula, red clover) paired with nutritive supports (nettle, alfalfa) and gentle diaphoretics — agents that lift cutaneous and lymphatic function without overdriving an already-weakened surface.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Integumentary-system chapter — mild alterative and diaphoretic protocol for diminished cutaneous action",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On alterative and lymphatic protocols for low-tone integumentary presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung Wei-Qi Deficiency at the Skin (卫气虚)",
          observation:
            "TCM observation: pale skin with poor surface defense, easy susceptibility to surface infection, weak spontaneous sweating, slow wound healing — empirically continuous with Cook's depression of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Lung Wei-Qi deficiency at the body surface",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mild rasa-dushti at tvak with mandagni features",
          observation:
            "Ayurvedic observation: tvak (skin) showing rasa-dhatu impairment — pale dull complexion, slow healing — paired with mandagni at the metabolic level. Empirically continuous with Cook's depression.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — rasa-dushti at tvak with mandagni",
          },
        },
      ],
    },
    torpor: {
      slug: "integumentary_torpor",
      displayName: "Torpor of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "The skin has settled into sustained sluggishness — congested sebaceous glands, cystic comedones, sluggish elimination through the skin, sustained dull complexion that does not lift.",
      description:
        "Cook (1869) describes integumentary torpor as depression that has settled into sustained sluggishness of cutaneous elimination: congested sebaceous glands with cystic comedones, sluggish lymphatic drainage at the skin, persistent dull complexion that does not lift with surface stimulation, and the chronic-toxemia presentation Cook frames within the eliminative-organ doctrine. Felter (1922) prescribes stronger alteratives as the cornerstone class (burdock root, yellow dock, cleavers, sarsaparilla, blue flag) paired with lymphatic stimulants and diaphoretics — agents that break the inertness and restore eliminative function through the skin and lymph.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Integumentary-system chapter — stronger alterative protocol for chronic cutaneous torpor and eliminative sluggishness",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On alterative and lymphatic-drainage protocols for chronic cutaneous-eliminative presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Damp Obstruction at the Skin / Phlegm-Damp at the Surface",
          observation:
            "TCM observation: cystic comedones, oily congested skin, sluggish surface elimination, white-yellow greasy tongue coat — empirically continuous with Cook's torpor of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Damp obstruction at the body surface",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Kapha vikriti at tvak with srotas-sanga",
          observation:
            "Ayurvedic observation: tvak channels (svedavaha srotas) obstructed by Kapha's heavy-sticky quality — congested sebaceous, cystic eruptions, sluggish surface elimination. Empirically continuous with Cook's torpor.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Vimanasthana — Kapha-srotas-sanga at svedavaha and tvak",
          },
        },
      ],
    },
    atrophy: {
      slug: "integumentary_atrophy",
      displayName: "Atrophy of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "Skin tissue is wasting — thinning, fragile, easy bruising, age-spotting, hair thinning, atrophic skin in elderly. Function is diminished and the substrate itself has thinned.",
      description:
        "Cook (1869) describes integumentary atrophy as the wasting endpoint of the cutaneous depletion progression: thinning skin with fragility and easy bruising, age-spotting, hair thinning, slow-healing chronic ulceration on atrophic skin, and the cumulative substance loss of advanced age or chronic illness. Felter (1922) prescribes nutritive alteratives (yellow dock, nettle, alfalfa, sarsaparilla) paired with topical demulcents (marshmallow root infusion, calendula, plantain) and mineral supports — agents that supply substrate for cutaneous rebuilding rather than further depleting an already-atrophic surface.",
      citations: {
        primaryText: {
          ...FELTER_1922,
          locator:
            "Nutritive-alterative protocol for atrophic skin and chronic skin-ulceration presentations",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On nutritive and topical-demulcent protocols for atrophic-skin and slow-healing-ulcer presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Lung-Yin / Blood-Deficiency at the Skin (肺阴虚 / 血虚)",
          observation:
            "TCM observation: thinning dry skin, atrophic features, slow healing, hair thinning, glossy peeled tongue — empirically continuous with Cook's atrophy of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Lung-Yin and Blood-deficiency at the skin",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Tvak-kshaya, rasa-kshaya",
          observation:
            "Ayurvedic observation: tvak (skin) and rasa-dhatu showing kshaya — substance depletion at the cutaneous and plasma levels — thinning, fragility, easy bruising. Empirically continuous with Cook's atrophy.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — tvak and rasa-dhatu kshaya",
          },
        },
      ],
    },
    atony: {
      slug: "integumentary_atony",
      displayName: "Atony of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "The skin has lost tone — sagging, stretch-mark-prone, poor elastic recoil, dependent purpura, varicose feature visible at the skin. Tissue is present but no longer braced.",
      description:
        "Cook (1869) describes integumentary atony as loss of tone in the skin and subcutaneous connective tissue without yet substance loss: sagging skin with poor elastic recoil, stretch-mark tendency, dependent purpura, visible vascular feature at the skin (spider veins, dependent reticular pattern), and the post-weight-loss / post-pregnancy laxity presentation. Felter (1922) prescribes astringent alteratives and topical astringent supports (witch hazel, horsetail, yellow dock, oak bark topically) paired with nutritive mineralizers — agents that consolidate cutaneous tone without further stimulation of an already-flaccid surface.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Integumentary-system chapter — astringent-alterative protocol for atonic cutaneous presentations",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On astringent and tonic-supportive protocols for cutaneous-laxity and elastic-recoil presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Spleen-Qi Sinking at the Skin (Spleen contributes to flesh and skin tone)",
          observation:
            "TCM observation: sagging skin, prolapse-tendency at the cutaneous and subcutaneous level, poor elastic recoil — the Spleen contributes to flesh and skin tone in TCM correspondence. Empirically continuous with Cook's atony of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Spleen-Qi sinking at the cutaneous tone level",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Mamsa-meda laxity at the subcutis in Kapha vikriti",
          observation:
            "Ayurvedic observation: muscle (mamsa-dhatu) and adipose (meda-dhatu) at the subcutaneous level showing slackness within Kapha-aggravated terrain — sagging, stretch-marks, poor elastic recoil. Empirically continuous with Cook's atony.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — mamsa-meda laxity at the subcutis in Kapha vikriti",
          },
        },
      ],
    },
    excitation: {
      slug: "integumentary_excitation",
      displayName: "Excitation of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "The skin is running heightened — hives, urticarial flares, hot flushes through the skin, easy redness, reactive skin that flares with minor stimulus.",
      description:
        "Cook (1869) describes integumentary excitation as heightened cutaneous reactivity above baseline: hives, urticarial flares, hot flushes through the skin, easy redness with minor stimulation, reactive blanching-then-flushing patterns, and the histamine-spectrum presentation. Excitation precedes irritation as the entry-state of cutaneous over-reactivity. Felter (1922) prescribes refrigerant alteratives (cleavers, red clover, chickweed) paired with relaxant nervines and topical demulcents — agents that cool cutaneous over-reactivity without further driving the histamine cascade.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Integumentary-system chapter — refrigerant-alterative protocol for excited cutaneous states",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On refrigerant-alterative and antihistamine-supportive protocols for cutaneous hyperreactivity presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Wind-Heat at the Surface (风热) — urticaria pattern",
          observation:
            "TCM observation: rapidly appearing wandering rash, hives, hot flushes, itching that comes and goes — the Wind-Heat-at-the-surface pattern. Empirically continuous with Cook's excitation of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Wind-Heat at the surface with urticarial features",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Bhrajaka Pitta vikriti with rakta-Pitta surge",
          observation:
            "Ayurvedic observation: Bhrajaka Pitta (sub-dosha at the skin) surging with rakta-Pitta aggravation — hot flushes, urticaria, easy redness. Empirically continuous with Cook's excitation.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Bhrajaka Pitta with rakta-Pitta surge",
          },
        },
      ],
    },
    irritation: {
      slug: "integumentary_irritation",
      displayName: "Irritation of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "Skin tissue is sustained inflamed — eczema, psoriasis, dermatitis-spectrum chronic inflammation, sustained skin redness with scaling, weeping, or thickened plaques.",
      description:
        "Cook (1869) describes integumentary irritation as excitation that has tipped into sustained cutaneous inflammation: eczema, psoriasis, dermatitis-spectrum chronic inflammation, sustained skin redness with scaling or weeping, and the chronic-inflammatory dermatosis phenotype. Cook frames chronic skin inflammation as terrain readout — the skin presenting an internal inflammatory state externally. Felter (1922) prescribes alteratives as the cornerstone class (burdock root, yellow dock, cleavers, sarsaparilla, blue flag) paired with topical demulcents (calendula, marshmallow infusion, plantain), anti-inflammatory supports, and lymphatic drainage — agents that cool sustained inflammation while addressing the internal terrain expressing through the skin.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Integumentary-system chapter — alterative and topical-demulcent protocol for chronic inflammatory dermatoses",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On alterative and anti-inflammatory protocols for eczema, psoriasis, and chronic dermatitis presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Damp-Heat / Blood-Heat at the Skin (湿热 / 血热)",
          observation:
            "TCM observation: chronic eczematous dermatitis with weeping, redness, scaling, urgent itching — the Damp-Heat-at-skin pattern; or red lesions with heat sensation — the Blood-Heat pattern. Empirically continuous with Cook's irritation of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Damp-Heat and Blood-Heat patterns at the skin",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Pitta-Kapha samsarga at tvak with chronic dushti",
          observation:
            "Ayurvedic observation: tvak showing Pitta heat combined with Kapha's mucus-substrate — chronic eczematous and psoriatic dermatoses. The Caraka Samhita describes the kushtha (chronic skin disease) spectrum within this samsarga.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Chikitsasthana — kushtha spectrum within Pitta-Kapha samsarga at tvak",
          },
        },
      ],
    },
    constriction: {
      slug: "integumentary_constriction",
      displayName: "Constriction of the Integumentary System",
      category: "tissue_state_by_system",
      shortDescription:
        "Skin tissue is held under sustained tension — tight cracking skin, scleroderma-spectrum sclerosis, constricted scar tissue, chronic erector pili tension. The surface is gripping.",
      description:
        "Cook (1869) describes integumentary constriction as sustained contractile bracing of the skin and subcutaneous tissue: tight cracking skin in the dry-cold pattern, scleroderma-spectrum sclerosing dermopathies, constricted scar tissue with restricted local movement, chronic erector pili tension (goose-flesh-prone), and the sclerosing patterns where collagen cross-linking restricts surface and underlying tissue movement. Felter (1922) prescribes relaxant alteratives (cleavers, red clover, calendula) paired with topical demulcents and lymphatic-drainage supports — agents that release the surface tension while supporting the dermal substrate without further drying or constricting.",
      citations: {
        primaryText: {
          ...COOK_1869,
          locator:
            "Integumentary-system chapter — relaxant-alterative protocol for constrictive cutaneous presentations",
        },
        secondary: {
          ...HOFFMANN_MEDICAL_HERBALISM,
          locator:
            "On relaxant-alterative and topical-demulcent protocols for sclerosing and constricted-skin presentations",
        },
      },
      traditionalObservations: [
        {
          tradition: "tcm",
          pattern: "Liver-Qi Stagnation Manifesting at the Skin / Blood Stasis at the Surface",
          observation:
            "TCM observation: tight constricted skin worsened by emotional stress, sclerosing patterns, scar-tissue tension, dark-purplish discoloration — empirically continuous with Cook's constriction of the integumentary system.",
          citation: {
            ...HUANGDI_NEIJING,
            locator: "Suwen — Liver-Qi stagnation and Blood-stasis manifesting at the skin",
          },
        },
        {
          tradition: "ayurveda",
          pattern: "Vata-aggravated srotas-sankocha at tvak (dry-constricting cutaneous pattern)",
          observation:
            "Ayurvedic observation: tvak showing the dry-rough-constricting quality of aggravated Vata — tight cracking skin, sclerosing patterns, restricted movement. Empirically continuous with Cook's constriction.",
          citation: {
            ...CARAKA_SAMHITA_KAVIRATNA,
            locator: "Sutrasthana — Vata vikriti at tvak with srotas-sankocha",
          },
        },
      ],
    },
  },
};

/**
 * Typed accessors. Use in UI components and result-rendering surfaces
 * instead of indexing the registries directly — preserves type safety
 * and centralizes any future fallback / observability hook.
 *
 * The TissueState union includes "mixed" as a structural fall-back; calling
 * getTissueStateContent("mixed") returns null. UI consumers that receive a
 * "mixed" reading from the assessment pipeline render the multi-cell
 * presentation rather than a single content entry.
 */
export function getTissueStateContent(state: TissueState): ContentEntry | null {
  if (state === "mixed") return null;
  return TISSUE_STATE_CONTENT[state];
}

export function getOrganSystemContent(system: OrganSystem): ContentEntry {
  return ORGAN_SYSTEM_CONTENT[system];
}

/**
 * Phase 2 cell accessor — returns the (state × system) ContentEntry. The
 * inner registry is typed Partial<Record<...>> for forward-compatibility,
 * but Phase 2 ships every cell populated, so the runtime read returns a
 * defined ContentEntry for every (state, system) pair the AuthoredTissueState
 * × OrganSystem cross-product can produce. Returns undefined only if a
 * future cell is intentionally omitted.
 *
 * UI consumers receiving a "mixed" tissue-state reading should not call
 * this accessor — TissueState "mixed" is not in AuthoredTissueState — and
 * should instead render the multi-cell layout per the same convention as
 * getTissueStateContent.
 */
export function getTissueStateBySystemContent(
  state: AuthoredTissueState,
  system: OrganSystem,
): ContentEntry | undefined {
  return TISSUE_STATE_BY_SYSTEM[system][state];
}


/**
 * Stable ordered lists — useful for rendering all states/systems in
 * comparison cards, deep-diagnostic explainers, and the citation
 * manifest review UI. Order matches Cook 1869's progression from
 * depleted → heightened → contracted, then the canonical Apothecary
 * priority order for the six body systems.
 */
export const TISSUE_STATE_KEYS: readonly AuthoredTissueState[] = [
  "depression",
  "torpor",
  "atrophy",
  "atony",
  "excitation",
  "irritation",
  "constriction",
] as const;

export const ORGAN_SYSTEM_KEYS: readonly OrganSystem[] = [
  "nervous",
  "digestive",
  "cardiovascular",
  "respiratory",
  "musculoskeletal",
  "integumentary",
] as const;
