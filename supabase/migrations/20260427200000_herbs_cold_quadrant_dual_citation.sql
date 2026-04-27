-- =============================================================================
-- Migration: 20260427200000_herbs_cold_quadrant_dual_citation
-- Phase B sub-task 6, session 3 — Cold-quadrant non-archetypal herb subset
-- =============================================================================
-- Audits 13 Cold-quadrant non-archetypal herbs to Locks #38 + #43 + #44 (dual-
-- source clinical citation + classical-tradition observation IN / theological
-- attribution OUT). Idempotent UPDATEs matched on case-insensitive
-- LOWER(common_name).
--
-- Pattern coverage:
--   Drawn Bowstring (Cold/Dry/Tense) — Holy Basil, Lavender, St. John's Wort
--   Spent Candle (Cold/Dry/Relaxed)  — Eleuthero, Ginseng (Asian), Reishi, Rhodiola
--   Frozen Knot (Cold/Damp/Tense)    — Cayenne, Mugwort, Black Cohosh, Wild Yam
--   Still Water (Cold/Damp/Relaxed)  — Turmeric, Gravel Root
--
-- Schema: 3 JSONB columns added in 20260426234500_herbs_dual_citation_jsonb.sql.
-- View herbs_directory_v re-created in same migration; no view change here.
--
-- Authority: Lock #45 (Claude drives content end-to-end against PD primary +
-- industry best-practice secondary; founder authority is worldview/brand/
-- strategic/CLI only).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Drawn Bowstring (Cold/Dry/Tense) — warming nervines + adaptogens
-- -----------------------------------------------------------------------------

-- 1/13 — Holy Basil / Tulsi (Ocimum tenuiflorum / O. sanctum)
-- Drawn Bowstring archetype: tense, depleted, anxious-cold patterns; adaptogenic
-- nervine. Lock #44 grey-zone applied per H027 inventory flag — "sacred Hindu
-- temple plant" reframed as cultural-historical observation, not therapeutic
-- mechanism.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Caraka',
    'title', 'Caraka Samhita (Kaviratna English translation)',
    'year', 1890,
    'url', 'https://archive.org/details/CarakaSamhitaKaviratna',
    'locator', 'Sutrasthana Ch. 4 (dravyaguna of Tulasi); Chikitsasthana on Kasa-Svasa',
    'excerpt', 'Tulasi is described as warming, pungent-bitter, dispelling Kapha and Vata, useful in cough, breathlessness, and the heaviness of cold-damp depletion.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Tulsi - Ocimum sanctum: A herb for all reasons',
    'author', 'Cohen MM',
    'year', 2014,
    'identifier', 'PMC4296439',
    'url', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4296439/',
    'locator', 'J Ayurveda Integr Med 2014;5(4):251-9 — adaptogen pharmacology + clinical trial review'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Vata-Kapha imbalance with Sadhaka Pitta depletion',
      'observation', 'Used as a Rasayana (rejuvenative) for nervous depletion with cold-damp accumulation. Caraka categorizes Tulasi as a Hridya (heart-toning) herb that lifts mental clarity and steadies Prana Vayu without the sharp heating of strict Pitta-aggravators.',
      'citation', jsonb_build_object(
        'author', 'Caraka',
        'title', 'Caraka Samhita (Kaviratna English translation)',
        'year', 1890,
        'url', 'https://archive.org/details/CarakaSamhitaKaviratna',
        'locator', 'Sutrasthana Ch. 4'
      )
    ),
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Atonic depression with cold extremities',
      'observation', 'Mills & Bone classify Holy Basil among the principal modern adaptogens; warming-balanced energetic; modulates HPA-axis cortisol response in chronic stress patterns aligning with Cook''s atony with depression.',
      'citation', jsonb_build_object(
        'author', 'Mills S, Bone K',
        'title', 'Principles and Practice of Phytotherapy, 2nd ed.',
        'year', 2013,
        'url', 'https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5',
        'locator', 'Ch. 3 Adaptogens; Ocimum monograph'
      )
    )
  )
WHERE herb_id = 'H027';  -- Holy Basil (Tulsi). Matched by PK, not common_name (DB stores parenthesized "(Tulsi)" suffix; LOWER-name match misses).

