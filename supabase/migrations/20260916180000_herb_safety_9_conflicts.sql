-- =============================================================================
-- Eden Apothecary: safety guidance corrections for 8 herbs where the database was
-- weaker than a reputable source (verdict GUIDANCE CONFLICTS in the AHPA check).
-- DATA-ONLY migration. Written 2026-09-15, NOT applied.
-- =============================================================================
-- *** HELD FOR FOUNDER APPROVAL. NOT APPROVED. Do not apply until Camila signs off on
-- *** "Herb safety fixes for approval (8 herbs).docx".
--
-- ORDER: apply 20260916170000_ahpa_class_labels_kava_shankhpushpi.sql FIRST. Several guard
-- values below (H080 secondary_citation, H114 contraindications_general, H127
-- pregnancy_safety / breastfeeding_safety, CI361 / CI362 / CI367 source_citation) are the
-- values that migration leaves behind (live 2026-09-15 plus its "(not verified against
-- AHPA)" labels). Run before it, those blocks RAISE and nothing is written.
--
-- Concurrency guard: every UPDATE matches the full expected value; otherwise the block
-- RAISEs, unless the field already holds the corrected value (re-run is a no-op).
--
-- Herbs: H049 red clover, H076 arnica, H080 blessed thistle, H114 white horehound,
-- H127 senna, H142 Baikal skullcap, H168 Chinese rhubarb, H222 tormentil.
-- H238 shankhpushpi (9th conflict) is EXCLUDED: hidden by 20260916170000 pending
-- species identity research.
--
-- Sources (all opened by the researchers, quotes in ahpa_check.json):
--   EMA/HMPC monographs (arnica, blessed thistle, white horehound, senna, rhubarb, tormentil),
--   NIH LactMed (blessed thistle, senna), NIH LiverTox (skullcap), MSKCC (red clover,
--   Baikal skullcap), NCCIH (red clover).
-- Senna breastfeeding wording is the founder's own text (2026-09-15).
--
-- herbs.last_updated is set to now() on every changed herbs row (existing convention).
-- =============================================================================

begin;

