-- =============================================================================
-- Eden Apothecary: safety and source corrections for 20 herb monographs
-- (H274, H281-H300). DATA-ONLY migration. Written 2026-09-15, NOT applied.
-- =============================================================================
-- Founder approval: Camila approved every change below on 2026-09-15, after the
-- verification pass recorded in herb20_verification.md (sources and URLs there).
--
-- Concurrency guard: every UPDATE matches the FULL live value read on
-- 2026-09-15 (read-only execute_sql; all 45 guard values were hash-checked
-- against production the same day). If a field has been edited since, nothing
-- is overwritten: the block RAISEs, unless the field already holds the
-- corrected value (so a re-run is a no-op).
--
-- A. Safety fixes
--   H299 Cape Aloes: duration "1 to 2 weeks" -> "no longer than 1 week"
--        (EMA/HMPC) in cautions and dosage_notes; breastfeeding "Avoid" ->
--        "Contraindicated" (EMA/HMPC); menses item removed from chief_complaints.
--   Complaint links removed: H299 x CP30 Amenorrhea, H299 x CP20 Menstrual
--        irregularity, H300 x CP30 Amenorrhea, H282 x CP30 Amenorrhea,
--        H282 x CP31 Menorrhagia. H282 chief_complaints text loses "amenorrhea".
--   H296 Bakuchi: home sun/UVA topical instructions in dosage_notes replaced by
--        a practitioner-only sentence. Oral dose text unchanged.
-- B. Internal draft notes ("NEEDS REVIEW", "See flags") removed from customer-
--   facing fields on H274, H281, H282, H283, H289, H295, H300.
-- C. Source corrections
--   H287 Bogbean: EMA dose 0.4 to 1.6 g per 150 mL, 2 to 4 times daily;
--        under 18 not recommended (EMA/HMPC).
--   H298 Mastic: topical strength 4-40% -> 9 to 11% (EMA) in dosage_notes and
--        preparation_methods; uterine-stimulant rationale removed.
--   H293 Rhatany: latin_name Krameria triandra -> Krameria lappacea (ESCOP);
--        K. triandra added to herb_synonyms as a Latin synonym.
--   H295 American Spikenard: pregnancy "likely unsafe" -> "possibly unsafe" (WebMD).
--   H288 Daruharidra: "crosses the placenta" and "kernicterus" removed from the
--        MotherToBaby-credited pregnancy sentence; 500 mg dose labeled as the
--        isolated berberine compound.
--   H285 Chaga: case report article number e28983 -> e28997 (3 places).
--   H284 Ze Xie, H299 Cape Aloes: Brinker title "Herbal Contraindications..." ->
--        "Herb Contraindications and Drug Interactions".
--   H289 Kutki: 2 to 4 g single purgative dose removed from dosage_notes.
-- D. Structured citations: new sources S33-S45 and citations C065-C079, linked
--   via citations_herbs, ONLY for sources verified in the report (URLs confirmed;
--   article metadata from NCBI E-utilities / Crossref). Idempotent.
--
-- herbs.last_updated is set to now() on every changed row (existing convention).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A/B/C: guarded field edits
-- -----------------------------------------------------------------------------

-- H299.cautions: A1 duration 1 to 2 weeks -> 1 week (EMA/HMPC)
do $do$
declare n int;
begin
  update public.herbs
     set cautions = 'A drastic anthranoid stimulant laxative for short-term use only (EMA/HMPC: no longer than 1 week). Habitual use causes laxative dependency, loss of colonic tone, potassium loss, and melanosis coli. Always combine with a carminative (fennel, ginger) to blunt the intestinal griping. Reserve the concentrated latex for stubborn constipation after gentler bulk and osmotic measures fail. This is the bitter latex, not the soothing inner-leaf gel.',
         last_updated = now()
   where herb_id = 'H299'
     and cautions = 'A drastic anthranoid stimulant laxative for short-term use only (Commission E: no longer than 1 to 2 weeks). Habitual use causes laxative dependency, loss of colonic tone, potassium loss, and melanosis coli. Always combine with a carminative (fennel, ginger) to blunt the intestinal griping. Reserve the concentrated latex for stubborn constipation after gentler bulk and osmotic measures fail. This is the bitter latex, not the soothing inner-leaf gel.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and cautions = 'A drastic anthranoid stimulant laxative for short-term use only (EMA/HMPC: no longer than 1 week). Habitual use causes laxative dependency, loss of colonic tone, potassium loss, and melanosis coli. Always combine with a carminative (fennel, ginger) to blunt the intestinal griping. Reserve the concentrated latex for stubborn constipation after gentler bulk and osmotic measures fail. This is the bitter latex, not the soothing inner-leaf gel.') then
      raise notice 'H299.cautions already corrected, skipped';
    else
      raise exception 'H299.cautions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.dosage_notes: A1 duration 1 to 2 weeks -> 1 week (EMA/HMPC), second wording of the same claim
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Laxative: 50 to 200 mg (0.05 to 0.2 g) of Cape aloes powder at night, standardized to deliver roughly 10 to 30 mg hydroxyanthracene derivatives (calculated as barbaloin) per day (German Commission E). Use the lowest dose that restores a soft stool; onset in 8 to 12 hours (Grieve: 15 to 18 hours), so give at bedtime. Small bitter/stomachic dose: 10 to 60 mg. Eclectic pill dose was 1/4 to 2 grains (King''s ranged up to 10 grains, now regarded as excessive). Short-term use only, no longer than 1 week (EMA/HMPC).',
         last_updated = now()
   where herb_id = 'H299'
     and dosage_notes = 'Laxative: 50 to 200 mg (0.05 to 0.2 g) of Cape aloes powder at night, standardized to deliver roughly 10 to 30 mg hydroxyanthracene derivatives (calculated as barbaloin) per day (German Commission E). Use the lowest dose that restores a soft stool; onset in 8 to 12 hours (Grieve: 15 to 18 hours), so give at bedtime. Small bitter/stomachic dose: 10 to 60 mg. Eclectic pill dose was 1/4 to 2 grains (King''s ranged up to 10 grains, now regarded as excessive). Short-term use only, ideally under 1 to 2 weeks.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and dosage_notes = 'Laxative: 50 to 200 mg (0.05 to 0.2 g) of Cape aloes powder at night, standardized to deliver roughly 10 to 30 mg hydroxyanthracene derivatives (calculated as barbaloin) per day (German Commission E). Use the lowest dose that restores a soft stool; onset in 8 to 12 hours (Grieve: 15 to 18 hours), so give at bedtime. Small bitter/stomachic dose: 10 to 60 mg. Eclectic pill dose was 1/4 to 2 grains (King''s ranged up to 10 grains, now regarded as excessive). Short-term use only, no longer than 1 week (EMA/HMPC).') then
      raise notice 'H299.dosage_notes already corrected, skipped';
    else
      raise exception 'H299.dosage_notes: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.breastfeeding_safety: A1 breastfeeding Avoid -> Contraindicated (EMA/HMPC)
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Contraindicated (EMA/HMPC). Anthraquinone metabolites (aloe-emodin and related aglycones) are excreted into breast milk and may purge or gripe the nursing infant; the EMA/HMPC monograph contraindicates use during breastfeeding. King''s likewise notes the purgative principle passes into the milk. (NCCIH; AHPA Botanical Safety Handbook 2nd ed.)',
         last_updated = now()
   where herb_id = 'H299'
     and breastfeeding_safety = 'Avoid. Anthraquinone metabolites (aloe-emodin and related aglycones) are excreted into breast milk and may purge or gripe the nursing infant; oral aloe is judged possibly unsafe in lactation. King''s likewise notes the purgative principle passes into the milk. (NCCIH; AHPA Botanical Safety Handbook 2nd ed.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and breastfeeding_safety = 'Contraindicated (EMA/HMPC). Anthraquinone metabolites (aloe-emodin and related aglycones) are excreted into breast milk and may purge or gripe the nursing infant; the EMA/HMPC monograph contraindicates use during breastfeeding. King''s likewise notes the purgative principle passes into the milk. (NCCIH; AHPA Botanical Safety Handbook 2nd ed.)') then
      raise notice 'H299.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H299.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.chief_complaints: A2 remove menses item from chief_complaints text