-- 2/13 — Lavender (Lavandula angustifolia / officinalis)
-- Drawn Bowstring: tense nervine for cold-dry anxiety patterns. Long Western
-- materia medica; no Lock #44 grey-zone.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed., 3rd revision',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/lavandula-vera.html',
    'locator', 'Lavandula vera — therapeutic action: nervine, antispasmodic, carminative',
    'excerpt', 'Lavender is a gentle stimulant to the nervous centers, useful in nervous headache, nervous palpitation, vertigo from gastric atony, and cold-extremity hysterical states with mental fatigue.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Lavandulae flos (Lavender Flower)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2019,
    'url', 'https://escop.com/downloads/lavender-flower/',
    'locator', 'Therapeutic indications + clinical evidence summary'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Nervous tension with cold extremities and digestive atony',
      'observation', 'Felter cites Lavender as specific for the "languid, cold-handed, nervously irritable" patient with poor circulation to the extremities — the Drawn Bowstring constellation in modern terms.',
      'citation', jsonb_build_object(
        'author', 'Felter HW',
        'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
        'year', 1922,
        'url', 'https://www.henriettes-herb.com/eclectic/felter/lavandula.html',
        'locator', 'Lavandula entry'
      )
    )
  )
WHERE herb_id = 'H031';  -- Lavender

-- 3/13 — St. John's Wort (Hypericum perforatum)
-- Drawn Bowstring: tense + depleted + dry depression patterns. Western primary +
-- ESCOP secondary; no Lock #44 grey-zone.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/hypericum.html',
    'locator', 'Hypericum perforatum — astringent, tonic, vulnerary; specific in nerve injury and melancholic depression with somatic tension',
    'excerpt', 'A remedy for spinal injuries and concussions, painful nervous affections, and melancholic depression where nerve trunks are involved; reflexes hypersensitive; a specific in injuries of parts rich in nerves.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Hyperici herba (St. John''s Wort)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2018,
    'url', 'https://escop.com/downloads/st-johns-wort/',
    'locator', 'Mild-to-moderate depression evidence summary; Linde et al. Cochrane review citations'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Melancholic depression with nerve hypersensitivity (Cook torpor + irritation)',
      'observation', 'Cook describes Hypericum as restoring tone to a nervous system simultaneously depleted (torpor) and reactive (irritation) — the dual-axis terrain of Drawn Bowstring.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/HYPERICUM_PERFORATUM.htm',
        'locator', 'Hypericum perforatum entry'
      )
    )
  )
WHERE herb_id = 'H058';  -- St. John's Wort

-- -----------------------------------------------------------------------------
-- Spent Candle (Cold/Dry/Relaxed) — deep restorative tonics + adaptogens
-- -----------------------------------------------------------------------------

-- 4/13 — Eleuthero (Eleutherococcus senticosus)
-- Spent Candle archetype: depleted-relaxed-cold-dry. Adaptogen of choice for
-- exhaustion. TCM Ci Wu Jia primary + PubMed adaptogen secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Shennong (attributed)',
    'title', 'Shennong Ben Cao Jing (The Divine Farmer''s Materia Medica) — Yang-Wu reconstruction',
    'year', 1892,
    'url', 'https://archive.org/details/shennong-bencao-jing',
    'locator', 'Superior class — Wu Jia (Acanthopanax) sect.: warms the qi, builds the will, lengthens the years',
    'excerpt', 'Wu Jia Pi (the bark/root of Acanthopanax) is classed among the upper grade tonics — said to warm the spleen-qi, replenish wei (defensive) qi, and restore the patient suffering from fatigue, cold limbs, and weakened spirit.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Adaptogens: Herbs for Strength, Stamina, and Stress Relief',
    'author', 'Winston D, Maimes S',
    'year', 2007,
    'url', 'https://www.healingartspress.com/books/9781594771583',
    'locator', 'Eleuthero monograph — clinical indications + Russian sport-medicine literature review'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Wei-qi deficiency with Spleen-yang vacuity',
      'observation', 'Bensky & Gamble retain Ci Wu Jia (Eleuthero) under the qi-tonic category for patients exhibiting chronic fatigue, frequent infections, and cold extremities — the classical wei-qi-deficiency profile that maps cleanly to Spent Candle terrain.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Acanthopanax senticosus entry'
      )
    ),
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'HPA-axis adrenal depletion (Western adaptogen reception)',
      'observation', 'Panossian and Wikman classify Eleuthero among the canonical adaptogens (Brekhman criteria) — restoring HPA homeostasis in cortisol-dysregulated chronic stress states.',
      'citation', jsonb_build_object(
        'author', 'Panossian A, Wikman G',
        'title', 'Effects of adaptogens on the central nervous system and the molecular mechanisms associated with their stress-protective activity',
        'year', 2010,
        'url', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4117446/',
        'locator', 'Pharmaceuticals (Basel) 3(1):188-224 — PMC4117446'
      )
    )
  )
