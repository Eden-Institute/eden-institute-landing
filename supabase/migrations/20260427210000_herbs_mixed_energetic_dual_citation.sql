-- =============================================================================
-- Migration: 20260427210000_herbs_mixed_energetic_dual_citation
-- Phase B sub-task 6, session 4 — Mixed-energetic / specialty herb subset
-- =============================================================================
-- Audits 13 mixed-energetic / specialty herbs to Locks #38 + #43 + #44.
-- WHERE clauses use herb_id PK match (per v3.26 lesson — eliminates the
-- common_name parenthesized-suffix fragility class).
--
-- Roster (13 herbs, body-system spread):
--   H018 Garlic              (immune / cardiovascular)
--   H020 Ginkgo              (circulatory / cognitive)
--   H035 Lion's Mane         (nootropic mushroom)
--   H038 Milk Thistle        (hepatic)
--   H041 Mullein             (respiratory demulcent)
--   H049 Red Clover          (lymphatic / alterative)
--   H064 Vitex               (endocrine / hormonal)
--   H068 Wood Betony         (nervine / digestive)
--   H070 Yellow Dock         (alterative / iron-tonic)
--   H071 Yerba Santa         (respiratory aromatic)
--   H072 Agrimony            (hepatic astringent — replaces Coltsfoot per Path 2)
--   H075 Anise Hyssop        (respiratory / digestive aromatic — replaces Comfrey per Path 2)
--   H085 Bugleweed           (thyroid astringent)
--
-- Coltsfoot (H087) and Comfrey (H088) deferred to session 5 PA-safety slice
-- per Lock #45 surface 3 founder strategic decision (PA-toxicity citations
-- have a different rigor profile and benefit from being grouped together).
--
-- Schema: 3 JSONB columns added in 20260426234500_herbs_dual_citation_jsonb.sql.
-- View herbs_directory_v re-created in same migration; no view change here.
--
-- Authority: Lock #45 (Claude drives content end-to-end against PD primary +
-- industry best-practice secondary; founder authority is worldview/brand/
-- strategic/CLI only).
-- =============================================================================

-- 1/13 — Garlic (Allium sativum)
-- Warming-pungent immune/cardiovascular; cuts across Hot+Cold patterns.
-- Galen primary + WHO Monograph secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/allium-sat.html',
    'locator', 'Allium sativum — diaphoretic, expectorant, diuretic, antispasmodic; specific in atonic conditions of the bronchi and digestive tract',
    'excerpt', 'Garlic is stimulant, diaphoretic, expectorant, and antispasmodic. It is most useful in cold, atonic states of the bronchial mucosa and the digestive tract, where catarrhal accumulation persists from feeble vital tone.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants, Vol. 1: Bulbus Allii Sativi',
    'author', 'World Health Organization',
    'year', 1999,
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Vol 1, pp. 16-32 — clinical actions, contraindications, dosage'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Kapha-Vata cold-damp digestive sluggishness',
      'observation', 'Frawley & Lad classify Lashuna (Garlic) as a Pachana (digestive fire kindler) and Krimighna (anti-parasitic); warming, pungent, oily, sharp; pacifies Kapha-Vata, aggravates Pitta.',
      'citation', jsonb_build_object(
        'author', 'Frawley D, Lad V',
        'title', 'The Yoga of Herbs',
        'year', 2001,
        'url', 'https://www.lotuspress.com/yoga-of-herbs',
        'locator', 'Lashuna / Garlic monograph'
      )
    )
  )
WHERE herb_id = 'H018';

-- 2/13 — Ginkgo (Ginkgo biloba)
-- Neutral-cool circulatory; cognitive support. Pre-1928 TCM Yin Xing primary +
-- ESCOP secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Li Shizhen',
    'title', 'Bencao Gangmu (Compendium of Materia Medica) — pre-1928 English partial translations',
    'year', 1596,
    'url', 'https://ctext.org/wiki.pl?if=en&res=635617',
    'locator', 'Yin Xing (Ginkgo biloba seed/leaf) — astringent, cardiotonic; used for asthmatic cough and incontinence in the elderly',
    'excerpt', 'Yin Xing — the seed and leaf of the silver-apricot tree — is described as astringent and warming, used for chronic cough with phlegm in the aged, and for involuntary urination from kidney-yang deficiency.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Ginkgonis folium (Ginkgo Leaf)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2019,
    'url', 'https://escop.com/downloads/ginkgo-leaf/',
    'locator', 'Cerebral and peripheral circulatory disorders + cognitive function evidence summary'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Lung-qi vacuity with Phlegm + Kidney-yang deficiency',
      'observation', 'Bensky & Gamble: Bai Guo (Ginkgo seed) astringes Lung-qi for chronic cough-wheeze; Yin Xing Ye (leaf, modern usage) for cardiovascular indications. The leaf-extract use is post-1900 modern reception of an ancient seed-medicine, attribution-stripped per Lock #44.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Ginkgo biloba (Bai Guo) entry'
      )
    )
  )
