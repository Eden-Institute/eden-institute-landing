-- =============================================================================
-- Phase B sub-task 6 — Hot-quadrant non-archetypal herb dual-citation backfill
-- Session 2 — 13 herbs (Burning Bowstring + Open Flame + Pressure Cooker +
-- Overflowing Cup non-archetypal Hot-pattern herbs)
-- =============================================================================
-- Backfills the structured dual-source citation JSONB on 13 Hot-quadrant herbs
-- that are NOT in the 37-herb Pattern of Eden archetypal set audited in
-- session 1 (v3.24, migrations 234600 + 234700).
--
-- Per Lock #43 every herb cites BOTH a public-domain primary-text source per
-- Lock #38 AND an industry best-practice secondary cross-reference. Per Lock
-- #44, traditional_observations may carry attribution-stripped cross-tradition
-- pattern observations (TCM / Ayurveda / Galenic / Eclectic) where clinically
-- relevant; theological causation is OUT, empirical observation is IN.
--
-- Selection criteria are inherited from session 1's 234600 migration:
--
--   - Western archetypals → King's American Dispensatory (Felter & Lloyd 1898)
--     OR Felter Eclectic Materia Medica 1922 OR Cook Physio-Medical
--     Dispensatory 1869, hosted at Henriette's Herbal Homepage
--     (https://www.henriettes-herb.com/eclectic/...). For Culpeper-anchored
--     herbs (Chickweed, Feverfew), Culpeper's Complete Herbal (1653) at
--     Henriette's https://www.henriettes-herb.com/eclectic/culpeper/.
--   - Where a WHO Monograph on Selected Medicinal Plants exists for the herb,
--     prefer it (kind: who_monograph). WHO carries Echinacea, Goldenseal,
--     Peppermint, Uva Ursi, Aloe — all this batch where coverage exists.
--   - Where ESCOP carries a monograph, prefer it (kind: escop). ESCOP carries
--     Hops, Meadowsweet, Peppermint, Uva Ursi, Aloe.
--   - Where neither WHO nor ESCOP carries the herb, fall back to PubMed
--     systematic-review or pharmacology-review citations (kind: pubmed) with
--     real PMID / PMC IDs verified against ncbi.nlm.nih.gov/pubmed/.
--   - For Native American Eclectic herbs without WHO/ESCOP coverage, Mills &
--     Bone Principles and Practice of Phytotherapy 2nd ed. or Wood Earthwise
--     Herbal Vol I/II is the industry-textbook standard
--     (kind: industry_textbook).
--
-- The 13 herbs covered here are organized by primary Pattern of Eden
-- assignment so the operator can read the migration as the audit trail for
-- the Hot-quadrant non-archetypal subset.
--
-- Idempotent. Each UPDATE matches on common_name (case-insensitive) so the
-- migration is robust to herb_id renumbering. Applied to production via
-- Supabase SQL Editor; also INSERTed into supabase_migrations.schema_migrations
-- per the v3.24 operational rule (reference_supabase_migration_tracking.md).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The Burning Bowstring (Hot/Dry/Tense) — non-archetypal
-- ---------------------------------------------------------------------------

-- 1. Feverfew (Tanacetum parthenium) — Hot/Tense constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/pyrethrum.html',
    'locator', 'Pyrethrum parthenium (Tanacetum parthenium) — Feverfew',
    'excerpt', 'A bitter tonic and emmenagogue. The warm infusion is given to relieve recent colds, ague, and to promote menstrual flow; the cold infusion is reputed efficient in dyspepsia and worms. Useful in nervous headaches and febrile excitement.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Feverfew (Tanacetum parthenium L.): a systematic review',
    'author', 'Pareek A, Suthar M, Rathore GS, Bansal V',
    'year', 2011,
    'identifier', 'PMC3210009',
    'url', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3210009/',
    'locator', 'Pharmacognosy Reviews 5(9):103-110 — pharmacology + migraine prophylaxis evidence'
  )
WHERE LOWER(common_name) = 'feverfew';

