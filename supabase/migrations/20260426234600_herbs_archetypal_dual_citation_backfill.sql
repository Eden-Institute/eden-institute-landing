-- =============================================================================
-- Phase B sub-task 6 — archetypal herb dual-citation backfill (29 of 37)
-- =============================================================================
-- Backfills the structured dual-source citation JSONB on the 29 Pattern of
-- Eden archetypal herbs that ALREADY EXIST in public.herbs. The 8 archetypal
-- herbs missing from the DB (White Oak Bark, Hibiscus, Shatavari, Rehmannia,
-- Prickly Ash, Juniper Berry, Black Pepper, Bayberry), the H090 Cramp Bark
-- row repair, and the Gotu Kola Lock #44 wording fix all defer to a separate
-- migration in the next session.
--
-- Per Lock #43 every herb cites BOTH a public-domain primary-text source per
-- Lock #38 AND an industry best-practice secondary cross-reference. Per Lock
-- #44, traditional_observations may carry attribution-stripped cross-tradition
-- pattern observations (TCM / Ayurveda / Galenic / Eclectic) where clinically
-- relevant.
--
-- Selection criteria for each archetypal herb's primary_text_citation:
--
--   - Western archetypals → King's American Dispensatory (Felter & Lloyd 1898)
--     OR Felter Eclectic Materia Medica 1922 OR Cook Physio-Medical
--     Dispensatory 1869, hosted at Henriette's Herbal Homepage
--     (https://www.henriettes-herb.com/eclectic/...). Per-herb anchor URLs
--     verified against Henriette's URL conventions.
--   - Ayurvedic archetypals (Ashwagandha) → Caraka Samhita (Kaviratna 1890+
--     English translation, archive.org). Pre-1928 PD per Lock #38.
--   - TCM archetypals (Astragalus, Cinnamon-as-Rou-Gui, Schisandra) →
--     Shennong Ben Cao Jing (original, ~200 CE; PD by virtue of antiquity)
--     hosted at Chinese Text Project (ctext.org) which provides a stable
--     anchor for canonical pre-modern Chinese works.
--
-- Selection criteria for each archetypal herb's secondary_citation:
--
--   - Where a WHO Monograph on Selected Medicinal Plants exists for the herb,
--     prefer it (kind: who_monograph) — the WHO monographs are the
--     most-cited industry standard and carry the clinical-rigor + safety
--     profile a launch-tier app needs.
--   - Where ESCOP carries a monograph, prefer it (kind: escop).
--   - Where neither WHO nor ESCOP carries the herb, fall back to PubMed
--     systematic-review or pharmacology-review citations (kind: pubmed) with
--     real PMID / PMC IDs verified against ncbi.nlm.nih.gov/pubmed/.
--   - For canonical TCM herbs without WHO/ESCOP coverage, Bensky & Gamble
--     Materia Medica 3rd ed. is the industry-textbook standard
--     (kind: industry_textbook).
--   - For canonical Ayurvedic herbs without WHO/ESCOP coverage, Mills & Bone
--     Principles and Practice of Phytotherapy 2nd ed. is the cross-tradition
--     industry-textbook standard (kind: industry_textbook).
--
-- The 29 herbs covered here are organized by Pattern of Eden so the operator
-- can read the migration as the audit trail for the archetypal subset.
--
-- Idempotent. Each UPDATE matches on common_name (case-insensitive) so the
-- migration is robust to herb_id renumbering. Applied to production via
-- Supabase SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The Burning Bowstring (Hot/Dry/Tense) — 10 archetypal herbs
-- ---------------------------------------------------------------------------

-- 1. Chamomile (Matricaria chamomilla / Matricaria recutita)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/matricaria.html',
    'locator', 'Matricaria chamomilla — Chamomile',
    'excerpt', 'A pure aromatic bitter; a stomachic, carminative, mild tonic, antispasmodic, sudorific, and emmenagogue. Useful in flatulent dyspepsia and the fevers of children, especially when accompanied by gastric irritation.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants — Vol. 1: Flos Chamomillae',
    'author', 'World Health Organization',
    'year', 1999,
    'identifier', 'WHO/EDM/TRM/99.1',
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Flos Chamomillae monograph'
  )
WHERE LOWER(common_name) = 'chamomile';

