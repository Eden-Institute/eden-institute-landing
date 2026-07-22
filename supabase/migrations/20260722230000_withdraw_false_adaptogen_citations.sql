-- Withdraw five false adaptogen citations, and repair the one whose quotation is real.
--
-- THE AUDIT (2026-07-22, founder-authorised after the Rhodiola fabrication)
--
-- Six adaptogen-class herbs were checked by opening the cited works. Each verdict was
-- then handed to a second agent told to REFUTE it. ZERO of the six citations survived.
--
--   Gotu Kola H025   NOT_IN_SOURCE. URL 404s, the excerpt is unlocatable in any Caraka
--                    text, its energetics sentence is invented, and Sharma & Dash is a
--                    post-1900 translation of an ancient text (the documented
--                    translation trap). Four independent fatal defects.
--   Bacopa   H100    TRANSLATION_TRAP. The excerpt is fabricated prose and its headline
--                    assertion is false about Caraka. URL 404s.
--   Schisandra H055  PARAPHRASE_NOT_QUOTATION. ctext.org returned HTTP 301 with a
--                    ZERO-BYTE body when tested, so the citation cannot have been read
--                    there. The stored "excerpt" is English paraphrase, and not a
--                    faithful one. NOTE: the underlying fact is TRUE and was verified in
--                    three separate primary texts. Only the citation is unusable.
--   Tulsi    H027    PARAPHRASE_NOT_QUOTATION. Second invented archive.org identifier
--                    for Kaviratna in this dataset. The work is real and admissible; the
--                    stored excerpt is a summary written in modern voice.
--   Shatavari H103   REAL_BUT_SUPPORTS_IDENTITY_ONLY, upheld on challenge. Its excerpt
--                    is BYTE-IDENTICAL to Ashwagandha's, i.e. copy-pasted onto a
--                    different herb. Its title also bundles in the Ayurvedic
--                    Pharmacopoeia of India, a forbidden modern source, and its year is
--                    the string "classical".
--   Ashwagandha H001 The exception. Its quotation is GENUINE and verbatim, located in
--                    the real text at printed page 32. Only the URL is invented.
--
-- THREE ARCHIVE.ORG IDENTIFIERS IN THIS DATASET NEVER EXISTED:
--   charakasamhitap00kavigoog · CarakaSamhitaKaviratna · CarakaSamhitaSharmaDash
-- All three 404, and their /metadata/ endpoints return {}. They follow the plausible
-- Google-Books-scan naming convention, which is precisely why they passed review.
-- Controls against known-good identifiers returned full metadata in the same calls, so
-- these are not transient outages.
--
-- FOUNDER RULING 2026-07-22: strip the false ones now, replace properly after launch.
--
-- WHY THIS IS SAFE. All six herbs carry legacy free-text `primary_sources` prose, so a
-- nulled structured citation degrades to the plain-text Sources line, exactly as it
-- already does for ~187 other herbs whose year is stored as a string. No herb is
-- hidden, no card loses its Sources heading, and no reader sees a fabricated quotation.
--
-- SCOPE, deliberately limited. Only public.herbs is touched. The same citations were
-- copied onto 48 herbs_eden_patterns rows, but resolveHerbVerdict reduces a pattern
-- row's citations to a single BOOLEAN (hasCitations) and no component renders their
-- text, so none of those 48 is reader-visible. Nulling them would additionally violate
-- herbs_eden_patterns_check on the 8 curated rows and force them unsurfaced, removing
-- live verdicts a week before launch. They are logged as post-launch cleanup instead.

begin;

-- ---------------------------------------------------------------------------
-- 1. Withdraw the five unsalvageable citations.
--    Guarded on the exact stored title so a re-run cannot touch a corrected row.
-- ---------------------------------------------------------------------------
update public.herbs
set primary_text_citation = null
where herb_id = 'H100'  -- Bacopa: fabricated excerpt, false claim about Caraka, 404
  and primary_text_citation->>'title' like 'Caraka Samhita%Sharma%';

update public.herbs
set primary_text_citation = null
where herb_id = 'H025'  -- Gotu Kola: not in source, invented energetics, 404
  and primary_text_citation->>'title' like 'Caraka Samhita%Sharma%';

update public.herbs
set primary_text_citation = null
where herb_id = 'H055'  -- Schisandra: ctext.org serves zero bytes; excerpt is paraphrase
  and primary_text_citation->>'url' like '%ctext.org%';

update public.herbs
set primary_text_citation = null
where herb_id = 'H027'  -- Tulsi: invented archive.org id; excerpt is summary
  and primary_text_citation->>'url' like '%CarakaSamhitaKaviratna%';

update public.herbs
set primary_text_citation = null
where herb_id = 'H103'  -- Shatavari: excerpt copy-pasted from Ashwagandha; forbidden source in title
  and primary_text_citation->>'year' = 'classical';

-- ---------------------------------------------------------------------------
-- 2. Ashwagandha: keep the genuine quotation, repair the pointer and the framing.
--
--    The excerpt is real. Two agents independently located it at printed page 32 of
--    Kaviratna's 1890 English Charaka-Samhita, and the challenger re-downloaded the
--    text and matched its MD5 against the checksum archive.org publishes in its own
--    /metadata/ endpoint, so the replacement item's identity is established rather
--    than asserted. This is a pointer correction, not new unverified prose.
--
--    The stored locator also mislabelled the passage. It quoted "These are the fifty
--    Astringents par excellence", but that line is Kaviratna's structural heading for
--    the fifty mahakashaya (decoction-groups), not a taste attribution. Ashwagandha
--    sits in the SEVENTH group, which the text names Valya and Kaviratna glosses in
--    situ as "(invigorating)" and again at page 248 as "the group called Balya or
--    tonics". The corrected locator says so, and states what the passage cannot carry.
-- ---------------------------------------------------------------------------
update public.herbs
set primary_text_citation = jsonb_set(
      jsonb_set(
        primary_text_citation,
        '{url}',
        '"https://archive.org/details/BIUSante_47357"'::jsonb
      ),
      '{locator}',
      to_jsonb('Sutrasthana, Lesson IV, aphorism 13 (the fifty decoction-groups), printed page 32; identifying footnote (y) reads "Withania somnifera; Syn. Physalis flexuosa". Ashwagandha is the sixth item of the VALYA group, which Kaviratna glosses in situ as "(invigorating)" and again at page 248 as "the group called Balya or tonics". SCOPE: this passage establishes species identity and membership of the strength-promoting group. It does NOT carry the cold and dry energetics, the depletion-and-exhaustion indication, or any ranking among the ten herbs listed.'::text)
    )
where herb_id = 'H001'
  and primary_text_citation->>'url' like '%charakasamhitap00kavigoog%';

commit;