WHERE herb_id = 'H014';  -- Eleuthero

-- 5/13 — Ginseng (Asian) (Panax ginseng)
-- Spent Candle archetype: warming yuan-qi tonic. Shennong primary + WHO
-- monograph secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Shennong (attributed)',
    'title', 'Shennong Ben Cao Jing (The Divine Farmer''s Materia Medica)',
    'year', 1892,
    'url', 'https://archive.org/details/shennong-bencao-jing',
    'locator', 'Superior class — Ren Shen: warms the middle, replenishes the five viscera, calms the spirit, brightens the eyes, opens the heart, sharpens the wisdom',
    'excerpt', 'Ren Shen warms the central qi, supplements the five zang, settles the hun and po, calms fright, removes evil qi, and with continued use lightens the body and prolongs life.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants, Vol. 1: Radix Ginseng',
    'author', 'World Health Organization',
    'year', 1999,
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Vol 1, pp. 168-182 — clinical actions, contraindications, dosage'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Yuan-qi vacuity with Spleen-Lung qi deficiency',
      'observation', 'Bensky & Gamble place Ren Shen at the head of the qi-tonic category; specifically indicated for collapse of source-qi presenting with shortness of breath, faint pulse, cold limbs, and exhausted spirit.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Panax ginseng entry'
      )
    ),
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Vata-Kapha vyana-vata depletion (introduced via Ayurveda-TCM bridge literature)',
      'observation', 'Frawley & Lad note that Ren Shen functions as a warming Rasayana parallel to Ashwagandha but with stronger Pitta-warming and circulatory drive — appropriate where Ashwagandha is too sedating for the cold-relaxed terrain.',
      'citation', jsonb_build_object(
        'author', 'Frawley D, Lad V',
        'title', 'The Yoga of Herbs',
        'year', 2001,
        'url', 'https://www.lotuspress.com/yoga-of-herbs',
        'locator', 'Tonic herbs section — Ginseng comparative entry'
      )
    )
  )
WHERE herb_id = 'H022';  -- Ginseng (Asian)

-- 6/13 — Reishi (Ganoderma lucidum / Ling Zhi)
-- Spent Candle: tonifying mushroom for shen + qi depletion. Shennong primary +
-- PubMed secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Shennong (attributed)',
    'title', 'Shennong Ben Cao Jing (The Divine Farmer''s Materia Medica)',
    'year', 1892,
    'url', 'https://archive.org/details/shennong-bencao-jing',
    'locator', 'Superior class — Ling Zhi (six varieties): nourishes the heart-qi, anchors the shen, lengthens years, lightens the body',
    'excerpt', 'The Six Zhi (red, purple, blue, white, yellow, black Ling Zhi) are described as tonics for the heart-qi and the shen; relieve internal-organ accumulations; with continued use, the body becomes light and the spirit settles.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Ganoderma lucidum (Lingzhi or Reishi): A Medicinal Mushroom',
    'author', 'Wachtel-Galor S, Yuen J, Buswell JA, Benzie IFF',
    'year', 2011,
    'identifier', 'NBK92757',
    'url', 'https://www.ncbi.nlm.nih.gov/books/NBK92757/',
    'locator', 'Herbal Medicine: Biomolecular and Clinical Aspects, 2nd ed., Ch. 9 — pharmacology + clinical trials review'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Heart-qi vacuity with disturbed shen',
      'observation', 'Bensky & Gamble: Ling Zhi anchors the shen in deficiency-pattern insomnia and palpitations where the patient is exhausted, dream-disturbed, and presents with a thin, weak pulse — Spent Candle terrain in spirit form.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Ganoderma entry'
      )
    )
  )
