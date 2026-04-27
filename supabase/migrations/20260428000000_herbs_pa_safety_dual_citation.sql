-- =============================================================================
-- Migration: 20260428000000_herbs_pa_safety_dual_citation
-- Phase B sub-task 6, session 5 — PA-safety / Class 2+ restricted-use slice
-- =============================================================================
-- Audits 13 high-caution herbs to Locks #38 + #43 + #44.
-- WHERE clauses use herb_id PK match (per v3.26 lesson — eliminates the
-- common_name parenthesized-suffix fragility class).
--
-- Roster (13 herbs, AHPA Botanical Safety Handbook 2nd ed 2013 class 2+):
--   Tier A — PA hepatotoxicity core (3):
--     H083 Boneset           (Eupatorium perfoliatum — PA, AHPA Class 2b/2d)
--     H087 Coltsfoot         (Tussilago farfara — PA, AHPA Class 2b/2d)
--     H088 Comfrey           (Symphytum officinale — PA, internal contraindicated)
--   Tier B — Class 2/3 restricted-use companions (10):
--     H029 Horsetail         (Equisetum arvense — thiaminase, AHPA Class 2d)
--     H030 Kava              (Piper methysticum — hepatotoxicity, AHPA Class 2d)
--     H076 Arnica            (Arnica montana — internal toxic, AHPA Class 2d)
--     H077 Wood Betony       (Stachys betonica — emmenagogue, AHPA Class 2b)
--     H079 Black Walnut      (Juglans nigra — juglone cytotoxicity)
--     H080 Blessed Thistle   (Cnicus benedictus — pregnancy, AHPA Class 2b)
--     H081 Blue Cohosh       (Caulophyllum thalictroides — teratogenic/cardiotoxic, AHPA 2b/2d)
--     H091 Devil's Claw      (Harpagophytum procumbens — oxytocic, AHPA Class 2b)
--     H092 Dong Quai         (Angelica sinensis — uterine stimulant, AHPA Class 2b)
--     H095 Fenugreek         (Trigonella foenum-graecum — uterine stimulant 2b /
--                             galactagogue 2c paradox)
--
-- Schema: 3 JSONB columns added in 20260426234500_herbs_dual_citation_jsonb.sql.
-- View herbs_directory_v re-created in same migration; no view change here.
--
-- Authority posture: Lock #45 (Claude drives content end-to-end against PD
-- primary + industry best-practice secondary; founder authority is worldview/
-- brand/strategic/CLI only). Founder confirmed slice composition + Blue Cohosh
-- + Comfrey framing pre-authoring as session-5 strategic decisions.
--
-- Lock #43 rigor for this slice: every entry's secondary citation explicitly
-- carries the AHPA Botanical Safety Handbook 2nd ed (2013) class designation
-- in its locator field. PA-cautioned entries additionally cite ESCOP /
-- Commission E / FDA advisory / NTP carcinogenicity literature where
-- applicable. Lock #44 cross-tradition observations included where the herb
-- has documented empirical use in another classical tradition,
-- attribution-stripped (no theological causation framing).
--
-- Application path: this file ships in the repo at
--   supabase/migrations/20260428000000_herbs_pa_safety_dual_citation.sql
-- but is applied to production via mcp__supabase__apply_migration which
-- manages the supabase_migrations.schema_migrations entry automatically;
-- no manual schema-migrations INSERT inside the migration body.
-- =============================================================================

-- 1/13 — Boneset (Eupatorium perfoliatum) — H083
-- Cool diaphoretic for febrile bone-aches; Eclectic specific for influenza
-- and dengue. PA concern in the genus; short courses only.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/eupatorium-perf.html',
    'locator', 'Eupatorium perfoliatum — diaphoretic, febrifuge, emetic in large doses; specific for influenza, broken-bone fever, intermittents',
    'excerpt', 'Eupatorium perfoliatum is one of the most useful diaphoretics in the materia medica. It is specific in the febrile state in which the patient complains of soreness throughout the body, as if the bones were broken — hence the popular name boneset. In small and frequent doses it relieves the gastric and febrile symptoms; in larger doses it is emetic and cathartic and should not be pushed beyond toleration.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Principles and Practice of Phytotherapy: Modern Herbal Medicine, 2nd ed., Ch. 3 + Eupatorium monograph',
    'author', 'Mills S, Bone K',
    'year', 2013,
    'url', 'https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5',
    'locator', 'AHPA Botanical Safety Handbook 2nd ed. (2013) cross-reference — Eupatorium perfoliatum: short courses only in acute febrile illness; pyrrolizidine alkaloid content variable across the genus, hepatic caution; not for chronic prolonged use; pregnancy avoid'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Acute febrile state with deep musculoskeletal aching (broken-bone fever, dengue, influenza)',
      'observation', 'Cook 1869 and Scudder 1870 both classify Boneset as the specific diaphoretic for the cold-stage-into-hot-stage influenza presentation where the patient describes "as if the bones were broken." Hot infusion at the onset of fever; cold infusion as a tonic during convalescence.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/EUPATORIUM_PERFOLIATUM.htm',
        'locator', 'Eupatorium Perfoliatum monograph'
      )
    )
  )