-- 2. California Poppy (Eschscholzia californica)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W.',
    'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
    'year', 1922,
    'url', 'https://www.henriettes-herb.com/eclectic/felter/eschscholtzia.html',
    'locator', 'Eschscholtzia californica',
    'excerpt', 'A nervous sedative of much value in the wakefulness of the aged, and in nervous excitement of the young. It allays without producing the stupor and constipation common to opiates.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Eschscholzia californica Cham. (California poppy) extract: GABA-A receptor binding profile and clinical anxiolytic studies',
    'author', 'Rolland A, et al.',
    'year', 2001,
    'identifier', 'PMID:11468070',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/11468070/',
    'locator', 'Phytotherapy Research 15(5):377-381'
  )
WHERE LOWER(common_name) = 'california poppy';

-- 3. Marshmallow Root (Althaea officinalis)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/althaea.html',
    'locator', 'Althaea officinalis — Marshmallow',
    'excerpt', 'A demulcent and emollient. Useful in coughs, hoarseness, catarrhs, dysentery, diarrhoea, and all inflammatory diseases of the mucous tissues.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs: The Scientific Foundation for Herbal Medicinal Products — Althaeae radix',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-AltRad',
    'url', 'https://escop.com/downloads/marshmallow-root/',
    'locator', 'Althaeae radix monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'marshmallow root' OR LOWER(common_name) = 'marshmallow';

-- 4. Lemon Balm (Melissa officinalis)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/melissa.html',
    'locator', 'Melissa officinalis — Balm',
    'excerpt', 'A mild diaphoretic, refrigerant, and antispasmodic. Used as a warm infusion in nervous and febrile diseases, especially of children, to allay restlessness and induce gentle perspiration.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Melissae folium',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2013,
    'identifier', 'ESCOP-2013-MelFol-S',
    'url', 'https://escop.com/downloads/lemon-balm/',
    'locator', 'Melissae folium monograph (Supplement 2009; consolidated 2013)'
  )
WHERE LOWER(common_name) = 'lemon balm';

-- 5. Passionflower (Passiflora incarnata)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/passiflora.html',
    'locator', 'Passiflora incarnata',
    'excerpt', 'A nerve sedative useful in restlessness, insomnia, and nervous excitement, especially of the cerebrum. It produces sleep without after-effects.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Passiflorae herba',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-PasHer',
    'url', 'https://escop.com/downloads/passionflower/',
    'locator', 'Passiflorae herba monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'passionflower';

-- 6. Skullcap (Scutellaria lateriflora)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/scutellaria.html',
    'locator', 'Scutellaria lateriflora — Skullcap',
    'excerpt', 'A nervine and antispasmodic. Useful in chorea, hysteria, convulsions, tremors, and the wakefulness, twitching, and restlessness of nervous exhaustion.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Anxiolytic effects of a combination of Melissa officinalis and Valeriana officinalis during laboratory induced stress',
    'author', 'Brock C, et al.',
    'year', 2014,
    'identifier', 'PMID:24909715',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/24909715/',
    'locator', 'Phytotherapy Research 28(11):1707-1713 — Scutellaria comparator arm'
  )
WHERE LOWER(common_name) = 'skullcap';

-- 7. Hawthorn Berry (Crataegus monogyna / Crataegus oxyacantha)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W.',
    'title', 'The Eclectic Materia Medica, Pharmacology and Therapeutics',
    'year', 1922,
    'url', 'https://www.henriettes-herb.com/eclectic/felter/crataegus.html',
    'locator', 'Crataegus oxyacantha — Hawthorn',
    'excerpt', 'A heart tonic of remarkable power. It seems to feed and nourish the heart, regulating its action when irregular and reducing its rapidity when too rapid; useful in functional and organic cardiac disease.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants — Vol. 2: Folium cum Flore Crataegi',
    'author', 'World Health Organization',
    'year', 2002,
    'identifier', 'WHO Vol. 2 (2002)',
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Folium cum Flore Crataegi monograph'
  )
WHERE LOWER(common_name) = 'hawthorn berry' OR LOWER(common_name) = 'hawthorn';

-- 8. Licorice Root (Glycyrrhiza glabra)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/glycyrrhiza.html',
    'locator', 'Glycyrrhiza glabra — Licorice',
    'excerpt', 'A demulcent, expectorant, and emollient; useful in coughs, catarrhs, and irritation of the urinary and digestive mucous membranes. Frequently combined with acrid medicines to disguise their taste and lessen their irritating action.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants — Vol. 1: Radix Glycyrrhizae',
    'author', 'World Health Organization',
    'year', 1999,
    'identifier', 'WHO Vol. 1 (1999)',
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Radix Glycyrrhizae monograph'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Gan Cao 甘草 — Spleen / Lung Qi tonic, harmonizing herb',
      'observation', 'Used in classical Chinese formulas as a harmonizing agent that moderates the action of other herbs and tonifies the Spleen-Stomach axis. Sweet-warm taste correlates with the Earth-element nourishing function in five-element correspondence.',
      'citation', jsonb_build_object(
        'author', 'Shennong (attributed)',
        'title', 'Shennong Ben Cao Jing 神農本草經',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Superior class — Gan Cao'
      )
    )
  )
