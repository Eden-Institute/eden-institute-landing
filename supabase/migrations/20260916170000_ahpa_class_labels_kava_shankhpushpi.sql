-- =============================================================================
-- Eden Apothecary: AHPA class labels, kava class, pinellia/basil edition wording,
-- and hiding H238 Shankhpushpi. DATA + VIEW migration. Written 2026-09-15, NOT applied.
-- =============================================================================
-- Founder approval: Camila approved these four changes on 2026-09-15 after the AHPA
-- safety class check (report: "AHPA safety class check (online sources).docx";
-- evidence: ahpa_check.json).
--
-- Concurrency guard: every UPDATE matches the FULL live value read on 2026-09-15
-- (read-only SELECT via the Management API; all 130 class mentions were compared
-- byte for byte with ahpa_check.json, 0 differences). If a field has been edited
-- since, nothing is overwritten: the block RAISEs, unless the field already holds
-- the corrected value (so a re-run is a no-op).
--
-- 1. "(not verified against AHPA)" appended immediately after every unverified AHPA
--    class claim. Class text itself unchanged. 121 mentions in 102 fields across
--    36 herbs (the check flagged 120 in 102 fields across 37 herbs; kava is handled
--    by item 3 instead, and two claims the check regex missed are labelled too:
--    H260 secondary_sources "and 2d", H177 CI704 mechanism_rationale "historically 2B").
--   contraindications.clinical_guidance: 1 mention(s) in 1 field(s)
--   contraindications.mechanism_rationale: 9 mention(s) in 9 field(s)
--   contraindications.source_citation: 26 mention(s) in 26 field(s)
--   herbs.breastfeeding_safety: 6 mention(s) in 6 field(s)
--   herbs.cautions: 2 mention(s) in 1 field(s)
--   herbs.children_safety: 3 mention(s) in 3 field(s)
--   herbs.contraindications_general: 5 mention(s) in 4 field(s)
--   herbs.drug_interactions: 11 mention(s) in 8 field(s)
--   herbs.pregnancy_safety: 20 mention(s) in 18 field(s)
--   herbs.secondary_citation: 28 mention(s) in 19 field(s)
--   herbs.secondary_sources: 10 mention(s) in 7 field(s)
-- 2. H183 pinellia (Class 2d) and H279 basil (Class 1): classes confirmed by AHPA's own
--    online update posts, so no label; wording now attributes the class to those posts:
--      "AHPA updates 14 entries to the online Botanical Safety Handbook, 2nd ed. in final 2022 release" (21 Dec 2022) https://www.ahpa.org/blog_home.asp?display=163
--      "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release" (7 Apr 2022) https://www.ahpa.org/blog_home.asp?display=55
-- 3. H030 kava: secondary_citation locator "AHPA BSH 2nd ed. (2013) Class 2d" becomes
--    "AHPA Class 2b and 2c, Interaction Class B (AHPA, July 2024 update) (https://www.ahpa.org/blog_home.asp?display=279)", per AHPA's post
--    "AHPA publishes new entry for kratom in the online Botanical Safety Handbook" (18 Jul 2024).
--    The plain safety advice in the same locator is unchanged.
-- 4. H238 Shankhpushpi hidden until its species identity is resolved (Latin name is
--    Canscora decussata; its safety text describes Convolvulus pluricaulis).
--    herbs.status is free text (no constraint; all 300 rows 'Approved' on 2026-09-15) and
--    is set to 'Hidden - species identity under review 2026-09-15'. The three app views filter out status LIKE 'Hidden%'.
--    Definitions are otherwise identical to live (herbs_directory_v and herbs_clinical_v
--    as written by 20260916100000_herb_tier_model; herbs_public as pg_get_viewdef).
--    CREATE OR REPLACE VIEW keeps grants and comments; it REPLACES reloptions, so the
--    live options are restated (herbs_public, herbs_clinical_v: security_invoker=false,
--    security_barrier=true; herbs_directory_v: none). Verified below against the live ACLs.
--    NOT covered by the filter (still expose H238 rows): pocket_materia_medica() reads
--    public.herbs directly (practitioner-clinical edge function); contraindications_safety_v
--    (8 H238 contraindication rows, 0 client readers in code); herbs_eden_patterns and
--    v_herb_lens_verdicts (8 surfaced H238 rows; the app only renders them against herbs
--    present in herbs_directory_v); clinical_formularies_list() (0 H238 items today).
--
-- herbs.last_updated is set to now() on every changed herbs row (existing convention).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1-3: guarded field edits
-- -----------------------------------------------------------------------------