-- H049.breastfeeding_safety: breastfeeding
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Phytoestrogen content. Avoid red clover while breastfeeding (MSKCC); red clover supplements may be unsafe while breastfeeding (NCCIH).',
         last_updated = now()
   where herb_id = 'H049'
     and breastfeeding_safety = 'Phytoestrogen content — avoid high medicinal doses during breastfeeding; moderate tea use likely compatible.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H049' and breastfeeding_safety = 'Phytoestrogen content. Avoid red clover while breastfeeding (MSKCC); red clover supplements may be unsafe while breastfeeding (NCCIH).') then
      raise notice 'H049.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H049.breastfeeding_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H076.pregnancy_safety: pregnancy
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid internal; topical use is not recommended in pregnancy because of insufficient data (EMA)',
         last_updated = now()
   where herb_id = 'H076'
     and pregnancy_safety = 'Avoid internal; topical on intact skin use with caution';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H076' and pregnancy_safety = 'Avoid internal; topical use is not recommended in pregnancy because of insufficient data (EMA)') then
      raise notice 'H076.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H076.pregnancy_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H076.breastfeeding_safety: breastfeeding
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Safety of topical use during breastfeeding has not been established (EMA); internal use contraindicated; homeopathic dose research does not transfer to herbal internal use.',
         last_updated = now()
   where herb_id = 'H076'
     and breastfeeding_safety = 'Topical use on intact skin safe; internal use contraindicated; homeopathic dose research does not transfer to herbal internal use.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H076' and breastfeeding_safety = 'Safety of topical use during breastfeeding has not been established (EMA); internal use contraindicated; homeopathic dose research does not transfer to herbal internal use.') then
      raise notice 'H076.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H076.breastfeeding_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H076.children_safety: children
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Not recommended for children under 12, even topically (EMA); external topical only; avoid internal',
         last_updated = now()
   where herb_id = 'H076'
     and children_safety = 'External topical only; avoid internal';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H076' and children_safety = 'Not recommended for children under 12, even topically (EMA); external topical only; avoid internal') then
      raise notice 'H076.children_safety already corrected, skipped';
    else
      raise exception 'H076.children_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI089.clinical_guidance: pregnancy record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Topical use during pregnancy is not recommended because of insufficient data (EMA); do not use internally except in homeopathic dilution.'
   where contraindication_id = 'CI089'
     and clinical_guidance = 'External use only on unbroken skin; homeopathic internal only.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI089' and clinical_guidance = 'Topical use during pregnancy is not recommended because of insufficient data (EMA); do not use internally except in homeopathic dilution.') then
      raise notice 'CI089.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI089.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI089.source_citation: pregnancy record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Commission E; AHPA; EMA/HMPC Community herbal monograph on Arnica montana flos'
   where contraindication_id = 'CI089'
     and source_citation = 'Commission E; AHPA';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI089' and source_citation = 'Commission E; AHPA; EMA/HMPC Community herbal monograph on Arnica montana flos') then
      raise notice 'CI089.source_citation already corrected, skipped';
    else
      raise exception 'CI089.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H080.breastfeeding_safety: breastfeeding
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Traditionally used as a galactagogue, but not recommended while breastfeeding because safety during lactation has not been established (EMA), and no scientifically valid clinical trials support its use for milk supply (NIH LactMed). Ensure no Asteraceae allergy in mother or infant.',
         last_updated = now()
   where herb_id = 'H080'
     and breastfeeding_safety = 'TRADITIONAL GALACTAGOGUE — moderate short-term use during active lactation is traditional; ensure no Asteraceae allergy in mother or infant.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H080' and breastfeeding_safety = 'Traditionally used as a galactagogue, but not recommended while breastfeeding because safety during lactation has not been established (EMA), and no scientifically valid clinical trials support its use for milk supply (NIH LactMed). Ensure no Asteraceae allergy in mother or infant.') then
      raise notice 'H080.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H080.breastfeeding_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H080.children_safety: children
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Not recommended for children and adolescents under 18 (EMA); bitterness usually refused',
         last_updated = now()
   where herb_id = 'H080'
     and children_safety = 'Not commonly indicated; bitterness usually refused; very-low-dose for digestive issues in older children only';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H080' and children_safety = 'Not recommended for children and adolescents under 18 (EMA); bitterness usually refused') then
      raise notice 'H080.children_safety already corrected, skipped';
    else
      raise exception 'H080.children_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI187.clinical_guidance: pregnancy record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Avoid during pregnancy. Use while breastfeeding is also not recommended (EMA).'
   where contraindication_id = 'CI187'
     and clinical_guidance = 'Avoid during pregnancy; traditionally used once lactation is established.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI187' and clinical_guidance = 'Avoid during pregnancy. Use while breastfeeding is also not recommended (EMA).') then
      raise notice 'CI187.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI187.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI187.source_citation: pregnancy record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Commission E (S11); AHPA (S14); EMA/HMPC EU herbal monograph on Cnicus benedictus herba'
   where contraindication_id = 'CI187'
     and source_citation = 'Commission E (S11); AHPA (S14)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI187' and source_citation = 'Commission E (S11); AHPA (S14); EMA/HMPC EU herbal monograph on Cnicus benedictus herba') then
      raise notice 'CI187.source_citation already corrected, skipped';
    else
      raise exception 'CI187.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H080.secondary_citation: citation locator breastfeeding claim
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm", "kind": "commission_e_ahpa", "year": 1990, "title": "German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.", "author": "German Federal Health Agency Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional, but the EMA monograph does not recommend use during lactation because safety has not been established (EMA)."}'::jsonb,
         last_updated = now()
   where herb_id = 'H080'
     and secondary_citation = '{"url": "https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm", "kind": "commission_e_ahpa", "year": 1990, "title": "German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.", "author": "German Federal Health Agency Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional and the AHPA notes no contraindication for short-term moderate use during established breastfeeding when no Asteraceae allergy is present."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H080' and secondary_citation = '{"url": "https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm", "kind": "commission_e_ahpa", "year": 1990, "title": "German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.", "author": "German Federal Health Agency Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional, but the EMA monograph does not recommend use during lactation because safety has not been established (EMA)."}'::jsonb) then
      raise notice 'H080.secondary_citation already corrected, skipped';
    else
      raise exception 'H080.secondary_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H114.contraindications_general: contraindications
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'Pregnancy (traditional emmenagogue and reputed abortifacient; AHPA Botanical Safety Handbook Class 2b (not verified against AHPA)). Known allergy to Lamiaceae-family plants. Obstruction of the bile duct, cholangitis, liver disease, and ileus (bowel obstruction) (EMA). People with peptic ulcer, gallstones or other biliary disorders should see a doctor before use (EMA).',
         last_updated = now()
   where herb_id = 'H114'
     and contraindications_general = 'Pregnancy (traditional emmenagogue and reputed abortifacient; AHPA Botanical Safety Handbook Class 2b (not verified against AHPA)). Known allergy to Lamiaceae-family plants.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H114' and contraindications_general = 'Pregnancy (traditional emmenagogue and reputed abortifacient; AHPA Botanical Safety Handbook Class 2b (not verified against AHPA)). Known allergy to Lamiaceae-family plants. Obstruction of the bile duct, cholangitis, liver disease, and ileus (bowel obstruction) (EMA). People with peptic ulcer, gallstones or other biliary disorders should see a doctor before use (EMA).') then
      raise notice 'H114.contraindications_general already corrected, skipped';
    else
      raise exception 'H114.contraindications_general: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H114.children_safety: children
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Insufficient robust data. The use in children under 12 years is not recommended (EMA). Source: EMA Community herbal monograph on Marrubium vulgare herba (2013); AHPA Botanical Safety Handbook, 2nd ed.; traditional pediatric guidance.',
         last_updated = now()
   where herb_id = 'H114'
     and children_safety = 'Insufficient robust data. Short-term use of standard cough preparations is traditional in older children, but avoid concentrated extracts in young children and avoid entirely in infants; traditional guidance restricts internal use under about 6 years. Source: AHPA Botanical Safety Handbook, 2nd ed.; traditional pediatric guidance.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H114' and children_safety = 'Insufficient robust data. The use in children under 12 years is not recommended (EMA). Source: EMA Community herbal monograph on Marrubium vulgare herba (2013); AHPA Botanical Safety Handbook, 2nd ed.; traditional pediatric guidance.') then
      raise notice 'H114.children_safety already corrected, skipped';
    else
      raise exception 'H114.children_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H127.pregnancy_safety: pregnancy
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Contraindicated in pregnancy (EMA), because of experimental data concerning a genotoxic risk of several anthranoids. AHPA Botanical Safety Handbook Class 2b (not verified against AHPA) (not to be used during pregnancy except under qualified supervision); stimulant laxatives are second-line to bulk-forming agents. Sources: EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed.; WHO Monographs on Selected Medicinal Plants, Vol. 1 (Folium Sennae).',
         last_updated = now()
   where herb_id = 'H127'
     and pregnancy_safety = 'Avoid; caution. AHPA Botanical Safety Handbook Class 2b (not verified against AHPA) (not to be used during pregnancy except under qualified supervision); stimulant laxatives are second-line to bulk-forming agents. If used at all, keep short-term and low-dose. Sources: AHPA Botanical Safety Handbook, 2nd ed.; WHO Monographs on Selected Medicinal Plants, Vol. 1 (Folium Sennae).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and pregnancy_safety = 'Contraindicated in pregnancy (EMA), because of experimental data concerning a genotoxic risk of several anthranoids. AHPA Botanical Safety Handbook Class 2b (not verified against AHPA) (not to be used during pregnancy except under qualified supervision); stimulant laxatives are second-line to bulk-forming agents. Sources: EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed.; WHO Monographs on Selected Medicinal Plants, Vol. 1 (Folium Sennae).') then
      raise notice 'H127.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H127.pregnancy_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H127.breastfeeding_safety: breastfeeding (founder wording)
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Sources disagree on breastfeeding: the EMA advises against senna while breastfeeding; NIH LactMed considers occasional use acceptable because little reaches the milk. Avoid unless a practitioner advises it. Sources: NIH LactMed; EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).',
         last_updated = now()
   where herb_id = 'H127'
     and breastfeeding_safety = 'Compatible in recommended short-term amounts. Only minimal sennoside metabolites reach breast milk and monitoring shows no reliable change in infant stool frequency or consistency; avoid high or prolonged doses. Sources: NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and breastfeeding_safety = 'Sources disagree on breastfeeding: the EMA advises against senna while breastfeeding; NIH LactMed considers occasional use acceptable because little reaches the milk. Avoid unless a practitioner advises it. Sources: NIH LactMed; EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).') then
      raise notice 'H127.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H127.breastfeeding_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H127.children_safety: children
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Contraindicated in children under 12 years (EMA). Sources: EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; ESCOP Monographs, 2nd ed.; German Commission E (Sennae folium).',
         last_updated = now()
   where herb_id = 'H127'
     and children_safety = 'Not for children under 10 to 12 years except under medical supervision; professionally dosed pediatric sennoside products exist. Sources: ESCOP Monographs, 2nd ed.; German Commission E (Sennae folium).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and children_safety = 'Contraindicated in children under 12 years (EMA). Sources: EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; ESCOP Monographs, 2nd ed.; German Commission E (Sennae folium).') then
      raise notice 'H127.children_safety already corrected, skipped';
    else
      raise exception 'H127.children_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H127.cautions: duration
