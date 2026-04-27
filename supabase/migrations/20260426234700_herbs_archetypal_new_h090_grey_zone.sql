-- =============================================================================
-- Phase B sub-task 6 — 8 new archetypal monographs + H090 repair + Gotu Kola
-- =============================================================================
-- Closes the archetypal-subset audit alongside the schema migration
-- (20260426234500) and the 29-row archetypal backfill (20260426234600).
--
-- Three groups of mutations:
--
--   1. INSERT 8 new herb rows for the archetypals that were referenced in
--      src/lib/constitution-data.ts but absent from public.herbs:
--        H101 White Oak Bark      (Quercus alba)
--        H102 Hibiscus            (Hibiscus sabdariffa)
--        H103 Shatavari           (Asparagus racemosus)
--        H104 Rehmannia           (Rehmannia glutinosa)
--        H105 Prickly Ash         (Zanthoxylum americanum)
--        H106 Juniper Berry       (Juniperus communis)
--        H107 Black Pepper        (Piper nigrum)
--        H108 Bayberry            (Myrica cerifera)
--
--   2. UPDATE H090 Cramp Bark — repair the row whose Latin name is
--      Viburnum opulus but whose body fields hold Dong Quai content.
--      Overwrite with a real Cramp Bark monograph; Dong Quai content stays
--      at H092 (its correct row).
--
--   3. UPDATE Gotu Kola — Lock #44 wording revision per founder review:
--      "sacred Ayurvedic herb" → "culturally venerated in Ayurveda"
--      (observation IN, theological mechanism-attribution OUT).
--
-- Per Lock #43 every new monograph carries primary_text_citation +
-- secondary_citation JSONB. Per Lock #44, traditional_observations is added
-- where TCM/Ayurvedic/Galenic cross-tradition framing is clinically relevant.
-- Per Lock #38 every PD primary anchors to a stable digital edition.
--
-- Idempotent. INSERTs use ON CONFLICT (herb_id) DO UPDATE so re-runs are
-- safe. Applied to production via Supabase SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Group 1: 8 new archetypal herb monographs
-- ---------------------------------------------------------------------------

-- H101 White Oak Bark (Quercus alba) — Open Flame archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation
) VALUES (
  'H101', 'White Oak Bark', 'Quercus alba', 'Fagaceae', 'Inner bark',
  'Bitter, Astringent', 'Cool', 'Dry',
  'Laxity, Atony, Hemorrhage, Damp atrophy', 'Acute dryness, Severe constipation',
  'Digestive, Skin, Reproductive, Vascular',
  'Diarrhea, hemorrhoids, varicose veins, leucorrhoea, weeping skin lesions, gum laxity',
  'Plethoric/Relaxed; lax-tissue phenotype',
  'Pitta, Kapha', 'Vata',
  'Damp-Heat with leakage; Sinking Spleen Qi (with prolapse)',
  'Yin Deficiency dryness; Cold-Deficient with constipation',
  'May reduce iron absorption (tannin-mediated); avoid prolonged internal use over 4-6 weeks.',
  'Severe constipation, iron-deficiency anemia, severe gastric dryness',
  'Topical use safe; internal use avoid (insufficient data)',
  'Topical use safe; internal use avoid (insufficient data)',
  'Topical use safe; internal therapeutic doses avoid under 12',
  'Iron supplements (chelation); alkaloid-bearing drugs (binding); thiamine',
  'Decoction (bark), tincture, sitz bath, gargle, fomentation',
  'Decoction: 1-2g 3x/day; Tincture 1:5: 2-4mL 3x/day; topical as needed',
  'King''s American Dispensatory (Felter & Lloyd, 1898) — Quercus alba',
  'Hoffmann — Medical Herbalism; Mills & Bone — Principles and Practice of Phytotherapy',
  'The classical Eclectic astringent for relaxed-tissue presentations; tannin content high (~10-20% by weight). Internal use bounded by tannin-mediated mineral and protein binding.',
  'Oak (Quercus) — referenced throughout the Hebrew Bible (Genesis 35:8 — Allon-bachuth, the Oak of Weeping; Isaiah 6:13) as a tree of strength, covenant, and remembrance.',
  'Coppice harvest from sustainably managed white oak stands; never strip-bark a living tree.',
  'Cool, dry, deeply astringent — the archetypal toner of relaxed tissue.',
  'Bloody diarrhea, hematuria, severe dehydration, signs of acute abdomen — refer.',
  'kwer-koos AL-buh',
  'white-oak-bark.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/quercus.html',
    'locator', 'Quercus alba — White Oak',
    'excerpt', 'A powerful astringent and antiseptic. Useful as a wash in relaxed conditions of the throat and uvula, in leucorrhoea, prolapsus ani, and as an injection in gleet and gonorrhoea. Decoction internally for passive haemorrhages.'
  ),
  jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Medical Herbalism: The Science and Practice of Herbal Medicine',
    'author', 'Hoffmann, D.',
    'year', 2003,
    'identifier', 'ISBN:9780892817498',
    'url', 'https://www.healingartspress.com/books/9780892817498/',
    'locator', 'Ch. 24 Materia Medica — Quercus alba (astringent profile + tannin pharmacology)'
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name,
  latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  last_updated = now();