-- H006.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Capsicum spp. entry — class 1 (not verified against AHPA); topical irritation cautions; drug-interaction notes"}'::jsonb,
         last_updated = now()
   where herb_id = 'H006'
     and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Capsicum spp. entry — class 1; topical irritation cautions; drug-interaction notes"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H006' and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Capsicum spp. entry — class 1 (not verified against AHPA); topical irritation cautions; drug-interaction notes"}'::jsonb) then
      raise notice 'H006.secondary_citation already corrected, skipped';
    else
      raise exception 'H006.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI146.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Class 1 (not verified against AHPA) (S14); Grieve (S07)'
   where contraindication_id = 'CI146'
     and source_citation = 'AHPA Class 1 (S14); Grieve (S07)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI146' and source_citation = 'AHPA Class 1 (not verified against AHPA) (S14); Grieve (S07)') then
      raise notice 'CI146.source_citation already corrected, skipped';
    else
      raise exception 'CI146.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H029.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://escop.com/downloads/horsetail/", "kind": "escop_commission_e", "year": 2003, "title": "ESCOP Monographs: Equiseti Herba / Commission E approved (1986) / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d (not verified against AHPA) — thiaminase activity destroys vitamin B1; not for prolonged daily use without B-complex co-administration; nicotine-containing tobacco co-use contraindicated; species-confusion warning (Equisetum palustre, marsh horsetail, contains palustrine and is contraindicated — confirm species E. arvense). Commission E approves Equiseti herba for post-traumatic and static oedema and supportive treatment of bacterial infections of the lower urinary tract."}'::jsonb,
         last_updated = now()
   where herb_id = 'H029'
     and secondary_citation = '{"url": "https://escop.com/downloads/horsetail/", "kind": "escop_commission_e", "year": 2003, "title": "ESCOP Monographs: Equiseti Herba / Commission E approved (1986) / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d — thiaminase activity destroys vitamin B1; not for prolonged daily use without B-complex co-administration; nicotine-containing tobacco co-use contraindicated; species-confusion warning (Equisetum palustre, marsh horsetail, contains palustrine and is contraindicated — confirm species E. arvense). Commission E approves Equiseti herba for post-traumatic and static oedema and supportive treatment of bacterial infections of the lower urinary tract."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H029' and secondary_citation = '{"url": "https://escop.com/downloads/horsetail/", "kind": "escop_commission_e", "year": 2003, "title": "ESCOP Monographs: Equiseti Herba / Commission E approved (1986) / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d (not verified against AHPA) — thiaminase activity destroys vitamin B1; not for prolonged daily use without B-complex co-administration; nicotine-containing tobacco co-use contraindicated; species-confusion warning (Equisetum palustre, marsh horsetail, contains palustrine and is contraindicated — confirm species E. arvense). Commission E approves Equiseti herba for post-traumatic and static oedema and supportive treatment of bacterial infections of the lower urinary tract."}'::jsonb) then
      raise notice 'H029.secondary_citation already corrected, skipped';
    else
      raise exception 'H029.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H049.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Trifolium pratense entry — class 1 (not verified against AHPA); isoflavone content noted; no significant adverse-event signal at typical food/beverage doses"}'::jsonb,
         last_updated = now()
   where herb_id = 'H049'
     and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Trifolium pratense entry — class 1; isoflavone content noted; no significant adverse-event signal at typical food/beverage doses"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H049' and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Trifolium pratense entry — class 1 (not verified against AHPA); isoflavone content noted; no significant adverse-event signal at typical food/beverage doses"}'::jsonb) then
      raise notice 'H049.secondary_citation already corrected, skipped';
    else
      raise exception 'H049.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H065.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.routledge.com/American-Herbal-Products-Associations-Botanical-Safety-Handbook-Second/Gardner-McGuffin/p/book/9781466516946", "kind": "ahpa_safety", "year": 2013, "title": "AHPA Botanical Safety Handbook, 2nd Edition — Prunus serotina monograph", "author": "Gardner Z, McGuffin M (eds)", "locator": "Class 2b (not verified against AHPA) cyanogenic glycoside safety profile, dosing in respiratory irritation", "identifier": "ISBN:978-1-4665-1694-2"}'::jsonb,
         last_updated = now()
   where herb_id = 'H065'
     and secondary_citation = '{"url": "https://www.routledge.com/American-Herbal-Products-Associations-Botanical-Safety-Handbook-Second/Gardner-McGuffin/p/book/9781466516946", "kind": "ahpa_safety", "year": 2013, "title": "AHPA Botanical Safety Handbook, 2nd Edition — Prunus serotina monograph", "author": "Gardner Z, McGuffin M (eds)", "locator": "Class 2b cyanogenic glycoside safety profile, dosing in respiratory irritation", "identifier": "ISBN:978-1-4665-1694-2"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H065' and secondary_citation = '{"url": "https://www.routledge.com/American-Herbal-Products-Associations-Botanical-Safety-Handbook-Second/Gardner-McGuffin/p/book/9781466516946", "kind": "ahpa_safety", "year": 2013, "title": "AHPA Botanical Safety Handbook, 2nd Edition — Prunus serotina monograph", "author": "Gardner Z, McGuffin M (eds)", "locator": "Class 2b (not verified against AHPA) cyanogenic glycoside safety profile, dosing in respiratory irritation", "identifier": "ISBN:978-1-4665-1694-2"}'::jsonb) then
      raise notice 'H065.secondary_citation already corrected, skipped';
    else
      raise exception 'H065.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H066.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Dioscorea villosa entry — class 2b (not verified against AHPA) (avoid in pregnancy); no significant adverse-event signal in non-pregnant adult dosing"}'::jsonb,
         last_updated = now()
   where herb_id = 'H066'
     and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Dioscorea villosa entry — class 2b (avoid in pregnancy); no significant adverse-event signal in non-pregnant adult dosing"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H066' and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Dioscorea villosa entry — class 2b (not verified against AHPA) (avoid in pregnancy); no significant adverse-event signal in non-pregnant adult dosing"}'::jsonb) then
      raise notice 'H066.secondary_citation already corrected, skipped';
    else
      raise exception 'H066.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H070.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Rumex crispus entry — class 2d (not verified against AHPA); oxalate content advisory; not for those with kidney stones or gout"}'::jsonb,
         last_updated = now()
   where herb_id = 'H070'
     and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Rumex crispus entry — class 2d; oxalate content advisory; not for those with kidney stones or gout"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H070' and secondary_citation = '{"url": "https://www.ahpa.org/resources/publications/botanical-safety-handbook", "kind": "ahpa_safety", "year": 2013, "title": "Botanical Safety Handbook, 2nd ed.", "author": "McGuffin M, Hobbs C, Upton R, Goldberg A (eds., American Herbal Products Association)", "locator": "Rumex crispus entry — class 2d (not verified against AHPA); oxalate content advisory; not for those with kidney stones or gout"}'::jsonb) then
      raise notice 'H070.secondary_citation already corrected, skipped';
    else
      raise exception 'H070.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H076.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://escop.com/downloads/arnica-flower/", "kind": "escop_ahpa", "year": 2009, "title": "ESCOP Monographs: Arnicae Flos / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d (not verified against AHPA) — TOPICAL USE ONLY on intact skin; NOT for application to broken skin, mucous membranes, or near the eyes; sesquiterpene lactone helenalin causes contact dermatitis in Asteraceae-allergic individuals; INTERNAL USE OF UNDILUTED HERBAL PREPARATIONS IS CONTRAINDICATED — toxic effects include gastroenteritis, cardiac irritation, and convulsions. Homeopathic ultra-low-dose internal preparations are a separate safety category and are not equivalent to herbal internal use."}'::jsonb,
         last_updated = now()
   where herb_id = 'H076'
     and secondary_citation = '{"url": "https://escop.com/downloads/arnica-flower/", "kind": "escop_ahpa", "year": 2009, "title": "ESCOP Monographs: Arnicae Flos / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d — TOPICAL USE ONLY on intact skin; NOT for application to broken skin, mucous membranes, or near the eyes; sesquiterpene lactone helenalin causes contact dermatitis in Asteraceae-allergic individuals; INTERNAL USE OF UNDILUTED HERBAL PREPARATIONS IS CONTRAINDICATED — toxic effects include gastroenteritis, cardiac irritation, and convulsions. Homeopathic ultra-low-dose internal preparations are a separate safety category and are not equivalent to herbal internal use."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H076' and secondary_citation = '{"url": "https://escop.com/downloads/arnica-flower/", "kind": "escop_ahpa", "year": 2009, "title": "ESCOP Monographs: Arnicae Flos / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d (not verified against AHPA) — TOPICAL USE ONLY on intact skin; NOT for application to broken skin, mucous membranes, or near the eyes; sesquiterpene lactone helenalin causes contact dermatitis in Asteraceae-allergic individuals; INTERNAL USE OF UNDILUTED HERBAL PREPARATIONS IS CONTRAINDICATED — toxic effects include gastroenteritis, cardiac irritation, and convulsions. Homeopathic ultra-low-dose internal preparations are a separate safety category and are not equivalent to herbal internal use."}'::jsonb) then
      raise notice 'H076.secondary_citation already corrected, skipped';
    else
      raise exception 'H076.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H077.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.botanical.com/botanical/mgmh/b/betony31.html", "kind": "industry_textbook_ahpa", "year": 1931, "title": "A Modern Herbal / AHPA Botanical Safety Handbook 2nd ed.", "author": "Grieve M / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue activity at higher doses); large doses are emetic; long-term high-dose use not advised. Standard adult tonic and nervine doses (1–3g dried leaf as infusion) carry no absolute contraindication but pregnancy avoidance is the conservative position."}'::jsonb,
         last_updated = now()
   where herb_id = 'H077'
     and secondary_citation = '{"url": "https://www.botanical.com/botanical/mgmh/b/betony31.html", "kind": "industry_textbook_ahpa", "year": 1931, "title": "A Modern Herbal / AHPA Botanical Safety Handbook 2nd ed.", "author": "Grieve M / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (traditional emmenagogue activity at higher doses); large doses are emetic; long-term high-dose use not advised. Standard adult tonic and nervine doses (1–3g dried leaf as infusion) carry no absolute contraindication but pregnancy avoidance is the conservative position."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H077' and secondary_citation = '{"url": "https://www.botanical.com/botanical/mgmh/b/betony31.html", "kind": "industry_textbook_ahpa", "year": 1931, "title": "A Modern Herbal / AHPA Botanical Safety Handbook 2nd ed.", "author": "Grieve M / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue activity at higher doses); large doses are emetic; long-term high-dose use not advised. Standard adult tonic and nervine doses (1–3g dried leaf as infusion) carry no absolute contraindication but pregnancy avoidance is the conservative position."}'::jsonb) then
      raise notice 'H077.secondary_citation already corrected, skipped';
    else
      raise exception 'H077.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H080.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm", "kind": "commission_e_ahpa", "year": 1990, "title": "German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.", "author": "German Federal Health Agency Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional and the AHPA notes no contraindication for short-term moderate use during established breastfeeding when no Asteraceae allergy is present."}'::jsonb,
         last_updated = now()
   where herb_id = 'H080'
     and secondary_citation = '{"url": "https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm", "kind": "commission_e_ahpa", "year": 1990, "title": "German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.", "author": "German Federal Health Agency Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional and the AHPA notes no contraindication for short-term moderate use during established breastfeeding when no Asteraceae allergy is present."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H080' and secondary_citation = '{"url": "https://buecher.heilpflanzen-welt.de/BGA-Commission-E-Monographs/0146.htm", "kind": "commission_e_ahpa", "year": 1990, "title": "German Commission E Monograph: Cnici benedicti herba / AHPA Botanical Safety Handbook 2nd ed.", "author": "German Federal Health Agency Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (traditional emmenagogue, stronger doses are abortifacient in folk record); Asteraceae (ragweed/daisy) allergy cross-reactivity; active peptic ulcer contraindicated (bitter aggravation of hyperacidity); Commission E approves for dyspepsia and loss of appetite at standard bitter-tonic doses (1.5–3g daily as infusion). Galactagogue use during active lactation is traditional and the AHPA notes no contraindication for short-term moderate use during established breastfeeding when no Asteraceae allergy is present."}'::jsonb) then
      raise notice 'H080.secondary_citation already corrected, skipped';
    else
      raise exception 'H080.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H081.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://pubmed.ncbi.nlm.nih.gov/9457948/", "kind": "case_report_literature_ahpa", "year": 1998, "title": "JAMA / Journal of Pediatrics neonatal cardiotoxicity case-report literature / AHPA Botanical Safety Handbook 2nd ed.", "author": "Jones TK & Lawson BM (J Pediatr 1998) / Finkel RS & Zarlengo KM (J Pediatr 2004) / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2d (not verified against AHPA) — NOT A HOME-USE HERB. Pregnancy contraindicated through term except possibly the final 1–2 weeks under qualified-midwife or qualified-practitioner direct supervision; the historical Eclectic intrapartum use is preserved in the literature but is not recommended for self-administration. Documented adverse events: neonatal acute myocardial infarction with congestive heart failure (Jones & Lawson 1998), neonatal stroke, multi-organ-system involvement (Finkel & Zarlengo 2004). Hypertension and pre-existing cardiac disease contraindicate use. Pediatric use contraindicated."}'::jsonb,
         last_updated = now()
   where herb_id = 'H081'
     and secondary_citation = '{"url": "https://pubmed.ncbi.nlm.nih.gov/9457948/", "kind": "case_report_literature_ahpa", "year": 1998, "title": "JAMA / Journal of Pediatrics neonatal cardiotoxicity case-report literature / AHPA Botanical Safety Handbook 2nd ed.", "author": "Jones TK & Lawson BM (J Pediatr 1998) / Finkel RS & Zarlengo KM (J Pediatr 2004) / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2d — NOT A HOME-USE HERB. Pregnancy contraindicated through term except possibly the final 1–2 weeks under qualified-midwife or qualified-practitioner direct supervision; the historical Eclectic intrapartum use is preserved in the literature but is not recommended for self-administration. Documented adverse events: neonatal acute myocardial infarction with congestive heart failure (Jones & Lawson 1998), neonatal stroke, multi-organ-system involvement (Finkel & Zarlengo 2004). Hypertension and pre-existing cardiac disease contraindicate use. Pediatric use contraindicated."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H081' and secondary_citation = '{"url": "https://pubmed.ncbi.nlm.nih.gov/9457948/", "kind": "case_report_literature_ahpa", "year": 1998, "title": "JAMA / Journal of Pediatrics neonatal cardiotoxicity case-report literature / AHPA Botanical Safety Handbook 2nd ed.", "author": "Jones TK & Lawson BM (J Pediatr 1998) / Finkel RS & Zarlengo KM (J Pediatr 2004) / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2d (not verified against AHPA) — NOT A HOME-USE HERB. Pregnancy contraindicated through term except possibly the final 1–2 weeks under qualified-midwife or qualified-practitioner direct supervision; the historical Eclectic intrapartum use is preserved in the literature but is not recommended for self-administration. Documented adverse events: neonatal acute myocardial infarction with congestive heart failure (Jones & Lawson 1998), neonatal stroke, multi-organ-system involvement (Finkel & Zarlengo 2004). Hypertension and pre-existing cardiac disease contraindicate use. Pediatric use contraindicated."}'::jsonb) then
      raise notice 'H081.secondary_citation already corrected, skipped';
    else
      raise exception 'H081.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H087.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://escop.com/downloads/coltsfoot-leaf/", "kind": "escop_commission_e", "year": 2003, "title": "ESCOP Monographs: Farfarae Folium / Commission E rescinded approval (1992) / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2d (not verified against AHPA) — pyrrolizidine alkaloid (PA) content; restricted use ≤4–6 weeks per year; PA-free cultivars preferred; pregnancy and lactation contraindicated; children under 6 contraindicated; concurrent PA-containing herbs contraindicated. Commission E approval rescinded 1992 over PA concerns."}'::jsonb,
         last_updated = now()
   where herb_id = 'H087'
     and secondary_citation = '{"url": "https://escop.com/downloads/coltsfoot-leaf/", "kind": "escop_commission_e", "year": 2003, "title": "ESCOP Monographs: Farfarae Folium / Commission E rescinded approval (1992) / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2d — pyrrolizidine alkaloid (PA) content; restricted use ≤4–6 weeks per year; PA-free cultivars preferred; pregnancy and lactation contraindicated; children under 6 contraindicated; concurrent PA-containing herbs contraindicated. Commission E approval rescinded 1992 over PA concerns."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H087' and secondary_citation = '{"url": "https://escop.com/downloads/coltsfoot-leaf/", "kind": "escop_commission_e", "year": 2003, "title": "ESCOP Monographs: Farfarae Folium / Commission E rescinded approval (1992) / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / German Commission E / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2d (not verified against AHPA) — pyrrolizidine alkaloid (PA) content; restricted use ≤4–6 weeks per year; PA-free cultivars preferred; pregnancy and lactation contraindicated; children under 6 contraindicated; concurrent PA-containing herbs contraindicated. Commission E approval rescinded 1992 over PA concerns."}'::jsonb) then
      raise notice 'H087.secondary_citation already corrected, skipped';
    else
      raise exception 'H087.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H091.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://escop.com/downloads/devils-claw-root/", "kind": "escop_who_ahpa", "year": 2009, "title": "ESCOP Monographs: Harpagophyti Radix / WHO Monographs on Selected Medicinal Plants Vol. 3 / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (oxytocic activity at higher doses); active peptic ulcer / duodenal obstruction / gallstones contraindicate use (bile-stimulant action); concurrent warfarin or other anticoagulants requires monitoring (theoretical interaction); diabetes medication monitoring suggested at high doses (mild hypoglycemic activity). ESCOP and WHO Vol 3 (2003) approve for the symptomatic relief of degenerative joint disease and lower-back pain at standardized harpagoside doses."}'::jsonb,
         last_updated = now()
   where herb_id = 'H091'
     and secondary_citation = '{"url": "https://escop.com/downloads/devils-claw-root/", "kind": "escop_who_ahpa", "year": 2009, "title": "ESCOP Monographs: Harpagophyti Radix / WHO Monographs on Selected Medicinal Plants Vol. 3 / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (oxytocic activity at higher doses); active peptic ulcer / duodenal obstruction / gallstones contraindicate use (bile-stimulant action); concurrent warfarin or other anticoagulants requires monitoring (theoretical interaction); diabetes medication monitoring suggested at high doses (mild hypoglycemic activity). ESCOP and WHO Vol 3 (2003) approve for the symptomatic relief of degenerative joint disease and lower-back pain at standardized harpagoside doses."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H091' and secondary_citation = '{"url": "https://escop.com/downloads/devils-claw-root/", "kind": "escop_who_ahpa", "year": 2009, "title": "ESCOP Monographs: Harpagophyti Radix / WHO Monographs on Selected Medicinal Plants Vol. 3 / AHPA Botanical Safety Handbook 2nd ed.", "author": "European Scientific Cooperative on Phytotherapy / World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (oxytocic activity at higher doses); active peptic ulcer / duodenal obstruction / gallstones contraindicate use (bile-stimulant action); concurrent warfarin or other anticoagulants requires monitoring (theoretical interaction); diabetes medication monitoring suggested at high doses (mild hypoglycemic activity). ESCOP and WHO Vol 3 (2003) approve for the symptomatic relief of degenerative joint disease and lower-back pain at standardized harpagoside doses."}'::jsonb) then
      raise notice 'H091.secondary_citation already corrected, skipped';
    else
      raise exception 'H091.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H092.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/", "kind": "industry_textbook_who_ahpa", "year": 2004, "title": "Chinese Herbal Medicine: Materia Medica 3rd ed. / WHO Monographs on Selected Medicinal Plants Vol. 2 / AHPA Botanical Safety Handbook 2nd ed.", "author": "Bensky D, Clavey S, Stoger E, Gamble A / World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (uterine stimulant in animal models; classical TCM contraindication preserved); active menorrhagia contraindicated (blood-mover worsens heavy menses); bleeding disorders / concurrent anticoagulant therapy require careful monitoring (coumarin content); photosensitizing furanocoumarins — limit sun exposure during high-dose use; lactation: insufficient data, conservative avoidance. Bensky & Gamble give detailed dosage and decoction protocols; WHO Vol 2 reviews controlled-trial evidence."}'::jsonb,
         last_updated = now()
   where herb_id = 'H092'
     and secondary_citation = '{"url": "https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/", "kind": "industry_textbook_who_ahpa", "year": 2004, "title": "Chinese Herbal Medicine: Materia Medica 3rd ed. / WHO Monographs on Selected Medicinal Plants Vol. 2 / AHPA Botanical Safety Handbook 2nd ed.", "author": "Bensky D, Clavey S, Stoger E, Gamble A / World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b — pregnancy contraindicated (uterine stimulant in animal models; classical TCM contraindication preserved); active menorrhagia contraindicated (blood-mover worsens heavy menses); bleeding disorders / concurrent anticoagulant therapy require careful monitoring (coumarin content); photosensitizing furanocoumarins — limit sun exposure during high-dose use; lactation: insufficient data, conservative avoidance. Bensky & Gamble give detailed dosage and decoction protocols; WHO Vol 2 reviews controlled-trial evidence."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H092' and secondary_citation = '{"url": "https://www.eastlandpress.com/product/chinese-herbal-medicine-materia-medica-3rd-edition/", "kind": "industry_textbook_who_ahpa", "year": 2004, "title": "Chinese Herbal Medicine: Materia Medica 3rd ed. / WHO Monographs on Selected Medicinal Plants Vol. 2 / AHPA Botanical Safety Handbook 2nd ed.", "author": "Bensky D, Clavey S, Stoger E, Gamble A / World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b (not verified against AHPA) — pregnancy contraindicated (uterine stimulant in animal models; classical TCM contraindication preserved); active menorrhagia contraindicated (blood-mover worsens heavy menses); bleeding disorders / concurrent anticoagulant therapy require careful monitoring (coumarin content); photosensitizing furanocoumarins — limit sun exposure during high-dose use; lactation: insufficient data, conservative avoidance. Bensky & Gamble give detailed dosage and decoction protocols; WHO Vol 2 reviews controlled-trial evidence."}'::jsonb) then
      raise notice 'H092.secondary_citation already corrected, skipped';
    else
      raise exception 'H092.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H095.secondary_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5", "kind": "industry_textbook_lactation_ahpa", "year": 2013, "title": "Principles and Practice of Phytotherapy 2nd ed. / Hale''s Medications and Mothers'' Milk / AHPA Botanical Safety Handbook 2nd ed.", "author": "Mills S, Bone K / Hale TW, Krutsch K / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2c (not verified against AHPA) — pregnancy: uterine stimulant activity at therapeutic doses, AVOID throughout pregnancy; established lactation: traditional galactagogue, moderate medicinal doses well-tolerated and supportive of supply; Fabaceae (legume) allergy — peanut and chickpea cross-reactivity documented, contraindicated in those with known legume allergy; bleeding disorders — coumarin-like compounds may potentiate anticoagulants; bowel obstruction contraindicated (mucilage bulk); the maple-syrup-urine-disease-like odor produced in mother and infant from sotolon is benign and not a toxicity signal. Hale''s rates Fenugreek L3 (limited data, moderately safe) for established breastfeeding."}'::jsonb,
         last_updated = now()
   where herb_id = 'H095'
     and secondary_citation = '{"url": "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5", "kind": "industry_textbook_lactation_ahpa", "year": 2013, "title": "Principles and Practice of Phytotherapy 2nd ed. / Hale''s Medications and Mothers'' Milk / AHPA Botanical Safety Handbook 2nd ed.", "author": "Mills S, Bone K / Hale TW, Krutsch K / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2c — pregnancy: uterine stimulant activity at therapeutic doses, AVOID throughout pregnancy; established lactation: traditional galactagogue, moderate medicinal doses well-tolerated and supportive of supply; Fabaceae (legume) allergy — peanut and chickpea cross-reactivity documented, contraindicated in those with known legume allergy; bleeding disorders — coumarin-like compounds may potentiate anticoagulants; bowel obstruction contraindicated (mucilage bulk); the maple-syrup-urine-disease-like odor produced in mother and infant from sotolon is benign and not a toxicity signal. Hale''s rates Fenugreek L3 (limited data, moderately safe) for established breastfeeding."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H095' and secondary_citation = '{"url": "https://www.elsevier.com/books/principles-and-practice-of-phytotherapy/mills/978-0-443-06992-5", "kind": "industry_textbook_lactation_ahpa", "year": 2013, "title": "Principles and Practice of Phytotherapy 2nd ed. / Hale''s Medications and Mothers'' Milk / AHPA Botanical Safety Handbook 2nd ed.", "author": "Mills S, Bone K / Hale TW, Krutsch K / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2b/2c (not verified against AHPA) — pregnancy: uterine stimulant activity at therapeutic doses, AVOID throughout pregnancy; established lactation: traditional galactagogue, moderate medicinal doses well-tolerated and supportive of supply; Fabaceae (legume) allergy — peanut and chickpea cross-reactivity documented, contraindicated in those with known legume allergy; bleeding disorders — coumarin-like compounds may potentiate anticoagulants; bowel obstruction contraindicated (mucilage bulk); the maple-syrup-urine-disease-like odor produced in mother and infant from sotolon is benign and not a toxicity signal. Hale''s rates Fenugreek L3 (limited data, moderately safe) for established breastfeeding."}'::jsonb) then
      raise notice 'H095.secondary_citation already corrected, skipped';
    else
      raise exception 'H095.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H106.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Contraindicated. Juniper berry has a long-documented reputation as an emmenagogue and uterine stimulant (reputed abortifacient), and the volatile oil is a mucous-membrane and renal irritant. German Commission E lists pregnancy as a contraindication (risk of uterine contractions); the AHPA Botanical Safety Handbook rates the fruit Class 2b (not verified against AHPA) (not to be used during pregnancy). Avoid all medicinal doses (teas, tinctures, capsules, essential oil). Incidental culinary amounts seasoning food are of low concern. (German Commission E 1998; AHPA Botanical Safety Handbook 2nd ed. 2013; Brinker.)',
         last_updated = now()
   where herb_id = 'H106'
     and pregnancy_safety = 'Contraindicated. Juniper berry has a long-documented reputation as an emmenagogue and uterine stimulant (reputed abortifacient), and the volatile oil is a mucous-membrane and renal irritant. German Commission E lists pregnancy as a contraindication (risk of uterine contractions); the AHPA Botanical Safety Handbook rates the fruit Class 2b (not to be used during pregnancy). Avoid all medicinal doses (teas, tinctures, capsules, essential oil). Incidental culinary amounts seasoning food are of low concern. (German Commission E 1998; AHPA Botanical Safety Handbook 2nd ed. 2013; Brinker.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H106' and pregnancy_safety = 'Contraindicated. Juniper berry has a long-documented reputation as an emmenagogue and uterine stimulant (reputed abortifacient), and the volatile oil is a mucous-membrane and renal irritant. German Commission E lists pregnancy as a contraindication (risk of uterine contractions); the AHPA Botanical Safety Handbook rates the fruit Class 2b (not verified against AHPA) (not to be used during pregnancy). Avoid all medicinal doses (teas, tinctures, capsules, essential oil). Incidental culinary amounts seasoning food are of low concern. (German Commission E 1998; AHPA Botanical Safety Handbook 2nd ed. 2013; Brinker.)') then
      raise notice 'H106.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H106.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H106.drug_interactions: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'No well-documented pharmacokinetic (CYP450) interactions; AHPA Botanical Safety Handbook assigns Interaction Class A (not verified against AHPA) (no clinically significant interactions expected at normal doses). Theoretical, dose-dependent concerns arise from its diuretic and glycemic activity: (1) additive diuresis with pharmaceutical diuretics (loop, thiazide), with potential for fluid and electrolyte (especially potassium) depletion; (2) reduced lithium clearance if diuresis is marked, risking raised lithium levels (monitor); (3) possible effect on blood glucose (animal hypoglycemic activity is reported, alongside a report of raised glucose), so monitor if taking insulin or oral antidiabetic drugs; (4) minor additive effect with antihypertensives via diuresis. (German Commission E; AHPA Botanical Safety Handbook 2nd ed.; Brinker, Herbal Contraindications and Drug Interactions.)',
         last_updated = now()
   where herb_id = 'H106'
     and drug_interactions = 'No well-documented pharmacokinetic (CYP450) interactions; AHPA Botanical Safety Handbook assigns Interaction Class A (no clinically significant interactions expected at normal doses). Theoretical, dose-dependent concerns arise from its diuretic and glycemic activity: (1) additive diuresis with pharmaceutical diuretics (loop, thiazide), with potential for fluid and electrolyte (especially potassium) depletion; (2) reduced lithium clearance if diuresis is marked, risking raised lithium levels (monitor); (3) possible effect on blood glucose (animal hypoglycemic activity is reported, alongside a report of raised glucose), so monitor if taking insulin or oral antidiabetic drugs; (4) minor additive effect with antihypertensives via diuresis. (German Commission E; AHPA Botanical Safety Handbook 2nd ed.; Brinker, Herbal Contraindications and Drug Interactions.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H106' and drug_interactions = 'No well-documented pharmacokinetic (CYP450) interactions; AHPA Botanical Safety Handbook assigns Interaction Class A (not verified against AHPA) (no clinically significant interactions expected at normal doses). Theoretical, dose-dependent concerns arise from its diuretic and glycemic activity: (1) additive diuresis with pharmaceutical diuretics (loop, thiazide), with potential for fluid and electrolyte (especially potassium) depletion; (2) reduced lithium clearance if diuresis is marked, risking raised lithium levels (monitor); (3) possible effect on blood glucose (animal hypoglycemic activity is reported, alongside a report of raised glucose), so monitor if taking insulin or oral antidiabetic drugs; (4) minor additive effect with antihypertensives via diuresis. (German Commission E; AHPA Botanical Safety Handbook 2nd ed.; Brinker, Herbal Contraindications and Drug Interactions.)') then
      raise notice 'H106.drug_interactions already corrected, skipped';
    else
      raise exception 'H106.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI233.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'German Commission E Monograph (Juniperi fructus, 1998); AHPA Botanical Safety Handbook 2nd ed. (2013), Class 2b (not verified against AHPA); Brinker, Herbal Contraindications and Drug Interactions (4th ed. 2010)'
   where contraindication_id = 'CI233'
     and source_citation = 'German Commission E Monograph (Juniperi fructus, 1998); AHPA Botanical Safety Handbook 2nd ed. (2013), Class 2b; Brinker, Herbal Contraindications and Drug Interactions (4th ed. 2010)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI233' and source_citation = 'German Commission E Monograph (Juniperi fructus, 1998); AHPA Botanical Safety Handbook 2nd ed. (2013), Class 2b (not verified against AHPA); Brinker, Herbal Contraindications and Drug Interactions (4th ed. 2010)') then
      raise notice 'CI233.source_citation already corrected, skipped';
    else
      raise exception 'CI233.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI237.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Brinker, Herbal Contraindications and Drug Interactions (4th ed. 2010); AHPA Botanical Safety Handbook 2nd ed. (Interaction Class A (not verified against AHPA))'
   where contraindication_id = 'CI237'
     and source_citation = 'Brinker, Herbal Contraindications and Drug Interactions (4th ed. 2010); AHPA Botanical Safety Handbook 2nd ed. (Interaction Class A)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI237' and source_citation = 'Brinker, Herbal Contraindications and Drug Interactions (4th ed. 2010); AHPA Botanical Safety Handbook 2nd ed. (Interaction Class A (not verified against AHPA))') then
      raise notice 'CI237.source_citation already corrected, skipped';
    else
      raise exception 'CI237.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H111.children_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Food amounts are safe. A weak seed infusion has a long tradition of use for infant colic and gas (the gripe-water tradition) in small, dilute doses. Avoid internal use of the essential oil in infants and young children. Source: AHPA Botanical Safety Handbook (Safety Class 1 (not verified against AHPA)).',
         last_updated = now()
   where herb_id = 'H111'
     and children_safety = 'Food amounts are safe. A weak seed infusion has a long tradition of use for infant colic and gas (the gripe-water tradition) in small, dilute doses. Avoid internal use of the essential oil in infants and young children. Source: AHPA Botanical Safety Handbook (Safety Class 1).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H111' and children_safety = 'Food amounts are safe. A weak seed infusion has a long tradition of use for infant colic and gas (the gripe-water tradition) in small, dilute doses. Avoid internal use of the essential oil in infants and young children. Source: AHPA Botanical Safety Handbook (Safety Class 1 (not verified against AHPA)).') then
      raise notice 'H111.children_safety already corrected, skipped';
    else
      raise exception 'H111.children_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H111.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Culinary use is safe (coriander is GRAS as a food). The AHPA Botanical Safety Handbook rates coriander as Safety Class 1 (not verified against AHPA) (safe when used appropriately), and no teratogenic or clinically significant abortifacient effect is documented at food or moderate seed-tea doses. Avoid concentrated extracts and the essential oil internally in pregnancy due to insufficient data (Brinker). Sources: AHPA Botanical Safety Handbook 2nd ed.; NCCIH.',
         last_updated = now()
   where herb_id = 'H111'
     and pregnancy_safety = 'Culinary use is safe (coriander is GRAS as a food). The AHPA Botanical Safety Handbook rates coriander as Safety Class 1 (safe when used appropriately), and no teratogenic or clinically significant abortifacient effect is documented at food or moderate seed-tea doses. Avoid concentrated extracts and the essential oil internally in pregnancy due to insufficient data (Brinker). Sources: AHPA Botanical Safety Handbook 2nd ed.; NCCIH.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H111' and pregnancy_safety = 'Culinary use is safe (coriander is GRAS as a food). The AHPA Botanical Safety Handbook rates coriander as Safety Class 1 (not verified against AHPA) (safe when used appropriately), and no teratogenic or clinically significant abortifacient effect is documented at food or moderate seed-tea doses. Avoid concentrated extracts and the essential oil internally in pregnancy due to insufficient data (Brinker). Sources: AHPA Botanical Safety Handbook 2nd ed.; NCCIH.') then
      raise notice 'H111.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H111.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H111.secondary_sources: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1 (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions; NIH LactMed / Drugs and Lactation Database, Coriander; NCCIH.',
         last_updated = now()
   where herb_id = 'H111'
     and secondary_sources = 'Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1); Brinker, Herb Contraindications and Drug Interactions; NIH LactMed / Drugs and Lactation Database, Coriander; NCCIH.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H111' and secondary_sources = 'Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1 (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions; NIH LactMed / Drugs and Lactation Database, Coriander; NCCIH.') then
      raise notice 'H111.secondary_sources already corrected, skipped';
    else
      raise exception 'H111.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H111.secondary_citation: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ayush.gov.in/", "year": "ongoing", "title": "Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1 (not verified against AHPA)); Brinker, Herb Contraindications and D", "author": "Ayurvedic Pharmacopoeia of India", "locator": "Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1 (not verified against AHPA)); Brinker, Herb Contraindications and D", "source_id": "S10"}'::jsonb,
         last_updated = now()
   where herb_id = 'H111'
     and secondary_citation = '{"url": "https://www.ayush.gov.in/", "year": "ongoing", "title": "Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1); Brinker, Herb Contraindications and D", "author": "Ayurvedic Pharmacopoeia of India", "locator": "Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1); Brinker, Herb Contraindications and D", "source_id": "S10"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H111' and secondary_citation = '{"url": "https://www.ayush.gov.in/", "year": "ongoing", "title": "Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1 (not verified against AHPA)); Brinker, Herb Contraindications and D", "author": "Ayurvedic Pharmacopoeia of India", "locator": "Ayurvedic Pharmacopoeia of India, Part I, Dhanyaka (Coriandrum sativum); Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook, 2nd ed. (coriander fruit, Safety Class 1 (not verified against AHPA)); Brinker, Herb Contraindications and D", "source_id": "S10"}'::jsonb) then
      raise notice 'H111.secondary_citation already corrected, skipped';
    else
      raise exception 'H111.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI270.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook 2nd ed. (Safety Class 1 (not verified against AHPA)); NCCIH.'
   where contraindication_id = 'CI270'
     and source_citation = 'AHPA Botanical Safety Handbook 2nd ed. (Safety Class 1); NCCIH.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI270' and source_citation = 'AHPA Botanical Safety Handbook 2nd ed. (Safety Class 1 (not verified against AHPA)); NCCIH.') then
      raise notice 'CI270.source_citation already corrected, skipped';
    else
      raise exception 'CI270.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI270.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Food and moderate seed doses are GRAS/Class 1 (not verified against AHPA) with no documented teratogenicity; concentrated extracts and essential oil lack robust human safety data.'
   where contraindication_id = 'CI270'
     and mechanism_rationale = 'Food and moderate seed doses are GRAS/Class 1 with no documented teratogenicity; concentrated extracts and essential oil lack robust human safety data.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI270' and mechanism_rationale = 'Food and moderate seed doses are GRAS/Class 1 (not verified against AHPA) with no documented teratogenicity; concentrated extracts and essential oil lack robust human safety data.') then
      raise notice 'CI270.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI270.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H114.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. AHPA Botanical Safety Handbook (2nd ed.) rates Marrubium vulgare Class 2b (not verified against AHPA): not to be used during pregnancy except under the supervision of a qualified practitioner, on the basis of its traditional use as an emmenagogue and its reputed abortifacient and uterine-stimulant action. Source: AHPA Botanical Safety Handbook, 2nd ed.; Brinker, Herb Contraindications and Drug Interactions.',
         last_updated = now()
   where herb_id = 'H114'
     and pregnancy_safety = 'Avoid. AHPA Botanical Safety Handbook (2nd ed.) rates Marrubium vulgare Class 2b: not to be used during pregnancy except under the supervision of a qualified practitioner, on the basis of its traditional use as an emmenagogue and its reputed abortifacient and uterine-stimulant action. Source: AHPA Botanical Safety Handbook, 2nd ed.; Brinker, Herb Contraindications and Drug Interactions.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H114' and pregnancy_safety = 'Avoid. AHPA Botanical Safety Handbook (2nd ed.) rates Marrubium vulgare Class 2b (not verified against AHPA): not to be used during pregnancy except under the supervision of a qualified practitioner, on the basis of its traditional use as an emmenagogue and its reputed abortifacient and uterine-stimulant action. Source: AHPA Botanical Safety Handbook, 2nd ed.; Brinker, Herb Contraindications and Drug Interactions.') then
      raise notice 'H114.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H114.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H114.drug_interactions: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'AHPA Interaction Class A (not verified against AHPA): no well-documented clinical drug interactions. Theoretical additive effects are plausible from its pharmacology: at higher doses it may potentiate antidiabetic and insulin therapy (hypoglycemic effect) and antihypertensive or calcium-channel-blocking drugs (marrubenol is an L-type calcium channel blocker). Monitor blood glucose and blood pressure if combined. Source: AHPA Botanical Safety Handbook, 2nd ed. (Interaction Class A (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions; El Bardai et al., Br J Pharmacol 2003 (PMID 14597602); hypoglycemic pharmacology reviewed in PMC5622392 (2017).',
         last_updated = now()
   where herb_id = 'H114'
     and drug_interactions = 'AHPA Interaction Class A: no well-documented clinical drug interactions. Theoretical additive effects are plausible from its pharmacology: at higher doses it may potentiate antidiabetic and insulin therapy (hypoglycemic effect) and antihypertensive or calcium-channel-blocking drugs (marrubenol is an L-type calcium channel blocker). Monitor blood glucose and blood pressure if combined. Source: AHPA Botanical Safety Handbook, 2nd ed. (Interaction Class A); Brinker, Herb Contraindications and Drug Interactions; El Bardai et al., Br J Pharmacol 2003 (PMID 14597602); hypoglycemic pharmacology reviewed in PMC5622392 (2017).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H114' and drug_interactions = 'AHPA Interaction Class A (not verified against AHPA): no well-documented clinical drug interactions. Theoretical additive effects are plausible from its pharmacology: at higher doses it may potentiate antidiabetic and insulin therapy (hypoglycemic effect) and antihypertensive or calcium-channel-blocking drugs (marrubenol is an L-type calcium channel blocker). Monitor blood glucose and blood pressure if combined. Source: AHPA Botanical Safety Handbook, 2nd ed. (Interaction Class A (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions; El Bardai et al., Br J Pharmacol 2003 (PMID 14597602); hypoglycemic pharmacology reviewed in PMC5622392 (2017).') then
      raise notice 'H114.drug_interactions already corrected, skipped';
    else
      raise exception 'H114.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H114.contraindications_general: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'Pregnancy (traditional emmenagogue and reputed abortifacient; AHPA Botanical Safety Handbook Class 2b (not verified against AHPA)). Known allergy to Lamiaceae-family plants.',
         last_updated = now()
   where herb_id = 'H114'
     and contraindications_general = 'Pregnancy (traditional emmenagogue and reputed abortifacient; AHPA Botanical Safety Handbook Class 2b). Known allergy to Lamiaceae-family plants.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H114' and contraindications_general = 'Pregnancy (traditional emmenagogue and reputed abortifacient; AHPA Botanical Safety Handbook Class 2b (not verified against AHPA)). Known allergy to Lamiaceae-family plants.') then
      raise notice 'H114.contraindications_general already corrected, skipped';
    else
      raise exception 'H114.contraindications_general: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI283.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions'
   where contraindication_id = 'CI283'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b); Brinker, Herb Contraindications and Drug Interactions';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI283' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions') then
      raise notice 'CI283.source_citation already corrected, skipped';
    else
      raise exception 'CI283.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI283.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Traditional emmenagogue with a reputed abortifacient and uterine-stimulant action; AHPA safety Class 2b (not verified against AHPA).'
   where contraindication_id = 'CI283'
     and mechanism_rationale = 'Traditional emmenagogue with a reputed abortifacient and uterine-stimulant action; AHPA safety Class 2b.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI283' and mechanism_rationale = 'Traditional emmenagogue with a reputed abortifacient and uterine-stimulant action; AHPA safety Class 2b (not verified against AHPA).') then
      raise notice 'CI283.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI283.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H127.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid; caution. AHPA Botanical Safety Handbook Class 2b (not verified against AHPA) (not to be used during pregnancy except under qualified supervision); stimulant laxatives are second-line to bulk-forming agents. If used at all, keep short-term and low-dose. Sources: AHPA Botanical Safety Handbook, 2nd ed.; WHO Monographs on Selected Medicinal Plants, Vol. 1 (Folium Sennae).',
         last_updated = now()
   where herb_id = 'H127'
     and pregnancy_safety = 'Avoid; caution. AHPA Botanical Safety Handbook Class 2b (not to be used during pregnancy except under qualified supervision); stimulant laxatives are second-line to bulk-forming agents. If used at all, keep short-term and low-dose. Sources: AHPA Botanical Safety Handbook, 2nd ed.; WHO Monographs on Selected Medicinal Plants, Vol. 1 (Folium Sennae).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and pregnancy_safety = 'Avoid; caution. AHPA Botanical Safety Handbook Class 2b (not verified against AHPA) (not to be used during pregnancy except under qualified supervision); stimulant laxatives are second-line to bulk-forming agents. If used at all, keep short-term and low-dose. Sources: AHPA Botanical Safety Handbook, 2nd ed.; WHO Monographs on Selected Medicinal Plants, Vol. 1 (Folium Sennae).') then
      raise notice 'H127.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H127.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H127.breastfeeding_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Compatible in recommended short-term amounts. Only minimal sennoside metabolites reach breast milk and monitoring shows no reliable change in infant stool frequency or consistency; avoid high or prolonged doses. Sources: NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).',
         last_updated = now()
   where herb_id = 'H127'
     and breastfeeding_safety = 'Compatible in recommended short-term amounts. Only minimal sennoside metabolites reach breast milk and monitoring shows no reliable change in infant stool frequency or consistency; avoid high or prolonged doses. Sources: NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H127' and breastfeeding_safety = 'Compatible in recommended short-term amounts. Only minimal sennoside metabolites reach breast milk and monitoring shows no reliable change in infant stool frequency or consistency; avoid high or prolonged doses. Sources: NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).') then
      raise notice 'H127.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H127.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI361.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).'
   where contraindication_id = 'CI361'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b); WHO Monographs Vol. 1 (Folium Sennae).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI361' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2b (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).') then
      raise notice 'CI361.source_citation already corrected, skipped';
    else
      raise exception 'CI361.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI361.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Anthraquinone stimulant laxative; theoretical reflex uterine stimulation and maternal fluid/electrolyte loss. AHPA Class 2b (not verified against AHPA).'
   where contraindication_id = 'CI361'
     and mechanism_rationale = 'Anthraquinone stimulant laxative; theoretical reflex uterine stimulation and maternal fluid/electrolyte loss. AHPA Class 2b.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI361' and mechanism_rationale = 'Anthraquinone stimulant laxative; theoretical reflex uterine stimulation and maternal fluid/electrolyte loss. AHPA Class 2b (not verified against AHPA).') then
      raise notice 'CI361.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI361.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI362.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).'
   where contraindication_id = 'CI362'
     and source_citation = 'NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI362' and source_citation = 'NIH LactMed; AHPA Botanical Safety Handbook, 2nd ed. (Class 2c (not verified against AHPA)).') then
      raise notice 'CI362.source_citation already corrected, skipped';
    else
      raise exception 'CI362.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI367.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2d (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).'
   where contraindication_id = 'CI367'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2d); WHO Monographs Vol. 1 (Folium Sennae).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI367' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 2d (not verified against AHPA)); WHO Monographs Vol. 1 (Folium Sennae).') then
      raise notice 'CI367.source_citation already corrected, skipped';
    else
      raise exception 'CI367.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H128.drug_interactions: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'No well-documented clinically significant interactions (Commission E: none known; AHPA Interaction Class A (not verified against AHPA)). Theoretical additive effects at high therapeutic doses only: mild antiplatelet potential (additive with anticoagulant or antiplatelet drugs) and modest blood-pressure lowering (additive with antihypertensives, shown in RCT meta-analysis). Culinary use is unproblematic. (Mills & Bone; AHPA BSH; cardamom BP meta-analysis PMC10804083.)',
         last_updated = now()
   where herb_id = 'H128'
     and drug_interactions = 'No well-documented clinically significant interactions (Commission E: none known; AHPA Interaction Class A). Theoretical additive effects at high therapeutic doses only: mild antiplatelet potential (additive with anticoagulant or antiplatelet drugs) and modest blood-pressure lowering (additive with antihypertensives, shown in RCT meta-analysis). Culinary use is unproblematic. (Mills & Bone; AHPA BSH; cardamom BP meta-analysis PMC10804083.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H128' and drug_interactions = 'No well-documented clinically significant interactions (Commission E: none known; AHPA Interaction Class A (not verified against AHPA)). Theoretical additive effects at high therapeutic doses only: mild antiplatelet potential (additive with anticoagulant or antiplatelet drugs) and modest blood-pressure lowering (additive with antihypertensives, shown in RCT meta-analysis). Culinary use is unproblematic. (Mills & Bone; AHPA BSH; cardamom BP meta-analysis PMC10804083.)') then
      raise notice 'H128.drug_interactions already corrected, skipped';
    else
      raise exception 'H128.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI370.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook (Interaction Class A (not verified against AHPA))'
   where contraindication_id = 'CI370'
     and source_citation = 'Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook (Interaction Class A)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI370' and source_citation = 'Mills & Bone, Principles and Practice of Phytotherapy; AHPA Botanical Safety Handbook (Interaction Class A (not verified against AHPA))') then
      raise notice 'CI370.source_citation already corrected, skipped';
    else
      raise exception 'CI370.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H129.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. German Commission E and the AHPA Botanical Safety Handbook (class 2b (not verified against AHPA)) advise against use of anthraquinone stimulant laxatives in pregnancy. Available human data are somewhat reassuring against teratogenicity (Briggs, Drugs in Pregnancy and Lactation, 10th ed., reports no increased malformation risk in a prospective series of 53 first-trimester mother-child pairs, though the numbers are small), but reflex uterine stimulation and maternal fluid and electrolyte loss are theoretical concerns. Bulk-forming laxatives are preferred; use only if bulk laxatives fail and under professional supervision.',
         last_updated = now()
   where herb_id = 'H129'
     and pregnancy_safety = 'Avoid. German Commission E and the AHPA Botanical Safety Handbook (class 2b) advise against use of anthraquinone stimulant laxatives in pregnancy. Available human data are somewhat reassuring against teratogenicity (Briggs, Drugs in Pregnancy and Lactation, 10th ed., reports no increased malformation risk in a prospective series of 53 first-trimester mother-child pairs, though the numbers are small), but reflex uterine stimulation and maternal fluid and electrolyte loss are theoretical concerns. Bulk-forming laxatives are preferred; use only if bulk laxatives fail and under professional supervision.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H129' and pregnancy_safety = 'Avoid. German Commission E and the AHPA Botanical Safety Handbook (class 2b (not verified against AHPA)) advise against use of anthraquinone stimulant laxatives in pregnancy. Available human data are somewhat reassuring against teratogenicity (Briggs, Drugs in Pregnancy and Lactation, 10th ed., reports no increased malformation risk in a prospective series of 53 first-trimester mother-child pairs, though the numbers are small), but reflex uterine stimulation and maternal fluid and electrolyte loss are theoretical concerns. Bulk-forming laxatives are preferred; use only if bulk laxatives fail and under professional supervision.') then
      raise notice 'H129.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H129.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H129.breastfeeding_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Avoid; prefer alternatives. Small amounts of active anthraquinone metabolites pass into breast milk (cascara was qualitatively detected in the milk of 5 of 10 women in one study). Loose stools have been reported in breastfed infants (10 of 22 newborns across two small uncontrolled studies; a separate observational case series of 142 mother-infant pairs found no diarrhea). The NIH LactMed database (2021) advises that maternal cascara might cause loose stools in some breastfed infants and lists alternatives such as bisacodyl, magnesium hydroxide, or senna. The American Academy of Pediatrics has historically rated it compatible with breastfeeding (per Briggs, 10th ed.), but the conservative recommendation is to avoid. AHPA class 2c (not verified against AHPA).',
         last_updated = now()
   where herb_id = 'H129'
     and breastfeeding_safety = 'Avoid; prefer alternatives. Small amounts of active anthraquinone metabolites pass into breast milk (cascara was qualitatively detected in the milk of 5 of 10 women in one study). Loose stools have been reported in breastfed infants (10 of 22 newborns across two small uncontrolled studies; a separate observational case series of 142 mother-infant pairs found no diarrhea). The NIH LactMed database (2021) advises that maternal cascara might cause loose stools in some breastfed infants and lists alternatives such as bisacodyl, magnesium hydroxide, or senna. The American Academy of Pediatrics has historically rated it compatible with breastfeeding (per Briggs, 10th ed.), but the conservative recommendation is to avoid. AHPA class 2c.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H129' and breastfeeding_safety = 'Avoid; prefer alternatives. Small amounts of active anthraquinone metabolites pass into breast milk (cascara was qualitatively detected in the milk of 5 of 10 women in one study). Loose stools have been reported in breastfed infants (10 of 22 newborns across two small uncontrolled studies; a separate observational case series of 142 mother-infant pairs found no diarrhea). The NIH LactMed database (2021) advises that maternal cascara might cause loose stools in some breastfed infants and lists alternatives such as bisacodyl, magnesium hydroxide, or senna. The American Academy of Pediatrics has historically rated it compatible with breastfeeding (per Briggs, 10th ed.), but the conservative recommendation is to avoid. AHPA class 2c (not verified against AHPA).') then
      raise notice 'H129.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H129.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI374.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'German Commission E; AHPA Botanical Safety Handbook class 2b (not verified against AHPA); Briggs, Drugs in Pregnancy and Lactation (10th ed.).'
   where contraindication_id = 'CI374'
     and source_citation = 'German Commission E; AHPA Botanical Safety Handbook class 2b; Briggs, Drugs in Pregnancy and Lactation (10th ed.).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI374' and source_citation = 'German Commission E; AHPA Botanical Safety Handbook class 2b (not verified against AHPA); Briggs, Drugs in Pregnancy and Lactation (10th ed.).') then
      raise notice 'CI374.source_citation already corrected, skipped';
    else
      raise exception 'CI374.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI375.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'NIH LactMed (2021); AHPA Botanical Safety Handbook class 2c (not verified against AHPA).'
   where contraindication_id = 'CI375'
     and source_citation = 'NIH LactMed (2021); AHPA Botanical Safety Handbook class 2c.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI375' and source_citation = 'NIH LactMed (2021); AHPA Botanical Safety Handbook class 2c (not verified against AHPA).') then
      raise notice 'CI375.source_citation already corrected, skipped';
    else
      raise exception 'CI375.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H149.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Culinary and food amounts are recognized as safe (caraway is GRAS in the United States). Concentrated medicinal doses and the essential oil are best avoided in pregnancy: caraway seed carries a traditional emmenagogue and mild uterine-stimulant reputation and lacks adequate human safety data at therapeutic strength. Source: AHPA Botanical Safety Handbook, 2nd ed. (Class 1 (not verified against AHPA) seed, safe when used appropriately, in food use); Brinker, Herb Contraindications and Drug Interactions (traditional emmenagogue caution); FDA GRAS status.',
         last_updated = now()
   where herb_id = 'H149'
     and pregnancy_safety = 'Culinary and food amounts are recognized as safe (caraway is GRAS in the United States). Concentrated medicinal doses and the essential oil are best avoided in pregnancy: caraway seed carries a traditional emmenagogue and mild uterine-stimulant reputation and lacks adequate human safety data at therapeutic strength. Source: AHPA Botanical Safety Handbook, 2nd ed. (Class 1 seed, safe when used appropriately, in food use); Brinker, Herb Contraindications and Drug Interactions (traditional emmenagogue caution); FDA GRAS status.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H149' and pregnancy_safety = 'Culinary and food amounts are recognized as safe (caraway is GRAS in the United States). Concentrated medicinal doses and the essential oil are best avoided in pregnancy: caraway seed carries a traditional emmenagogue and mild uterine-stimulant reputation and lacks adequate human safety data at therapeutic strength. Source: AHPA Botanical Safety Handbook, 2nd ed. (Class 1 (not verified against AHPA) seed, safe when used appropriately, in food use); Brinker, Herb Contraindications and Drug Interactions (traditional emmenagogue caution); FDA GRAS status.') then
      raise notice 'H149.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H149.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI512.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 1 (not verified against AHPA) seed in food use); Brinker, Herb Contraindications and Drug Interactions.'
   where contraindication_id = 'CI512'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 1 seed in food use); Brinker, Herb Contraindications and Drug Interactions.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI512' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Class 1 (not verified against AHPA) seed in food use); Brinker, Herb Contraindications and Drug Interactions.') then
      raise notice 'CI512.source_citation already corrected, skipped';
    else
      raise exception 'CI512.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H157.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. Verbena officinalis has a long, well-documented reputation as a uterine stimulant, emmenagogue and oxytocic (historically used to promote labor and expel the placenta), and its iridoid glycosides are reported to bind dopamine receptors and stimulate luteinizing-hormone release. Modern safety references classify it as contraindicated in pregnancy, and animal reproductive studies of Verbena extract report reduced fetal weight gain and reduced bone ossification. Basis: AHPA Botanical Safety Handbook, 2nd ed. (contraindicated in pregnancy; reported safety class 2b (not verified against AHPA)); Brinker, Herbal Contraindications and Drug Interactions; corroborated by Chinese materia medica, which likewise contraindicates Ma Bian Cao in pregnancy.',
         last_updated = now()
   where herb_id = 'H157'
     and pregnancy_safety = 'Avoid. Verbena officinalis has a long, well-documented reputation as a uterine stimulant, emmenagogue and oxytocic (historically used to promote labor and expel the placenta), and its iridoid glycosides are reported to bind dopamine receptors and stimulate luteinizing-hormone release. Modern safety references classify it as contraindicated in pregnancy, and animal reproductive studies of Verbena extract report reduced fetal weight gain and reduced bone ossification. Basis: AHPA Botanical Safety Handbook, 2nd ed. (contraindicated in pregnancy; reported safety class 2b); Brinker, Herbal Contraindications and Drug Interactions; corroborated by Chinese materia medica, which likewise contraindicates Ma Bian Cao in pregnancy.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H157' and pregnancy_safety = 'Avoid. Verbena officinalis has a long, well-documented reputation as a uterine stimulant, emmenagogue and oxytocic (historically used to promote labor and expel the placenta), and its iridoid glycosides are reported to bind dopamine receptors and stimulate luteinizing-hormone release. Modern safety references classify it as contraindicated in pregnancy, and animal reproductive studies of Verbena extract report reduced fetal weight gain and reduced bone ossification. Basis: AHPA Botanical Safety Handbook, 2nd ed. (contraindicated in pregnancy; reported safety class 2b (not verified against AHPA)); Brinker, Herbal Contraindications and Drug Interactions; corroborated by Chinese materia medica, which likewise contraindicates Ma Bian Cao in pregnancy.') then
      raise notice 'H157.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H157.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI565.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (contraindicated in pregnancy; reported safety class 2b (not verified against AHPA)); Brinker, Herbal Contraindications and Drug Interactions; corroborated by Chinese materia medica (Ma Bian Cao contraindicated in pregnancy).'
   where contraindication_id = 'CI565'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (contraindicated in pregnancy; reported safety class 2b); Brinker, Herbal Contraindications and Drug Interactions; corroborated by Chinese materia medica (Ma Bian Cao contraindicated in pregnancy).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI565' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (contraindicated in pregnancy; reported safety class 2b (not verified against AHPA)); Brinker, Herbal Contraindications and Drug Interactions; corroborated by Chinese materia medica (Ma Bian Cao contraindicated in pregnancy).') then
      raise notice 'CI565.source_citation already corrected, skipped';
    else
      raise exception 'CI565.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H159.children_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'Used in children for constipation at reduced, age-appropriate doses, provided the child reliably drinks adequate fluid with each dose to prevent choking or obstruction. Avoid in a child who cannot swallow it with enough liquid. Sources: NCCIH; AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); standard pediatric bulk-laxative practice.',
         last_updated = now()
   where herb_id = 'H159'
     and children_safety = 'Used in children for constipation at reduced, age-appropriate doses, provided the child reliably drinks adequate fluid with each dose to prevent choking or obstruction. Avoid in a child who cannot swallow it with enough liquid. Sources: NCCIH; AHPA Botanical Safety Handbook, 2nd ed. (safety class 1); standard pediatric bulk-laxative practice.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H159' and children_safety = 'Used in children for constipation at reduced, age-appropriate doses, provided the child reliably drinks adequate fluid with each dose to prevent choking or obstruction. Avoid in a child who cannot swallow it with enough liquid. Sources: NCCIH; AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); standard pediatric bulk-laxative practice.') then
      raise notice 'H159.children_safety already corrected, skipped';
    else
      raise exception 'H159.children_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H159.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Considered safe. Psyllium is not absorbed systemically, and bulk-forming laxatives including psyllium are recommended as a first-line option for constipation in pregnancy when diet and fluids are insufficient. Take each dose with a full glass of water. Sources: AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); MotherToBaby (OTIS) Laxatives fact sheet; Mayo Clinic; NCCIH.',
         last_updated = now()
   where herb_id = 'H159'
     and pregnancy_safety = 'Considered safe. Psyllium is not absorbed systemically, and bulk-forming laxatives including psyllium are recommended as a first-line option for constipation in pregnancy when diet and fluids are insufficient. Take each dose with a full glass of water. Sources: AHPA Botanical Safety Handbook, 2nd ed. (safety class 1); MotherToBaby (OTIS) Laxatives fact sheet; Mayo Clinic; NCCIH.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H159' and pregnancy_safety = 'Considered safe. Psyllium is not absorbed systemically, and bulk-forming laxatives including psyllium are recommended as a first-line option for constipation in pregnancy when diet and fluids are insufficient. Take each dose with a full glass of water. Sources: AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); MotherToBaby (OTIS) Laxatives fact sheet; Mayo Clinic; NCCIH.') then
      raise notice 'H159.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H159.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H159.breastfeeding_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Considered compatible. Because psyllium is not absorbed from the gastrointestinal tract, it does not enter breast milk and is regarded as a safe choice for postpartum and lactational constipation. Sources: AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); NIH Drugs and Lactation Database (LactMed); NCCIH.',
         last_updated = now()
   where herb_id = 'H159'
     and breastfeeding_safety = 'Considered compatible. Because psyllium is not absorbed from the gastrointestinal tract, it does not enter breast milk and is regarded as a safe choice for postpartum and lactational constipation. Sources: AHPA Botanical Safety Handbook, 2nd ed. (safety class 1); NIH Drugs and Lactation Database (LactMed); NCCIH.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H159' and breastfeeding_safety = 'Considered compatible. Because psyllium is not absorbed from the gastrointestinal tract, it does not enter breast milk and is regarded as a safe choice for postpartum and lactational constipation. Sources: AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); NIH Drugs and Lactation Database (LactMed); NCCIH.') then
      raise notice 'H159.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H159.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI583.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); MotherToBaby (OTIS); NIH LactMed; NCCIH.'
   where contraindication_id = 'CI583'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (safety class 1); MotherToBaby (OTIS); NIH LactMed; NCCIH.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI583' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (safety class 1 (not verified against AHPA)); MotherToBaby (OTIS); NIH LactMed; NCCIH.') then
      raise notice 'CI583.source_citation already corrected, skipped';
    else
      raise exception 'CI583.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H170.drug_interactions: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'Warfarin and other coumarin anticoagulants: multiple published case reports describe elevated INR and bleeding (epistaxis, bruising, rectal bleeding) after goji juice, tea or wine in warfarin-treated patients, with a Naranjo-probable relationship; the likely mechanism is inhibition of CYP2C9-mediated warfarin metabolism. Avoid or, if unavoidable, monitor INR closely. Antidiabetic (hypoglycemic) drugs: Lycium barbarum polysaccharides can lower blood glucose, so additive hypoglycemia is plausible; monitor blood sugar. Immunosuppressants: theoretical antagonism from immune-stimulating polysaccharides (e.g. in transplant or autoimmune therapy); use caution. Basis: Lam 2001 and Rivera et al. 2012 (Pharmacotherapy) and the Gouqizi-wine case (PMC5598317); AHPA Botanical Safety Handbook (Lycium fruit, Interactions Class C (not verified against AHPA)); Mills & Bone herb-drug interaction principles. Human interaction data beyond the warfarin reports are limited.',
         last_updated = now()
   where herb_id = 'H170'
     and drug_interactions = 'Warfarin and other coumarin anticoagulants: multiple published case reports describe elevated INR and bleeding (epistaxis, bruising, rectal bleeding) after goji juice, tea or wine in warfarin-treated patients, with a Naranjo-probable relationship; the likely mechanism is inhibition of CYP2C9-mediated warfarin metabolism. Avoid or, if unavoidable, monitor INR closely. Antidiabetic (hypoglycemic) drugs: Lycium barbarum polysaccharides can lower blood glucose, so additive hypoglycemia is plausible; monitor blood sugar. Immunosuppressants: theoretical antagonism from immune-stimulating polysaccharides (e.g. in transplant or autoimmune therapy); use caution. Basis: Lam 2001 and Rivera et al. 2012 (Pharmacotherapy) and the Gouqizi-wine case (PMC5598317); AHPA Botanical Safety Handbook (Lycium fruit, Interactions Class C); Mills & Bone herb-drug interaction principles. Human interaction data beyond the warfarin reports are limited.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H170' and drug_interactions = 'Warfarin and other coumarin anticoagulants: multiple published case reports describe elevated INR and bleeding (epistaxis, bruising, rectal bleeding) after goji juice, tea or wine in warfarin-treated patients, with a Naranjo-probable relationship; the likely mechanism is inhibition of CYP2C9-mediated warfarin metabolism. Avoid or, if unavoidable, monitor INR closely. Antidiabetic (hypoglycemic) drugs: Lycium barbarum polysaccharides can lower blood glucose, so additive hypoglycemia is plausible; monitor blood sugar. Immunosuppressants: theoretical antagonism from immune-stimulating polysaccharides (e.g. in transplant or autoimmune therapy); use caution. Basis: Lam 2001 and Rivera et al. 2012 (Pharmacotherapy) and the Gouqizi-wine case (PMC5598317); AHPA Botanical Safety Handbook (Lycium fruit, Interactions Class C (not verified against AHPA)); Mills & Bone herb-drug interaction principles. Human interaction data beyond the warfarin reports are limited.') then
      raise notice 'H170.drug_interactions already corrected, skipped';
    else
      raise exception 'H170.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H170.secondary_sources: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C (not verified against AHPA)); drugs.com Natural Products database (Goji berry); Rivera et al., Probable Interaction Between Lycium barbarum (Goji) and Warfarin, Pharmacotherapy 2012 (PMID 22392461); Bleeding due to a probable interaction between warfarin and Gouqizi (PMC5598317); review: Lycium Barbarum: A Traditional Chinese Herb and A Promising Anti-Aging Agent (PMC5758351).',
         last_updated = now()
   where herb_id = 'H170'
     and secondary_sources = 'Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C); drugs.com Natural Products database (Goji berry); Rivera et al., Probable Interaction Between Lycium barbarum (Goji) and Warfarin, Pharmacotherapy 2012 (PMID 22392461); Bleeding due to a probable interaction between warfarin and Gouqizi (PMC5598317); review: Lycium Barbarum: A Traditional Chinese Herb and A Promising Anti-Aging Agent (PMC5758351).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H170' and secondary_sources = 'Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C (not verified against AHPA)); drugs.com Natural Products database (Goji berry); Rivera et al., Probable Interaction Between Lycium barbarum (Goji) and Warfarin, Pharmacotherapy 2012 (PMID 22392461); Bleeding due to a probable interaction between warfarin and Gouqizi (PMC5598317); review: Lycium Barbarum: A Traditional Chinese Herb and A Promising Anti-Aging Agent (PMC5758351).') then
      raise notice 'H170.secondary_sources already corrected, skipped';
    else
      raise exception 'H170.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H170.secondary_citation: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/", "kind": "pubmed", "year": "2013", "title": "Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C (not verified against AHPA)); drugs.com Natural Products database (Goji berry); Rivera et al.,", "author": "AHPA Botanical Safety Handbook", "locator": "Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C (not verified against AHPA)); drugs.com Natural Products database (Goji berry); Rivera et al.,", "source_id": "S14"}'::jsonb,
         last_updated = now()
   where herb_id = 'H170'
     and secondary_citation = '{"url": "https://www.ahpa.org/", "kind": "pubmed", "year": "2013", "title": "Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C); drugs.com Natural Products database (Goji berry); Rivera et al.,", "author": "AHPA Botanical Safety Handbook", "locator": "Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C); drugs.com Natural Products database (Goji berry); Rivera et al.,", "source_id": "S14"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H170' and secondary_citation = '{"url": "https://www.ahpa.org/", "kind": "pubmed", "year": "2013", "title": "Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C (not verified against AHPA)); drugs.com Natural Products database (Goji berry); Rivera et al.,", "author": "AHPA Botanical Safety Handbook", "locator": "Modern: Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica, 3rd ed. (Gou Qi Zi); AHPA Botanical Safety Handbook, 2nd ed. (Lycium barbarum, Interactions Class C (not verified against AHPA)); drugs.com Natural Products database (Goji berry); Rivera et al.,", "source_id": "S14"}'::jsonb) then
      raise notice 'H170.secondary_citation already corrected, skipped';
    else
      raise exception 'H170.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI658.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Rivera et al., Pharmacotherapy 2012 (PMID 22392461); Lam et al. 2001; Gouqizi-wine case (PMC5598317); AHPA Botanical Safety Handbook, 2nd ed. (Lycium fruit, Interactions Class C (not verified against AHPA)).'
   where contraindication_id = 'CI658'
     and source_citation = 'Rivera et al., Pharmacotherapy 2012 (PMID 22392461); Lam et al. 2001; Gouqizi-wine case (PMC5598317); AHPA Botanical Safety Handbook, 2nd ed. (Lycium fruit, Interactions Class C).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI658' and source_citation = 'Rivera et al., Pharmacotherapy 2012 (PMID 22392461); Lam et al. 2001; Gouqizi-wine case (PMC5598317); AHPA Botanical Safety Handbook, 2nd ed. (Lycium fruit, Interactions Class C (not verified against AHPA)).') then
      raise notice 'CI658.source_citation already corrected, skipped';
    else
      raise exception 'CI658.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI660.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Lycium fruit, Interactions Class C (not verified against AHPA)); Mills & Bone interaction principles.'
   where contraindication_id = 'CI660'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Lycium fruit, Interactions Class C); Mills & Bone interaction principles.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI660' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Lycium fruit, Interactions Class C (not verified against AHPA)); Mills & Bone interaction principles.') then
      raise notice 'CI660.source_citation already corrected, skipped';
    else
      raise exception 'CI660.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H171.pregnancy_safety: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook (2nd ed., 2013) assigns Lobelia inflata safety class 2b (not verified against AHPA): not to be used during pregnancy. Its principal alkaloid, lobeline, is a nicotinic acetylcholine receptor agonist, and the herb is emetic and alters respiration, heart rate, and blood pressure, so it is avoided in pregnancy. Sources: AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Lobelia inflata (class 2b (not verified against AHPA)); Memorial Sloan Kettering About Herbs, Lobelia.',
         last_updated = now()
   where herb_id = 'H171'
     and pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook (2nd ed., 2013) assigns Lobelia inflata safety class 2b: not to be used during pregnancy. Its principal alkaloid, lobeline, is a nicotinic acetylcholine receptor agonist, and the herb is emetic and alters respiration, heart rate, and blood pressure, so it is avoided in pregnancy. Sources: AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Lobelia inflata (class 2b); Memorial Sloan Kettering About Herbs, Lobelia.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H171' and pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook (2nd ed., 2013) assigns Lobelia inflata safety class 2b (not verified against AHPA): not to be used during pregnancy. Its principal alkaloid, lobeline, is a nicotinic acetylcholine receptor agonist, and the herb is emetic and alters respiration, heart rate, and blood pressure, so it is avoided in pregnancy. Sources: AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Lobelia inflata (class 2b (not verified against AHPA)); Memorial Sloan Kettering About Herbs, Lobelia.') then
      raise notice 'H171.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H171.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H171.drug_interactions: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'The AHPA Botanical Safety Handbook assigns Lobelia interaction class A (not verified against AHPA) (no clinically relevant interactions expected). The important exception is additive nicotinic toxicity with nicotine and nicotine-replacement products (patches, gum, lozenges) and with tobacco, because lobeline and nicotine act on the same receptors; Memorial Sloan Kettering lists nicotine-containing products as a contraindication. Theoretical additive effects with other stimulants, and, at high (depressant) doses, additive central-nervous-system and respiratory depression with sedatives, opioids, and anesthetics. No well-documented cytochrome P450 interactions are established (limited data). Sources: AHPA Botanical Safety Handbook, 2nd ed. (2013), interaction class A (not verified against AHPA); Memorial Sloan Kettering About Herbs, Lobelia (nicotine additive toxicity).',
         last_updated = now()
   where herb_id = 'H171'
     and drug_interactions = 'The AHPA Botanical Safety Handbook assigns Lobelia interaction class A (no clinically relevant interactions expected). The important exception is additive nicotinic toxicity with nicotine and nicotine-replacement products (patches, gum, lozenges) and with tobacco, because lobeline and nicotine act on the same receptors; Memorial Sloan Kettering lists nicotine-containing products as a contraindication. Theoretical additive effects with other stimulants, and, at high (depressant) doses, additive central-nervous-system and respiratory depression with sedatives, opioids, and anesthetics. No well-documented cytochrome P450 interactions are established (limited data). Sources: AHPA Botanical Safety Handbook, 2nd ed. (2013), interaction class A; Memorial Sloan Kettering About Herbs, Lobelia (nicotine additive toxicity).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H171' and drug_interactions = 'The AHPA Botanical Safety Handbook assigns Lobelia interaction class A (not verified against AHPA) (no clinically relevant interactions expected). The important exception is additive nicotinic toxicity with nicotine and nicotine-replacement products (patches, gum, lozenges) and with tobacco, because lobeline and nicotine act on the same receptors; Memorial Sloan Kettering lists nicotine-containing products as a contraindication. Theoretical additive effects with other stimulants, and, at high (depressant) doses, additive central-nervous-system and respiratory depression with sedatives, opioids, and anesthetics. No well-documented cytochrome P450 interactions are established (limited data). Sources: AHPA Botanical Safety Handbook, 2nd ed. (2013), interaction class A (not verified against AHPA); Memorial Sloan Kettering About Herbs, Lobelia (nicotine additive toxicity).') then
      raise notice 'H171.drug_interactions already corrected, skipped';
    else
      raise exception 'H171.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H171.secondary_sources: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b (not verified against AHPA), interaction class A (not verified against AHPA)); Memorial Sloan Kettering Cancer Center, About Herbs: Lobelia; ScienceDirect, Lobelia inflata overview (lobeline pharmacology and toxicity).',
         last_updated = now()
   where herb_id = 'H171'
     and secondary_sources = 'Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b, interaction class A); Memorial Sloan Kettering Cancer Center, About Herbs: Lobelia; ScienceDirect, Lobelia inflata overview (lobeline pharmacology and toxicity).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H171' and secondary_sources = 'Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b (not verified against AHPA), interaction class A (not verified against AHPA)); Memorial Sloan Kettering Cancer Center, About Herbs: Lobelia; ScienceDirect, Lobelia inflata overview (lobeline pharmacology and toxicity).') then
      raise notice 'H171.secondary_sources already corrected, skipped';
    else
      raise exception 'H171.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H171.secondary_citation: label 4 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.henriettes-herb.com/eclectic/kings/", "kind": "public_domain_text", "year": "1898", "title": "Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b (not verified against AHPA), interaction class A (not verified against AHPA)); Memorial S", "author": "King''s American Dispensatory", "locator": "Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b (not verified against AHPA), interaction class A (not verified against AHPA)); Memorial S", "source_id": "S01"}'::jsonb,
         last_updated = now()
   where herb_id = 'H171'
     and secondary_citation = '{"url": "https://www.henriettes-herb.com/eclectic/kings/", "kind": "public_domain_text", "year": "1898", "title": "Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b, interaction class A); Memorial S", "author": "King''s American Dispensatory", "locator": "Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b, interaction class A); Memorial S", "source_id": "S01"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H171' and secondary_citation = '{"url": "https://www.henriettes-herb.com/eclectic/kings/", "kind": "public_domain_text", "year": "1898", "title": "Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b (not verified against AHPA), interaction class A (not verified against AHPA)); Memorial S", "author": "King''s American Dispensatory", "locator": "Grieve, A Modern Herbal (1931): Lobelia; Cook, The Physio-Medical Dispensatory (1869): Lobelia inflata; AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Lobelia inflata (safety class 2b (not verified against AHPA), interaction class A (not verified against AHPA)); Memorial S", "source_id": "S01"}'::jsonb) then
      raise notice 'H171.secondary_citation already corrected, skipped';
    else
      raise exception 'H171.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI664.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Lobelia inflata (class 2b (not verified against AHPA)); Memorial Sloan Kettering About Herbs, Lobelia.'
   where contraindication_id = 'CI664'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Lobelia inflata (class 2b); Memorial Sloan Kettering About Herbs, Lobelia.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI664' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Lobelia inflata (class 2b (not verified against AHPA)); Memorial Sloan Kettering About Herbs, Lobelia.') then
      raise notice 'CI664.source_citation already corrected, skipped';
    else
      raise exception 'CI664.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI664.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Lobeline is a nicotinic acetylcholine receptor agonist; the herb is emetic and alters respiration, heart rate, and blood pressure. AHPA safety class 2b (not verified against AHPA) (not to be used during pregnancy).'
   where contraindication_id = 'CI664'
     and mechanism_rationale = 'Lobeline is a nicotinic acetylcholine receptor agonist; the herb is emetic and alters respiration, heart rate, and blood pressure. AHPA safety class 2b (not to be used during pregnancy).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI664' and mechanism_rationale = 'Lobeline is a nicotinic acetylcholine receptor agonist; the herb is emetic and alters respiration, heart rate, and blood pressure. AHPA safety class 2b (not verified against AHPA) (not to be used during pregnancy).') then
      raise notice 'CI664.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI664.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H172.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid throughout pregnancy. The American Herbal Products Association Botanical Safety Handbook (2nd ed., 2013) assigns Asclepias tuberosa Safety Class 2b (not verified against AHPA) (not to be used during pregnancy); animal data show uterine-stimulant (uterotonic) activity, and the root is emetic with possible estrogenic activity. Brinker likewise lists it as contraindicated in pregnancy. Source: AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Asclepias tuberosa; Brinker, Herb Contraindications and Drug Interactions.',
         last_updated = now()
   where herb_id = 'H172'
     and pregnancy_safety = 'Avoid throughout pregnancy. The American Herbal Products Association Botanical Safety Handbook (2nd ed., 2013) assigns Asclepias tuberosa Safety Class 2b (not to be used during pregnancy); animal data show uterine-stimulant (uterotonic) activity, and the root is emetic with possible estrogenic activity. Brinker likewise lists it as contraindicated in pregnancy. Source: AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Asclepias tuberosa; Brinker, Herb Contraindications and Drug Interactions.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H172' and pregnancy_safety = 'Avoid throughout pregnancy. The American Herbal Products Association Botanical Safety Handbook (2nd ed., 2013) assigns Asclepias tuberosa Safety Class 2b (not verified against AHPA) (not to be used during pregnancy); animal data show uterine-stimulant (uterotonic) activity, and the root is emetic with possible estrogenic activity. Brinker likewise lists it as contraindicated in pregnancy. Source: AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Asclepias tuberosa; Brinker, Herb Contraindications and Drug Interactions.') then
      raise notice 'H172.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H172.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H172.drug_interactions: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'Cardiac glycosides (digoxin, digitoxin): avoid concurrent use. Pleurisy root contains cardioactive pregnane glycosides (and, per some analyses, cardenolides), so it may add to or potentiate the effects and toxicity of cardiac glycoside drugs; potassium-depleting diuretics and other cardioactive agents warrant the same caution. Note that the AHPA Botanical Safety Handbook assigns an Interaction Class A (not verified against AHPA) (no clinically documented interactions expected), but multiple clinical references advise avoiding cardiac glycosides on mechanistic grounds. Otherwise no well-documented pharmaceutical interactions (limited data). Sources: Brinker, Herb Contraindications and Drug Interactions; AHPA Botanical Safety Handbook, 2nd ed. (2013, Interaction Class A (not verified against AHPA)); Herbal Reality clinical monograph.',
         last_updated = now()
   where herb_id = 'H172'
     and drug_interactions = 'Cardiac glycosides (digoxin, digitoxin): avoid concurrent use. Pleurisy root contains cardioactive pregnane glycosides (and, per some analyses, cardenolides), so it may add to or potentiate the effects and toxicity of cardiac glycoside drugs; potassium-depleting diuretics and other cardioactive agents warrant the same caution. Note that the AHPA Botanical Safety Handbook assigns an Interaction Class A (no clinically documented interactions expected), but multiple clinical references advise avoiding cardiac glycosides on mechanistic grounds. Otherwise no well-documented pharmaceutical interactions (limited data). Sources: Brinker, Herb Contraindications and Drug Interactions; AHPA Botanical Safety Handbook, 2nd ed. (2013, Interaction Class A); Herbal Reality clinical monograph.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H172' and drug_interactions = 'Cardiac glycosides (digoxin, digitoxin): avoid concurrent use. Pleurisy root contains cardioactive pregnane glycosides (and, per some analyses, cardenolides), so it may add to or potentiate the effects and toxicity of cardiac glycoside drugs; potassium-depleting diuretics and other cardioactive agents warrant the same caution. Note that the AHPA Botanical Safety Handbook assigns an Interaction Class A (not verified against AHPA) (no clinically documented interactions expected), but multiple clinical references advise avoiding cardiac glycosides on mechanistic grounds. Otherwise no well-documented pharmaceutical interactions (limited data). Sources: Brinker, Herb Contraindications and Drug Interactions; AHPA Botanical Safety Handbook, 2nd ed. (2013, Interaction Class A (not verified against AHPA)); Herbal Reality clinical monograph.') then
      raise notice 'H172.drug_interactions already corrected, skipped';
    else
      raise exception 'H172.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H172.secondary_sources: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b (not verified against AHPA), Interaction Class A (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions (Eclectic Medical Publications); Herbal Reality clinical monograph (Asclepias tuberosa).',
         last_updated = now()
   where herb_id = 'H172'
     and secondary_sources = 'Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b, Interaction Class A); Brinker, Herb Contraindications and Drug Interactions (Eclectic Medical Publications); Herbal Reality clinical monograph (Asclepias tuberosa).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H172' and secondary_sources = 'Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b (not verified against AHPA), Interaction Class A (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions (Eclectic Medical Publications); Herbal Reality clinical monograph (Asclepias tuberosa).') then
      raise notice 'H172.secondary_sources already corrected, skipped';
    else
      raise exception 'H172.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H172.secondary_citation: label 4 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.botanical.com/", "kind": "public_domain_text", "year": "1931", "title": "Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b (not verified against AHPA), Interaction Class A (not verified against AHPA)); Brinker, H", "author": "Grieve — A Modern Herbal", "locator": "Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b (not verified against AHPA), Interaction Class A (not verified against AHPA)); Brinker, H", "source_id": "S07"}'::jsonb,
         last_updated = now()
   where herb_id = 'H172'
     and secondary_citation = '{"url": "https://www.botanical.com/", "kind": "public_domain_text", "year": "1931", "title": "Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b, Interaction Class A); Brinker, H", "author": "Grieve — A Modern Herbal", "locator": "Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b, Interaction Class A); Brinker, H", "source_id": "S07"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H172' and secondary_citation = '{"url": "https://www.botanical.com/", "kind": "public_domain_text", "year": "1931", "title": "Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b (not verified against AHPA), Interaction Class A (not verified against AHPA)); Brinker, H", "author": "Grieve — A Modern Herbal", "locator": "Grieve''s A Modern Herbal (1931): Pleurisy Root / Asclepias tuberosa; American Herbal Products Association Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013): Asclepias tuberosa (Safety Class 2b (not verified against AHPA), Interaction Class A (not verified against AHPA)); Brinker, H", "source_id": "S07"}'::jsonb) then
      raise notice 'H172.secondary_citation already corrected, skipped';
    else
      raise exception 'H172.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H172.contraindications_general: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'Pregnancy (uterine stimulant and emetic; AHPA Botanical Safety Handbook Safety Class 2b (not verified against AHPA)). Concurrent cardiac glycoside therapy (digoxin, digitoxin) and significant cardiac arrhythmia, given cardioactive pregnane and cardenolide constituents. Known hypersensitivity to Asclepias species. Avoid medicinal doses during lactation and in young children for lack of safety data; a febrile chest illness in a child warrants medical assessment rather than self-treatment.',
         last_updated = now()
   where herb_id = 'H172'
     and contraindications_general = 'Pregnancy (uterine stimulant and emetic; AHPA Botanical Safety Handbook Safety Class 2b). Concurrent cardiac glycoside therapy (digoxin, digitoxin) and significant cardiac arrhythmia, given cardioactive pregnane and cardenolide constituents. Known hypersensitivity to Asclepias species. Avoid medicinal doses during lactation and in young children for lack of safety data; a febrile chest illness in a child warrants medical assessment rather than self-treatment.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H172' and contraindications_general = 'Pregnancy (uterine stimulant and emetic; AHPA Botanical Safety Handbook Safety Class 2b (not verified against AHPA)). Concurrent cardiac glycoside therapy (digoxin, digitoxin) and significant cardiac arrhythmia, given cardioactive pregnane and cardenolide constituents. Known hypersensitivity to Asclepias species. Avoid medicinal doses during lactation and in young children for lack of safety data; a febrile chest illness in a child warrants medical assessment rather than self-treatment.') then
      raise notice 'H172.contraindications_general already corrected, skipped';
    else
      raise exception 'H172.contraindications_general: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI671.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Asclepias tuberosa (Safety Class 2b (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions.'
   where contraindication_id = 'CI671'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Asclepias tuberosa (Safety Class 2b); Brinker, Herb Contraindications and Drug Interactions.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI671' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner and McGuffin, 2013), Asclepias tuberosa (Safety Class 2b (not verified against AHPA)); Brinker, Herb Contraindications and Drug Interactions.') then
      raise notice 'CI671.source_citation already corrected, skipped';
    else
      raise exception 'CI671.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI671.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Uterine-stimulant (uterotonic) activity in animal studies, plus emetic action and possible estrogenic activity; AHPA Safety Class 2b (not verified against AHPA).'
   where contraindication_id = 'CI671'
     and mechanism_rationale = 'Uterine-stimulant (uterotonic) activity in animal studies, plus emetic action and possible estrogenic activity; AHPA Safety Class 2b.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI671' and mechanism_rationale = 'Uterine-stimulant (uterotonic) activity in animal studies, plus emetic action and possible estrogenic activity; AHPA Safety Class 2b (not verified against AHPA).') then
      raise notice 'CI671.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI671.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI674.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Brinker, Herb Contraindications and Drug Interactions; Herbal Reality clinical monograph; AHPA Botanical Safety Handbook, 2nd ed. (2013, Interaction Class A (not verified against AHPA)).'
   where contraindication_id = 'CI674'
     and source_citation = 'Brinker, Herb Contraindications and Drug Interactions; Herbal Reality clinical monograph; AHPA Botanical Safety Handbook, 2nd ed. (2013, Interaction Class A).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI674' and source_citation = 'Brinker, Herb Contraindications and Drug Interactions; Herbal Reality clinical monograph; AHPA Botanical Safety Handbook, 2nd ed. (2013, Interaction Class A (not verified against AHPA)).') then
      raise notice 'CI674.source_citation already corrected, skipped';
    else
      raise exception 'CI674.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI674.clinical_guidance: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set clinical_guidance = 'Avoid concurrent use with cardiac glycosides; use caution with other cardioactive drugs and in patients with arrhythmia. Note AHPA assigns Interaction Class A (not verified against AHPA), but mechanism-based caution is advised.'
   where contraindication_id = 'CI674'
     and clinical_guidance = 'Avoid concurrent use with cardiac glycosides; use caution with other cardioactive drugs and in patients with arrhythmia. Note AHPA assigns Interaction Class A, but mechanism-based caution is advised.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI674' and clinical_guidance = 'Avoid concurrent use with cardiac glycosides; use caution with other cardioactive drugs and in patients with arrhythmia. Note AHPA assigns Interaction Class A (not verified against AHPA), but mechanism-based caution is advised.') then
      raise notice 'CI674.clinical_guidance already corrected, skipped';
    else
      raise exception 'CI674.clinical_guidance: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H177.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook assigns Forsythia fruit a pregnancy-restriction classification (historically Class 2B (not verified against AHPA), not to be used during pregnancy), reflecting a traditional emmenagogue and uterine-stimulant reputation, and modern human safety data in pregnancy are lacking. Both the Western herbal literature (Natural Medicines / WebMD: not enough is known, stay on the safe side and avoid) and classical Chinese practice counsel against use in pregnancy. Absent adequate safety data, do not use during pregnancy. Sources: AHPA Botanical Safety Handbook (McGuffin et al.); Natural Medicines / WebMD forsythia monograph; Chen and Chen, Chinese Medical Herbology and Pharmacology.',
         last_updated = now()
   where herb_id = 'H177'
     and pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook assigns Forsythia fruit a pregnancy-restriction classification (historically Class 2B, not to be used during pregnancy), reflecting a traditional emmenagogue and uterine-stimulant reputation, and modern human safety data in pregnancy are lacking. Both the Western herbal literature (Natural Medicines / WebMD: not enough is known, stay on the safe side and avoid) and classical Chinese practice counsel against use in pregnancy. Absent adequate safety data, do not use during pregnancy. Sources: AHPA Botanical Safety Handbook (McGuffin et al.); Natural Medicines / WebMD forsythia monograph; Chen and Chen, Chinese Medical Herbology and Pharmacology.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H177' and pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook assigns Forsythia fruit a pregnancy-restriction classification (historically Class 2B (not verified against AHPA), not to be used during pregnancy), reflecting a traditional emmenagogue and uterine-stimulant reputation, and modern human safety data in pregnancy are lacking. Both the Western herbal literature (Natural Medicines / WebMD: not enough is known, stay on the safe side and avoid) and classical Chinese practice counsel against use in pregnancy. Absent adequate safety data, do not use during pregnancy. Sources: AHPA Botanical Safety Handbook (McGuffin et al.); Natural Medicines / WebMD forsythia monograph; Chen and Chen, Chinese Medical Herbology and Pharmacology.') then
      raise notice 'H177.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H177.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H190.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Likely safe in the amounts commonly found in food and juice; concentrated supplements are less well studied. NCCIH states that some studies of cranberry in pregnancy suggest it is safe in amounts commonly found in food, though the evidence is not conclusive for larger, concentrated amounts. A survey of about 400 pregnant women who regularly consumed cranberry found no associated adverse events. AHPA classifies the fruit as Class 1 (not verified against AHPA) (safe when used appropriately). Food and juice amounts are considered acceptable; high-dose supplements should be used only with clinician advice, and any UTI in pregnancy needs medical treatment. Sources: NCCIH (Cranberry: Usefulness and Safety); Wing et al., survey of cranberry use in pregnancy; AHPA Botanical Safety Handbook, 2nd ed.',
         last_updated = now()
   where herb_id = 'H190'
     and pregnancy_safety = 'Likely safe in the amounts commonly found in food and juice; concentrated supplements are less well studied. NCCIH states that some studies of cranberry in pregnancy suggest it is safe in amounts commonly found in food, though the evidence is not conclusive for larger, concentrated amounts. A survey of about 400 pregnant women who regularly consumed cranberry found no associated adverse events. AHPA classifies the fruit as Class 1 (safe when used appropriately). Food and juice amounts are considered acceptable; high-dose supplements should be used only with clinician advice, and any UTI in pregnancy needs medical treatment. Sources: NCCIH (Cranberry: Usefulness and Safety); Wing et al., survey of cranberry use in pregnancy; AHPA Botanical Safety Handbook, 2nd ed.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H190' and pregnancy_safety = 'Likely safe in the amounts commonly found in food and juice; concentrated supplements are less well studied. NCCIH states that some studies of cranberry in pregnancy suggest it is safe in amounts commonly found in food, though the evidence is not conclusive for larger, concentrated amounts. A survey of about 400 pregnant women who regularly consumed cranberry found no associated adverse events. AHPA classifies the fruit as Class 1 (not verified against AHPA) (safe when used appropriately). Food and juice amounts are considered acceptable; high-dose supplements should be used only with clinician advice, and any UTI in pregnancy needs medical treatment. Sources: NCCIH (Cranberry: Usefulness and Safety); Wing et al., survey of cranberry use in pregnancy; AHPA Botanical Safety Handbook, 2nd ed.') then
      raise notice 'H190.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H190.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI791.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Food and juice amounts appear safe; concentrated supplements are less well studied. A survey of about 400 pregnant women found no adverse events, and AHPA classes the fruit as Class 1 (not verified against AHPA).'
   where contraindication_id = 'CI791'
     and mechanism_rationale = 'Food and juice amounts appear safe; concentrated supplements are less well studied. A survey of about 400 pregnant women found no adverse events, and AHPA classes the fruit as Class 1.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI791' and mechanism_rationale = 'Food and juice amounts appear safe; concentrated supplements are less well studied. A survey of about 400 pregnant women found no adverse events, and AHPA classes the fruit as Class 1 (not verified against AHPA).') then
      raise notice 'CI791.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI791.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H246.children_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set children_safety = 'The fresh or dried fruit is commonly and safely eaten by children in moderation and is a food-level exposure (AHPA Class 1 (not verified against AHPA)). Its high sugar content argues for moderation for dental and blood-sugar reasons. There is no established pediatric dosing for concentrated medicinal preparations of the dried aril; reserve therapeutic tonic doses for use under a qualified practitioner, and treat longan for children mainly as a gentle food in soups and congee.',
         last_updated = now()
   where herb_id = 'H246'
     and children_safety = 'The fresh or dried fruit is commonly and safely eaten by children in moderation and is a food-level exposure (AHPA Class 1). Its high sugar content argues for moderation for dental and blood-sugar reasons. There is no established pediatric dosing for concentrated medicinal preparations of the dried aril; reserve therapeutic tonic doses for use under a qualified practitioner, and treat longan for children mainly as a gentle food in soups and congee.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H246' and children_safety = 'The fresh or dried fruit is commonly and safely eaten by children in moderation and is a food-level exposure (AHPA Class 1 (not verified against AHPA)). Its high sugar content argues for moderation for dental and blood-sugar reasons. There is no established pediatric dosing for concentrated medicinal preparations of the dried aril; reserve therapeutic tonic doses for use under a qualified practitioner, and treat longan for children mainly as a gentle food in soups and congee.') then
      raise notice 'H246.children_safety already corrected, skipped';
    else
      raise exception 'H246.children_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H246.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Culinary amounts of the fruit are a food-level exposure and are generally regarded as safe; the American Herbal Products Association Botanical Safety Handbook rates longan fruit as a Class 1 (not verified against AHPA) herb (one that can be safely consumed when used appropriately). Therapeutic or concentrated medicinal amounts of the dried aril, however, are traditionally cautioned in pregnancy: classical and modern Chinese-medicine sources hold that its sweet, warm nature can generate internal heat and dampness that may disturb a pregnancy, and several advise pregnant women, especially in the first trimester, to avoid concentrated longan. Reliable modern human safety data for medicinal doses in pregnancy are lacking. Prudent, consumer-safe course: the fruit in normal food amounts is of low concern, but avoid concentrated therapeutic doses in pregnancy unless supervised by a qualified practitioner.',
         last_updated = now()
   where herb_id = 'H246'
     and pregnancy_safety = 'Culinary amounts of the fruit are a food-level exposure and are generally regarded as safe; the American Herbal Products Association Botanical Safety Handbook rates longan fruit as a Class 1 herb (one that can be safely consumed when used appropriately). Therapeutic or concentrated medicinal amounts of the dried aril, however, are traditionally cautioned in pregnancy: classical and modern Chinese-medicine sources hold that its sweet, warm nature can generate internal heat and dampness that may disturb a pregnancy, and several advise pregnant women, especially in the first trimester, to avoid concentrated longan. Reliable modern human safety data for medicinal doses in pregnancy are lacking. Prudent, consumer-safe course: the fruit in normal food amounts is of low concern, but avoid concentrated therapeutic doses in pregnancy unless supervised by a qualified practitioner.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H246' and pregnancy_safety = 'Culinary amounts of the fruit are a food-level exposure and are generally regarded as safe; the American Herbal Products Association Botanical Safety Handbook rates longan fruit as a Class 1 (not verified against AHPA) herb (one that can be safely consumed when used appropriately). Therapeutic or concentrated medicinal amounts of the dried aril, however, are traditionally cautioned in pregnancy: classical and modern Chinese-medicine sources hold that its sweet, warm nature can generate internal heat and dampness that may disturb a pregnancy, and several advise pregnant women, especially in the first trimester, to avoid concentrated longan. Reliable modern human safety data for medicinal doses in pregnancy are lacking. Prudent, consumer-safe course: the fruit in normal food amounts is of low concern, but avoid concentrated therapeutic doses in pregnancy unless supervised by a qualified practitioner.') then
      raise notice 'H246.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H246.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H246.secondary_sources: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (Long Yan Rou); Chen & Chen, Chinese Medical Herbology and Pharmacology (Longan Arillus); Yan Yonghe, Ji Sheng Fang (1253), the source of Gui Pi Tang (Restore the Spleen Decoction), in which longan is a principal herb; AHPA Botanical Safety Handbook (longan fruit, Class 1 (not verified against AHPA)); modern phytochemical work on longan polyphenols and the longan genome (Lin et al., GigaScience, 2017, PMC5467034).',
         last_updated = now()
   where herb_id = 'H246'
     and secondary_sources = 'Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (Long Yan Rou); Chen & Chen, Chinese Medical Herbology and Pharmacology (Longan Arillus); Yan Yonghe, Ji Sheng Fang (1253), the source of Gui Pi Tang (Restore the Spleen Decoction), in which longan is a principal herb; AHPA Botanical Safety Handbook (longan fruit, Class 1); modern phytochemical work on longan polyphenols and the longan genome (Lin et al., GigaScience, 2017, PMC5467034).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H246' and secondary_sources = 'Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (Long Yan Rou); Chen & Chen, Chinese Medical Herbology and Pharmacology (Longan Arillus); Yan Yonghe, Ji Sheng Fang (1253), the source of Gui Pi Tang (Restore the Spleen Decoction), in which longan is a principal herb; AHPA Botanical Safety Handbook (longan fruit, Class 1 (not verified against AHPA)); modern phytochemical work on longan polyphenols and the longan genome (Lin et al., GigaScience, 2017, PMC5467034).') then
      raise notice 'H246.secondary_sources already corrected, skipped';
    else
      raise exception 'H246.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H246.breastfeeding_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'As a food fruit, culinary longan is a food-level exposure of low concern during lactation, and dried longan appears in some traditional postpartum tonic soups. There are no specific modern human safety data for concentrated therapeutic doses of the dried aril during breastfeeding, so reserve medicinal amounts for use under professional guidance. AHPA rates the fruit Class 1 (not verified against AHPA), with no restriction identified for appropriate use.',
         last_updated = now()
   where herb_id = 'H246'
     and breastfeeding_safety = 'As a food fruit, culinary longan is a food-level exposure of low concern during lactation, and dried longan appears in some traditional postpartum tonic soups. There are no specific modern human safety data for concentrated therapeutic doses of the dried aril during breastfeeding, so reserve medicinal amounts for use under professional guidance. AHPA rates the fruit Class 1, with no restriction identified for appropriate use.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H246' and breastfeeding_safety = 'As a food fruit, culinary longan is a food-level exposure of low concern during lactation, and dried longan appears in some traditional postpartum tonic soups. There are no specific modern human safety data for concentrated therapeutic doses of the dried aril during breastfeeding, so reserve medicinal amounts for use under professional guidance. AHPA rates the fruit Class 1 (not verified against AHPA), with no restriction identified for appropriate use.') then
      raise notice 'H246.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H246.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1175.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'Traditional TCM caution (multiple Chinese materia medica sources); AHPA Botanical Safety Handbook (fruit, Class 1 (not verified against AHPA)); modern pregnancy-specific data lacking.'
   where contraindication_id = 'CI1175'
     and source_citation = 'Traditional TCM caution (multiple Chinese materia medica sources); AHPA Botanical Safety Handbook (fruit, Class 1); modern pregnancy-specific data lacking.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1175' and source_citation = 'Traditional TCM caution (multiple Chinese materia medica sources); AHPA Botanical Safety Handbook (fruit, Class 1 (not verified against AHPA)); modern pregnancy-specific data lacking.') then
      raise notice 'CI1175.source_citation already corrected, skipped';
    else
      raise exception 'CI1175.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H260.cautions: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set cautions = 'Safflower florets are a potent blood-mover, and the cautions follow directly from that action. The overriding caution is pregnancy: Hong Hua stimulates the uterus and moves blood, is a traditional emmenagogue, and in large doses has been used to bring on menses and terminate pregnancy, so it is contraindicated throughout pregnancy (AHPA class 2b (not verified against AHPA)). Because it inhibits platelet aggregation and quickens the blood, it must be used cautiously, or avoided, in anyone with a bleeding disorder, hemorrhagic disease, peptic ulcer, heavy menstrual bleeding, or a recent or imminent surgery, and in anyone taking anticoagulant or antiplatelet medication, where bleeding risk is additive (AHPA class 2d (not verified against AHPA)). It is inappropriate in blood deficiency without stasis, where it depletes rather than helps. Dosing matters: small doses (under about 1.5 g) gently harmonize and nourish the blood, while larger doses break stasis, and very large doses can be toxic and are abortifacient, so heroic dosing is avoided. Because fixed chest pain, abnormal uterine bleeding, and palpable masses can signal serious disease, the herb should complement, not replace, proper diagnosis.',
         last_updated = now()
   where herb_id = 'H260'
     and cautions = 'Safflower florets are a potent blood-mover, and the cautions follow directly from that action. The overriding caution is pregnancy: Hong Hua stimulates the uterus and moves blood, is a traditional emmenagogue, and in large doses has been used to bring on menses and terminate pregnancy, so it is contraindicated throughout pregnancy (AHPA class 2b). Because it inhibits platelet aggregation and quickens the blood, it must be used cautiously, or avoided, in anyone with a bleeding disorder, hemorrhagic disease, peptic ulcer, heavy menstrual bleeding, or a recent or imminent surgery, and in anyone taking anticoagulant or antiplatelet medication, where bleeding risk is additive (AHPA class 2d). It is inappropriate in blood deficiency without stasis, where it depletes rather than helps. Dosing matters: small doses (under about 1.5 g) gently harmonize and nourish the blood, while larger doses break stasis, and very large doses can be toxic and are abortifacient, so heroic dosing is avoided. Because fixed chest pain, abnormal uterine bleeding, and palpable masses can signal serious disease, the herb should complement, not replace, proper diagnosis.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H260' and cautions = 'Safflower florets are a potent blood-mover, and the cautions follow directly from that action. The overriding caution is pregnancy: Hong Hua stimulates the uterus and moves blood, is a traditional emmenagogue, and in large doses has been used to bring on menses and terminate pregnancy, so it is contraindicated throughout pregnancy (AHPA class 2b (not verified against AHPA)). Because it inhibits platelet aggregation and quickens the blood, it must be used cautiously, or avoided, in anyone with a bleeding disorder, hemorrhagic disease, peptic ulcer, heavy menstrual bleeding, or a recent or imminent surgery, and in anyone taking anticoagulant or antiplatelet medication, where bleeding risk is additive (AHPA class 2d (not verified against AHPA)). It is inappropriate in blood deficiency without stasis, where it depletes rather than helps. Dosing matters: small doses (under about 1.5 g) gently harmonize and nourish the blood, while larger doses break stasis, and very large doses can be toxic and are abortifacient, so heroic dosing is avoided. Because fixed chest pain, abnormal uterine bleeding, and palpable masses can signal serious disease, the herb should complement, not replace, proper diagnosis.') then
      raise notice 'H260.cautions already corrected, skipped';
    else
      raise exception 'H260.cautions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H260.pregnancy_safety: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Contraindicated in pregnancy. Safflower flower (Hong Hua) is a recognized emmenagogue and uterine stimulant that invigorates blood and, in large doses, has traditionally been used to promote menstruation and to terminate pregnancy; it is rated AHPA Botanical Safety Handbook class 2b (not verified against AHPA) (not to be used during pregnancy). The classical Chinese materia medica likewise lists it as contraindicated in pregnancy. This applies to the medicinal florets; culinary safflower seed oil, a distinct food product, is a separate matter and is not implicated. Avoid Hong Hua in all therapeutic forms throughout pregnancy. Sources: AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (not verified against AHPA); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed); Brinker, Herbal Contraindications and Drug Interactions.',
         last_updated = now()
   where herb_id = 'H260'
     and pregnancy_safety = 'Contraindicated in pregnancy. Safflower flower (Hong Hua) is a recognized emmenagogue and uterine stimulant that invigorates blood and, in large doses, has traditionally been used to promote menstruation and to terminate pregnancy; it is rated AHPA Botanical Safety Handbook class 2b (not to be used during pregnancy). The classical Chinese materia medica likewise lists it as contraindicated in pregnancy. This applies to the medicinal florets; culinary safflower seed oil, a distinct food product, is a separate matter and is not implicated. Avoid Hong Hua in all therapeutic forms throughout pregnancy. Sources: AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b; Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed); Brinker, Herbal Contraindications and Drug Interactions.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H260' and pregnancy_safety = 'Contraindicated in pregnancy. Safflower flower (Hong Hua) is a recognized emmenagogue and uterine stimulant that invigorates blood and, in large doses, has traditionally been used to promote menstruation and to terminate pregnancy; it is rated AHPA Botanical Safety Handbook class 2b (not verified against AHPA) (not to be used during pregnancy). The classical Chinese materia medica likewise lists it as contraindicated in pregnancy. This applies to the medicinal florets; culinary safflower seed oil, a distinct food product, is a separate matter and is not implicated. Avoid Hong Hua in all therapeutic forms throughout pregnancy. Sources: AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (not verified against AHPA); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed); Brinker, Herbal Contraindications and Drug Interactions.') then
      raise notice 'H260.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H260.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H260.secondary_sources: label 1 class mention(s) as not verified; label the second class code "and 2d" in the same claim
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004): Hong Hua (Flos Carthami), taste acrid, nature warm, Heart and Liver channels, functions, dosage, and pregnancy and bleeding contraindications. Chen & Chen, Chinese Medical Herbology and Pharmacology (2004): pharmacology and antiplatelet, anticoagulant, and cardiovascular actions. Modern safety framework: AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (not verified against AHPA) (pregnancy) and 2d (not verified against AHPA) (hemorrhagic disease and peptic ulcer); Brinker, Herbal Contraindications and Drug Interactions (2010); Mills & Bone, Principles and Practice of Phytotherapy (2013). Pharmacology of hydroxysafflor yellow A and safflower antiplatelet, antithrombotic, and cardiocerebral activity in the peer-reviewed literature (for example reviews of Carthamus tinctorius honghua chemistry and pharmacology, and the Frontiers in Pharmacology 2021 review of Chinese-medicine and warfarin interactions).',
         last_updated = now()
   where herb_id = 'H260'
     and secondary_sources = 'Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004): Hong Hua (Flos Carthami), taste acrid, nature warm, Heart and Liver channels, functions, dosage, and pregnancy and bleeding contraindications. Chen & Chen, Chinese Medical Herbology and Pharmacology (2004): pharmacology and antiplatelet, anticoagulant, and cardiovascular actions. Modern safety framework: AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (pregnancy) and 2d (hemorrhagic disease and peptic ulcer); Brinker, Herbal Contraindications and Drug Interactions (2010); Mills & Bone, Principles and Practice of Phytotherapy (2013). Pharmacology of hydroxysafflor yellow A and safflower antiplatelet, antithrombotic, and cardiocerebral activity in the peer-reviewed literature (for example reviews of Carthamus tinctorius honghua chemistry and pharmacology, and the Frontiers in Pharmacology 2021 review of Chinese-medicine and warfarin interactions).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H260' and secondary_sources = 'Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004): Hong Hua (Flos Carthami), taste acrid, nature warm, Heart and Liver channels, functions, dosage, and pregnancy and bleeding contraindications. Chen & Chen, Chinese Medical Herbology and Pharmacology (2004): pharmacology and antiplatelet, anticoagulant, and cardiovascular actions. Modern safety framework: AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (not verified against AHPA) (pregnancy) and 2d (not verified against AHPA) (hemorrhagic disease and peptic ulcer); Brinker, Herbal Contraindications and Drug Interactions (2010); Mills & Bone, Principles and Practice of Phytotherapy (2013). Pharmacology of hydroxysafflor yellow A and safflower antiplatelet, antithrombotic, and cardiocerebral activity in the peer-reviewed literature (for example reviews of Carthamus tinctorius honghua chemistry and pharmacology, and the Frontiers in Pharmacology 2021 review of Chinese-medicine and warfarin interactions).') then
      raise notice 'H260.secondary_sources already corrected, skipped';
    else
      raise exception 'H260.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H260.contraindications_general: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'Pregnancy, absolutely, given its uterus-stimulating, blood-moving, emmenagogue and abortifacient-in-large-dose action (AHPA 2b (not verified against AHPA)). Active or threatened bleeding, hemorrhagic disease, peptic ulcer, heavy menstrual bleeding, and the perioperative period, given its antiplatelet and blood-quickening effect (AHPA 2d (not verified against AHPA)); discontinue well before elective surgery. Concurrent anticoagulant or antiplatelet drug therapy except under professional supervision with monitoring (see drug interactions). Blood deficiency without stasis, and states of frank debility or depletion, in which a blood-mover is depleting rather than corrective. Known hypersensitivity to Carthamus or to Asteraceae-family plants. Undiagnosed pelvic or abdominal masses, unexplained abnormal uterine bleeding, and cardiac chest pain call for medical evaluation rather than self-treatment (see refer threshold).',
         last_updated = now()
   where herb_id = 'H260'
     and contraindications_general = 'Pregnancy, absolutely, given its uterus-stimulating, blood-moving, emmenagogue and abortifacient-in-large-dose action (AHPA 2b). Active or threatened bleeding, hemorrhagic disease, peptic ulcer, heavy menstrual bleeding, and the perioperative period, given its antiplatelet and blood-quickening effect (AHPA 2d); discontinue well before elective surgery. Concurrent anticoagulant or antiplatelet drug therapy except under professional supervision with monitoring (see drug interactions). Blood deficiency without stasis, and states of frank debility or depletion, in which a blood-mover is depleting rather than corrective. Known hypersensitivity to Carthamus or to Asteraceae-family plants. Undiagnosed pelvic or abdominal masses, unexplained abnormal uterine bleeding, and cardiac chest pain call for medical evaluation rather than self-treatment (see refer threshold).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H260' and contraindications_general = 'Pregnancy, absolutely, given its uterus-stimulating, blood-moving, emmenagogue and abortifacient-in-large-dose action (AHPA 2b (not verified against AHPA)). Active or threatened bleeding, hemorrhagic disease, peptic ulcer, heavy menstrual bleeding, and the perioperative period, given its antiplatelet and blood-quickening effect (AHPA 2d (not verified against AHPA)); discontinue well before elective surgery. Concurrent anticoagulant or antiplatelet drug therapy except under professional supervision with monitoring (see drug interactions). Blood deficiency without stasis, and states of frank debility or depletion, in which a blood-mover is depleting rather than corrective. Known hypersensitivity to Carthamus or to Asteraceae-family plants. Undiagnosed pelvic or abdominal masses, unexplained abnormal uterine bleeding, and cardiac chest pain call for medical evaluation rather than self-treatment (see refer threshold).') then
      raise notice 'H260.contraindications_general already corrected, skipped';
    else
      raise exception 'H260.contraindications_general: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1274.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (not verified against AHPA); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004); Brinker, Herbal Contraindications and Drug Interactions (2010).'
   where contraindication_id = 'CI1274'
     and source_citation = 'AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b; Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004); Brinker, Herbal Contraindications and Drug Interactions (2010).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1274' and source_citation = 'AHPA Botanical Safety Handbook (2nd ed, 2013), class 2b (not verified against AHPA); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004); Brinker, Herbal Contraindications and Drug Interactions (2010).') then
      raise notice 'CI1274.source_citation already corrected, skipped';
    else
      raise exception 'CI1274.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1276.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook (2nd ed, 2013), class 2d (not verified against AHPA); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004).'
   where contraindication_id = 'CI1276'
     and source_citation = 'AHPA Botanical Safety Handbook (2nd ed, 2013), class 2d; Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1276' and source_citation = 'AHPA Botanical Safety Handbook (2nd ed, 2013), class 2d (not verified against AHPA); Bensky, Clavey & Stoger, Chinese Herbal Medicine: Materia Medica (3rd ed, 2004).') then
      raise notice 'CI1276.source_citation already corrected, skipped';
    else
      raise exception 'CI1276.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H265.drug_interactions: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'No well-documented clinically significant interactions (limited data; AHPA-style Interaction Class A (not verified against AHPA) expected for a culinary aromatic). Theoretical only: mild antiplatelet potential of the volatile oil, so a possible additive effect with anticoagulant or antiplatelet drugs at high therapeutic doses; clinical relevance unproven. Culinary and standard decoction use is unproblematic. (Mills & Bone, Principles and Practice of Phytotherapy; Natural Medicines / Drugs.com NPP.)',
         last_updated = now()
   where herb_id = 'H265'
     and drug_interactions = 'No well-documented clinically significant interactions (limited data; AHPA-style Interaction Class A expected for a culinary aromatic). Theoretical only: mild antiplatelet potential of the volatile oil, so a possible additive effect with anticoagulant or antiplatelet drugs at high therapeutic doses; clinical relevance unproven. Culinary and standard decoction use is unproblematic. (Mills & Bone, Principles and Practice of Phytotherapy; Natural Medicines / Drugs.com NPP.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H265' and drug_interactions = 'No well-documented clinically significant interactions (limited data; AHPA-style Interaction Class A (not verified against AHPA) expected for a culinary aromatic). Theoretical only: mild antiplatelet potential of the volatile oil, so a possible additive effect with anticoagulant or antiplatelet drugs at high therapeutic doses; clinical relevance unproven. Culinary and standard decoction use is unproblematic. (Mills & Bone, Principles and Practice of Phytotherapy; Natural Medicines / Drugs.com NPP.)') then
      raise notice 'H265.drug_interactions already corrected, skipped';
    else
      raise exception 'H265.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H271.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. Contraindicated in pregnancy (AHPA Botanical Safety Handbook class 2b (not verified against AHPA)). Traditionally a blood-invigorating, menstrual-moving herb that may stimulate uterine activity; controlled human safety data are lacking.',
         last_updated = now()
   where herb_id = 'H271'
     and pregnancy_safety = 'Avoid. Contraindicated in pregnancy (AHPA Botanical Safety Handbook class 2b). Traditionally a blood-invigorating, menstrual-moving herb that may stimulate uterine activity; controlled human safety data are lacking.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H271' and pregnancy_safety = 'Avoid. Contraindicated in pregnancy (AHPA Botanical Safety Handbook class 2b (not verified against AHPA)). Traditionally a blood-invigorating, menstrual-moving herb that may stimulate uterine activity; controlled human safety data are lacking.') then
      raise notice 'H271.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H271.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H271.breastfeeding_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'Avoid. Insufficient human lactation data; AHPA precautionary class 2c (not verified against AHPA). Potent isoquinoline alkaloids, including tetrahydropalmatine, may transfer into milk, and effects on a nursing infant have not been studied.',
         last_updated = now()
   where herb_id = 'H271'
     and breastfeeding_safety = 'Avoid. Insufficient human lactation data; AHPA precautionary class 2c. Potent isoquinoline alkaloids, including tetrahydropalmatine, may transfer into milk, and effects on a nursing infant have not been studied.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H271' and breastfeeding_safety = 'Avoid. Insufficient human lactation data; AHPA precautionary class 2c (not verified against AHPA). Potent isoquinoline alkaloids, including tetrahydropalmatine, may transfer into milk, and effects on a nursing infant have not been studied.') then
      raise notice 'H271.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H271.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1340.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2b (not verified against AHPA); traditional TCM contraindication (Bensky et al., 2004).'
   where contraindication_id = 'CI1340'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2b; traditional TCM contraindication (Bensky et al., 2004).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1340' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2b (not verified against AHPA); traditional TCM contraindication (Bensky et al., 2004).') then
      raise notice 'CI1340.source_citation already corrected, skipped';
    else
      raise exception 'CI1340.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1341.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2c (not verified against AHPA).'
   where contraindication_id = 'CI1341'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2c.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1341' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2c (not verified against AHPA).') then
      raise notice 'CI1341.source_citation already corrected, skipped';
    else
      raise exception 'CI1341.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H274.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'No pregnancy-specific human safety studies located. Gastrodia carries an overall AHPA Botanical Safety Handbook Class 1 (not verified against AHPA) rating (safe when used appropriately) and classical Chinese sources do not list it as an emmenagogue or abortifacient, but pregnancy-specific controlled data are absent. Use in pregnancy only under a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; data otherwise limited.)',
         last_updated = now()
   where herb_id = 'H274'
     and pregnancy_safety = 'No pregnancy-specific human safety studies located. Gastrodia carries an overall AHPA Botanical Safety Handbook Class 1 rating (safe when used appropriately) and classical Chinese sources do not list it as an emmenagogue or abortifacient, but pregnancy-specific controlled data are absent. Use in pregnancy only under a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; data otherwise limited.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H274' and pregnancy_safety = 'No pregnancy-specific human safety studies located. Gastrodia carries an overall AHPA Botanical Safety Handbook Class 1 (not verified against AHPA) rating (safe when used appropriately) and classical Chinese sources do not list it as an emmenagogue or abortifacient, but pregnancy-specific controlled data are absent. Use in pregnancy only under a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; data otherwise limited.)') then
      raise notice 'H274.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H274.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H274.drug_interactions: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set drug_interactions = 'No well-documented clinical interactions are established, and several references state none are known (AHPA Class 1 (not verified against AHPA)). The following are theoretical, from pharmacology and limited data: (1) Sedatives and CNS depressants (benzodiazepines, barbiturates, alcohol) may show additive sedation, as gastrodin has sedative-hypnotic and GABA-enhancing activity; (2) Antihypertensives may show additive hypotension, as Gastrodia lowers blood pressure through vasodilation; (3) Anticoagulants and antiplatelet drugs (warfarin, aspirin, clopidogrel) carry a theoretical additive bleeding risk, as extracts inhibit platelet aggregation and are antithrombotic; (4) Anticonvulsants, additive and uncertain. Monitor accordingly. (Gastrodin CNS reviews, Frontiers in Pharmacology 2018; Kim et al., Medicina 2021, platelet aggregation; Brinker; Mills & Bone.)',
         last_updated = now()
   where herb_id = 'H274'
     and drug_interactions = 'No well-documented clinical interactions are established, and several references state none are known (AHPA Class 1). The following are theoretical, from pharmacology and limited data: (1) Sedatives and CNS depressants (benzodiazepines, barbiturates, alcohol) may show additive sedation, as gastrodin has sedative-hypnotic and GABA-enhancing activity; (2) Antihypertensives may show additive hypotension, as Gastrodia lowers blood pressure through vasodilation; (3) Anticoagulants and antiplatelet drugs (warfarin, aspirin, clopidogrel) carry a theoretical additive bleeding risk, as extracts inhibit platelet aggregation and are antithrombotic; (4) Anticonvulsants, additive and uncertain. Monitor accordingly. (Gastrodin CNS reviews, Frontiers in Pharmacology 2018; Kim et al., Medicina 2021, platelet aggregation; Brinker; Mills & Bone.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H274' and drug_interactions = 'No well-documented clinical interactions are established, and several references state none are known (AHPA Class 1 (not verified against AHPA)). The following are theoretical, from pharmacology and limited data: (1) Sedatives and CNS depressants (benzodiazepines, barbiturates, alcohol) may show additive sedation, as gastrodin has sedative-hypnotic and GABA-enhancing activity; (2) Antihypertensives may show additive hypotension, as Gastrodia lowers blood pressure through vasodilation; (3) Anticoagulants and antiplatelet drugs (warfarin, aspirin, clopidogrel) carry a theoretical additive bleeding risk, as extracts inhibit platelet aggregation and are antithrombotic; (4) Anticonvulsants, additive and uncertain. Monitor accordingly. (Gastrodin CNS reviews, Frontiers in Pharmacology 2018; Kim et al., Medicina 2021, platelet aggregation; Brinker; Mills & Bone.)') then
      raise notice 'H274.drug_interactions already corrected, skipped';
    else
      raise exception 'H274.drug_interactions: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H274.breastfeeding_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set breastfeeding_safety = 'No lactation-specific data located. Overall AHPA Class 1 (not verified against AHPA), but excretion in breast milk and effects on the nursing infant are unstudied. Avoid during lactation unless directed by a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; Mills & Bone.)',
         last_updated = now()
   where herb_id = 'H274'
     and breastfeeding_safety = 'No lactation-specific data located. Overall AHPA Class 1, but excretion in breast milk and effects on the nursing infant are unstudied. Avoid during lactation unless directed by a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; Mills & Bone.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H274' and breastfeeding_safety = 'No lactation-specific data located. Overall AHPA Class 1 (not verified against AHPA), but excretion in breast milk and effects on the nursing infant are unstudied. Avoid during lactation unless directed by a qualified practitioner. (AHPA Botanical Safety Handbook, 2nd ed.; Mills & Bone.)') then
      raise notice 'H274.breastfeeding_safety already corrected, skipped';
    else
      raise exception 'H274.breastfeeding_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1361.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'No pregnancy-specific human safety data. Overall AHPA Class 1 (not verified against AHPA) and not classically an emmenagogue/abortifacient, but controlled data are absent.'
   where contraindication_id = 'CI1361'
     and mechanism_rationale = 'No pregnancy-specific human safety data. Overall AHPA Class 1 and not classically an emmenagogue/abortifacient, but controlled data are absent.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1361' and mechanism_rationale = 'No pregnancy-specific human safety data. Overall AHPA Class 1 (not verified against AHPA) and not classically an emmenagogue/abortifacient, but controlled data are absent.') then
      raise notice 'CI1361.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI1361.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H278.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook assigns Magnolia officinalis bark safety class 2b (not verified against AHPA) (not to be used during pregnancy). Classical Chinese sources likewise counsel caution or outright prohibition, on the basis of its strong qi-moving and downward-directing action. (AHPA Botanical Safety Handbook 2nd ed., 2013; Bensky et al., Chinese Herbal Medicine: Materia Medica.)',
         last_updated = now()
   where herb_id = 'H278'
     and pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook assigns Magnolia officinalis bark safety class 2b (not to be used during pregnancy). Classical Chinese sources likewise counsel caution or outright prohibition, on the basis of its strong qi-moving and downward-directing action. (AHPA Botanical Safety Handbook 2nd ed., 2013; Bensky et al., Chinese Herbal Medicine: Materia Medica.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H278' and pregnancy_safety = 'Avoid. The AHPA Botanical Safety Handbook assigns Magnolia officinalis bark safety class 2b (not verified against AHPA) (not to be used during pregnancy). Classical Chinese sources likewise counsel caution or outright prohibition, on the basis of its strong qi-moving and downward-directing action. (AHPA Botanical Safety Handbook 2nd ed., 2013; Bensky et al., Chinese Herbal Medicine: Materia Medica.)') then
      raise notice 'H278.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H278.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H278.secondary_sources: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b (not verified against AHPA)); Memorial Sloan Kettering Cancer Center, Integrative Medicine, Magnolia officinalis (herb-drug interactions); ''Two antiplatelet agents from Magnolia officinalis'' (Thrombosis Research, 1988; PMID 3413728); magnolol and honokiol as positive allosteric modulators of GABA-A receptors (Neuropharmacology, 2012); The Red List of Magnoliaceae (IUCN/BGCI, 2007).',
         last_updated = now()
   where herb_id = 'H278'
     and secondary_sources = 'Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b); Memorial Sloan Kettering Cancer Center, Integrative Medicine, Magnolia officinalis (herb-drug interactions); ''Two antiplatelet agents from Magnolia officinalis'' (Thrombosis Research, 1988; PMID 3413728); magnolol and honokiol as positive allosteric modulators of GABA-A receptors (Neuropharmacology, 2012); The Red List of Magnoliaceae (IUCN/BGCI, 2007).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H278' and secondary_sources = 'Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b (not verified against AHPA)); Memorial Sloan Kettering Cancer Center, Integrative Medicine, Magnolia officinalis (herb-drug interactions); ''Two antiplatelet agents from Magnolia officinalis'' (Thrombosis Research, 1988; PMID 3413728); magnolol and honokiol as positive allosteric modulators of GABA-A receptors (Neuropharmacology, 2012); The Red List of Magnoliaceae (IUCN/BGCI, 2007).') then
      raise notice 'H278.secondary_sources already corrected, skipped';
    else
      raise exception 'H278.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H278.secondary_citation: label 2 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/", "kind": "pubmed", "year": "2013", "title": "Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b (not verified against AHPA)); Memorial Sloan Kettering Cancer Center", "author": "AHPA Botanical Safety Handbook", "locator": "Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b (not verified against AHPA)); Memorial Sloan Kettering Cancer Center", "source_id": "S14"}'::jsonb,
         last_updated = now()
   where herb_id = 'H278'
     and secondary_citation = '{"url": "https://www.ahpa.org/", "kind": "pubmed", "year": "2013", "title": "Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b); Memorial Sloan Kettering Cancer Center", "author": "AHPA Botanical Safety Handbook", "locator": "Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b); Memorial Sloan Kettering Cancer Center", "source_id": "S14"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H278' and secondary_citation = '{"url": "https://www.ahpa.org/", "kind": "pubmed", "year": "2013", "title": "Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b (not verified against AHPA)); Memorial Sloan Kettering Cancer Center", "author": "AHPA Botanical Safety Handbook", "locator": "Bensky D, Clavey S, Stoger E. Chinese Herbal Medicine: Materia Medica, 3rd ed. (2004): Hou Po; AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin 2013): Magnolia officinalis (safety class 2b (not verified against AHPA)); Memorial Sloan Kettering Cancer Center", "source_id": "S14"}'::jsonb) then
      raise notice 'H278.secondary_citation already corrected, skipped';
    else
      raise exception 'H278.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H278.contraindications_general: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'Pregnancy (AHPA safety class 2b (not verified against AHPA)). Qi- and Yin-deficiency or frank dryness patterns lacking a damp or stagnant excess. Do not combine with strong sedatives, anticoagulants, or CYP450-sensitive drugs without practitioner supervision.',
         last_updated = now()
   where herb_id = 'H278'
     and contraindications_general = 'Pregnancy (AHPA safety class 2b). Qi- and Yin-deficiency or frank dryness patterns lacking a damp or stagnant excess. Do not combine with strong sedatives, anticoagulants, or CYP450-sensitive drugs without practitioner supervision.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H278' and contraindications_general = 'Pregnancy (AHPA safety class 2b (not verified against AHPA)). Qi- and Yin-deficiency or frank dryness patterns lacking a damp or stagnant excess. Do not combine with strong sedatives, anticoagulants, or CYP450-sensitive drugs without practitioner supervision.') then
      raise notice 'H278.contraindications_general already corrected, skipped';
    else
      raise exception 'H278.contraindications_general: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1386.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2b (not verified against AHPA); Bensky et al., Chinese Herbal Medicine: Materia Medica'
   where contraindication_id = 'CI1386'
     and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2b; Bensky et al., Chinese Herbal Medicine: Materia Medica';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1386' and source_citation = 'AHPA Botanical Safety Handbook, 2nd ed. (2013), class 2b (not verified against AHPA); Bensky et al., Chinese Herbal Medicine: Materia Medica') then
      raise notice 'CI1386.source_citation already corrected, skipped';
    else
      raise exception 'CI1386.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1386.mechanism_rationale: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Strong qi-moving and downward-directing action; AHPA safety class 2b (not verified against AHPA) (not to be used during pregnancy). Traditional Chinese sources counsel caution or prohibition.'
   where contraindication_id = 'CI1386'
     and mechanism_rationale = 'Strong qi-moving and downward-directing action; AHPA safety class 2b (not to be used during pregnancy). Traditional Chinese sources counsel caution or prohibition.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1386' and mechanism_rationale = 'Strong qi-moving and downward-directing action; AHPA safety class 2b (not verified against AHPA) (not to be used during pregnancy). Traditional Chinese sources counsel caution or prohibition.') then
      raise notice 'CI1386.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI1386.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H299.pregnancy_safety: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Contraindicated. Aloe latex is an anthranoid stimulant laxative and traditional emmenagogue; oral use can provoke reflex uterine stimulation and pelvic congestion and is judged possibly unsafe in pregnancy. Do not use. (NCCIH ''Aloe Vera''; AHPA Botanical Safety Handbook 2nd ed., leaf-latex class 2b (not verified against AHPA); King''s 1898, which forbids it in pregnancy.)',
         last_updated = now()
   where herb_id = 'H299'
     and pregnancy_safety = 'Contraindicated. Aloe latex is an anthranoid stimulant laxative and traditional emmenagogue; oral use can provoke reflex uterine stimulation and pelvic congestion and is judged possibly unsafe in pregnancy. Do not use. (NCCIH ''Aloe Vera''; AHPA Botanical Safety Handbook 2nd ed., leaf-latex class 2b; King''s 1898, which forbids it in pregnancy.)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H299' and pregnancy_safety = 'Contraindicated. Aloe latex is an anthranoid stimulant laxative and traditional emmenagogue; oral use can provoke reflex uterine stimulation and pelvic congestion and is judged possibly unsafe in pregnancy. Do not use. (NCCIH ''Aloe Vera''; AHPA Botanical Safety Handbook 2nd ed., leaf-latex class 2b (not verified against AHPA); King''s 1898, which forbids it in pregnancy.)') then
      raise notice 'H299.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H299.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1521.source_citation: label 1 class mention(s) as not verified