do $do$
declare n int;
begin
  update public.herbs
     set cautions = 'Expect cramping and griping; combine with a carminative (ginger, fennel) and start with the lowest dose. Not for long-term use (not more than 1 week, EMA): risk of laxative dependence, melanosis coli, and fluid or electrolyte depletion. Harmless reddish-brown urine discoloration may occur.',
         last_updated = now()
   where herb_id = 'H127'
     and cautions = 'Expect cramping and griping; combine with a carminative (ginger, fennel) and start with the lowest dose. Not for long-term use (limit to 1 to 2 weeks): risk of laxative dependence, melanosis coli, and fluid or electrolyte depletion. Harmless reddish-brown urine discoloration may occur.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and cautions = 'Expect cramping and griping; combine with a carminative (ginger, fennel) and start with the lowest dose. Not for long-term use (not more than 1 week, EMA): risk of laxative dependence, melanosis coli, and fluid or electrolyte depletion. Harmless reddish-brown urine discoloration may occur.') then
      raise notice 'H127.cautions already corrected, skipped';
    else
      raise exception 'H127.cautions: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H127.dosage_notes: duration
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Dried leaf: 0.5 to 2 g as an infusion, once at bedtime. Standardized: 15 to 30 mg sennosides (hydroxyanthracene derivatives) per day. Use the lowest effective dose; do not use for more than 1 week (EMA).',
         last_updated = now()
   where herb_id = 'H127'
     and dosage_notes = 'Dried leaf: 0.5 to 2 g as an infusion, once at bedtime. Standardized: 15 to 30 mg sennosides (hydroxyanthracene derivatives) per day. Use the lowest effective dose; do not exceed 1 to 2 weeks without professional guidance.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and dosage_notes = 'Dried leaf: 0.5 to 2 g as an infusion, once at bedtime. Standardized: 15 to 30 mg sennosides (hydroxyanthracene derivatives) per day. Use the lowest effective dose; do not use for more than 1 week (EMA).') then
      raise notice 'H127.dosage_notes already corrected, skipped';
    else
      raise exception 'H127.dosage_notes: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI361.clinical_guidance: pregnancy record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Contraindicated in pregnancy (EMA); use bulk-forming laxatives first.'
   where contraindication_id = 'CI361'
     and clinical_guidance = 'Avoid; use bulk-forming laxatives first. If necessary, short-term low dose under qualified supervision only.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI361' and clinical_guidance = 'Contraindicated in pregnancy (EMA); use bulk-forming laxatives first.') then
      raise notice 'CI361.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI361.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI361.source_citation: pregnancy record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).'
   where contraindication_id = 'CI361'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI361' and source_citation = 'EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).') then
      raise notice 'CI361.source_citation already corrected, skipped';
    else
      raise exception 'CI361.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI362.clinical_guidance: breastfeeding record (founder wording)
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Sources disagree on breastfeeding: the EMA advises against senna while breastfeeding; NIH LactMed considers occasional use acceptable because little reaches the milk. Avoid unless a practitioner advises it.'
   where contraindication_id = 'CI362'
     and clinical_guidance = 'Compatible in recommended short-term amounts; avoid high or prolonged dosing.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI362' and clinical_guidance = 'Sources disagree on breastfeeding: the EMA advises against senna while breastfeeding; NIH LactMed considers occasional use acceptable because little reaches the milk. Avoid unless a practitioner advises it.') then
      raise notice 'CI362.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI362.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI362.source_citation: breastfeeding record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'NIH LactMed; EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).'
   where contraindication_id = 'CI362'
     and source_citation = 'NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI362' and source_citation = 'NIH LactMed; EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).') then
      raise notice 'CI362.source_citation already corrected, skipped';
    else
      raise exception 'CI362.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI366.interacting_entity: children record
