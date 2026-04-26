/**
 * src/lib/galenicTemperament.ts
 *
 * LAYER 2 of the DiagnosticProfile — Galenic Temperament readings.
 *
 * Nine readings: eukrasia (the balanced mixture) plus four simple dyskrasias
 * (hot, cold, dry, wet — one elemental quality dominant) plus four compound
 * dyskrasias (hot+dry choleric, hot+wet sanguine, cold+dry melancholic,
 * cold+wet phlegmatic — two qualities dominant, the four classical
 * temperaments). The framework is canonical in the Galenic tradition:
 * Hippocrates names the four humours and four qualities in De Natura
 * Hominis (5th c. BCE); Galen systematizes them into the temperament
 * doctrine in De Temperamentis (Περὶ Κράσεων, 2nd c. CE); the Eclectic
 * tradition receives the framework into 19th-century American practice
 * via Cook (1869) and Felter (1922); Unani medicine transmits the same
 * framework with direct lineage from Galen via Avicenna's Canon of
 * Medicine (al-Qanun fi al-Tibb, 11th c. CE).
 *
 * Per Locked Decision §0.8 #14, the Holy Spirit is named theologically as
 * the source of the vital force animating the body's krasis, surfaced via
 * src/components/landing/WorldviewBand.tsx. This module describes the
 * empirical readings of the body's humoral mixture — eukrasia, simple
 * dyskrasias, compound dyskrasias — without theological attribution to
 * planetary deities, cosmic Tao, or Brahman.
 *
 * Per Locked Decision §0.8 #43 (dual-source clinical citation), every
 * entry in this module carries BOTH a public-domain primary-text source
 * AND an industry best-practice secondary cross-reference. The dual-
 * source rigor is the gate; per Lock #45 (clinical authority boundary),
 * authoring proceeds against this gate without per-claim founder review.
 *
 * Per Locked Decision §0.8 #44 (classical-tradition observation IN,
 * theological attribution OUT), each reading carries cross-tradition
 * observations from TCM (Heat / Cold / Damp / Dry pattern combinations),
 * Ayurveda (Pitta / Vata / Kapha vikriti and dual-dosha imbalances), and
 * Unani (mizaj — the direct Greek-Arabic lineage of the Galenic framework
 * via Avicenna). Observations are attribution-stripped: the body's
 * presentation is preserved; planetary-deity, cosmic-Tao, and prana-as-
 * Brahman etiology is excluded.
 *
 * Plan reference: Phase_B_Authoring_Plan_v1.md §source-availability
 * check / galenicTemperament.ts. This is module 2 of 5; pattern follows
 * src/lib/vitalForce.ts (module 1) and consumes the canonical
 * ContentEntry shape from src/lib/contentEntry.ts.
 */

import type { GalenicTemperament } from "./diagnosticProfile";
import type {
  ContentEntry,
  ContentEntryRegistry,
  PrimaryTextCitation,
  SecondaryCitation,
} from "./contentEntry";

/* ----------------- Shared primary-text source anchors ----------------- */
/* DRY: the same Hippocratic / Galenic / Eclectic / Unani / TCM /         */
/* Ayurvedic anchors are referenced from many entries. Defining them once */
/* keeps each entry readable and lets a citation-enrichment pass          */
/* (excerpts, deeper locators) update one place.                          */

const HIPPOCRATES_NATURE_OF_MAN: Omit<PrimaryTextCitation, "locator"> = {
  author: "Hippocrates; trans. Francis Adams",
  title: "The Genuine Works of Hippocrates — On the Nature of Man",
  // Adams 1844 is the canonical pre-1928 English translation of the
  // Hippocratic Corpus; the Internet Archive hosts the Sydenham Society
  // edition. The treatise De Natura Hominis (often attributed to Polybus,
  // Hippocrates' son-in-law) is the foundational text naming the four
  // humours and four qualities that Galen later systematizes.
  year: 1844,
  url: "https://archive.org/details/genuineworksofhi02hippuoft",
};