do $do$
declare n int;
begin
  update public.herbs
     set chief_complaints = 'Atonic and habitual constipation with a sluggish, congested colon; hepatic and portal congestion with heat-type constipation; intestinal worms; short-term relief of an obstinate, torpid bowel.',
         last_updated = now()
   where herb_id = 'H299'
     and chief_complaints = 'Atonic and habitual constipation with a sluggish, congested colon; hepatic and portal congestion with heat-type constipation; suppressed or scanty menses (traditional emmenagogue); intestinal worms; short-term relief of an obstinate, torpid bowel.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and chief_complaints = 'Atonic and habitual constipation with a sluggish, congested colon; hepatic and portal congestion with heat-type constipation; intestinal worms; short-term relief of an obstinate, torpid bowel.') then
      raise notice 'H299.chief_complaints already corrected, skipped';
    else
      raise exception 'H299.chief_complaints: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H282.chief_complaints: A2 remove amenorrhea from chief_complaints text
do $do$
declare n int;
begin
  update public.herbs
     set chief_complaints = 'Blood-heat fevers and warm-disease eruptions (maculae, papules), reckless bleeding from heat (epistaxis, hematemesis), yin-deficient steaming-bone and night fevers without sweat, blood-stasis dysmenorrhea, abdominal masses and trauma, Liver-fire headache and red eyes, and early intestinal abscess.',
         last_updated = now()
   where herb_id = 'H282'
     and chief_complaints = 'Blood-heat fevers and warm-disease eruptions (maculae, papules), reckless bleeding from heat (epistaxis, hematemesis), yin-deficient steaming-bone and night fevers without sweat, blood-stasis dysmenorrhea and amenorrhea, abdominal masses and trauma, Liver-fire headache and red eyes, and early intestinal abscess.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H282' and chief_complaints = 'Blood-heat fevers and warm-disease eruptions (maculae, papules), reckless bleeding from heat (epistaxis, hematemesis), yin-deficient steaming-bone and night fevers without sweat, blood-stasis dysmenorrhea, abdominal masses and trauma, Liver-fire headache and red eyes, and early intestinal abscess.') then
      raise notice 'H282.chief_complaints already corrected, skipped';
    else
      raise exception 'H282.chief_complaints: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H296.dosage_notes: A4 replace home sun/UVA instructions
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Practitioner-guided; a narrow-margin herb. Seed powder: roughly 1 to 3 g per day internally in divided doses, short course. Decoction of the fruit (Bu Gu Zhi): about 6 to 9 g per day, up to 12 g, often salt-processed. Tincture: low, supervised doses. Topical use with light exposure only under the care of a qualified practitioner, because of liver and light toxicity. Do not self-dose, exceed short courses, or combine with unshielded sun exposure. Monitor liver function during internal use.',
         last_updated = now()
   where herb_id = 'H296'
     and dosage_notes = 'Practitioner-guided; a narrow-margin herb. Seed powder: roughly 1 to 3 g per day internally in divided doses, short course. Decoction of the fruit (Bu Gu Zhi): about 6 to 9 g per day, up to 12 g, often salt-processed. Tincture: low, supervised doses. Topical: apply babchi oil or seed paste thinly to the depigmented patch, then expose to sunlight or UVA for a very short, graduated time (begin with a few minutes), with the surrounding skin, eyes, and genitals shielded, escalating slowly to avoid blistering phototoxic burns. Do not self-dose, exceed short courses, or combine with unshielded sun exposure. Monitor liver function during internal use.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H296' and dosage_notes = 'Practitioner-guided; a narrow-margin herb. Seed powder: roughly 1 to 3 g per day internally in divided doses, short course. Decoction of the fruit (Bu Gu Zhi): about 6 to 9 g per day, up to 12 g, often salt-processed. Tincture: low, supervised doses. Topical use with light exposure only under the care of a qualified practitioner, because of liver and light toxicity. Do not self-dose, exceed short courses, or combine with unshielded sun exposure. Monitor liver function during internal use.') then
      raise notice 'H296.dosage_notes already corrected, skipped';
    else
      raise exception 'H296.dosage_notes: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H274.pregnancy_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'No pregnancy-specific human safety studies located. Gastrodia carries an overall AHPA Botanical Safety Handbook Class 1 rating (safe when used appropriately) and classical Chinese sources do not list it as an emmenagogue or abortifacient, but pregnancy-specific controlled data are absent. Use in pregnancy only under a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; data otherwise limited.)',
         last_updated = now()
   where herb_id = 'H274'
     and pregnancy_safety = 'NEEDS REVIEW: no pregnancy-specific human safety studies located. Gastrodia carries an overall AHPA Botanical Safety Handbook Class 1 rating (safe when used appropriately) and classical Chinese sources do not list it as an emmenagogue or abortifacient, but pregnancy-specific controlled data are absent. Use in pregnancy only under a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; data otherwise limited.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H274' and pregnancy_safety = 'No pregnancy-specific human safety studies located. Gastrodia carries an overall AHPA Botanical Safety Handbook Class 1 rating (safe when used appropriately) and classical Chinese sources do not list it as an emmenagogue or abortifacient, but pregnancy-specific controlled data are absent. Use in pregnancy only under a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; data otherwise limited.)') then
      raise notice 'H274.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H274.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H274.breastfeeding_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'No lactation-specific data located. Overall AHPA Class 1, but excretion in breast milk and effects on the nursing infant are unstudied. Avoid during lactation unless directed by a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; Mills & Bone.)',
         last_updated = now()
   where herb_id = 'H274'
     and breastfeeding_safety = 'NEEDS REVIEW: no lactation-specific data located. Overall AHPA Class 1, but excretion in breast milk and effects on the nursing infant are unstudied. Avoid during lactation unless directed by a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; Mills & Bone.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H274' and breastfeeding_safety = 'No lactation-specific data located. Overall AHPA Class 1, but excretion in breast milk and effects on the nursing infant are unstudied. Avoid during lactation unless directed by a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; Mills & Bone.)') then
      raise notice 'H274.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H274.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H281.breastfeeding_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Modern lactation safety data are lacking. The water extract is of very low toxicity in animal studies, and the herb is not a documented galactagogue or lactifuge. Insufficient evidence for routine use; if used, keep to short, practitioner-guided courses. (Saposhnikoviae Radix toxicology, PMC6791657, 2019.)',
         last_updated = now()
   where herb_id = 'H281'
     and breastfeeding_safety = 'Modern lactation safety data are lacking. The water extract is of very low toxicity in animal studies, and the herb is not a documented galactagogue or lactifuge. Insufficient evidence for routine use; if used, keep to short, practitioner-guided courses. (Saposhnikoviae Radix toxicology, PMC6791657, 2019.) NEEDS REVIEW: no dedicated lactation reference located.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H281' and breastfeeding_safety = 'Modern lactation safety data are lacking. The water extract is of very low toxicity in animal studies, and the herb is not a documented galactagogue or lactifuge. Insufficient evidence for routine use; if used, keep to short, practitioner-guided courses. (Saposhnikoviae Radix toxicology, PMC6791657, 2019.)') then
      raise notice 'H281.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H281.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H281.pregnancy_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'No modern human safety studies establish a clear verdict, and published sources disagree (some contraindicate in pregnancy, others consider standard doses acceptable). Classical Chinese texts caution against Fang Feng in blood-deficiency and postpartum wind rather than in ordinary pregnancy, and animal toxicology of the water extract shows very low toxicity with no clear reproductive signal (rat NOAEL 5,000 mg/kg/day). Prudent guidance: avoid unsupervised use; take only within a practitioner-formulated prescription and avoid high or prolonged dosing. (Bensky et al. 2004; Saposhnikoviae Radix toxicology, PMC6791657, 2019.)',
         last_updated = now()
   where herb_id = 'H281'
     and pregnancy_safety = 'No modern human safety studies establish a clear verdict, and published sources disagree (some contraindicate in pregnancy, others consider standard doses acceptable). Classical Chinese texts caution against Fang Feng in blood-deficiency and postpartum wind rather than in ordinary pregnancy, and animal toxicology of the water extract shows very low toxicity with no clear reproductive signal (rat NOAEL 5,000 mg/kg/day). Prudent guidance: avoid unsupervised use; take only within a practitioner-formulated prescription and avoid high or prolonged dosing. (Bensky et al. 2004; Saposhnikoviae Radix toxicology, PMC6791657, 2019.) NEEDS REVIEW: sources conflict on a blanket pregnancy prohibition; confirm against AHPA Botanical Safety Handbook 2nd ed.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H281' and pregnancy_safety = 'No modern human safety studies establish a clear verdict, and published sources disagree (some contraindicate in pregnancy, others consider standard doses acceptable). Classical Chinese texts caution against Fang Feng in blood-deficiency and postpartum wind rather than in ordinary pregnancy, and animal toxicology of the water extract shows very low toxicity with no clear reproductive signal (rat NOAEL 5,000 mg/kg/day). Prudent guidance: avoid unsupervised use; take only within a practitioner-formulated prescription and avoid high or prolonged dosing. (Bensky et al. 2004; Saposhnikoviae Radix toxicology, PMC6791657, 2019.)') then
      raise notice 'H281.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H281.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H282.breastfeeding_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'No human lactation data located (no LactMed entry). The recommendation is precautionary. Traditionally avoided during nursing given the blood-moving nature; use only under a qualified practitioner''s direction.',
         last_updated = now()
   where herb_id = 'H282'
     and breastfeeding_safety = 'NEEDS REVIEW: No human lactation data located (no LactMed entry). The recommendation is precautionary. Traditionally avoided during nursing given the blood-moving nature; use only under a qualified practitioner''s direction.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H282' and breastfeeding_safety = 'No human lactation data located (no LactMed entry). The recommendation is precautionary. Traditionally avoided during nursing given the blood-moving nature; use only under a qualified practitioner''s direction.') then
      raise notice 'H282.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H282.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H283.children_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'No pediatric-specific published safety data. The cold, purgative, slippery nature is unsuitable for children with cold or weak digestion; guidance is derived from general energetic principles. Use only for acute phlegm-heat under qualified practitioner supervision.',
         last_updated = now()
   where herb_id = 'H283'
     and children_safety = 'NEEDS REVIEW: no pediatric-specific published safety data. The cold, purgative, slippery nature is unsuitable for children with cold or weak digestion; guidance is derived from general energetic principles. Use only for acute phlegm-heat under qualified practitioner supervision.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H283' and children_safety = 'No pediatric-specific published safety data. The cold, purgative, slippery nature is unsuitable for children with cold or weak digestion; guidance is derived from general energetic principles. Use only for acute phlegm-heat under qualified practitioner supervision.') then
      raise notice 'H283.children_safety already corrected, skipped';
    else
      raise exception 'H283.children_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H289.breastfeeding_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Insufficient reliable data. Classical Ayurveda places Katuka among stanya-shodhana (milk-cleansing) herbs at low dose, but no modern lactation safety data exist and general references advise avoidance, so use only under qualified supervision, and preferably not in the early postpartum.',
         last_updated = now()
   where herb_id = 'H289'
     and breastfeeding_safety = 'Insufficient reliable data. Classical Ayurveda places Katuka among stanya-shodhana (milk-cleansing) herbs at low dose, but no modern lactation safety data exist and general references advise avoidance, so use only under qualified supervision, and preferably not in the early postpartum. See flags: guidance is conflicting.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H289' and breastfeeding_safety = 'Insufficient reliable data. Classical Ayurveda places Katuka among stanya-shodhana (milk-cleansing) herbs at low dose, but no modern lactation safety data exist and general references advise avoidance, so use only under qualified supervision, and preferably not in the early postpartum.') then
      raise notice 'H289.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H289.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H300.breastfeeding_safety: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Contraindicated (avoid). No human lactation safety data exist; plumbagin is cytotoxic and an irritant, and its excretion into breast milk is uncharacterized. Precautionary avoidance per Mills & Bone principles.',
         last_updated = now()
   where herb_id = 'H300'
     and breastfeeding_safety = 'Contraindicated (avoid). No human lactation safety data exist; plumbagin is cytotoxic and an irritant, and its excretion into breast milk is uncharacterized. Precautionary avoidance per Mills & Bone principles. NEEDS REVIEW: no primary lactation data, rating is extrapolated.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H300' and breastfeeding_safety = 'Contraindicated (avoid). No human lactation safety data exist; plumbagin is cytotoxic and an irritant, and its excretion into breast milk is uncharacterized. Precautionary avoidance per Mills & Bone principles.') then
      raise notice 'H300.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H300.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H300.drug_interactions: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'Pharmacologically predicted, limited human data. Plumbagin is a potent mixed inhibitor of CYP1A2, CYP2B6, CYP2C9, CYP2D6, CYP2E1 and CYP3A4 (Ki below about 2.2 microM), so it may raise plasma levels of drugs cleared by these enzymes, including narrow-therapeutic-index agents and warfarin (via CYP2C9). May potentiate anticoagulant and antiplatelet drugs (measurable effects on the coagulation profile are reported) and add to the effect of antidiabetic drugs (plumbagin is hypoglycemic). Avoid combining with hepatotoxic medications. (Sci Rep 2016 CYP450 inhibition study; Mills & Bone.)',
         last_updated = now()
   where herb_id = 'H300'
     and drug_interactions = 'Pharmacologically predicted, limited human data. Plumbagin is a potent mixed inhibitor of CYP1A2, CYP2B6, CYP2C9, CYP2D6, CYP2E1 and CYP3A4 (Ki below about 2.2 microM), so it may raise plasma levels of drugs cleared by these enzymes, including narrow-therapeutic-index agents and warfarin (via CYP2C9). May potentiate anticoagulant and antiplatelet drugs (measurable effects on the coagulation profile are reported) and add to the effect of antidiabetic drugs (plumbagin is hypoglycemic). Avoid combining with hepatotoxic medications. (Sci Rep 2016 CYP450 inhibition study; Mills & Bone.) NEEDS REVIEW: no human interaction trials.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H300' and drug_interactions = 'Pharmacologically predicted, limited human data. Plumbagin is a potent mixed inhibitor of CYP1A2, CYP2B6, CYP2C9, CYP2D6, CYP2E1 and CYP3A4 (Ki below about 2.2 microM), so it may raise plasma levels of drugs cleared by these enzymes, including narrow-therapeutic-index agents and warfarin (via CYP2C9). May potentiate anticoagulant and antiplatelet drugs (measurable effects on the coagulation profile are reported) and add to the effect of antidiabetic drugs (plumbagin is hypoglycemic). Avoid combining with hepatotoxic medications. (Sci Rep 2016 CYP450 inhibition study; Mills & Bone.)') then
      raise notice 'H300.drug_interactions already corrected, skipped';
    else
      raise exception 'H300.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H295.drug_interactions: B remove draft note
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'No well-documented, clinically significant drug interactions are recorded in the accessible modern literature, where data are limited. Theoretical only: as a diaphoretic, mild alterative with saponin content, additive effects with other diaphoretic or immune-stimulating herbs are conceivable but unstudied. Exercise general caution when combining with medicines given the absence of data. (AHPA Botanical Safety Handbook, 2nd ed.; Natural Medicines / WebMD-RxList American Spikenard, 2024.)',
         last_updated = now()
   where herb_id = 'H295'
     and drug_interactions = 'No well-documented, clinically significant drug interactions are recorded in the accessible modern literature, where data are limited. Theoretical only: as a diaphoretic, mild alterative with saponin content, additive effects with other diaphoretic or immune-stimulating herbs are conceivable but unstudied. Exercise general caution when combining with medicines given the absence of data. (AHPA Botanical Safety Handbook, 2nd ed.; Natural Medicines / WebMD-RxList American Spikenard, 2024; see flags for the data gap.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H295' and drug_interactions = 'No well-documented, clinically significant drug interactions are recorded in the accessible modern literature, where data are limited. Theoretical only: as a diaphoretic, mild alterative with saponin content, additive effects with other diaphoretic or immune-stimulating herbs are conceivable but unstudied. Exercise general caution when combining with medicines given the absence of data. (AHPA Botanical Safety Handbook, 2nd ed.; Natural Medicines / WebMD-RxList American Spikenard, 2024.)') then
      raise notice 'H295.drug_interactions already corrected, skipped';
    else
      raise exception 'H295.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H295.pregnancy_safety: B remove draft note; C likely unsafe -> possibly unsafe (WebMD)
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. Modern consumer-safety references classify American spikenard as possibly unsafe in pregnancy, and the historical Eclectic literature used the root as an emmenagogue for suppressed menstruation and dysmenorrhea, which is a red flag in pregnancy. Reliable human safety data are lacking. (Natural Medicines / WebMD-RxList American Spikenard, 2024; traditional emmenagogue use per Ellingwood, American Materia Medica, 1919. A specific AHPA class was not confirmed.)',
         last_updated = now()
   where herb_id = 'H295'
     and pregnancy_safety = 'Avoid. Modern consumer-safety references classify American spikenard as likely unsafe in pregnancy, and the historical Eclectic literature used the root as an emmenagogue for suppressed menstruation and dysmenorrhea, which is a red flag in pregnancy. Reliable human safety data are lacking. (Natural Medicines / WebMD-RxList American Spikenard, 2024; traditional emmenagogue use per Ellingwood, American Materia Medica, 1919. A specific AHPA class was not confirmed: see flags.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H295' and pregnancy_safety = 'Avoid. Modern consumer-safety references classify American spikenard as possibly unsafe in pregnancy, and the historical Eclectic literature used the root as an emmenagogue for suppressed menstruation and dysmenorrhea, which is a red flag in pregnancy. Reliable human safety data are lacking. (Natural Medicines / WebMD-RxList American Spikenard, 2024; traditional emmenagogue use per Ellingwood, American Materia Medica, 1919. A specific AHPA class was not confirmed.)') then
      raise notice 'H295.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H295.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H287.dosage_notes: C dose per EMA/HMPC monograph
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Dried-leaf infusion: 0.4 to 1.6 g per 150 mL boiling water, 2 to 4 times daily (EMA/HMPC), taken before meals; traditional strong infusion 1 oz dried leaf to 1 pint water in wineglassful doses (Grieve). Powdered leaf: 0.6-1.6 g (10-25 grains) as a tonic (King''s). Tincture (1:5, 45%): about 1-2 mL up to 3x daily. Fluid extract: 10-40 drops (Grieve). Do not exceed tonic doses; larger amounts are cathartic and emetic.',
         last_updated = now()
   where herb_id = 'H287'
     and dosage_notes = 'Dried-leaf infusion: 1.5-3 g in about 150 mL boiling water, up to 3 times daily (EMA/HMPC), taken before meals; traditional strong infusion 1 oz dried leaf to 1 pint water in wineglassful doses (Grieve). Powdered leaf: 0.6-1.6 g (10-25 grains) as a tonic (King''s). Tincture (1:5, 45%): about 1-2 mL up to 3x daily. Fluid extract: 10-40 drops (Grieve). Do not exceed tonic doses; larger amounts are cathartic and emetic.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H287' and dosage_notes = 'Dried-leaf infusion: 0.4 to 1.6 g per 150 mL boiling water, 2 to 4 times daily (EMA/HMPC), taken before meals; traditional strong infusion 1 oz dried leaf to 1 pint water in wineglassful doses (Grieve). Powdered leaf: 0.6-1.6 g (10-25 grains) as a tonic (King''s). Tincture (1:5, 45%): about 1-2 mL up to 3x daily. Fluid extract: 10-40 drops (Grieve). Do not exceed tonic doses; larger amounts are cathartic and emetic.') then
      raise notice 'H287.dosage_notes already corrected, skipped';
    else
      raise exception 'H287.dosage_notes: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H287.children_safety: C children per EMA/HMPC (not recommended under 18)
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'No pediatric dosing established. Bitter tonics are generally reserved for adults; the intense bitterness and purgative potential at higher doses make bogbean unsuitable for young children. EMA/HMPC does not recommend use in children and adolescents under 18 years. No modern pediatric safety data.',
         last_updated = now()
   where herb_id = 'H287'
     and children_safety = 'No pediatric dosing established. Bitter tonics are generally reserved for adults; the intense bitterness and purgative potential at higher doses make bogbean unsuitable for young children. If used in older children for poor appetite, only under professional guidance at a reduced dose. No modern pediatric safety data.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H287' and children_safety = 'No pediatric dosing established. Bitter tonics are generally reserved for adults; the intense bitterness and purgative potential at higher doses make bogbean unsuitable for young children. EMA/HMPC does not recommend use in children and adolescents under 18 years. No modern pediatric safety data.') then
      raise notice 'H287.children_safety already corrected, skipped';
    else
      raise exception 'H287.children_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H298.dosage_notes: C topical strength per EMA
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Mild dyspepsia: powdered resin 0.5-1 g as a single dose, up to twice daily (daily dose 1-2 g), per EMA traditional-use posology. Duodenal ulcer (clinical): 1 g per day for 2 weeks (Al-Habbal 1984). Functional dyspepsia (clinical): 350 mg three times daily for 3 weeks (Dabos 2010). Oral hygiene and breath: chew a pea-sized tear (about 1 g) as needed. Topical: 9 to 11% resin in ointment for minor skin inflammation or wounds.',
         last_updated = now()
   where herb_id = 'H298'
     and dosage_notes = 'Mild dyspepsia: powdered resin 0.5-1 g as a single dose, up to twice daily (daily dose 1-2 g), per EMA traditional-use posology. Duodenal ulcer (clinical): 1 g per day for 2 weeks (Al-Habbal 1984). Functional dyspepsia (clinical): 350 mg three times daily for 3 weeks (Dabos 2010). Oral hygiene and breath: chew a pea-sized tear (about 1 g) as needed. Topical: 4-40% resin in ointment for minor skin inflammation or wounds.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H298' and dosage_notes = 'Mild dyspepsia: powdered resin 0.5-1 g as a single dose, up to twice daily (daily dose 1-2 g), per EMA traditional-use posology. Duodenal ulcer (clinical): 1 g per day for 2 weeks (Al-Habbal 1984). Functional dyspepsia (clinical): 350 mg three times daily for 3 weeks (Dabos 2010). Oral hygiene and breath: chew a pea-sized tear (about 1 g) as needed. Topical: 9 to 11% resin in ointment for minor skin inflammation or wounds.') then
      raise notice 'H298.dosage_notes already corrected, skipped';
    else
      raise exception 'H298.dosage_notes: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H298.preparation_methods: C topical strength per EMA, second wording