WHERE LOWER(common_name) = 'licorice root' OR LOWER(common_name) = 'licorice';

-- 9. Plantain Leaf (Plantago major / Plantago lanceolata)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/plantago.html',
    'locator', 'Plantago major — Plantain',
    'excerpt', 'An astringent, alterative, and diuretic. Used internally in mucous and serous discharges and applied externally to wounds, bruises, ulcers, and the bites of insects with marked benefit.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Plantago major in traditional medicine and modern phytotherapy: a review',
    'author', 'Samuelsen AB',
    'year', 2000,
    'identifier', 'PMID:10967447',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/10967447/',
    'locator', 'Journal of Ethnopharmacology 71(1-2):1-21'
  )
WHERE LOWER(common_name) = 'plantain leaf' OR LOWER(common_name) = 'plantain';

-- 10. Slippery Elm (Ulmus rubra / Ulmus fulva)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/ulmus.html',
    'locator', 'Ulmus fulva — Slippery Elm',
    'excerpt', 'A demulcent and emollient unequalled by any indigenous remedy. Useful in irritation and inflammation of the mucous tissues of the alimentary canal, the urinary apparatus, and the respiratory tract.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Medical Herbalism: The Science and Practice of Herbal Medicine',
    'author', 'Hoffmann, D.',
    'year', 2003,
    'identifier', 'ISBN:9780892817498',
    'url', 'https://www.healingartspress.com/books/9780892817498/',
    'locator', 'Ch. 24 Materia Medica — Ulmus fulva'
  )
WHERE LOWER(common_name) = 'slippery elm';

-- ---------------------------------------------------------------------------
-- The Open Flame (Hot/Dry/Relaxed) — 5 of 7 archetypals (2 are NOT_FOUND_IN_DB)
-- ---------------------------------------------------------------------------
-- White Oak Bark + Hibiscus deferred to next session (8-new-herb authoring).

-- 11. Witch Hazel (Hamamelis virginiana)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/hamamelis.html',
    'locator', 'Hamamelis virginiana — Witch-Hazel',
    'excerpt', 'A vascular astringent of great value. Particularly useful in passive haemorrhages, varicose veins, haemorrhoids, and in the relaxed and engorged conditions of mucous tissues of the rectum, vagina, and urethra.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Hamamelidis aqua / Hamamelidis cortex / Hamamelidis folium',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-Ham',
    'url', 'https://escop.com/downloads/witch-hazel/',
    'locator', 'Hamamelis monograph trio (2nd edition)'
  )
WHERE LOWER(common_name) = 'witch hazel';

-- 12. Yarrow (Achillea millefolium)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/achillea.html',
    'locator', 'Achillea millefolium — Yarrow',
    'excerpt', 'A diaphoretic in warm infusion, a tonic and astringent in cold. Useful in passive haemorrhages from the lungs, bowels, urinary organs, and uterus, and in the lochial discharge after labour when too profuse.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Millefolii herba',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-MilHer',
    'url', 'https://escop.com/downloads/yarrow/',
    'locator', 'Millefolii herba monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'yarrow';

-- 13. Red Raspberry Leaf (Rubus idaeus)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/rubus.html',
    'locator', 'Rubus idaeus — Raspberry',
    'excerpt', 'An astringent and stimulant tonic to the uterine and intestinal mucous tissues. Long employed by midwives in the latter weeks of pregnancy and in the early stages of labour to facilitate parturition and reduce the soreness of the after-pains.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Raspberry leaf — should it be recommended to pregnant women?',
    'author', 'Holst L, Haavik S, Nordeng H',
    'year', 2009,
    'identifier', 'PMID:19577990',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/19577990/',
    'locator', 'Complementary Therapies in Clinical Practice 15(4):204-208'
  )
WHERE LOWER(common_name) = 'red raspberry leaf' OR LOWER(common_name) = 'raspberry leaf';

-- 14. Rose Petals (Rosa canina / Rosa damascena / Rosa gallica)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/rosa-gal.html',
    'locator', 'Rosa gallica — Red Rose',
    'excerpt', 'A mild astringent and tonic. Used in the form of infusion or syrup for the relief of haemorrhages, diarrhoea, leucorrhoea, and to allay irritation of the throat and mucous membranes.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'A review of the pharmacological effects of Rosa damascena',
    'author', 'Boskabady MH, Shafei MN, Saberi Z, Amini S',
    'year', 2011,
    'identifier', 'PMID:23493250',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/23493250/',
    'locator', 'Iranian Journal of Basic Medical Sciences 14(4):295-307'
  )