do $do$
declare n int;
begin
  update public.contraindications
     set source_citation = 'NCCIH ''Aloe Vera''; AHPA Botanical Safety Handbook 2nd ed. (2013), leaf-latex class 2b (not verified against AHPA); King''s American Dispensatory (1898)'
   where contraindication_id = 'CI1521'
     and source_citation = 'NCCIH ''Aloe Vera''; AHPA Botanical Safety Handbook 2nd ed. (2013), leaf-latex class 2b; King''s American Dispensatory (1898)';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1521' and source_citation = 'NCCIH ''Aloe Vera''; AHPA Botanical Safety Handbook 2nd ed. (2013), leaf-latex class 2b (not verified against AHPA); King''s American Dispensatory (1898)') then
      raise notice 'CI1521.source_citation already corrected, skipped';
    else
      raise exception 'CI1521.source_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI704.mechanism_rationale: label "historically 2B" (H177 forsythia; not caught by the check regex)
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Traditional emmenagogue and uterine-stimulant reputation; AHPA assigns Forsythia fruit a pregnancy-restriction class (historically 2B (not verified against AHPA), not for use in pregnancy), and modern human safety data are lacking.'
   where contraindication_id = 'CI704'
     and mechanism_rationale = 'Traditional emmenagogue and uterine-stimulant reputation; AHPA assigns Forsythia fruit a pregnancy-restriction class (historically 2B, not for use in pregnancy), and modern human safety data are lacking.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI704' and mechanism_rationale = 'Traditional emmenagogue and uterine-stimulant reputation; AHPA assigns Forsythia fruit a pregnancy-restriction class (historically 2B (not verified against AHPA), not for use in pregnancy), and modern human safety data are lacking.') then
      raise notice 'CI704.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI704.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H183.pregnancy_safety: class confirmed: attribute Class 2d to the December 2022 AHPA online update
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Avoid. Classical Chinese practice forbade Ban Xia in pregnancy, and animal data raise concern: Pinellia disturbed the metabolomic profiles of the placenta and amniotic fluid in pregnant rats, and Chinese herbal extracts including Pinellia have shown embryotoxicity in the embryonic stem cell test. The online AHPA Botanical Safety Handbook, 2nd ed. assigns Pinellia ternata Safety Class 2d (specific-use restrictions), amended from Class 3 in AHPA''s December 2022 online update (AHPA, "AHPA updates 14 entries to the online Botanical Safety Handbook, 2nd ed. in final 2022 release", https://www.ahpa.org/blog_home.asp?display=163), and the warm, drying rhizome carries a theoretical uterine and fluid-drying concern. In classical practice a small, expert-supervised dose of ginger-processed Ban Xia (Jiang Ban Xia) appears in morning-sickness formulas, but human safety data are contradictory, so the default for self-use is avoidance. Source: AHPA online Botanical Safety Handbook, 2nd ed. (December 2022 online update); pregnant-rat placenta and amniotic-fluid metabolomic study (PubMed 26923539); WebMD/RxList Pinellia ternata.',
         last_updated = now()
   where herb_id = 'H183'
     and pregnancy_safety = 'Avoid. Classical Chinese practice forbade Ban Xia in pregnancy, and animal data raise concern: Pinellia disturbed the metabolomic profiles of the placenta and amniotic fluid in pregnant rats, and Chinese herbal extracts including Pinellia have shown embryotoxicity in the embryonic stem cell test. The AHPA Botanical Safety Handbook, 2nd ed. assigns Pinellia ternata Safety Class 2d (recently amended from Class 3; specific-use restrictions), and the warm, drying rhizome carries a theoretical uterine and fluid-drying concern. In classical practice a small, expert-supervised dose of ginger-processed Ban Xia (Jiang Ban Xia) appears in morning-sickness formulas, but human safety data are contradictory, so the default for self-use is avoidance. Source: AHPA Botanical Safety Handbook, 2nd ed.; pregnant-rat placenta and amniotic-fluid metabolomic study (PubMed 26923539); WebMD/RxList Pinellia ternata.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H183' and pregnancy_safety = 'Avoid. Classical Chinese practice forbade Ban Xia in pregnancy, and animal data raise concern: Pinellia disturbed the metabolomic profiles of the placenta and amniotic fluid in pregnant rats, and Chinese herbal extracts including Pinellia have shown embryotoxicity in the embryonic stem cell test. The online AHPA Botanical Safety Handbook, 2nd ed. assigns Pinellia ternata Safety Class 2d (specific-use restrictions), amended from Class 3 in AHPA''s December 2022 online update (AHPA, "AHPA updates 14 entries to the online Botanical Safety Handbook, 2nd ed. in final 2022 release", https://www.ahpa.org/blog_home.asp?display=163), and the warm, drying rhizome carries a theoretical uterine and fluid-drying concern. In classical practice a small, expert-supervised dose of ginger-processed Ban Xia (Jiang Ban Xia) appears in morning-sickness formulas, but human safety data are contradictory, so the default for self-use is avoidance. Source: AHPA online Botanical Safety Handbook, 2nd ed. (December 2022 online update); pregnant-rat placenta and amniotic-fluid metabolomic study (PubMed 26923539); WebMD/RxList Pinellia ternata.') then
      raise notice 'H183.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H183.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI745.mechanism_rationale: class confirmed: attribute Class 2d to the December 2022 AHPA online update
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Embryotoxicity in animal studies and disturbed placental and amniotic-fluid metabolomic profiles in pregnant rats, with a theoretical uterine and fluid-drying concern; AHPA online Botanical Safety Handbook Safety Class 2d (amended from Class 3 in AHPA''s December 2022 online update, "AHPA updates 14 entries to the online Botanical Safety Handbook, 2nd ed. in final 2022 release", https://www.ahpa.org/blog_home.asp?display=163).'
   where contraindication_id = 'CI745'
     and mechanism_rationale = 'Embryotoxicity in animal studies and disturbed placental and amniotic-fluid metabolomic profiles in pregnant rats, with a theoretical uterine and fluid-drying concern; AHPA Botanical Safety Handbook Safety Class 2d (amended from Class 3).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI745' and mechanism_rationale = 'Embryotoxicity in animal studies and disturbed placental and amniotic-fluid metabolomic profiles in pregnant rats, with a theoretical uterine and fluid-drying concern; AHPA online Botanical Safety Handbook Safety Class 2d (amended from Class 3 in AHPA''s December 2022 online update, "AHPA updates 14 entries to the online Botanical Safety Handbook, 2nd ed. in final 2022 release", https://www.ahpa.org/blog_home.asp?display=163).') then
      raise notice 'CI745.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI745.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H279.pregnancy_safety: class confirmed: attribute Class 1 to the April 2022 AHPA online update
