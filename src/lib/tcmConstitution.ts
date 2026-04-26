/**
 * src/lib/tcmConstitution.ts
 *
 * PHASE B — Cross-tradition constitutional reference content (Module 4 of 5).
 *
 * Traditional Chinese Medicine constitutional pattern set, attribution-
 * stripped per Lock #44, dual-sourced per Lock #43, anchored on PD primary
 * texts per Lock #38, authored end-to-end per Lock #45.
 *
 * ─────────────────────────────────────────────────────────────────────
 * STRATEGIC NOTE — Wang Qi 9-constitution framework, NOT Bensky 12-pattern
 * ─────────────────────────────────────────────────────────────────────
 *
 * The Phase B Authoring Plan v1 (workspace root) flagged a strategic
 * decision: 9 patterns observed across the TCM constitutional literature
 * versus 12 sub-patterns in Bensky, Clavey, Stöger Materia Medica.
 * Resolved per Lock #45 surface 3 (Claude-drives strategic decisions
 * unless they materially affect diagnostic-stack scoring downstream):
 *
 *   • Wang Qi's 9-constitution framework (中医体质学, "Constitution
 *     Theory in Chinese Medicine") is the canonical CONSTITUTIONAL
 *     classification — describing the body's stable terrain pattern.
 *     Codified in China's national standard ZYYXH/T157-2009
 *     (《中医体质分类与判定》), operationalized via the Constitution in
 *     Chinese Medicine Questionnaire (CCMQ) and validated across
 *     hundreds of peer-reviewed cohort studies, and adopted by WHO/WPRO
 *     in the International Standard Terminologies on Traditional
 *     Medicine (2007).
 *
 *   • Bensky/Clavey/Stöger's 12-pattern set is Eight-Principle pattern
 *     differentiation (八纲辨证) — describing the ACUTE disease pattern
 *     a body is presenting right now (yang excess, repletion-heat,
 *     yang xu, qi xu, qi zhi, xue xu, xue yu, tan shi, shi re, etc.).
 *     A different level of analysis: pattern differentiation (辨证) is
 *     transient and event-driven; constitutional analysis (体质) is
 *     stable terrain.
 *
 * The Apothecary diagnostic stack is constitutional at this layer — it
 * surfaces the body's underlying terrain alongside the Galenic, Cook
 * tissue-state, and vital-force readings. The Wang Qi 9-constitution
 * framework is the topologically correct cross-tradition counterpart.
 * Choosing it (over the 12 Eight-Principle patterns) keeps cross-frame
 * registries on a 1:1 stable-terrain footing rather than mixing
 * constitutional and acute-pattern levels.
 *
 * Bonus structural fit: 9 patterns (1 balanced + 8 deviations) maps
 * cleanly onto the Galenic temperament 9-cell layout (1 eukrasia +
 * 8 dyskrasias) and the Cook 7-tissue-state matrix. No diagnostic-
 * stack scoring bloat — when downstream scoring eventually wants to
 * surface a TCM reading alongside the Galenic reading, the cell shapes
 * are commensurate.
 *
 * Lock #44 fit: Wang Qi's framework was developed for clinical
 * operationalization via the CCMQ instrument with empirical phenotype
 * description rather than cosmological causation. This makes it the
 * cleanest attribution-strip of any extant TCM constitutional
 * framework — the Eight-Principle and Five-Element-derived sets carry
 * heavier metaphysical scaffolding by construction.
 *
 * The PD primary anchor for the underlying constitutional VOCABULARY
 * (yin, yang, qi, xue, jin-ye, the Eight Principles, etc.) remains
 * the Huangdi Neijing — Suwen and Lingshu, hosted in classical Chinese
 * at the Chinese Text Project (ctext.org). The Suwen and Lingshu
 * predate 1928 by approximately two millennia and qualify as
 * original-language primary under Lock #38. The Wang Qi
 * operationalization is the modern industry secondary that codifies
 * how those classical observations are organized into the 9-pattern
 * stable-terrain framework used in contemporary clinical TCM.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Per Locked Decision §0.8 #14, the Holy Spirit is named theologically
 * as the source of vital force animating the body, surfaced via
 * src/components/landing/WorldviewBand.tsx. This module describes the
 * empirical observations the TCM tradition records about constitutional
 * patterns. Theological attribution to the Tao as cosmic ground of
 * being, qi as cosmic divine substance, or yin-yang as ontological
 * polarity of the universe is excluded — the body's palpable
 * presentation is preserved, the cosmological framing is not.
 *
 * Per Locked Decision §0.8 #43 (dual-source clinical citation), every
 * entry in this module carries BOTH a public-domain primary-text source
 * AND an industry best-practice secondary cross-reference. The dual-
 * source rigor is the gate; per Lock #45 (clinical authority boundary),
 * authoring proceeds against this gate without per-claim founder review.
 *
 * Per Locked Decision §0.8 #44 (classical-tradition observation IN,
 * theological attribution OUT), each pattern carries cross-tradition
 * observations from Western Eclectic / Physiomedical (Cook 1869,
 * Felter 1922), Galenic (Galen De Temperamentis, Hippocrates De
 * Natura Hominis, Avicenna's Canon for the Greek-Arabic transmission),
 * and Ayurveda (Caraka Samhita Kaviratna 1890) where the pattern
 * has empirically continuous parallels in those traditions. Yin and
 * Yang are treated throughout as observation polarity (cool-quiet
 * vs. hot-active; restraining vs. activating) rather than as cosmic
 * Tao or yin-yang as ground of being. Qi is treated throughout as
 * observable vitality phenotype (the body's capacity to perform its
 * physiological work) rather than as cosmic life force.
 *
 * Plan reference: Phase_B_Authoring_Plan_v1.md §source-availability
 * check / tcmConstitution.ts. This is module 4 of 5; pattern follows
 * src/lib/vitalForce.ts (module 1), src/lib/galenicTemperament.ts
 * (module 2), and src/lib/tissueStateProfile.ts (module 3) and consumes
 * the canonical ContentEntry shape from src/lib/contentEntry.ts.
 */

import type {
  ContentEntry,
  ContentEntryRegistry,
  PrimaryTextCitation,
  SecondaryCitation,
} from "./contentEntry";

/* ----------------------------- TcmConstitution ----------------------------- */

/**
 * The Wang Qi 9-constitution union. Slugs are snake-case ASCII; the
 * displayName field on each registry entry carries the canonical English
 * gloss, and the cross-tradition `pattern` fields preserve the Chinese
 * (with diacritics-bearing Pinyin) where it is the primary handle for
 * the pattern within TCM literature.
 *
 * Local to this module rather than added to src/lib/diagnosticProfile.ts
 * because TCM constitutional reading is cross-tradition reference
 * content at this point in the project — not a diagnostic-layer reading
 * the engine produces. If/when downstream scoring surfaces a TCM
 * reading on the DiagnosticProfile contract, this union is exported
 * and ready to lift into diagnosticProfile.ts without refactor.
 */
