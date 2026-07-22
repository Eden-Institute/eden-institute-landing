-- Tell the reader WHY a recommended herb suits their pattern, for 27 more rows.
--
-- ── THE COMPLAINT THIS CLOSES ──────────────────────────────────────────────
-- The customer whose email started this whole project wrote, of his Spent
-- Candle deep-dive: "two of the recommended herbs, hawthorn and marshmallow,
-- didn't indicate how they were beneficial for a Spent Candle."
--
-- Marshmallow was fixed by 20260721150000, which ported 39 benefit paragraphs.
-- Hawthorn was NOT. Its curated row predates that work and came from the earlier
-- founder-canon curation, and the port only covered rows in the researched set.
-- So 70 of 109 curated positive rows still had no "why" attached.
--
-- ── WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────
-- Fills benefit_note for the 27 rows where the guide GENUINELY carries a
-- constitutionalMatch paragraph for that exact herb-and-pattern pair. This is a
-- MOVE of founder-approved copy, not new authoring: the same text the reader
-- already receives in their deep-dive.
--
-- The other 43 are left empty ON PURPOSE. They are curated pairings that are not
-- guide recommendations, so no approved prose exists for them, and inventing a
-- reason would be exactly the failure this project has spent two days undoing.
--
-- Five of the 27 are Spent Candle rows and reach the original complaint
-- directly: Ashwagandha, Astragalus, Hawthorn, Licorice and Oat Straw.
--
-- ── ONE THING LEFT ALONE FOR THE FOUNDER ───────────────────────────────────
-- 12 of the 27 paragraphs contain an EM DASH. House style says no em dashes in
-- Eden copy, but these are pre-existing approved guide paragraphs and are ported
-- VERBATIM. Silently rewriting the founder's copy while moving it would be the
-- wrong call; whether the no-em-dash rule reaches the guides is her decision and
-- is still open.
--
-- Scoped to derivation='curated' AND benefit_note IS NULL, so it cannot
-- overwrite anything already written. Idempotent.

begin;

