-- Install verified pre-1900 citations for 12 herbs, and re-scope Shankhpushpi.
--
-- CONTEXT. The 17-herb deep audit (verifier + adversarial challenger, every challenge
-- upheld) found real pre-1900 sources to replace the fabricated/forbidden citations that
-- were stripped in #348 and #347, or that were hidden by the render guard. Founder
-- approved the full set 2026-07-22 ("approve all").
--
-- VERIFICATION. Every source installed here was opened and read by me directly before
-- this migration was written, not taken on the agents' word:
--   - Bencao Gangmu juan 14 (Dong Quai) and juan 18下 (Manjistha) on zh.wikisource:
--     confirmed the herb entry, and for Dong Quai confirmed 崩中 (flooding) sits among
--     INDICATIONS with zero contraindication markers, i.e. the fabricated
--     "avoid in excessive menses" was backwards.
--   - Kaviratna 1890 Charaka (archive.org/details/BIUSante_47357, 4.9 MB): confirmed the
--     item is real and contains the Shankhpushpi/Canscora/Medhakara passage.
--   - Dutt 1877 (materiamedicaofh00duttuoft): confirmed the item and the verbatim
--     Gokshura (p.125), Kutaj, Chitrak and Amla passages.
--   - Dymock Pharmacographia Indica, three scans: confirmed each item and the Gymnema
--     (sweet-taste-abolition), Bakuchi (hot-and-dry, leprosy) and Hibiscus
--     (emollient/demulcent/acid) passages.
--
-- THE STANDING RULE ON UNSUPPORTED VALUES. Where a taste/temperature/moisture value has
-- no pre-1900 source, it is NOT nulled — the #342 disclaimer already tells readers such
-- values reflect modern consensus. It is simply not cited to the new source. Each new
-- citation's locator states what it does and does not carry, so no value is laundered
-- through a source that never stated it.
--
-- HELD BACK, deliberately, not shipped here:
--   - Guggul (H138): its author field wrongly reads "Charaka Samhita" over a Bhavaprakasha
--     citation, and its moisture "Dry" is contradicted by the source (fresh resin is
--     unctuous). The two agent suggestions differ and I did not personally open the
--     Bhavaprakasha item. Needs its own verified pass.
--   - Boswellia (H084): no pre-1900 source supports its energetics. Dutt gives identity
--     only, so citing him for the claim would be a category error. Stays null (from #348),
--     card falls back to prose.

begin;

-- ===========================================================================
-- 1. DONG QUAI (H092) — Bencao Gangmu 1596. Primary was nulled in #348.
--    Personally verified: 當歸 entry, 崩中 among indications, no contraindication markers.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Li Shizhen 李時珍',
  'title','Bencao Gangmu 本草綱目 (Compendium of Materia Medica)',
  'year',1596,
  'url','https://zh.wikisource.org/wiki/本草綱目_(四庫全書本)/卷14',
  'locator','卷14 草部三 芳草類, 當歸 (first entry). 氣味/主治. SCOPE: carries taste (sweet, pungent), temperature (warm), moistening action, and the tonify-and-move-blood use. The source lists 崩中 (flooding) as an INDICATION, which is why the previously stored "avoid where menses are excessive" was removed as contradicting the cited text.',
  'excerpt','甘、辛，溫，無毒 … 主治 … 崩中，補諸不足（甄權）… 和血補血（時珍）。 [Sweet, pungent, warm, non-toxic … treats … flooding, supplements all insufficiencies (Zhen Quan) … harmonizes and supplements the blood (Li Shizhen).]'
)
where herb_id='H092' and primary_text_citation is null;