do $do$
declare n int;
begin
  update public.herbs
     set pregnancy_safety = 'Culinary and food amounts are considered safe (basil is GRAS as a food; the online AHPA Botanical Safety Handbook classes the herb as safety Class 1, changed from Class 2d in AHPA''s April 2022 online update: "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55). Avoid concentrated medicinal doses and the essential oil during pregnancy: basil oil is frequently high in estragole (methylchavicol), a genotoxic rodent carcinogen, and reproductive-toxicity, uterine-stimulant, emmenagogue, and abortifacient effects have been reported for the essential oil; Tisserand and Young advise avoiding basil oil (estragole chemotype) throughout pregnancy. Keep to food and normal tea amounts. Sources: Tisserand & Young, Essential Oil Safety (2nd ed., 2014); AHPA online Botanical Safety Handbook (2nd ed., April 2022 online update); Natural Medicines / Drugs.com (Sweet Basil).',
         last_updated = now()
   where herb_id = 'H279'
     and pregnancy_safety = 'Culinary and food amounts are considered safe (basil is GRAS as a food; the AHPA Botanical Safety Handbook classes the herb as safety Class 1). Avoid concentrated medicinal doses and the essential oil during pregnancy: basil oil is frequently high in estragole (methylchavicol), a genotoxic rodent carcinogen, and reproductive-toxicity, uterine-stimulant, emmenagogue, and abortifacient effects have been reported for the essential oil; Tisserand and Young advise avoiding basil oil (estragole chemotype) throughout pregnancy. Keep to food and normal tea amounts. Sources: Tisserand & Young, Essential Oil Safety (2nd ed., 2014); AHPA Botanical Safety Handbook (2nd ed., 2013); Natural Medicines / Drugs.com (Sweet Basil).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H279' and pregnancy_safety = 'Culinary and food amounts are considered safe (basil is GRAS as a food; the online AHPA Botanical Safety Handbook classes the herb as safety Class 1, changed from Class 2d in AHPA''s April 2022 online update: "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55). Avoid concentrated medicinal doses and the essential oil during pregnancy: basil oil is frequently high in estragole (methylchavicol), a genotoxic rodent carcinogen, and reproductive-toxicity, uterine-stimulant, emmenagogue, and abortifacient effects have been reported for the essential oil; Tisserand and Young advise avoiding basil oil (estragole chemotype) throughout pregnancy. Keep to food and normal tea amounts. Sources: Tisserand & Young, Essential Oil Safety (2nd ed., 2014); AHPA online Botanical Safety Handbook (2nd ed., April 2022 online update); Natural Medicines / Drugs.com (Sweet Basil).') then
      raise notice 'H279.pregnancy_safety already corrected, skipped';
    else
      raise exception 'H279.pregnancy_safety: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H279.secondary_sources: class confirmed: attribute Class 1 to the April 2022 AHPA online update
