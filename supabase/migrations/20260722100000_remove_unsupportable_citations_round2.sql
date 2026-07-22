-- Round 2 of the citation withdrawal begun in 20260721170000.
--
-- That migration removed 7 citations found by a QC pass. This one removes 11
-- more, found by auditing ALL 201 herb citations that carried no verbatim
-- excerpt. Every one was checked at its named source.
--
-- Audit result across the 201: 126 had a recoverable excerpt, 62 rest only on
-- post-1900 works (inadmissible for energetics but not fabricated, so they are
-- NOT touched here), and these 11 cannot be supported at all.
--
-- Same principle as round 1: REMOVE, DO NOT REPLACE. An empty citation field is
-- honest; a wrong one is not. Correct sources were located for several of these
-- and are recorded in docs, but writing them in would mean trusting a second
-- round of unverified quotation to repair the first.
--
-- NOTHING ELSE CHANGES. Names, energetics, safety, actions and preparation are
-- untouched. Only the source attribution is withdrawn.
--
-- ── PATTERN 1: the cited entry does not exist in the cited work ─────────────
-- The exact shape of the four withdrawn in round 1: a real author, a real book,
-- and a plausible-sounding heading that is not in it.
--
-- H126 Haritaki      cites a Grieve heading "Myrobalans (Chebulic)". A sweep of
--                    Grieve's complete common-name index, all 26 letter pages
--                    and 979 entries, returns ZERO occurrences. Grieve has no
--                    Terminalia chebula entry at all.
-- H162 Moringa       cites Grieve "Horse-Radish Tree (Moringa pterygosperma)".
--                    Not in Grieve. The nearest real entry is "Horseradish",
--                    Cochlearia armoracia, a Brassicaceae root. If this was
--                    written by string-matching "horseradish" it attached a
--                    mustard-family herb to a Moringaceae tree.
-- H190 Cranberry     cites a Grieve "Cranberry entry". The only cranberry in
--                    Grieve is "High Cranberry", a synonym under Guelder Rose
--                    (Viburnum opulus). Doubly disqualified: the entry does not
--                    exist AND Grieve is post-1900.
-- H283 Trichosanthes cites a Shennong entry for the FRUIT. The Shennong has
--                    栝蔞根, the ROOT. The row's own part_used field states that
--                    the root Tian Hua Fen "is a distinct drug" from the fruit,
--                    so the row contradicts its own citation.
--
-- ── PATTERN 2: right book, wrong plant ─────────────────────────────────────
-- H120 Spikenard     cites a Grieve entry distinguishing Indian nard from
--                    American Spikenard. No such entry or distinction exists.
--                    The trap: Grieve's Aralia racemosa entry lists "Indian
--                    Spikenard" among its SYNONYMS, so searching that phrase
--                    lands on the wrong plant.
-- H262 English Ivy   the citation says Grieve records Hedera helix for whooping
--                    cough and bronchitis with an acrid saponin nature. Grieve's
--                    Hedera helix entry mentions none of it. That content belongs
--                    to "Ivy, Ground" (Glechoma hederacea), a different plant in
--                    the same book.
-- H235 Sweet Marjoram claims Grieve supports a nervine, carminative, hepatic
--                    cluster. Of that list only emmenagogue is present; nervine,
--                    sedative, liver, hepatic, uterine, astringent, cooling and
--                    diuretic all return zero hits in that entry.
-- H239 Artichoke     claims Grieve records it as "a bitter, diuretic, and
--                    liver-supporting plant". Bitter holds; diuretic and liver
--                    are absent. The entry is horticultural, carrying a
--                    Cultivation heading and no Medicinal Action and Uses.
--
-- ── PATTERN 3: the citation names several different works at once ───────────
-- H265 Amomum        author, url and year say King's 1898 (allowed, but silent
--                    on this drug); title and locator say Stuart 1911 and Bensky
--                    (both forbidden). Three works in one citation object, with
--                    the year field making a 1911 source look like an 1898 one.
--                    The row also conflates Amomum villosum with Grains of
--                    Paradise (Aframomum melegueta), a West African plant.
-- H285 Chaga         the primary "source" is "Russian and Siberian ethnobotanical
--                    tradition", which cannot be opened, paged or quoted. A
--                    tradition is not a citable text. The jsonb then attaches
--                    author King's American Dispensatory, year 1898 and a King's
--                    URL to it, lending an allowed pre-1900 authority to a claim
--                    that author never made.
--
-- ── PATTERN 4: the only support fails the worldview filter ──────────────────
-- H274 Gastrodia     the cited Shennong entry supports the row through
--                    demon-expulsion and immortality claims and nothing else.
--                    Under Lock #14 and Lock #44 (docs/worldview-filter.md) that
--                    is spiritual attribution, not observation, so once it is
--                    stripped the citation supports nothing. It also CONTRADICTS
--                    both stored values. Both are independently recoverable from
--                    the Bencao Gangmu (1596) 卷十二下, where Zhen Quan gives
--                    味甘平無毒, sweet and neutral, matching the row. That is the
--                    replacement to make later, after verification.
--
-- ── Blast radius ────────────────────────────────────────────────────────────
-- No constraint references this column. HerbCard falls back to the legacy
-- primary_sources prose and renders no Sources section when both are absent.
-- herbs_eden_patterns holds its own copies of the citation pair taken at build
-- time, so the Lock #43 dual-citation CHECK is undisturbed.
--
-- Idempotent.

begin;

update public.herbs
   set primary_text_citation = null
 where herb_id in (
   'H120',  -- Spikenard, wrong plant via a Grieve synonym
   'H126',  -- Haritaki, cited Grieve heading does not exist
   'H162',  -- Moringa, cited Grieve entry does not exist
   'H190',  -- Cranberry, cited Grieve entry does not exist
   'H235',  -- Sweet Marjoram, claimed actions absent from the entry
   'H239',  -- Artichoke, claimed actions absent from a horticultural entry
   'H262',  -- English Ivy, content belongs to Ground Ivy
   'H265',  -- Amomum, three works in one citation, year field disguises 1911
   'H274',  -- Gastrodia, only support is metaphysical and contradicts the row
   'H283',  -- Trichosanthes, cites the root entry to support the fruit
   'H285'   -- Chaga, "a tradition" is not a citable work
 );

commit;