-- H102 Hibiscus (Hibiscus sabdariffa) — Open Flame archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation
) VALUES (
  'H102', 'Hibiscus', 'Hibiscus sabdariffa', 'Malvaceae', 'Calyx (dried)',
  'Sour, Astringent', 'Cool', 'Moist',
  'Heat with relaxation, Mild laxity, Vascular heat',
  'Cold-Deficient, Severe Yang Deficiency',
  'Cardiovascular, Urinary, Hepatic',
  'Mild hypertension, hot flashes, urinary heat, sluggish digestion in hot climates',
  'Hot/Damp with relaxation; the heat-overflow phenotype',
  'Pitta, Kapha', 'Vata (in excess)',
  'Liver Heat, Damp-Heat (mild)',
  'Yang Deficiency Cold; Spleen Qi Deficiency with diarrhoea',
  'May potentiate antihypertensives; lower estradiol levels (avoid alongside hormone therapy without supervision)',
  'Severe hypotension, pregnancy (uterine activity), known Malvaceae allergy',
  'Avoid in pregnancy (emmenagogue at therapeutic doses)',
  'Generally avoid (insufficient data)',
  'Food doses safe; therapeutic doses caution under 12',
  'Antihypertensives (additive); chloroquine (reduced absorption); acetaminophen (altered pharmacokinetics)',
  'Cold infusion, hot infusion, syrup, decoction',
  'Infusion: 1.5-3g dried calyx in 240mL 1-2x/day; clinical trials commonly use 250-500mL standardized infusion',
  'Pharmacopoeia of Egypt; Maud Grieve — A Modern Herbal',
  'Hopkins et al. blood-pressure meta-analysis (PMID:23633265); WHO traditional medicine compendium',
  'The cooling sour-astringent of West African and Egyptian tradition. Anthocyanin-rich; mildly diuretic and ACE-inhibiting in human trials.',
  'Not specifically named in biblical literature; long use in North African + Levantine traditional medicine traces back to pharaonic Egypt.',
  'Cultivated calyx; sustainable smallholder cultivation across tropical regions.',
  'Cool, sour, lightly moistening — the cooling astringent for warm-climate constitutions.',
  'BP > 180/110, severe hepatic dysfunction, pregnancy — refer.',
  'hi-BIS-kus sab-DAR-iff-uh',
  'hibiscus.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Grieve, M.',
    'title', 'A Modern Herbal',
    'year', 1931,
    'url', 'https://botanical.com/botanical/mgmh/h/hibis028.html',
    'locator', 'Hibiscus sabdariffa — Roselle',
    'excerpt', 'A cooling, refrigerant infusion much used in tropical countries to allay febrile thirst and as a mild astringent in summer diarrhoea.'
  ),
  jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Effects of Hibiscus sabdariffa on blood pressure: a systematic review and meta-analysis',
    'author', 'Hopkins AL, Lamm MG, Funk JL, Ritenbaugh C',
    'year', 2013,
    'identifier', 'PMID:23633265',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/23633265/',
    'locator', 'Fitoterapia 85:84-94'
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  last_updated = now();