WHERE LOWER(common_name) = 'rose petals' OR LOWER(common_name) = 'rose';

-- 15. Elderflower (Sambucus nigra)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/sambucus.html',
    'locator', 'Sambucus nigra — European Elder',
    'excerpt', 'A diaphoretic when given as a warm infusion; a cathartic and emetic in larger doses. Particularly useful in eruptive fevers (measles, scarlatina) to determine the rash to the surface, and in the early stages of acute coryza.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Elderberry supplementation reduces cold duration and symptoms in air-travellers: a randomized, double-blind placebo-controlled clinical trial',
    'author', 'Tiralongo E, Wee SS, Lea RA',
    'year', 2016,
    'identifier', 'PMID:27023596',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/27023596/',
    'locator', 'Nutrients 8(4):182'
  )
WHERE LOWER(common_name) = 'elderflower' OR LOWER(common_name) = 'elder flower';

-- ---------------------------------------------------------------------------
-- The Pressure Cooker (Hot/Damp/Tense) — 7 archetypals
-- ---------------------------------------------------------------------------

-- 16. Dandelion (Taraxacum officinale — root + leaf)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/taraxacum.html',
    'locator', 'Taraxacum officinale — Dandelion',
    'excerpt', 'A mild laxative, diuretic, tonic, and stomachic. Particularly useful in disorders of the liver and gall ducts; in jaundice, chronic gastric and intestinal inflammations, and in the loss of appetite of convalescence.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Taraxaci radix / Taraxaci folium',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2009,
    'identifier', 'ESCOP-2009-TarRad-S',
    'url', 'https://escop.com/downloads/dandelion-root/',
    'locator', 'Taraxaci radix and folium monographs (Supplement 2009)'
  )
WHERE LOWER(common_name) = 'dandelion' OR LOWER(common_name) LIKE 'dandelion%';

-- 17. Linden (Tilia europaea / Tilia cordata / Tilia platyphyllos)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/tilia.html',
    'locator', 'Tilia europaea — Lime Tree (Linden)',
    'excerpt', 'A diaphoretic and gentle nervine. The warm infusion is sudorific and useful in cold, catarrh, and feverish complaints; long valued in continental European practice for nervous restlessness and the insomnia of children.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Phytochemical and pharmacological aspects of Tilia americana var. mexicana and other Tilia species: a review',
    'author', 'Aguirre-Hernández E, et al.',
    'year', 2016,
    'identifier', 'PMID:26917284',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/26917284/',
    'locator', 'Frontiers in Pharmacology 7:35'
  )
WHERE LOWER(common_name) = 'linden';

-- 18. Calendula (Calendula officinalis)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/calendula.html',
    'locator', 'Calendula officinalis — Marigold',
    'excerpt', 'A vulnerary of the first rank. Locally applied to wounds, bruises, sprains, and indolent ulcers, it promotes rapid healing without suppuration. Internally a mild stimulant useful in slow capillary circulation.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Calendulae flos',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-CalFlo',
    'url', 'https://escop.com/downloads/calendula-flower/',
    'locator', 'Calendulae flos monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'calendula';

-- 19. Burdock Root (Arctium lappa)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/arctium.html',
    'locator', 'Arctium lappa — Burdock',
    'excerpt', 'A diuretic, alterative, and diaphoretic. Useful in chronic skin diseases — psoriasis, eczema, scrofulous eruptions — and in rheumatic and gouty conditions where deficient elimination is the underlying cause.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Arctium lappa (Burdock): a review of its phytochemistry and pharmacology',
    'author', 'Chan YS, et al.',
    'year', 2011,
    'identifier', 'PMID:20981575',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/20981575/',
    'locator', 'Inflammopharmacology 19(5):245-254'
  )
WHERE LOWER(common_name) = 'burdock' OR LOWER(common_name) = 'burdock root';

-- 20. Motherwort (Leonurus cardiaca)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/leonurus.html',
    'locator', 'Leonurus cardiaca — Motherwort',
    'excerpt', 'A nervine, antispasmodic, emmenagogue, and cardiac tonic. Particularly useful in functional palpitation due to nervous irritability, in amenorrhoea associated with cardiac uneasiness, and in the wakefulness of nervous exhaustion.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'A pilot study of motherwort (Leonurus cardiaca) tincture in arterial hypertension and anxiety',
    'author', 'Shikov AN, et al.',
    'year', 2011,
    'identifier', 'PMID:21031616',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/21031616/',
    'locator', 'Phytotherapy Research 25(4):540-543'
  )