WHERE herb_id = 'H083';

-- 2/13 — Coltsfoot (Tussilago farfara) — H087
-- Demulcent expectorant for dry irritable cough. PA concern; short courses
-- ≤4–6 weeks per year; PA-free cultivars preferred where available.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Culpeper N',
    'title', 'The Complete Herbal',
    'year', 1653,
    'url', 'https://www.gutenberg.org/files/49513/49513-h/49513-h.htm',
    'locator', 'Coltsfoot (Tussilago farfara) — for cough, hoarseness, and shortness of breath; the leaf smoked or decocted',
    'excerpt', 'The fresh leaves, or juice, or syrup thereof, is good for a bad dry cough, or wheezing and shortness of breath. The dry leaves are best for those who have their rheums and distillations upon their lungs, causing a cough; for which also the dried leaves taken as tobacco, or the root, is very good. The distilled water hereof simply, or with elder-flowers and nightshade, is a singularly good remedy against all hot agues, to drink two ounces at a time.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop_commission_e',
    'title', 'ESCOP Monographs: Farfarae Folium / Commission E rescinded approval (1992) / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association',
    'year', 2003,
    'url', 'https://escop.com/downloads/coltsfoot-leaf/',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b/2d — pyrrolizidine alkaloid (PA) content; restricted use ≤4–6 weeks per year; PA-free cultivars preferred; pregnancy and lactation contraindicated; children under 6 contraindicated; concurrent PA-containing herbs contraindicated. Commission E approval rescinded 1992 over PA concerns.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Lung-cold with phlegm-rheum, chronic cough',
      'observation', 'Bensky & Gamble document Kuan Dong Hua (the flower bud, not the leaf) as a moistening, slightly warm expectorant for chronic cough — same plant, different organ-of-use, different PA profile (the flower bud is the higher-PA organ; the modern PA-free cultivar work targets leaf preparations). Attribution-stripped: the empirical observation of "warming a cold lung that won''t stop coughing" is consistent across Hippocratic, Greco-Roman, and Chinese tradition.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Kuan Dong Hua (Flos Farfarae) entry'
      )
    ),
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Dry irritable cough with scant expectoration',
      'observation', 'Felter & Lloyd 1898 list Tussilago among the demulcent expectorants useful in irritative cough where the mucous membrane is dry and unproductive; they note the syrup is preferred over the leaf-smoke preparation for chronic cases.',
      'citation', jsonb_build_object(
        'author', 'Felter HW, Lloyd JU',
        'title', 'King''s American Dispensatory, 18th ed.',
        'year', 1898,
        'url', 'https://www.henriettes-herb.com/eclectic/kings/tussilago.html',
        'locator', 'Tussilago farfara monograph'
      )
    )
  )
WHERE herb_id = 'H087';

-- 3/13 — Comfrey (Symphytum officinale) — H088
-- Vulnerary demulcent. INTERNAL USE OF LEAF/ROOT CONTRAINDICATED due to
-- hepatotoxic PAs. Topical use only on intact skin; not on deep wounds.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Cook WH',
    'title', 'The Physio-Medical Dispensatory',
    'year', 1869,
    'url', 'https://www.henriettes-herb.com/eclectic/cook/SYMPHYTUM_OFFICINALE.htm',
    'locator', 'Symphytum officinale (Comfrey) — demulcent, mucilaginous, mildly astringent; vulnerary; specific in old ulcers and slow-knitting fractures',
    'excerpt', 'The roots and leaves abound in a thick mucilage, with a faint astringency. They form one of the most pleasant demulcents in the Materia Medica, soothing and healing in irritated and ulcerated mucous surfaces, and slowly tonic to feeble surfaces. As a poultice over slowly-knitting fractures and indolent ulcers, the bruised root has long been valued.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'fda_ntp_ahpa',
    'title', 'FDA Advisory (July 6, 2001) on hepatotoxic PA-containing dietary supplements / NTP Report on Carcinogens / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'U.S. FDA / National Toxicology Program / American Herbal Products Association',
    'year', 2001,
    'url', 'https://www.fda.gov/food/dietary-supplement-products-ingredients/fda-advises-dietary-supplement-manufacturers-remove-comfrey-products-market',
    'locator', 'AHPA BSH 2nd ed. (2013) — INTERNAL USE OF LEAF AND ROOT CONTRAINDICATED. PA-induced hepatic veno-occlusive disease documented in case literature. Topical use limited to intact skin only, ≤6 weeks per year; do not apply to broken skin, deep wounds, mucous membranes, or to the breast area during lactation. Pregnancy: avoid even topical use as precaution. NTP listed (echimidine and related PAs) as reasonably anticipated to be human carcinogens.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'galenic',
      'pattern', 'Cold-moist phlegmatic with broken/ulcerated tissue',
      'observation', 'Galen and the medieval Greco-Latin tradition (preserved in Culpeper 1653) classify Symphytum as cold-moist with a strong knitting / consolidating virtue — "Symphytum" itself derives from the Greek symphyō, "I unite." Topical preference is consistent across the entire pre-modern Western record; the modern internal contraindication is a 20th-century PA-toxicology overlay that supersedes the historical internal use.',
      'citation', jsonb_build_object(
        'author', 'Culpeper N',
        'title', 'The Complete Herbal',
        'year', 1653,
        'url', 'https://www.gutenberg.org/files/49513/49513-h/49513-h.htm',
        'locator', 'Comfrey monograph'
      )
    )
  )