export type TcmConstitution =
  | "pinghe" //                       平和质 — Balanced (gentle/mild)
  | "qi_deficiency" //                气虚质 — Qi Deficiency
  | "yang_deficiency" //              阳虚质 — Yang Deficiency
  | "yin_deficiency" //               阴虚质 — Yin Deficiency
  | "phlegm_damp" //                  痰湿质 — Phlegm-Dampness
  | "damp_heat" //                    湿热质 — Damp-Heat
  | "blood_stasis" //                 血瘀质 — Blood Stasis
  | "qi_stagnation" //                气郁质 — Qi Stagnation
  | "special_predisposition"; //      特禀质 — Special / Allergic-predisposed

/* ----------------- Shared primary-text source anchors ----------------- */
/* DRY: the same Suwen / Lingshu / Cook / Felter / Galenic / Ayurvedic    */
/* anchors are referenced from many entries. Defining them once at module */
/* top keeps each entry readable and lets a citation-enrichment pass      */
/* (excerpts, deeper locators) update one place.                          */

const HUANGDI_NEIJING_SUWEN: Omit<PrimaryTextCitation, "locator"> = {
  author: "Anonymous (compiled c. 100 BCE)",
  title: "Huangdi Neijing — Suwen (黄帝内经·素问, Basic Questions)",
  // The Suwen text predates 1928 by approximately two millennia; the
  // year field records the approximate compilation date of the received
  // text. The Chinese Text Project hosts the canonical classical Chinese
  // with parallel English translation; pre-1928 partial English
  // translations are patchy and are supplemented by the original-
  // language primary (which qualifies under Lock #38 regardless of
  // English-translation date when the underlying text predates 1928).
  year: -100,
  url: "https://ctext.org/huangdi-neijing/su-wen",
};

const HUANGDI_NEIJING_LINGSHU: Omit<PrimaryTextCitation, "locator"> = {
  author: "Anonymous (compiled c. 100 BCE)",
  title: "Huangdi Neijing — Lingshu (黄帝内经·灵枢, Spiritual Pivot)",
  // The Lingshu is the second half of the Huangdi Neijing and the
  // direct classical anchor for constitutional typology — Chapter 64
  // (Yinyang Ershiwu Ren / 阴阳二十五人) describes the 25
  // constitutional types by 5-element subdivision; Chapter 72 (Tongtian
  // / 通天) describes the 5-type constitution by yin-yang dominance.
  // Both chapters underlie the modern Wang Qi 9-constitution
  // operationalization. Hosted in classical Chinese with parallel
  // English at the Chinese Text Project.
  year: -100,
  url: "https://ctext.org/huangdi-neijing/ling-shu",
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

const GALEN_DE_TEMPERAMENTIS: Omit<PrimaryTextCitation, "locator"> = {
  author: "Galen of Pergamon; ed. C. G. Kühn",
  title: "De Temperamentis (Περὶ Κράσεων), in Claudii Galeni Opera Omnia",
  year: 1821,
  url: "https://archive.org/details/hin-wel-all-00000681-001",
};

const HIPPOCRATES_NATURE_OF_MAN: Omit<PrimaryTextCitation, "locator"> = {
  author: "Hippocrates; trans. Francis Adams",
  title: "The Genuine Works of Hippocrates — On the Nature of Man",
  year: 1844,
  url: "https://archive.org/details/genuineworksofhi02hippuoft",
};

const AVICENNA_CANON: Omit<PrimaryTextCitation, "locator"> = {
  author: "Ibn Sīnā (Avicenna)",
  title: "al-Qānūn fī al-Ṭibb (The Canon of Medicine) — Bulaq edition",
  year: 1877,
  url: "https://archive.org/details/QanunFiTib1",
};

const CARAKA_SAMHITA_KAVIRATNA: Omit<PrimaryTextCitation, "locator"> = {
  author: "Agnivesa; trans. Avinash Chandra Kaviratna",
  title: "The Charaka-Samhita (English translation)",
  year: 1890,
  url: "https://archive.org/details/charakasamhitao01agnigoog",
};

/* ----------------- Shared industry-secondary anchors ------------------ */
/* Per Lock #43, every entry pairs a PD primary with an industry-         */
/* secondary anchor. The secondary set is rotated across:                  */
/*   • BENSKY_GAMBLE_MATERIA_MEDICA — the canonical English-language       */
/*     industry-standard TCM materia medica textbook.                      */
/*   • MACIOCIA_FOUNDATIONS — the canonical English-language industry-     */
/*     standard textbook on TCM theory and pattern differentiation.        */
/*   • WHO_IST_TM_2007 — WHO Western Pacific Regional Office's             */
/*     International Standard Terminologies on Traditional Medicine,       */
/*     the institutional standard for TCM constitutional terminology.      */
/*   • ZYYXH_T157_2009 — China's national standard for the                 */
/*     Classification and Determination of Constitution in TCM             */
/*     (《中医体质分类与判定》), the canonical codification of the         */
/*     Wang Qi 9-constitution framework.                                   */
/*   • WANG_QI_2008_FRONT_MED — peer-reviewed English-language             */
/*     introduction to the Wang Qi framework by its originator,            */
/*     published in Frontiers of Medicine in China.                        */

const BENSKY_GAMBLE_MATERIA_MEDICA: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Chinese Herbal Medicine: Materia Medica (3rd ed.) — pattern-differentiation framework underlying tonifying, cooling, draining, and regulating herb categories",
  author: "Bensky, D.; Clavey, S.; Stöger, E.",
  year: 2004,
  identifier: "ISBN 978-0-939616-42-8",
  url: "https://www.eastlandpress.com/books/chinese-herbal-medicine-materia-medica-3rd-edition/",
};

const MACIOCIA_FOUNDATIONS: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "The Foundations of Chinese Medicine (3rd ed.) — pattern differentiation, constitutional analysis, and the modern reception of the Suwen / Lingshu framework",
  author: "Maciocia, G.",
  year: 2015,
  identifier: "ISBN 978-0-7020-5216-2",
  url: "https://shop.elsevier.com/books/the-foundations-of-chinese-medicine/maciocia/978-0-7020-5216-2",
};

const WHO_IST_TM_2007: Omit<SecondaryCitation, "locator"> = {
  kind: "who_monograph",
  title:
    "WHO International Standard Terminologies on Traditional Medicine in the Western Pacific Region",
  author: "World Health Organization, Western Pacific Regional Office",
  year: 2007,
  identifier: "ISBN 978-92-9061-248-7",
  url: "https://iris.who.int/handle/10665/206952",
};