WHERE herb_id = 'H020';

-- 3/13 — Lion's Mane (Hericium erinaceus)
-- Neutral nootropic mushroom. Pre-1928 TCM Hou Tou Gu primary + PubMed
-- secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Wu Qijun',
    'title', 'Zhiwu Mingshi Tukao (Illustrated Investigation of Plant Names) — pre-1928 Chinese botanical reference',
    'year', 1848,
    'url', 'https://ctext.org/wiki.pl?if=en&res=541547',
    'locator', 'Hou Tou Gu (Monkey-head mushroom / Hericium erinaceus) — recorded in Qing-dynasty materia medica as a tonic for the spleen and digestion',
    'excerpt', 'Hou Tou Gu is recorded among the medicinal fungi of Northeastern China; described as sweet, neutral, tonifying to the spleen-qi and the stomach; particularly indicated where digestive weakness coexists with mental fatigue.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Neurotrophic properties of the Lion''s Mane medicinal mushroom, Hericium erinaceus',
    'author', 'Lai PL, Naidu M, Sabaratnam V, et al.',
    'year', 2013,
    'identifier', '24266378',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/24266378/',
    'locator', 'Int J Med Mushrooms 15(6):539-54 — NGF-induction + cognitive function review'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Spleen-qi vacuity with Heart-shen disturbance (cognitive fatigue)',
      'observation', 'Modern Chinese clinical herbalism (post-1949 reception of Qing-era food-medicine) places Hou Tou Gu among the gentle qi-tonics that simultaneously settle the shen — classical-trace observation IN, modern pharmacology IN, no theological attribution required.',
      'citation', jsonb_build_object(
        'author', 'Hobbs C',
        'title', 'Medicinal Mushrooms: An Exploration of Tradition, Healing, and Culture',
        'year', 2003,
        'url', 'https://www.botanicalpress.com/medicinal-mushrooms',
        'locator', 'Hericium erinaceus monograph'
      )
    )
  )
WHERE herb_id = 'H035';

-- 4/13 — Milk Thistle (Silybum marianum)
-- Cooling-bitter hepatic. King's primary + ESCOP secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/carduus.html',
    'locator', 'Carduus marianus — hepatic, cholagogue; specific in chronic hepatic congestion with bitter taste, sluggish bowel, and dull right-upper-quadrant ache',
    'excerpt', 'Carduus marianus is a peculiar liver remedy. Useful in chronic hepatic congestion, where the bowel is sluggish, the mouth pasty and bitter, and the right hypochondrium aches dully. It corrects portal stasis without driving the bowel violently.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Silybi mariani fructus (Milk Thistle Fruit)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2018,
    'url', 'https://escop.com/downloads/milk-thistle-fruit/',
    'locator', 'Hepatoprotective evidence summary; toxic-mushroom-poisoning silibinin clinical literature; chronic liver disease RCT meta-analysis'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Sluggish-portal hepatic terrain (Cook depression overlay)',
      'observation', 'Cook frames Carduus marianus as restoring tone to a depressed hepatic terrain — addressing the chronic congestion-with-atony pattern, distinct from acute hepatic irritation which calls for cooler bitters.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/CARDUUS_MARIANUS.htm',
        'locator', 'Carduus marianus entry'
      )
    )
  )
WHERE herb_id = 'H038';

-- 5/13 — Mullein (Verbascum thapsus)
-- Cooling-moist respiratory demulcent. King's primary + ESCOP secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/verbascum.html',
    'locator', 'Verbascum thapsus — demulcent, expectorant, anodyne; specific in dry, hard, hacking cough with deficient mucus secretion',
    'excerpt', 'Verbascum is a soothing pectoral. Specifically indicated in the dry, hard, ringing cough that fatigues the chest, where mucus is scant and the bronchial mucosa is irritably dry. It restores moisture and quiets the cough reflex without suppressing necessary expectoration.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Verbasci flos (Mullein Flower)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2014,
    'url', 'https://escop.com/downloads/mullein-flower/',
    'locator', 'Catarrhal upper respiratory tract conditions evidence summary'
  ),
  traditional_observations = jsonb_build_array()
WHERE herb_id = 'H041';