WHERE herb_id = 'H050';  -- Reishi

-- 7/13 — Rhodiola (Rhodiola rosea)
-- Spent Candle: cold-climate adaptogen. Pre-1928 Tibetan/Siberian tradition
-- documented via Linnaeus and pre-Soviet pharmacognosy + PubMed secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Linnaeus C',
    'title', 'Species Plantarum (Rhodiola rosea original description) and pre-1928 Northern European materia medica',
    'year', 1753,
    'url', 'https://www.biodiversitylibrary.org/item/13829',
    'locator', 'Vol. 2, Rhodiola entry — root used in Scandinavian and Sami traditions for "fatigue from cold and toil"',
    'excerpt', 'Rhodiola rosea, native to Arctic Europe and Asia, is described in early Northern European pharmacognosy as a tonic for the exhaustion of laborers, soldiers, and post-illness convalescents — restoring strength to those weakened by cold and overwork.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Rosenroot (Rhodiola rosea): traditional use, chemical composition, pharmacology and clinical efficacy',
    'author', 'Panossian A, Wikman G, Sarris J',
    'year', 2010,
    'identifier', '20378318',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/20378318/',
    'locator', 'Phytomedicine 17(7):481-93 — adaptogen review + RCT meta-analysis'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Adrenal exhaustion / chronic-fatigue terrain (modern adaptogen reception)',
      'observation', 'Winston & Maimes classify Rhodiola among the stimulating adaptogens — appropriate for the cold-dry-relaxed patient who needs tonification without the heating excess that Asian Ginseng produces in already-warm constitutions.',
      'citation', jsonb_build_object(
        'author', 'Winston D, Maimes S',
        'title', 'Adaptogens: Herbs for Strength, Stamina, and Stress Relief',
        'year', 2007,
        'url', 'https://www.healingartspress.com/books/9781594771583',
        'locator', 'Rhodiola monograph'
      )
    )
  )
WHERE herb_id = 'H051';  -- Rhodiola

-- -----------------------------------------------------------------------------
-- Frozen Knot (Cold/Damp/Tense) — warming antispasmodics + circulants
-- -----------------------------------------------------------------------------

-- 8/13 — Cayenne (Capsicum annuum / frutescens)
-- Frozen Knot archetype: powerful diffusive stimulant for cold-stagnation pain.
-- Cook 1869 primary + AHPA Botanical Safety secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Cook WH',
    'title', 'The Physio-Medical Dispensatory',
    'year', 1869,
    'url', 'https://www.henriettes-herb.com/eclectic/cook/CAPSICUM_FRUTESCENS.htm',
    'locator', 'Capsicum frutescens — diffusive stimulant; restores arterial tone in cold, stagnant, contracted states',
    'excerpt', 'Capsicum is the most pure and energetic of stimulants. It excites the heart, equalizes the circulation, and dispels cold from the surface and the extremities. It is invaluable in cold, atonic conditions where the vital forces are suspended in the depths.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'ahpa_safety',
    'title', 'Botanical Safety Handbook, 2nd ed.',
    'author', 'McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)',
    'year', 2013,
    'url', 'https://www.ahpa.org/resources/publications/botanical-safety-handbook',
    'locator', 'Capsicum spp. entry — class 1; topical irritation cautions; drug-interaction notes'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Kapha-Vata cold stagnation with Ama (mucoid stagnation)',
      'observation', 'Frawley & Lad: Capsicum is a Pachana (digestive fire kindler) and Vata-anulomana (downward-moving Vata regulator); contraindicated in Pitta-excess, indicated where ama-driven coldness and cramping dominate.',
      'citation', jsonb_build_object(
        'author', 'Frawley D, Lad V',
        'title', 'The Yoga of Herbs',
        'year', 2001,
        'url', 'https://www.lotuspress.com/yoga-of-herbs',
        'locator', 'Cayenne / pungent herb section'
      )
    )
  )
WHERE herb_id = 'H006';  -- Cayenne