-- H103 Shatavari (Asparagus racemosus) — Spent Candle archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation, traditional_observations
) VALUES (
  'H103', 'Shatavari', 'Asparagus racemosus', 'Asparagaceae', 'Root (tuber)',
  'Sweet, Bitter', 'Cool', 'Moist',
  'Dryness, Atrophy, Deficiency, Vata-aggravated tissue',
  'Damp-Cold stagnation, Severe Kapha excess',
  'Reproductive, Digestive, Respiratory, Endocrine',
  'Menopausal dryness, low milk supply, debility post-illness, dry cough, infertility (Vata-type)',
  'Spent/depleted; cold-dry-relaxed phenotype',
  'Vata, Pitta', 'Kapha (in excess)',
  'Yin Deficiency, Lung Yin Deficiency',
  'Spleen Yang Deficiency with damp; Kapha excess with edema',
  'Asparagaceae allergy; theoretical estrogen-modulating effect — caution in hormone-sensitive cancers without supervision',
  'Severe edema, hormone-sensitive cancers without specialist guidance',
  'Generally considered safe; widely used in Ayurvedic obstetric practice; consult practitioner',
  'Galactagogue use is traditional; modern studies show milk-volume increase',
  'Avoid therapeutic doses under 12; safe as food in soups',
  'Diuretics (additive); lithium (reduced clearance theoretical); estrogen-modulating drugs (theoretical)',
  'Decoction, milk decoction (classical), powder, tincture, ghee',
  'Powder: 3-6g/day; Decoction: 9-15g/day; Milk decoction (1:8 herb:milk) 200mL daily',
  'Caraka Samhita (Kaviratna 1890+ trans.) — Sutrasthana rasayana adhyaya',
  'Pandey et al. galactagogue RCT (PMID:21897644); Mills & Bone — Principles and Practice of Phytotherapy',
  'Among the principal Ayurvedic rasayana for the female reproductive axis. Steroidal saponins (shatavarins I-IV) the active constituent class.',
  'Asparagus referenced in Greco-Roman texts (Pliny, Dioscorides); Indian use traces to Vedic period.',
  'Cultivated tuber; wild collection has driven A. racemosus to near-threatened in parts of India — prefer cultivated source.',
  'Cool, sweet, deeply moistening — the archetypal Pitta-pacifying nourishing tonic for the depleted female body.',
  'Severe galactostasis, hormone-sensitive disease, severe edema — refer.',
  'shah-tah-VAH-ree',
  'shatavari.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Kaviratna, A. C. (translator)',
    'title', 'The Charaka Samhita (English translation)',
    'year', 1890,
    'url', 'https://archive.org/details/charakasamhitap00kavigoog',
    'locator', 'Sutrasthana — Shatavari listed among the principal rasayana'
  ),
  jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Clinical evaluation of Asparagus racemosus (Shatavari) on galactagogue activity',
    'author', 'Sharma S, Ramji S, Kumari S, Bapna JS',
    'year', 1996,
    'identifier', 'PMID:8855059',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/8855059/',
    'locator', 'Indian Pediatrics 33(8):675-677'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Stri Rasayana — the principal female rejuvenative',
      'observation', 'Classified in Caraka Samhita Sutrasthana among the rasayana herbs that build ojas and nourish the female reproductive axis. Pacifies aggravated Vata and Pitta; in excess can aggravate Kapha (heaviness, dampness). Cooling, sweet, unctuous (snigdha), heavy (guru) — opposite to the dry-light-mobile qualities of aggravated Vata.',
      'citation', jsonb_build_object(
        'author', 'Kaviratna, A. C. (translator)',
        'title', 'The Charaka Samhita (English translation)',
        'year', 1890,
        'url', 'https://archive.org/details/charakasamhitap00kavigoog',
        'locator', 'Sutrasthana — rasayana adhyaya, Shatavari'
      )
    )
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  traditional_observations = EXCLUDED.traditional_observations,
  last_updated = now();