do $do$
declare n int;
begin
  update public.herbs
     set secondary_sources = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013), online edition (Ocimum basilicum reclassified from Class 2d to safety Class 1 in AHPA''s April 2022 online update, "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bone, Principles and Practice of Phytotherapy; Ocimum basilicum review (PMC10748370, 2023); in vitro CYP2B6/CYP3A4 interaction study (PMC7204527, 2020).',
         last_updated = now()
   where herb_id = 'H279'
     and secondary_sources = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013; Ocimum basilicum reclassified to safety Class 1); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bone, Principles and Practice of Phytotherapy; Ocimum basilicum review (PMC10748370, 2023); in vitro CYP2B6/CYP3A4 interaction study (PMC7204527, 2020).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H279' and secondary_sources = 'AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013), online edition (Ocimum basilicum reclassified from Class 2d to safety Class 1 in AHPA''s April 2022 online update, "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bone, Principles and Practice of Phytotherapy; Ocimum basilicum review (PMC10748370, 2023); in vitro CYP2B6/CYP3A4 interaction study (PMC7204527, 2020).') then
      raise notice 'H279.secondary_sources already corrected, skipped';
    else
      raise exception 'H279.secondary_sources: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H279.secondary_citation: class confirmed: attribute Class 1 to the April 2022 AHPA online update (title and locator)
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://www.ahpa.org/", "year": "2013", "title": "AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013), online edition (Ocimum basilicum reclassified from Class 2d to safety Class 1 in AHPA''s April 2022 online update, \"AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release\", https://www.ahpa.org/blog_home.asp?display=55); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bon", "author": "AHPA Botanical Safety Handbook", "locator": "AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013), online edition (Ocimum basilicum reclassified from Class 2d to safety Class 1 in AHPA''s April 2022 online update, \"AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release\", https://www.ahpa.org/blog_home.asp?display=55); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bon", "source_id": "S14"}'::jsonb,
         last_updated = now()
   where herb_id = 'H279'
     and secondary_citation = '{"url": "https://www.ahpa.org/", "year": "2013", "title": "AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013; Ocimum basilicum reclassified to safety Class 1); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bon", "author": "AHPA Botanical Safety Handbook", "locator": "AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013; Ocimum basilicum reclassified to safety Class 1); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bon", "source_id": "S14"}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H279' and secondary_citation = '{"url": "https://www.ahpa.org/", "year": "2013", "title": "AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013), online edition (Ocimum basilicum reclassified from Class 2d to safety Class 1 in AHPA''s April 2022 online update, \"AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release\", https://www.ahpa.org/blog_home.asp?display=55); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bon", "author": "AHPA Botanical Safety Handbook", "locator": "AHPA Botanical Safety Handbook, 2nd ed. (Gardner & McGuffin, 2013), online edition (Ocimum basilicum reclassified from Class 2d to safety Class 1 in AHPA''s April 2022 online update, \"AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release\", https://www.ahpa.org/blog_home.asp?display=55); Tisserand & Young, Essential Oil Safety, 2nd ed. (2014); Natural Medicines / Drugs.com (Sweet Basil monograph); Mills & Bon", "source_id": "S14"}'::jsonb) then
      raise notice 'H279.secondary_citation already corrected, skipped';
    else
      raise exception 'H279.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H279.contraindications_general: class confirmed: attribute Class 1 to the April 2022 AHPA online update