do $do$
declare n int;
begin
  update public.herbs
     set preparation_methods = 'Chewed resin tears (the traditional masticatory for breath and oral hygiene); powdered resin in capsules; loose powder; tincture (the resin dissolves in alcohol); essential oil (mastic oil) for topical or oral use; salve or ointment (9 to 11% resin) for the skin.',
         last_updated = now()
   where herb_id = 'H298'
     and preparation_methods = 'Chewed resin tears (the traditional masticatory for breath and oral hygiene); powdered resin in capsules; loose powder; tincture (the resin dissolves in alcohol); essential oil (mastic oil) for topical or oral use; salve or ointment (4-40% resin) for the skin.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H298' and preparation_methods = 'Chewed resin tears (the traditional masticatory for breath and oral hygiene); powdered resin in capsules; loose powder; tincture (the resin dissolves in alcohol); essential oil (mastic oil) for topical or oral use; salve or ointment (9 to 11% resin) for the skin.') then
      raise notice 'H298.preparation_methods already corrected, skipped';
    else
      raise exception 'H298.preparation_methods: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H298.pregnancy_safety: C remove uterine-stimulant rationale not in EMA
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Not recommended. Safety in pregnancy has not been established and reproductive/developmental data are absent; avoid medicinal doses, especially internal high-dose use. Culinary and food-level amounts are unlikely to pose concern. Source: EMA/HMPC Assessment report on Pistacia lentiscus L., resina (mastic), 2015.',
         last_updated = now()
   where herb_id = 'H298'
     and pregnancy_safety = 'Not recommended. Safety in pregnancy has not been established and reproductive/developmental data are absent; avoid medicinal doses, especially internal high-dose use, given a theoretical uterine-stimulant caution common to resins. Culinary and food-level amounts are unlikely to pose concern. Source: EMA/HMPC Assessment report on Pistacia lentiscus L., resina (mastic), 2015.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H298' and pregnancy_safety = 'Not recommended. Safety in pregnancy has not been established and reproductive/developmental data are absent; avoid medicinal doses, especially internal high-dose use. Culinary and food-level amounts are unlikely to pose concern. Source: EMA/HMPC Assessment report on Pistacia lentiscus L., resina (mastic), 2015.') then
      raise notice 'H298.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H298.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H293.latin_name: C accepted name (ESCOP)