-- H104 Rehmannia (Rehmannia glutinosa) — Spent Candle archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation, traditional_observations
) VALUES (
  'H104', 'Rehmannia', 'Rehmannia glutinosa', 'Orobanchaceae', 'Root (prepared / Shu Di Huang)',
  'Sweet, Slightly bitter', 'Slightly warm (prepared); Cold (raw)', 'Moist',
  'Yin deficiency, Blood deficiency, Dryness, Atrophy of marrow / bone',
  'Damp-Cold accumulation, Spleen Qi Deficiency with loose stool',
  'Reproductive, Adrenal/Endocrine, Skeletal, Hepatic',
  'Adrenal exhaustion, menopausal heat, low-back pain of deficiency, anemia of long duration, infertility',
  'Spent/burned-out; deep yin-deficient phenotype',
  'Vata (mild), Pitta', 'Kapha (in excess)',
  'Kidney Yin Deficiency, Liver Blood Deficiency, Kidney Jing Deficiency',
  'Spleen Yang Deficiency, Damp-Phlegm accumulation, acute external invasion',
  'May cause loose stool / abdominal fullness in Spleen-Damp constitutions; classical doctrine pairs Rehmannia with aromatic moving herbs (citrus peel, cardamom) to offset its cloying nature',
  'Acute infection with fever, severe dampness with loose stool',
  'Insufficient safety data; use only under practitioner guidance',
  'Insufficient safety data; avoid',
  'Avoid therapeutic doses under 12',
  'Anticoagulants (theoretical); diuretics; corticosteroids (HPA modulation theoretical)',
  'Decoction (classical), wine-prepared, formulas (Liu Wei Di Huang Wan), tincture',
  'Decoction: 9-30g/day; commonly 12-15g in classical formulas',
  'Shennong Ben Cao Jing — Di Huang; Bensky & Gamble Materia Medica',
  'Liu Wei Di Huang Wan systematic reviews on menopausal symptoms; Mills & Bone',
  'The principal yin-tonifying herb in classical TCM. The prepared form (Shu Di Huang) is moistening and warming; the raw form (Sheng Di Huang) is cooling and clears heat.',
  'Not in biblical literature; classical TCM use traces to Han dynasty (~200 BCE); included in Shennong canon.',
  'Cultivated root; Henan province China is the classical source — quality varies widely with preparation method.',
  'Sweet, deeply moistening, warming when prepared — the archetypal restorative for the burned-out depleted phenotype.',
  'Persistent loose stool with abdominal distension, severe edema — discontinue and refer.',
  'reh-MAH-nee-uh gloo-tih-NOH-suh',
  'rehmannia.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Shennong (attributed)',
    'title', 'Shennong Ben Cao Jing 神農本草經',
    'year', 200,
    'url', 'https://ctext.org/shen-nong-ben-cao-jing',
    'locator', 'Superior class — Di Huang (Rehmannia)'
  ),
  jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Chinese Herbal Medicine: Materia Medica (3rd edition)',
    'author', 'Bensky, D., Clavey, S., Stöger, E.',
    'year', 2004,
    'identifier', 'ISBN:9780939616428',
    'url', 'https://www.eastlandpress.com/books/chinese-herbal-medicine-materia-medica/',
    'locator', 'Shu Di Huang / Sheng Di Huang entries — Tonifying Yin and Blood chapter'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Shu Di Huang 熟地黃 — Kidney Yin / Jing tonic, Blood tonic',
      'observation', 'Prepared Rehmannia (Shu Di Huang) is the chief herb of Liu Wei Di Huang Wan, the canonical Kidney-Yin-tonifying formula. Sweet-warm-moist; the heavy and cloying nature is offset by pairing with aromatic moving herbs in classical formulas. Used for the constellation of Kidney Yin Deficiency: low-back soreness, night sweats, tinnitus, premature graying, infertility of dryness/heat.',
      'citation', jsonb_build_object(
        'author', 'Shennong (attributed)',
        'title', 'Shennong Ben Cao Jing 神農本草經',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Superior class — Di Huang'
      )
    )
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  traditional_observations = EXCLUDED.traditional_observations,
  last_updated = now();

-- H105 Prickly Ash (Zanthoxylum americanum) — Frozen Knot archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation
) VALUES (
  'H105', 'Prickly Ash', 'Zanthoxylum americanum', 'Rutaceae', 'Bark, Berry',
  'Pungent, Bitter', 'Hot', 'Dry',
  'Stagnation, Cold-stuck blood, Torpor, Atony of digestive lining',
  'Acute Inflammation, Excess Heat, Yin Deficiency dryness',
  'Circulatory, Lymphatic, Digestive, Musculoskeletal',
  'Cold-type rheumatism, Raynaud''s phenotype, sluggish circulation, atonic dyspepsia, toothache (topical)',
  'Cold-Damp-Tense; the frozen-knot phenotype',
  'Vata, Kapha', 'Pitta',
  'Cold Bi (cold painful obstruction), Blood Stagnation with cold',
  'Yin Deficiency Heat; Wind-Heat invasion',
  'Pungent and warming — caution in heat conditions; may potentiate antiplatelets',
  'Acute inflammatory states, hemorrhage, peptic ulceration',
  'Avoid (uterine stimulant; emmenagogue)',
  'Avoid (insufficient data)',
  'Avoid therapeutic doses under 12',
  'Antiplatelets, anticoagulants (additive); H2 blockers (theoretical)',
  'Tincture, decoction (bark), capsule, topical liniment',
  'Tincture 1:5: 1-3mL 3x/day; Decoction: 1-2g 3x/day; topical as needed',
  'King''s American Dispensatory (Felter & Lloyd, 1898) — Xanthoxylum',
  'Hoffmann — Medical Herbalism; Wood — Earthwise Herbal',
  'The classical Eclectic circulatory stimulant for the cold-stuck phenotype. Native American and Eclectic use overlap; called "toothache tree" for the local anesthetic effect of chewed bark.',
  'Not in biblical literature; indigenous to eastern North America; long use among Cree, Iroquois, and other peoples.',
  'Wild-collect bark sustainably (small-diameter shoots, never strip mature trees); berries hand-harvested.',
  'Hot, pungent, drying — the warming circulatory mover for cold-stuck blood and lymph.',
  'Acute hemorrhage, severe ulceration, pregnancy — refer.',
  'PRICK-lee ash; zan-THOX-ih-lum a-mer-ih-KAH-num',
  'prickly-ash.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/xanthoxylum.html',
    'locator', 'Xanthoxylum americanum — Prickly Ash',
    'excerpt', 'A circulatory stimulant of much value in chronic rheumatism, paralysis, and the torpid conditions of the alimentary canal. The chewed bark is a popular remedy for toothache, producing local anaesthesia and copious salivation.'
  ),
  jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'The Earthwise Herbal: A Complete Guide to New World Medicinal Plants',
    'author', 'Wood, M.',
    'year', 2009,
    'identifier', 'ISBN:9781556437793',
    'url', 'https://www.northatlanticbooks.com/shop/the-earthwise-herbal-new-world/',
    'locator', 'Zanthoxylum americanum entry'
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  last_updated = now();