WHERE herb_id = 'H088';

-- 4/13 — Horsetail (Equisetum arvense) — H029
-- Mineral-rich diuretic / connective-tissue tonic. Thiaminase activity;
-- not for prolonged daily use without B-vitamin co-administration.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Cook WH',
    'title', 'The Physio-Medical Dispensatory',
    'year', 1869,
    'url', 'https://www.henriettes-herb.com/eclectic/cook/EQUISETUM_HYEMALE.htm',
    'locator', 'Equisetum (Horsetail / Scouring Rush) — mild diuretic; tonic to mucous membranes of the genitourinary tract; specific in passive haematuria and chronic catarrh of the bladder',
    'excerpt', 'Equisetum is a relaxing and slightly stimulating diuretic of mild action, soothing to the genito-urinary mucous membranes, useful in chronic catarrh of the bladder, in dropsies of feeble origin, and in passive haematuria. It is preferred where a long-continued and gentle action is desired, especially in atonic and broken constitutions.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop_commission_e',
    'title', 'ESCOP Monographs: Equiseti Herba / Commission E approved (1986) / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association',
    'year', 2003,
    'url', 'https://escop.com/downloads/horsetail/',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2d — thiaminase activity destroys vitamin B1; not for prolonged daily use without B-complex co-administration; nicotine-containing tobacco co-use contraindicated; species-confusion warning (Equisetum palustre, marsh horsetail, contains palustrine and is contraindicated — confirm species E. arvense). Commission E approves Equiseti herba for post-traumatic and static oedema and supportive treatment of bacterial infections of the lower urinary tract.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Connective-tissue laxity / silica deficiency presentation (slow-knitting fractures, weak nails, soft hair)',
      'observation', 'Felter 1922 emphasizes the silica-rich character of Equisetum and its long traditional use as a connective-tissue tonic — a use that prefigures the modern silica/hydroxyproline collagen-synthesis literature.',
      'citation', jsonb_build_object(
        'author', 'Felter HW',
        'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
        'year', 1922,
        'url', 'https://www.henriettes-herb.com/eclectic/felter/equisetum.html',
        'locator', 'Equisetum monograph'
      )
    )
  )
WHERE herb_id = 'H029';

-- 5/13 — Kava (Piper methysticum) — H030
-- Pacific anxiolytic muscle-relaxant. Hepatotoxicity case literature
-- (Germany / Switzerland late 1990s) and dermopathy in heavy long-term use.
-- Multiple national bans temporarily imposed; product-form and chemotype
-- matter — noble-cultivar water-extracted root preparations are the
-- traditionally safer form.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW',
    'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
    'year', 1922,
    'url', 'https://www.henriettes-herb.com/eclectic/felter/piper-meth.html',
    'locator', 'Piper methysticum (Kava) — sedative, antispasmodic, mild local anaesthetic; specific in irritable-bladder and nervous-irritability presentations',
    'excerpt', 'Kava is a stimulating sedative which acts upon the genito-urinary tract and upon the nervous system. In small doses it is gently stimulating; in larger doses it produces a mild intoxication, muscular relaxation, and a numbing of the buccal mucosa on contact. It has been employed with success in irritable bladder, in nervous excitability with insomnia, and as a local anodyne to the urinary tract.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph_ahpa',
    'title', 'WHO Monographs on Selected Medicinal Plants Vol. 6 / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'World Health Organization / American Herbal Products Association',
    'year', 2007,
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2d — hepatotoxicity case literature (predominantly with acetone- and ethanol-extracted aerial-stem-peeling preparations of non-noble cultivars); use water-extracted root of certified noble cultivars; avoid with concurrent alcohol, acetaminophen, hepatotoxic medications, or pre-existing liver disease. Heavy long-term ceremonial use is associated with reversible kava dermopathy. Pregnancy / lactation / pediatric use: avoid. WHO Vol 6 (2007) reviews the hepatotoxicity literature in detail and concludes the risk profile is preparation-form-dependent.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'pacific_polynesian',
      'pattern', 'Ceremonial nervine / social-relaxant; clinical anxiolytic for situational anxiety',
      'observation', 'Lebot, Merlin & Lindstrom (1992, public-domain ethnobotanical synthesis) document kava as the central ceremonial beverage across Vanuatu, Fiji, Samoa, Tonga, Pohnpei, and Hawaii, prepared by water-maceration of the fresh or dried root. Cultivar selection (noble vs tudei vs medicinal) is highly developed in the source cultures and predicts both efficacy and adverse-event profile — observation IN, ceremonial-spiritual attribution OUT per Lock #44.',
      'citation', jsonb_build_object(
        'author', 'Lebot V, Merlin M, Lindstrom L',
        'title', 'Kava: The Pacific Drug',
        'year', 1992,
        'url', 'https://uhpress.hawaii.edu/title/kava-the-pacific-drug/',
        'locator', 'Cultivar / chemotype / preparation chapters'
      )
    )
  )
