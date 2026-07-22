-- Columns for the classical energetics the pre-1900 materia medica carries and
-- this schema has nowhere to put, plus the first written definition of what the
-- existing energetics columns actually mean.
--
-- SCHEMA ONLY. No row is populated here, deliberately. A QC pass harvested 743
-- candidate facts from pre-1900 sources, and those are in the repo as a review
-- artifact awaiting verification. Loading them straight in would repeat, at
-- scale, exactly the failure that migration 20260721170000 had to undo: four
-- herb citations whose quoted text was not in the work it named. The columns
-- come first; the content comes after someone has checked it.
--
-- ── THE WORLDVIEW FILTER GOVERNS EVERY COLUMN BELOW ───────────────────────
-- Lock #14 + Lock #44, restated by the founder 2026-07-22: take the observations
-- and diagnoses these frameworks got right, discard any spiritual attribution,
-- filter everything through a Biblical worldview. "That is the hardest lock of
-- the entire thing." Full test and worked examples: docs/worldview-filter.md.
--
-- The test: does the claim describe what the body or the herb is DOING, or does
-- it claim where life comes from and what humans are for? The first is an
-- observation, take it. The second is attribution, discard it. Discarding the
-- attribution is NOT discarding the source: we still cite who observed what.
--
-- TWO PROPOSED COLUMNS DID NOT SURVIVE THIS TEST, and they were the two the
-- research pass was most enthusiastic about. That is worth recording, because
-- the failure mode here is not malice, it is enthusiasm.
--
-- 1. channel_entry: DROPPED, not merely renamed.
--    歸經 was proposed as the most distinctive addition in the whole harvest.
--    But its observational half is ALREADY IN THIS TABLE: astragalus
--    入手足太陰氣分 names Lung and Spleen, and system_affinity already reads
--    "Immune, Cardiovascular, Lungs, Spleen". What a channel_entry column would
--    add beyond that is the meridian model itself, which asserts that qi travels
--    in named channels. The content IS the cosmology. Where a classical source
--    names a site of action this table is missing, it belongs in
--    system_affinity, not in a new column that carries the framework with it.
--
-- 2. shennong_grade -> traditional_use_duration: RENAMED AND REFRAMED.
--    The Shennong Bencao Jing (c. 200 CE) sorts drugs into three grades, and the
--    grade does encode a real observation: after centuries of use some plants
--    were found non-toxic and safe to take for long periods, and others toxic
--    and reserved for acute attack. That observation is exactly what this brand
--    exists to recover, and it bears directly on a product recommending daily
--    herbs. Dong Quai, widely treated as a daily women's tonic, is in the
--    corrective class and carries no prolonged-use formula.
--    What did NOT survive is the framing. The upper grade is defined by
--    久服輕身延年, "prolonged use lightens the body and extends years", and 輕身 is
--    Daoist immortality-cultivation vocabulary. The three tiers are
--    養命 / 養性 / 治病, nourishing destiny / nourishing nature / treating disease,
--    so the top tier is a claim about transcendence rather than health. The
--    column is therefore named for what it OBSERVES (duration and toxicity), the
--    values state duration rather than rank, and the Shennong provenance stays in
--    the comment as a historical attribution, not an endorsement.
--
-- preparation_doctrine
--   Repeatedly the classical vehicle is not the shipped form. Ashwagandha's is
--   fat and milk, not water and not a capsule. Rehmannia takes nine steamings
--   and nine sun-dryings and must never meet copper or iron. Bupleurum must not
--   meet fire "or it is instantly without effect".
--
-- classical_contraindications · drug_incompatibilities · positive_pairings ·
-- dietary_avoidances
--   FOUR fields, not one, and this is the correction that matters most here.
--   The table has no contraindication column at all, and the obvious move is to
--   add one. That would be wrong: the classical text destined for it is BUNDLED,
--   and a Chinese source keeps four things carefully apart that a single field
--   would collapse.
--
--   A decomposition of 294 verified clauses came out:
--     108 (37%)  clinical prohibitions   Dong Quai 极善滑腸，瀉者禁用, forbidden in
--                                        diarrhoea; 孕婦忌之; 腸滑氣虚者禁之
--      83 (28%)  NEGATIVE 七情 relations  畏 fears · 惡 antagonised by · 反 opposes.
--                                        反 marks the 十八反, the most serious
--                                        pairings in the corpus. The verb is not
--                                        decoration and must travel with the row.
--      79 (27%)  POSITIVE 七情 relations  使 envoy · 殺 neutralises another drug's
--                                        toxicity · 勝 subdues · 解毒 resolves a
--                                        toxin · 制/伏 controls
--      24 (8%)   dietary avoidances      忌鯉魚, 忌桃李菘菜雀肉青魚: Tang and Song
--                                        food-combining lore, not medical advice
--
--   **79 positive relations were bound for a field labelled "contraindications".**
--   Fang Feng's 殺附子毒 means it makes aconite SAFER. Coptis's 解巴豆毒 means it
--   RESOLVES croton poison. Gua Lou's 枸杞為使 means goji is its guiding partner.
--   Rendered out of a contraindications field, every one of those reads as "do
--   not combine", which is the exact inverse of the source. Hence a separate
--   column that can never render as a warning.
--
-- ── The rule these columns are governed by ──────────────────────────────────
-- Founder ruling, 2026-07-21: energetics claims cite sources published 1899 or
-- earlier. Modern works may support safety, constituents and pharmacology, but
-- not a temperature, taste or potency assignment. And classical sources
-- CORROBORATE, DISAMBIGUATE or ADD; they never override a clear modern value.
-- These columns exist to hold the "add" case without disturbing the existing
-- energetics.
--
-- Idempotent.