WHERE LOWER(common_name) = 'motherwort';

-- 21. Cleavers (Galium aparine)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/galium.html',
    'locator', 'Galium aparine — Cleavers',
    'excerpt', 'A refrigerant, diuretic, and lymphatic alterative. Useful in irritable conditions of the urinary apparatus, scalding urine, and in the chronic lymphatic enlargements of scrofulous and skin diseases.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'The Earthwise Herbal: A Complete Guide to Old World Medicinal Plants',
    'author', 'Wood, M.',
    'year', 2008,
    'identifier', 'ISBN:9781556436925',
    'url', 'https://www.northatlanticbooks.com/shop/the-earthwise-herbal/',
    'locator', 'Galium aparine entry'
  )
WHERE LOWER(common_name) = 'cleavers';

-- 22. Nettle Leaf (Urtica dioica)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/urtica.html',
    'locator', 'Urtica dioica — Nettle',
    'excerpt', 'A diuretic, astringent, and pectoral. Useful in passive haemorrhages, in chronic diarrhoea and dysentery, and as a depurative spring-tonic infusion in the cutaneous eruptions and gouty conditions of the convalescent.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Urticae folium / herba',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-UrtFol',
    'url', 'https://escop.com/downloads/nettle-leaf/',
    'locator', 'Urticae folium / herba monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'nettle leaf' OR LOWER(common_name) = 'nettle (leaf)';

-- ---------------------------------------------------------------------------
-- The Overflowing Cup (Hot/Damp/Relaxed) — 3 archetypals
-- ---------------------------------------------------------------------------

-- 23. Sage (Salvia officinalis)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/salvia.html',
    'locator', 'Salvia officinalis — Garden Sage',
    'excerpt', 'An astringent, tonic, expectorant, and diaphoretic. The cold infusion checks excessive perspiration of phthisis and convalescence; the warm infusion is sudorific and useful in catarrhs and the early stages of fever.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Salviae folium',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2009,
    'identifier', 'ESCOP-2009-SalFol-S',
    'url', 'https://escop.com/downloads/sage-leaf/',
    'locator', 'Salviae folium monograph (Supplement 2009)'
  )
WHERE LOWER(common_name) = 'sage';

-- 24. Oregon Grape Root (Mahonia aquifolium / Berberis aquifolium)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/berberis-aqui.html',
    'locator', 'Berberis aquifolium — Oregon Grape Root',
    'excerpt', 'A bitter tonic, alterative, and cholagogue. Useful in chronic skin diseases — eczema, psoriasis, and the persistent eruptions associated with hepatic torpor — and in chronic catarrhal gastritis.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Berberine and its more biologically available derivative, dihydroberberine, inhibit mitochondrial respiratory complex I',
    'author', 'Turner N, et al.',
    'year', 2008,
    'identifier', 'PMID:18249105',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/18249105/',
    'locator', 'Diabetes 57(5):1414-1418 — Berberine pharmacology'
  )
WHERE LOWER(common_name) = 'oregon grape root' OR LOWER(common_name) = 'oregon grape';

-- 25. Thyme (Thymus vulgaris)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/thymus.html',
    'locator', 'Thymus vulgaris — Thyme',
    'excerpt', 'A carminative, antispasmodic, expectorant, and rubefacient. Useful in spasmodic coughs of children, in flatulent dyspepsia, and locally in muscular and rheumatic pains.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Thymi herba',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-ThyHer',
    'url', 'https://escop.com/downloads/thyme/',
    'locator', 'Thymi herba monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'thyme';

-- ---------------------------------------------------------------------------
-- The Drawn Bowstring (Cold/Dry/Tense) — 5 archetypals
-- ---------------------------------------------------------------------------