-- ===========================================================================
-- 2. TURMERIC (H060) — Kaviratna 1890 Charaka. Primary was nulled in #348.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
  'title','Charaka-Samhita, translated into English',
  'year',1890,
  'url','https://archive.org/details/BIUSante_47357',
  'locator','Chikitsasthana VI (Treatment of Prameha) v.25, p.1199; and Sutrasthana IV v.19 (Kusthaghna group). SCOPE: carries the prameha and skin-disease indications only. Does NOT carry taste/temperature/moisture, which the source does not state for Haridra.',
  'excerpt','He should take the paste of Haridra (turmeric) with the expressed juice of the fruits of Amalaka, and honey. … Khadira, Abhaya, Amlaka, Haridra … these ten are Kusthaghna [cure skin-diseases].'
)
where herb_id='H060' and primary_text_citation is null;

-- ===========================================================================
-- 3. GYMNEMA (H099) — Dymock 1890 Pharmacographia Indica II. Primary nulled in #348.
--    The diabetes/madhumeha claim is NOT in Dymock and stays only in the modern secondary.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Dymock W, Warden CJH, Hooper D',
  'title','Pharmacographia Indica, Vol. II',
  'year',1890,
  'url','https://archive.org/details/b2129737x_0002',
  'locator','Gymnema sylvestre, Order Asclepiadeae, pp.451-455. SCOPE: carries identity (Meshasringi), the astringent-bitter stomachic profile, and the sugar-taste-abolition property (Gymnemic acid). Does NOT carry the diabetes/madhumeha indication, which is modern and lives in the secondary citation.',
  'excerpt','…described as having a pungent taste and the properties of an astringent and bitter stomachic; useful in cough, biliousness, boils, sore eyes, &c. … if chewed it destroys the power of the tongue to appreciate the taste of sugar and all saccharine substances.'
)
where herb_id='H099' and primary_text_citation is null;

-- ===========================================================================
-- 4. AMALAKI (H125) — Kaviratna 1890 + Dutt 1877. Replaces forbidden API-of-India.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
  'title','Charaka-Samhita, translated into English',
  'year',1890,
  'url','https://archive.org/details/BIUSante_47357',
  'locator','Sutrasthana XXVI p.316 (cooling energy); Sutrasthana XXV p.279 (foremost vayahsthapana/rasayana); corroborated by Dutt 1877 p.226 (materiamedicaofh00duttuoft): "The fresh juice is cooling, refrigerant, diuretic and laxative." SCOPE: carries Cool and the rasayana use. Does NOT carry the "five of six tastes" string, a Bhavaprakasha doctrine with no pre-1900 English source located.',
  'excerpt','…Amalaka (Phyllanthus Emblica), though possessed of a sour taste, is not of heating energy. … Of all medicines for preventing the marks of age, the foremost is Amalaka.'
)
where herb_id='H125' and primary_text_citation->>'year' = 'classical';

-- ===========================================================================
-- 5. BAKUCHI (H296) — Dymock 1890. Also delete unsupported pregnancy clause and
--    strip the unsupported Charaka/Sushruta species attribution.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Dymock W, Warden CJH, Hooper D',
  'title','Pharmacographia Indica, Vol. I',
  'year',1890,
  'url','https://archive.org/details/mobot31753000263365',
  'locator','Psoralia corylifolia, Leguminosae, pp.412-414. SCOPE: carries identity (seeds), the kushtha/leukoderma use (epithet Kushta-nasini), and Warm/Dry ("hot and dry, or according to some, cold and dry"). Carries NO emmenagogue or gynecological action, and NO attribution to Charaka or Sushruta.',
  'excerpt','Native works on Materia Medica describe the seeds as hot and dry … recommended in leprosy, and other chronic skin diseases … whence the synonym Kushta-nasini.'
)
where herb_id='H296' and primary_text_citation->>'year' = 'classical';

-- Explicit set (not regex) on this safety field: remove only the unsupported
-- emmenagogue clause, leave the phototoxic/hepatotoxic basis of the Avoid verdict intact.
update public.herbs
set pregnancy_safety = 'Avoid. The photoactive furanocoumarins (psoralens) are phototoxic and, when activated by light, genotoxic and mutagenic in test systems; the seed is a documented hepatotoxin. There are no adequate human safety data in pregnancy. Do not use internally or topically in pregnancy. Sources: AHPA Botanical Safety Handbook (2nd ed., Psoralea corylifolia); LiverTox (NIH), Psoralen; Psoralea corylifolia toxicology review (PMC9830135).'
where herb_id='H296' and pregnancy_safety ilike '%emmenagogue%';