do $do$
declare n int;
begin
  update public.herbs
     set contraindications_general = 'No absolute contraindications at culinary and normal tea amounts (AHPA safety Class 1, per AHPA''s April 2022 online update: "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55). Avoid concentrated medicinal doses and the internal essential oil in pregnancy and lactation (estragole; see safety fields). Caution with the estragole-rich exotic essential oil in anyone, and with internal essential-oil use generally.',
         last_updated = now()
   where herb_id = 'H279'
     and contraindications_general = 'No absolute contraindications at culinary and normal tea amounts (AHPA safety Class 1). Avoid concentrated medicinal doses and the internal essential oil in pregnancy and lactation (estragole; see safety fields). Caution with the estragole-rich exotic essential oil in anyone, and with internal essential-oil use generally.';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H279' and contraindications_general = 'No absolute contraindications at culinary and normal tea amounts (AHPA safety Class 1, per AHPA''s April 2022 online update: "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55). Avoid concentrated medicinal doses and the internal essential oil in pregnancy and lactation (estragole; see safety fields). Caution with the estragole-rich exotic essential oil in anyone, and with internal essential-oil use generally.') then
      raise notice 'H279.contraindications_general already corrected, skipped';
    else
      raise exception 'H279.contraindications_general: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- CI1394.mechanism_rationale: class confirmed: attribute Class 1 to the April 2022 AHPA online update
do $do$
declare n int;
begin
  update public.contraindications
     set mechanism_rationale = 'Basil essential oil is frequently high in estragole (methylchavicol), a genotoxic rodent carcinogen; reproductive-toxicity, uterine-stimulant, emmenagogue, and abortifacient effects have been reported for the oil. Culinary and food amounts have a long record of safe use (GRAS; AHPA Class 1 in the online Botanical Safety Handbook, changed from Class 2d in AHPA''s April 2022 online update, "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55).'
   where contraindication_id = 'CI1394'
     and mechanism_rationale = 'Basil essential oil is frequently high in estragole (methylchavicol), a genotoxic rodent carcinogen; reproductive-toxicity, uterine-stimulant, emmenagogue, and abortifacient effects have been reported for the oil. Culinary and food amounts have a long record of safe use (GRAS; AHPA Class 1).';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.contraindications where contraindication_id = 'CI1394' and mechanism_rationale = 'Basil essential oil is frequently high in estragole (methylchavicol), a genotoxic rodent carcinogen; reproductive-toxicity, uterine-stimulant, emmenagogue, and abortifacient effects have been reported for the oil. Culinary and food amounts have a long record of safe use (GRAS; AHPA Class 1 in the online Botanical Safety Handbook, changed from Class 2d in AHPA''s April 2022 online update, "AHPA updates eight entries to the online Botanical Safety Handbook 2nd Ed. in first 2022 release", https://www.ahpa.org/blog_home.asp?display=55).') then
      raise notice 'CI1394.mechanism_rationale already corrected, skipped';
    else
      raise exception 'CI1394.mechanism_rationale: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- H030.secondary_citation: kava: Class 2d replaced by AHPA July 2024 classes
