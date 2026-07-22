-- Remove herb citations whose quoted text cannot be verified at the source they
-- name. Found 2026-07-21 by a QC pass that read the cited pre-1900 works directly.
--
-- WHY REMOVE RATHER THAN REPLACE. An empty citation field is honest; a wrong one
-- is not. Correct classical readings were located for several of these rows, but
-- writing those in would mean trusting a second round of unverified quotation to
-- fix the damage done by the first. New citations belong in a later change, after
-- independent verification, not here.
--
-- NOTHING ELSE ABOUT THESE HERBS CHANGES. Names, energetics, safety, actions and
-- preparation are untouched. Only the source attribution is withdrawn.
--
-- ── The two URL patterns that recur, and why neither can have been read ──────
--   ctext.org          serves a CAPTCHA interstitial to automated access and its
--                      API returns ERR_REQUIRES_AUTHENTICATION. Appears in H002,
--                      H020, H035.
--   archive.org/details/shennong-bencao-jing, dated "1892" in the row, matches no
--                      verifiable pre-1900 edition. Appears in H014, H050.
--
-- ── Per-row findings ────────────────────────────────────────────────────────
-- H014 Eleuthero    The stored excerpt has Wu Jia Pi "warm the spleen-qi,
--                   replenish wei (defensive) qi, and restore the patient
--                   suffering from fatigue, cold limbs, and weakened spirit."
--                   The Shennong entry reads 主心腹疝氣，腹痛，益氣療躄，小兒不能行，
--                   疸創陰蝕 — no spleen-qi, no wei-qi, no cold limbs, no spirit.
--                   Compounding it, the classical drug 五加皮 is Acanthopanax, NOT
--                   Eleutherococcus senticosus; 刺五加 appears zero times in the
--                   1596, 1757 and 1799 texts. This plant has no pre-1900 Chinese
--                   entry at all.
-- H020 Ginkgo       Stored excerpt says "astringent and warming". Bencao Gangmu
--                   (1596) gives 平, neutral, for the kernel, and the row's part
--                   is the LEAF, which no pre-1900 source assigns a temperature
--                   because it is a 20th-century European preparation. The cited
--                   genre, "Bencao Gangmu, pre-1928 English partial translations",
--                   does not correspond to a real work.
-- H035 Lion's Mane  Attributed to Zhiwu Mingshi Tukao (1848). No full text of that
--                   work is reachable anywhere, so nothing can be quoted from it
--                   in either direction. The excerpt reads "sweet, neutral", which
--                   is exactly this row's stored taste and temperature: the shape
--                   of a citation written to justify a value rather than a value
--                   read out of a source. Independently, the 1596 fungus section
--                   lists fifteen fungi and Hericium is not among them.
-- H290 Maitake      Credits Li Shizhen (1596) under the name 灰樹花. That name is a
--                   modern Chinese mycological coinage and does not occur anywhere
--                   in the 1596 fungus section. The row also carries
--                   year = 'c. 200 CE' against a title naming a 1596 work.
-- H243 Turkey Tail  Same shape: a BCGM 'Yun Zhi' attribution with year
--                   = 'c. 200 CE', and with url and excerpt both NULL, so there is
--                   nothing to check even in principle.
-- H002 Astragalus   Excerpt ("listed in the superior class of the Shennong canon
--                   among the principal qi tonics") is a paraphrase presented as a
--                   quotation, at a ctext.org URL serving no text.
-- H050 Reishi       Excerpt ("The Six Zhi ... are described as tonics for the
--                   heart-qi and the shen") is likewise a paraphrase, at the
--                   unverifiable archive.org item.
--
-- ── Blast radius ────────────────────────────────────────────────────────────
-- No constraint on public.herbs references these columns. The only consumer is
-- HerbCard.tsx, which already handles NULL: it falls back to the legacy free-text
-- primary_sources / secondary_sources, and renders no Sources section when both
-- are absent. Bridge rows in herbs_eden_patterns hold their own COPIES of the
-- citation pair taken at build time, so the Lock #43 dual-citation CHECK on that
-- table is not disturbed by this.
--
-- Idempotent.

begin;

update public.herbs
   set primary_text_citation = null
 where herb_id in ('H014', 'H020', 'H035', 'H290', 'H243', 'H002', 'H050');

-- Turkey Tail and Maitake repeat the same unsupported Bencao Gangmu attribution
-- in the LEGACY prose field, which is exactly what HerbCard falls back to. Left
-- alone, withdrawing the structured citation would surface the same claim again.
-- The modern sources in secondary_sources are kept: they are honestly labelled
-- and are what these two rows actually rest on.
update public.herbs
   set primary_sources = null
 where herb_id in ('H243', 'H290')
   and primary_sources ilike '%Ben Cao Gang Mu%';

commit;