begin;

alter table public.herbs
  add column if not exists traditional_use_duration     text,
  add column if not exists preparation_doctrine        text,
  add column if not exists classical_contraindications text,
  add column if not exists drug_incompatibilities      text,
  add column if not exists positive_pairings           text,
  add column if not exists dietary_avoidances          text,
  add column if not exists adulterant_warnings         text;

-- Closed vocabulary. 'not_in_canon' and 'later_entry' are informative, not
-- missing data: black pepper enters at the Tang Bencao (659 CE) and ginkgo at
-- the Yuan, so neither carries an ancient warrant for daily use, and that is a
-- finding worth recording rather than a NULL.
alter table public.herbs
  drop constraint if exists herbs_traditional_use_duration_check;
alter table public.herbs
  add constraint herbs_traditional_use_duration_check
  check (
    traditional_use_duration is null
    or traditional_use_duration = any (array['long_term','corrective','acute_only','not_classified','later_entry'])
  );

comment on column public.herbs.traditional_use_duration is
  'How long a tradition found this plant safe to take, and at what toxicity. long_term = classed non-toxic and suitable for prolonged use. corrective = used to correct a condition, not for indefinite daily use. acute_only = reserved for acute attack, often toxic. not_classified = no classical entry exists. later_entry = the plant enters the corpus after the Han canon (black pepper at the Tang Bencao, 659 CE; ginkgo at the Yuan), so no ancient long-use warrant exists. DERIVED FROM the Shennong Bencao Jing three-grade classification, cited by recension (e.g. Sun Xingyan, 1799). Records the OBSERVATION about toxicity and duration; deliberately does NOT carry the classification''s own framing, which is Daoist life-extension (久服輕身延年) and fails the worldview filter. See docs/worldview-filter.md.';

comment on column public.herbs.preparation_doctrine is
  'Classical processing and vehicle, quoted from a pre-1900 source. Records where the traditional preparation differs from the shipped form, and any hard prohibition (e.g. rehmannia must not contact copper or iron; bupleurum must not meet fire).';