do $do$
declare n int;
begin
  update public.herbs
     set secondary_citation = '{"url": "https://apps.who.int/iris/handle/10665/42052", "kind": "who_monograph_ahpa", "year": 2007, "title": "WHO Monographs on Selected Medicinal Plants Vol. 6 / AHPA Botanical Safety Handbook 2nd ed.", "author": "World Health Organization / American Herbal Products Association", "locator": "AHPA Class 2b and 2c, Interaction Class B (AHPA, July 2024 update) (https://www.ahpa.org/blog_home.asp?display=279) — hepatotoxicity case literature (predominantly with acetone- and ethanol-extracted aerial-stem-peeling preparations of non-noble cultivars); use water-extracted root of certified noble cultivars; avoid with concurrent alcohol, acetaminophen, hepatotoxic medications, or pre-existing liver disease. Heavy long-term ceremonial use is associated with reversible kava dermopathy. Pregnancy / lactation / pediatric use: avoid. WHO Vol 6 (2007) reviews the hepatotoxicity literature in detail and concludes the risk profile is preparation-form-dependent."}'::jsonb,
         last_updated = now()
   where herb_id = 'H030'
     and secondary_citation = '{"url": "https://apps.who.int/iris/handle/10665/42052", "kind": "who_monograph_ahpa", "year": 2007, "title": "WHO Monographs on Selected Medicinal Plants Vol. 6 / AHPA Botanical Safety Handbook 2nd ed.", "author": "World Health Organization / American Herbal Products Association", "locator": "AHPA BSH 2nd ed. (2013) Class 2d — hepatotoxicity case literature (predominantly with acetone- and ethanol-extracted aerial-stem-peeling preparations of non-noble cultivars); use water-extracted root of certified noble cultivars; avoid with concurrent alcohol, acetaminophen, hepatotoxic medications, or pre-existing liver disease. Heavy long-term ceremonial use is associated with reversible kava dermopathy. Pregnancy / lactation / pediatric use: avoid. WHO Vol 6 (2007) reviews the hepatotoxicity literature in detail and concludes the risk profile is preparation-form-dependent."}'::jsonb;
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H030' and secondary_citation = '{"url": "https://apps.who.int/iris/handle/10665/42052", "kind": "who_monograph_ahpa", "year": 2007, "title": "WHO Monographs on Selected Medicinal Plants Vol. 6 / AHPA Botanical Safety Handbook 2nd ed.", "author": "World Health Organization / American Herbal Products Association", "locator": "AHPA Class 2b and 2c, Interaction Class B (AHPA, July 2024 update) (https://www.ahpa.org/blog_home.asp?display=279) — hepatotoxicity case literature (predominantly with acetone- and ethanol-extracted aerial-stem-peeling preparations of non-noble cultivars); use water-extracted root of certified noble cultivars; avoid with concurrent alcohol, acetaminophen, hepatotoxic medications, or pre-existing liver disease. Heavy long-term ceremonial use is associated with reversible kava dermopathy. Pregnancy / lactation / pediatric use: avoid. WHO Vol 6 (2007) reviews the hepatotoxicity literature in detail and concludes the risk profile is preparation-form-dependent."}'::jsonb) then
      raise notice 'H030.secondary_citation already corrected, skipped';
    else
      raise exception 'H030.secondary_citation: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- 4. H238 Shankhpushpi: hide
-- -----------------------------------------------------------------------------

-- H238.status: hide until species identity is resolved
do $do$
declare n int;
begin
  update public.herbs
     set status = 'Hidden - species identity under review 2026-09-15',
         last_updated = now()
   where herb_id = 'H238'
     and status = 'Approved';
  get diagnostics n = row_count;
  if n <> 1 then
    if exists (select 1 from public.herbs where herb_id = 'H238' and status = 'Hidden - species identity under review 2026-09-15') then
      raise notice 'H238.status already corrected, skipped';
    else
      raise exception 'H238.status: live value no longer matches the value read 2026-09-15; not updated';
    end if;
  end if;
end
$do$;

create or replace view public.herbs_directory_v as
select
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.pronunciation,
  h.image_filename,
  h.tier_visibility,
  h.status,
  false AS is_locked,
  h.taste,
  h.temperature,
  h.moisture,
  h.energetics_summary,
  h.stewardship_note,
  h.biblical_traditional_reference,
  h.cautions,
  h.contraindications_general,
  h.pregnancy_safety,
  h.breastfeeding_safety,
  h.children_safety,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tissue_states_indicated ELSE NULL::text END AS tissue_states_indicated,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tissue_states_contraindicated ELSE NULL::text END AS tissue_states_contraindicated,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.system_affinity ELSE NULL::text END AS system_affinity,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.chief_complaints ELSE NULL::text END AS chief_complaints,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.western_constitution_match ELSE NULL::text END AS western_constitution_match,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.ayurvedic_dosha_match ELSE NULL::text END AS ayurvedic_dosha_match,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.ayurvedic_dosha_aggravates ELSE NULL::text END AS ayurvedic_dosha_aggravates,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tcm_pattern_match ELSE NULL::text END AS tcm_pattern_match,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.tcm_contraindicated_patterns ELSE NULL::text END AS tcm_contraindicated_patterns,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.drug_interactions ELSE NULL::text END AS drug_interactions,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.preparation_methods ELSE NULL::text END AS preparation_methods,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.dosage_notes ELSE NULL::text END AS dosage_notes,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.refer_threshold ELSE NULL::text END AS refer_threshold,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.primary_sources ELSE NULL::text END AS primary_sources,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.secondary_sources ELSE NULL::text END AS secondary_sources,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.notes ELSE NULL::text END AS notes,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action_id', a.action_id, 'action_name', a.action_name, 'strength', ha.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_actions ha JOIN public.actions a ON a.action_id = ha.action_id
     WHERE ha.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS actions_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', hts.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_indicated hts JOIN public.tissue_states ts ON ts.state_id = hts.state_id
     WHERE hts.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tissue_states_indicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', htsc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_contraindicated htsc JOIN public.tissue_states ts ON ts.state_id = htsc.state_id
     WHERE htsc.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tissue_states_contraindicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('system_id', bs.system_id, 'system_name', bs.system_name, 'strength', hs.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_systems hs JOIN public.body_systems bs ON bs.system_id = hs.system_id
     WHERE hs.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS systems_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('complaint_id', cpl.complaint_id, 'complaint_name', cpl.complaint_name, 'strength', hc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_complaints hc JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
     WHERE hc.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS complaints_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('taste_id', t.taste_id, 'taste_name', t.taste_name)), '[]'::jsonb)
      FROM public.herbs_tastes ht JOIN public.tastes t ON t.taste_id = ht.taste_id
     WHERE ht.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tastes_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('constitution_id', c.constitution_id, 'name', c.name, 'relationship', hc2.relationship, 'strength', hc2.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_constitutions hc2 JOIN public.constitutions c ON c.constitution_id = hc2.constitution_id
     WHERE hc2.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS constitutions_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htci.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_indicated htci JOIN public.tcm_patterns p ON p.pattern_id = htci.pattern_id
     WHERE htci.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tcm_indicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htcc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_contraindicated htcc JOIN public.tcm_patterns p ON p.pattern_id = htcc.pattern_id
     WHERE htcc.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS tcm_contraindicated_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hdm.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_match hdm JOIN public.doshas d ON d.dosha_id = hdm.dosha_id
     WHERE hdm.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS doshas_match_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hda.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_aggravates hda JOIN public.doshas d ON d.dosha_id = hda.dosha_id
     WHERE hda.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS doshas_aggravates_rel,
  CASE WHEN public.current_user_at_least('seed'::text) THEN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('prep_id', pr.prep_id, 'preparation_name', pr.preparation_name, 'strength', hp.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_preparations hp JOIN public.preparations pr ON pr.prep_id = hp.prep_id
     WHERE hp.herb_id = h.herb_id
  ) ELSE NULL::jsonb END AS preparations_rel,
  COALESCE((
    SELECT array_agg(cpl.complaint_name ORDER BY cpl.complaint_name)
      FROM public.herbs_complaints hc JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
     WHERE hc.herb_id = h.herb_id
  ), ARRAY[]::text[]) AS complaint_names,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.primary_text_citation ELSE NULL::jsonb END AS primary_text_citation,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.secondary_citation ELSE NULL::jsonb END AS secondary_citation,
  CASE WHEN public.current_user_at_least('seed'::text) THEN h.traditional_observations ELSE NULL::jsonb END AS traditional_observations,
  CASE WHEN h.energetics_summary IS NULL THEN NULL::text
       ELSE "left"(split_part(h.energetics_summary, ';'::text, 1), 140)
  END AS energetics_teaser
from public.herbs h
where coalesce(h.status, ''::text) not like 'Hidden%'::text;

create or replace view public.herbs_public
with (security_invoker = false, security_barrier = true) as
select
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.taste,
  h.temperature,
  h.moisture,
  h.pronunciation,
  h.image_filename,
  h.energetics_summary,
  h.stewardship_note,
  h.cautions,
  h.contraindications_general,
  h.pregnancy_safety,
  h.breastfeeding_safety,
  h.children_safety,
  h.biblical_traditional_reference,
  h.status,
  h.tier_visibility
from public.herbs h
where (h.tier_visibility = 'free'::public.subscription_tier or h.tier_visibility is null)
  and coalesce(h.status, ''::text) not like 'Hidden%'::text;

create or replace view public.herbs_clinical_v
with (security_invoker = false, security_barrier = true) as
select
  h.herb_id,
  h.common_name,
  h.latin_name,
  h.plant_family,
  h.part_used,
  h.taste,
  h.temperature,
  h.moisture,
  h.tissue_states_indicated,
  h.tissue_states_contraindicated,
  h.system_affinity,
  h.chief_complaints,
  h.western_constitution_match,
  h.ayurvedic_dosha_match,
  h.ayurvedic_dosha_aggravates,
  h.tcm_pattern_match,
  h.tcm_contraindicated_patterns,
  h.cautions,
  h.contraindications_general,
  h.pregnancy_safety,
  h.breastfeeding_safety,
  h.children_safety,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.drug_interactions ELSE NULL::text END AS drug_interactions,
  h.preparation_methods,
  h.dosage_notes,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.primary_sources ELSE NULL::text END AS primary_sources,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.secondary_sources ELSE NULL::text END AS secondary_sources,
  h.tier_visibility,
  h.notes,
  h.biblical_traditional_reference,
  h.stewardship_note,
  h.energetics_summary,
  CASE WHEN public.current_user_at_least('root'::text) THEN h.refer_threshold ELSE NULL::text END AS refer_threshold,
  h.pronunciation,
  h.image_filename,
  h.status,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action_id', a.action_id, 'action_name', a.action_name, 'strength', ha.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_actions ha JOIN public.actions a ON a.action_id = ha.action_id
     WHERE ha.herb_id = h.herb_id
  ) AS actions,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', hts.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_indicated hts JOIN public.tissue_states ts ON ts.state_id = hts.state_id
     WHERE hts.herb_id = h.herb_id
  ) AS tissue_states_indicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('state_id', ts.state_id, 'state_name', ts.state_name, 'strength', htsc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tissue_states_contraindicated htsc JOIN public.tissue_states ts ON ts.state_id = htsc.state_id
     WHERE htsc.herb_id = h.herb_id
  ) AS tissue_states_contraindicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('system_id', bs.system_id, 'system_name', bs.system_name, 'strength', hs.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_systems hs JOIN public.body_systems bs ON bs.system_id = hs.system_id
     WHERE hs.herb_id = h.herb_id
  ) AS systems_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('complaint_id', cpl.complaint_id, 'complaint_name', cpl.complaint_name, 'strength', hc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_complaints hc JOIN public.complaints cpl ON cpl.complaint_id = hc.complaint_id
     WHERE hc.herb_id = h.herb_id
  ) AS complaints_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('taste_id', t.taste_id, 'taste_name', t.taste_name)), '[]'::jsonb)
      FROM public.herbs_tastes ht JOIN public.tastes t ON t.taste_id = ht.taste_id
     WHERE ht.herb_id = h.herb_id
  ) AS tastes_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('constitution_id', c.constitution_id, 'name', c.name, 'relationship', hc2.relationship, 'strength', hc2.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_constitutions hc2 JOIN public.constitutions c ON c.constitution_id = hc2.constitution_id
     WHERE hc2.herb_id = h.herb_id
  ) AS constitutions_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htci.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_indicated htci JOIN public.tcm_patterns p ON p.pattern_id = htci.pattern_id
     WHERE htci.herb_id = h.herb_id
  ) AS tcm_indicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pattern_id', p.pattern_id, 'pattern_name', p.pattern_name, 'strength', htcc.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_tcm_contraindicated htcc JOIN public.tcm_patterns p ON p.pattern_id = htcc.pattern_id
     WHERE htcc.herb_id = h.herb_id
  ) AS tcm_contraindicated_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hdm.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_match hdm JOIN public.doshas d ON d.dosha_id = hdm.dosha_id
     WHERE hdm.herb_id = h.herb_id
  ) AS doshas_match_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('dosha_id', d.dosha_id, 'dosha_name', d.dosha_name, 'strength', hda.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_doshas_aggravates hda JOIN public.doshas d ON d.dosha_id = hda.dosha_id
     WHERE hda.herb_id = h.herb_id
  ) AS doshas_aggravates_rel,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('prep_id', pr.prep_id, 'preparation_name', pr.preparation_name, 'strength', hp.strength_of_indication)), '[]'::jsonb)
      FROM public.herbs_preparations hp JOIN public.preparations pr ON pr.prep_id = hp.prep_id
     WHERE hp.herb_id = h.herb_id
  ) AS preparations_rel
from public.herbs h
where public.current_user_at_least('seed'::text)
  and coalesce(h.status, ''::text) not like 'Hidden%'::text;

-- -----------------------------------------------------------------------------
-- Verification: abort the transaction if anything is not as this file says
-- -----------------------------------------------------------------------------