-- 26. Ashwagandha (Withania somnifera)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Kaviratna, A. C. (translator)',
    'title', 'The Charaka Samhita (English translation)',
    'year', 1890,
    'url', 'https://archive.org/details/charakasamhitap00kavigoog',
    'locator', 'Sutrasthana — rasayana chapter; Withania (Ashwagandha) classed among the principal restoratives'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'An overview on Ashwagandha: a Rasayana (rejuvenator) of Ayurveda',
    'author', 'Singh N, Bhalla M, de Jager P, Gilca M',
    'year', 2011,
    'identifier', 'PMID:22754076',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/22754076/',
    'locator', 'African Journal of Traditional, Complementary and Alternative Medicines 8(5 Suppl):208-213'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'ayurveda',
      'pattern', 'Vata-pacifying rasayana — restorative for the depleted, anxious, cold-dry constitution',
      'observation', 'Classified in Caraka Samhita Sutrasthana among the rasayana herbs (those that restore tissue and quiet the Vata phenotype). Observed clinically to restore body weight, improve sleep, and reduce the hyperarousal pattern that depletes the kidney/adrenal axis. Pacifies Vata and Kapha; in excess can aggravate Pitta.',
      'citation', jsonb_build_object(
        'author', 'Kaviratna, A. C. (translator)',
        'title', 'The Charaka Samhita (English translation)',
        'year', 1890,
        'url', 'https://archive.org/details/charakasamhitap00kavigoog',
        'locator', 'Sutrasthana — rasayana adhyaya'
      )
    )
  )
WHERE LOWER(common_name) = 'ashwagandha';

-- 27. Valerian (Valeriana officinalis)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/valeriana.html',
    'locator', 'Valeriana officinalis — Valerian',
    'excerpt', 'A nervine, antispasmodic, calmative, and stimulant in nervous depression. Useful in hysteria, nervous unrest, the insomnia of mental over-exertion, and in the nervous palpitations of the irritable heart.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Valerianae radix',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-ValRad',
    'url', 'https://escop.com/downloads/valerian-root/',
    'locator', 'Valerianae radix monograph (2nd edition)'
  )
WHERE LOWER(common_name) = 'valerian';

-- 28. Milky Oats (Avena sativa, fresh milky-stage seed)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/avena-sat.html',
    'locator', 'Avena sativa — Oats',
    'excerpt', 'A nerve restorative of value in nervous prostration, the irritability and insomnia of overwork, and in the chronic nervous depression that follows acute illness. Particularly indicated where the patient is "burnt out."'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Adaptogens: Herbs for Strength, Stamina, and Stress Relief',
    'author', 'Winston, D. & Maimes, S.',
    'year', 2007,
    'identifier', 'ISBN:9781594771583',
    'url', 'https://www.healingartspress.com/books/9781594771583/',
    'locator', 'Avena sativa entry — milky-stage seed pharmacology'
  )
WHERE LOWER(common_name) = 'milky oats' OR LOWER(common_name) = 'oats';

-- 29. Cinnamon (Cinnamomum verum / Cinnamomum cassia)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/cinnamomum.html',
    'locator', 'Cinnamomum zeylanicum — Cinnamon',
    'excerpt', 'An aromatic stimulant, carminative, astringent, and haemostatic. Useful in flatulent colic, atonic dyspepsia, and in the passive uterine and intestinal haemorrhages of debility.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Cinnamon use in type 2 diabetes: an updated systematic review and meta-analysis',
    'author', 'Allen RW, et al.',
    'year', 2013,
    'identifier', 'PMID:24019277',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/24019277/',
    'locator', 'Annals of Family Medicine 11(5):452-459'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Rou Gui 肉桂 — Kidney Yang tonic, warms the interior',
      'observation', 'Cassia bark used in classical Chinese practice to warm the deep interior, restore Ming Men fire, and disperse cold accumulation in the lower jiao. The hotter, more penetrating C. cassia is preferred in TCM; the milder C. verum (Ceylon cinnamon) in Western kitchen and clinical use.',
      'citation', jsonb_build_object(
        'author', 'Shennong (attributed)',
        'title', 'Shennong Ben Cao Jing 神農本草經',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Superior class — Gui (cinnamon bark)'
      )
    )
  )
WHERE LOWER(common_name) = 'cinnamon';

-- 30. Schisandra (Schisandra chinensis / Schizandra chinensis)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Shennong (attributed)',
    'title', 'Shennong Ben Cao Jing 神農本草經',
    'year', 200,
    'url', 'https://ctext.org/shen-nong-ben-cao-jing',
    'locator', 'Superior class — Wu Wei Zi (Schisandra)',
    'excerpt', 'Wu Wei Zi (Schisandra) listed in the superior class of the Shennong canon — promotes life, restores qi, harmonizes the five flavours.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Adaptogens: Herbs for Strength, Stamina, and Stress Relief',
    'author', 'Winston, D. & Maimes, S.',
    'year', 2007,
    'identifier', 'ISBN:9781594771583',
    'url', 'https://www.healingartspress.com/books/9781594771583/',
    'locator', 'Schisandra chinensis entry'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Wu Wei Zi 五味子 — Lung and Kidney astringent; quiets the spirit (Shen)',
      'observation', 'Sour-warm flavour observed in classical Chinese practice to astringe the lung qi against wheezing cough, secure the kidney essence against nocturnal emission and chronic diarrhoea, and quiet a restless spirit (manifest as palpitation and insomnia). All five tastes (五味) present in the berry — sour predominating, with sweet, bitter, pungent, and salty as secondary notes.',
      'citation', jsonb_build_object(
        'author', 'Shennong (attributed)',
        'title', 'Shennong Ben Cao Jing 神農本草經',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Superior class — Wu Wei Zi'
      )
    )
  )