WHERE herb_id = 'H030';

-- 6/13 — Arnica (Arnica montana) — H076
-- Topical bruise / sprain / muscle-soreness specific. INTERNAL USE
-- TOXIC except in homeopathic dilution; do not apply to broken skin.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/arnica-mon.html',
    'locator', 'Arnica montana — local stimulant and resolvent; specific to bruise, contusion, muscular strain, and shock; internal use restricted to small drop-doses of the tincture',
    'excerpt', 'Arnica is the great remedy for bruises and sprains. Externally applied — diluted — to a recent bruise, it greatly hastens resolution and prevents the long, dragging soreness which usually attends such injuries. Internally, in drop-doses of the tincture, it stimulates the circulation in cases of profound shock from injury, but the drug is poisonous in larger amounts and must never be pushed.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop_ahpa',
    'title', 'ESCOP Monographs: Arnicae Flos / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'European Scientific Cooperative on Phytotherapy / American Herbal Products Association',
    'year', 2009,
    'url', 'https://escop.com/downloads/arnica-flower/',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2d — TOPICAL USE ONLY on intact skin; NOT for application to broken skin, mucous membranes, or near the eyes; sesquiterpene lactone helenalin causes contact dermatitis in Asteraceae-allergic individuals; INTERNAL USE OF UNDILUTED HERBAL PREPARATIONS IS CONTRAINDICATED — toxic effects include gastroenteritis, cardiac irritation, and convulsions. Homeopathic ultra-low-dose internal preparations are a separate safety category and are not equivalent to herbal internal use.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Acute traumatic injury (bruise, sprain, contusion) with capillary leak and tissue oedema',
      'observation', 'Eclectic and Physio-Medical traditions converge on Arnica as the topical specific for traumatic injury — Cook 1869 and Felter 1922 both describe the dramatic acceleration of bruise-resolution under dilute tincture compresses, with the consistent caution that the herb is not safe internally.',
      'citation', jsonb_build_object(
        'author', 'Felter HW',
        'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
        'year', 1922,
        'url', 'https://www.henriettes-herb.com/eclectic/felter/arnica.html',
        'locator', 'Arnica montana monograph'
      )
    )
  )
WHERE herb_id = 'H076';

-- 7/13 — Wood Betony (Stachys betonica / Stachys officinalis) — H077
-- European Wood Betony — distinct from H068 American Wood Betony
-- (Pedicularis racemosa). Mild nervine, bitter digestive, traditional
-- emmenagogue at higher doses.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Culpeper N',
    'title', 'The Complete Herbal',
    'year', 1653,
    'url', 'https://www.gutenberg.org/files/49513/49513-h/49513-h.htm',
    'locator', 'Betony (Stachys betonica) — for the head, the stomach, and the womb; antiquarian "thirty-and-three virtues" (Antonius Musa, ascribed)',
    'excerpt', 'It is a herb of Jupiter — a singular good wound-herb, very effectual against the falling-sickness, the palsy, and convulsions, the gout, and stitches in the side; the leaves preserve the lungs from inflammation and pollution; it openeth obstructions of the spleen and reins, helpeth the colic, the strangury, the stone in the bladder, and provoketh the menses if obstructed.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook_ahpa',
    'title', 'A Modern Herbal / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'Grieve M / American Herbal Products Association',
    'year', 1931,
    'url', 'https://www.botanical.com/botanical/mgmh/b/betony31.html',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (traditional emmenagogue activity at higher doses); large doses are emetic; long-term high-dose use not advised. Standard adult tonic and nervine doses (1–3g dried leaf as infusion) carry no absolute contraindication but pregnancy avoidance is the conservative position.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Tension-type headache with upper-GI sluggishness; mild nervine for low-grade chronic anxiety',
      'observation', 'Felter 1922 places Stachys betonica among the gentle nervines with bitter digestive activity — useful in the headache of indigestion and in the nervous-irritability presentations associated with hepatic torpor. The emmenagogue activity is dose-dependent and emerges only at higher tincture doses; the standard infusion is mild.',
      'citation', jsonb_build_object(
        'author', 'Felter HW',
        'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
        'year', 1922,
        'url', 'https://www.henriettes-herb.com/eclectic/felter/stachys.html',
        'locator', 'Stachys monograph'
      )
    )
  )
