-- ============================================================================
-- Seed herbs_complaints links for "Cold/flu onset" (CP41) and "PMS" (CP32).
--
-- Founder-requested (2026-07-01) follow-up to the CRO Phase 3 audit: both
-- complaints appear in user-facing pickers (the symptom doorway teaches
-- "Cold/flu onset"; "pms" is a search term) but had ZERO herb links, so
-- selecting them filtered the directory to nothing.
--
-- Every link below is drawn from the existing 108-herb roster and grounded
-- in public-domain materia medica (cited per row in `notes`):
--   • Grieve, "A Modern Herbal" (1931)
--   • Felter & Lloyd, "King's American Dispensatory" (1898)
--   • Cook, "The Physio-Medical Dispensatory" (1869)
--   • Classical Chinese materia medica lineage (Angelica sinensis)
-- "PMS" as a named syndrome postdates these texts; the linked herbs carry
-- their traditional indications for premenstrual and menstrual complaints
-- (uterine cramping, premenstrual nervous tension, menstrual regulation),
-- which is what the complaint bucket means in this app.
--
-- Idempotent: ON CONFLICT (herb_id, complaint_id) DO NOTHING.
-- Applied to production via Supabase SQL Editor.
-- ============================================================================

-- ── Cold/flu onset (CP41) ────────────────────────────────────────────────────

insert into public.herbs_complaints (herb_id, complaint_id, strength_of_indication, notes)
values
  ('H013', 'CP41', 'Strong',
   'Elderflower infusion is the classic onset diaphoretic for colds and influenza (Grieve 1931; the traditional yarrow, elderflower, and peppermint tea).'),
  ('H069', 'CP41', 'Strong',
   'Yarrow tea taken hot at the first signs of a cold to promote perspiration (Grieve 1931; part of the classic onset trio).'),
  ('H046', 'CP41', 'Moderate',
   'Peppermint completes the traditional onset trio with yarrow and elderflower; warming aromatic diaphoretic (Grieve 1931).'),
  ('H083', 'CP41', 'Strong',
   'Boneset (Eupatorium perfoliatum) is a foremost Eclectic remedy in influenza and feverish colds (King''s American Dispensatory 1898).'),
  ('H012', 'CP41', 'Moderate',
   'Echinacea used by the Eclectics at the onset of acute catarrhal and feverish conditions (King''s American Dispensatory 1898).'),
  ('H019', 'CP41', 'Moderate',
   'Hot ginger tea as a warming diaphoretic at first chill; long dispensatory tradition for colds (Grieve 1931).'),
  ('H018', 'CP41', 'Moderate',
   'Garlic in colds and coughs of the chest (Grieve 1931).')
on conflict (herb_id, complaint_id) do nothing;

-- ── PMS (CP32) ───────────────────────────────────────────────────────────────

insert into public.herbs_complaints (herb_id, complaint_id, strength_of_indication, notes)
values
  ('H064', 'CP32', 'Strong',
   'Chaste tree (Vitex agnus-castus) carries a long European tradition for female reproductive complaints and menstrual regulation (Grieve 1931).'),
  ('H090', 'CP32', 'Strong',
   'Cramp bark (Viburnum opulus) for uterine cramping and spasmodic menstrual pain, including premenstrual cramping (King''s American Dispensatory 1898).'),
  ('H039', 'CP32', 'Moderate',
   'Motherwort for female disorders with nervous tension around the menses (Grieve 1931; Culpeper tradition).'),
  ('H078', 'CP32', 'Moderate',
   'Black cohosh (Cimicifuga) was a principal Eclectic remedy in menstrual disorders with nervous involvement (King''s American Dispensatory 1898).'),
  ('H092', 'CP32', 'Moderate',
   'Dong quai (Angelica sinensis) is the chief blood-regulating herb for menstrual complaints in classical Chinese materia medica.'),
  ('H048', 'CP32', 'Mild',
   'Raspberry leaf as a traditional uterine tonic (Grieve 1931).')
on conflict (herb_id, complaint_id) do nothing;
