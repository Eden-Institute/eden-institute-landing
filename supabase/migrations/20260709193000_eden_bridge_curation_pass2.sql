-- Practitioner buildout Phase 1 (PD-4 curation, part 2 of 2): clinical
-- review corrections + surfacing. A 108-agent review pass (one clinical
-- reviewer per herb, read-only DB access, instructed to flag only
-- high-confidence errors) examined all 864 computed verdicts and flagged 42
-- at confidence >= 0.7. The dominant failure modes match the classifier's
-- documented weaknesses: the 2-of-3 axis vote outvoting the clinically
-- decisive temperature axis (e.g. cayenne 'matching' the hot Pressure
-- Cooker), and tone misclassification of relaxants/trophorestoratives whose
-- tissue_states_indicated mention 'deficiency'. Founder-canon rows
-- (derivation='curated' from part 1) were excluded from review and are
-- protected again here. After corrections, every row is surfaced: the Lock
-- #43 CHECK guarantees each carries both citation halves.

WITH corrections(herb_id, pattern_id, verdict, reason) AS (VALUES
  ('H009','EP04','avoid','Cinnamon is warming (Warm/Dry); Overflowing Cup is a hot pattern. A warming herb aggravates heat excess. Its drying/astringing benefit does not offset that; temperature is the decisive axis.'),
  ('H012','EP07','neutral','Echinacea is cooling; EP07 (Frozen Knot) is a cold terrain, so it aggravates the decisive temperature axis. Drying helps the damp, but a 2-of-3 vote (with dubious relaxant tone) outvotes it; not a default match.'),
  ('H006','EP03','avoid','Cayenne is intensely hot; Pressure Cooker is a hot pattern. Its heat aggravates the clinically decisive temperature axis - the damp+tense rebalance wrongly outvoted the heat contraindication.'),
  ('H002','EP05','match','Astragalus is a warm, moistening Qi tonic: opposes this terrain''s cold and dryness and nourishes the depletion driving the tension. Classically indicated for a cold, depleted constitution, not neutral.'),
  ('H015','EP05','match','Cool, moist, nourishing remedy for dryness+deficiency, classically indicated for cold/dry depletion. The ''tonic'' tone label wrongly flips this tense terrain to avoid; moistening/nourishing benefit dominates.'),
  ('H011','EP05','avoid','Dandelion is a cooling, draining bitter diuretic. For a cold/dry depletion terrain the decisive cold axis and its fluid-depleting drainage contraindicate it; the moisture vote shouldn''t outvote that. Should be avoid.'),
  ('H026','EP06','match','Warm cardiac tonic for Heart Qi/Blood deficiency; Spent Candle is cold/dry/relaxed depletion. Warm opposes cold + tonic opposes relaxed = 2 axes. Classifier scored temp only, missed tone.'),
  ('H026','EP08','match','Hawthorn is explicitly indicated for Cold cardiovascular stagnation; Still Water is cold/damp/relaxed. Warm opposes cold + tonic opposes relaxed = 2 axes. Classifier missed tone axis.'),
  ('H035','EP06','match','Nervous trophorestorative for chronic depletion/degeneration; Spent Candle (cold/dry/relaxed) IS that terrain. Tonic opposes laxity; neutral temp/moisture don''t aggravate. Classic match.'),
  ('H023','EP08','match','Goldenrod is astringent (a tonic); tone axis omitted. Its drying + toning oppose Still Water''s damp+relaxed excesses; only cool temp mismatches, so net rebalancing = match not neutral.'),
  ('H029','EP04','match','Horsetail is a drying, astringent (tissue-toning) diuretic; summary literally cites ''damp-heat with tissue weakness'' = hot/damp/relaxed. Drains damp + tones laxity = 2 axes. Classifier ignored tone.'),
  ('H029','EP08','match','Astringent diuretic drains damp + tones lax tissue (2 rebalancing axes); classic for boggy/lax damp terrain. DB temp neutral, so no cold aggravation. Classifier ignored tone axis.'),
  ('H029','EP05','avoid','Drying astringent/tonic reinforces a cold-dry-tense terrain on 2 axes (drier + more constricted). Drying astringents are contraindicated in dry-tense depletion. Classifier ignored tone.'),
  ('H029','EP01','avoid','Drying astringent aggravates a hot-dry-tense terrain: adds dryness and tightens already-tense tissue (2 aggravating axes). Mild cooling doesn''t offset. Classifier ignored tone axis.'),
  ('H041','EP03','neutral','Mullein is a cooling-neutral, RELAXING/demulcent expectorant, not a tonic; its relaxant action eases tense respiratory tissue rather than aggravating it. Only moisture mildly opposes this damp terrain, so ''avoid'' overstates.'),
  ('H041','EP07','neutral','Tone mis-set to ''tonic'' from ''Deficiency (lung)''. Mullein is a relaxing expectorant that soothes tense tissue and is temp-neutral, reinforcing at most the damp axis; by the 2-of-3 rule that''s neutral, not avoid.'),
  ('H050','EP05','match','Reishi is a warming, calming Shen-tonic adaptogen, classically indicated for burned-out cold/dry/tense depletion; its calming action opposes the tense excess (mis-scored as tonic-aggravates-tense), so it rebalances: match, not neutral.'),
  ('H053','EP06','match','Warming stimulant tonic for cold, depleted, foggy (cognitive-deficiency) constitutions; warms cold + tones the spent/lax terrain (2 axes). Only dryness conflicts; classifier missed the tonic tone.'),
  ('H057','EP05','match','Moistening demulcent opposes the decisive dryness axis and soothes tense/irritated tissue; neutral temp won''t aggravate cold. Mirrors curated EP01 (hot/dry/tense=match).'),
  ('H057','EP06','match','Slippery Elm is a nutritive moistening demulcent (elm gruel) classically given for depleted, dry, spent states; opposes the decisive dryness axis, not neutral.'),
  ('H057','EP02','match','Cooling, moistening demulcent soothes the heat, inflammation and irritation and relieves dryness; decisive moisture axis makes hot/dry terrain a match, not neutral.'),
  ('H051','EP05','match','Rhodiola''s headline indication is stress-depletion with tension and fatigue, i.e. this wired cold/dry/tense terrain. ''Avoid'' inverts its primary use; its restorative action offsets shared cold/dry.'),
  ('H051','EP06','match','Rhodiola is a classic burnout, fatigue and depression adaptogen; this spent cold/dry/relaxed depletion terrain is its target. ''Avoid'' inverts its main use rather than reflecting real aggravation.'),
  ('H066','EP03','match','Wild Yam is a cooling antispasmodic (relaxant), not a tonic; classifier read ''Deficiency'' as tonic. It opposes this pattern''s heat+tension; only moisture aggravates, so ''avoid'' is wrong.'),
  ('H066','EP04','avoid','With correct relaxant tone, a moist relaxant aggravates a hot-DAMP-RELAXED (atonic) terrain on 2 axes (moisture+tone); cooling alone doesn''t make it a good default. Not a match.'),
  ('H066','EP05','match','Antispasmodic+moistening actions oppose this DRY-TENSE pattern''s excesses; only coolness aggravates the cold. ''Avoid'' inverts the tone axis that''s decisive for a tense pattern.'),
  ('H066','EP06','avoid','Cooling relaxant mis-tagged tonic from ''Deficiency''; it aggravates a cold-RELAXED (exhausted/atonic) terrain on 2 axes. Spent Candle needs warming restoratives, not Wild Yam.'),
  ('H077','EP05','match','Classifier scored betony''s tone as neutral, missing that it''s a classic relaxant nervine. For cold/dry/tense terrain it warms the cold and relaxes tension (2 rebalancing axes); only mild dryness cautions.'),
  ('H084','EP04','match','Boswellia is a specific for damp-heat inflammation (hot+damp = this terrain); its drying, astringent action rebalances the excess damp/laxity. Nominal warmth outvoted the decisive damp axis.'),
  ('H089','EP04','match','Corn silk is a cooling damp-heat diuretic (summary: ''matches damp-heat''); it drains damp and clears heat, so it opposes this hot-damp terrain, not aggravates. Sibling hot-damp EP03 is already match.'),
  ('H085','EP01','match','Bugleweed is a cooling relaxant, cardinal for hot, tense, hyperexcitable (hyperthyroid) terrain; it opposes this pattern''s defining heat and tension. Only mild drying cautions. Classifier dropped relaxant tone.'),
  ('H085','EP08','avoid','As a cooling relaxant it reinforces this cold, lax terrain''s decisive cold and relaxed excesses; only its drying opposes the damp. Classifier omitted relaxant tone, understating the aggravation.'),
  ('H096','EP08','match','DB indicates Gentian for ''cold-damp atonic digestion'' = this terrain: drying clears damp, bitter tonic tones atony, and kindles digestive fire despite cool temp. Rebalances, not neutral.'),
  ('H099','EP01','avoid','Gymnema is drying + astringent-toning; it aggravates the dry and tense axes, only cooling opposes the terrain. Classifier misread astringent as a relaxant. 2 of 3 axes aggravate, not a match.'),
  ('H099','EP07','avoid','Gymnema is cooling + astringent-toning; it aggravates the cold and tense axes, only drying opposes the damp. Classifier misread astringent as a relaxant. 2 of 3 axes aggravate, not a match.'),
  ('H102','EP06','neutral','Hibiscus is a cooling refrigerant; the Spent Candle is a cold, depleted terrain where temperature is decisive. The 2-of-3 vote (moist+toning) outvoted the cold axis. Cooling a cold, spent constitution isn''t a good default.'),
  ('H103','EP05','match','Shatavari is the cardinal moistening tonic for dry, depleted Vata (cold/dry/tense) tissue - its named indication. Dryness is the decisive axis; as a demulcent it softens, not tightens, so ''tonic aggravates tense'' misfires.'),
  ('H104','EP08','avoid','Cloying, deeply moistening Rehmannia is contraindicated in damp/boggy terrain. Still Water is cold-damp-relaxed; the decisive damp axis is aggravated, outweighing its warming/tonic benefit.'),
  ('H098','EP03','avoid','Ground Ivy is a warming, drying astringent (tonic), not a relaxant. On hot/damp/tense it aggravates heat and tension; only drying helps (2 of 3 aggravated). Avoid, not match.'),
  ('H098','EP05','avoid','Astringent tonic misread as relaxant. On cold/dry/tense its drying and toning worsen the dryness and constriction; only warmth helps. Clinically avoid, not a match.'),
  ('H100','EP01','neutral','Bacopa is a calming, moistening nervine (anxiolytic, antispasmodic) that relieves tense and dry excess; it reinforces at most the hot axis, so ''avoid'' is wrong - neutral at most.'),
  ('H100','EP05','match','Cold/dry/tense is classic Vata nervous exhaustion, Bacopa''s flagship use. Warming, moistening, and calming, it opposes all three excesses; the ''tonic'' tag wrongly voided the tense axis.')
)
UPDATE public.herbs_eden_patterns hep
   SET relationship = c.verdict,
       derivation   = 'curated',
       rationale    = 'Curation review: ' || c.reason || ' | ' || hep.rationale,
       updated_at   = now()
  FROM corrections c
 WHERE hep.herb_id = c.herb_id
   AND hep.pattern_id = c.pattern_id
   AND hep.derivation <> 'curated';   -- founder canon wins over reviewer flags

-- Surface the curated bridge (citations verified present by the CHECK gate).
UPDATE public.herbs_eden_patterns
   SET surfaced = true, updated_at = now()
 WHERE NOT surfaced
   AND primary_citation IS NOT NULL
   AND secondary_citation IS NOT NULL;