-- V1. Every edited field holds exactly the new value.
do $v1$
declare bad text[] := '{}';
begin
  if not exists (select 1 from public.herbs where herb_id = 'H006' and md5(secondary_citation->>'locator') = 'd15d4f0d32f4f4826259b38db077aa45') then bad := bad || 'H006.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI146' and md5(source_citation) = '2d1a97987118021c0abddec22e4517ce') then bad := bad || 'CI146.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H029' and md5(secondary_citation->>'locator') = '321961bea266f8ae8010f1b7ad61747f') then bad := bad || 'H029.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H049' and md5(secondary_citation->>'locator') = '9369cb905e4330991af4dcf29001b157') then bad := bad || 'H049.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H065' and md5(secondary_citation->>'locator') = 'f6e5d341c5c795709a4ffe1135f2ea6d') then bad := bad || 'H065.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H066' and md5(secondary_citation->>'locator') = '4e98af0b98a9b13c485e56bec8f6e473') then bad := bad || 'H066.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H070' and md5(secondary_citation->>'locator') = '0483417dcd65a599714b9ee65f37bbe9') then bad := bad || 'H070.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H076' and md5(secondary_citation->>'locator') = 'cc9dfdf5c571fc32eaaef7569aba8e9e') then bad := bad || 'H076.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H077' and md5(secondary_citation->>'locator') = '5878b482b5a7425028675cde00608f0f') then bad := bad || 'H077.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H080' and md5(secondary_citation->>'locator') = '79ea6acd8edd51093b4ee3d4a44ba6bd') then bad := bad || 'H080.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H081' and md5(secondary_citation->>'locator') = 'd5a1c57e5886ab228753556ce0dfe006') then bad := bad || 'H081.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H087' and md5(secondary_citation->>'locator') = '620cf074af1e3ab848ef67d83d056b71') then bad := bad || 'H087.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H091' and md5(secondary_citation->>'locator') = '7324cf4ca1c6c2f7385a5445af76f03b') then bad := bad || 'H091.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H092' and md5(secondary_citation->>'locator') = '9e3566aeb0dd5253cd003519ecce68cb') then bad := bad || 'H092.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H095' and md5(secondary_citation->>'locator') = '909a3dff5bac6af624ed3af80d6169ed') then bad := bad || 'H095.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H106' and md5(pregnancy_safety) = '73228e71a1d79a65275542c5f6cf1a57') then bad := bad || 'H106.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H106' and md5(drug_interactions) = 'e7ccb0e7e2bb13b84531829d10201c0e') then bad := bad || 'H106.drug_interactions'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI233' and md5(source_citation) = '0e7a76988cea4f29aaa2190651b4e832') then bad := bad || 'CI233.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI237' and md5(source_citation) = '35c1c364b1bb787bb5eae5b6bd0b35e0') then bad := bad || 'CI237.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H111' and md5(children_safety) = 'c8ddff65a0cf1f4bb7990ac62a1d28f6') then bad := bad || 'H111.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H111' and md5(pregnancy_safety) = '3ee396cd06a7907a12059479f1ecc2a3') then bad := bad || 'H111.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H111' and md5(secondary_sources) = 'e30c458c3e8b8736d6c9dfedb8913cb8') then bad := bad || 'H111.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H111' and md5(secondary_citation->>'title') = 'd756b0504a0760dbdc23124091c5659a') then bad := bad || 'H111.secondary_citation.title'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H111' and md5(secondary_citation->>'locator') = 'd756b0504a0760dbdc23124091c5659a') then bad := bad || 'H111.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI270' and md5(source_citation) = '28b86b147cba7f75f8b35efae1608128') then bad := bad || 'CI270.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI270' and md5(mechanism_rationale) = '9d44f0ceebd6ef6e0b68601d591c5f49') then bad := bad || 'CI270.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H114' and md5(pregnancy_safety) = '04f3853a6511cf9cba1ee120e03298e9') then bad := bad || 'H114.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H114' and md5(drug_interactions) = '49cb463bada7a80190f99286268c2d7c') then bad := bad || 'H114.drug_interactions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H114' and md5(contraindications_general) = '6fc201835a7d0793a967095b9894d195') then bad := bad || 'H114.contraindications_general'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI283' and md5(source_citation) = '770683a41f8d2f1723f88962f979632e') then bad := bad || 'CI283.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI283' and md5(mechanism_rationale) = '9042dcd5a04927b2bfa8e05828688451') then bad := bad || 'CI283.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(pregnancy_safety) = 'a6c0e169c8e7081c76814df5e5e1d2f4') then bad := bad || 'H127.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H127' and md5(breastfeeding_safety) = '16eea14567c0390f6d9351346c7ea087') then bad := bad || 'H127.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI361' and md5(source_citation) = '06d8dc060be7547d2175eb0e0a3c93e0') then bad := bad || 'CI361.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI361' and md5(mechanism_rationale) = '891cd2373e43aea2cdd0f3fe274b38e2') then bad := bad || 'CI361.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI362' and md5(source_citation) = 'c82f3fc53f897a48101aa1a358875048') then bad := bad || 'CI362.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI367' and md5(source_citation) = '4b2300f210d6b73c01cceee97c86b062') then bad := bad || 'CI367.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H128' and md5(drug_interactions) = 'f3fe636321dea9a0a749582c29c656eb') then bad := bad || 'H128.drug_interactions'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI370' and md5(source_citation) = 'd91ae731f6fd28a683705c69f0ce3fb9') then bad := bad || 'CI370.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H129' and md5(pregnancy_safety) = 'ffe099032d996118996c46f19a3ec86b') then bad := bad || 'H129.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H129' and md5(breastfeeding_safety) = 'a91b9598752384ab122a537fa75cd1a3') then bad := bad || 'H129.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI374' and md5(source_citation) = '76b69b1b5a7c51ea601869b0ac58b242') then bad := bad || 'CI374.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI375' and md5(source_citation) = '205239bb73bcbecd8d152e9b5d625dbb') then bad := bad || 'CI375.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H149' and md5(pregnancy_safety) = 'ef02e349f6aa07786fd4a65595905967') then bad := bad || 'H149.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI512' and md5(source_citation) = '08db488d2ac8cd2dff57c297ac92056a') then bad := bad || 'CI512.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H157' and md5(pregnancy_safety) = '2c2197e772bee3ed5fbfeaa2cc6341df') then bad := bad || 'H157.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI565' and md5(source_citation) = 'b3b19aa08871f7e7d81ffaa08e917f88') then bad := bad || 'CI565.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H159' and md5(children_safety) = '8260a79896211be10c17bfb3089a4268') then bad := bad || 'H159.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H159' and md5(pregnancy_safety) = 'bf2ad764db2dc6d34d9c123a4209580b') then bad := bad || 'H159.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H159' and md5(breastfeeding_safety) = 'c5fe8909a75c2d892da4da0becc0a0af') then bad := bad || 'H159.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI583' and md5(source_citation) = '6af00d4877822e5208a979b138a21cd7') then bad := bad || 'CI583.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H170' and md5(drug_interactions) = 'd5ccce60610cef64c92360895ac2e043') then bad := bad || 'H170.drug_interactions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H170' and md5(secondary_sources) = 'aa7cae4069c61419d988da637a3996c0') then bad := bad || 'H170.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H170' and md5(secondary_citation->>'title') = '29fa0592ed7f896e576821167babbebd') then bad := bad || 'H170.secondary_citation.title'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H170' and md5(secondary_citation->>'locator') = '29fa0592ed7f896e576821167babbebd') then bad := bad || 'H170.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI658' and md5(source_citation) = '3cd605420d5f39e518392ecd679261de') then bad := bad || 'CI658.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI660' and md5(source_citation) = 'a7a8d0c712ea93def4a5408934a394f4') then bad := bad || 'CI660.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H171' and md5(pregnancy_safety) = '4d12c242dd7a7859e49fd98c4ba57b52') then bad := bad || 'H171.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H171' and md5(drug_interactions) = 'e9ffd3125264efc66d4d819ad9c4fe3b') then bad := bad || 'H171.drug_interactions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H171' and md5(secondary_sources) = 'e9d9844e6c9565613c16bacda5ce4588') then bad := bad || 'H171.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H171' and md5(secondary_citation->>'title') = 'a86f509dcd7b7ffa0950e85931a010bc') then bad := bad || 'H171.secondary_citation.title'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H171' and md5(secondary_citation->>'locator') = 'a86f509dcd7b7ffa0950e85931a010bc') then bad := bad || 'H171.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI664' and md5(source_citation) = '65a53cf262e7fad9dc9ebdb12fb1a2f6') then bad := bad || 'CI664.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI664' and md5(mechanism_rationale) = '2596f361e6d032ece4ce32280a59e320') then bad := bad || 'CI664.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H172' and md5(pregnancy_safety) = '156b546d44a8b2ebb6263d193e0b6d03') then bad := bad || 'H172.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H172' and md5(drug_interactions) = '2f8f7dec1f0dfdf7173493d03ad2b2ba') then bad := bad || 'H172.drug_interactions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H172' and md5(secondary_sources) = '84083fe35844260b325fcb960226c5cd') then bad := bad || 'H172.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H172' and md5(secondary_citation->>'title') = '3827f53702e6fb8c7dbee954aa01bdfb') then bad := bad || 'H172.secondary_citation.title'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H172' and md5(secondary_citation->>'locator') = '3827f53702e6fb8c7dbee954aa01bdfb') then bad := bad || 'H172.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H172' and md5(contraindications_general) = '8b80f8373a29c0aad370c57c2cd92883') then bad := bad || 'H172.contraindications_general'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI671' and md5(source_citation) = '6c6d3349636b2b7fec8297b963499c53') then bad := bad || 'CI671.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI671' and md5(mechanism_rationale) = '26285969a7849d77127dab0b9b50745b') then bad := bad || 'CI671.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI674' and md5(source_citation) = '7bb0c360ab466038a1615c8f48062f17') then bad := bad || 'CI674.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI674' and md5(clinical_guidance) = '30920e113f34c8e2df23ec237855e0d1') then bad := bad || 'CI674.clinical_guidance'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H177' and md5(pregnancy_safety) = '3c38d274320b2918edc4ec160dd32c2c') then bad := bad || 'H177.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H190' and md5(pregnancy_safety) = '4a260ae009accbf40a9111607330b150') then bad := bad || 'H190.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI791' and md5(mechanism_rationale) = '8ce9a8e81130039bab89ff720842dc37') then bad := bad || 'CI791.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H246' and md5(children_safety) = 'fbda1e983605b971ae0bdfd89b895f14') then bad := bad || 'H246.children_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H246' and md5(pregnancy_safety) = 'cb721235c007dd3fda497d4cbae5cd21') then bad := bad || 'H246.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H246' and md5(secondary_sources) = '9da7ebd5922e41e5b1a2790ae67068ba') then bad := bad || 'H246.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H246' and md5(breastfeeding_safety) = '4126b8778573b810b309a546ea8bd2f3') then bad := bad || 'H246.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1175' and md5(source_citation) = '87479be02644e178ec5103c0a8745419') then bad := bad || 'CI1175.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H260' and md5(cautions) = '1a39ade27aeb34caab9cee12f1273685') then bad := bad || 'H260.cautions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H260' and md5(pregnancy_safety) = 'a131982b1af322f0b061327d48fde41a') then bad := bad || 'H260.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H260' and md5(secondary_sources) = '04b956bd3da457c4fe0c8c08c92e42fb') then bad := bad || 'H260.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H260' and md5(contraindications_general) = '7c92867bf4e45ec0aaeddd6c63129e68') then bad := bad || 'H260.contraindications_general'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1274' and md5(source_citation) = 'a60d4d1b1bd0292ca7f21b93831f4249') then bad := bad || 'CI1274.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1276' and md5(source_citation) = '66cc2ced92abcdb2f49d5637dd5639a7') then bad := bad || 'CI1276.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H265' and md5(drug_interactions) = 'f2b3fc85f7d35392e963881c885a7156') then bad := bad || 'H265.drug_interactions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H271' and md5(pregnancy_safety) = 'c14b8ece1852b061f1633154f8c69e71') then bad := bad || 'H271.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H271' and md5(breastfeeding_safety) = '677a70dd4d5003d562faf9162b4fcadf') then bad := bad || 'H271.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1340' and md5(source_citation) = '566dbbed1359cfbc9889fbe819435ce5') then bad := bad || 'CI1340.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1341' and md5(source_citation) = '20ec55ea29cbb08c31f1096914e15c5f') then bad := bad || 'CI1341.source_citation'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H274' and md5(pregnancy_safety) = '9e48c08b6daac91cff8eb780bdd4aa57') then bad := bad || 'H274.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H274' and md5(drug_interactions) = '74c86d229fbd0bb7badc6fe06df7a42c') then bad := bad || 'H274.drug_interactions'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H274' and md5(breastfeeding_safety) = 'a1313333d8edeefe0d362aa435f619e6') then bad := bad || 'H274.breastfeeding_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1361' and md5(mechanism_rationale) = '59229852a6e8cb82367944673708fd9c') then bad := bad || 'CI1361.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H278' and md5(pregnancy_safety) = '470e3999911a04d6dee95261fa50ffd1') then bad := bad || 'H278.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H278' and md5(secondary_sources) = '184567ed09a21f3700c80b56e81d06b6') then bad := bad || 'H278.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H278' and md5(secondary_citation->>'title') = '50cf2a53884c49d3f58e8d691b0b3ded') then bad := bad || 'H278.secondary_citation.title'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H278' and md5(secondary_citation->>'locator') = '50cf2a53884c49d3f58e8d691b0b3ded') then bad := bad || 'H278.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H278' and md5(contraindications_general) = 'dd3e1c8c8a087d9c83ad2ec192605426') then bad := bad || 'H278.contraindications_general'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1386' and md5(source_citation) = 'efbede1651211fe2d23d8e3c482fa442') then bad := bad || 'CI1386.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1386' and md5(mechanism_rationale) = 'f0a7d10c72e96a8dec74e84fc20c71d8') then bad := bad || 'CI1386.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H299' and md5(pregnancy_safety) = 'c2a56829c6260309c0bfddeb2481df34') then bad := bad || 'H299.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1521' and md5(source_citation) = '0cc2442f9c6919c5b3498099102dbac3') then bad := bad || 'CI1521.source_citation'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI704' and md5(mechanism_rationale) = '1f4485791ea8d9bf9a5c417874a77bba') then bad := bad || 'CI704.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H183' and md5(pregnancy_safety) = '022eed0be87e47f1c1c61a554ed04dee') then bad := bad || 'H183.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI745' and md5(mechanism_rationale) = 'cf42420a398d5e818fb2fe57146451b2') then bad := bad || 'CI745.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H279' and md5(pregnancy_safety) = '8c2279552995f01b50e897a95d9599e9') then bad := bad || 'H279.pregnancy_safety'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H279' and md5(secondary_sources) = 'b4e81d7201e1d5c4434edf839f7aeb45') then bad := bad || 'H279.secondary_sources'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H279' and md5(secondary_citation->>'title') = '97d766540ae900a3dd8afd813184a0e1') then bad := bad || 'H279.secondary_citation.title'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H279' and md5(secondary_citation->>'locator') = '97d766540ae900a3dd8afd813184a0e1') then bad := bad || 'H279.secondary_citation.locator'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H279' and md5(contraindications_general) = '01d27ed830b697cf61d84ca0da1ebfe6') then bad := bad || 'H279.contraindications_general'::text; end if;
  if not exists (select 1 from public.contraindications where contraindication_id = 'CI1394' and md5(mechanism_rationale) = 'eff8e78e3b91aaaa3ca5665808e02157') then bad := bad || 'CI1394.mechanism_rationale'::text; end if;
  if not exists (select 1 from public.herbs where herb_id = 'H030' and md5(secondary_citation->>'locator') = '2bcfe8f32dcac32149c7694a52b71b11') then bad := bad || 'H030.secondary_citation.locator'::text; end if;
  if array_length(bad, 1) > 0 then
    raise exception 'fields not at their corrected value: %', array_to_string(bad, ', ');
  end if;
end
$v1$;

-- V2. No unlabelled AHPA class mention remains in any herbs or contraindications row
--     of the labelled herbs (same pattern as the check, word boundaries as \y).
do $v2$
declare bad text;
begin
  select string_agg(id, ', ') into bad from (
    select h.herb_id as id from public.herbs h
     where h.herb_id in ('H006', 'H008', 'H029', 'H049', 'H065', 'H066', 'H070', 'H076', 'H077', 'H080',
    'H081', 'H087', 'H091', 'H092', 'H095', 'H106', 'H111', 'H114', 'H127', 'H128',
    'H129', 'H149', 'H157', 'H159', 'H170', 'H171', 'H172', 'H177', 'H190', 'H246',
    'H260', 'H265', 'H271', 'H274', 'H278', 'H299')
       and to_jsonb(h)::text ~* '\y(?:(?:safety|interaction)s?\s+)?class(?:es)?\s*(?:1|2[a-d](?:\s*(?:/|,|and|&|or)\s*2[a-d])*|3|[abc])\y(?!\s*(?:/|,|and|&|or)\s*2[a-d])(?!\s*\(not verified against AHPA\))'
    union all
    select c.contraindication_id from public.contraindications c
     where c.herb_id in ('H006', 'H008', 'H029', 'H049', 'H065', 'H066', 'H070', 'H076', 'H077', 'H080',
    'H081', 'H087', 'H091', 'H092', 'H095', 'H106', 'H111', 'H114', 'H127', 'H128',
    'H129', 'H149', 'H157', 'H159', 'H170', 'H171', 'H172', 'H177', 'H190', 'H246',
    'H260', 'H265', 'H271', 'H274', 'H278', 'H299')
       and to_jsonb(c)::text ~* '\y(?:(?:safety|interaction)s?\s+)?class(?:es)?\s*(?:1|2[a-d](?:\s*(?:/|,|and|&|or)\s*2[a-d])*|3|[abc])\y(?!\s*(?:/|,|and|&|or)\s*2[a-d])(?!\s*\(not verified against AHPA\))'
  ) x;
  if bad is not null then
    raise exception 'unlabelled AHPA class mention remains in: %', bad;
  end if;
end
$v2$;

-- V3. Kava, pinellia, basil.
do $v3$
begin
  if not exists (select 1 from public.herbs where herb_id = 'H030'
                  and secondary_citation->>'locator' like 'AHPA Class 2b and 2c, Interaction Class B (AHPA, July 2024 update) (https://www.ahpa.org/blog_home.asp?display=279)%'
                  and secondary_citation::text not like '%Class 2d%') then
    raise exception 'H030 kava class text not corrected';
  end if;
  if exists (select 1 from public.herbs h where h.herb_id in ('H030', 'H183', 'H279') and to_jsonb(h)::text like '%not verified against AHPA%')
     or exists (select 1 from public.contraindications c where c.herb_id in ('H030', 'H183', 'H279') and to_jsonb(c)::text like '%not verified against AHPA%') then
    raise exception 'kava, pinellia or basil carries a not-verified label';
  end if;
  if (select count(*) from public.herbs where herb_id = 'H183' and pregnancy_safety like '%display=163%') <> 1
     or (select count(*) from public.contraindications where contraindication_id = 'CI745' and mechanism_rationale like '%display=163%') <> 1
     or (select count(*) from public.herbs where herb_id = 'H279' and pregnancy_safety like '%display=55%' and secondary_sources like '%display=55%'
           and contraindications_general like '%display=55%' and secondary_citation->>'title' like '%display=55%' and secondary_citation->>'locator' like '%display=55%') <> 1
     or (select count(*) from public.contraindications where contraindication_id = 'CI1394' and mechanism_rationale like '%display=55%') <> 1 then
    raise exception 'pinellia or basil edition wording not corrected';
  end if;
end
$v3$;

-- V4. H238 is absent from all three views, nothing else dropped, shape, options and grants unchanged.
do $v4$
declare
  bad  text[] := '{}';
  vw   text;
  priv text;
  n    int;
begin
  perform set_config('search_path', 'public, pg_catalog', true);
  if (select status from public.herbs where herb_id = 'H238') is distinct from 'Hidden - species identity under review 2026-09-15' then
    bad := bad || 'H238 status not set'::text;
  end if;
  if exists (select 1 from public.herbs_directory_v where herb_id = 'H238') then bad := bad || 'H238 in herbs_directory_v'::text; end if;
  if exists (select 1 from public.herbs_public where herb_id = 'H238') then bad := bad || 'H238 in herbs_public'::text; end if;
  foreach vw in array array['public.herbs_directory_v', 'public.herbs_public', 'public.herbs_clinical_v'] loop
    if pg_get_viewdef(vw::regclass, true) !~ 'Hidden%' then bad := bad || (vw || ' has no Hidden filter'); end if;
  end loop;
  -- herbs_clinical_v only returns rows to Seed+ callers, so check its filter by definition above
  -- and prove the filter removes exactly the hidden rows from the directory:
  if (select count(*) from public.herbs_directory_v)
     <> (select count(*) from public.herbs where coalesce(status, '') not like 'Hidden%') then
    bad := bad || 'herbs_directory_v row count does not equal non-hidden herbs'::text;
  end if;
  if (select count(*) from public.herbs where coalesce(status, '') like 'Hidden%') <> 1 then
    bad := bad || 'expected exactly 1 hidden herb'::text;
  end if;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'herbs_directory_v';
  if n <> 54 then bad := bad || ('herbs_directory_v has ' || n || ' columns, expected 54'); end if;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'herbs_public';
  if n <> 20 then bad := bad || ('herbs_public has ' || n || ' columns, expected 20'); end if;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'herbs_clinical_v';
  if n <> 48 then bad := bad || ('herbs_clinical_v has ' || n || ' columns, expected 48'); end if;
  -- reloptions exactly as live on 2026-09-15
  if (select reloptions from pg_class where oid = 'public.herbs_directory_v'::regclass) is not null then
    bad := bad || 'herbs_directory_v gained reloptions'::text;
  end if;
  foreach vw in array array['public.herbs_public', 'public.herbs_clinical_v'] loop
    if (select reloptions from pg_class where oid = vw::regclass) is distinct from array['security_invoker=false', 'security_barrier=true'] then
      bad := bad || (vw || ' reloptions changed');
    end if;
  end loop;
  -- grants exactly as live on 2026-09-15
  if (select relacl::text from pg_class where oid = 'public.herbs_directory_v'::regclass)
     is distinct from '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=r/postgres}' then
    bad := bad || 'herbs_directory_v ACL changed'::text;
  end if;
  if (select relacl::text from pg_class where oid = 'public.herbs_public'::regclass)
     is distinct from '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=r/postgres}' then
    bad := bad || 'herbs_public ACL changed'::text;
  end if;
  if (select relacl::text from pg_class where oid = 'public.herbs_clinical_v'::regclass)
     is distinct from '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    bad := bad || 'herbs_clinical_v ACL changed'::text;
  end if;
  foreach vw in array array['public.herbs_directory_v', 'public.herbs_public'] loop
    if not has_table_privilege('anon', vw, 'SELECT') or not has_table_privilege('authenticated', vw, 'SELECT') then
      bad := bad || (vw || ' lost anon/authenticated SELECT');
    end if;
    foreach priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('anon', vw, priv) or has_table_privilege('authenticated', vw, priv) then
        bad := bad || (vw || ' grants ' || priv || ' to a client role');
      end if;
    end loop;
  end loop;
  if has_table_privilege('anon', 'public.herbs_clinical_v', 'SELECT') or has_table_privilege('authenticated', 'public.herbs_clinical_v', 'SELECT') then
    bad := bad || 'herbs_clinical_v is client-readable'::text;
  end if;
  if array_length(bad, 1) > 0 then
    raise exception 'H238 hide / view checks failed: %', array_to_string(bad, '; ');
  end if;
end
$v4$;

commit;