do $do$
declare n int;
begin
  update public.contraindications
     set interacting_entity = 'Children under 12 years'
   where contraindication_id = 'CI366'
     and interacting_entity = 'Children under 10 to 12 years';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI366' and interacting_entity = 'Children under 12 years') then
      raise notice 'CI366.interacting_entity already corrected, skipped';
    else
      raise exception 'CI366.interacting_entity: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI366.clinical_guidance: children record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Contraindicated in children under 12 years (EMA).'
   where contraindication_id = 'CI366'
     and clinical_guidance = 'Use only under medical supervision with appropriate pediatric dosing.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI366' and clinical_guidance = 'Contraindicated in children under 12 years (EMA).') then
      raise notice 'CI366.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI366.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI366.source_citation: children record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; German Commission E (Sennae folium); ESCOP Monographs, 2nd ed.'
   where contraindication_id = 'CI366'
     and source_citation = 'German Commission E (Sennae folium); ESCOP Monographs, 2nd ed.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI366' and source_citation = 'EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; German Commission E (Sennae folium); ESCOP Monographs, 2nd ed.') then
      raise notice 'CI366.source_citation already corrected, skipped';
    else
      raise exception 'CI366.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI367.interacting_entity: duration record
do $do$
declare n int;
begin
  update public.contraindications
     set interacting_entity = 'Long-term or habitual use (over 1 week)'
   where contraindication_id = 'CI367'
     and interacting_entity = 'Long-term or habitual use (over 1 to 2 weeks)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI367' and interacting_entity = 'Long-term or habitual use (over 1 week)') then
      raise notice 'CI367.interacting_entity already corrected, skipped';
    else
      raise exception 'CI367.interacting_entity: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI367.clinical_guidance: duration record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Do not use for more than 1 week (EMA); address the underlying cause; taper if habituated.'
   where contraindication_id = 'CI367'
     and clinical_guidance = 'Limit to 1 to 2 weeks; address the underlying cause; taper if habituated.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI367' and clinical_guidance = 'Do not use for more than 1 week (EMA); address the underlying cause; taper if habituated.') then
      raise notice 'CI367.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI367.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI367.source_citation: duration record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2d (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).'
   where contraindication_id = 'CI367'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2d (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI367' and source_citation = 'EMA EU herbal monograph on Senna alexandrina folium, Rev. 1; AHPA Botanical Safety Handbook, 2nd ed. (Class 2d (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).') then
      raise notice 'CI367.source_citation already corrected, skipped';
    else
      raise exception 'CI367.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H142.cautions: liver warning
do $do$
declare n int;
begin
  update public.herbs
     set cautions = 'Cold, bitter, and drying. Prolonged or high-dose use can injure Spleen yang and body fluids, producing cold diarrhea, poor appetite, or dryness. Not for cold or deficient presentations. Baikal skullcap itself may harm the liver. Acute liver injury with jaundice has been reported after 1 to 3 months of products containing Chinese skullcap (NIH LiverTox), and hepatotoxicity and pneumonitis (lung inflammation) are listed as adverse reactions (MSKCC). Stop use and seek medical care if jaundice, dark urine, or right-upper-quadrant pain develop.',
         last_updated = now()
   where herb_id = 'H142'
     and cautions = 'Cold, bitter, and drying. Prolonged or high-dose use can injure Spleen yang and body fluids, producing cold diarrhea, poor appetite, or dryness. Not for cold or deficient presentations.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H142' and cautions = 'Cold, bitter, and drying. Prolonged or high-dose use can injure Spleen yang and body fluids, producing cold diarrhea, poor appetite, or dryness. Not for cold or deficient presentations. Baikal skullcap itself may harm the liver. Acute liver injury with jaundice has been reported after 1 to 3 months of products containing Chinese skullcap (NIH LiverTox), and hepatotoxicity and pneumonitis (lung inflammation) are listed as adverse reactions (MSKCC). Stop use and seek medical care if jaundice, dark urine, or right-upper-quadrant pain develop.') then
      raise notice 'H142.cautions already corrected, skipped';
    else
      raise exception 'H142.cautions: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H168.cautions: duration
do $do$
declare n int;
begin
  update public.herbs
     set cautions = 'A stimulant (anthranoid) purgative for short-term use only, not more than 1 week (EMA). Prolonged or habitual use can cause dependence, loss of colonic tone, potassium and fluid depletion, and melanosis coli (a benign, reversible dark pigmentation of the bowel lining). May cause griping and colic, so it is classically combined with warming carminatives. Harmless yellow-brown or reddish discoloration of the urine can occur. The root contains oxalates (far less than the toxic leaf blade, which is never used medicinally), so use caution with a history of calcium-oxalate kidney stones, gout or hyperoxaluria. High doses over long periods have been associated with liver concerns in some reports.',
         last_updated = now()
   where herb_id = 'H168'
     and cautions = 'A stimulant (anthranoid) purgative for short-term use only, generally not beyond 1 to 2 weeks. Prolonged or habitual use can cause dependence, loss of colonic tone, potassium and fluid depletion, and melanosis coli (a benign, reversible dark pigmentation of the bowel lining). May cause griping and colic, so it is classically combined with warming carminatives. Harmless yellow-brown or reddish discoloration of the urine can occur. The root contains oxalates (far less than the toxic leaf blade, which is never used medicinally), so use caution with a history of calcium-oxalate kidney stones, gout or hyperoxaluria. High doses over long periods have been associated with liver concerns in some reports.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H168' and cautions = 'A stimulant (anthranoid) purgative for short-term use only, not more than 1 week (EMA). Prolonged or habitual use can cause dependence, loss of colonic tone, potassium and fluid depletion, and melanosis coli (a benign, reversible dark pigmentation of the bowel lining). May cause griping and colic, so it is classically combined with warming carminatives. Harmless yellow-brown or reddish discoloration of the urine can occur. The root contains oxalates (far less than the toxic leaf blade, which is never used medicinally), so use caution with a history of calcium-oxalate kidney stones, gout or hyperoxaluria. High doses over long periods have been associated with liver concerns in some reports.') then
      raise notice 'H168.cautions already corrected, skipped';
    else
      raise exception 'H168.cautions: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H168.contraindications_general: children
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'Contraindicated in pregnancy and lactation. Contraindicated in intestinal obstruction or ileus, acute inflammatory bowel disease (Crohn''s disease, ulcerative colitis), appendicitis or other acute inflamed abdomen, and abdominal pain of unknown origin (per Commission E for anthranoid laxatives). Contraindicated in children under 12 years (EMA). Use caution in calcium-oxalate kidney stone disease. Avoid in cold, deficient, dry or exhausted constitutions except within a corrective formula.',
         last_updated = now()
   where herb_id = 'H168'
     and contraindications_general = 'Contraindicated in pregnancy and lactation. Contraindicated in intestinal obstruction or ileus, acute inflammatory bowel disease (Crohn''s disease, ulcerative colitis), appendicitis or other acute inflamed abdomen, and abdominal pain of unknown origin (per Commission E for anthranoid laxatives). Not recommended as a laxative for children under 12 except under professional supervision. Use caution in calcium-oxalate kidney stone disease. Avoid in cold, deficient, dry or exhausted constitutions except within a corrective formula.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H168' and contraindications_general = 'Contraindicated in pregnancy and lactation. Contraindicated in intestinal obstruction or ileus, acute inflammatory bowel disease (Crohn''s disease, ulcerative colitis), appendicitis or other acute inflamed abdomen, and abdominal pain of unknown origin (per Commission E for anthranoid laxatives). Contraindicated in children under 12 years (EMA). Use caution in calcium-oxalate kidney stone disease. Avoid in cold, deficient, dry or exhausted constitutions except within a corrective formula.') then
      raise notice 'H168.contraindications_general already corrected, skipped';
    else
      raise exception 'H168.contraindications_general: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H168.children_safety: children
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Contraindicated in children under 12 years (EMA); anthranoid stimulant laxatives carry a risk of fluid and electrolyte disturbance. Basis: EMA/HMPC EU herbal monograph on Rheum palmatum and Rheum officinale radix, Rev. 1; Commission E and ESCOP guidance for stimulant (anthranoid) laxatives; NCCIH-style insufficient-data precaution for pediatric use.',
         last_updated = now()
   where herb_id = 'H168'
     and children_safety = 'Not recommended as a laxative for children under 12 except under professional supervision, consistent with general guidance for anthranoid stimulant laxatives, because of the risk of fluid and electrolyte disturbance. Small, brief, low-dose use for damp-heat conditions belongs to supervised practice, not home self-treatment. Basis: Commission E and ESCOP guidance for stimulant (anthranoid) laxatives; NCCIH-style insufficient-data precaution for pediatric use.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H168' and children_safety = 'Contraindicated in children under 12 years (EMA); anthranoid stimulant laxatives carry a risk of fluid and electrolyte disturbance. Basis: EMA/HMPC EU herbal monograph on Rheum palmatum and Rheum officinale radix, Rev. 1; Commission E and ESCOP guidance for stimulant (anthranoid) laxatives; NCCIH-style insufficient-data precaution for pediatric use.') then
      raise notice 'H168.children_safety already corrected, skipped';
    else
      raise exception 'H168.children_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H168.dosage_notes: duration
