-- Strip every citation fabrication a reader can currently see.
--
-- CONTEXT. A signature scan of the whole herbs table found the citation defect is
-- systemic, not confined to the adaptogens: 86 herbs carry a defective primary
-- citation (title byte-identical to locator, a forbidden modern source named in the
-- primary slot, a ctext.org URL that serves zero bytes, or a negative year). That is
-- roughly the entire 200-herb expansion, H101-H300.
--
-- BUT only a handful reach readers. The citation render guard requires
-- year:number + url:string, and 81 of the 86 fail it, so they are invisible. The guard
-- is, for now, the only thing shielding readers from the fabricated data. This is
-- exactly why the guard must NOT be "fixed" (coerced to render string years) until the
-- data behind it is clean: doing so would expose all 81 at once.
--
-- This migration clears the ones that ARE visible. Six herbs, verified reader-facing by
-- the render-guard test, each independently audited (verifier + adversarial challenger,
-- every challenge upheld):
--   H084 Boswellia    primary: Sushruta via Bhishagratna (post-1900 translation trap,
--                     negative year -600); the passage is NOT in the source. No pre-1900
--                     replacement found. WITHDRAW.
--   H099 Gymnema      primary: Sushruta via Bhishagratna (translation trap, year -600);
--                     NOT in source. A real replacement (Dymock 1890) exists but supports
--                     identity only and needs a founder taste ruling, so it goes to review.
--                     WITHDRAW the fabrication now.
--   H092 Dong Quai    primary: Bencao Gangmu via a ctext.org URL that serves zero bytes;
--                     the "excerpt" is modern paraphrase that CONTRADICTS the real text
--                     (asserts a menorrhagia contraindication the Bencao Gangmu lists as an
--                     indication). WITHDRAW now; verified wikisource replacement in review.
--   H060 Turmeric     primary: a Kaviratna archive.org id that never existed; excerpt
--                     fabricated. WITHDRAW now; verified replacement in review.
--   H243 Turkey Tail  secondary: corrupt JSON. author "Shennong Ben Cao Jing", MSKCC /
--                     WebMD prose stuffed into title and locator. No genuine pre-1900
--                     source exists. NULL it.
--   H290 Maitake      secondary: corrupt JSON. author "AHPA Botanical Safety Handbook"
--                     2013, modern web prose in the fields. NULL it.
--
-- SAFE. All four primary-citation herbs carry legacy primary_sources prose, so the card
-- degrades to the plain-text Sources line, as it already does for ~187 other herbs. The
-- two secondary-only herbs already have no primary and lose only a corrupt record. No
-- herb is hidden and no reader sees a fabricated quotation after this runs.
--
-- FOUNDER RULING 2026-07-22: strip false citations now, replace properly after review.
-- The verified pre-1900 replacements (Bencao Gangmu 1596, Kaviratna 1890, Dymock 1890,
-- Dutt 1877 and others) are held for a founder-reviewed migration, because installing a
-- new pre-1900 citation is new clinical content and several carry safety edits and
-- unsupported taste/temperature values that are the founder's call.
--
-- NOT in scope here, logged for the reviewed pass:
--   - H102 Hibiscus: its structured primary does not render, but its prose fallback shows
--     a 2023 Egyptian regulator as "Primary". Fixing that is a prose edit plus the Dymock
--     1890 install, so it belongs in the reviewed batch, not this removal.
--   - The other ~70 hidden defective herbs and the 13 verified replacements.

begin;

update public.herbs set primary_text_citation = null
where herb_id = 'H084'
  and primary_text_citation->>'title' ilike 'Sushruta%Bhishagratna%';

update public.herbs set primary_text_citation = null
where herb_id = 'H099'
  and primary_text_citation->>'title' ilike 'Sushruta%Bhishagratna%';

update public.herbs set primary_text_citation = null
where herb_id = 'H092'
  and primary_text_citation->>'url' ilike '%ctext.org%';

update public.herbs set primary_text_citation = null
where herb_id = 'H060'
  and primary_text_citation->>'url' ilike '%CarakaSamhitaKaviratna%';

update public.herbs set secondary_citation = null
where herb_id = 'H243'
  and secondary_citation->>'author' = 'Shennong Ben Cao Jing';

update public.herbs set secondary_citation = null
where herb_id = 'H290'
  and secondary_citation->>'author' = 'AHPA Botanical Safety Handbook';

commit;