do $do$
declare n int;
begin
  update public.herbs
     set latin_name = 'Krameria lappacea',
         last_updated = now()
   where herb_id = 'H293'
     and latin_name = 'Krameria triandra';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H293' and latin_name = 'Krameria lappacea') then
      raise notice 'H293.latin_name already corrected, skipped';
    else
      raise exception 'H293.latin_name: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H288.pregnancy_safety: C remove placenta and kernicterus claims not in MotherToBaby
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Contraindicated. Near term, berberine displaces bilirubin from albumin, raising the risk of neonatal jaundice; it has also shown uterine-stimulant activity in animal models. Avoid in all trimesters. (MotherToBaby/NCBI Berberine fact sheet NBK600384; AHPA Botanical Safety Handbook 2nd ed. for berberine-containing Berberis; Brinker.)',
         last_updated = now()
   where herb_id = 'H288'
     and pregnancy_safety = 'Contraindicated. Berberine crosses the placenta and, near term, displaces bilirubin from albumin, raising the risk of neonatal jaundice and kernicterus; it has also shown uterine-stimulant activity in animal models. Avoid in all trimesters. (MotherToBaby/NCBI Berberine fact sheet NBK600384; AHPA Botanical Safety Handbook 2nd ed. for berberine-containing Berberis; Brinker.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H288' and pregnancy_safety = 'Contraindicated. Near term, berberine displaces bilirubin from albumin, raising the risk of neonatal jaundice; it has also shown uterine-stimulant activity in animal models. Avoid in all trimesters. (MotherToBaby/NCBI Berberine fact sheet NBK600384; AHPA Botanical Safety Handbook 2nd ed. for berberine-containing Berberis; Brinker.)') then
      raise notice 'H288.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H288.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H288.dosage_notes: C label 500 mg dose as the isolated compound
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Powder (churna): 1-3 g twice daily with honey or warm water. Decoction: 15-60 mL divided daily (from roughly 5-10 g bark). Tincture (1:5): 2-4 mL up to three times daily. Rasanjana: 0.5-1 g internally, or diluted as an eye collyrium under guidance. Isolated berberine (the purified compound, not the whole herb): commonly 500 mg two to three times daily with meals, in short courses.',
         last_updated = now()
   where herb_id = 'H288'
     and dosage_notes = 'Powder (churna): 1-3 g twice daily with honey or warm water. Decoction: 15-60 mL divided daily (from roughly 5-10 g bark). Tincture (1:5): 2-4 mL up to three times daily. Rasanjana: 0.5-1 g internally, or diluted as an eye collyrium under guidance. Standardized berberine: commonly 500 mg two to three times daily with meals, in short courses.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H288' and dosage_notes = 'Powder (churna): 1-3 g twice daily with honey or warm water. Decoction: 15-60 mL divided daily (from roughly 5-10 g bark). Tincture (1:5): 2-4 mL up to three times daily. Rasanjana: 0.5-1 g internally, or diluted as an eye collyrium under guidance. Isolated berberine (the purified compound, not the whole herb): commonly 500 mg two to three times daily with meals, in short courses.') then
      raise notice 'H288.dosage_notes already corrected, skipped';
    else
      raise exception 'H288.dosage_notes: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H285.drug_interactions: C article number
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'Anticoagulant and antiplatelet drugs (e.g. warfarin, aspirin, clopidogrel): chaga inhibits platelet aggregation in animal models, giving additive bleeding risk. Antidiabetic drugs and insulin: additive blood-glucose lowering with hypoglycemia risk. Immunosuppressants (e.g. ciclosporin, tacrolimus, transplant and autoimmune regimens): chaga stimulates immune activity and may oppose these drugs. High-dose vitamin C: may potentiate the oxalate load and kidney injury (a co-factor in a reported nephropathy case). (MSKCC About Herbs; case reports Medicine 2022;101:e28997 / PMC8913114.)',
         last_updated = now()
   where herb_id = 'H285'
     and drug_interactions = 'Anticoagulant and antiplatelet drugs (e.g. warfarin, aspirin, clopidogrel): chaga inhibits platelet aggregation in animal models, giving additive bleeding risk. Antidiabetic drugs and insulin: additive blood-glucose lowering with hypoglycemia risk. Immunosuppressants (e.g. ciclosporin, tacrolimus, transplant and autoimmune regimens): chaga stimulates immune activity and may oppose these drugs. High-dose vitamin C: may potentiate the oxalate load and kidney injury (a co-factor in a reported nephropathy case). (MSKCC About Herbs; case reports Medicine 2022;101:e28983 / PMC8913114.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H285' and drug_interactions = 'Anticoagulant and antiplatelet drugs (e.g. warfarin, aspirin, clopidogrel): chaga inhibits platelet aggregation in animal models, giving additive bleeding risk. Antidiabetic drugs and insulin: additive blood-glucose lowering with hypoglycemia risk. Immunosuppressants (e.g. ciclosporin, tacrolimus, transplant and autoimmune regimens): chaga stimulates immune activity and may oppose these drugs. High-dose vitamin C: may potentiate the oxalate load and kidney injury (a co-factor in a reported nephropathy case). (MSKCC About Herbs; case reports Medicine 2022;101:e28997 / PMC8913114.)') then
      raise notice 'H285.drug_interactions already corrected, skipped';
    else
      raise exception 'H285.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H285.secondary_sources: C article number
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28997, PMC8913114; end-stage renal disease after long-term chaga ingestion, 2020); Solzhenitsyn A, Cancer Ward (1968) for the folk-use record; Inonotus obliquus phytochemistry and pharmacology reviews (Journal of Ethnopharmacology; ScienceDirect Topics).',
         last_updated = now()
   where herb_id = 'H285'
     and secondary_sources = 'Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28983, PMC8913114; end-stage renal disease after long-term chaga ingestion, 2020); Solzhenitsyn A, Cancer Ward (1968) for the folk-use record; Inonotus obliquus phytochemistry and pharmacology reviews (Journal of Ethnopharmacology; ScienceDirect Topics).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H285' and secondary_sources = 'Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28997, PMC8913114; end-stage renal disease after long-term chaga ingestion, 2020); Solzhenitsyn A, Cancer Ward (1968) for the folk-use record; Inonotus obliquus phytochemistry and pharmacology reviews (Journal of Ethnopharmacology; ScienceDirect Topics).') then
      raise notice 'H285.secondary_sources already corrected, skipped';
    else
      raise exception 'H285.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H285.secondary_citation: C article number (jsonb title + locator)
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/", "year": "2013", "title": "Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28997, PMC8913114; end-stag", "author": "AHPA Botanical Safety Handbook", "locator": "Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28997, PMC8913114; end-stag", "source_id": "S14"}'::jsonb,
         last_updated = now()
   where herb_id = 'H285'
     and secondary_citation = '{"url": "https://www.ahpa.org/", "year": "2013", "title": "Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28983, PMC8913114; end-stag", "author": "AHPA Botanical Safety Handbook", "locator": "Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28983, PMC8913114; end-stag", "source_id": "S14"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H285' and secondary_citation = '{"url": "https://www.ahpa.org/", "year": "2013", "title": "Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28997, PMC8913114; end-stag", "author": "AHPA Botanical Safety Handbook", "locator": "Memorial Sloan Kettering Cancer Center, About Herbs, Chaga Mushroom (integrative-oncology monograph); AHPA Botanical Safety Handbook (2nd ed., 2013); chaga oxalate-nephropathy case reports (Medicine 2022;101(11):e28997, PMC8913114; end-stag", "source_id": "S14"}'::jsonb) then
      raise notice 'H285.secondary_citation already corrected, skipped';
    else
      raise exception 'H285.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H284.drug_interactions: C Brinker title
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'Additive with pharmaceutical diuretics (furosemide, thiazides): increased diuresis with risk of potassium and electrolyte depletion. Additive hypotensive effect with antihypertensive drugs. Theoretical potentiation of lithium toxicity (diuretic-induced reduction in lithium clearance) and of digoxin toxicity (via diuretic-induced hypokalemia). May add to the effect of blood-glucose-lowering and lipid-lowering drugs (documented modern hypoglycemic and hypolipidemic activity). (Chen JK & Chen TT, Chinese Medical Herbology and Pharmacology; Brinker, Herb Contraindications and Drug Interactions, 4th ed.; Acupuncture Today herb-drug interaction review.)',
         last_updated = now()
   where herb_id = 'H284'
     and drug_interactions = 'Additive with pharmaceutical diuretics (furosemide, thiazides): increased diuresis with risk of potassium and electrolyte depletion. Additive hypotensive effect with antihypertensive drugs. Theoretical potentiation of lithium toxicity (diuretic-induced reduction in lithium clearance) and of digoxin toxicity (via diuretic-induced hypokalemia). May add to the effect of blood-glucose-lowering and lipid-lowering drugs (documented modern hypoglycemic and hypolipidemic activity). (Chen JK & Chen TT, Chinese Medical Herbology and Pharmacology; Brinker, Herbal Contraindications and Drug Interactions, 4th ed.; Acupuncture Today herb-drug interaction review.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H284' and drug_interactions = 'Additive with pharmaceutical diuretics (furosemide, thiazides): increased diuresis with risk of potassium and electrolyte depletion. Additive hypotensive effect with antihypertensive drugs. Theoretical potentiation of lithium toxicity (diuretic-induced reduction in lithium clearance) and of digoxin toxicity (via diuretic-induced hypokalemia). May add to the effect of blood-glucose-lowering and lipid-lowering drugs (documented modern hypoglycemic and hypolipidemic activity). (Chen JK & Chen TT, Chinese Medical Herbology and Pharmacology; Brinker, Herb Contraindications and Drug Interactions, 4th ed.; Acupuncture Today herb-drug interaction review.)') then
      raise notice 'H284.drug_interactions already corrected, skipped';
    else
      raise exception 'H284.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.drug_interactions: C Brinker title
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'Digoxin and cardiac glycosides: laxative-induced potassium depletion increases the risk of glycoside toxicity and arrhythmia (Caution/Moderate). Potassium-depleting diuretics (thiazide, loop), corticosteroids, and licorice: additive hypokalemia. Warfarin and anticoagulants: purgative diarrhea can increase the anticoagulant effect and bleeding risk. Other oral medications: accelerated bowel transit may reduce absorption. (NCCIH; WebMD/Natural Medicines; Brinker, Herb Contraindications and Drug Interactions 4th ed.; German Commission E.)',
         last_updated = now()
   where herb_id = 'H299'
     and drug_interactions = 'Digoxin and cardiac glycosides: laxative-induced potassium depletion increases the risk of glycoside toxicity and arrhythmia (Caution/Moderate). Potassium-depleting diuretics (thiazide, loop), corticosteroids, and licorice: additive hypokalemia. Warfarin and anticoagulants: purgative diarrhea can increase the anticoagulant effect and bleeding risk. Other oral medications: accelerated bowel transit may reduce absorption. (NCCIH; WebMD/Natural Medicines; Brinker, Herbal Contraindications and Drug Interactions 4th ed.; German Commission E.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and drug_interactions = 'Digoxin and cardiac glycosides: laxative-induced potassium depletion increases the risk of glycoside toxicity and arrhythmia (Caution/Moderate). Potassium-depleting diuretics (thiazide, loop), corticosteroids, and licorice: additive hypokalemia. Warfarin and anticoagulants: purgative diarrhea can increase the anticoagulant effect and bleeding risk. Other oral medications: accelerated bowel transit may reduce absorption. (NCCIH; WebMD/Natural Medicines; Brinker, Herb Contraindications and Drug Interactions 4th ed.; German Commission E.)') then
      raise notice 'H299.drug_interactions already corrected, skipped';
    else
      raise exception 'H299.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.secondary_sources: C Brinker title
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herb Contraindications and Drug Interactions 4th ed. (2010); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica 3rd ed. (Lu Hui); IARC Monographs Vol. 108 (whole-leaf aloe vera extract, Group 2B); van Wyk & Wink, Medicinal Plants of the World (Aloe ferox)',
         last_updated = now()
   where herb_id = 'H299'
     and secondary_sources = 'German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herbal Contraindications and Drug Interactions 4th ed. (2010); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica 3rd ed. (Lu Hui); IARC Monographs Vol. 108 (whole-leaf aloe vera extract, Group 2B); van Wyk & Wink, Medicinal Plants of the World (Aloe ferox)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and secondary_sources = 'German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herb Contraindications and Drug Interactions 4th ed. (2010); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica 3rd ed. (Lu Hui); IARC Monographs Vol. 108 (whole-leaf aloe vera extract, Group 2B); van Wyk & Wink, Medicinal Plants of the World (Aloe ferox)') then
      raise notice 'H299.secondary_sources already corrected, skipped';
    else
      raise exception 'H299.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.secondary_citation: C Brinker title (jsonb title + locator)
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.herbalgram.org/", "year": "1998", "title": "German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herb Contraindications and Drug Interacti", "author": "Commission E Monographs", "locator": "German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herb Contraindications and Drug Interacti", "source_id": "S11"}'::jsonb,
         last_updated = now()
   where herb_id = 'H299'
     and secondary_citation = '{"url": "https://www.herbalgram.org/", "year": "1998", "title": "German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herbal Contraindications and Drug Interacti", "author": "Commission E Monographs", "locator": "German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herbal Contraindications and Drug Interacti", "source_id": "S11"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and secondary_citation = '{"url": "https://www.herbalgram.org/", "year": "1998", "title": "German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herb Contraindications and Drug Interacti", "author": "Commission E Monographs", "locator": "German Commission E Monograph (Aloe capensis, Blumenthal 1998); AHPA Botanical Safety Handbook 2nd ed. (Gardner & McGuffin 2013) - Aloe leaf latex; NCCIH ''Aloe Vera'' (aloe latex profile); Brinker, Herb Contraindications and Drug Interacti", "source_id": "S11"}'::jsonb) then
      raise notice 'H299.secondary_citation already corrected, skipped';
    else
      raise exception 'H299.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H289.dosage_notes: C remove self-care purge dose
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Powder (churna): 0.5 to 1 g up to twice daily as a hepatic bitter. Decoction: 3 to 6 g dried rhizome. Tincture (1:5, 45 percent): 1 to 3 mL up to three times daily. Standardized picroliv/kutkin extract: 200 to 400 mg daily in divided doses. Take before meals to prime bile flow. Vitiligo research used 200 mg rhizome powder twice daily alongside topical methoxsalen.',
         last_updated = now()
   where herb_id = 'H289'
     and dosage_notes = 'Powder (churna): 0.5 to 1 g up to twice daily as a hepatic bitter; 2 to 4 g as a single purgative dose. Decoction: 3 to 6 g dried rhizome. Tincture (1:5, 45 percent): 1 to 3 mL up to three times daily. Standardized picroliv/kutkin extract: 200 to 400 mg daily in divided doses. Take before meals to prime bile flow. Vitiligo research used 200 mg rhizome powder twice daily alongside topical methoxsalen.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H289' and dosage_notes = 'Powder (churna): 0.5 to 1 g up to twice daily as a hepatic bitter. Decoction: 3 to 6 g dried rhizome. Tincture (1:5, 45 percent): 1 to 3 mL up to three times daily. Standardized picroliv/kutkin extract: 200 to 400 mg daily in divided doses. Take before meals to prime bile flow. Vitiligo research used 200 mg rhizome powder twice daily alongside topical methoxsalen.') then
      raise notice 'H289.dosage_notes already corrected, skipped';
    else
      raise exception 'H289.dosage_notes: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- A2/A3: remove menstrual complaint links (ids verified by name 2026-09-15:
