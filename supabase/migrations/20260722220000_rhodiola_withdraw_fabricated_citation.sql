-- Withdraw the fabricated Rhodiola citation and replace it with the passage
-- Linnaeus actually wrote.
--
-- WHAT WAS WRONG
--
-- Nine rows (herbs H051, plus its herbs_eden_patterns row for all EIGHT patterns)
-- carried this primary citation:
--
--   author  : "Linnaeus C"
--   title   : "Species Plantarum (Rhodiola rosea original description) and
--              pre-1928 Northern European materia medica"
--   year    : 1753
--   excerpt : "Rhodiola rosea, native to Arctic Europe and Asia, is described in
--              early Northern European pharmacognosy as a tonic for the exhaustion
--              of laborers, soldiers, and post-illness convalescents..."
--
-- Species Plantarum is a botanical catalogue of binomial descriptions. It contains
-- no clinical prose of this kind about any plant. The year field is a NUMBER, so
-- unlike the ~187 citations discarded by the render guard, this one PASSED and was
-- live and clickable for every Seed+ reader who expanded the card.
--
-- WHAT THE PRE-1900 RECORD ACTUALLY SAYS
--
-- Eighteen sources across four centuries and five languages were opened and grepped
-- (Dodoens 1583, Gerard/Johnson 1633, Parkinson 1640, Salmon 1710, Linne Flora
-- Lapponica 1737, Gmelin 1747-69, Linne Materia Medica 1749 and 1772, Pharmacopoea
-- Svecica 1775, Lightfoot 1777, Bergius 1782, Halldorsson Grasnytjar 1783, Landt
-- 1810, Lachesis Lapponica 1811, Virey 1811, Lindley 1838, Rosenthal 1861, and
-- Dragendorff 1898). NOT ONE supports rhodiola for exhaustion, fatigue, or as a
-- tonic. They agree on something else: astringent, cooling, a headache remedy,
-- scurvy, and Arctic food. Dragendorff 1898, a systematic worldwide survey of
-- medicinal plants across peoples and eras, records only headache, scurvy, and food.
--
-- Linnaeus DID write a clinical entry for this plant, just not the one we quoted,
-- and it says close to the opposite. Materia Medica, Liber I. De Plantis (1749),
-- section 477, verified twice: once by the research agent and once independently
-- against the archive.org OCR (item b3051230x_0002) before this migration was
-- written. That verbatim text is what now ships as the primary citation.
--
-- WHERE THE FALSE CLAIM CAME FROM
--
-- Probably our own secondary citation. Panossian et al. (2010) attributes phrases
-- like "tonic against infirmity" to Halldorsson's Grasnytjar (1783). Those phrases
-- are not in that chapter; the page scans were read directly. The likely origin is
-- a mistranslation of "holds-veikum monnum", literally "flesh-weak men", where
-- "holdsveiki" is the ordinary Icelandic word for LEPROSY. The root was held
-- wholesome for lepers, not for the weary. Panossian's clinical meta-analysis is
-- sound and stays as the secondary; its historical section should not be trusted
-- as a source for anything.
--
-- FOUNDER RULING 2026-07-22
--
-- Keep the herb, cite it honestly. The modern evidence for rhodiola in stress and
-- fatigue is real, it is simply twentieth-century (Soviet-era Siberian) rather than
-- historical, which is exactly the case the Apothecary disclaimer shipped today
-- already describes: "where none does... the value reflects modern herbal consensus
-- rather than a historical text."
--
-- STRUCTURE CHOSEN, and why it is not a dodge:
-- herbs_eden_patterns_check requires BOTH citations non-null for a surfaced row, so
-- both slots must hold something real. They now do, and each is labelled for what it
-- actually underwrites:
--   primary   = Linne 1749, real and pre-1900, supporting the ASTRINGENT quality
--               (which is also what the stored taste "Sour, Astringent" records).
--               Its locator states in plain words that it does NOT support the
--               stress-and-fatigue use.
--   secondary = Panossian 2010, carrying the modern clinical claim.
-- The alternative, citing Linne for the fatigue indication, would be the same
-- category error this project has already found 50 times over with King's American
-- Dispensatory being cited for temperatures it never assigns.

begin;

-- ---------------------------------------------------------------------------
-- 1. The herb record.
-- ---------------------------------------------------------------------------
update public.herbs
set primary_text_citation = jsonb_build_object(
      'author',  'Linné, C. von',
      'title',   'Materia Medica, Liber I. De Plantis',
      'year',    1749,
      'url',     'https://archive.org/details/b3051230x_0002',
      'locator', '§477 RHODIOLA. Latin transcribed with the long s normalised. SCOPE: this entry establishes the astringent quality and the eighteenth-century uses only. It does NOT support the modern stress-and-fatigue indication, which rests on the modern secondary citation.',
      'excerpt', 'QUAL: rubicunda, styptica, rosaceo odore. VIS: adstringens. USUS: Hernia, Leucorrhoea, Cephalgia! Hysteria.'
    )
where herb_id = 'H051'
  and primary_text_citation->>'title' like 'Species Plantarum%';

-- ---------------------------------------------------------------------------
-- 2. All eight pattern rows. The fabrication was copied to every one of them,
--    so a fix scoped to the Spent Candle row would have left eight live.
-- ---------------------------------------------------------------------------
update public.herbs_eden_patterns
set primary_citation = jsonb_build_object(
      'author',  'Linné, C. von',
      'title',   'Materia Medica, Liber I. De Plantis',
      'year',    1749,
      'url',     'https://archive.org/details/b3051230x_0002',
      'locator', '§477 RHODIOLA. Latin transcribed with the long s normalised. SCOPE: this entry establishes the astringent quality and the eighteenth-century uses only. It does NOT support the modern stress-and-fatigue indication, which rests on the modern secondary citation.',
      'excerpt', 'QUAL: rubicunda, styptica, rosaceo odore. VIS: adstringens. USUS: Hernia, Leucorrhoea, Cephalgia! Hysteria.'
    )
where herb_id = 'H051'
  and primary_citation->>'title' like 'Species Plantarum%';

commit;