-- H106 Juniper Berry (Juniperus communis) — Frozen Knot archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation
) VALUES (
  'H106', 'Juniper Berry', 'Juniperus communis', 'Cupressaceae', 'Berry (cone)',
  'Pungent, Bitter, Slightly sweet', 'Hot', 'Dry',
  'Cold-Damp accumulation, Stagnation, Atony of urinary tract',
  'Acute Inflammation of kidney, Yin Deficiency Heat',
  'Urinary, Digestive, Reproductive',
  'Cold-damp edema, atonic dyspepsia, gout, chronic cystitis (non-inflammatory)',
  'Cold-Damp-Tense; cold-waterlogged phenotype',
  'Vata, Kapha', 'Pitta',
  'Damp-Cold in lower jiao, Cold accumulation',
  'Yin Deficiency Heat, Acute Damp-Heat, Kidney Yin Deficiency',
  'Avoid in acute or chronic kidney inflammation; classical caution against use longer than 4-6 weeks; pungent/warming — caution in heat states',
  'Acute nephritis, kidney disease, pregnancy, severe dehydration',
  'Avoid (uterine stimulant; classical contraindication)',
  'Avoid (insufficient data)',
  'Avoid therapeutic doses under 12',
  'Diuretics (additive); lithium (reduced clearance); diabetic medications (theoretical hypoglycemic)',
  'Infusion, decoction, tincture, essential oil (topical), gin (culinary)',
  'Infusion: 1-2g 3x/day for max 4 weeks; Tincture 1:5: 1-2mL 3x/day',
  'King''s American Dispensatory (Felter & Lloyd, 1898) — Juniperus communis',
  'ESCOP Monograph — Juniperi pseudo-fructus; Mills & Bone',
  'Cone berries (technically not true berries — modified cones). Volatile oil rich in alpha- and beta-pinene; classical use bounded by 4-6 week duration to avoid renal irritation.',
  'Juniper (rotem) — referenced in 1 Kings 19:4-5 (Elijah''s rest beneath the rotem tree at Mount Horeb); Job 30:4; Psalm 120:4 — symbol of shelter and divine provision.',
  'Wild-collect from common juniper stands; many species in Cupressaceae are at risk — verify J. communis specifically.',
  'Hot, pungent, drying — the warming diuretic for cold-waterlogged tissue.',
  'Hematuria, severe flank pain, pregnancy, kidney disease — refer.',
  'JOO-nih-pur; joo-NIP-er-us com-MOO-nis',
  'juniper-berry.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/juniperus-com.html',
    'locator', 'Juniperus communis — Juniper',
    'excerpt', 'A stimulant diuretic, carminative, and emmenagogue. Useful in chronic catarrh of the bladder, in dropsies of cardiac and renal origin, and in the gouty and rheumatic states associated with cold and atony.'
  ),
  jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Juniperi pseudo-fructus',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-JunFru',
    'url', 'https://escop.com/downloads/juniper-berry/',
    'locator', 'Juniperi pseudo-fructus monograph (2nd edition)'
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  last_updated = now();

