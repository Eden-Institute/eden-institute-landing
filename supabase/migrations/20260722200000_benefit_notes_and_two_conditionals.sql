-- Tell the reader why a recommended herb suits their pattern: the last 43 rows,
-- plus two founder rulings and two worldview rewrites.
--
-- BACKGROUND
-- The curated bridge shipped with 66 of 109 positive pairings carrying a
-- reader-facing benefit_note. The other 43 rendered their badge and fell back to
-- `rationale`, which is INTERNAL authoring prose: pipe-delimited classifier notes,
-- the literal string "constitution-data.ts", and two rows describing herbs in
-- qi/shen language the worldview filter forbids. PR #338 stopped that fallback
-- rendering, so those 43 currently show a badge with no explanation. This fills them.
--
-- HOW THE COPY WAS PRODUCED
-- Eight agents drafted from production row data (taste, temperature, moisture,
-- tissue_states_indicated, system_affinity, chief_complaints, energetics_summary),
-- then independent verifiers re-read every draft against the same rows with
-- instructions to refute rather than confirm. That pass rejected five:
--   * Rhodiola x Drawn Bowstring   "lifting both energy and mood"  -> worldview breach
--   * Plantain x Burning Bowstring "itching" bites                 -> not in the row
--   * Raspberry Leaf x Spent Candle "long-trusted affinity"        -> invented tradition
--   * Corn Silk x Overflowing Cup  "through the kidneys"           -> affinity is urinary
--   * Bugleweed x Burning Bowstring "wound too tight"              -> misreads as injury
-- The corrected text is what ships below. Founder approved the full set 2026-07-22.
--
-- Every note is 2-3 sentences, carries no em dash (Lock #27), never argues against
-- its own match, and translates framework vocabulary (Wei Qi, Jing, Yang deficiency,
-- Vata, wind-heat) into observational language per the worldview filter.

begin;

-- ---------------------------------------------------------------------------
-- 1. The 42 straightforward benefit notes.
--    Guarded on derivation='curated' AND benefit_note IS NULL so a re-run cannot
--    overwrite founder-authored prose that landed in the meantime.
-- ---------------------------------------------------------------------------
update public.herbs_eden_patterns hp
set benefit_note = v.note
from (
  values
  -- The Burning Bowstring (hot, dry, tense)
  ('H085','the_burning_bowstring',$$Bugleweed cools heat and settles a nervous system wound up too tight, with a particular affinity for the racing heart. For the Burning Bowstring with palpitations, a fast pulse, and anxiety that keeps the heart pounding, bugleweed quiets the pace and eases the strain behind it. It is especially suited where a mildly overactive thyroid drives the whole system too fast.$$),
  ('H045','the_burning_bowstring',$$Passionflower cools and calms an overactive mind, releasing the loop of thought that will not let the body rest. For the Burning Bowstring with racing thoughts, sleeplessness, and muscles held tight by worry, passionflower eases the tension and quiets the way into sleep.$$),
  ('H047','the_burning_bowstring',$$Plantain cools inflamed tissue and lends moisture back where heat has dried and irritated the surface. For the Burning Bowstring with an irritated cough, urinary irritation, or insect bites and slow-healing skin, plantain soothes what is inflamed and supports the tissue as it mends.$$),
  ('H056','the_burning_bowstring',$$Skullcap cools and steadies a nervous system that is both overexcited and worn thin from running hot. For the Burning Bowstring with anxiety, muscle spasm or nervous twitching, and sleepless nights, skullcap releases the held tension and helps the body settle into rest.$$),
  ('H057','the_burning_bowstring',$$Slippery elm moistens and soothes linings that have grown dry, inflamed, and irritated. For the Burning Bowstring with a raw sore throat, a dry cough, or heartburn and an irritated gut, slippery elm quiets the irritation and supports the tissue as it mends.$$),

  -- The Drawn Bowstring (cold, dry, tense)
  ('H002','the_drawn_bowstring',$$Astragalus warms gently and rebuilds strength where long depletion has left the body's defenses low. For the Drawn Bowstring with frequent illness, lingering fatigue, or wounds slow to heal, astragalus supplies steady warmth and supports the immune reserves over time.$$),
  ('H100','the_drawn_bowstring',$$Bacopa warms and steadies a nervous system worn thin by strain, calming the mind even as it rebuilds. For the Drawn Bowstring with poor memory, anxiety, or nervous exhaustion, bacopa supports clear thinking and helps settle a mind that runs tight and tired.$$),
  ('H077','the_drawn_bowstring',$$Betony brings mild warmth while it releases the tension that gathers in the head, neck, and jaw. For the Drawn Bowstring with tension headaches, nervous exhaustion, or anxiety that settles as fullness in the head, betony eases the grip and steadies the nerves.$$),
  ('H007','the_drawn_bowstring',$$Chamomile relaxes what is held tight, softening spasm in the gut and settling an irritable, overwrought nervous system. For the Drawn Bowstring with digestive cramping, anxiety, or sleepless nights, chamomile helps unwind the tension at the center of the pattern.$$),
  ('H015','the_drawn_bowstring',$$Evening primrose moistens and nourishes tissues that have grown dry and depleted, with particular kindness toward the skin and nerves. For the Drawn Bowstring with dry skin, eczema, or monthly hormonal complaints, evening primrose helps restore softness and ease where dryness has taken hold.$$),
  ('H032','the_drawn_bowstring',$$Lemon balm calms a restless, anxious nervous system and gently settles the digestion. For the Drawn Bowstring with anxiety, sleepless nights, or digestive spasm, lemon balm eases the inner strain so both mind and stomach can come to rest.$$),
  ('H050','the_drawn_bowstring',$$Reishi warms and steadies at once, rebuilding deep reserves in a system that is exhausted yet cannot rest. For the Drawn Bowstring with chronic fatigue and sleep that will not come, reishi supports the immune system and helps calm restless depletion over time.$$),
  -- Corrected: "lifting both energy and mood" breached the worldview filter.
  ('H051','the_drawn_bowstring',$$Rhodiola restores stamina to a system run down by prolonged strain, lifting the mood as it rebuilds. For the Drawn Bowstring with fatigue, low spirits, or focus that fails under pressure, rhodiola supports steady resilience where stress has worn the reserves thin.$$),
  ('H055','the_drawn_bowstring',$$Schisandra warms the core and helps the body hold what it tends to lose, conserving moisture and strength alike. For the Drawn Bowstring with adrenal fatigue, night sweats, or a chronic cough, schisandra rebuilds depleted reserves while its sour, gathering taste keeps them from draining away.$$),
  ('H057','the_drawn_bowstring',$$Slippery elm coats and moistens dry, irritated tissue, bringing relief where the inner linings have lost their protective moisture. For the Drawn Bowstring with sore throat, dry cough, or an easily irritated gut, slippery elm soothes and softens without adding any chill.$$),
  ('H066','the_drawn_bowstring',$$Wild yam releases cramping and spasm while its moistening quality softens tissues left dry and taut. For the Drawn Bowstring with intestinal cramps, uterine spasm, or arthritic aches, wild yam helps unclench what the pattern has wound tight.$$),

  -- The Frozen Knot (cold, damp, tense)
  ('H074','the_frozen_knot',$$Angelica is warming and drying, well suited to a system that has grown cold, damp, and slow. For the Frozen Knot with chilly digestion, colic, sluggish circulation, or a lingering cold settled in the chest, angelica rekindles inner warmth and helps move what has stalled.$$),
  ('H009','the_frozen_knot',$$Cinnamon warms the core, dries lingering damp, and carries circulation out to hands and feet that run cold. For the Frozen Knot with cold digestion, chilly extremities, or the damp overgrowth that settles into a cool, sluggish system, cinnamon restores warmth from the center outward.$$),

  -- The Open Flame (hot, dry, lax)
  ('H007','the_open_flame',$$Chamomile cools heat and settles irritation in both the gut and the nerves. For the Open Flame with an irritable bowel, inflamed skin, or sleep that will not come, chamomile quiets the flare and eases the whole system toward rest.$$),
  ('H013','the_open_flame',$$Elder cools fevers and brings moisture where heat has parched the tissues, supporting the body's defenses at the first sign of illness. For the Open Flame whose colds come on hot and fast, with fever, sinus congestion, or skin eruptions, elder helps the heat break and resolve cleanly.$$),
  ('H047','the_open_flame',$$Plantain cools hot, irritated tissue and lends moisture where inflammation has left things raw. For the Open Flame with a hot cough, urinary irritation, or skin that is bitten, scraped, and slow to heal, plantain soothes the surface and helps the tissue mend.$$),
  ('H057','the_open_flame',$$Slippery elm coats and moistens raw, inflamed passages from the throat down through the gut. For the Open Flame with heartburn, a raw sore throat, or a dry hacking cough, slippery elm lays down a soothing layer that eases irritation and lets hot, dry tissue recover.$$),

  -- The Overflowing Cup (hot, damp, lax)
  ('H084','the_overflowing_cup',$$Boswellia is bitter, astringent, and drying, suited to hot, damp inflammation that has settled into the joints and gut. For the Overflowing Cup with inflamed, aching joints or chronic inflammatory pain, boswellia helps dry the excess and move the stagnation so the tissue can settle.$$),
  -- Corrected: stored affinity is urinary, not renal.
  ('H089','the_overflowing_cup',$$Corn silk cools heat and gently drains excess water while soothing the irritated passages of the urinary tract. For the Overflowing Cup with bladder irritation, uncomfortable urination, or urinary gravel, corn silk helps clear the excess and calm the inflamed tissue.$$),
  ('H029','the_overflowing_cup',$$Horsetail dries excess dampness and tones tissue that has grown lax and weak, with a particular affinity for the urinary tract and connective tissue. For the Overflowing Cup with urinary irritation, tissue laxity, or weak hair, nails, and skin, horsetail helps flush the excess while rebuilding tone and strength.$$),
  -- NOTE: this row's stored energetics_summary reads "matches dryness" while its
  -- moisture value is Moist. The copy grounds on the reliable fields and leads with
  -- cooling, the only rebalancing axis. The summary defect is logged, not fixed here.
  ('H047','the_overflowing_cup',$$Plantain cools heat and soothes inflamed, irritated tissue wherever damp and heat have collected, from the airways to the skin to the urinary tract. For the Overflowing Cup with a lingering cough, urinary irritation, or slow-healing skin, plantain helps quiet the inflammation and support the tissue back to health.$$),
  ('H048','the_overflowing_cup',$$Raspberry leaf is cooling, drying, and astringent, toning tissue that has grown lax. For the Overflowing Cup with lax uterine tissue, painful cycles, or loose digestion, raspberry leaf helps firm what has slackened and restore healthy tone.$$),
  -- NOTE: thyme is stored Warm and indicated for COLD-damp, yet curated onto this
  -- HOT-damp pattern; the pairing rests on the drying axis alone. Copy leads with
  -- drying and never mentions warmth. Founder retained the match 2026-07-22.
  ('H059','the_overflowing_cup',$$Thyme dries dampness and clears congestion, especially where excess moisture has settled into the lungs and sinuses and invited infection. For the Overflowing Cup with a wet cough, sinus congestion, or a stubborn digestive infection, thyme helps dry the excess and clear what has taken hold.$$),

  -- The Pressure Cooker (hot, damp, tense)
  ('H039','the_pressure_cooker',$$Motherwort cools and settles a heart driven to race under pressure, its bitterness calming both pulse and mind. For the Pressure Cooker with palpitations, anxiety, or tension held in the chest and womb, motherwort steadies the heartbeat and helps the whole frame unclench.$$),
  ('H066','the_pressure_cooker',$$Wild yam cools and relaxes muscle that has clenched into spasm, easing the grip of an overwrought gut and womb. For the Pressure Cooker with intestinal cramps, uterine spasm, or colicky digestive pain, wild yam unwinds the knot so tension can finally pass.$$),
  ('H069','the_pressure_cooker',$$Yarrow moves what has stalled, opening circulation to the skin so trapped heat can vent, while its drying, astringent nature firms tissue that damp has left congested. For the Pressure Cooker with heavy menstruation, congested veins, or heat that builds with no way out, yarrow releases the pressure and tones what has gone slack.$$),

  -- The Spent Candle (cold, dry, depleted)
  ('H009','the_spent_candle',$$Cinnamon warms the core, stirs sluggish digestion, and carries warmth out to cold hands and feet. For the Spent Candle running cold with weak digestion and chilled extremities, cinnamon rekindles the warmth the pattern has lost.$$),
  ('H035','the_spent_candle',$$Lion's Mane slowly feeds and rebuilds worn nervous tissue without pushing the system either hot or cold. For the Spent Candle with flagging memory, low mood, and nerves thinned by long depletion, lion's mane supports steady repair over time.$$),
  -- Corrected: "long-trusted affinity" asserted a tradition no stored field carries.
  ('H048','the_spent_candle',$$Raspberry Leaf gently tones and firms tissue that has grown slack, with a particular affinity for the womb. For the Spent Candle with loose digestion, painful cycles, or a body preparing for birth, raspberry leaf lends strength where the tissues have let go.$$),
  ('H053','the_spent_candle',$$Rosemary warms and enlivens a system that has gone cold and slow, moving blood to the head and limbs and sharpening dull thinking. For the Spent Candle with poor circulation, cold digestion, and low spirits, rosemary restores warmth and movement.$$),
  ('H057','the_spent_candle',$$Slippery Elm is as much a food as a remedy, coating dry, irritated tissue and offering gentle nourishment to a depleted system. For the Spent Candle with a dry cough, a raw throat, or an irritated stomach and bowels, slippery elm moistens and soothes what has run dry.$$),

  -- The Still Water (cold, damp, sluggish)
  ('H093','the_still_water',$$Elecampane warms and gently dries the lungs, loosening the cold, damp phlegm that settles in a sluggish chest. For the Still Water with a lingering cough and copious mucus, elecampane helps clear the congestion and keep it moving.$$),
  ('H096','the_still_water',$$Gentian is intensely bitter, and that bitterness rouses a cold, sluggish digestion, waking the appetite and stirring the stomach's own juices. For the Still Water whose meals sit heavy and whose appetite has gone flat, gentian helps restore tone to the digestion so food is properly broken down and absorbed.$$),
  ('H023','the_still_water',$$Goldenrod dries and tones tissues that have grown boggy and lax, helping the kidneys flush what has been standing still. For the Still Water with urinary complaints or congested sinuses, goldenrod eases the dampness and firms the tissue so the waters move as they should.$$),
  ('H026','the_still_water',$$Hawthorn gently warms and strengthens a heart that has grown weak, coaxing cold, sluggish circulation back into motion. For the Still Water with a tired heart, palpitations, or an anxious, fluttery chest, hawthorn supports steady heart function over time.$$),
  ('H029','the_still_water',$$Horsetail is a drying, toning herb that helps the body drain standing water while firming tissues that have grown lax. For the Still Water with urinary complaints, weak hair and nails, or slow-healing skin, horsetail helps restore tone and strength where dampness has left things soft.$$),
  ('H054','the_still_water',$$Sage warms a cold constitution while drying and toning tissues that secrete more than they should. For the Still Water with excessive sweating or a persistent sore throat, sage helps check the flow and firm what has grown lax.$$)
) as v(herb_id, slug, note)
join public.eden_patterns p on p.slug = v.slug
where hp.herb_id = v.herb_id
  and hp.pattern_id = p.pattern_id
  and hp.derivation = 'curated'
  and hp.benefit_note is null;

-- ---------------------------------------------------------------------------
-- 2. FOUNDER RULING: Rhodiola x The Spent Candle, match -> conditional.
--
--    The curated layer called this a plain match while the Spent Candle guide's
--    cautionHerbs list says: "Strong stimulating adaptogens (Ginseng, Rhodiola) in
--    early recovery - May be too activating. Start with gentler adaptogens first."
--    Two systems contradicting each other on the same herb. The conditional state
--    exists precisely for "right herb, wrong moment"; this is that case.
-- ---------------------------------------------------------------------------
update public.herbs_eden_patterns hp
set relationship  = 'conditional',
    benefit_note  = $$Rhodiola helps a body worn down by long stress rebuild its stamina and steadiness. For the Spent Candle with deep fatigue, low mood, and focus that fades under strain, rhodiola supports the slow return of endurance and resilience.$$,
    condition_note = $$Hold off in early recovery; when reserves are at their lowest, rhodiola can be too activating, so begin with gentler restoratives (ashwagandha is this pattern's lead). Introduce it at a low dose once reserves begin to return, and step back if it leaves you racing, wired, or sleepless.$$
from public.eden_patterns p
where p.pattern_id = hp.pattern_id
  and p.slug = 'the_spent_candle'
  and hp.herb_id = 'H051'
  and hp.derivation = 'curated';

-- ---------------------------------------------------------------------------
-- 3. FOUNDER RULING: Ginger x The Spent Candle becomes a curated conditional.
--
--    This is the pairing that started the whole rebuild. A reader's paid guide calls
--    ginger "the spark that begins to re-light the candle"; the Apothecary held only
--    a COMPUTED avoid row, which PR #332's resolver downgrades to silence. Harm gone,
--    guidance still absent, and the two systems still disagreeing.
--
--    This is an UPDATE, not an INSERT: a (H019, EP06) row already exists under the
--    unique constraint. It already carries the same King's 1898 + WHO 1999 citations
--    as ginger's other curated rows, so Lock #43 stays satisfied without touching them.
--
--    benefit_note is the founder's own guide prose (guide-content-spent-candle.ts),
--    restructured only to replace the em dash per Lock #27.
-- ---------------------------------------------------------------------------
update public.herbs_eden_patterns hp
set relationship   = 'conditional',
    derivation     = 'curated',
    benefit_note   = $$Ginger provides the gentle warmth the Spent Candle needs to restart digestive function and circulation. It is the spark that begins to re-light the candle. Not a bonfire, but a match.$$,
    condition_note = $$Use moderately, at a low dose and for a short course; too much can be overstimulating for a deeply depleted system. Ginger is warming but also drying, and this pattern already runs dry, so pair it with a moistening demulcent (marshmallow or licorice, both on this pattern's roster); ginger supplies the spark, not the moisture.$$,
    rationale      = $$Founder ruling 2026-07-22: the Spent Candle guide recommends ginger outright ("the spark that begins to re-light the candle"), while this row held a computed avoid. Curated as CONDITIONAL rather than match because the guide's own safety line limits dose and duration, and because ginger is drying against an already-dry pattern, which is exactly the corrective-not-rejection case the conditional state was built for.$$
from public.eden_patterns p
where p.pattern_id = hp.pattern_id
  and p.slug = 'the_spent_candle'
  and hp.herb_id = 'H019';

-- ---------------------------------------------------------------------------
-- 4. WORLDVIEW FILTER applied to our own internal records.
--
--    These two rationales are never reader-facing (PR #338 stopped rationale from
--    rendering), but the hardest lock governs what we write down, not only what we
--    ship. The observation is kept; the spiritual attribution is discarded. The axis
--    notation after the pipe is preserved verbatim.
-- ---------------------------------------------------------------------------
update public.herbs_eden_patterns hp
set rationale = $$Curation review: Astragalus is a warm, moistening, deep restorative tonic for depleted reserves; it builds strength and protective resilience, opposes this terrain's cold and dryness, and nourishes the depletion driving the tension. Classically indicated for a cold, depleted constitution, not neutral. | temperature: herb hot rebalances the pattern's cold; moisture: neutral; tone: herb action (tense-ward) reinforces the pattern's tense$$
from public.eden_patterns p
where p.pattern_id = hp.pattern_id
  and p.slug = 'the_drawn_bowstring'
  and hp.herb_id = 'H002'
  and hp.rationale like '%Qi tonic%';

update public.herbs_eden_patterns hp
set rationale = $$Curation review: Reishi is a warming adaptogen and calming restorative for an exhausted, agitated nervous system, classically indicated for burned-out cold/dry/tense depletion; its calming action opposes the tense excess (mis-scored as tonic-aggravates-tense), so it rebalances: match, not neutral. | temperature: herb hot rebalances the pattern's cold; moisture: neutral; tone: herb action (tense-ward) reinforces the pattern's tense$$
from public.eden_patterns p
where p.pattern_id = hp.pattern_id
  and p.slug = 'the_drawn_bowstring'
  and hp.herb_id = 'H050'
  and hp.rationale like '%Shen-tonic%';

commit;