--   CP20 Menstrual irregularity, CP30 Amenorrhea, CP31 Menorrhagia)
-- -----------------------------------------------------------------------------
do $do$
declare n int;
begin
  if (select count(*) from public.complaints
       where (complaint_id, complaint_name) in (('CP20','Menstrual irregularity'),('CP30','Amenorrhea'),('CP31','Menorrhagia'))) <> 3 then
    raise exception 'complaint ids CP20/CP30/CP31 no longer carry the expected names; aborting';
  end if;

  delete from public.herbs_complaints
   where (herb_id, complaint_id) in (('H299','CP30'),('H299','CP20'),('H300','CP30'),('H282','CP30'),('H282','CP31'));
  get diagnostics n = row_count;
  raise notice 'herbs_complaints rows deleted: % (5 expected on first run, 0 on re-run)', n;

  if exists (select 1 from public.herbs_complaints
              where (herb_id, complaint_id) in (('H299','CP30'),('H299','CP20'),('H300','CP30'),('H282','CP30'),('H282','CP31'))) then
    raise exception 'menstrual complaint links still present after delete';
  end if;

  if n > 0 then
    update public.herbs set last_updated = now() where herb_id in ('H282','H299','H300');
  end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- C: H293 Rhatany synonym (ESCOP: Krameria lappacea, syn. K. triandra)