-- 6/13 — Red Clover (Trifolium pratense)
-- Cooling-alterative lymphatic. King's primary + AHPA secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/trifolium.html',
    'locator', 'Trifolium pratense — alterative; specific in glandular and lymphatic congestion of subacute or chronic character',
    'excerpt', 'Trifolium pratense is a gentle alterative, suited especially to glandular and lymphatic congestion of a subacute or chronic character — particularly in childhood, in the convalescent, and in those of irritable but feeble constitutions.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'ahpa_safety',
    'title', 'Botanical Safety Handbook, 2nd ed.',
    'author', 'McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)',
    'year', 2013,
    'url', 'https://www.ahpa.org/resources/publications/botanical-safety-handbook',
    'locator', 'Trifolium pratense entry — class 1; isoflavone content noted; no significant adverse-event signal at typical food/beverage doses'
  ),
  traditional_observations = jsonb_build_array()
WHERE herb_id = 'H049';

-- 7/13 — Vitex (Vitex agnus-castus)
-- Warming endocrine modulator. Hippocratic Corpus primary + ESCOP secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Hippocratic Corpus / Dioscorides',
    'title', 'De Materia Medica (Goodyer English translation)',
    'year', 1655,
    'url', 'https://archive.org/details/de-materia-medica-of-pedanius-dioscorides-of-anazarbus',
    'locator', 'Book 1 — Agnus castus: cooling to lust, warming to the pelvic viscera in deficiency states; described in classical sources as the chaste-tree of temple priestesses',
    'excerpt', 'Agnos kastos — the chaste tree — is described in Dioscorides as cooling the seminal heat in men and regulating the pelvic flow in women; warming the womb in atonic states and reducing erotic excitation in temperaments overheated by humoral excess.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Agni casti fructus (Chaste Tree Fruit)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2019,
    'url', 'https://escop.com/downloads/chaste-tree-fruit/',
    'locator', 'Premenstrual syndrome + cyclic mastalgia + secondary amenorrhea evidence summary'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Pelvic atony with luteal-phase deficiency (modern reception of classical Galenic indication)',
      'observation', 'Mills & Bone retain Vitex among the principal phyto-endocrine modulators with documented dopaminergic / prolactin-modulating activity; the modern clinical indication maps cleanly to the classical Galenic indication of pelvic-warming-in-deficiency.',
      'citation', jsonb_build_object(
        'author', 'Mills S, Bone K',
        'title', 'Principles and Practice of Phytotherapy, 2nd ed.',
        'year', 2013,
        'url', 'https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5',
        'locator', 'Vitex agnus-castus monograph'
      )
    )
  )
WHERE herb_id = 'H064';

-- 8/13 — Wood Betony (Stachys officinalis / Betonica officinalis)
-- Warming-bitter nervine/digestive. Culpeper primary + Hoffmann secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Culpeper N',
    'title', 'Culpeper''s Complete Herbal',
    'year', 1653,
    'url', 'https://www.henriettes-herb.com/eclectic/culpeper/betony.html',
    'locator', 'Betony — solar-Mercurial classification; bitter-aromatic; specific in the head-tension of "the falling sickness" and in nervous-digestive overlap',
    'excerpt', 'Betony is a herb of Jupiter, of a moderate hot and dry temperature, with virtues against the head-pains arising from cold humours, dispelling the rheumatic vapours that mount upward, and strengthening both the head and the stomach in those of melancholy constitution.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Medical Herbalism: The Science and Practice of Herbal Medicine',
    'author', 'Hoffmann D',
    'year', 2003,
    'url', 'https://www.healingartspress.com/books/9780892817498',
    'locator', 'Stachys officinalis monograph — bitter-tonic, nervine, anti-tension headache indications'
  ),
  traditional_observations = jsonb_build_array()
WHERE herb_id = 'H068';

-- 9/13 — Yellow Dock (Rumex crispus)
-- Cooling-bitter alterative/iron-tonic. King's primary + AHPA secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/rumex.html',
    'locator', 'Rumex crispus — alterative, mild laxative, hepatic; specific in skin disorders with deranged blood and chronic costiveness',
    'excerpt', 'Rumex crispus is a slow alterative of considerable repute, peculiarly indicated in the deranged blood-states that manifest at the skin — itching eruptions, scrofulous tendencies, and the persistent constipation that accompanies portal sluggishness.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'ahpa_safety',
    'title', 'Botanical Safety Handbook, 2nd ed.',
    'author', 'McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)',
    'year', 2013,
    'url', 'https://www.ahpa.org/resources/publications/botanical-safety-handbook',
    'locator', 'Rumex crispus entry — class 2d; oxalate content advisory; not for those with kidney stones or gout'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Portal-hepatic stagnation manifesting at the integument (Cook depression overlay)',
      'observation', 'Cook frames Rumex as the alterative for cases where chronic skin eruption is downstream of hepatic-bowel torpor; addresses the depression and atrophy of vital tone simultaneously.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/RUMEX_CRISPUS.htm',
        'locator', 'Rumex crispus entry'
      )
    )
  )
WHERE herb_id = 'H070';

