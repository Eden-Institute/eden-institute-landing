-- Load the 70 traditional use-duration values that survived independent
-- verification.
--
-- ── WHAT THIS RECORDS, AND WHAT IT DELIBERATELY DOES NOT ────────────────────
-- These derive from the Shennong Bencao Jing three-grade classification. The
-- OBSERVATION is kept: after centuries of use, some plants were found non-toxic
-- and safe over long periods, others toxic and reserved for acute attack. That
-- bears directly on a product recommending daily herbs. Dong Quai, widely
-- treated as a daily women's tonic, is in the CORRECTIVE class and carries no
-- prolonged-use formula.
--
-- The FRAMING is discarded. The classical upper grade is defined by 久服輕身延年,
-- "prolonged use lightens the body and extends years", and 輕身 is Daoist
-- immortality-cultivation vocabulary; the three tiers are 養命 / 養性 / 治病,
-- nourishing destiny / nourishing nature / treating disease. That is a claim
-- about transcendence, not health, and it fails the worldview filter
-- (Lock #14 + Lock #44, docs/worldview-filter.md). Values therefore state
-- DURATION AND TOXICITY, not rank, and the column is named for what it observes.
--
-- Discarding the attribution is not discarding the source. The Shennong
-- provenance is recorded in the column comment and here.
--
-- ── PROVENANCE ──────────────────────────────────────────────────────────────
-- Every value is fixed by ONE of two objective tests, both pre-1900:
--   1. which juan the entry falls in, in the Sun Xingyan recension (1799) of the
--      Shennong Bencao Jing: 卷一 long-term, 卷二 corrective, 卷三 acute;
--   2. the 本經上品 / 本經中品 / 本經下品 note in the Bencao Gangmu (1596,
--      Siku Quanshu recension) head line.
-- Most values were confirmed by both routes independently.
--
-- ── HOW THESE WERE VERIFIED ─────────────────────────────────────────────────
-- Harvested by one pass, then re-read at the source by ten INDEPENDENT verifiers
-- who did not produce them, each in an isolated directory so no agent could
-- confirm a sibling's downloaded file. 254 claims checked across three fields.
-- **Zero refuted at claim level and no invented quotation found.** Every Chinese
-- quotation checked was a real substring of the named work, in the named juan,
-- under a named authority.
--
-- Only this field loads. The safety fields are NOT loaded: adjudication found an
-- indication read as an adverse effect, an author credited with a doctrine he
-- rejected, a wrong drug in an incompatibility list, and content filed under the
-- wrong tag. See docs/classical-safety-field-split.md.
--
-- ── THREE HELD BACK ─────────────────────────────────────────────────────────
-- H014 Eleuthero      the classical grade belongs to 五加皮 (Acanthopanax), a
--                     DIFFERENT organism. Eleutherococcus senticosus has no
--                     classical entry: 刺五加 appears zero times in the 1596,
--                     1757 and 1799 texts. Loading it would attribute a
--                     classification to the wrong plant, the same species
--                     confusion that put a fabricated citation on this row.
-- H206 Manjistha      classification confirmed, but the supporting quote is
--                     credited to the 本經 when Li Shizhen assigns it to the
--                     名醫别錄. Loads once reattributed.
-- H243 Turkey Tail    no classification. The neighbouring 芝 entry is Ganoderma
--                     and its grade must not slide across.
--
-- ── THREE THAT LOAD WITH A COPY CAVEAT ──────────────────────────────────────
--   H170 Goji         the classical head is a combined 枸杞地骨皮, not the berry.
--   H187 Bai Zhu and
--   H276 Cang Zhu     both draw from undifferentiated 术; Li Shizhen says so.
--
-- Requires 20260721180000_classical_energetics_columns.sql. Idempotent.

begin;

-- LONG TERM (classical 上品) — found non-toxic and safe to take over long periods
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H002';  -- Astragalus
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H022';  -- Ginseng
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H050';  -- Reishi
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H055';  -- Schisandra
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H104';  -- Rehmannia
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H134';  -- Bupleurum
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H140';  -- Red Sage / Dan Shen
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H147';  -- Gokshura / Puncture Vine
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H169';  -- Chrysanthemum / Ju Hua
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H170';  -- Goji / Gou Qi Zi
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H175';  -- Aged Tangerine Peel / Chen Pi
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H176';  -- Coptis / Goldthread
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H181';  -- Ophiopogon
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H182';  -- Phellodendron
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H184';  -- Poria / Fu Ling
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H185';  -- Sour Jujube Seed
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H186';  -- Szechuan Lovage / Chuan Xiong
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H187';  -- White Atractylodes
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H253';  -- Job's Tears / Coix
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H267';  -- Capillaris Wormwood / Yin Chen Hao
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H268';  -- Chinese Senega / Polygala
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H269';  -- Chinese Yam / Shan Yao
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H272';  -- Eucommia Bark / Du Zhong
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H274';  -- Gastrodia
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H275';  -- Glossy Privet Fruit
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H276';  -- Grey Atractylodes
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H281';  -- Siler
update public.herbs set traditional_use_duration = 'long_term' where herb_id = 'H284';  -- Water Plantain

-- CORRECTIVE (classical 中品) — used to correct a condition, not for indefinite daily use
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H092';  -- Dong Quai
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H139';  -- Kudzu
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H142';  -- Baikal Skullcap
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H173';  -- White Peony / Bai Shao
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H178';  -- Gardenia
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H214';  -- Bitter Sophora / Ku Shen
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H227';  -- Epimedium / Yin Yang Huo
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H246';  -- Longan
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H256';  -- Mimosa
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H264';  -- White Mulberry Leaf
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H266';  -- Anemarrhena
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H270';  -- Cornelian Cherry
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H277';  -- Lily Bulb / Bai He
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H278';  -- Magnolia Bark
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H282';  -- Moutan
update public.herbs set traditional_use_duration = 'corrective' where herb_id = 'H283';  -- Trichosanthes / Gua Lou

-- ACUTE ONLY (classical 下品) — reserved for acute attack, often toxic
update public.herbs set traditional_use_duration = 'acute_only' where herb_id = 'H168';  -- Chinese Rhubarb / Da Huang
update public.herbs set traditional_use_duration = 'acute_only' where herb_id = 'H177';  -- Forsythia
update public.herbs set traditional_use_duration = 'acute_only' where herb_id = 'H183';  -- Pinellia
update public.herbs set traditional_use_duration = 'acute_only' where herb_id = 'H263';  -- Sweet Wormwood

-- LATER ENTRY — post-dates the Han canon, so no ancient long-use warrant exists
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H020';  -- Ginkgo
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H084';  -- Boswellia
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H107';  -- Black Pepper
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H136';  -- Fo-Ti
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H153';  -- Musta / Xiang Fu
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H160';  -- Green Tea
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H180';  -- Japanese Honeysuckle
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H231';  -- Notoginseng / San Qi
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H240';  -- Asafoetida
update public.herbs set traditional_use_duration = 'later_entry' where herb_id = 'H271';  -- Corydalis

-- NOT CLASSIFIED — no classical Chinese entry exists for this plant
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H099';  -- Gymnema
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H103';  -- Shatavari
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H148';  -- Arjuna
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H162';  -- Moringa / Shigru / Drumstick
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H199';  -- Bhumyamalaki
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H210';  -- Vidanga
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H215';  -- Codonopsis / Dang Shen
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H243';  -- Turkey Tail
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H249';  -- Cordyceps
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H290';  -- Maitake
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H294';  -- Shiitake
update public.herbs set traditional_use_duration = 'not_classified' where herb_id = 'H296';  -- Bakuchi / Babchi
commit;