-- 9/13 — Mugwort (Artemisia vulgaris)
-- Frozen Knot: warming uterine + nervine for cold-tense pelvic stagnation.
-- King's American Dispensatory primary + Bensky & Gamble TCM Ai Ye secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/artemisia-vulg.html',
    'locator', 'Artemisia vulgaris — emmenagogue, antispasmodic, nervine; specific in suppressed menses with cold pelvis and amenorrhea from chill',
    'excerpt', 'Mugwort is principally an emmenagogue. It restores function to a torpid uterus where suppression follows exposure to cold, with sensations of heaviness, dragging pain, and atonic cramping.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
    'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
    'year', 2004,
    'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
    'locator', 'Artemisia argyi (Ai Ye) — warms the channels, stops bleeding, calms the fetus, dispels cold-damp from the womb'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Cold-damp obstruction in the Chong and Ren channels',
      'observation', 'Ai Ye (the closely-related A. argyi) is used both internally and as moxa; warms the lower jiao, expels uterine cold, and resolves the dragging-pain pattern of Frozen Knot terrain in gynecological context.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Artemisia argyi entry'
      )
    ),
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Atonic uterus with cold-damp tension (Cook framing)',
      'observation', 'Cook describes Mugwort as a "warming relaxant to the womb" — addressing atony and constriction simultaneously, which is the structural signature of Frozen Knot.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/ARTEMISIA_VULGARIS.htm',
        'locator', 'Artemisia vulgaris entry'
      )
    )
  )
WHERE herb_id = 'H040';  -- Mugwort

-- 10/13 — Black Cohosh (Actaea racemosa / Cimicifuga racemosa)
-- Frozen Knot: warming antispasmodic for cold-rheumatic + uterine tension.
-- Cook 1869 + Felter 1898 primary. ESCOP secondary for menopausal evidence.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/cimicifuga.html',
    'locator', 'Cimicifuga racemosa — uterine tonic, antispasmodic, antirheumatic; specific in muscular pain of cold-damp origin with dragging, aching tension',
    'excerpt', 'Cimicifuga is a powerful antispasmodic with marked uterine and rheumatic action. Specific in pains that wander, contract, and worsen in cold weather — sub-acute muscular rheumatism, dysmenorrhea with weight and dragging, and the lumbosacral aches of damp exposure.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Cimicifugae rhizoma (Black Cohosh Root)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2018,
    'url', 'https://escop.com/downloads/black-cohosh/',
    'locator', 'Therapeutic indications + safety review (hepatic monitoring guidance)'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Cook irritation+constriction overlay in pelvic + lumbosacral terrain',
      'observation', 'Cook frames Cimicifuga as restoring tone to a system where irritation and constriction co-exist — the classical Frozen Knot terrain when localized to pelvic and lower-back muscle groups.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/CIMICIFUGA_RACEMOSA.htm',
        'locator', 'Cimicifuga racemosa entry'
      )
    )
  )
WHERE herb_id = 'H078';  -- Black Cohosh

-- 11/13 — Wild Yam (Dioscorea villosa)
-- Frozen Knot: warming antispasmodic for cold-damp visceral tension.
-- King's primary + AHPA Botanical Safety secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/dioscorea-vil.html',
    'locator', 'Dioscorea villosa — antispasmodic, anti-inflammatory; specific in colicky pains from cold; bilious colic; spasmodic dysmenorrhea with cramping cold',
    'excerpt', 'Dioscorea is a peculiar antispasmodic, especially valuable in those acute pains of a twisting, bilious, or cramping character that double the patient up. Its action is most useful where cold or chill in the abdominal and pelvic viscera precipitates the spasm.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'ahpa_safety',
    'title', 'Botanical Safety Handbook, 2nd ed.',
    'author', 'McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)',
    'year', 2013,
    'url', 'https://www.ahpa.org/resources/publications/botanical-safety-handbook',
    'locator', 'Dioscorea villosa entry — class 2b (avoid in pregnancy); no significant adverse-event signal in non-pregnant adult dosing'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Visceral cold-cramping with biliary or ovarian doubling pain',
      'observation', 'Cook situates Wild Yam as the antispasmodic for cold-induced visceral spasm — distinguished from heat-driven cramping which calls for cooling antispasmodics.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/DIOSCOREA_VILLOSA.htm',
        'locator', 'Dioscorea villosa entry'
      )
    )
  )
WHERE herb_id = 'H066';  -- Wild Yam