-- ===========================================================================
-- 6. CHITRAK (H300) — Kaviratna 1890 + Dutt 1877. Replaces forbidden API.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
  'title','Charaka-Samhita, translated into English',
  'year',1890,
  'url','https://archive.org/details/BIUSante_47357',
  'locator','Sutrasthana XXVI p.320 (pungent taste, pungent vipaka, hot energy); Sutrasthana XXV p.278 (foremost appetite-provoking, anti-haemorrhoidal); corroborated by Dutt 1877 pp.185-186. SCOPE: carries Pungent, Hot, and the digestive-stimulant/caustic action. Does NOT carry "Bitter" taste or "Dry" moisture.',
  'excerpt','Chitraka (Plumbago Zeylanica) is pungent in taste, and pungent in assimilation, and hot in energy. … the foremost is the root of Chitraka. [Dutt: THE root of Plumbago Zeylanica is said to increase the digestive power, to promote the appetite…]'
)
where herb_id='H300' and primary_text_citation->>'year' = 'classical';

-- ===========================================================================
-- 7. GOKSHURA (H147) — Dutt 1877 p.125. Personally verified verbatim. Replaces API.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Dutt UC',
  'title','The Materia Medica of the Hindus',
  'year',1877,
  'url','https://archive.org/details/materiamedicaofh00duttuoft',
  'locator','Tribulus terrestris (Gokshura), Nat. Order Zygophyllaceae, p.125. SCOPE: carries Cool, the urinary/calculous indication, and the tonic/aphrodisiac action. Does NOT carry "Moist", "demulcent", "Sweet/madhura" taste, or any Chinese Bai Ji Li attribution.',
  'excerpt','…regarded as cooling, diuretic, tonic and aphrodisiac and are used in painful micturition, calculous affections, urinary disorders and impotence.'
)
where herb_id='H147' and primary_text_citation->>'year' = 'classical';

-- ===========================================================================
-- 8. KUTAJ (H223) — Kaviratna 1890 + Dutt 1877. Personally verified. Replaces API.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
  'title','Charaka-Samhita, translated into English',
  'year',1890,
  'url','https://archive.org/details/BIUSante_47357',
  'locator','Sutrasthana XXV p.280 (Kutaja bark as foremost drying/secretion-checking agent); corroborated by Dutt 1877 pp.192-194 (materiamedicaofh00duttuoft): "The bark of Holarrhena antidysenterica constitutes the principal medicine for dysentery in the Hindu Pharmacopaeia." SCOPE: carries Dry, astringent, bowel-firming, and the dysentery indication.',
  'excerpt','Of all things that … dry up these elements, the foremost is the bark of Kutaja (Holarrhena antidysenterica).'
)
where herb_id='H223' and primary_text_citation->>'year' = 'classical';

-- ===========================================================================
-- 9. KUTKI (H289) — Kaviratna 1890. Personally-verifiable item. Replaces API.
--    Also delete the FALSE "Bhedaniya" group claim from the prose sources.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
  'title','Charaka-Samhita, translated into English',
  'year',1890,
  'url','https://archive.org/details/BIUSante_47357',
  'locator','Sutrasthana IV (the fifty groups): Katuka in the Lekhaniya and Stanyashodhana groups and the Group of Bitters; energetics from the bitter-taste chapter, "Its attributes are dry, cool, and light." SCOPE: carries identity (Katuka = Picrorhiza kurroa), Bitter, Cold, Dry, and three group placements. Does NOT support "Bhedaniya", which the same chapter contradicts, or a pungent vipaka.',
  'excerpt','[Katurohini/Katuka] … these ten are Lekhaniya. … Its attributes are dry, cool, and light.'
)
where herb_id='H289' and primary_text_citation->>'year' = 'classical';