-- Chamomile / the_burning_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Chamomile cools heat in the digestive system, calms nervous irritability, and releases spasm. For the Burning Bowstring with digestive tension, headaches, and an inability to wind down, chamomile is a reliable daily ally.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Chamomile' and p.slug = 'the_burning_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Hawthorn / the_burning_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Hawthorn strengthens and protects the heart — physically and emotionally. For the Burning Bowstring prone to cardiovascular tension, elevated blood pressure from stress, and emotional guardedness, hawthorn provides gentle, steady support.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Hawthorn' and p.slug = 'the_burning_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Licorice / the_burning_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Licorice moistens dryness, soothes inflammation, and supports adrenal glands depleted by chronic stress and tension. It harmonizes herbal formulas — smoothing out the sharp edges of stronger herbs.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Licorice' and p.slug = 'the_burning_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Ashwagandha / the_drawn_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Ashwagandha is perhaps the single most important herb for the Drawn Bowstring. It is warming, nourishing, and deeply restorative to the nervous system. It calms anxiety while building strength — without sedation. It addresses the cold, the depletion, AND the tension simultaneously.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Ashwagandha' and p.slug = 'the_drawn_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Cinnamon / the_drawn_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Cinnamon gently warms the core, improves digestion, and enhances circulation to cold extremities. For the Drawn Bowstring running cold and depleted, cinnamon provides warmth without overstimulation.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Cinnamon' and p.slug = 'the_drawn_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Hawthorn / the_drawn_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Hawthorn nourishes and calms the heart — physically and emotionally. For the Drawn Bowstring with palpitations, anxiety-driven cardiovascular tension, and a heart that races from fear rather than exertion, hawthorn provides steady, gentle support.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Hawthorn' and p.slug = 'the_drawn_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Licorice / the_drawn_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Licorice is moistening, nourishing, and supportive to exhausted adrenal glands. For the Drawn Bowstring with chronic fatigue, low cortisol, and dry tissues, licorice provides deep restoration and harmonizes other herbs in formulas.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Licorice' and p.slug = 'the_drawn_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Oat Straw / the_drawn_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Milky Oats rebuild a depleted nervous system over time. When the Drawn Bowstring has been taut for too long, the nervous system becomes frayed. Milky oats nourish and restore — not by sedation, but by replenishment.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Oat Straw' and p.slug = 'the_drawn_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Valerian / the_drawn_bowstring
update public.herbs_eden_patterns hep set benefit_note = 'Valerian directly releases the tension that defines this pattern. It relaxes skeletal muscle, smooth muscle, and the nervous system. For the Drawn Bowstring with insomnia, muscle spasm, and an inability to let go, valerian provides the release the body cannot find on its own.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Valerian' and p.slug = 'the_drawn_bowstring'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Ginger / the_frozen_knot
update public.herbs_eden_patterns hep set benefit_note = 'Ginger warms the core, stimulates digestion, and moves stagnant fluids. For the Frozen Knot with cold, crampy digestion and overall stagnation, ginger provides warmth and movement simultaneously.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Ginger' and p.slug = 'the_frozen_knot'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Thyme / the_frozen_knot
update public.herbs_eden_patterns hep set benefit_note = 'Thyme is specific for cold/damp conditions in the respiratory system — chronic congestion, productive coughs, sinus heaviness. It warms, dries, and clears while fighting the low-grade infections common to this type.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Thyme' and p.slug = 'the_frozen_knot'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Valerian / the_frozen_knot
update public.herbs_eden_patterns hep set benefit_note = 'Valerian releases the tension component of the Frozen Knot. Its warming, relaxing nature helps the body unclench so that other warming and drying herbs can penetrate and do their work. You must release the grip before you can thaw what is frozen.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Valerian' and p.slug = 'the_frozen_knot'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Calendula / the_overflowing_cup
update public.herbs_eden_patterns hep set benefit_note = 'Calendula moves lymph, heals tissue, and provides the gentle astringency the Overflowing Cup needs. It is particularly valuable for weeping skin conditions and slow-healing wounds — it promotes resolution and restores tissue integrity.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Calendula' and p.slug = 'the_overflowing_cup'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Dandelion / the_overflowing_cup
update public.herbs_eden_patterns hep set benefit_note = 'Roasted Dandelion Root deepens hepatobiliary drainage — liver and gallbladder clearance. For the Overflowing Cup, where tissue is already lax, you do not need aggressive diuresis from the leaf. You need deeper drainage through the liver.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Dandelion' and p.slug = 'the_overflowing_cup'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Burdock / the_pressure_cooker
update public.herbs_eden_patterns hep set benefit_note = 'Burdock works slowly and deeply to clear metabolic waste through liver, kidneys, and skin. For the Pressure Cooker with skin eruptions, chronic congestion, or a sense of internal toxicity, burdock reduces the load over time.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Burdock' and p.slug = 'the_pressure_cooker'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Calendula / the_pressure_cooker
update public.herbs_eden_patterns hep set benefit_note = 'Calendula moves lymph, heals inflamed tissue, and promotes the resolution of conditions that are stuck. For the Pressure Cooker whose inflammation does not resolve, calendula helps complete the cycle.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Calendula' and p.slug = 'the_pressure_cooker'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Chamomile / the_pressure_cooker
update public.herbs_eden_patterns hep set benefit_note = 'Chamomile cools digestive heat, releases gut spasm, and calms the irritability that accompanies this pattern. For the Pressure Cooker with IBS-like symptoms, chamomile addresses both the heat and the tension in the digestive tract.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Chamomile' and p.slug = 'the_pressure_cooker'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Dandelion / the_pressure_cooker
update public.herbs_eden_patterns hep set benefit_note = 'Dandelion opens two critical release valves simultaneously: the liver (root) and the kidneys (leaf). For the Pressure Cooker, this dual drainage is essential — it reduces both the heat burden and the fluid accumulation that creates pressure.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Dandelion' and p.slug = 'the_pressure_cooker'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Ashwagandha / the_spent_candle
update public.herbs_eden_patterns hep set benefit_note = 'Ashwagandha is deeply restorative without being stimulating. For the Spent Candle, it rebuilds adrenal function, supports thyroid activity (often low in this type), and nourishes the nervous system back to health over time.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Ashwagandha' and p.slug = 'the_spent_candle'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Astragalus / the_spent_candle
update public.herbs_eden_patterns hep set benefit_note = 'Astragalus builds deep immune reserves and protective energy over time. For the Spent Candle with frequent illness and depleted immunity, astragalus slowly rebuilds the shield that chronic depletion has lowered.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Astragalus' and p.slug = 'the_spent_candle'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Hawthorn / the_spent_candle
update public.herbs_eden_patterns hep set benefit_note = 'Hawthorn nourishes and strengthens the heart — physically and emotionally. For the Spent Candle with low blood pressure, weak circulation, and a spirit that has grown weary, hawthorn gently rebuilds.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Hawthorn' and p.slug = 'the_spent_candle'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Licorice / the_spent_candle
update public.herbs_eden_patterns hep set benefit_note = 'Licorice is profoundly moistening and nourishing to exhausted adrenal glands. For the Spent Candle with low cortisol, chronic fatigue, and dry tissues, licorice provides deep, slow restoration.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Licorice' and p.slug = 'the_spent_candle'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Oat Straw / the_spent_candle
update public.herbs_eden_patterns hep set benefit_note = 'Oat straw gently rebuilds a completely exhausted nervous system. For the Spent Candle whose nerves are not wired (that is the Drawn Bowstring) but collapsed, oat straw provides the slow, steady nourishment needed to come back to life.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Oat Straw' and p.slug = 'the_spent_candle'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Astragalus / the_still_water
update public.herbs_eden_patterns hep set benefit_note = 'Astragalus builds deep energy reserves and immune function. For the Still Water with low energy and frequent illness, astragalus slowly builds the vitality and protective force the body needs to stay active.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Astragalus' and p.slug = 'the_still_water'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Cinnamon / the_still_water
update public.herbs_eden_patterns hep set benefit_note = 'Cinnamon gently warms the digestive system, improves circulation, and helps regulate blood sugar — all valuable for the Still Water prone to sluggish digestion and metabolic challenges.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Cinnamon' and p.slug = 'the_still_water'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Ginger / the_still_water
update public.herbs_eden_patterns hep set benefit_note = 'Ginger is the quintessential remedy for the Still Water pattern. It warms the core, stimulates digestion, moves stagnant fluids, and awakens sluggish circulation. It is the herb that gets the still water flowing again.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Ginger' and p.slug = 'the_still_water'
   and hep.derivation = 'curated' and hep.benefit_note is null;

-- Thyme / the_still_water
update public.herbs_eden_patterns hep set benefit_note = 'Thyme is specific for the chronic respiratory congestion common to Still Water — heavy, wet lungs, persistent productive coughs, and sinus heaviness that never fully clears. It warms, dries, and fights the infections that linger in cold, damp tissue.'
  from public.herbs h, public.eden_patterns p
 where hep.herb_id = h.herb_id and hep.pattern_id = p.pattern_id
   and h.common_name = 'Thyme' and p.slug = 'the_still_water'
   and hep.derivation = 'curated' and hep.benefit_note is null;
commit;