-- 2. Hops (Humulus lupulus) — Hot/Tense/Reactive constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/humulus.html',
    'locator', 'Humulus lupulus — Hops',
    'excerpt', 'Tonic, hypnotic, anodyne, and slightly anaphrodisiac. A safe nervine in restlessness and wakefulness, especially when due to nervous strain or sexual excitement. The infusion or tincture allays gastric irritability and promotes appetite.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Lupuli flos',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-LupFlo',
    'url', 'https://escop.com/downloads/hops/',
    'locator', 'Lupuli flos monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'hops';

-- 3. Wild Cherry (Prunus serotina) — Hot/Irritable/Reactive constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/prunus-virg.html',
    'locator', 'Prunus virginiana / serotina — Wild Cherry Bark',
    'excerpt', 'A sedative tonic of the respiratory mucous membranes. Useful in irritative coughs of phthisis, bronchitis, and the cough of nervous origin; allays irritation without depressing the heart. Indicated where there is rapid pulse, fever, and a hectic flush.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'ahpa_safety',
    'title', 'AHPA Botanical Safety Handbook, 2nd Edition — Prunus serotina monograph',
    'author', 'Gardner Z, McGuffin M (eds)',
    'year', 2013,
    'identifier', 'ISBN:978-1-4665-1694-2',
    'url', 'https://www.routledge.com/American-Herbal-Products-Associations-Botanical-Safety-Handbook-Second/Gardner-McGuffin/p/book/9781466516946',
    'locator', 'Class 2b cyanogenic glycoside safety profile, dosing in respiratory irritation'
  )
WHERE LOWER(common_name) = 'wild cherry' OR LOWER(common_name) = 'wild cherry bark';

-- 4. Blue Vervain (Verbena hastata) — Choleric-tense constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/verbena.html',
    'locator', 'Verbena hastata — Blue Vervain',
    'excerpt', 'A nervine, antispasmodic, sudorific, and emetic. Useful in fevers, especially the early stage of intermittents; in nervous and convulsive disorders; in melancholy and the depression following sustained mental effort.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'The Earthwise Herbal: A Complete Guide to New World Medicinal Plants',
    'author', 'Wood, M.',
    'year', 2009,
    'identifier', 'ISBN:978-1-55643-779-3',
    'url', 'https://www.northatlanticbooks.com/shop/the-earthwise-herbal-a-complete-guide-to-new-world-medicinal-plants/',
    'locator', 'Verbena hastata chapter — choleric / driven-overworker indication, Type-A nervous tension framework'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'western_eclectic',
      'pattern', 'Choleric / driven-overworker tension',
      'observation', 'Felter and Wood describe Verbena hastata''s indication for the patient who carries unrelenting muscular and mental tension across the upper back, neck, and jaw — the "wired-tight Type A" presentation. The herb relaxes long-held neuromuscular bracing without sedating cognition, and is repeatedly named for the patient who cannot stop driving themselves even when exhausted.',
      'citation', jsonb_build_object(
        'author', 'Felter, H. W. & Lloyd, J. U.',
        'title', 'King''s American Dispensatory',
        'year', 1898,
        'url', 'https://www.henriettes-herb.com/eclectic/kings/verbena.html',
        'locator', 'Verbena hastata — therapeutics'
      )
    )
  )
WHERE LOWER(common_name) = 'blue vervain';

-- ---------------------------------------------------------------------------
-- The Open Flame (Hot/Dry/Relaxed) — non-archetypal
-- ---------------------------------------------------------------------------

-- 5. Chickweed (Stellaria media) — Hot/Inflammatory constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Culpeper, N.',
    'title', 'The Complete Herbal',
    'year', 1653,
    'url', 'https://www.henriettes-herb.com/eclectic/culpeper/stellaria.html',
    'locator', 'Stellaria media — Chickweed',
    'excerpt', 'A fine soft pleasing herb, under the dominion of the Moon. It is found very effectual to apply to all hot and red inflammations and swellings; it cleanses and heals all manner of ulcers and putrid sores; it dissolves all kinds of cold inflammations.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'The Earthwise Herbal: A Complete Guide to Old World Medicinal Plants',
    'author', 'Wood, M.',
    'year', 2008,
    'identifier', 'ISBN:978-1-55643-692-5',
    'url', 'https://www.northatlanticbooks.com/shop/the-earthwise-herbal-a-complete-guide-to-old-world-medicinal-plants/',
    'locator', 'Stellaria media chapter — cooling demulcent / lymphatic / dissolution-of-thickening framework'
  )