const ZYYXH_T157_2009: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Classification and Determination of Constitution in TCM (中医体质分类与判定) — China Association of Chinese Medicine national standard ZYYXH/T157-2009; the canonical codification of the Wang Qi 9-constitution framework",
  author: "China Association of Chinese Medicine; Wang Qi (chair)",
  year: 2009,
  identifier: "ZYYXH/T157-2009",
  url: "https://www.cacm.org.cn/",
};

const WANG_QI_2008_FRONT_MED: Omit<SecondaryCitation, "locator"> = {
  kind: "pubmed",
  title:
    "Individualized medicine, health medicine, and constitutional theory in Chinese medicine — peer-reviewed English-language introduction to the 9-constitution framework by its originator",
  author: "Wang, Q.",
  year: 2008,
  identifier: "Frontiers of Medicine in China 2(3):293-298",
  url: "https://link.springer.com/article/10.1007/s11684-008-0056-4",
};

/* ----------------- Shared industry-secondary cross anchors ----------- */
/* For cross-tradition observation rows that need their own modern        */
/* validation distinct from the pattern's primary TCM secondary.          */

const MILLS_BONE_CH3: Omit<SecondaryCitation, "locator"> = {
  kind: "industry_textbook",
  title:
    "Principles and Practice of Phytotherapy: Modern Herbal Medicine (2nd ed.) — Chapter 3, Approaches to Treatment",
  author: "Mills, S.; Bone, K.",
  year: 2013,
  identifier: "ISBN 978-0-443-06992-5",
  url: "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5",
};

/* ------------------------- The nine readings ------------------------- */

/**
 * Registry keyed by the Wang Qi TcmConstitution union. Each entry
 * conforms to the ContentEntry shape from src/lib/contentEntry.ts:
 * dual-source citations per Lock #43; cross-tradition observations
 * per Lock #44; attribution-stripped framing throughout.
 *
 * Order of presentation follows the Wang Qi national standard
 * (ZYYXH/T157-2009): Pinghe (the reference baseline) first, followed
 * by the eight deviations grouped roughly by domain — vitality
 * deficiencies (qi / yang / yin), accumulation patterns (phlegm-damp,
 * damp-heat), circulation patterns (blood stasis, qi stagnation),
 * and the special-predisposition pattern.
 */