do $do$
declare n int;
begin
  update public.herbs
     set dosage_notes = 'Decoction, purgative: 6 to 12 g dried root daily, added in the last 5 to 10 minutes of cooking. Decoction or powder, low-dose bitter/astringent or hemostatic use: 1 to 3 g daily (powder 0.5 to 1 g). Tincture (1:5): 1 to 2 mL up to three times daily. Use for the shortest effective period, not more than 1 week (EMA). Topical: powder made into a paste as needed.',
         last_updated = now()
   where herb_id = 'H168'
     and dosage_notes = 'Decoction, purgative: 6 to 12 g dried root daily, added in the last 5 to 10 minutes of cooking. Decoction or powder, low-dose bitter/astringent or hemostatic use: 1 to 3 g daily (powder 0.5 to 1 g). Tincture (1:5): 1 to 2 mL up to three times daily. Use for the shortest effective period, typically no more than 1 to 2 weeks. Topical: powder made into a paste as needed.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H168' and dosage_notes = 'Decoction, purgative: 6 to 12 g dried root daily, added in the last 5 to 10 minutes of cooking. Decoction or powder, low-dose bitter/astringent or hemostatic use: 1 to 3 g daily (powder 0.5 to 1 g). Tincture (1:5): 1 to 2 mL up to three times daily. Use for the shortest effective period, not more than 1 week (EMA). Topical: powder made into a paste as needed.') then
      raise notice 'H168.dosage_notes already corrected, skipped';
    else
      raise exception 'H168.dosage_notes: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H168.refer_threshold: duration