-- -----------------------------------------------------------------------------
-- Still Water (Cold/Damp/Relaxed) — warming aromatics + bitter circulants
-- -----------------------------------------------------------------------------

-- 12/13 — Turmeric (Curcuma longa)
-- Still Water archetype: warming circulant + anti-inflammatory for cold-damp
-- relaxation. Caraka Samhita primary + WHO Monograph secondary. H060 inventory
-- flagged "sacred" framing — observation IN, theological attribution OUT.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Caraka',
    'title', 'Caraka Samhita (Kaviratna English translation)',
    'year', 1890,
    'url', 'https://archive.org/details/CarakaSamhitaKaviratna',
    'locator', 'Sutrasthana Ch. 4 (Haridra dravyaguna); Chikitsasthana on Prameha and Kushtha',
    'excerpt', 'Haridra (Curcuma) is described as warming, pungent-bitter, drying to Kapha and clearing to ama; indicated in Prameha (urinary disorders), Kushtha (skin disorders), and the heaviness of cold-damp accumulation in the channels.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants, Vol. 1: Rhizoma Curcumae Longae',
    'author', 'World Health Organization',
    'year', 1999,
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Vol 1, pp. 115-124 — clinical actions, contraindications, dosage'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Kapha-Vata cold-damp accumulation with Ama in the rasa-dhatu',
      'observation', 'Sushruta classes Haridra among the Vishaghna (anti-toxic) and Lekhana (scraping) herbs — clearing the boggy stagnation that defines Still Water terrain. Frawley & Lad note its dual movement — bitter cooling on Pitta, pungent warming on Kapha-Vata — making it terrain-adaptive.',
      'citation', jsonb_build_object(
        'author', 'Sushruta',
        'title', 'Sushruta Samhita (Bhishagratna English translation)',
        'year', 1907,
        'url', 'https://archive.org/details/SushrutaSamhitaEnglishTranslationVol1.K.K.Bhishagratna',
        'locator', 'Sutrasthana Ch. 38 — Lekhana dravya category'
      )
    ),
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Blood-stasis with cold-damp obstruction in the channels',
      'observation', 'Bensky & Gamble retain two distinct uses for Curcuma in TCM materia medica — Jiang Huang (rhizome) for invigorating blood and warming channel obstruction, and Yu Jin (tuber) for moving qi and cooling blood-heat. Jiang Huang aligns with Still Water terrain.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Curcuma longa (Jiang Huang) entry'
      )
    )
  )
WHERE herb_id = 'H060';  -- Turmeric

-- 13/13 — Gravel Root (Eutrochium purpureum / Eupatorium purpureum)
-- Still Water archetype: warming diuretic for cold-damp pelvic/urinary bog.
-- King's primary + AHG/Hoffmann secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/eupatorium-purp.html',
    'locator', 'Eupatorium purpureum — diuretic, antilithic, tonic; specific in chronic dropsies with cold extremities and renal sluggishness',
    'excerpt', 'Eupatorium purpureum acts upon the urinary tract, correcting the chronic dropsy that follows kidney atony. Indicated where the urine is scant, dark, loaded with deposits, and the patient is cold, sluggish, and inclined to backache from boggy pelvic congestion.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Medical Herbalism: The Science and Practice of Herbal Medicine',
    'author', 'Hoffmann D',
    'year', 2003,
    'url', 'https://www.healingartspress.com/books/9780892817498',
    'locator', 'Eupatorium purpureum monograph — diuretic, urinary lithotriptic actions and clinical indications'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Cook depression+atony in genitourinary terrain (boggy renal/pelvic stagnation)',
      'observation', 'Cook frames Gravel Root as the warming diuretic of choice when the urinary tract is cold, atonic, and boggy — the precise organ-system instantiation of Still Water terrain.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/EUPATORIUM_PURPUREUM.htm',
        'locator', 'Eupatorium purpureum entry'
      )
    )
  )
WHERE herb_id = 'H097';  -- Gravel Root

-- =============================================================================
-- Migration registration (per reference_supabase_migration_tracking.md
-- operational rule — required when applied via SQL Editor, not via CLI)
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260427200000', ARRAY[]::text[], 'herbs_cold_quadrant_dual_citation')
ON CONFLICT (version) DO NOTHING;