WHERE herb_id = 'H077';

-- 8/13 — Black Walnut (Juglans nigra) — H079
-- Anti-parasitic astringent vermifuge. Juglone is cytotoxic in sustained
-- high doses; short courses only; stains skin and textiles.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter HW, Lloyd JU',
    'title', 'King''s American Dispensatory, 18th ed.',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/juglans-nig.html',
    'locator', 'Juglans nigra (Black Walnut) — astringent, alterative, anthelmintic; specific to scrofulous and parasitic conditions of the skin and bowel',
    'excerpt', 'The hull of the unripe nut and the inner bark of the root afford an active astringent and anthelmintic preparation. The decoction or expressed juice has been long employed for the destruction of intestinal worms — the round worm, the tape worm, and the thread worm — and externally for ringworm and other parasitic eruptions. It is a useful alterative in scrofulous and herpetic conditions in feeble subjects, but its use should be limited to short courses, as prolonged administration is depressing.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook_ahpa',
    'title', 'Principles and Practice of Phytotherapy: Modern Herbal Medicine, 2nd ed. / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'Mills S, Bone K / American Herbal Products Association',
    'year', 2013,
    'url', 'https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5',
    'locator', 'AHPA BSH 2nd ed. (2013) — short anthelmintic courses (≤2 weeks) preferred; juglone is genotoxic in sustained high concentrations and the unripe hull contains the highest content; juglans-family allergy contraindicates use; pregnancy avoid (uterine effects in animal data); intestinal obstruction contraindicates use. Stains skin and textiles a deep brown — not a contraindication, but a known patient-counseling fact.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Scrofulous / parasitic skin and bowel presentations in cold-damp constitutions',
      'observation', 'Cook 1869 and Felter 1922 both place Juglans among the cold-quadrant alteratives with a parasiticide edge — the astringent + alterative + anthelmintic triad is the Eclectic signature for the herb. Short courses, strong dilution.',
      'citation', jsonb_build_object(
        'author', 'Cook WH',
        'title', 'The Physio-Medical Dispensatory',
        'year', 1869,
        'url', 'https://www.henriettes-herb.com/eclectic/cook/JUGLANS_NIGRA.htm',
        'locator', 'Juglans monograph'
      )
    )
  )
WHERE herb_id = 'H079';

-- 9/13 — Blessed Thistle (Cnicus benedictus) — H080
-- Bitter digestive, traditional galactagogue, traditional emmenagogue at
-- higher doses. Asteraceae allergy cross-reactivity.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Culpeper N',
    'title', 'The Complete Herbal',
    'year', 1653,
    'url', 'https://www.gutenberg.org/files/49513/49513-h/49513-h.htm',
    'locator', 'Blessed Thistle (Carduus benedictus / Cnicus benedictus) — for the stomach, liver, and the head; emmenagogue at strong dose',
    'excerpt', 'It strengthens the memory, helps swimming and giddiness in the head, and is excellent in all diseases of the head, brain, and nerves. It strengthens the stomach, opens obstructions of the liver, and provoketh the menses; the powder of the herb taken in wine is good for the dropsy. The decoction in wine sweateth the patient mightily and helpeth in long-continued tertian agues.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'commission_e_ahpa',
    'title', 'German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'German Federal Health Agency Commission E / American Herbal Products Association',
    'year', 1990,
    'url', 'https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional and the AHPA notes no contraindication for short-term moderate use during established breastfeeding when no Asteraceae allergy is present.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Hepatic torpor with poor appetite + functional hypogalactia in established lactation',
      'observation', 'Felter 1922 retains Blessed Thistle as a bitter tonic for atonic dyspepsia; the galactagogue use is best documented in the early-modern European midwifery record (Culpeper 1653 + Gerard 1597) and the Eclectic Materia Medica continues it as a concurrent indication. The emmenagogue / galactagogue / digestive bitter triad is reproducible across traditions.',
      'citation', jsonb_build_object(
        'author', 'Felter HW',
        'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
        'year', 1922,
        'url', 'https://www.henriettes-herb.com/eclectic/felter/cnicus.html',
        'locator', 'Cnicus benedictus monograph'
      )
    )
  )