do $do$
declare n int;
begin
  update public.herbs
     set refer_threshold = 'Refer for constipation lasting more than about a week or with severe or localized abdominal pain, any sign of bowel obstruction, appendicitis or an acute rigid abdomen, rectal bleeding or black tarry stools, vomiting of blood, new jaundice, suspected or known pregnancy (avoid entirely), children under 12, or any self-treatment with a stimulant laxative continuing beyond 1 week (EMA). Those taking digoxin, diuretics or antiarrhythmic drugs should coordinate use with their prescriber.',
         last_updated = now()
   where herb_id = 'H168'
     and refer_threshold = 'Refer for constipation lasting more than about a week or with severe or localized abdominal pain, any sign of bowel obstruction, appendicitis or an acute rigid abdomen, rectal bleeding or black tarry stools, vomiting of blood, new jaundice, suspected or known pregnancy (avoid entirely), children under 12, or any self-treatment with a stimulant laxative continuing beyond 1 to 2 weeks. Those taking digoxin, diuretics or antiarrhythmic drugs should coordinate use with their prescriber.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H168' and refer_threshold = 'Refer for constipation lasting more than about a week or with severe or localized abdominal pain, any sign of bowel obstruction, appendicitis or an acute rigid abdomen, rectal bleeding or black tarry stools, vomiting of blood, new jaundice, suspected or known pregnancy (avoid entirely), children under 12, or any self-treatment with a stimulant laxative continuing beyond 1 week (EMA). Those taking digoxin, diuretics or antiarrhythmic drugs should coordinate use with their prescriber.') then
      raise notice 'H168.refer_threshold already corrected, skipped';
    else
      raise exception 'H168.refer_threshold: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI650.clinical_guidance: children and duration record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Do not use in children under 12 (EMA: contraindicated); do not use for more than 1 week (EMA); use caution with a history of calcium-oxalate stones.'
   where contraindication_id = 'CI650'
     and clinical_guidance = 'Avoid as a home laxative in children under 12; limit to 1 to 2 weeks; use caution with a history of calcium-oxalate stones.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI650' and clinical_guidance = 'Do not use in children under 12 (EMA: contraindicated); do not use for more than 1 week (EMA); use caution with a history of calcium-oxalate stones.') then
      raise notice 'CI650.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI650.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI650.source_citation: children and duration record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'EMA/HMPC EU herbal monograph on Rheum palmatum and Rheum officinale radix, Rev. 1; Commission E and ESCOP (stimulant laxatives, children under 12; short-term use); Memorial Sloan Kettering About Herbs (oxalate/kidney).'
   where contraindication_id = 'CI650'
     and source_citation = 'Commission E and ESCOP (stimulant laxatives, children under 12; short-term use); Memorial Sloan Kettering About Herbs (oxalate/kidney).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI650' and source_citation = 'EMA/HMPC EU herbal monograph on Rheum palmatum and Rheum officinale radix, Rev. 1; Commission E and ESCOP (stimulant laxatives, children under 12; short-term use); Memorial Sloan Kettering About Herbs (oxalate/kidney).') then
      raise notice 'CI650.source_citation already corrected, skipped';
    else
      raise exception 'CI650.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H222.children_safety: children
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Not recommended for children and adolescents under 18, because adequate data are lacking (EMA). A randomized, double-blind, controlled trial of tormentil root extract in children aged three months to seven years with rotavirus diarrhea (Subbotina 2003) shortened the diarrhea and reduced rehydration needs at an age-scaled dose, with good tolerance and no serious adverse effects reported. Even so, there is no established general pediatric dosing, and childhood diarrhea can dehydrate quickly, so oral rehydration and clinical assessment come first and self-treatment of an ill infant is not appropriate. Sources: EMA/HMPC Community herbal monograph on Potentilla erecta rhizoma; Subbotina et al., Pediatric Infectious Disease Journal, 2003; WebMD/NMCD Tormentil monograph.',
         last_updated = now()
   where herb_id = 'H222'
     and children_safety = 'Low toxicity, and unusually well studied in children for a folk astringent, but still to be used with care and, ideally, professional guidance. A randomized, double-blind, controlled trial of tormentil root extract in children aged three months to seven years with rotavirus diarrhea (Subbotina 2003) shortened the diarrhea and reduced rehydration needs at an age-scaled dose, with good tolerance and no serious adverse effects reported. This supports short-term, dose-appropriate use in acute childhood diarrhea under supervision, but there is no established general pediatric dosing, and childhood diarrhea can dehydrate quickly, so oral rehydration and clinical assessment come first and self-treatment of an ill infant is not appropriate. Sources: Subbotina et al., Pediatric Infectious Disease Journal, 2003; WebMD/NMCD Tormentil monograph.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H222' and children_safety = 'Not recommended for children and adolescents under 18, because adequate data are lacking (EMA). A randomized, double-blind, controlled trial of tormentil root extract in children aged three months to seven years with rotavirus diarrhea (Subbotina 2003) shortened the diarrhea and reduced rehydration needs at an age-scaled dose, with good tolerance and no serious adverse effects reported. Even so, there is no established general pediatric dosing, and childhood diarrhea can dehydrate quickly, so oral rehydration and clinical assessment come first and self-treatment of an ill infant is not appropriate. Sources: EMA/HMPC Community herbal monograph on Potentilla erecta rhizoma; Subbotina et al., Pediatric Infectious Disease Journal, 2003; WebMD/NMCD Tormentil monograph.') then
      raise notice 'H222.children_safety already corrected, skipped';
    else
      raise exception 'H222.children_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- H222.breastfeeding_safety: breastfeeding
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Modern data are limited and sources differ. The EU herbal monograph does not recommend tormentil while breastfeeding, because safety during lactation has not been established (EMA). The general supplement monographs (WebMD/NMCD) advise avoiding tormentil while breastfeeding for want of reliable information. The lactation-specific reference e-lactancia notes that no data on excretion into milk have been found but that, given the herb''s lack of toxicity at appropriate doses and its poorly absorbed tannins, moderate use is likely compatible with breastfeeding. On balance: avoid medicinal use while nursing unless a practitioner advises it. Sources: EMA/HMPC Community herbal monograph on Potentilla erecta rhizoma; WebMD/NMCD Tormentil monograph; e-lactancia.org Tormentil entry.',
         last_updated = now()
   where herb_id = 'H222'
     and breastfeeding_safety = 'Modern data are limited and sources differ; use only with care. The general supplement monographs (WebMD/NMCD) advise avoiding tormentil while breastfeeding for want of reliable information. The lactation-specific reference e-lactancia notes that no data on excretion into milk have been found but that, given the herb''s lack of toxicity at appropriate doses and its poorly absorbed tannins, moderate use is likely compatible with breastfeeding. On balance: avoid large or prolonged medicinal doses while nursing, favor short courses at ordinary doses if used at all, and prefer professional guidance. Sources: WebMD/NMCD Tormentil monograph; e-lactancia.org Tormentil entry.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H222' and breastfeeding_safety = 'Modern data are limited and sources differ. The EU herbal monograph does not recommend tormentil while breastfeeding, because safety during lactation has not been established (EMA). The general supplement monographs (WebMD/NMCD) advise avoiding tormentil while breastfeeding for want of reliable information. The lactation-specific reference e-lactancia notes that no data on excretion into milk have been found but that, given the herb''s lack of toxicity at appropriate doses and its poorly absorbed tannins, moderate use is likely compatible with breastfeeding. On balance: avoid medicinal use while nursing unless a practitioner advises it. Sources: EMA/HMPC Community herbal monograph on Potentilla erecta rhizoma; WebMD/NMCD Tormentil monograph; e-lactancia.org Tormentil entry.') then
      raise notice 'H222.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H222.breastfeeding_safety: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI1011.clinical_guidance: breastfeeding record
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Not recommended while breastfeeding (EMA); avoid medicinal use while nursing unless a practitioner advises it.'
   where contraindication_id = 'CI1011'
     and clinical_guidance = 'Avoid large or prolonged medicinal doses while nursing; if used, favor short courses at ordinary doses, ideally with professional guidance.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1011' and clinical_guidance = 'Not recommended while breastfeeding (EMA); avoid medicinal use while nursing unless a practitioner advises it.') then
      raise notice 'CI1011.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI1011.clinical_guidance: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- CI1011.source_citation: breastfeeding record source
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'EMA/HMPC Community herbal monograph on Potentilla erecta rhizoma (not recommended during lactation); e-lactancia.org Tormentil (low risk, likely compatible in moderation); WebMD/NMCD Tormentil monograph (avoid, insufficient data).'
   where contraindication_id = 'CI1011'
     and source_citation = 'e-lactancia.org Tormentil (low risk, likely compatible in moderation); WebMD/NMCD Tormentil monograph (avoid, insufficient data).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1011' and source_citation = 'EMA/HMPC Community herbal monograph on Potentilla erecta rhizoma (not recommended during lactation); e-lactancia.org Tormentil (low risk, likely compatible in moderation); WebMD/NMCD Tormentil monograph (avoid, insufficient data).') then
      raise notice 'CI1011.source_citation already corrected, skipped';
    else
      raise exception 'CI1011.source_citation: live value no longer matches the value expected after 20260916170000 (read 2026-09-15; apply 20260916170000 first); not updated';
    end if;
  end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