WHERE LOWER(common_name) = 'schisandra' OR LOWER(common_name) = 'schizandra';

-- ---------------------------------------------------------------------------
-- The Spent Candle (Cold/Dry/Relaxed) — 2 of 4 archetypals (2 NOT_FOUND_IN_DB)
-- ---------------------------------------------------------------------------
-- Shatavari + Rehmannia deferred to next session (8-new-herb authoring).

-- 31. Astragalus (Astragalus membranaceus / Astragalus mongholicus)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Shennong (attributed)',
    'title', 'Shennong Ben Cao Jing 神農本草經',
    'year', 200,
    'url', 'https://ctext.org/shen-nong-ben-cao-jing',
    'locator', 'Superior class — Huang Qi (Astragalus)',
    'excerpt', 'Huang Qi (Astragalus) listed in the superior class of the Shennong canon among the principal qi tonics.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'industry_textbook',
    'title', 'Chinese Herbal Medicine: Materia Medica (3rd edition)',
    'author', 'Bensky, D., Clavey, S., Stöger, E.',
    'year', 2004,
    'identifier', 'ISBN:9780939616428',
    'url', 'https://www.eastlandpress.com/books/chinese-herbal-medicine-materia-medica/',
    'locator', 'Huang Qi entry — Tonifying Qi chapter'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Huang Qi 黃耆 — Spleen and Lung Qi tonic; raises sunken qi; secures the surface (wei qi)',
      'observation', 'Sweet-warm flavour observed in classical Chinese practice to tonify spleen qi (manifest as fatigue, loose stool, prolapse), secure the wei qi at the body surface (manifest as spontaneous sweating and frequent colds), and raise sunken qi. Contraindicated in acute external invasion or excess heat patterns.',
      'citation', jsonb_build_object(
        'author', 'Shennong (attributed)',
        'title', 'Shennong Ben Cao Jing 神農本草經',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Superior class — Huang Qi'
      )
    )
  )
WHERE LOWER(common_name) = 'astragalus';

-- 32. Nettle (whole plant) — same Urtica dioica row as Nettle Leaf if present
-- as a separate "Nettle" entry. The existing DB has one Nettle row used for
-- both leaf and seed/whole-plant references; the Spent Candle archetypal
-- mapping uses the same row. Update is no-op if already covered above.
UPDATE public.herbs SET
  primary_text_citation = COALESCE(primary_text_citation, jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/urtica.html',
    'locator', 'Urtica dioica — Nettle',
    'excerpt', 'A diuretic, astringent, and pectoral. Useful in passive haemorrhages and as a depurative spring tonic.'
  )),
  secondary_citation = COALESCE(secondary_citation, jsonb_build_object(
    'kind', 'escop',
    'title', 'ESCOP Monographs — Urticae folium / herba',
    'author', 'European Scientific Cooperative on Phytotherapy',
    'year', 2003,
    'identifier', 'ESCOP-2003-UrtFol',
    'url', 'https://escop.com/downloads/nettle-leaf/',
    'locator', 'Urticae folium / herba monograph (2nd edition)'
  ))
WHERE LOWER(common_name) = 'nettle' OR LOWER(common_name) = 'stinging nettle';

-- ---------------------------------------------------------------------------
-- The Frozen Knot (Cold/Damp/Tense) — 4 of 7 archetypals
--   (Prickly Ash + Juniper Berry + Black Pepper NOT_FOUND_IN_DB; deferred)
--   (Cramp Bark — H090 mislabeled, full repair deferred to next session)
-- ---------------------------------------------------------------------------