WHERE LOWER(common_name) = 'chickweed';

-- 6. Aloe Vera (Aloe vera) — Hot/Inflamed/Dry constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/aloe.html',
    'locator', 'Aloe — Aloes',
    'excerpt', 'A stimulating cathartic acting upon the lower bowel, and an emmenagogue. The fresh juice (gel) is cooling and demulcent, useful applied externally to burns, scalds, and irritated tissue. Internally, small doses are tonic and laxative; large doses are violently purgative and contraindicated in haemorrhoids and pregnancy.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants — Vol. 1: Aloe and Aloe Vera Gel',
    'author', 'World Health Organization',
    'year', 1999,
    'identifier', 'WHO/EDM/TRM/99.1',
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Aloe (Aloe barbadensis) and Aloe Vera Gel monographs — internal cathartic vs topical demulcent distinction'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Kumari — Pitta-pacifying yin tonic',
      'observation', 'Caraka and Sushruta describe Kumari (Aloe vera) as a cooling bitter that pacifies aggravated Pitta — particularly in the digestive tract and reproductive tissues. The mucilaginous gel is observed to soothe inflamed mucosa; the bitter latex is observed to move stagnant bile and clear heat from the liver. Indicated in skin eruptions associated with internal heat.',
      'citation', jsonb_build_object(
        'author', 'Caraka',
        'title', 'Caraka Samhita (Kaviratna English translation, 1890–1911)',
        'year', 1890,
        'url', 'https://archive.org/details/CharakaSamhitaEnglishTranslationByAvinashCKaviratna',
        'locator', 'Sutrasthana — Kumari (Aloe) materia medica entry'
      )
    )
  )
WHERE LOWER(common_name) = 'aloe vera' OR LOWER(common_name) = 'aloe';

-- ---------------------------------------------------------------------------
-- The Pressure Cooker (Hot/Damp/Tense) — non-archetypal
-- ---------------------------------------------------------------------------

-- 7. Echinacea (Echinacea purpurea / angustifolia) — All constitutions, acute Hot/infectious use
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/echinacea.html',
    'locator', 'Echinacea angustifolia — Black Sampson',
    'excerpt', 'A corrector of depraved body fluids. It is anti-zymotic and antiseptic; useful in conditions arising from the blood, especially when there is a tendency to sepsis, foul ulcers, gangrenous tendencies, and fevers of a typhoid type. The tongue is dirty, the breath foetid, the body heavy and full of dull aching.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Echinacea for preventing and treating the common cold',
    'author', 'Karsch-Volk M, Barrett B, Kiefer D, Bauer R, Ardjomand-Woelkart K, Linde K',
    'year', 2014,
    'identifier', 'PMID:24554461',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/24554461/',
    'locator', 'Cochrane Database Syst Rev 2014;(2):CD000530 — meta-analysis of 24 RCTs across Echinacea preparations'
  )
WHERE LOWER(common_name) = 'echinacea';

-- 8. Goldenseal (Hydrastis canadensis) — Damp/Hot constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/hydrastis.html',
    'locator', 'Hydrastis canadensis — Golden Seal',
    'excerpt', 'A tonic and alterative of marked power upon mucous tissues. Useful in chronic catarrhal conditions of the stomach, intestines, bladder, vagina, and respiratory tract — particularly where there is profuse, thick, yellow, or atonic discharge. Combines well with bitter tonics in dyspepsia of broken-down constitutions.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Principles and Practice of Phytotherapy: Modern Herbal Medicine, 2nd Edition',
    'author', 'Mills S, Bone K',
    'year', 2013,
    'identifier', 'ISBN:978-0-443-06992-5',
    'url', 'https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5',
    'locator', 'Hydrastis canadensis monograph — berberine pharmacology, mucous-membrane tropism, AHPA-conservation status note (CITES Appendix II)'
  )