do $v1$
declare bad text[] := '{}';
begin
  if not exists (select 1 from public.herbs where herb_id = 'H049' and md5(breastfeeding_safety) = 'acc09802fc7a96e5ae272785e1a5ea60') then bad := bad || 'H049.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H076' and md5(pregnancy_safety) = '40bd6939a08723abd0c440f527044b3a') then bad := bad || 'H076.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H076' and md5(breastfeeding_safety) = 'b4d6aa5e7d0a3f9f583598cf7ca9835a') then bad := bad || 'H076.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H076' and md5(children_safety) = 'c7e1cc8e3c35e75ad0ad754ce0ddab13') then bad := bad || 'H076.children_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI089' and md5(clinical_guidance) = 'ec8a4b214ce9f8bb48d838498e0a8de8') then bad := bad || 'CI089.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI089' and md5(source_citation) = '6f13001ab523c1874b8382360cd23dce') then bad := bad || 'CI089.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H080' and md5(breastfeeding_safety) = '2f4d991debd5714aae1263320a5bb81f') then bad := bad || 'H080.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H080' and md5(children_safety) = '1f9dca64f156eb68ce548e41d9bba211') then bad := bad || 'H080.children_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI187' and md5(clinical_guidance) = 'b5f225d2715d277c864859a97df8dc59') then bad := bad || 'CI187.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI187' and md5(source_citation) = 'ac22aeb2e0383b3cce5912dcde295a2d') then bad := bad || 'CI187.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H080' and md5(secondary_citation->>'locator') = 'ffe0ea5dcae150b1bd6121cc4d8d16f8') then bad := bad || 'H080.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H114' and md5(contraindications_general) = '632791ef1f03eebdd54a56f1a5f7df73') then bad := bad || 'H114.contraindications_general'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H114' and md5(children_safety) = '4c50603b78a0b069b702e4f5fdfca868') then bad := bad || 'H114.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(pregnancy_safety) = '298d6e0777659988c3e8bf453abd4413') then bad := bad || 'H127.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(breastfeeding_safety) = 'eeadcfe9f752f6ad23601f3c8b247ebc') then bad := bad || 'H127.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(children_safety) = '1deb997363bfddd1640170771bc84b5a') then bad := bad || 'H127.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(cautions) = 'cd651eab7839d80cdbd5390ae60ff282') then bad := bad || 'H127.cautions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(dosage_notes) = 'a5a2ef93506b6a65cc859614a2084f01') then bad := bad || 'H127.dosage_notes'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI361' and md5(clinical_guidance) = '34be27761ec718701319aef707556d7a') then bad := bad || 'CI361.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI361' and md5(source_citation) = '450a24f9d76d456426ee96eeb8fa68ee') then bad := bad || 'CI361.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI362' and md5(clinical_guidance) = '5934ed6a26e171d577b58c8fd0828bf9') then bad := bad || 'CI362.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI362' and md5(source_citation) = 'bad76cedf80600287d80389a55baa58b') then bad := bad || 'CI362.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI366' and md5(interacting_entity) = 'ea6abcb483acb9f737a5ac43d08d8362') then bad := bad || 'CI366.interacting_entity'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI366' and md5(clinical_guidance) = '92674d3cf1cc831c57cb902b4bf547a5') then bad := bad || 'CI366.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI366' and md5(source_citation) = '4982ab777a531289c6bb007c291388c0') then bad := bad || 'CI366.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI367' and md5(interacting_entity) = 'ebcd8bd061f3a47f9a8ec92da366f7c7') then bad := bad || 'CI367.interacting_entity'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI367' and md5(clinical_guidance) = '0010c5198c235355d84850da20e8ea27') then bad := bad || 'CI367.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI367' and md5(source_citation) = '9c4a5909f8e7ee8966e181493c786d4e') then bad := bad || 'CI367.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H142' and md5(cautions) = '2e826f0e594bad757011dfcea7ce6478') then bad := bad || 'H142.cautions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H168' and md5(cautions) = '7e83829a9ac1c48136fc57aa5eea44f5') then bad := bad || 'H168.cautions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H168' and md5(contraindications_general) = 'b45330bd38910afa06d65283bbd0a4bc') then bad := bad || 'H168.contraindications_general'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H168' and md5(children_safety) = 'e3668ccd407b1b1e284a14afd8782f59') then bad := bad || 'H168.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H168' and md5(dosage_notes) = '509b021ca4e29515b3412acb4857f1ec') then bad := bad || 'H168.dosage_notes'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H168' and md5(refer_threshold) = '10e2f6315b4227006baa9225dd8d7a44') then bad := bad || 'H168.refer_threshold'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI650' and md5(clinical_guidance) = '5c7efd68870070aae34d9729393024c6') then bad := bad || 'CI650.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI650' and md5(source_citation) = '77687bdccba7367775d5f7dc4c42f45c') then bad := bad || 'CI650.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H222' and md5(children_safety) = '88f8098255efb5566e0c66715142c471') then bad := bad || 'H222.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H222' and md5(breastfeeding_safety) = '17a7157cf9c020743e38cb0ebe87fc02') then bad := bad || 'H222.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1011' and md5(clinical_guidance) = '5315c6600726abe84a72306564b68dd9') then bad := bad || 'CI1011.clinical_guidance'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1011' and md5(source_citation) = '7464aceb67e91894c1d5d5976f5f6abf') then bad := bad || 'CI1011.source_citation'::text; end if;
  if exists (select 1 from public.herbs h where h.herb_id in ('H127', 'H168') and to_jsonb(h)::text like '%1 to 2 weeks%')
     or exists (select 1 from public.contraindications c where c.herb_id in ('H127', 'H168') and to_jsonb(c)::text like '%1 to 2 weeks%') then
    bad := bad || 'a 1 to 2 week duration remains on senna or rhubarb'::text;
  end if;
  if array_length(bad, 1) > 0 then
    raise exception 'fields not at their corrected value: %', array_to_string(bad, ', ');
  end if;
end
$v1$;

commit;