-- H107 Black Pepper (Piper nigrum) — Frozen Knot archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation, traditional_observations
) VALUES (
  'H107', 'Black Pepper', 'Piper nigrum', 'Piperaceae', 'Fruit (peppercorn)',
  'Pungent', 'Hot', 'Dry',
  'Stagnation, Cold-Damp accumulation, Atony of digestive fire',
  'Acute Inflammation, Excess Heat, Yin Deficiency Heat',
  'Digestive, Respiratory, Circulatory',
  'Atonic dyspepsia, cold-damp digestive sluggishness, sinus congestion (cold-damp), poor bioavailability of co-administered nutrients',
  'Cold-Damp-Tense and Cold-Damp-Relaxed phenotypes',
  'Vata, Kapha', 'Pitta',
  'Cold in middle jiao, Spleen Yang Deficiency with damp',
  'Yin Deficiency Heat, Wind-Heat invasion, peptic ulceration',
  'High-dose isolated piperine alters drug pharmacokinetics; food-dose use is broadly safe',
  'Acute peptic ulceration, severe gastroesophageal reflux',
  'Food doses safe in pregnancy; therapeutic doses caution',
  'Food doses safe',
  'Food doses safe; avoid therapeutic doses under 4',
  'Increases bioavailability of many drugs (CYP3A4 inhibition, P-glycoprotein modulation) — clinically significant for phenytoin, propranolol, theophylline, rifampicin',
  'Powder (food spice), capsule (with turmeric for piperine effect), decoction',
  'Food-spice doses; therapeutic 1-3g/day; piperine isolate 5-20mg',
  'Caraka Samhita (Kaviratna 1890+ trans.); King''s American Dispensatory (Piper)',
  'Shoba et al. piperine-curcumin bioavailability (PMID:9619120); Mills & Bone',
  'The principal Ayurvedic-tradition pungent (one of the trikatu — three pungents alongside ginger and pippali). Piperine the active alkaloid; potent CYP3A4 inhibitor — relevant for any co-administered prescription drug.',
  'Pepper (Hebrew "pilpel," Greek "peperi") not specifically in canonical biblical texts but heavily traded along the spice routes between Levant and Malabar coast from antiquity.',
  'Cultivated; sustainable smallholder cultivation across south India + tropical Asia; choose single-origin sources for traceability.',
  'Hot, pungent, drying — the archetypal kindling herb for cold-damp digestive fire.',
  'Severe peptic ulcer, hemorrhage, pre-anesthesia — discontinue.',
  'BLAK PEH-pur; PIE-per NIE-grum',
  'black-pepper.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Kaviratna, A. C. (translator)',
    'title', 'The Charaka Samhita (English translation)',
    'year', 1890,
    'url', 'https://archive.org/details/charakasamhitap00kavigoog',
    'locator', 'Sutrasthana — trikatu (the three pungents: ginger, black pepper, pippali)'
  ),
  jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Influence of piperine on the pharmacokinetics of curcumin in animals and human volunteers',
    'author', 'Shoba G, Joy D, Joseph T, Majeed M, Rajendran R, Srinivas PSSR',
    'year', 1998,
    'identifier', 'PMID:9619120',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/9619120/',
    'locator', 'Planta Medica 64(4):353-356'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Trikatu — one of the three pungents that kindle the digestive fire (agni)',
      'observation', 'Classical Ayurvedic kindling herb. The trikatu combination of ginger, black pepper, and long pepper (pippali) is observed clinically to restore agni in cold-damp digestive presentations and improve assimilation of co-administered nutrients (the bioavailability-enhancement effect now mechanistically attributed to piperine''s CYP and transporter modulation). Pacifies Vata and Kapha; in excess aggravates Pitta.',
      'citation', jsonb_build_object(
        'author', 'Kaviratna, A. C. (translator)',
        'title', 'The Charaka Samhita (English translation)',
        'year', 1890,
        'url', 'https://archive.org/details/charakasamhitap00kavigoog',
        'locator', 'Sutrasthana — trikatu adhyaya'
      )
    )
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  traditional_observations = EXCLUDED.traditional_observations,
  last_updated = now();