const GALEN_DE_TEMPERAMENTIS: Omit<PrimaryTextCitation, "locator"> = {
  author: "Galen of Pergamon; ed. C. G. Kühn",
  title: "De Temperamentis (Περὶ Κράσεων), in Claudii Galeni Opera Omnia",
  // Kühn's Leipzig edition (1821–1833) of Galen's complete works is the
  // standard pre-1928 scholarly Greek-Latin edition; original-language
  // primary qualifies under Lock #38 regardless of date when the underlying
  // text predates 1928. Hosted at the Internet Archive in 20 volumes.
  // Pre-1928 complete English of De Temperamentis is unavailable; readers
  // wanting English have used Singer's 1997 Selected Works (post-1928,
  // excluded as primary anchor) — Adams 1844 covers the Hippocratic
  // foundation that Galen develops, and Cook 1869 covers the Eclectic
  // reception.
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

const AVICENNA_CANON: Omit<PrimaryTextCitation, "locator"> = {
  author: "Ibn Sīnā (Avicenna)",
  title: "al-Qānūn fī al-Ṭibb (The Canon of Medicine) — Bulaq edition",
  // Avicenna's Canon (completed c. 1025 CE) is the canonical Unani text
  // directly transmitting the Galenic temperament framework into the
  // Islamic medical tradition. The 1877 Bulaq Arabic edition is pre-1928
  // and qualifies under Lock #38 as original-language primary; the Latin
  // Gerard of Cremona translation (12th–13th c.) likewise qualifies.
  year: 1877,
  url: "https://archive.org/details/QanunFiTib1",
};

const HUANGDI_NEIJING: Omit<PrimaryTextCitation, "locator"> = {
  author: "Anonymous (compiled c. 100 BCE)",
  title: "Huangdi Neijing — Suwen (Basic Questions)",
  // The Suwen text predates 1928 by approximately two millennia; the year
  // field records the approximate compilation date of the received text.
  // The Chinese Text Project hosts the canonical Chinese with parallel
  // English; pre-1928 partial English translations are patchy.
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
/* Industry best-practice secondaries used across multiple entries. Per   */
/* Lock #43, each entry pairs a PD primary (above) with an industry-      */
/* secondary anchor (below) — both halves required.                       */

const MILLS_BONE_CH3: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Principles and Practice of Phytotherapy: Modern Herbal Medicine (2nd ed.) — Chapter 3, Approaches to Treatment",
  author: "Mills, S.; Bone, K.",
  year: 2013,
  identifier: "ISBN 978-0-443-06992-5",
  url: "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5",
};

const NUTTON_ANCIENT_MEDICINE: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title: "Ancient Medicine (2nd ed.) — Galen and the humoral framework",
  author: "Nutton, V.",
  year: 2013,
  identifier: "ISBN 978-0-415-52095-9",
  url: "https://www.routledge.com/Ancient-Medicine/Nutton/p/book/9780415520959",
};

const JOUANNA_GREEK_MEDICINE: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Greek Medicine from Hippocrates to Galen: Selected Papers — The Legacy of the Hippocratic Treatise The Nature of Man",
  author: "Jouanna, J.",
  year: 2012,
  identifier: "DOI 10.1163/9789004232549",
  url: "https://brill.com/display/title/19859",
};

const LAGAY_HUMORAL_LEGACY: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title: "The Legacy of Humoral Medicine",
  author: "Lagay, F.",
  year: 2002,
  identifier: "AMA J Ethics 4(7):206-208",
  url: "https://journalofethics.ama-assn.org/article/legacy-humoral-medicine/2002-07",
};

/* ------------------------- The nine readings ------------------------- */

/**
 * Registry keyed by the canonical GalenicTemperament union from
 * src/lib/diagnosticProfile.ts.
 *
 * Each entry conforms to the ContentEntry shape from
 * src/lib/contentEntry.ts: dual-source citations per Lock #43;
 * cross-tradition observations per Lock #44; attribution-stripped
 * framing throughout.
 */