update public.herbs
set primary_sources = regexp_replace(primary_sources, 'Bhedaniya,?\s*', '', 'g')
where herb_id='H289' and primary_sources ilike '%Bhedaniya%';

-- ===========================================================================
-- 10. VIDANGA (H210) — was CONFIRMED verbatim; only the pointer needed repair.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
  'title','Charaka-Samhita, translated into English',
  'year',1890,
  'url','https://archive.org/details/BIUSante_47357',
  'locator','Sutrasthana IV p.35 (Vidanga in the Krimighna/anthelmintic group of ten); Sutrasthana XXV p.279 (foremost of anthelmintics). SCOPE: carries identity (Embelia ribes) and the anthelmintic use. Taste/temperature/moisture have no pre-1900 carrier and are not asserted by this citation.',
  'excerpt','…Vidanga … these ten are Krimighna [anthelmintic]. … Of all things used as anthelmintics, the foremost are Vidanga (the seeds of Embelia Ribes).'
)
where herb_id='H210'
  and (primary_text_citation->>'year' = 'classical'
       or primary_text_citation->>'title' ilike '%Ayurvedic Pharmacopoeia%'
       or primary_text_citation->>'url' is null
       or primary_text_citation->>'url' = '');

-- ===========================================================================
-- 11. MANJISTHA (H206) — keep the Charaka leg, replace the post-1900 Bhavaprakasha
--     translation leg with Zhenglei Bencao 1108 + Bencao Gangmu 1596, and RESTORE the
--     cataract look-alike warning I personally verified in juan 18下.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Caraka (Kaviratna trans.) with Zhenglei Bencao 1108 / Bencao Gangmu 1596',
  'title','Charaka-Samhita (Sutrasthana 4) with the Chinese qian/madder record',
  'year',1108,
  'url','https://zh.wikisource.org/wiki/證類本草_(四庫全書本)/卷07',
  'locator','Charaka Sutrasthana 4 (Varnya/Vishaghna groups, Kaviratna, archive.org/details/BIUSante_47357); Zhenglei Bencao 1108 卷7 茜根; Bencao Gangmu 1596 卷18下 茜草 (氣味: 苦寒). Replaces the post-1900 Srikantha Murthy 2001 translation of Bhavaprakasha. Temperature Cool now rests on the Chinese 苦寒; the Ayurvedic ushna reading is a genuine cross-tradition disagreement, not an error.',
  'excerpt','茜草 氣味苦寒無毒 [madder: bitter, cold, non-toxic] (Bencao Gangmu 卷18下).'
)
where herb_id='H206'
  and (primary_text_citation->>'title' ilike '%Srikantha Murthy%'
       or primary_text_citation->>'title' ilike '%Bhavaprakasha%'
       or primary_text_citation->>'year' = 'classical');

update public.herbs
set adulterant_warnings = COALESCE(NULLIF(btrim(adulterant_warnings),'') || ' | ', '') ||
  'Zhenglei Bencao (1108) and Bencao Gangmu (1596) warn that a look-alike root, 赤柳草根 (red-willow-grass root), closely resembles genuine madder/qian root and differs only in a sour-astringent taste; taken in error it causes 内障眼 (cataract, internal obstruction of the eye), for which licorice-root water is the classical antidote. This is a warning about a SUBSTITUTED root, not a property of Rubia cordifolia and not an eye indication.'
where herb_id='H206'
  and (adulterant_warnings is null or adulterant_warnings not ilike '%内障%');

update public.herbs
set preparation_doctrine = COALESCE(NULLIF(btrim(preparation_doctrine),''),
  'Cut with a copper knife on a locust-wood block and sun-dry; never let the root touch iron or lead (Zhenglei Bencao 1108; 忌鐵 echoed in Ben Cao Cong Xin 1757).')
where herb_id='H206' and (preparation_doctrine is null or btrim(preparation_doctrine)='');

update public.herbs
set drug_incompatibilities = COALESCE(NULLIF(btrim(drug_incompatibilities),''),
  '畏鼠姑 (fears/counteracted by Shu Gu) — Bencao Gangmu 卷18下, 之才曰.')