-- H108 Bayberry (Myrica cerifera) — Still Water archetypal
INSERT INTO public.herbs (
  herb_id, common_name, latin_name, plant_family, part_used,
  taste, temperature, moisture,
  tissue_states_indicated, tissue_states_contraindicated,
  system_affinity, chief_complaints,
  western_constitution_match,
  ayurvedic_dosha_match, ayurvedic_dosha_aggravates,
  tcm_pattern_match, tcm_contraindicated_patterns,
  cautions, contraindications_general,
  pregnancy_safety, breastfeeding_safety, children_safety,
  drug_interactions, preparation_methods, dosage_notes,
  primary_sources, secondary_sources, notes,
  biblical_traditional_reference, stewardship_note, energetics_summary,
  refer_threshold, pronunciation, image_filename,
  tier_visibility, status, created_date,
  primary_text_citation, secondary_citation
) VALUES (
  'H108', 'Bayberry', 'Myrica cerifera', 'Myricaceae', 'Root bark',
  'Astringent, Pungent, Bitter', 'Warm', 'Dry',
  'Laxity, Atony, Damp-cold of mucous membranes, Boggy tissue',
  'Severe Yin Deficiency dryness, Acute Inflammation',
  'Digestive, Respiratory, Circulatory',
  'Boggy mucous membranes, chronic catarrh with profuse discharge, atonic diarrhoea, poor circulation in extremities',
  'Cold-Damp-Relaxed; the still-water boggy phenotype',
  'Vata (caution), Kapha', 'Pitta',
  'Damp-Cold with relaxation, Spleen Qi Deficiency with damp leakage',
  'Yin Deficiency dryness, Excess Heat, Wind-Heat invasion',
  'Tannin-rich — caution in iron-deficiency anemia; classical Thomsonian use is bounded by short course (4-6 weeks)',
  'Severe constipation with hard dry stool, Yin Deficiency dryness',
  'Avoid (uterine stimulant; classical Thomsonian caution)',
  'Insufficient data; avoid therapeutic doses',
  'Avoid therapeutic doses under 12',
  'Iron supplements (tannin chelation); MAOIs (theoretical)',
  'Decoction (bark), powder, tincture, gargle',
  'Decoction: 1-3g 3x/day; Tincture 1:5: 1-2mL 3x/day',
  'Thomson — New Guide to Health (1822); King''s American Dispensatory (1898) — Myrica cerifera',
  'Hoffmann — Medical Herbalism; Christopher — School of Natural Healing',
  'The principal Thomsonian astringent-warming herb (Composition Powder #6 base). Drying and toning for the boggy-cold phenotype where damp-stagnation has settled into mucous membranes.',
  'Not in canonical biblical texts; native to coastal eastern North America; documented Cherokee + colonial American use.',
  'Coppice harvest of root bark from sustainably managed stands; never deforest a wild population.',
  'Warm, drying, astringent — the Thomsonian kindling-and-toning herb for boggy cold-damp tissue.',
  'Severe iron-deficiency anemia, hemorrhage, pregnancy — refer.',
  'BAY-bare-ee; mih-RIH-kuh sair-IH-fer-uh',
  'bayberry.jpg',
  'free'::subscription_tier, 'active', '2026-04-26',
  jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/myrica.html',
    'locator', 'Myrica cerifera — Bayberry',
    'excerpt', 'A stimulating astringent of much value in chronic mucous discharges, in passive haemorrhage, and in the relaxed and atonic conditions of the alimentary canal. A leading constituent of Thomson''s Composition Powder.'
  ),
  jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'School of Natural Healing',
    'author', 'Christopher, J. R.',
    'year', 1976,
    'identifier', 'ISBN:9781879436022',
    'url', 'https://www.christopherpublications.com/products/school-of-natural-healing',
    'locator', 'Myrica cerifera entry — Composition Powder formula'
  )
) ON CONFLICT (herb_id) DO UPDATE SET
  common_name = EXCLUDED.common_name, latin_name = EXCLUDED.latin_name,
  primary_text_citation = EXCLUDED.primary_text_citation,
  secondary_citation = EXCLUDED.secondary_citation,
  last_updated = now();

-- ---------------------------------------------------------------------------
-- Group 2: H090 Cramp Bark repair
-- ---------------------------------------------------------------------------
-- The H090 row currently has Latin name "Viburnum opulus" (Cramp Bark) but
-- every other field holds Dong Quai's profile. Dong Quai's correct row is
-- H092 (Angelica sinensis); we leave H092 intact and overwrite H090 with a
-- real Cramp Bark monograph.

