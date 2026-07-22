-- 20260721150000_benefit_note_prose_port.sql  (regenerated from the guides)
--
-- Moves the founder's authored constitutionalMatch prose out of the hardcoded
-- guide files and into herbs_eden_patterns.benefit_note, so the Apothecary can
-- explain HOW a herb helps a pattern instead of only asserting that it does.
-- This is a move of approved copy, not new authoring.
--
-- SCOPE RULE: prose is written ONLY onto rows whose verdict is match or
-- conditional. Where the evidence overturned a recommendation to 'avoid', the
-- celebratory prose is deliberately withheld -- telling a reader why a herb
-- suits them beneath a badge saying avoid would be the original contradiction
-- with its polarity reversed.
--
-- Idempotent.

begin;

-- Angelica / Still Water (match)
update public.herbs_eden_patterns hep set benefit_note = 'Angelica warms the entire system — digestive, respiratory, and circulatory. It is particularly indicated for the Still Water with digestive weakness, poor appetite, and respiratory congestion. Its name itself speaks to divine provision.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_still_water'
   and hep.herb_id = 'H074' and hep.derivation = 'curated';

-- California Poppy / Burning Bowstring (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'California Poppy directly addresses the tension axis. It relaxes muscular and nervous tension without heavy sedation, calms an overactive mind, and eases the "wired but tired" pattern that defines the Burning Bowstring.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_burning_bowstring'
   and hep.herb_id = 'H005' and hep.derivation = 'curated';

-- Cleavers / Overflowing Cup (match)
update public.herbs_eden_patterns hep set benefit_note = 'Cleavers is the premier lymphatic mover — gently clearing the channels through which the Overflowing Cup needs to drain. It cools while it clears, addressing both the heat and the fluid accumulation.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H010' and hep.derivation = 'curated';

-- Cleavers / Pressure Cooker (match)
update public.herbs_eden_patterns hep set benefit_note = 'Cleavers is the premier lymphatic herb — cooling, cleansing, and promoting the movement of lymphatic fluid. For the Pressure Cooker with swollen lymph nodes, trapped fluid, or hot skin conditions, cleavers provides gentle but persistent drainage.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_pressure_cooker'
   and hep.herb_id = 'H010' and hep.derivation = 'curated';

-- Cramp Bark / Burning Bowstring (match)
update public.herbs_eden_patterns hep set benefit_note = 'Cramp Bark is a specific for muscular spasm and tension — skeletal, smooth, and uterine. For the Burning Bowstring who carries tension in the body (tight shoulders, clenched gut, menstrual cramps), cramp bark provides direct relief.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_burning_bowstring'
   and hep.herb_id = 'H090' and hep.derivation = 'curated';

-- Cramp Bark / Frozen Knot (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Cramp Bark releases the muscular tension that locks the Frozen Knot in place. When combined with warming herbs, it allows the body to thaw by releasing the grip that holds the cold and damp in place.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_frozen_knot'
   and hep.herb_id = 'H090' and hep.derivation = 'curated';

-- Cramp Bark / Pressure Cooker (match)
update public.herbs_eden_patterns hep set benefit_note = 'Cramp Bark directly addresses the tension component — releasing muscular spasm, reducing vascular tension, and lowering blood pressure. For the Pressure Cooker, this is the herb that opens the release valve.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_pressure_cooker'
   and hep.herb_id = 'H090' and hep.derivation = 'curated';

-- Fennel / Still Water (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Fennel warms and moves sluggish digestion, reduces bloating and gas, and helps clear excess moisture through gentle diuresis. For the Still Water with chronic digestive heaviness, fennel is a gentle daily support.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_still_water'
   and hep.herb_id = 'H016' and hep.derivation = 'curated';

-- Gentian / Overflowing Cup (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Gentian stimulates the entire digestive cascade — from saliva to bile to pancreatic enzymes. For the Overflowing Cup with sluggish digestion, bloating, and food that sits heavily, gentian awakens digestive fire without adding heat.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H096' and hep.derivation = 'curated';

-- Holy Basil (Tulsi) / Still Water (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Tulsi gently warms, lifts the spirits, clears mental fog, and supports respiratory health. For the Still Water prone to depression and low energy, it is an uplifting daily ally that activates without overstimulating.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_still_water'
   and hep.herb_id = 'H027' and hep.derivation = 'curated';

-- Juniper Berry / Frozen Knot (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Juniper helps the Frozen Knot release excess fluid accumulation through warming diuresis. It stimulates kidney function and helps clear the waterlogged feeling common to this type.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_frozen_knot'
   and hep.herb_id = 'H106' and hep.derivation = 'curated';

-- Lemon Balm / Burning Bowstring (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Lemon Balm cools heat, calms the nervous system, and lifts the spirits without sedation. It specifically addresses the anxious tension of this type — the racing thoughts, the tight stomach, the inability to let go.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_burning_bowstring'
   and hep.herb_id = 'H032' and hep.derivation = 'curated';

-- Linden / Pressure Cooker (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Linden is the ideal nervine for the Pressure Cooker — it relaxes nervous tension AND lowers blood pressure AND opens the pores to release trapped heat. It addresses all three axes of this pattern simultaneously.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_pressure_cooker'
   and hep.herb_id = 'H034' and hep.derivation = 'curated';

-- Marshmallow / Burning Bowstring (match)
update public.herbs_eden_patterns hep set benefit_note = 'Marshmallow directly addresses the dryness axis. Its abundant mucilage coats and soothes irritated, inflamed tissues — digestive tract, urinary system, respiratory passages.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_burning_bowstring'
   and hep.herb_id = 'H036' and hep.derivation = 'curated';

-- Marshmallow / Drawn Bowstring (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Marshmallow provides the moisture this dry constitution craves. It coats and soothes dry, irritated tissues throughout the body — gut, lungs, urinary tract. For the Drawn Bowstring with dry constipation and tissue fragility, it provides immediate relief.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_drawn_bowstring'
   and hep.herb_id = 'H036' and hep.derivation = 'curated';

-- Marshmallow / Open Flame (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Marshmallow addresses the dryness axis directly. Its mucilage coats and soothes irritated, inflamed tissues while restoring moisture to a system that burns dry.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H036' and hep.derivation = 'curated';

-- Marshmallow / Spent Candle (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Marshmallow coats, soothes, and moistens dry tissues throughout the body. For the Spent Candle with dry constipation, irritated membranes, and tissue fragility, marshmallow provides immediate comfort and long-term restoration.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_spent_candle'
   and hep.herb_id = 'H036' and hep.derivation = 'curated';

-- Milk Thistle / Overflowing Cup (match)
update public.herbs_eden_patterns hep set benefit_note = 'Milk Thistle protects and regenerates the liver — essential for a type prone to liver congestion and sluggish detoxification. It keeps the primary clearance organ functioning efficiently.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H038' and hep.derivation = 'curated';

-- Milk Thistle / Pressure Cooker (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Milk Thistle protects and regenerates the liver — the organ under greatest pressure in this constitutional type. When the liver is congested and the body is tense, toxins have nowhere to go. Milk thistle keeps the liver functioning under pressure.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_pressure_cooker'
   and hep.herb_id = 'H038' and hep.derivation = 'curated';

-- Nettle / Overflowing Cup (match)
update public.herbs_eden_patterns hep set benefit_note = 'Nettle provides minerals while supporting kidney elimination. For the Overflowing Cup with allergies, inflammatory conditions, or fluid retention, nettle helps the body release excess without depleting essential nutrients.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H042' and hep.derivation = 'curated';

-- Nettle / Spent Candle (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Nettle is one of the most deeply nourishing herbs available. Rich in iron, calcium, magnesium, and silica, it rebuilds depleted mineral stores, strengthens hair and nails, and restores blood quality. For the Spent Candle, nettle is foundational.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_spent_candle'
   and hep.herb_id = 'H042' and hep.derivation = 'curated';

-- Oregon Grape / Overflowing Cup (match)
update public.herbs_eden_patterns hep set benefit_note = 'Oregon Grape is specifically indicated for hot/damp conditions with skin involvement — acne, eczema, psoriasis with discharge. Its berberine content supports liver function and has antimicrobial action against the infections this type is prone to.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H044' and hep.derivation = 'curated';

-- Prickly Ash / Frozen Knot (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Prickly Ash powerfully moves blood and lymph, warms cold extremities, and breaks through the stagnation that defines the Frozen Knot. It is the herb that begins to untie the knot.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_frozen_knot'
   and hep.herb_id = 'H105' and hep.derivation = 'curated';

-- Raspberry Leaf / Open Flame (match)
update public.herbs_eden_patterns hep set benefit_note = 'Red Raspberry Leaf is a gentle astringent tonic that restores tone to smooth muscle throughout the body — not just the uterus. For the Open Flame with generalized tissue laxity, it builds structure and containment over time.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H048' and hep.derivation = 'curated';

-- Red Clover / Overflowing Cup (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Red Clover gently supports the body''s cleansing processes over time. It has a particular affinity for the lymphatic system and skin, making it well-suited for the Overflowing Cup with chronic weeping skin conditions or lymphatic congestion.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H049' and hep.derivation = 'curated';

-- Rose / Open Flame (match)
update public.herbs_eden_patterns hep set benefit_note = 'Rose cools heat and gently astringes lax tissues. It is particularly indicated for the Open Flame who gives too freely and needs to restore emotional and physical boundaries. Rose teaches containment with grace.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H052' and hep.derivation = 'curated';

-- Rose / Burning Bowstring (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Rose cools heat and soothes emotional inflammation. It is particularly indicated when tension manifests as emotional guardedness, grief held tight, or a heart that has hardened under stress. Rose opens and softens.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_burning_bowstring'
   and hep.herb_id = 'H052' and hep.derivation = 'curated';

-- Rosemary / Frozen Knot (match)
update public.herbs_eden_patterns hep set benefit_note = 'Rosemary warms and moves. It clears the mental fog and sluggish thinking common to the Frozen Knot, stimulates cerebral circulation, and lifts depressed spirits. It brings clarity to a system that has become murky.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_frozen_knot'
   and hep.herb_id = 'H053' and hep.derivation = 'curated';

-- Rosemary / Still Water (match)
update public.herbs_eden_patterns hep set benefit_note = 'Rosemary clears mental fog, stimulates cerebral circulation, and lifts the spirits. For the Still Water prone to sluggish thinking and low motivation, rosemary brings clarity and energy. It wakes up a mind that has settled into fog.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_still_water'
   and hep.herb_id = 'H053' and hep.derivation = 'curated';

-- Sage / Overflowing Cup (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Sage provides the drying and toning that the Overflowing Cup desperately needs. It reduces excessive sweating, tightens weeping tissues, and restores tone to a system that has lost its containment.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H054' and hep.derivation = 'curated';

-- Sage / Open Flame (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Sage is specifically indicated for excessive sweating and secretion — common in the Open Flame. It dries and tones where tissues are too open and leaking. It also sharpens a scattered mind.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H054' and hep.derivation = 'curated';

-- Shatavari / Spent Candle (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Shatavari is deeply moistening and nourishing for dry, depleted tissues. For the Spent Candle with dry mucous membranes, weak digestion, and exhausted reserves, shatavari is a foundational rebuilding herb.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_spent_candle'
   and hep.herb_id = 'H103' and hep.derivation = 'curated';

-- Witch Hazel / Open Flame (match)
update public.herbs_eden_patterns hep set benefit_note = 'Witch Hazel is the quintessential remedy for hot tissue laxity. It tones blood vessels, reduces inflammation, and restores integrity to tissues that have lost their structure. For the Open Flame with varicose veins, easy bruising, or hemorrhoids, it is foundational.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H067' and hep.derivation = 'curated';

-- Yarrow / Overflowing Cup (match)
update public.herbs_eden_patterns hep set benefit_note = 'Yarrow provides the astringency and tissue-toning that the Overflowing Cup needs. It tightens weeping tissues, reduces excessive discharge, and restores integrity where things have become too open.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_overflowing_cup'
   and hep.herb_id = 'H069' and hep.derivation = 'curated';

-- Yarrow / Open Flame (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Yarrow is cooling, drying, and toning — a perfect match for the Open Flame. It tightens lax tissues, reduces excessive bleeding or sweating, and moves blood where it has stagnated.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H069' and hep.derivation = 'curated';

-- Yellow Dock / Pressure Cooker (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Yellow Dock opens the bowel pathway for elimination. For the Pressure Cooker with constipation (tension blocking the bowels despite the damp pattern), yellow dock provides a gentle but persistent push toward resolution.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_pressure_cooker'
   and hep.herb_id = 'H070' and hep.derivation = 'curated';

-- Lemon Balm / Open Flame (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Lemon Balm cools without forcing. It opens the surface and lets heat leave rather than driving it inward, which is why it was given freely in fever for centuries and why it suits a body that burns hot. The old writers disagree about the plant itself, and both readings belong here. Gerard, following Avicenna, rates balm hot and dry in the second degree, which is a judgment about the herb''s own nature. The fever writers judged it instead by what it does once it is in you, and what it does is vent heat outward. Take it here for its action, not for its substance. The slackness in this pattern is held by the astringents in this list, witch hazel, raspberry leaf and rose, not by this herb.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_open_flame'
   and hep.herb_id = 'H032' and hep.derivation = 'curated';

-- Skullcap / Pressure Cooker (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Skullcap is the herb for the grip itself. The Pressure Cooker holds everything tight and keeps going, and skullcap releases that hold without sedating you or leaving the dull, flattened feeling some calming herbs do. It also rebuilds a nervous system that has been running over capacity too long, which is the state underneath the tension. Take it as the relaxant of this list. The cooling and the clearing are the work of the dandelion, cleavers, burdock and yellow dock alongside it.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_pressure_cooker'
   and hep.herb_id = 'H056' and hep.derivation = 'curated';

-- Shatavari / Drawn Bowstring (conditional)
update public.herbs_eden_patterns hep set benefit_note = 'Shatavari rebuilds without tightening. For the Drawn Bowstring, cold, dry and already gripped, it restores depleted reserves and moistens dry tissue at once, which is the combination this pattern needs. Where a drying tonic would pull the string tighter, shatavari softens as it nourishes. It is a cool herb, so it is not the one to lead with in a cold body: give it underneath something warming, in the warm vehicle it has always been prepared in.'
  from public.eden_patterns p
 where hep.pattern_id = p.pattern_id and p.slug = 'the_drawn_bowstring'
   and hep.herb_id = 'H103' and hep.derivation = 'curated';

commit;