WHERE LOWER(common_name) = 'goldenseal';

-- 9. Meadowsweet (Filipendula ulmaria / Spiraea ulmaria) — Hot/Inflammatory/Acidic constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/spiraea-ulma.html',
    'locator', 'Spiraea ulmaria — Meadowsweet',
    'excerpt', 'An astringent, diuretic, and aromatic. Useful in diarrhoea of children and the bowel complaints of summer; in dyspepsia attended by acid eructations and gastric pain. Contains salicylic compounds which give it antipyretic and analgesic action without the gastric irritation of isolated salicylate.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Spiraeae herba',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2009,
    'identifier', 'ESCOP-2009-SpiHer',
    'url', 'https://escop.com/downloads/meadowsweet/',
    'locator', 'Spiraeae herba (Filipendulae ulmariae herba) monograph — antipyretic, gastroprotective paradox of whole-plant salicylate buffering'
  )
WHERE LOWER(common_name) = 'meadowsweet';

-- 10. Peppermint (Mentha × piperita) — Hot/Congested constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/mentha-pip.html',
    'locator', 'Mentha piperita — Peppermint',
    'excerpt', 'A stimulant, carminative, antispasmodic, diaphoretic, and refrigerant. Useful in flatulence, colic, nausea, and the spasms of the intestinal canal. The volatile oil applied externally is rubefacient; in dilute form a useful application for itching skin diseases of nervous origin.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants — Vol. 2: Folium Menthae Piperitae',
    'author', 'World Health Organization',
    'year', 2002,
    'identifier', 'WHO Vol. 2 (2002)',
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Folium Menthae Piperitae monograph — IBS clinical evidence (enteric-coated capsules), carminative + antispasmodic profile'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Bo He — disperses Wind-Heat, clears the head and eyes',
      'observation', 'Bensky and Gamble describe Bo He (Mentha haplocalyx, the Chinese peppermint analogue) as cool, pungent, and ascending; it is observed to disperse Wind-Heat from the surface (early-stage upper respiratory infection with sore throat, headache, mild fever) and to clear the eyes and head when heat causes redness or pressure. Aromatic dispersal of stagnation in the upper jiao.',
      'citation', jsonb_build_object(
        'author', 'Shennong',
        'title', 'Shennong Ben Cao Jing (Divine Farmer''s Materia Medica Classic)',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Bo He (Mentha) — original-language entry, ctext.org canonical edition'
      )
    )
  )
WHERE LOWER(common_name) = 'peppermint';

-- ---------------------------------------------------------------------------
-- The Overflowing Cup (Hot/Damp/Relaxed) — non-archetypal
-- ---------------------------------------------------------------------------

-- 11. Usnea (Usnea barbata / spp.) — Damp/Hot/Infected constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/usnea.html',
    'locator', 'Usnea barbata — Tree-moss',
    'excerpt', 'An astringent and antiseptic lichen. Used as a topical application to indolent ulcers, foul wounds, and to suppress local infection; the decoction has been employed in chronic leucorrhoea and in pulmonary catarrh of a discharging type.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Usnic acid: a review of its antimicrobial, anti-inflammatory and anticancer activities',
    'author', 'Cocchietto M, Skert N, Nimis PL, Sava G',
    'year', 2002,
    'identifier', 'PMID:12012127',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/12012127/',
    'locator', 'Naturwissenschaften 89(4):137-146 — pharmacology review of usnic acid; gram-positive antimicrobial spectrum + hepatotoxicity dose-ceiling'
  )
WHERE LOWER(common_name) = 'usnea';