export const GALENIC_TEMPERAMENT_CONTENT: ContentEntryRegistry<GalenicTemperament> = {
  /* ------------------------------- Eukrasia ----------------------------- */
  eukrasia: {
    slug: "eukrasia",
    displayName: "Eukrasia",
    category: "galenic_eukrasia",
    shortDescription:
      "Your humours are in good mixture — the four qualities (hot, cold, dry, wet) sit in the proportion that suits your constitution. This is the working middle of health.",
    description:
      "Eukrasia (εὐκρασία, 'good mixture') is the canonical Galenic name for the body's humoral framework expressing in proper proportion: heat tempered by cold, dryness tempered by wetness, none of the four qualities pulling the krasis out of its constitutional baseline. Galen describes eukrasia in De Temperamentis as the temperate norm against which the eight dyskrasias deviate; the Hippocratic De Natura Hominis frames the same picture as the four humours mixed 'most rightly with respect to power and quantity, and most thoroughly mingled.' Felter (1922) treats this state implicitly as the absence of dyskrasia — the working norm against which prescribing aims. Modern scholarship (Nutton 2013; Jouanna 2012) preserves the framework as the foundational scaffold of Western clinical thought from antiquity through the early modern period.",
    citations: {
      primaryText: {
        ...HIPPOCRATES_NATURE_OF_MAN,
        locator:
          "On the Nature of Man, §4 — the four humours mixed in proper proportion as the basis of health",
      },
      secondary: {
        ...JOUANNA_GREEK_MEDICINE,
        locator:
          "On the legacy of De Natura Hominis as the foundational text of humoral pathology",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Krasis in proper proportion (Galen)",
        observation:
          "Galen describes eukrasia as the body's humoral framework expressing in proportion to its individual constitutional norm — neither hotter, colder, drier, nor wetter than that body's baseline. The therapeutic indication is maintenance: nourishing, stabilizing, and protective herbs rather than corrective ones.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator: "De Temperamentis, Book I — the temperate krasis as the norm",
        },
      },
      {
        tradition: "unani",
        pattern: "I'tidāl-i mizāj (balanced temperament)",
        observation:
          "Unani observation: a body whose mizāj (temperament) sits at i'tidāl — the balanced point between the four qualities. Avicenna preserves the Galenic framework with direct lineage and applies it diagnostically to individual constitution rather than abstract typology. Empirically continuous with the Western eukrasia reading.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the temperaments and their balance",
        },
      },
      {
        tradition: "tcm",
        pattern: "Yin-Yang Harmony (阴阳平衡, yin yang ping heng)",
        observation:
          "TCM observation: a body presenting with regulated pulse and tongue, balanced thermoregulation, normal sleep-wake rhythm, regular elimination, and prompt recovery from minor stressors — Heat, Cold, Damp, and Dry held in dynamic equipoise. The Suwen frames this as the maintained state. Empirically continuous with eukrasia at the level of clinical presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — descriptions of the harmonious state and pulse / tongue baselines",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Samya prakriti (dosha in equilibrium)",
        observation:
          "Ayurvedic observation: a body in which the three doshas express in their proper proportions for the individual's constitutional type, with strong agni, regular elimination, stable mental clarity, and resilient sleep. The Caraka Samhita describes samya prakriti as the maintenance terrain — empirically continuous with eukrasia.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Vimanasthana 8 — description of samya prakriti and the maintained constitutional state",
        },
      },
    ],
    observationalNotes:
      "Eukrasia is the rarest reading in clinical practice — most assessments fall into one of the eight dyskrasias at presentation. When a eukrasia reading is recorded, the Layer 1 Eden Pattern and Layer 3 tissue-state readings describe constitutional baseline rather than active terrain disturbance.",
  },

  /* -------------------- Simple dyskrasia — Hot ------------------------- */
  simple_dyskrasia_hot: {
    slug: "simple_dyskrasia_hot",
    displayName: "Simple Dyskrasia — Hot",
    category: "galenic_simple_dyskrasia",
    shortDescription:
      "Your mixture is running hot — heat dominates without strong dryness or wetness pulling alongside. The body's temperature regulation is tipped warm.",
    description:
      "A simple hot dyskrasia (mizāj-i ḥārr in the Unani transmission) describes the krasis displaced toward the hot quality without the dry or wet qualities co-dominating: warmer skin and tongue, faster pulse, sharper febrile reactivity, brisker metabolic turnover, and a tendency toward inflammatory rather than catarrhal patterns. Galen distinguishes simple from compound dyskrasias in De Temperamentis: a simple dyskrasia tilts on a single axis, while compound dyskrasias (the four classical temperaments) tilt on two. Felter (1922) and Cook (1869) describe the indicated direction as cooling, sedating, and relaxing without specific drying or moistening tasks. The Hippocratic De Natura Hominis treats heat as the quality belonging especially to blood and yellow bile.",
    citations: {
      primaryText: {
        ...GALEN_DE_TEMPERAMENTIS,
        locator:
          "De Temperamentis, Books I–II — distinction between simple and compound dyskrasias; the hot temperament",
      },
      secondary: {
        ...NUTTON_ANCIENT_MEDICINE,
        locator:
          "Galen's De Temperamentis and the simple-vs-compound dyskrasia framework",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Hot diathesis (Cook)",
        observation:
          "Cook describes the Eclectic reception of the hot tilt: tissues running warm, pulse faster, indication for sedating relaxants and refrigerant herbs. The Eclectic doctrine rejects the doctrine of bleeding for hot states and prefers nervine relaxants (lobelia, scullcap), bitter coolants, and refrigerant diaphoretics.",
        citation: {
          ...COOK_1869,
          locator:
            "On hot diatheses and the indications for sedating relaxants and refrigerants",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj-i ḥārr (hot temperament)",
        observation:
          "Unani observation: a body whose mizāj is tilted toward heat — warmer surface, sharper febrile reactivity, faster digestive turnover. Avicenna prescribes cooling (mubarrid) regimens and herbs of cold temperament such as sandalwood, coriander, and rose. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the simple temperaments; the hot mizāj",
        },
      },
      {
        tradition: "tcm",
        pattern: "Heat pattern without Damp or Dry co-dominance (热证, re zheng)",
        observation:
          "TCM observation: a body presenting with sensation of heat, red tongue, rapid pulse, restlessness, thirst — heat predominant without strong damp or dry signs. Empirically overlaps the Western simple-hot reading at the level of palpable presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for Heat without Damp or Dry co-presentation",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mild Pitta vikriti without Vata or Kapha co-aggravation",
        observation:
          "Ayurvedic observation: a body presenting with elevated heat and sharp digestive fire, but without the dryness of Vata aggravation or the dampness of Kapha aggravation. The Caraka Samhita describes pure Pitta-vikriti as the heat-quality elevation; empirically continuous with the Western simple-hot reading.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — descriptions of pure Pitta aggravation",
        },
      },
    ],
  },

  /* -------------------- Simple dyskrasia — Cold ------------------------ */
  simple_dyskrasia_cold: {
    slug: "simple_dyskrasia_cold",
    displayName: "Simple Dyskrasia — Cold",
    category: "galenic_simple_dyskrasia",
    shortDescription:
      "Your mixture is running cold — cold dominates without strong dryness or wetness pulling alongside. The body's metabolic and circulatory drive is tipped low.",
    description:
      "A simple cold dyskrasia (mizāj-i bārid in the Unani transmission) describes the krasis displaced toward the cold quality alone: cooler skin and extremities, slower pulse, blunted febrile response, sluggish digestion, and a tendency toward depression of vital action without specific dampness or dryness signs. Galen frames cold as the quality opposed to heat in De Temperamentis; the Hippocratic framework attaches cold especially to phlegm and black bile. Cook (1869) and Felter (1922) prescribe warming stimulants — the diffusive aromatics, capsicum, ginger, and warming circulatory tonics — as the indicated correctives, without the moistening or drying tasks of compound dyskrasias.",
    citations: {
      primaryText: {
        ...GALEN_DE_TEMPERAMENTIS,
        locator:
          "De Temperamentis, Book II — the cold temperament; cold as the quality opposed to heat",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On warming stimulants and the modern phytotherapy reception of the cold-tilt indication",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Cold diathesis (Cook)",
        observation:
          "Cook describes the Eclectic reception of the cold tilt: cooler tissues, slower pulse, indication for warming diffusive stimulants such as capsicum, ginger, and prickly ash. The Physiomedical doctrine prefers warming-without-irritating agents that restore circulation and metabolic drive without lashing the depleted system.",
        citation: {
          ...COOK_1869,
          locator: "On cold diatheses and the indications for warming diffusive stimulants",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj-i bārid (cold temperament)",
        observation:
          "Unani observation: a body whose mizāj is tilted toward cold — cooler surface, slower pulse, blunted febrile response. Avicenna prescribes warming (musakhkhin) regimens and herbs of hot temperament such as ginger, black pepper, and saffron. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the simple temperaments; the cold mizāj",
        },
      },
      {
        tradition: "tcm",
        pattern: "Cold pattern without Damp or Dry co-dominance (寒证, han zheng)",
        observation:
          "TCM observation: a body presenting with sensation of cold, pale tongue, slow pulse, aversion to cold, cold extremities — cold predominant without strong damp or dry signs. Empirically overlaps the Western simple-cold reading at the level of palpable presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for Cold without Damp or Dry co-presentation",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mild combined Vata-Kapha cold tendency",
        observation:
          "Ayurvedic observation: a body presenting with the cold-quality of Vata or Kapha but without the dry-aggravation of Vata vikriti or the damp-aggravation of Kapha vikriti dominating. The Caraka Samhita describes the cold quality as shared between Vata (cold-dry) and Kapha (cold-wet); a pure cold tilt sits between them.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — descriptions of cold as a shared quality of Vata and Kapha",
        },
      },
    ],
  },

  /* --------------------- Simple dyskrasia — Dry ------------------------ */
  simple_dyskrasia_dry: {
    slug: "simple_dyskrasia_dry",
    displayName: "Simple Dyskrasia — Dry",
    category: "galenic_simple_dyskrasia",
    shortDescription:
      "Your mixture is running dry — dryness dominates without strong heat or cold pulling alongside. Tissues, secretions, and skin are tipped toward depletion of moisture.",
    description:
      "A simple dry dyskrasia (mizāj-i yābis in the Unani transmission) describes the krasis displaced toward the dry quality alone: dry skin and mucous membranes, scant secretions, brittle hair and nails, constipation with hard dry stool, and a tendency toward tissue desiccation without strong thermal tilt. Galen pairs dryness with the elements earth and fire and the humours yellow bile and black bile in De Temperamentis. Felter (1922) and Cook (1869) prescribe demulcent and moistening agents — slippery elm, marshmallow root, mucilaginous tonics — as the indicated correctives, without the warming or cooling tasks of compound dyskrasias.",
    citations: {
      primaryText: {
        ...GALEN_DE_TEMPERAMENTIS,
        locator:
          "De Temperamentis, Books I–III — dryness as a primary quality; the dry temperament",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On demulcent and moistening herbs in modern phytotherapy and the dry-tilt indication",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Dry diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the dry tilt: scant secretions, dry mucous membranes, indication for demulcents (slippery elm, marshmallow root) and mucilaginous tonics. The Physiomedical doctrine treats dryness as a tissue-state and humoral indication that calls for moistening rather than further stimulation.",
        citation: {
          ...COOK_1869,
          locator: "On dry diatheses and the indications for demulcents and mucilaginous herbs",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj-i yābis (dry temperament)",
        observation:
          "Unani observation: a body whose mizāj is tilted toward dryness — dry skin, scant secretions, brittle hair. Avicenna prescribes moistening (muraṭṭib) regimens and herbs of moist temperament such as violet, mallow, and purslane. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the simple temperaments; the dry mizāj",
        },
      },
      {
        tradition: "tcm",
        pattern: "Dryness pattern without strong Heat or Cold (燥证, zao zheng)",
        observation:
          "TCM observation: a body presenting with dry mouth, dry skin, dry cough, scant urine, dry stools — dryness predominant without strong heat or cold signs. The Suwen and later Yin-deficiency literature describe the dryness pattern; empirically overlaps the Western simple-dry reading.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for Dryness without thermal co-presentation",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mild Vata vikriti — dry-quality predominant without strong cold",
        observation:
          "Ayurvedic observation: a body presenting with the dry-quality of Vata aggravation predominantly, without the cold-quality fully co-aggravated. The Caraka Samhita catalogues the rūkṣa (dry) guṇa as a primary attribute of Vata; this reading isolates that attribute clinically.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — on the rūkṣa (dry) guṇa of Vata",
        },
      },
    ],
  },

  /* --------------------- Simple dyskrasia — Wet ------------------------ */
  simple_dyskrasia_wet: {
    slug: "simple_dyskrasia_wet",
    displayName: "Simple Dyskrasia — Wet",
    category: "galenic_simple_dyskrasia",
    shortDescription:
      "Your mixture is running damp — wetness dominates without strong heat or cold pulling alongside. Tissues are full, secretions abundant, and elimination tends slow.",
    description:
      "A simple wet dyskrasia (mizāj-i raṭb in the Unani transmission) describes the krasis displaced toward the wet quality alone: damp skin tone, full and slow pulse, abundant or stagnant secretions, oedematous tendency, soft tissue tone, and a tendency toward catarrhal accumulation without strong thermal tilt. Galen pairs wetness with the elements air and water and the humours phlegm and blood in De Temperamentis. Cook (1869) and Felter (1922) prescribe astringents, alterants, and lymphatic drainers — yellow dock, cleavers, calendula — as the indicated correctives, without the warming or cooling tasks of compound dyskrasias.",
    citations: {
      primaryText: {
        ...GALEN_DE_TEMPERAMENTIS,
        locator:
          "De Temperamentis, Books I–III — wetness as a primary quality; the moist temperament",
      },
      secondary: {
        ...LAGAY_HUMORAL_LEGACY,
        locator:
          "On the four-quality framework's persistence in clinical reasoning across antiquity, medieval, and early modern medicine",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_physiomedical",
        pattern: "Damp diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the wet tilt: abundant secretions, soft tissue tone, oedematous tendency. The Physiomedical doctrine prescribes astringents (yellow dock, cranesbill), lymphatic drainers (cleavers, calendula), and gentle alteratives that consolidate tissue and clear stagnant fluid without further drying.",
        citation: {
          ...COOK_1869,
          locator:
            "On damp diatheses and the indications for astringents, alterants, and lymphatic drainers",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj-i raṭb (moist temperament)",
        observation:
          "Unani observation: a body whose mizāj is tilted toward moisture — abundant secretions, full and slow pulse, soft tissue. Avicenna prescribes drying (mujaffif) regimens and herbs of dry temperament such as fenugreek, lentil, and barley. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the simple temperaments; the moist mizāj",
        },
      },
      {
        tradition: "tcm",
        pattern: "Damp pattern without strong Heat or Cold (湿证, shi zheng)",
        observation:
          "TCM observation: a body presenting with thick tongue coating, slippery pulse, sensation of heaviness, oedema, copious mucus — damp predominant without strong heat or cold co-domination. The Suwen describes the damp pattern; empirically overlaps the Western simple-wet reading.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for Damp without thermal co-presentation",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Mild Kapha vikriti — wet-quality predominant without strong cold",
        observation:
          "Ayurvedic observation: a body presenting with the wet-quality of Kapha aggravation predominantly, without the cold-quality fully co-aggravated. The Caraka Samhita catalogues the snigdha (wet/oily) and drava (liquid) guṇa as primary attributes of Kapha; this reading isolates the wet attribute clinically.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — on the snigdha and drava guṇa of Kapha",
        },
      },
    ],
  },

  /* ---------- Compound dyskrasia — Hot + Dry (choleric, yellow bile) --- */
  compound_dyskrasia_hot_dry: {
    slug: "compound_dyskrasia_hot_dry",
    displayName: "Compound Dyskrasia — Hot + Dry (Choleric)",
    category: "galenic_compound_dyskrasia",
    shortDescription:
      "Your mixture is running hot AND dry — the classical choleric tilt, traditionally tied to yellow bile. Tissues are warm and parched, energy intense and sharp.",
    description:
      "The hot-dry compound dyskrasia is the classical choleric (χολώδης) temperament, traditionally associated with yellow bile (χολή). Galen's De Temperamentis describes the doubled deviation as the most reactive of the compound dyskrasias: warm dry skin, sharp febrile responses, irritability, drive without endurance, scant dry stools, and a tendency toward inflammatory rather than catarrhal patterns. Hippocrates' De Natura Hominis attaches yellow bile to summer, the gallbladder, and the predominantly hot-and-dry phase of life. Felter (1922) and Cook (1869) prescribe a doubled corrective — cooling-AND-moistening, with refrigerant diaphoretics, demulcent bitters, and nervine relaxants applied together — to address both qualities simultaneously without lashing or further drying.",
    citations: {
      primaryText: {
        ...GALEN_DE_TEMPERAMENTIS,
        locator:
          "De Temperamentis, Books III–IV — the choleric (hot-dry) compound dyskrasia and yellow bile",
      },
      secondary: {
        ...NUTTON_ANCIENT_MEDICINE,
        locator:
          "On the four classical temperaments and Galen's reception of the four-humour framework",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Choleric / hot-dry diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the doubled hot-dry tilt: tissues warm and parched, pulse sharp and tense, indication for refrigerant diaphoretics combined with demulcents (boneset + slippery elm, yarrow + marshmallow root). The Eclectic protocol applies cooling and moistening together rather than sequentially.",
        citation: {
          ...COOK_1869,
          locator:
            "On bilious / choleric states and the combined cooling-moistening indication",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj ṣafrāwī (yellow-bile / hot-dry temperament)",
        observation:
          "Unani observation: the mizāj-i ḥārr-yābis sees the body tilted hot and dry simultaneously — yellow-bile predominant. Avicenna prescribes combined cooling-moistening regimens (mubarrid + muraṭṭib) and herbs that perform both tasks such as fumitory, dandelion, and chicory. Direct lineage of the Galenic framework via the Greek-Arabic medical tradition.",
        citation: {
          ...AVICENNA_CANON,
          locator: "Canon of Medicine, Book I, Fann I — on the compound temperaments; mizāj ṣafrāwī",
        },
      },
      {
        tradition: "tcm",
        pattern: "Liver-Fire / Heat-with-Dryness (肝火 / 热燥)",
        observation:
          "TCM observation: a body presenting with red eyes, irritability, headache, bitter taste, dry stools, scant dark urine — Heat predominant with Dry signs. Empirically overlaps the Western choleric reading at the level of palpable presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator:
            "Suwen — diagnostic patterns for Liver-Fire and combined Heat-Dryness presentations",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Pitta-Vata vikriti (Pitta-aggravation with Vata co-aggravation)",
        observation:
          "Ayurvedic observation: a body presenting with the heat-quality of Pitta and the dry-quality of Vata simultaneously aggravated — sharp digestive fire with depleted moisture, irritability with insomnia, inflammatory tendency on dry tissue. The Caraka Samhita describes Pitta-Vata samsarga as a recognized dual-dosha vikriti.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana / Vimanasthana — descriptions of Pitta-Vata samsarga (combined dosha aggravation)",
        },
      },
    ],
  },

  /* ---------- Compound dyskrasia — Hot + Wet (sanguine, blood) --------- */
  compound_dyskrasia_hot_wet: {
    slug: "compound_dyskrasia_hot_wet",
    displayName: "Compound Dyskrasia — Hot + Wet (Sanguine)",
    category: "galenic_compound_dyskrasia",
    shortDescription:
      "Your mixture is running hot AND wet — the classical sanguine tilt, traditionally tied to blood. Tissues are warm and full, energy abundant and outward-flowing.",
    description:
      "The hot-wet compound dyskrasia is the classical sanguine (sanguineus) temperament, traditionally associated with blood (αἷμα). Galen's De Temperamentis describes the doubled deviation as warm full pulse, ruddy complexion, abundant secretions, robust digestion, full and outwardly active disposition, and a tendency toward plethora and inflammatory-catarrhal mixed patterns. Hippocrates' De Natura Hominis attaches blood to spring, the heart, and the predominantly hot-and-wet phase of life. Felter (1922) and Cook (1869) prescribe combined cooling-AND-drying — refrigerant astringents, alterative depuratives, lymphatic-clearing bitters — to address both qualities simultaneously without further heating or moistening.",
    citations: {
      primaryText: {
        ...GALEN_DE_TEMPERAMENTIS,
        locator:
          "De Temperamentis, Books III–IV — the sanguine (hot-wet) compound dyskrasia and blood",
      },
      secondary: {
        ...JOUANNA_GREEK_MEDICINE,
        locator:
          "On the four classical temperaments derived from the four-humour scheme of De Natura Hominis",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Sanguine / plethoric diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the doubled hot-wet tilt: full pulse, ruddy complexion, abundant secretions, plethoric tendency. The Eclectic protocol applies cooling refrigerants combined with depurative-and-drying alteratives (yellow dock, burdock, sarsaparilla) and lymphatic clearers — not bleeding (rejected by the Physiomedical school).",
        citation: {
          ...COOK_1869,
          locator: "On plethoric / sanguine states and the combined cooling-drying indication",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj damawī (blood / hot-wet temperament)",
        observation:
          "Unani observation: the mizāj-i ḥārr-raṭb sees the body tilted hot and wet simultaneously — sanguine predominant. Avicenna prescribes combined cooling-drying regimens (mubarrid + mujaffif) and herbs that perform both tasks such as endive, plantain, and rose-water. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator: "Canon of Medicine, Book I, Fann I — on the compound temperaments; mizāj damawī",
        },
      },
      {
        tradition: "tcm",
        pattern: "Damp-Heat (湿热, shi re)",
        observation:
          "TCM observation: a body presenting with greasy yellow tongue coating, rapid slippery pulse, fullness in chest or abdomen, sticky stools, bitter-greasy taste — Heat AND Damp simultaneously dominant. The Suwen and later Damp-Heat literature describe this pattern; empirically overlaps the Western sanguine reading.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for combined Damp-Heat presentations",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Pitta-Kapha vikriti (Pitta-aggravation with Kapha co-aggravation)",
        observation:
          "Ayurvedic observation: a body presenting with the heat-quality of Pitta and the wet-oily-quality of Kapha simultaneously aggravated — strong digestion with mucosal congestion, inflammatory tissue with oedematous tendency. The Caraka Samhita describes Pitta-Kapha samsarga as a recognized dual-dosha vikriti.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana / Vimanasthana — descriptions of Pitta-Kapha samsarga",
        },
      },
    ],
  },

  /* ----- Compound dyskrasia — Cold + Dry (melancholic, black bile) ----- */
  compound_dyskrasia_cold_dry: {
    slug: "compound_dyskrasia_cold_dry",
    displayName: "Compound Dyskrasia — Cold + Dry (Melancholic)",
    category: "galenic_compound_dyskrasia",
    shortDescription:
      "Your mixture is running cold AND dry — the classical melancholic tilt, traditionally tied to black bile. Tissues are cool and parched, drive depleted, recovery slow.",
    description:
      "The cold-dry compound dyskrasia is the classical melancholic (μελαγχολικός) temperament, traditionally associated with black bile (μέλαινα χολή). Galen's De Temperamentis describes the doubled deviation as cool dry skin, slow weak pulse, blunted febrile response, scant secretions, low-amplitude reactivity, slow and inward-turning disposition, and a tendency toward depressive-and-atrophic patterns. Hippocrates' De Natura Hominis attaches black bile to autumn, the spleen, and the predominantly cold-and-dry phase of life. Felter (1922) and Cook (1869) prescribe combined warming-AND-moistening — diffusive aromatics with demulcents, warming nutritive tonics, and slow restorative protocols — to address both qualities simultaneously while respecting the depleted vital reserve.",
    citations: {
      primaryText: {
        ...HIPPOCRATES_NATURE_OF_MAN,
        locator:
          "On the Nature of Man — the four humours and their seasons; black bile and the autumn-spleen attachment",
      },
      secondary: {
        ...NUTTON_ANCIENT_MEDICINE,
        locator:
          "On the melancholic temperament in Galenic and post-Galenic reception",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Melancholic / cold-dry depressive diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the doubled cold-dry tilt: cool dry tissues, slow weak pulse, depressive tone, scant secretions. The Eclectic protocol applies diffusive warming aromatics combined with demulcent moistening tonics (ginger + slippery elm, prickly ash + marshmallow root) — slow rebuilding rather than aggressive stimulation.",
        citation: {
          ...COOK_1869,
          locator:
            "On melancholic / depressive diatheses and the combined warming-moistening indication",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj sawdāwī (black-bile / cold-dry temperament)",
        observation:
          "Unani observation: the mizāj-i bārid-yābis sees the body tilted cold and dry simultaneously — black-bile predominant. Avicenna prescribes combined warming-moistening regimens (musakhkhin + muraṭṭib) and herbs that perform both tasks such as borage, fumitory, and lavender. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator: "Canon of Medicine, Book I, Fann I — on the compound temperaments; mizāj sawdāwī",
        },
      },
      {
        tradition: "tcm",
        pattern: "Liver-Qi-Stagnation with Yin-deficiency / Cold-Dry depressive",
        observation:
          "TCM observation: a body presenting with depression, scant secretions, slow weak pulse, dry tongue with thin coating, cold extremities, sighing — Cold AND Dry with stagnation features. Empirically overlaps the Western melancholic reading at the level of clinical presentation.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for combined Cold-Dryness with Liver-Qi stagnation",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Vata vikriti (cold-dry-quality predominant aggravation)",
        observation:
          "Ayurvedic observation: a body presenting with the cold-quality and dry-quality of Vata simultaneously aggravated — sluggish digestion with dry tissues, anxiety with insomnia, depressive-anxious tone with depleted ojas. The Caraka Samhita describes pure Vata vikriti as the cold-dry phenotype; empirically continuous with the Western melancholic reading.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — on the śīta (cold) and rūkṣa (dry) guṇa of Vata in vikriti",
        },
      },
    ],
  },

  /* ------ Compound dyskrasia — Cold + Wet (phlegmatic, phlegm) -------- */
  compound_dyskrasia_cold_wet: {
    slug: "compound_dyskrasia_cold_wet",
    displayName: "Compound Dyskrasia — Cold + Wet (Phlegmatic)",
    category: "galenic_compound_dyskrasia",
    shortDescription:
      "Your mixture is running cold AND wet — the classical phlegmatic tilt, traditionally tied to phlegm. Tissues are cool and damp, secretions abundant, response slow and steady.",
    description:
      "The cold-wet compound dyskrasia is the classical phlegmatic (φλεγματικός) temperament, traditionally associated with phlegm (φλέγμα). Galen's De Temperamentis describes the doubled deviation as cool damp skin, slow full pulse, abundant catarrhal secretions, soft tissue tone, oedematous tendency, slow steady disposition, and a tendency toward catarrhal-and-stagnant patterns. Hippocrates' De Natura Hominis attaches phlegm to winter, the brain, and the predominantly cold-and-wet phase of life. Felter (1922) and Cook (1869) prescribe combined warming-AND-drying — diffusive warming aromatics with astringents and lymphatic drainers, drying expectorants — to address both qualities simultaneously without further chilling or wetting.",
    citations: {
      primaryText: {
        ...HIPPOCRATES_NATURE_OF_MAN,
        locator:
          "On the Nature of Man — the four humours and their seasons; phlegm and the winter-brain attachment",
      },
      secondary: {
        ...MILLS_BONE_CH3,
        locator:
          "On warming-drying regimens and modern phytotherapy reception of the phlegmatic indication",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Phlegmatic / cold-wet catarrhal diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the doubled cold-wet tilt: cool damp tissues, slow full pulse, abundant catarrhal secretions, oedematous tendency. The Eclectic protocol applies diffusive warming aromatics combined with astringents and drying expectorants (ginger + yarrow, capsicum + elecampane) — warming and consolidating tissue together.",
        citation: {
          ...COOK_1869,
          locator:
            "On phlegmatic / catarrhal diatheses and the combined warming-drying indication",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj balghamī (phlegm / cold-wet temperament)",
        observation:
          "Unani observation: the mizāj-i bārid-raṭb sees the body tilted cold and wet simultaneously — phlegm predominant. Avicenna prescribes combined warming-drying regimens (musakhkhin + mujaffif) and herbs that perform both tasks such as hyssop, thyme, and marjoram. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator: "Canon of Medicine, Book I, Fann I — on the compound temperaments; mizāj balghamī",
        },
      },
      {
        tradition: "tcm",
        pattern: "Damp-Cold / Spleen-Yang Deficiency (湿寒 / 脾阳虚)",
        observation:
          "TCM observation: a body presenting with thick white tongue coating, slow slippery pulse, sensation of heaviness and cold, copious clear mucus, oedema, cold-aversive — Cold AND Damp simultaneously dominant. The Suwen and later Spleen-Yang-deficiency literature describe this pattern; empirically overlaps the Western phlegmatic reading.",
        citation: {
          ...HUANGDI_NEIJING,
          locator: "Suwen — diagnostic patterns for combined Cold-Damp and Spleen-Yang deficiency",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Kapha vikriti (cold-wet-quality predominant aggravation)",
        observation:
          "Ayurvedic observation: a body presenting with the cold-quality and wet-oily-quality of Kapha simultaneously aggravated — sluggish digestion with mucosal congestion, weight gain with oedematous tendency, slow steady tone with mucus accumulation. The Caraka Samhita describes pure Kapha vikriti as the cold-wet phenotype; empirically continuous with the Western phlegmatic reading.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — on the śīta (cold) and snigdha (wet/oily) guṇa of Kapha in vikriti",
        },
      },
    ],
  },
};

/**
 * Typed accessor. Use in UI components and result-rendering surfaces
 * instead of indexing the registry directly — preserves type safety
 * and centralizes any future fallback / observability hook.
 */
export function getGalenicTemperamentContent(
  reading: GalenicTemperament,
): ContentEntry {
  return GALENIC_TEMPERAMENT_CONTENT[reading];
}

/**
 * Stable ordered list — useful for rendering all nine readings in
 * comparison cards, deep-diagnostic explainers, and the citation
 * manifest review UI. Order: eukrasia, then 4 simple dyskrasias
 * (hot, cold, dry, wet), then 4 compound dyskrasias (the four
 * classical temperaments).
 */
export const GALENIC_TEMPERAMENT_READINGS: readonly GalenicTemperament[] = [
  "eukrasia",
  "simple_dyskrasia_hot",
  "simple_dyskrasia_cold",
  "simple_dyskrasia_dry",
  "simple_dyskrasia_wet",
  "compound_dyskrasia_hot_dry",
  "compound_dyskrasia_hot_wet",
  "compound_dyskrasia_cold_dry",
  "compound_dyskrasia_cold_wet",
] as const;