-- -----------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from public.herb_synonyms where herb_id = 'H293' and synonym_phrase = 'Krameria triandra') then
    if exists (select 1 from public.herb_synonyms where synonym_id = 'HSY61') then
      raise exception 'HSY61 already used by another synonym; pick a new id';
    end if;
    insert into public.herb_synonyms (synonym_id, herb_id, synonym_phrase, type)
    values ('HSY61', 'H293', 'Krameria triandra', 'Latin synonym');
  end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- D: structured citations (verified sources only). Same shape as C001-C064:
--   sources = work registry, citations = page_section + summary quote,
--   citations_herbs.field_cited = 'Clinical profile / safety'.
-- Existing registry rows reused: S12 ESCOP, S22 Ellingwood.
-- -----------------------------------------------------------------------------
insert into public.sources (source_id, short_name, full_citation, year, tradition, public_domain, url) values
  ('S33', 'EMA/HMPC monograph: Aloe, folii succus siccatus', 'European Medicines Agency, Committee on Herbal Medicinal Products (HMPC). Final European Union herbal monograph on Aloe barbadensis Mill. and on Aloe (various species, mainly Aloe ferox Mill. and its hybrids), folii succus siccatus.', null, 'Regulatory / EU', null, 'https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-aloe-barbadensis-mill-and-aloe-various-species-mainly-aloe-ferox-mill-and-its-hybrids-folii-succus-siccatus_en.pdf'),
  ('S34', 'EMA/HMPC monograph: Menyanthes trifoliata, folium', 'European Medicines Agency, Committee on Herbal Medicinal Products (HMPC). Final European Union herbal monograph on Menyanthes trifoliata L., folium.', null, 'Regulatory / EU', null, 'https://www.fitoterapia.net/archivos/202107/final-european-union-herbal-monograph-menyanthes-trifoliata-l-folium_en.pdf'),
  ('S35', 'MotherToBaby: Berberine fact sheet', 'Organization of Teratology Information Specialists (OTIS). Berberine. MotherToBaby Fact Sheets. NCBI Bookshelf NBK600384.', '2025', 'Regulatory / US / Pregnancy-lactation', null, 'https://www.ncbi.nlm.nih.gov/books/NBK600384/'),
  ('S36', 'WebMD: American Spikenard', 'WebMD. American Spikenard (ingredient monograph 366).', null, 'Consumer-health', null, 'https://www.webmd.com/vitamins/ai/ingredientmono-366/american-spikenard'),
  ('S37', 'Kim 2019, Saposhnikoviae Radix toxicology', 'Kim CW, et al. Toxicological Evaluation of Saposhnikoviae Radix Water Extract and its Antihyperuricemic Potential. Toxicol Res. 2019;35(4):371-387. doi:10.5487/TR.2019.35.4.371. PMID 31636848; PMC6791657.', '2019', 'Peer-reviewed / Toxicology', null, 'https://pubmed.ncbi.nlm.nih.gov/31636848/'),
  ('S38', 'Ulbricht 2009, Maitake systematic review', 'Ulbricht C, et al. Maitake mushroom (Grifola frondosa): systematic review by the natural standard research collaboration. J Soc Integr Oncol. 2009;7(2):66-72. PMID 19476741.', '2009', 'Peer-reviewed / Systematic review', null, 'https://pubmed.ncbi.nlm.nih.gov/19476741/'),
  ('S39', 'Camargo 2020, Shiitake reproductive safety', 'Camargo IF, et al. Shiitake Culinary-Medicinal Mushroom, Lentinus edodes (Agaricomycetes): Absence of Changes in Maternal Reproductive Performance and Embryofetal Development In Vivo. Int J Med Mushrooms. 2020;22(8):781-791. doi:10.1615/IntJMedMushrooms.2020035680. PMID 33389872.', '2020', 'Peer-reviewed / Toxicology', null, 'https://pubmed.ncbi.nlm.nih.gov/33389872/'),
  ('S40', 'Kwon 2022, Chaga oxalate nephropathy case report', 'Kwon O, et al. Chaga mushroom-induced oxalate nephropathy that clinically manifested as nephrotic syndrome: A case report. Medicine (Baltimore). 2022;101(10):e28997. doi:10.1097/MD.0000000000028997. PMID 35451393; PMC8913114.', '2022', 'Peer-reviewed / Case report', null, 'https://pubmed.ncbi.nlm.nih.gov/35451393/'),
  ('S41', 'Mehta 2024, Psoralea phototoxic reaction in a child', 'Mehta N, et al. Severe phototoxic reaction to Psoralea corylifolia seeds in a child with vitiligo. Contact Dermatitis. 2024;90(6):619-621. doi:10.1111/cod.14527. PMID 38387032.', '2024', 'Peer-reviewed / Case report', null, 'https://pubmed.ncbi.nlm.nih.gov/38387032/'),
  ('S42', 'Selvam 2025, Bakuchi undesired effects case', 'Selvam O, et al. Undesired Effects of Psorylea corylifolia (Bakuchi) in a Vitiligo Patient. Am J Trop Med Hyg. 2025;113(2):421-422. doi:10.4269/ajtmh.24-0822. PMID 40393436; PMC12360082.', '2025', 'Peer-reviewed / Case report', null, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12360082/'),
  ('S43', 'Kim 2016, Bakuchicin CYP1A inhibition', 'Kim SJ, et al. Selective Inhibition of Bakuchicin Isolated from Psoralea corylifolia on CYP1A in Human Liver Microsomes. Evid Based Complement Alternat Med. 2016;2016:5198743. doi:10.1155/2016/5198743. PMID 26977174; PMC4763008.', '2016', 'Peer-reviewed / Pharmacology', null, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4763008/'),
  ('S44', 'Wang 2024, P. corylifolia and tofacitinib', 'Wang Y, et al. Effect of P. corylifolia on the pharmacokinetic profile of tofacitinib and the underlying mechanism. Front Pharmacol. 2024;15:1351882. doi:10.3389/fphar.2024.1351882. PMID 38650629; PMC11033359.', '2024', 'Peer-reviewed / Pharmacology', null, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11033359/'),
  ('S45', 'Chen 2016, Plumbagin CYP450 inhibition', 'Chen A, et al. Evaluation of the inhibition potential of plumbagin against cytochrome P450 using LC-MS/MS and cocktail approach. Sci Rep. 2016;6:28482. doi:10.1038/srep28482.', '2016', 'Peer-reviewed / Pharmacology', null, 'https://www.nature.com/articles/srep28482')
on conflict (source_id) do nothing;

insert into public.citations (citation_id, source_id, page_section, quote) values
  ('C065', 'S33', 'Posology, contraindications, pregnancy and lactation', 'Hydroxyanthracene dose 10-30 mg per day; use no longer than 1 week; contraindicated in children under 12, in pregnancy, and during breastfeeding.'),
  ('C066', 'S34', 'Posology, contraindications, special warnings', 'Infusion of 0.4-1.6 g in 150 mL, 2-4 times daily; contraindicated with gastric or duodenal ulcer; use under 18 years not recommended; no interactions reported.'),
  ('C067', 'S35', 'Pregnancy and breastfeeding', 'Berberine can displace bilirubin from albumin; one study suggests it might cause uterine contractions; not recommended while breastfeeding unless prescribed.'),
  ('C068', 'S36', 'Special precautions and warnings', 'American spikenard is rated possibly unsafe in pregnancy.'),
  ('C069', 'S22', 'Entry: Aralia racemosa', 'Used for suppressed menses and dysmenorrhea; dose 5-40 minims.'),
  ('C070', 'S12', 'Monograph: Rhatany (Ratanhiae radix), https://www.escop.com/downloads/rhatany/', 'Accepted name Krameria lappacea, with K. triandra as a synonym; indications are topical.'),
  ('C071', 'S37', 'Subchronic oral toxicity', 'Saposhnikoviae Radix water extract: rat NOAEL 5,000 mg/kg.'),
  ('C072', 'S38', 'Systematic review', 'Natural Standard systematic review of maitake (Grifola frondosa).'),
  ('C073', 'S39', 'In vivo reproductive study', 'Shiitake showed no changes in maternal reproductive performance or embryofetal development in vivo.'),
  ('C074', 'S40', 'Case report', 'Chaga mushroom-induced oxalate nephropathy presenting as nephrotic syndrome (article e28997).'),
  ('C075', 'S41', 'Case report', 'Severe phototoxic reaction to Psoralea corylifolia seeds in a child with vitiligo.'),
  ('C076', 'S42', 'Case report', 'Undesired effects of Psoralea corylifolia (bakuchi) in a vitiligo patient.'),
  ('C077', 'S43', 'In vitro, human liver microsomes', 'Bakuchicin selectively inhibits CYP1A.'),
  ('C078', 'S44', 'Pharmacokinetic study', 'P. corylifolia alters tofacitinib pharmacokinetics via CYP3A4.'),
  ('C079', 'S45', 'In vitro CYP450 inhibition', 'Plumbagin inhibits multiple CYP450 enzymes, Ki up to 2.16 microM.')
on conflict (citation_id) do nothing;

insert into public.citations_herbs (citation_id, herb_id, field_cited) values
  ('C065', 'H299', 'Clinical profile / safety'),
  ('C066', 'H287', 'Clinical profile / safety'),
  ('C067', 'H288', 'Clinical profile / safety'),
  ('C068', 'H295', 'Clinical profile / safety'),
  ('C069', 'H295', 'Clinical profile / safety'),
  ('C070', 'H293', 'Clinical profile / safety'),
  ('C071', 'H281', 'Clinical profile / safety'),
  ('C072', 'H290', 'Clinical profile / safety'),
  ('C073', 'H294', 'Clinical profile / safety'),
  ('C074', 'H285', 'Clinical profile / safety'),
  ('C075', 'H296', 'Clinical profile / safety'),
  ('C076', 'H296', 'Clinical profile / safety'),
  ('C077', 'H296', 'Clinical profile / safety'),
  ('C078', 'H296', 'Clinical profile / safety'),
  ('C079', 'H300', 'Clinical profile / safety')
on conflict (citation_id, herb_id, field_cited) do nothing;

-- id-collision guard: a pre-existing row under one of these ids would have been skipped above
do $do$
begin
  if not exists (select 1 from public.sources where source_id = 'S33' and url = 'https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-aloe-barbadensis-mill-and-aloe-various-species-mainly-aloe-ferox-mill-and-its-hybrids-folii-succus-siccatus_en.pdf') then raise exception 'source S33: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S34' and url = 'https://www.fitoterapia.net/archivos/202107/final-european-union-herbal-monograph-menyanthes-trifoliata-l-folium_en.pdf') then raise exception 'source S34: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S35' and url = 'https://www.ncbi.nlm.nih.gov/books/NBK600384/') then raise exception 'source S35: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S36' and url = 'https://www.webmd.com/vitamins/ai/ingredientmono-366/american-spikenard') then raise exception 'source S36: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S37' and url = 'https://pubmed.ncbi.nlm.nih.gov/31636848/') then raise exception 'source S37: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S38' and url = 'https://pubmed.ncbi.nlm.nih.gov/19476741/') then raise exception 'source S38: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S39' and url = 'https://pubmed.ncbi.nlm.nih.gov/33389872/') then raise exception 'source S39: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S40' and url = 'https://pubmed.ncbi.nlm.nih.gov/35451393/') then raise exception 'source S40: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S41' and url = 'https://pubmed.ncbi.nlm.nih.gov/38387032/') then raise exception 'source S41: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S42' and url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12360082/') then raise exception 'source S42: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S43' and url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4763008/') then raise exception 'source S43: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S44' and url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11033359/') then raise exception 'source S44: id collision or missing'; end if;
  if not exists (select 1 from public.sources where source_id = 'S45' and url = 'https://www.nature.com/articles/srep28482') then raise exception 'source S45: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C065' and source_id = 'S33' and quote = 'Hydroxyanthracene dose 10-30 mg per day; use no longer than 1 week; contraindicated in children under 12, in pregnancy, and during breastfeeding.') then raise exception 'citation C065: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C066' and source_id = 'S34' and quote = 'Infusion of 0.4-1.6 g in 150 mL, 2-4 times daily; contraindicated with gastric or duodenal ulcer; use under 18 years not recommended; no interactions reported.') then raise exception 'citation C066: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C067' and source_id = 'S35' and quote = 'Berberine can displace bilirubin from albumin; one study suggests it might cause uterine contractions; not recommended while breastfeeding unless prescribed.') then raise exception 'citation C067: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C068' and source_id = 'S36' and quote = 'American spikenard is rated possibly unsafe in pregnancy.') then raise exception 'citation C068: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C069' and source_id = 'S22' and quote = 'Used for suppressed menses and dysmenorrhea; dose 5-40 minims.') then raise exception 'citation C069: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C070' and source_id = 'S12' and quote = 'Accepted name Krameria lappacea, with K. triandra as a synonym; indications are topical.') then raise exception 'citation C070: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C071' and source_id = 'S37' and quote = 'Saposhnikoviae Radix water extract: rat NOAEL 5,000 mg/kg.') then raise exception 'citation C071: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C072' and source_id = 'S38' and quote = 'Natural Standard systematic review of maitake (Grifola frondosa).') then raise exception 'citation C072: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C073' and source_id = 'S39' and quote = 'Shiitake showed no changes in maternal reproductive performance or embryofetal development in vivo.') then raise exception 'citation C073: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C074' and source_id = 'S40' and quote = 'Chaga mushroom-induced oxalate nephropathy presenting as nephrotic syndrome (article e28997).') then raise exception 'citation C074: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C075' and source_id = 'S41' and quote = 'Severe phototoxic reaction to Psoralea corylifolia seeds in a child with vitiligo.') then raise exception 'citation C075: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C076' and source_id = 'S42' and quote = 'Undesired effects of Psoralea corylifolia (bakuchi) in a vitiligo patient.') then raise exception 'citation C076: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C077' and source_id = 'S43' and quote = 'Bakuchicin selectively inhibits CYP1A.') then raise exception 'citation C077: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C078' and source_id = 'S44' and quote = 'P. corylifolia alters tofacitinib pharmacokinetics via CYP3A4.') then raise exception 'citation C078: id collision or missing'; end if;
  if not exists (select 1 from public.citations where citation_id = 'C079' and source_id = 'S45' and quote = 'Plumbagin inhibits multiple CYP450 enzymes, Ki up to 2.16 microM.') then raise exception 'citation C079: id collision or missing'; end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- Verification: raise if any old wrong value survives