comment on column public.herbs.classical_contraindications is
  'CLINICAL prohibitions only, as stated in a pre-1900 source, with attribution: patient states and conditions (瀉者禁用, 孕婦忌之, 腸滑氣虚者禁之). Drug-drug relations belong in drug_incompatibilities or positive_pairings; food-combining notes belong in dietary_avoidances. BEWARE the character 忌: it appears in both clinical and dietary clauses, and the test is what follows it, a patient state or a food. Distinguish "not stated classically" from "none": silence in a source is not a safety clearance.';

comment on column public.herbs.drug_incompatibilities is
  'NEGATIVE 七情 (seven relations) only: 畏 fears / is diminished by, 惡 is antagonised by, 反 opposes. 反 marks the 十八反 (Eighteen Antagonisms), the most safety-load-bearing pairings in the corpus, e.g. 反烏頭. Keep the relation VERB with each entry; the three are not interchangeable. Never place 使, 殺, 勝, 解毒, 制 or 伏 here: those are positive relations and belong in positive_pairings.';

comment on column public.herbs.positive_pairings is
  'POSITIVE 七情 relations. MUST NEVER RENDER AS A WARNING. 使 / 為之使 = envoy, a guiding partner that directs the formula. 殺 = this herb neutralises another drug''s toxicity (Fang Feng 殺附子毒 makes aconite safer). 勝 = subdues. 解…毒 = resolves a toxin (Coptis 解巴豆毒 resolves croton poison). 制 / 伏 = controls. Formulation knowledge with no Western equivalent. 79 of these were found bound for a contraindications field, where each would have read as its own opposite.';

comment on column public.herbs.adulterant_warnings is
  'Classical warnings that a DIFFERENT plant is passed off as this one, with the harm and any stated remedy. Its own field because it fits nowhere else and a loader will otherwise drop it: Manjistha carries 「勿用赤柳草根，真相似，只是味酸濇，誤服令人患内障眼，速服甘草水止之」, red willow root looks identical, taking it by mistake causes cataract, checked at once with licorice water. That is a 勿用 with a named harm and a named antidote. It is not a contraindication of Manjistha, and filing it as "not this herb" would delete it. Also holds commercial fraud notes, e.g. the 1757 report that dealers sell mixed hill-gathered roots as "combined chaihu" with hardly any real bupleurum in it, and the warning that alfalfa root faked as astragalus 能令人瘦, makes people thin, the opposite of the intended effect.';

comment on column public.herbs.dietary_avoidances is
  'Food-combining notes from the Tang and Song dietetic tradition: 忌鯉魚, 忌桃李、菘菜、雀肉、青魚, 忌蒜、胡荽. Verbatim and correctly sourced, but NOT medical warnings, and must be labelled so a reader does not take them as clinical advice. Where a clause attaches to one 附方 rather than the drug as such, say so.';

-- ── Write down what the existing energetics columns mean ────────────────────
-- These have carried no definition anywhere in the schema, the docs or the
-- repo. That absence is what made a 251-herb audit necessary to answer a
-- question the project had already effectively decided: an audit flagged 21
-- Western herbs stored "Cool" against classical Galenic sources calling them
-- hot, and the answer was that the two are measuring different things.
comment on column public.herbs.temperature is
  'MODERN Western energetic EFFECT: the direction this herb moves body heat, in the modern reading of its own tradition of use. NOT a classical Galenic degree and NOT a classical virya. Where the classical assignment differs it is recorded in the value''s prose rather than applied, e.g. Guduchi stores Cool while noting the classical ushna virya. FORMAT: the first clause carries the verdict and the remainder may explain it; classifiers must read the LEADING CLAUSE only, never the whole string.';

comment on column public.herbs.moisture is
  'Modern Western energetic EFFECT on tissue fluid, same convention as temperature. NOTE a known defect: this column conflates what a herb IS with what it DOES. Marshmallow is moist and moistens (aligned), but dandelion and cleavers are moist-substanced while their action DRAINS damp (opposed). Read as action, not substance. FORMAT: leading clause carries the verdict.';

commit;