where herb_id='H206' and (drug_incompatibilities is null or btrim(drug_incompatibilities)='');

-- ===========================================================================
-- 12. SHANKHPUSHPI (H238) — FOUNDER OPTION A: re-scope to Canscora decussata, the
--     species Charaka's verbatim text names. Personally verified: BIUSante_47357
--     contains "Canscora"/"Pladera" and NOT "Convolvulus pluricaulis".
-- ===========================================================================
update public.herbs
set latin_name = 'Canscora decussata (syn. Pladera decussata)',
    primary_text_citation = jsonb_build_object(
      'author','Caraka; trans. Kaviraj Avinash Chandra Kaviratna',
      'title','Charaka-Samhita, translated into English',
      'year',1890,
      'url','https://archive.org/details/BIUSante_47357',
      'locator','Chikitsasthana I.3, "Medhakara Rasayana" (rasayana that invigorates the understanding), vv.34-35, p.1049. Gangadhara identifies Śaṅkhapushpi as Canscora decussata (syn. Pladera decussata). SCOPE: carries the medhya/intellect-promoting use and the botanical identity. Does NOT carry the row''s prior taste/temperature/moisture values.',
      'excerpt','The paste of the roots and blossoms of Çankhapushpi (Pladera decussata) … especially conduces to strength of understanding.'
    ),
    notes = COALESCE(NULLIF(btrim(notes),'') || ' | ', '') ||
      'IDENTITY 2026-07-22: re-scoped from Convolvulus pluricaulis to Canscora decussata, the species Charaka''s text actually names (Kaviratna 1890; Gangadhara commentary). Convolvulus pluricaulis has no pre-1900 medicinal source. The name Shankhpushpi is historically applied to at least four species, so what a supplier ships under that name may differ from this monograph.'
where herb_id='H238'
  and latin_name ilike '%Convolvulus%';

-- ===========================================================================
-- 13. HIBISCUS (H102) — Dymock 1890 as primary; move the 2023 Egyptian regulator out
--     of the primary prose; amend the energetics_summary to drop unsupported claims.
-- ===========================================================================
update public.herbs
set primary_text_citation = jsonb_build_object(
  'author','Dymock W, Warden CJH, Hooper D',
  'title','Pharmacographia Indica, Vol. I',
  'year',1890,
  'url','https://archive.org/details/b20413415_001',
  'locator','Hibiscus Sabdariffa (OCR "SUBDARIFFA"), Order Malvaceae, pp.212-213. SCOPE: carries Sour ("acid"), Astringent, and Moist ("emollient", "demulcent"). "Cool" is a humoral inference from the bilious-conditions use, not verbatim. Does NOT carry hypertension or urinary drainage, which are modern and belong in the secondary.',
  'excerpt','The fleshy red calyx is used … as an acid article of diet like tamarinds. … the leaves are emollient. … the emollient and demulcent properties of the Malvaceae combined with a large amount of acidity…'
)
where herb_id='H102'
  and (primary_text_citation->>'author' ilike '%Grieve%'
       or primary_text_citation->>'title' ilike '%Egyptian%');

update public.herbs
set primary_sources = 'Dymock, Warden & Hooper, Pharmacographia Indica Vol. I (1890), pp.212-213. Modern: Egyptian Drug Authority, Egyptian Herbal Monograph Vol.1 (2023), and clinical hypertension trials — carried as modern evidence, not as a historical primary source.'
where herb_id='H102' and primary_sources ilike '%Egyptian Herbal Monograph%';

-- Explicit set (not regex): drop only "hypertensive" and the urine-drainage clause,
-- both unsupported pre-1900, keeping the sour/astringent/cooling description that is.
update public.herbs
set energetics_summary = 'Cool, moist, sour-astringent refrigerant: the tart crimson calyx that cools and tones hot, plethoric terrain and quenches the thirst of high summer.'
where herb_id='H102'
  and (energetics_summary ilike '%hypertensive terrain%' or energetics_summary ilike '%drains damp-heat through the urine%');

commit;