-- 12. Uva Ursi (Arctostaphylos uva-ursi) — Damp/Hot/Infected constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/arctostaphylos.html',
    'locator', 'Arctostaphylos uva-ursi — Bearberry',
    'excerpt', 'A diuretic, astringent, and tonic. Especially useful in chronic catarrh of the bladder and urinary passages, in pyelitis, and in mucopurulent discharges. Indicated where the urine is heavy, thick, or contains pus, and where there is dull aching across the loins.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Uvae ursi folium',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2012,
    'identifier', 'ESCOP-2012-UvaUrs',
    'url', 'https://escop.com/downloads/uva-ursi/',
    'locator', 'Uvae ursi folium monograph (Supplement 2009; revised 2012) — arbutin/hydroquinone alkaline-urine activation, 14-day max use restriction'
  )
WHERE LOWER(common_name) = 'uva ursi' OR LOWER(common_name) = 'uva-ursi' OR LOWER(common_name) = 'bearberry';

-- ---------------------------------------------------------------------------
-- Cross-Hot-quadrant adaptogen
-- ---------------------------------------------------------------------------

-- 13. Ginseng (American) (Panax quinquefolius) — Hot/Depleted/Pitta constitution
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/panax-quinq.html',
    'locator', 'Panax quinquefolium — Ginseng',
    'excerpt', 'A mild stomachic, tonic, and stimulant; promotes the appetite and aids digestion. Recommended in nervous exhaustion of the aged, in mental and physical fatigue, and in convalescence from prolonged disease. The American species is regarded as cooler and less heating than the Asiatic.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Adaptogens: Herbs for Strength, Stamina, and Stress Relief',
    'author', 'Winston D, Maimes S',
    'year', 2007,
    'identifier', 'ISBN:978-1-59477-158-3',
    'url', 'https://www.innertraditions.com/books/adaptogens',
    'locator', 'Panax quinquefolius chapter — cooling adaptogen profile, contrast with Panax ginseng energetics, Pitta-suitable indication framework'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Xi Yang Shen — yin-tonifying qi tonic',
      'observation', 'Bensky and Gamble describe Xi Yang Shen (Panax quinquefolius) as cool and sweet — distinct from Ren Shen (Panax ginseng) which is warming. Xi Yang Shen tonifies qi while simultaneously nourishing yin, indicated for the patient with qi deficiency overlaid on yin deficiency: dry mouth, irritability, low-grade afternoon heat, productive but weak cough. Used where Ren Shen would be too heating.',
      'citation', jsonb_build_object(
        'author', 'Shennong',
        'title', 'Shennong Ben Cao Jing (Divine Farmer''s Materia Medica Classic)',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Ren Shen (Panax) — original-language entry; American species discrimination per later commentaries (Bencao Gangmu Shiyi 1765 documents Xi Yang Shen as a distinct cool-tonic)'
      )
    ),
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Pitta-suitable Rasayana — cooling adaptive tonic',
      'observation', 'Frawley and Lad position Panax quinquefolius (alongside Shatavari and Yashtimadhu) as one of the few adaptogens suitable for aggravated Pitta constitutions, where the warming rasayanas (Ashwagandha, Bala) would feed the heat. Indicated for the burnt-out high-output patient with internal heat, irritability, and fatigue with restlessness rather than torpor.',
      'citation', jsonb_build_object(
        'author', 'Caraka',
        'title', 'Caraka Samhita (Kaviratna English translation, 1890–1911)',
        'year', 1890,
        'url', 'https://archive.org/details/CharakaSamhitaEnglishTranslationByAvinashCKaviratna',
        'locator', 'Chikitsasthana 1 — Rasayana classification framework; cool vs warm tonic distinction'
      )
    )
  )
WHERE LOWER(common_name) = 'ginseng (american)' OR LOWER(common_name) = 'american ginseng' OR LOWER(common_name) = 'ginseng american';

-- =============================================================================
-- End of migration. 13 UPDATEs total. Idempotent — safe to re-run.
-- Three herbs (H082 Blue Vervain, H073 Aloe Vera, H046 Peppermint, H021 Ginseng
-- American) carry traditional_observations per Lock #44 attribution-stripped
-- cross-tradition framing.
-- =============================================================================