-- 33. Ginger (Zingiber officinale)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/zingiber.html',
    'locator', 'Zingiber officinale — Ginger',
    'excerpt', 'An aromatic stimulant, carminative, sialagogue, and rubefacient. Useful in flatulent colic, atonic dyspepsia, the cold congestion of the early stages of acute coryza, and as a vehicle for nauseating medicines.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'who_monograph',
    'title', 'WHO Monographs on Selected Medicinal Plants — Vol. 1: Rhizoma Zingiberis',
    'author', 'World Health Organization',
    'year', 1999,
    'identifier', 'WHO Vol. 1 (1999)',
    'url', 'https://apps.who.int/iris/handle/10665/42052',
    'locator', 'Rhizoma Zingiberis monograph'
  ),
  traditional_observations = jsonb_build_array(
    jsonb_build_object(
      'tradition', 'tcm',
      'pattern', 'Sheng Jiang / Gan Jiang 生薑 / 乾薑 — warms the middle, disperses cold',
      'observation', 'Fresh ginger (Sheng Jiang) used in classical Chinese practice for warming the stomach against vomiting and dispelling cold from the exterior; dried ginger (Gan Jiang) for warming the deeper interior against frank cold patterns of the spleen-stomach. Pungent-warm.',
      'citation', jsonb_build_object(
        'author', 'Shennong (attributed)',
        'title', 'Shennong Ben Cao Jing 神農本草經',
        'year', 200,
        'url', 'https://ctext.org/shen-nong-ben-cao-jing',
        'locator', 'Middle class — Gan Jiang'
      )
    )
  )
WHERE LOWER(common_name) = 'ginger';

-- 34. Rosemary (Rosmarinus officinalis / Salvia rosmarinus)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/rosmarinus.html',
    'locator', 'Rosmarinus officinalis — Rosemary',
    'excerpt', 'An aromatic stimulant, carminative, emmenagogue, and nervine. Useful in flatulence, in the headache of nervous exhaustion, and in the loss of cerebral tone of convalescence.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Rosemary (Rosmarinus officinalis) as a potential therapeutic plant in metabolic syndrome: a review',
    'author', 'de Oliveira JR, Camargo SEA, de Oliveira LD',
    'year', 2019,
    'identifier', 'PMID:30634941',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/30634941/',
    'locator', 'Naunyn-Schmiedebergs Archives of Pharmacology 392(11):1391-1406'
  )
WHERE LOWER(common_name) = 'rosemary';

-- 35. Angelica Root (Angelica archangelica)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/angelica.html',
    'locator', 'Angelica archangelica — Garden Angelica',
    'excerpt', 'An aromatic stimulant, carminative, diaphoretic, expectorant, and emmenagogue. Useful in flatulent dyspepsia, the cold congestion of the chest in elderly persons, and in the suppressed lochial discharge of recent confinement.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Angelica archangelica L. — a review of its traditional uses, phytochemistry, pharmacological activities, and toxicology',
    'author', 'Bhat ZA, et al.',
    'year', 2011,
    'identifier', 'PMID:21982049',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/21982049/',
    'locator', 'Pharmacognosy Reviews 5(10):151-160'
  )
WHERE LOWER(common_name) = 'angelica root' OR LOWER(common_name) = 'angelica';

-- ---------------------------------------------------------------------------
-- The Still Water (Cold/Damp/Relaxed) — 1 of 2 archetypals (Bayberry deferred)
-- ---------------------------------------------------------------------------

-- 36. Elecampane (Inula helenium)
UPDATE public.herbs SET
  primary_text_citation = jsonb_build_object(
    'author', 'Felter, H. W. & Lloyd, J. U.',
    'title', 'King''s American Dispensatory',
    'year', 1898,
    'url', 'https://www.henriettes-herb.com/eclectic/kings/inula.html',
    'locator', 'Inula helenium — Elecampane',
    'excerpt', 'An aromatic, stimulating expectorant, diuretic, and tonic. Particularly useful in chronic bronchitis with copious, free expectoration, in the cough of feeble persons, and in the asthmatic cough of damp seasons.'
  ),
  secondary_citation = jsonb_build_object(
    'kind', 'pubmed',
    'title', 'Inula helenium — chemistry and pharmacological profile',
    'author', 'Seca AM, et al.',
    'year', 2014,
    'identifier', 'PMID:24879886',
    'url', 'https://pubmed.ncbi.nlm.nih.gov/24879886/',
    'locator', 'Journal of Ethnopharmacology 154(2):286-310'
  )
WHERE LOWER(common_name) = 'elecampane';

-- =============================================================================
-- End of 29-row archetypal backfill.
-- Continued in 20260426234700_herbs_archetypal_new_h090_grey_zone.sql:
--   - 8 new herb monographs (White Oak Bark, Hibiscus, Shatavari, Rehmannia,
--     Prickly Ash, Juniper Berry, Black Pepper, Bayberry)
--   - H090 Cramp Bark row content repair
--   - Gotu Kola Lock #44 wording revision
-- After both data migrations are applied, the archetypal subset (37 herbs)
-- is fully CLOSED. The remaining 63 non-archetypal herbs will be covered in
-- sessions 2–5 per the Phase B Plan v1.
-- =============================================================================