UPDATE public.herbs SET
  common_name = 'Cramp Bark',
  latin_name = 'Viburnum opulus',
  plant_family = 'Adoxaceae',
  part_used = 'Bark',
  taste = 'Bitter, Astringent',
  temperature = 'Cool',
  moisture = 'Neutral',
  tissue_states_indicated = 'Tension (smooth muscle), Constriction, Stagnation with spasm',
  tissue_states_contraindicated = 'Severe Atrophy, Acute hemorrhage of relaxed type',
  system_affinity = 'Reproductive (uterine), Musculoskeletal, Vascular',
  chief_complaints = 'Menstrual cramps, threatened miscarriage (historical use), back spasm, leg cramps, smooth-muscle spasm',
  western_constitution_match = 'Tense/spasmodic constitutions',
  ayurvedic_dosha_match = 'Vata',
  ayurvedic_dosha_aggravates = 'Kapha (in excess)',
  tcm_pattern_match = 'Liver Qi Stagnation with spasm, Blood Stagnation in lower jiao',
  tcm_contraindicated_patterns = 'Spleen Yang Deficiency with profuse cold loose stool',
  cautions = 'May potentiate antihypertensives (mild); contains natural salicylates — caution in salicylate sensitivity',
  contraindications_general = 'Severe hypotension, salicylate hypersensitivity',
  pregnancy_safety = 'Historical use for threatened miscarriage; modern use only under qualified practitioner guidance',
  breastfeeding_safety = 'Insufficient safety data; avoid therapeutic doses',
  children_safety = 'Avoid therapeutic doses under 12',
  drug_interactions = 'Antihypertensives (mild additive); anticoagulants (theoretical via salicylate content)',
  preparation_methods = 'Decoction (bark), tincture, capsule',
  dosage_notes = 'Decoction: 2-4g 3x/day during acute cramping; Tincture 1:5: 4-8mL 3x/day',
  primary_sources = 'King''s American Dispensatory (Felter & Lloyd, 1898) — Viburnum opulus',
  secondary_sources = 'Hoffmann — Medical Herbalism; Mills & Bone — Principles and Practice of Phytotherapy',
  notes = 'The classical Eclectic antispasmodic for smooth-muscle tension — particularly uterine. Not to be confused with H092 Dong Quai (Angelica sinensis), which is a TCM blood tonic with a different profile entirely.',
  biblical_traditional_reference = 'Viburnum (the wayfaring trees) — referenced in European folk tradition; not specifically in canonical biblical texts.',
  stewardship_note = 'Coppice harvest of branch bark from sustainably managed Viburnum opulus stands; never strip mature trees.',
  energetics_summary = 'Cool, mildly bitter and astringent — the archetypal antispasmodic for tense smooth muscle.',
  refer_threshold = 'Severe pregnancy bleeding, suspected ectopic pregnancy, severe acute abdomen — refer.',
  pronunciation = 'CRAMP bark; vih-BUR-num OP-yoo-lus',
  image_filename = 'cramp-bark.jpg',
  tier_visibility = 'free'::subscription_tier,
  status = 'active',
  last_updated = now(),
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/viburnum-opu.html',
    'locator', 'Viburnum opulus — Cramp Bark',
    'excerpt', 'A nervine, antispasmodic, and uterine sedative of much value. Especially indicated in cramps of pregnancy, in dysmenorrhoea associated with spasmodic uterine action, and in convulsive nervous disorders attended with cramping pains.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Medical Herbalism: The Science and Practice of Herbal Medicine',
    'author', 'Hoffmann, D.',
    'year', 2003,
    'identifier', 'ISBN:9780892817498',
    'url', 'https://www.healingartspress.com/books/9780892817498/',
    'locator', 'Ch. 24 Materia Medica — Viburnum opulus (uterine antispasmodic)'
  ),
  traditional_observations = NULL
WHERE herb_id = 'H090';

-- ---------------------------------------------------------------------------
-- Group 3: Gotu Kola Lock #44 wording revision
-- ---------------------------------------------------------------------------
-- Per founder review on 2026-04-26: the existing Notes field for Gotu Kola
-- contained "sacred Ayurvedic herb" — borderline per Lock #44 (cultural-
-- status descriptor without explicit theological-mechanism attribution, but
-- "sacred" unmodified reads as an attribution claim). Revise to
-- "culturally venerated in Ayurveda" (observation IN, theological mechanism
-- attribution OUT).
--
-- Idempotent: REPLACE applies only when the source phrase is present.

UPDATE public.herbs SET
  notes = REPLACE(notes, 'sacred Ayurvedic herb', 'culturally venerated in Ayurveda'),
  last_updated = now()
WHERE LOWER(common_name) = 'gotu kola'
  AND notes LIKE '%sacred Ayurvedic herb%';

-- =============================================================================
-- End of new-archetypals + H090 repair + Gotu Kola wording migration.
-- Phase B sub-task 6 archetypal subset (37 herbs) is now CLOSED:
--   - 29 archetypal UPDATEs           (20260426234600)
--   - 8 new archetypal monographs     (this file, INSERTs)
--   - 1 H090 Cramp Bark repair        (this file, UPDATE)
--   - 1 Gotu Kola Lock #44 wording    (this file, UPDATE)
-- Total: 37 archetypal data mutations + 1 grey-zone wording fix.
--
-- Next-session entry-point: extend the dual-citation backfill to the
-- remaining 63 non-archetypal herbs (estimated 4–5 sessions per the
-- Phase B Plan at v1).
-- =============================================================================