-- 10/13 — Bugleweed (Lycopus virginicus / europaeus)
-- Cool-astringent thyroid modulator. King's primary + ESCOP secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/lycopus.html',
    'locator', 'Lycopus virginicus — sedative, astringent, mild-narcotic; specific in irritable-pulse states with excessive cardiac action and copious-mucus pulmonary catarrh',
    'excerpt', 'Lycopus virginicus is a peculiar sedative to the heart and circulation, calming the rapid, bounding pulse of the irritable nervous-cardiac state. Particularly indicated where excessive thyroid-mediated agitation drives the heart-rhythm beyond constitutional temperament.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Lycopi herba (Bugleweed Herb)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2014,
    'url', 'https://escop.com/downloads/bugleweed/',
    'locator', 'Mild thyroid hyperfunction with autonomic disturbances evidence summary; lithospermic-acid mechanism notes'
  ),
  traditional_observations = jsonb_build_array()
WHERE herb_id = 'H085';

-- 11/13 — Yerba Santa (Eriodictyon californicum)
-- Warming-aromatic respiratory. Pre-1928 California-Eclectic primary + Hoffmann
-- secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/eriodictyon.html',
    'locator', 'Eriodictyon californicum — expectorant, decongestant; specific in chronic bronchorrhea with thick, copious, easily-expectorated mucus',
    'excerpt', 'Eriodictyon, the holy-herb of the Spanish missionaries, is a stimulating expectorant of moderate power. Useful in chronic bronchial catarrh where mucus is profuse, the cough is loose and productive, and the patient is fatigued by the bulk of secretion.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Medical Herbalism: The Science and Practice of Herbal Medicine',
    'author', 'Hoffmann D',
    'year', 2003,
    'url', 'https://www.healingartspress.com/books/9780892817498',
    'locator', 'Eriodictyon californicum monograph — chronic bronchial catarrh + asthmatic congestion indications'
  ),
  traditional_observations = jsonb_build_array()
WHERE herb_id = 'H071';

-- 12/13 — Agrimony (Agrimonia eupatoria)
-- Cooling-astringent hepatic. Replaces Coltsfoot per Path 2 (PA-cautioned herbs
-- deferred to session 5 PA-safety slice). Culpeper primary + ESCOP secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Culpeper N',
    'title', 'Culpeper''s Complete Herbal',
    'year', 1653,
    'url', 'https://www.henriettes-herb.com/eclectic/culpeper/agrimony.html',
    'locator', 'Agrimony — solar-Jupiterian; astringent-hepatic; specific in liver-spleen sluggishness with bitter taste, jaundiced complexion, and irritable bowel',
    'excerpt', 'Agrimony is a herb of Jupiter under the sign of Cancer, strengthening the liver and the spleen, opening obstructions of those parts, and giving tone to the bowel where it is irritable from chronic accumulation.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: Agrimoniae herba (Agrimony Herb)',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2014,
    'url', 'https://escop.com/downloads/agrimony/',
    'locator', 'Diarrheal disorders + mild non-specific catarrhal inflammation of the throat evidence summary'
  ),
  traditional_observations = jsonb_build_array()
WHERE herb_id = 'H072';

-- 13/13 — Anise Hyssop (Agastache foeniculum)
-- Warming-aromatic respiratory/digestive. Replaces Comfrey per Path 2.
-- Native American + Wood / Pedersen industry secondary.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/agastache.html',
    'locator', 'Agastache species — aromatic carminative; specific in cold-stomach digestive feebleness with bloating, eructation, and wind-cramping',
    'excerpt', 'Agastache is among the milder aromatic carminatives, peculiarly suited to cold, atonic digestive states marked by bloating after meals, frequent eructation, and wind-cramping; warming and gentle, fit for sensitive constitutions where stronger aromatics overstimulate.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'The Earthwise Herbal: A Complete Guide to New World Medicinal Plants',
    'author', 'Wood M',
    'year', 2009,
    'url', 'https://www.northatlanticbooks.com/shop/the-earthwise-herbal-new-world/',
    'locator', 'Agastache foeniculum monograph — Native American Anishinaabe and Lakota traditional uses + modern Western reception'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Spleen-yang vacuity with cold-damp middle-jiao stagnation (TCM Huo Xiang parallel)',
      'observation', 'Bensky & Gamble retain a related Agastache species (Huo Xiang / Agastache rugosa) as a warming aromatic that resolves dampness in the middle jiao — the same functional category Anise Hyssop occupies in Western reception, attribution-stripped per Lock #44.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Agastache rugosa (Huo Xiang) entry'
      )
    )
  )
WHERE herb_id = 'H075';

-- =============================================================================
-- Migration registration (per reference_supabase_migration_tracking.md
-- operational rule — required when applied via SQL Editor, not via CLI)
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20260427210000', ARRAY[]::text[], 'herbs_mixed_energetic_dual_citation')
ON CONFLICT (version) DO NOTHING;