-- -----------------------------------------------------------------------------
do $do$
declare bad text;
begin
  select string_agg(h.herb_id || '.' || kv.key, ', ') into bad
    from public.herbs h, jsonb_each(to_jsonb(h)) kv
   where h.herb_id in ('H274','H281','H282','H283','H284','H285','H286','H287','H288','H289','H290',
                       'H291','H292','H293','H294','H295','H296','H297','H298','H299','H300')
     and kv.value::text ~* '(needs review|see flags)';
  if bad is not null then raise exception 'draft notes remain: %', bad; end if;

  if exists (select 1 from public.herbs where herb_id = 'H299'
             and (cautions ~ '1 to 2 weeks' or dosage_notes ~ '1 to 2 weeks'
                  or breastfeeding_safety !~ '^Contraindicated'
                  or breastfeeding_safety ~ 'possibly unsafe'
                  or chief_complaints ~* 'menses')) then
    raise exception 'H299 duration / breastfeeding / menses text not corrected';
  end if;

  if exists (select 1 from public.herbs_complaints
              where (herb_id, complaint_id) in (('H299','CP30'),('H299','CP20'),('H300','CP30'),('H282','CP30'),('H282','CP31'))) then
    raise exception 'menstrual complaint links remain';
  end if;
  if exists (select 1 from public.herbs where herb_id = 'H282' and chief_complaints ~* 'amenorrh') then
    raise exception 'H282 chief_complaints still lists amenorrhea';
  end if;

  if exists (select 1 from public.herbs where herb_id = 'H296'
             and (dosage_notes ~* '(UVA|few minutes)'
                  or position('Topical use with light exposure only under the care of a qualified practitioner, because of liver and light toxicity.' in dosage_notes) = 0)) then
    raise exception 'H296 home light-exposure instructions remain';
  end if;

  if exists (select 1 from public.herbs where herb_id = 'H287'
             and (position('1.5-3 g' in dosage_notes) > 0 or children_safety ~* 'older children')) then
    raise exception 'H287 dose or children wording not corrected';
  end if;

  if exists (select 1 from public.herbs where herb_id = 'H298'
             and (position('4-40%' in dosage_notes) > 0 or position('4-40%' in preparation_methods) > 0
                  or pregnancy_safety ~* 'uterine')) then
    raise exception 'H298 topical strength or uterine caution not corrected';
  end if;

  if not exists (select 1 from public.herbs where herb_id = 'H293' and latin_name = 'Krameria lappacea') then
    raise exception 'H293 latin_name not corrected';
  end if;
  if not exists (select 1 from public.herb_synonyms where herb_id = 'H293' and synonym_phrase = 'Krameria triandra') then
    raise exception 'H293 synonym missing';
  end if;

  if exists (select 1 from public.herbs where herb_id = 'H295' and pregnancy_safety ~* 'likely unsafe') then
    raise exception 'H295 pregnancy still says likely unsafe';
  end if;

  if exists (select 1 from public.herbs where herb_id = 'H288'
             and (pregnancy_safety ~* '(placenta|kernicterus)' or dosage_notes ~ 'Standardized berberine')) then
    raise exception 'H288 MotherToBaby claims or berberine dose label not corrected';
  end if;

  if exists (select 1 from public.herbs h where h.herb_id = 'H285' and to_jsonb(h)::text ~ 'e28983') then
    raise exception 'H285 still cites e28983';
  end if;

  if exists (select 1 from public.herbs h where h.herb_id in ('H284','H299') and to_jsonb(h)::text ~ 'Herbal Contraindications') then
    raise exception 'H284/H299 Brinker title not corrected';
  end if;

  if exists (select 1 from public.herbs where herb_id = 'H289' and dosage_notes ~* 'purgative dose') then
    raise exception 'H289 purge dose remains';
  end if;

  if (select count(*) from public.citations_herbs
       where citation_id between 'C065' and 'C079' and field_cited = 'Clinical profile / safety') <> 15 then
    raise exception 'expected 15 new citations_herbs links';
  end if;
end
$do$;

commit;