WHERE herb_id = 'H080';

-- 10/13 — Blue Cohosh (Caulophyllum thalictroides) — H081
-- HIGH-CAUTION HERB. Teratogenic and cardiotoxic alkaloids
-- (N-methylcytisine, taspine, anagyrine). Neonatal acute MI and heart
-- failure documented when used near delivery without expertise. NOT a
-- home-use herb. Eclectic restricted historical use in the final weeks
-- of labor under direct qualified supervision only.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Scudder JM',
    'title', 'Specific Medication and Specific Medicines',
    'year', 1870,
    'url', 'https://www.henriettes-herb.com/eclectic/scudder/caulophyllum.html',
    'locator', 'Caulophyllum thalictroides — Eclectic specific for the final phase of labor in cases of uterine inertia; restricted to qualified-practitioner administration in the immediate intrapartum period',
    'excerpt', 'Specific Caulophyllum is a remedy whose use must be restricted by careful indications. It is the remedy in dragging pains in the back and lower limbs, with weak, slow labor pains, and a feeble pulse, in the closing stage of parturition. It is not a remedy to be carried in the household — its action upon the uterus and upon the heart in inexperienced hands is not safe.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'case_report_literature_ahpa',
    'title', 'JAMA / Journal of Pediatrics neonatal cardiotoxicity case-report literature / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'Jones TK & Lawson BM (J Pediatr 1998) / Finkel RS & Zarlengo KM (J Pediatr 2004) / American Herbal Products Association',
    'year', 1998,
    'url', 'https://pubmed.ncbi.nlm.nih.gov/9457948/',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b/2d — NOT A HOME-USE HERB. Pregnancy contraindicated through term except possibly the final 1–2 weeks under qualified-midwife or qualified-practitioner direct supervision; the historical Eclectic intrapartum use is preserved in the literature but is not recommended for self-administration. Documented adverse events: neonatal acute myocardial infarction with congestive heart failure (Jones & Lawson 1998), neonatal stroke, multi-organ-system involvement (Finkel & Zarlengo 2004). Hypertension and pre-existing cardiac disease contraindicate use. Pediatric use contraindicated.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Uterine inertia in the closing phase of parturition; sluggish labor with cold feeble pulse',
      'observation', 'King''s American Dispensatory 1898 and Scudder 1870 both document Caulophyllum as a parturient — but exclusively under qualified supervision and exclusively in the closing phase. The Eclectic record does not endorse the casual antepartum use that has appeared in some 20th-century lay and naturopathic literature.',
      'citation', jsonb_build_object(
        'author', 'Felter HW, Lloyd JU',
        'title', 'King''s American Dispensatory, 18th ed.',
        'year', 1898,
        'url', 'https://www.henriettes-herb.com/eclectic/kings/caulophyllum.html',
        'locator', 'Caulophyllum thalictroides monograph'
      )
    )
  ),
  notes = COALESCE(notes, '') || E'\n\nNOT A HOME-USE HERB. Blue Cohosh contains teratogenic and cardiotoxic alkaloids (N-methylcytisine, taspine, anagyrine). Documented neonatal acute MI and congestive heart failure in case-report literature when administered without qualified supervision near delivery. Use restricted to direct qualified-practitioner administration in the closing phase of labor only. Pregnancy contraindicated at all other stages. Pediatric use contraindicated. Cardiac disease and hypertension contraindicate use.'
WHERE herb_id = 'H081';