export const TCM_CONSTITUTION_CONTENT: ContentEntryRegistry<TcmConstitution> = {
  /* ------------------------------- Pinghe ----------------------------- */
  pinghe: {
    slug: "pinghe",
    displayName: "Pinghe — Balanced Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body whose functions sit in good working order across the board — strong digestion, steady sleep, even temperament, prompt recovery from minor stressors.",
    description:
      "Pinghe (平和质, 'gentle / mild' constitution) is the canonical Wang Qi reference baseline: yin and yang functions in dynamic balance, qi (vitality function) and xue (circulating nourishment) sufficient and well-distributed, jin-ye (body fluids) properly regulated. Empirically: rosy complexion, regular pulse and tongue without distinguishing pathological signs, sound sleep, regular elimination, even mood, good cold and heat tolerance, prompt recovery from physiological stress. The Lingshu Tongtian chapter describes this as the harmonious type — neither yin- nor yang-tilted, neither full nor depleted. The Wang Qi national standard ZYYXH/T157-2009 operationalizes pinghe as the CCMQ-validated reference type against which the eight deviation patterns are scored. Modern population studies using the CCMQ instrument find pinghe in roughly a third of healthy adult cohorts, with prevalence dropping under chronic-disease and high-stress conditions.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_LINGSHU,
        locator:
          "Lingshu Ch. 72 (Tongtian / 通天) — the harmonious constitutional type, neither yin- nor yang-tilted",
      },
      secondary: {
        ...WHO_IST_TM_2007,
        locator:
          "Constitutional terminology section — Pinghe (平和质) as the institutional reference baseline for TCM constitutional classification",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Vital force in proper proportion (Cook)",
        observation:
          "Cook frames the same baseline within Physiomedical doctrine: the vital force expressing in proportion to the body's physiological tasks — neither overstrong nor depleted. The therapeutic indication is maintenance: nourishing, stabilizing, and protective herbs rather than corrective ones.",
        citation: {
          ...COOK_1869,
          locator: "On the vital force and its proper proportion",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Eukrasia (Galen)",
        observation:
          "Galen describes the same baseline in De Temperamentis as the body's humoral framework expressing in its individual constitutional norm — heat tempered by cold, dryness by wetness, none of the four qualities pulling the krasis out of its baseline. Empirically continuous with pinghe at the level of clinical presentation.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator: "De Temperamentis, Book I — the temperate krasis as the norm",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Samya prakriti (dosha in equilibrium)",
        observation:
          "Ayurvedic observation: a body in which the three doshas express in their proper proportions for the individual's constitutional type, with strong agni, regular elimination, stable mental clarity, and resilient sleep. The Caraka Samhita describes samya prakriti as the maintenance terrain — empirically continuous with pinghe.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Vimanasthana 8 — description of samya prakriti and the maintained constitutional state",
        },
      },
    ],
    observationalNotes:
      "Pinghe is the rarest constitutional reading in clinical practice — most assessments fall into one of the eight deviation patterns at presentation. Functionally analogous to the Galenic eukrasia and the Ayurvedic samya prakriti at the constitutional layer of the diagnostic stack.",
  },

  /* ---------------------------- Qi Deficiency -------------------------- */
  qi_deficiency: {
    slug: "qi_deficiency",
    displayName: "Qi Xu — Qi Deficiency Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body whose vital function runs low — easily fatigued, soft-voiced, slow to recover from exertion, prone to spontaneous sweating and frequent minor infections.",
    description:
      "Qi Xu (气虚质, 'qi-deficiency' constitution) describes a body in which qi — treated here as observable vitality phenotype, the body's capacity to perform its physiological work — is constitutionally insufficient. Empirically: pale, plump, tooth-marked tongue with thin white coating; weak, soft pulse; soft low voice; spontaneous sweating with light exertion; chronic fatigue; pallor; loose stools; reduced exertional tolerance; susceptibility to common infections. The Suwen chapter on qi describes the picture in terms of weakened defensive qi (wei qi 卫气) and weakened transporting function of the spleen-stomach axis. Bensky/Clavey/Stöger frame the modern materia-medica response as qi-tonifying herbs (huang qi / Astragalus, ren shen / Panax ginseng, dang shen / Codonopsis, bai zhu / Atractylodes) — the same pharmacological class that the modern adaptogen literature catalogues as HPA-axis-modulating and stress-protective. Constitutional indication is slow rebuilding rather than aggressive stimulation; the depleted system cannot sustain the latter.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 39 (Ju Tong Lun / 举痛论) and surrounding chapters — qi as observable vitality function and the consequences of its insufficiency",
      },
      secondary: {
        ...BENSKY_GAMBLE_MATERIA_MEDICA,
        locator:
          "Chapter on Herbs that Tonify Qi — the modern materia-medica response to constitutional qi-xu, including the Astragalus / Panax / Codonopsis / Atractylodes class",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Asthenic debility (Felter)",
        observation:
          "Felter describes the empirically continuous Eclectic phenotype: weak and slow pulse, low arterial tension, blunted febrile response, sluggish circulation, incomplete recovery from physiological stress. The therapeutic indication is tonics, restoratives, and warming stimulants — the same direction the TCM qi-tonifying class moves.",
        citation: {
          ...FELTER_1922,
          locator:
            "Therapeutics — asthenic debility; indications for tonics, restoratives, and warming stimulants",
        },
        secondary: {
          ...MILLS_BONE_CH3,
          locator:
            "On adaptogen pharmacology and the modern phytotherapy reception of the asthenic / qi-deficiency indication",
        },
      },
      {
        tradition: "western_physiomedical",
        pattern: "Vital-force depletion / depression tissue state (Cook)",
        observation:
          "Cook's tissue-state framework places the same picture at the depression / torpor pole: vital action diminished beneath baseline, tissue function sluggish, secretions diminished. The Physiomedical indication is gentle restoration — diffusive warming aromatics with nutritive tonics, not lashing stimulation.",
        citation: {
          ...COOK_1869,
          locator:
            "On vital-force depletion; tissue states of depression and torpor",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Ojas kshaya (depletion of vital essence)",
        observation:
          "Ayurvedic observation: a body presenting with low immunity, chronic exhaustion, weak agni, pallor, dry tissue, brittle hair and nails, and emotional fragility. The Caraka Samhita describes ojas-kshaya as the depletion phenotype — empirically continuous with qi-xu at the level of clinical presentation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana — description of ojas, its depletion, and the resulting clinical phenotype",
        },
      },
    ],
    observationalNotes:
      "Qi Xu sits at the same constitutional layer as the Western asthenic vital-force reading and the Ayurvedic ojas-kshaya phenotype. Cross-frame, the indication is consistent: slow restoration, not aggressive stimulation. Bridges to the Galenic cold-tilted dyskrasias when chronic; bridges to Cook's depression tissue state at the body-system level.",
  },

  /* --------------------------- Yang Deficiency ------------------------- */
  yang_deficiency: {
    slug: "yang_deficiency",
    displayName: "Yang Xu — Yang Deficiency Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body whose warming and activating function runs low — chronically cold extremities, cold-aversive, slow digestion, low libido, oedematous tendency.",
    description:
      "Yang Xu (阳虚质, 'yang-deficiency' constitution) describes a body in which yang — treated here as observation polarity, the warming and activating pole of physiological function (rather than as cosmic Tao) — is constitutionally insufficient. The presentation is cold and slow: pale, swollen, tooth-marked tongue with white moist coating; deep, slow, weak pulse; cold extremities (especially hands, feet, lower back, knees); aversion to cold; preference for warm food and drink; clear copious urine; loose stools sometimes with undigested food; oedematous tendency; low libido; emotional withdrawal in cold weather. The Suwen and Lingshu describe the picture in terms of the warming function (wen huo) of kidney-yang and spleen-yang; Maciocia frames the modern reception as the canonical cold-deficiency constitutional pattern, with the materia-medica response centered on warming yang-tonifying herbs (rou gui / Cinnamomum cassia bark, fu zi / Aconitum carmichaelii preparata — clinical-only, schedule-restricted; xian mao / Curculigo, du zhong / Eucommia bark) and warming foods.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 5 (Yin Yang Ying Xiang Da Lun / 阴阳应象大论) — yin and yang as observation polarities; deficiency of the warming-activating pole presenting as cold-depletion",
      },
      secondary: {
        ...MACIOCIA_FOUNDATIONS,
        locator:
          "Chapter on Yang Deficiency — the canonical cold-deficiency constitutional pattern and its modern materia-medica response",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Compound dyskrasia — cold + wet (phlegmatic, Galen)",
        observation:
          "The Galenic phlegmatic temperament names the empirically continuous picture: cool damp tissues, slow full or weak pulse, blunted reactivity, oedematous tendency, slow steady disposition. Galen prescribes warming-and-drying combined; Avicenna in the Greek-Arabic transmission prescribes diffusive warming aromatics paired with drying herbs (hyssop, thyme, marjoram). Empirically continuous with yang-xu at the level of palpable presentation.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator:
            "De Temperamentis, Books III–IV — the phlegmatic (cold-wet) compound dyskrasia",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj balghamī (cold-wet temperament)",
        observation:
          "Unani observation: the mizāj-i bārid-raṭb sees the body tilted cold and wet simultaneously — phlegm predominant, oedematous, cold-aversive. Avicenna prescribes combined warming-drying regimens (musakhkhin + mujaffif). Direct lineage of the Galenic framework via the Greek-Arabic medical tradition.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the compound temperaments; mizāj balghamī",
        },
      },
      {
        tradition: "western_physiomedical",
        pattern: "Cold diathesis with depression (Cook)",
        observation:
          "Cook's framework places the same picture at the cold-tilt with vital depression: cooler tissues, slower pulse, indication for warming diffusive stimulants (capsicum, ginger, prickly ash) combined with nutritive tonics. The Physiomedical doctrine prefers warming-without-irritating agents that restore circulation and metabolic drive without lashing the depleted system.",
        citation: {
          ...COOK_1869,
          locator:
            "On cold diatheses with vital depression; the indications for warming diffusive stimulants and nutritive tonics",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Combined Vata-Kapha vikriti (cold-quality predominant)",
        observation:
          "Ayurvedic observation: a body presenting with the cold-quality of both Vata (cold-dry) and Kapha (cold-wet) — cold extremities, slow digestion, oedematous tendency without strong heat or dryness predominating. The Caraka Samhita catalogues the śīta (cold) guṇa as a shared attribute of Vata and Kapha; this combined cold-tilt is empirically continuous with yang-xu.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — on the śīta (cold) guṇa shared by Vata and Kapha",
        },
      },
    ],
    observationalNotes:
      "Yang Xu sits at the cold-deficiency pole of the constitutional layer. Frequently co-presents with qi-xu on the same body (combined qi-yang xu), and with phlegm-damp constitution when the warming-transporting function fails to mobilize fluids. Bridges to the Galenic phlegmatic temperament and to the Ayurvedic Kapha-Vata cold-tilt.",
  },

  /* --------------------------- Yin Deficiency -------------------------- */
  yin_deficiency: {
    slug: "yin_deficiency",
    displayName: "Yin Xu — Yin Deficiency Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body whose cooling and moistening function runs low — heat-intolerant, dry mouth, dry skin, night sweats, restless sleep, hot palms and soles.",
    description:
      "Yin Xu (阴虚质, 'yin-deficiency' constitution) describes a body in which yin — treated here as observation polarity, the cooling and moistening pole of physiological function (rather than as cosmic ground of being) — is constitutionally insufficient. The presentation is dry and warm with depletion underneath: red tongue with little or no coating, sometimes cracked or peeled; thin, rapid pulse; dry mouth and throat; dry skin; constipation with dry stool; concentrated urine; heat sensation in the palms, soles, and chest (the so-called 'five-center heat' / 五心烦热 wu xin fan re); night sweats; restless sleep; flushed cheeks; thirst for cold drinks. The Suwen describes the picture as deficiency of the cooling-moistening pole of physiology; Bensky/Clavey/Stöger frame the modern materia-medica response as yin-nourishing herbs (sheng di huang / Rehmannia raw, mai men dong / Ophiopogon, gou qi zi / Lycium berry, nü zhen zi / Ligustrum, han lian cao / Eclipta) which work by restoring fluid and substrate rather than stimulating function.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 5 (Yin Yang Ying Xiang Da Lun / 阴阳应象大论) — yin and yang as observation polarities; deficiency of the cooling-moistening pole presenting as heat-with-dryness",
      },
      secondary: {
        ...BENSKY_GAMBLE_MATERIA_MEDICA,
        locator:
          "Chapter on Herbs that Nourish the Yin — the modern materia-medica response to constitutional yin-xu, including the Rehmannia / Ophiopogon / Lycium / Ligustrum class",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Compound dyskrasia — hot + dry (choleric, Galen)",
        observation:
          "The Galenic choleric temperament names the empirically continuous hot-dry phenotype: warm dry skin, sharp febrile responses, irritability, scant dry stools, tendency toward inflammatory rather than catarrhal patterns. Galen and the Hippocratic De Natura Hominis prescribe combined cooling-and-moistening — the same direction the TCM yin-nourishing herbs move.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator:
            "De Temperamentis, Books III–IV — the choleric (hot-dry) compound dyskrasia and yellow bile",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Dry irritation (Felter)",
        observation:
          "Felter's framework places the same picture at the dry-irritation tissue state with hectic febrile overlay: dry mucous membranes with low-amplitude inflammation, scant secretions, restlessness. The Eclectic indication is demulcent moisteners (slippery elm, marshmallow root) combined with cooling sedatives — a direction empirically continuous with the TCM yin-nourishing response.",
        citation: {
          ...FELTER_1922,
          locator:
            "Therapeutics — irritated tissue states with hectic febrile overlay; indications for demulcents combined with cooling sedatives",
        },
      },
      {
        tradition: "unani",
        pattern: "Mizāj ṣafrāwī (yellow-bile / hot-dry temperament)",
        observation:
          "Unani observation: the mizāj-i ḥārr-yābis sees the body tilted hot and dry simultaneously — yellow bile predominant. Avicenna prescribes combined cooling-moistening regimens (mubarrid + muraṭṭib) and herbs that perform both tasks such as fumitory, dandelion, and chicory. Direct lineage of the Galenic framework.",
        citation: {
          ...AVICENNA_CANON,
          locator:
            "Canon of Medicine, Book I, Fann I — on the compound temperaments; mizāj ṣafrāwī",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Pitta-Vata vikriti (heat-with-dryness)",
        observation:
          "Ayurvedic observation: a body presenting with the heat-quality of Pitta and the dry-quality of Vata simultaneously aggravated — sharp digestive fire with depleted moisture, irritability with insomnia, inflammatory tendency on dry tissue. The Caraka Samhita describes Pitta-Vata samsarga as a recognized dual-dosha vikriti — empirically continuous with yin-xu.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana / Vimanasthana — descriptions of Pitta-Vata samsarga (combined dosha aggravation)",
        },
      },
    ],
    observationalNotes:
      "Yin Xu sits at the heat-with-depletion pole — the empirically distinctive feature is the heat presenting alongside dryness and depletion (rather than alongside fullness, as in damp-heat or yang excess). Frequently co-presents with qi-xu on the same body when chronic. Bridges to the Galenic choleric temperament and to the Ayurvedic Pitta-Vata samsarga vikriti.",
  },

  /* ---------------------------- Phlegm-Damp --------------------------- */
  phlegm_damp: {
    slug: "phlegm_damp",
    displayName: "Tan Shi — Phlegm-Dampness Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body that holds onto fluid and substance — fuller-bodied build, oily skin and hair, heavy-headed sensation, abundant phlegm, slow digestion, soft sweet preference.",
    description:
      "Tan Shi (痰湿质, 'phlegm-dampness' constitution) describes a body in which jin-ye (body fluids) accumulate as pathological dampness and condense into phlegm (tan), with the spleen-stomach transporting function unable to mobilize and disperse the load. The presentation is fullness and heaviness: pale tongue with thick greasy white coating; slippery or soggy pulse; fuller-bodied or overweight build with soft tissue; oily skin and hair; sensation of heaviness in the head and limbs; chest oppression; abundant clear or white phlegm; loose sticky stools; preference for sweet and rich food; slow mental processing; dampness-aggravated symptoms in humid weather. The Suwen and Lingshu describe the picture under the rubric of pathological accumulation of jin-ye and the spleen's failure to transport (脾失健运 pi shi jian yun); Maciocia frames the modern reception as the canonical phlegm-damp constitutional pattern, with the materia-medica response centered on damp-resolving and phlegm-transforming herbs (cang zhu / Atractylodes lancea, ban xia / Pinellia preparata, fu ling / Poria, chen pi / Citrus peel, yi yi ren / Coix seed) and dietary moderation of sweet, rich, cold, and raw foods.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 65 (Biao Ben Bing Chuan Lun / 标本病传论) and surrounding chapters — pathological accumulation of jin-ye (body fluids) and the spleen-stomach axis's role in fluid transformation",
      },
      secondary: {
        ...MACIOCIA_FOUNDATIONS,
        locator:
          "Chapter on Phlegm and Dampness — the canonical phlegm-damp constitutional pattern and its modern materia-medica response",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Compound dyskrasia — cold + wet (phlegmatic, Galen)",
        observation:
          "The Galenic phlegmatic temperament names the empirically continuous picture: cool damp tissues, slow full pulse, abundant catarrhal secretions, soft tissue tone, oedematous tendency, slow steady disposition. The Eclectic and Greek-Arabic prescription is warming-and-drying combined — the same direction the TCM phlegm-transforming herbs move.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator:
            "De Temperamentis, Books III–IV — the phlegmatic (cold-wet) compound dyskrasia and phlegm",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Damp / catarrhal diathesis (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the wet tilt: abundant secretions, soft tissue tone, oedematous tendency, catarrhal accumulation. The Physiomedical and Eclectic protocol applies astringents (yellow dock, cranesbill), lymphatic drainers (cleavers, calendula), and drying expectorants (elecampane, hyssop) — the same direction the TCM phlegm-resolving herbs move.",
        citation: {
          ...COOK_1869,
          locator:
            "On damp / catarrhal diatheses and the indications for astringents, lymphatic drainers, and drying expectorants",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Kapha vikriti (cold-wet-quality predominant aggravation)",
        observation:
          "Ayurvedic observation: a body presenting with the cold-quality and wet-oily-quality of Kapha simultaneously aggravated — sluggish digestion with mucosal congestion, weight gain with oedematous tendency, slow steady tone with mucus accumulation. The Caraka Samhita describes pure Kapha vikriti as the cold-wet phenotype — empirically continuous with phlegm-damp at the level of clinical presentation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator: "Sutrasthana — on the śīta (cold) and snigdha (wet/oily) guṇa of Kapha in vikriti",
        },
      },
    ],
    observationalNotes:
      "Tan Shi sits at the accumulation-stagnation pole on the wet-cool side. Frequently co-presents with yang-xu (cold-deficiency feeding fluid stagnation) and with damp-heat constitution (when the accumulated dampness ferments toward heat). Bridges to the Galenic phlegmatic temperament and to the Ayurvedic Kapha vikriti.",
  },

  /* ---------------------------- Damp-Heat ---------------------------- */
  damp_heat: {
    slug: "damp_heat",
    displayName: "Shi Re — Damp-Heat Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body that runs both damp and warm — oily skin prone to acne, bitter or greasy taste, urinary or bowel irritation, irritable temperament, heavy-headed sensation with heat.",
    description:
      "Shi Re (湿热质, 'damp-heat' constitution) describes a body in which dampness and heat are constitutionally combined — the dampness providing accumulation and stagnation, the heat providing inflammatory reactivity. The presentation is greasy and warm: red tongue with thick yellow greasy coating; rapid slippery or wiry pulse; oily skin prone to acne, eczema, and folliculitis; bitter or greasy taste; halitosis; yellow-tinted urine with sensation of urinary heat; sticky foul stools or alternating constipation and diarrhoea with sensation of incomplete evacuation; irritability; preference for cool drinks but limited capacity for cold food; aggravation in humid hot weather. The Suwen describes the picture under chapters on seasonal damp-heat patterns and dietary triggers; Bensky/Clavey/Stöger frame the modern materia-medica response as damp-heat-clearing herbs (huang lian / Coptis, huang qin / Scutellaria, yin chen hao / Artemisia capillaris, ku shen / Sophora, long dan cao / Gentiana scabra) which combine bitter-cold function to clear heat with damp-resolving function to drain accumulation.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 33 (Re Lun / 热论) and surrounding chapters — damp-heat presentations with seasonal and dietary triggers",
      },
      secondary: {
        ...BENSKY_GAMBLE_MATERIA_MEDICA,
        locator:
          "Chapter on Herbs that Clear Heat and Drain Damp — the modern materia-medica response to constitutional damp-heat, including the Coptis / Scutellaria / Gentiana class",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Compound dyskrasia — hot + wet (sanguine / plethoric, Galen)",
        observation:
          "The Galenic sanguine temperament names a partially overlapping hot-wet phenotype, but the canonical Galenic match for damp-heat is the bilious-plethoric variant where heat and dampness combine pathologically: warm full pulse, fullness in chest or abdomen, sticky greasy presentations. Galen prescribes combined cooling-AND-drying alteratives — the same direction the TCM damp-heat-clearing herbs move.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator:
            "De Temperamentis, Books III–IV — bilious-plethoric variants combining hot and damp qualities",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Hot damp diathesis with bilious overlay (Cook / Felter)",
        observation:
          "Cook and Felter describe the Eclectic reception of the combined hot-damp tilt: oily skin, bilious taste, sluggish damp bowel with irritation. The Eclectic protocol applies cooling alteratives (yellow dock, dandelion root, burdock) combined with damp-clearing diuretics (cleavers, parsley root) — the same direction the TCM damp-heat-clearing herbs move.",
        citation: {
          ...COOK_1869,
          locator:
            "On hot damp diatheses with bilious overlay; the indications for cooling alteratives and damp-clearing diuretics",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Pitta-Kapha vikriti (heat-with-dampness)",
        observation:
          "Ayurvedic observation: a body presenting with the heat-quality of Pitta and the wet-oily-quality of Kapha simultaneously aggravated — strong digestion with mucosal congestion, inflammatory tissue with oedematous and oily tendency, irritability with sticky bowels. The Caraka Samhita describes Pitta-Kapha samsarga as a recognized dual-dosha vikriti — empirically continuous with damp-heat at the level of clinical presentation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana / Vimanasthana — descriptions of Pitta-Kapha samsarga",
        },
      },
    ],
    observationalNotes:
      "Shi Re sits at the accumulation-with-inflammation pole. Frequently emerges from chronic phlegm-damp constitution when the accumulated dampness ferments toward heat (the so-called damp-heat transformation), and frequently aggravated by hot humid climate, alcohol, fried and rich food. Bridges to the Galenic sanguine / bilious-plethoric variant and to the Ayurvedic Pitta-Kapha samsarga.",
  },

  /* ---------------------------- Blood Stasis -------------------------- */
  blood_stasis: {
    slug: "blood_stasis",
    displayName: "Xue Yu — Blood Stasis Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body in which circulation runs sluggishly and unevenly — dull or dusky complexion, easy bruising, fixed sharp pains, dark menstrual blood with clots, dark-purple tongue with stasis spots.",
    description:
      "Xue Yu (血瘀质, 'blood-stasis' constitution) describes a body in which xue (the circulating-nourishment substrate) moves sluggishly or unevenly through the channels and vessels, producing localized stagnation. The presentation is fixed and dusky: dark-purple or bluish tongue, sometimes with petechial 'stasis spots' (yu dian) on the tongue body or sublingual veins; choppy (se mai 涩脉) or wiry pulse; dull, dusky, or pigmented complexion; periorbital darkening; easy bruising; fixed sharp or stabbing pains aggravated at night and at rest; varicose or spider veins; dark menstrual blood with clots in women; dryness of skin with rough texture; tendency toward fibroids, cysts, and adhesions. The Suwen describes the picture under chapters on the qi-blood relationship and the consequences of disturbed xue flow; Wang Qi's modern operationalization places the constitutional pattern within the broader pharmacology of xue stasis as observable circulatory phenotype, with materia-medica response centered on blood-quickening herbs (dan shen / Salvia miltiorrhiza, chuan xiong / Ligusticum, hong hua / Carthamus, tao ren / Persica seed, san qi / Panax notoginseng) that the modern peer-reviewed pharmacology literature cross-references with antiplatelet, microcirculation-improving, and anti-fibrotic mechanisms.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 39 (Ju Tong Lun / 举痛论) and surrounding chapters — qi-blood relationship and the consequences of disturbed xue flow",
      },
      secondary: {
        ...WANG_QI_2008_FRONT_MED,
        locator:
          "Section on the 9-constitution framework's blood-stasis pattern (xue yu zhi / 血瘀质) and its pharmacological correlates in modern circulatory medicine",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Constriction tissue state with vascular stasis (Cook / Felter)",
        observation:
          "Cook's tissue-state framework places the same picture at the constriction pole with circulatory stasis: tightened vascular tone, sluggish microcirculation, fixed congestive presentations. Felter prescribes circulatory stimulants combined with relaxants and alteratives. The Physiomedical and Eclectic indication is mobilization — the same direction the TCM blood-quickening herbs move.",
        citation: {
          ...COOK_1869,
          locator:
            "On constriction tissue states with vascular stasis; indications for circulatory mobilizers and alteratives",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Compound dyskrasia — cold + dry (melancholic / atrabilious, Galen)",
        observation:
          "The Galenic melancholic temperament partially overlaps the empirical phenotype: cool dry skin, slow weak pulse, depressive tone, and the classical 'atrabilious' attribution to thickened blood. Galen prescribes warming-and-moistening — a partially-overlapping direction; the TCM blood-quickening response adds active mobilization that the Galenic framework approaches via warming circulatory diffusives.",
        citation: {
          ...GALEN_DE_TEMPERAMENTIS,
          locator:
            "De Temperamentis, Book IV — the melancholic (cold-dry) compound dyskrasia and black bile / atrabilious presentations",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Vata-Pitta vikriti with rakta-dushti (blood-tissue corruption)",
        observation:
          "Ayurvedic observation: a body presenting with Vata's circulatory irregularity overlapping Pitta's tendency to inflame the rakta-dhatu (blood tissue), producing fixed pains, vascular congestion, and tissue-level stagnation. The Caraka Samhita catalogues rakta-dushti (corrupted-blood) syndromes — empirically continuous with xue yu at the level of palpable presentation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sutrasthana / Sharirasthana — on rakta-dhatu, rakta-dushti, and the Vata-Pitta circulatory dyssfunction phenotype",
        },
      },
    ],
    observationalNotes:
      "Xue Yu sits at the circulation-failure pole. Frequently emerges from chronic qi-xu (qi failing to move blood), qi-stagnation (qi blockage producing downstream blood stagnation), or yang-xu (cold congealing blood); also from trauma, surgery, and chronic inflammatory disease. Bridges most cleanly to Cook's constriction tissue state with vascular component, and to the Ayurvedic rakta-dushti spectrum.",
  },

  /* ---------------------------- Qi Stagnation ------------------------- */
  qi_stagnation: {
    slug: "qi_stagnation",
    displayName: "Qi Yu — Qi Stagnation Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body whose qi-flow runs uneven and pent-up — tense-introspective temperament, sighing, chest or rib oppression, premenstrual irritability, sleep-onset difficulty.",
    description:
      "Qi Yu (气郁质, 'qi-stagnation' constitution) describes a body in which qi — observable vitality phenotype — does not flow smoothly through its channels and organ functions, producing functional pent-up pressure rather than substrate deficiency. The presentation is tense and introspective: pale-red or pale tongue with thin white coating; wiry pulse (xian mai 弦脉, especially at the left guan position corresponding to liver function); tendency to sigh, frequent throat-clearing or sensation of plum-pit obstruction (mei he qi 梅核气); chest, rib, or hypochondriac oppression; introspective and brooding temperament with low resilience to stress; pre-menstrual irritability and breast distension in women; sleep-onset difficulty with overactive thoughts; emotional reactivity especially to interpersonal stress; alternating dampness and dryness in stools; symptoms shift with mood. The Suwen describes the picture in terms of liver-qi failing its smooth-coursing function (gan shi shu xie / 肝失疏泄); Maciocia frames the modern reception as the canonical qi-stagnation constitutional pattern, with the materia-medica response centered on qi-regulating and liver-soothing herbs (chai hu / Bupleurum, xiang fu / Cyperus, mei gui hua / rose bud, zhi ke / bitter orange peel, qing pi / unripe citrus peel) and behavioral interventions around emotional expression and movement.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 39 (Ju Tong Lun / 举痛论) and surrounding chapters — qi-flow disturbance and the smooth-coursing function of the liver",
      },
      secondary: {
        ...MACIOCIA_FOUNDATIONS,
        locator:
          "Chapter on Qi Stagnation — the canonical qi-stagnation constitutional pattern and the modern materia-medica response centered on liver-soothing and qi-regulating herbs",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Constriction tissue state with nervine overlay (Cook / Felter)",
        observation:
          "Cook's tissue-state framework places the same picture at the constriction pole with nervous-system tension: tightened tissue tone driven by sympathetic dominance and emotional pent-up pressure. Felter prescribes nervine relaxants (lobelia, scullcap, valerian, motherwort) combined with mild bitter aperients — empirically continuous with the TCM qi-regulating direction.",
        citation: {
          ...FELTER_1922,
          locator:
            "Therapeutics — constriction states with nervous-system overlay; indications for nervine relaxants and mild bitter aperients",
        },
      },
      {
        tradition: "western_eclectic",
        pattern: "Compound dyskrasia — cold + dry with depressive tension (melancholic with constriction, Galen)",
        observation:
          "The Galenic melancholic temperament partially overlaps the picture when the constriction is paired with depression and introversion. Galen and the Hippocratic De Natura Hominis prescribe warming-and-moistening; the qi-stagnation response adds active qi-regulation (rather than substrate restoration) — the additional axis the TCM framework distinguishes.",
        citation: {
          ...HIPPOCRATES_NATURE_OF_MAN,
          locator:
            "On the Nature of Man — the four humours and their seasonal-organ attachments; the melancholic (autumn / spleen) cold-dry tilt with depressive tone",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Vata vikriti with manas-srotas-sankocha (mind-channel constriction)",
        observation:
          "Ayurvedic observation: a body presenting with Vata's irregular circulatory and nervous-system function, manifesting as tension, anxiety, irregular bowel function, and constriction of the manas-vaha-srotas (mind-channels). The Caraka Samhita describes srotas-sankocha — narrowing of the channels — as a Vata-driven phenotype empirically continuous with qi-stagnation.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Vimanasthana / Sharirasthana — on the srotamsi (channels), srotas-sankocha (channel narrowing), and Vata-driven channel-tension phenotypes",
        },
      },
    ],
    observationalNotes:
      "Qi Yu is the constitutional pattern most often correlated in modern CCMQ-validated cohort studies with depression, anxiety, premenstrual syndrome, and stress-related functional gastrointestinal disorders. Bridges to Cook's constriction tissue state at the body-system level and to the Ayurvedic Vata vikriti with srotas-sankocha at the channel level. Frequently progresses to xue yu (qi-stagnation feeding blood-stasis) when chronic.",
  },

  /* --------------------- Special / Allergic Predisposition ------------ */
  special_predisposition: {
    slug: "special_predisposition",
    displayName: "Te Bing — Special / Allergic-Predisposed Constitution",
    category: "tcm_constitution",
    shortDescription:
      "A body whose terrain runs hypersensitive — atopic / allergic tendency, easy reactivity to environmental triggers, food sensitivities, drug reactions, hereditary or congenital vulnerability patterns.",
    description:
      "Te Bing (特禀质, 'special-predisposition' or 'unique-endowment' constitution) describes a body whose terrain is constitutionally hypersensitive — atopic, allergic, or otherwise vulnerable to triggers (environmental, dietary, pharmacological) that the other eight constitutional patterns tolerate without reactivity. The presentation varies by sub-type: allergic predisposition (allergic rhinitis, asthma, urticaria, atopic dermatitis); hereditary or congenital patterns (asthma diatheses, atopic dermatitis runs in family lines, congenital syndromes); food and drug sensitivities; recurrent low-amplitude reactions to environmental triggers (seasons, dust, pollen, temperature swings); recurrent skin presentations on minor provocation. The classical Suwen and Lingshu describe constitutional vulnerability under the rubric of yi gan ti zhi (易感体质, 'easily-affected constitution') — the body that takes ill from triggers others ignore. Wang Qi's national standard ZYYXH/T157-2009 codifies this as the ninth constitutional pattern, capturing a phenotype that the modern industrial environment has made increasingly clinically prominent (atopic, allergic, and hypersensitivity disorders) and that the eight earlier patterns do not by themselves account for. Materia-medica response is highly individualized, often combining mild yin-nourishing or qi-stabilizing tonics with avoidance of trigger exposure and slow desensitization.",
    citations: {
      primaryText: {
        ...HUANGDI_NEIJING_SUWEN,
        locator:
          "Suwen Ch. 5 (Yin Yang Ying Xiang Da Lun / 阴阳应象大论) and Ch. 64 (Si Shi Ci Ni Cong Lun / 四时刺逆从论) — discussion of constitutional vulnerability and the body that is 'easily affected' (yi gan / 易感) by triggers others tolerate",
      },
      secondary: {
        ...ZYYXH_T157_2009,
        locator:
          "Section on Te Bing Zhi (特禀质) — the codified ninth constitutional pattern operationalized as the canonical reception of the classical 'easily-affected constitution' (易感体质)",
      },
    },
    traditionalObservations: [
      {
        tradition: "western_eclectic",
        pattern: "Constitutional sensitivity / atopic terrain (Cook / Felter)",
        observation:
          "Cook and Felter describe the empirically overlapping clinical phenotype as the constitutionally sensitive or atopic terrain: a body that reacts disproportionately to minor triggers, with chronic catarrhal, dermatologic, and respiratory sensitivities. The Eclectic indication is constitutional rebuilding (alteratives, mild adaptogens, demulcent tonics) combined with trigger-avoidance and slow restoration of mucosal barrier integrity rather than aggressive symptom suppression.",
        citation: {
          ...FELTER_1922,
          locator:
            "Therapeutics — constitutionally sensitive / atopic terrain; indications for alteratives, demulcent tonics, and constitutional rebuilding",
        },
      },
      {
        tradition: "ayurveda",
        pattern: "Janma prakriti with constitutional vulnerability",
        observation:
          "Ayurvedic observation: the Caraka Samhita's framework of janma prakriti (the constitutional type one is born with) accommodates phenotypes of inherited or congenital vulnerability — bodies whose dosha balance is constitutionally biased toward reactivity, with hereditary patterns of allergic, asthmatic, or hypersensitivity disorders. Empirically continuous with te bing zhi at the level of inherited-vulnerability framing.",
        citation: {
          ...CARAKA_SAMHITA_KAVIRATNA,
          locator:
            "Sharirasthana — on janma prakriti, garbha-vyapad, and the inherited / congenital vulnerability phenotype",
        },
      },
    ],
    observationalNotes:
      "Te Bing Zhi is the most modern of the nine Wang Qi patterns by date of explicit codification, capturing a phenotype (atopic, allergic, hypersensitivity) that the classical Suwen / Lingshu framework recognizes under the broader rubric of constitutional vulnerability (易感体质 yi gan ti zhi) but that the eight earlier patterns do not by themselves account for. Lacks a clean Galenic temperament parallel — the four classical compound dyskrasias are organized along thermal and humoral axes rather than along reactivity-vs-tolerance axes. Bridges most cleanly to the Eclectic 'constitutionally sensitive' diathesis and to the Ayurvedic janma-prakriti vulnerability framing.",
  },
};

/**
 * Typed accessor. Use in UI components and result-rendering surfaces
 * instead of indexing the registry directly — preserves type safety
 * and centralizes any future fallback / observability hook.
 */
export function getTcmConstitutionContent(
  reading: TcmConstitution,
): ContentEntry {
  return TCM_CONSTITUTION_CONTENT[reading];
}

/**
 * Stable ordered list — useful for rendering all nine patterns in
 * comparison cards, deep-diagnostic explainers, and the citation
 * manifest review UI. Order follows the Wang Qi national standard
 * ZYYXH/T157-2009: pinghe (the reference baseline) first, followed
 * by the eight deviations grouped by domain — vitality deficiencies
 * (qi / yang / yin), accumulation patterns (phlegm-damp, damp-heat),
 * circulation patterns (blood stasis, qi stagnation), and the
 * special-predisposition pattern.
 */
export const TCM_CONSTITUTIONS: readonly TcmConstitution[] = [
  "pinghe",
  "qi_deficiency",
  "yang_deficiency",
  "yin_deficiency",
  "phlegm_damp",
  "damp_heat",
  "blood_stasis",
  "qi_stagnation",
  "special_predisposition",
] as const;
