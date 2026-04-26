/**
 * src/lib/tissueStateProfile.ts
 *
 * LAYER 3 of the DiagnosticProfile — Tissue State by Body System.
 *
 * This module ships PHASE 1 of Layer 3 content: the seven canonical Cook
 * tissue-state descriptions and the six priority body-system descriptions —
 * thirteen entries total. PHASE 2 (a separate PR in a follow-up session)
 * adds the 42 cell-level entries (one per (TissueState × OrganSystem)
 * combination) that describe how each state manifests in each specific
 * system. The phased ship matches the Phase_B_Authoring_Plan_v1.md scope
 * estimate of 2–3 sessions for the largest of the five Phase B modules.
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