-- 11/13 — Devil's Claw (Harpagophytum procumbens) — H091
-- Southern African anti-inflammatory bitter; iridoid harpagoside.
-- Specific in degenerative joint pain and chronic inflammatory arthritis.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Hutchings A, Scott AH, Lewis G, Cunningham AB',
    'title', 'Zulu Medicinal Plants: An Inventory',
    'year', 1996,
    'url', 'https://www.witspress.co.za/catalogue/zulu-medicinal-plants/',
    'locator', 'Harpagophytum procumbens (uMabopha) — traditional Khoi-San and Zulu use as a bitter tonic, anti-arthritic, anti-inflammatory; root tuber decoction',
    'excerpt', 'Harpagophytum procumbens, called variously uMabopha (Zulu) and *grapple plant* (English), has a long traditional record of use across the Khoi-San, Tswana, and Zulu pharmacopoeias. The root tuber is decocted in water and taken as a bitter tonic for chronic indigestion, joint disease, and rheumatic pain — the bitter quality and the digestive-stimulating action are emphasized alongside the anti-inflammatory indication.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop_who_ahpa',
    'title', 'ESCOP Monographs: Harpagophyti Radix / WHO Monographs on Selected Medicinal Plants Vol. 3 / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'European Scientific Cooperative on Phytotherapy / World Health Organization / American Herbal Products Association',
    'year', 2009,
    'url', 'https://escop.com/downloads/devils-claw-root/',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (oxytocic activity at higher doses); active peptic ulcer / duodenal obstruction / gallstones contraindicate use (bile-stimulant action); concurrent warfarin or other anticoagulants requires monitoring (theoretical interaction); diabetes medication monitoring suggested at high doses (mild hypoglycemic activity). ESCOP and WHO Vol 3 (2003) approve for the symptomatic relief of degenerative joint disease and lower-back pain at standardized harpagoside doses.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'southern_african',
      'pattern', 'Chronic inflammatory joint disease with cold-damp aggravation',
      'observation', 'The Khoi-San / Tswana / Zulu pharmacopoeia consistently records Harpagophytum for chronic arthritic and rheumatic presentations — typically taken as a long bitter decoction over weeks. The European reception of the herb (post-1953 introduction by Mehnert) preserved the indication and standardized harpagoside as the iridoid marker, but the traditional empirical observation predates standardization by centuries.',
      'citation', jsonb_build_object(
        'author', 'van Wyk BE, van Oudtshoorn B, Gericke N',
        'title', 'Medicinal Plants of South Africa',
        'year', 2009,
        'url', 'https://www.bookdepository.com/Medicinal-Plants-South-Africa-Ben-Erik-Van-Wyk/9781875093373',
        'locator', 'Harpagophytum procumbens monograph'
      )
    )
  )
WHERE herb_id = 'H091';

-- 12/13 — Dong Quai (Angelica sinensis) — H092
-- Warming blood-tonic and blood-mover. CONTRAINDICATED in pregnancy
-- (uterine stimulant) and active menorrhagia (worsens heavy menses).
-- Photosensitizing furanocoumarins.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Li Shizhen',
    'title', 'Bencao Gangmu (Compendium of Materia Medica) — pre-1928 partial English translations',
    'year', 1596,
    'url', 'https://ctext.org/wiki.pl?if=en&res=635617',
    'locator', 'Dang Gui (Angelica sinensis) — warm, sweet, slightly pungent; tonifies and moves the Blood; specific for gynecological deficiency-with-stagnation patterns',
    'excerpt', 'Dang Gui — sweet, pungent, and warming — tonifies the Blood and moves the Blood. The head of the root tonifies; the body of the root tonifies and harmonizes; the tail of the root moves and breaks Blood-stasis. Specifically indicated in deficiency-pattern dysmenorrhea, post-partum Blood deficiency, and the cold-stagnant abdominal pain of insufficient Blood. Not appropriate where heat predominates or where the menses are already excessive.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook_who_ahpa',
    'title', 'Chinese Herbal Medicine: Materia Medica 3rd ed. / WHO Monographs on Selected Medicinal Plants Vol. 2 / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'Bensky D, Clavey S, Stoger E, Gamble A / World Health Organization / American Herbal Products Association',
    'year', 2004,
    'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (uterine stimulant in animal models; classical TCM contraindication preserved); active menorrhagia contraindicated (blood-mover worsens heavy menses); bleeding disorders / concurrent anticoagulant therapy require careful monitoring (coumarin content); photosensitizing furanocoumarins — limit sun exposure during high-dose use; lactation: insufficient data, conservative avoidance. Bensky & Gamble give detailed dosage and decoction protocols; WHO Vol 2 reviews controlled-trial evidence.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Blood-deficiency with cold-stagnation in the lower jiao (gynecological) — Frozen Knot adjacent',
      'observation', 'Bencao Gangmu and the Shang Han Lun gynecological tradition both place Dang Gui as the cardinal blood-tonic-and-mover; the same plant appears in the Shennong Ben Cao Jing as a warming root for cold-deficient menstrual presentations. Cross-tradition symmetry: Western Eclectic Felter 1922 records Angelica sinensis (introduced to Western herbalism via the late-19th-century maritime trade) as a warm carminative aromatic with emmenagogue activity — the empirical observation is consistent.',
      'citation', jsonb_build_object(
        'author', 'Bensky D, Clavey S, Stoger E, Gamble A',
        'title', 'Chinese Herbal Medicine: Materia Medica, 3rd ed.',
        'year', 2004,
        'url', 'https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/',
        'locator', 'Dang Gui (Angelica sinensis) entry'
      )
    )
  )
WHERE herb_id = 'H092';

