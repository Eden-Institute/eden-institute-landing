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
-- ── Why these four ──────────────────────────────────────────────────────────
-- shennong_grade
--   The Shennong Bencao Jing (c. 200 CE) sorts drugs into three grades, and the
--   grade encodes intended DURATION of use. Upper grade (上品) is non-toxic and
--   explicitly sanctioned for prolonged daily use, usually with the formula
--   久服輕身延年, "prolonged use lightens the body and extends years". Middle
--   grade (中品) are correctives, not daily-life drugs. Lower grade (下品) are
--   for acute attack and are often toxic.
--   This bears directly on a product that recommends daily herbs. Dong Quai,
--   widely treated as a daily women's tonic, is MIDDLE grade and carries no
--   prolonged-use formula.
--
-- channel_entry
--   Where a drug goes, as distinct from what it does. Two herbs can both drain
--   heat and land in entirely different places. There is no Western equivalent
--   and no existing column can express it. Store the original characters:
--   Astragalus is 入手足太隂氣分, Lung and Spleen at the QI DIVISION specifically,
--   and the qi-division precision is the whole herb.
--
-- preparation_doctrine
--   Repeatedly the classical vehicle is not the shipped form. Ashwagandha's is
--   fat and milk, not water and not a capsule. Rehmannia takes nine steamings
--   and nine sun-dryings and must never meet copper or iron. Bupleurum must not
--   meet fire "or it is instantly without effect".
--
-- classical_contraindications
--   The table has no contraindication column at all. Several of the harvested
--   entries are ordinary product-safety items: Dong Quai is 极善滑腸，瀉者禁用,
--   extremely apt to loosen the bowels, forbidden in diarrhoea.
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
  add column if not exists shennong_grade             text,
  add column if not exists channel_entry              text,
  add column if not exists preparation_doctrine       text,
  add column if not exists classical_contraindications text;

-- Closed vocabulary. 'not_in_canon' and 'later_entry' are informative, not
-- missing data: black pepper enters at the Tang Bencao (659 CE) and ginkgo at
-- the Yuan, so neither carries an ancient warrant for daily use, and that is a
-- finding worth recording rather than a NULL.
alter table public.herbs
  drop constraint if exists herbs_shennong_grade_check;
alter table public.herbs
  add constraint herbs_shennong_grade_check
  check (
    shennong_grade is null
    or shennong_grade = any (array['upper','middle','lower','not_in_canon','later_entry'])
  );

comment on column public.herbs.shennong_grade is
  'Shennong Bencao Jing (c. 200 CE) grade, which encodes intended DURATION of use. upper = 上品, non-toxic, sanctioned for prolonged daily use. middle = 中品, corrective rather than daily. lower = 下品, acute attack, often toxic. not_in_canon = the drug has no classical entry. later_entry = it enters the corpus after the Han canon (e.g. black pepper at the Tang Bencao, 659 CE), so no ancient daily-use warrant exists. Cite the recension, e.g. the Sun Xingyan recension (1799).';

comment on column public.herbs.channel_entry is
  'Classical channel or meridian entry (歸經), preserved in the source''s own characters with the naming authority. Says WHERE a drug goes rather than what it does. No Western equivalent.';

comment on column public.herbs.preparation_doctrine is
  'Classical processing and vehicle, quoted from a pre-1900 source. Records where the traditional preparation differs from the shipped form, and any hard prohibition (e.g. rehmannia must not contact copper or iron; bupleurum must not meet fire).';

comment on column public.herbs.classical_contraindications is
  'Contraindications as stated in a pre-1900 source, with attribution. Distinguish "not stated classically" from "none": silence in the source is not a safety claim.';

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