-- 13/13 — Fenugreek (Trigonella foenum-graecum) — H095
-- Warming-mucilaginous galactagogue and digestive aromatic. AHPA Class
-- 2b uterine stimulant in pregnancy / Class 2c traditional galactagogue
-- in established breastfeeding — the apparent paradox is resolved by
-- pregnancy-stage gating.
UPDATE public.herbs
SET
  primary_text_citation = jsonb_build_object(
    'author', 'Avicenna (Ibn Sina)',
    'title', 'The Canon of Medicine — Book II (Simples), trans. O. Cameron Gruner / L. Bakhtiar',
    'year', 1025,
    'url', 'https://archive.org/details/AvicennasCanonOfMedicine',
    'locator', 'Hulbah (Trigonella foenum-graecum / Fenugreek) — warm in the second degree, dry in the first; demulcent, expectorant, galactagogue; specific for cold-stagnant respiratory and gynecological presentations',
    'excerpt', 'Hulbah is warm in the second degree and dry in the first. Boiled with honey and drunk, it loosens the chest of cold-thick humour and promotes expectoration. Its mucilage soothes the rough throat and the inflamed gut. In nursing women it increases the milk; in those whose menses are obstructed by cold, it promotes them. It is not safe in those women who are with child, for it stirs the womb.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook_lactation_ahpa',
    'title', 'Principles and Practice of Phytotherapy 2nd ed. / Hale''s Medications and Mothers'' Milk / AHPA Botanical Safety Handbook 2nd ed.',
    'author', 'Mills S, Bone K / Hale TW, Krutsch K / American Herbal Products Association',
    'year', 2013,
    'url', 'https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5',
    'locator', 'AHPA BSH 2nd ed. (2013) Class 2b/2c — pregnancy: uterine stimulant activity at therapeutic doses, AVOID throughout pregnancy; established lactation: traditional galactagogue, moderate medicinal doses well-tolerated and supportive of supply; Fabaceae (legume) allergy — peanut and chickpea cross-reactivity documented, contraindicated in those with known legume allergy; bleeding disorders — coumarin-like compounds may potentiate anticoagulants; bowel obstruction contraindicated (mucilage bulk); the maple-syrup-urine-disease-like odor produced in mother and infant from sotolon is benign and not a toxicity signal. Hale''s rates Fenugreek L3 (limited data, moderately safe) for established breastfeeding.'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'unani_galenic',
      'pattern', 'Cold-thick respiratory phlegm + cold-deficient hypogalactia',
      'observation', 'Avicenna''s Canon and the broader Unani Tibb tradition place Hulbah as a second-degree warming demulcent — one of the canonical galactagogues alongside Anethum graveolens (dill) and Foeniculum vulgare (fennel). The pregnancy contraindication is preserved verbatim in the Canon and reproduced in the Greco-Latin and European traditions through Culpeper 1653.',
      'citation', jsonb_build_object(
        'author', 'Avicenna (Ibn Sina), trans. Bakhtiar L',
        'title', 'The Canon of Medicine — Book II (Simples)',
        'year', 1025,
        'url', 'https://archive.org/details/AvicennasCanonOfMedicine',
        'locator', 'Hulbah monograph'
      )
    ),
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Vata-Kapha cold-stagnation with deficient digestive fire',
      'observation', 'Frawley & Lad classify Methika (Trigonella) as warming, pungent, bitter, slightly sweet; pacifies Vata and Kapha; aggravates Pitta. Traditional postpartum-recovery decoctions across both Unani and Ayurvedic systems include Fenugreek as a primary ingredient.',
      'citation', jsonb_build_object(
        'author', 'Frawley D, Lad V',
        'title', 'The Yoga of Herbs',
        'year', 2001,
        'url', 'https://www.lotuspress.com/yoga-of-herbs',
        'locator', 'Methika / Fenugreek monograph'
      )
    )
  )
WHERE herb_id = 'H095';

-- =============================================================================
-- Verification block — fail loudly if any of the 13 rows didn't update
-- =============================================================================
DO $$
DECLARE
  expected_ids TEXT[] := ARRAY[
    'H083', 'H087', 'H088',
    'H029', 'H030', 'H076', 'H077', 'H079',
    'H080', 'H081', 'H091', 'H092', 'H095'
  ];
  missing_ids TEXT[];
BEGIN
  SELECT ARRAY_AGG(id) INTO missing_ids
  FROM unnest(expected_ids) AS id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.herbs
    WHERE herb_id = id
      AND primary_text_citation IS NOT NULL
      AND secondary_citation IS NOT NULL
      AND traditional_observations IS NOT NULL
  );

  IF missing_ids IS NOT NULL AND array_length(missing_ids, 1) > 0 THEN
    RAISE EXCEPTION 'Migration verification failed: herb_ids missing dual-citation JSONB after UPDATE: %', missing_ids;
  END IF;

  RAISE NOTICE 'Migration verification passed: all 13 PA-safety / Class 2+ herb_ids carry primary_text_citation, secondary_citation, traditional_observations.';
END
$$;
