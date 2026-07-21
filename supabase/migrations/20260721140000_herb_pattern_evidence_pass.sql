-- 20260721T140000_herb_pattern_evidence_pass.sql
--
-- Materia medica evidence pass: make the Apothecary's herb verdicts agree with
-- the curriculum, and make every surfaced verdict citable.
--
-- WHY
-- A reader with the Spent Candle pattern opened the Apothecary and found a red
-- AVOID banner on ginger and nettle -- the two herbs their own paid deep-dive
-- guide recommends most emphatically -- and no badge at all on hawthorn and
-- marshmallow, which it also recommends.
--
-- Root cause was NOT bad herb data. Two systems were independently deciding the
-- same clinical question: the guides reason from the clinically decisive axis
-- (measured across all 8 patterns they are perfectly self-consistent), while
-- the Apothecary card recomputed a verdict in the browser giving all three axes
-- an equal vote. Replaying the live algorithm against the curriculum's 80
-- recommendations: it endorsed 54 and contradicted 26, eleven of those with a
-- red AVOID on a herb the reader's own guide recommends.
--
-- WHAT THIS MIGRATION DOES
-- 1. Adds 'conditional' to the relationship check constraint. 45% of the
--    verified pairings (41 of 91) are supported BUT carry a stated condition --
--    a dose limit, a form preference (fresh vs dried), or a required pairing.
--    The tradition's standard answer to a remedy right on its main action but
--    wrong on a secondary quality was to ADD A CORRECTIVE, not to reject it
--    (Cook, Physio-Medical Dispensatory 1869: "the balancing of all intensely
--    stimulating and local remedies, by associating with them some of the
--    diffusive aromatics as adjuvants"). 'match' and 'avoid' both misrepresent
--    that; 'conditional' states it.
-- 2. Adds benefit_note (reader-facing "how this helps your pattern"),
--    condition_note (the condition, for conditional verdicts), and
--    primary_axis (which axis the herb is a therapeutic specialist on, derived
--    from how the sources CLASS it -- "stimulant" -> temperature, "demulcent"
--    -> moisture, "astringent/tonic" -> tone).
-- 3. Writes curated rows for the herbs whose citations passed an independent
--    integrity audit.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- It does not relax herbs_eden_patterns_check, which requires BOTH a primary
-- and a secondary citation before a row may be surfaced. That constraint is
-- Lock #43 compiled into the database and it is doing its job: of 44 researched
-- herbs only 21 clear both it and the citation audit. The other 23 stay
-- unsurfaced and fall back to the client's computed path -- which, as of the
-- accompanying src/lib/herbVerdict.ts, can never render a red "avoid". So the
-- reported bug is fixed for every herb regardless of curation coverage.
--
-- Idempotent: safe to re-run.


begin;

alter table public.herbs_eden_patterns
  drop constraint if exists herbs_eden_patterns_relationship_check;
alter table public.herbs_eden_patterns
  add constraint herbs_eden_patterns_relationship_check
  check (relationship = any (array['match','conditional','avoid','neutral']));

alter table public.herbs_eden_patterns
  add column if not exists benefit_note   text,
  add column if not exists condition_note text;

alter table public.herbs
  add column if not exists primary_axis text
  check (primary_axis is null or primary_axis = any (array['temperature','moisture','tone']));

update public.herbs set primary_axis = 'temperature' where common_name = 'Angelica';
update public.herbs set primary_axis = 'tone' where common_name = 'California Poppy';
update public.herbs set primary_axis = 'moisture' where common_name = 'Cleavers';
update public.herbs set primary_axis = 'tone' where common_name = 'Cramp Bark';
update public.herbs set primary_axis = 'tone' where common_name = 'Fennel';
update public.herbs set primary_axis = 'tone' where common_name = 'Gentian';
update public.herbs set primary_axis = 'temperature' where common_name = 'Holy Basil (Tulsi)';
update public.herbs set primary_axis = 'temperature' where common_name = 'Juniper Berry';
update public.herbs set primary_axis = 'tone' where common_name = 'Lemon Balm';
update public.herbs set primary_axis = 'tone' where common_name = 'Linden';
update public.herbs set primary_axis = 'moisture' where common_name = 'Marshmallow';
update public.herbs set primary_axis = 'tone' where common_name = 'Milk Thistle';
update public.herbs set primary_axis = 'tone' where common_name = 'Nettle';
update public.herbs set primary_axis = 'tone' where common_name = 'Oregon Grape';
update public.herbs set primary_axis = 'temperature' where common_name = 'Prickly Ash';
update public.herbs set primary_axis = 'tone' where common_name = 'Raspberry Leaf';
update public.herbs set primary_axis = 'moisture' where common_name = 'Red Clover';
update public.herbs set primary_axis = 'tone' where common_name = 'Rose';
update public.herbs set primary_axis = 'temperature' where common_name = 'Rosemary';
update public.herbs set primary_axis = 'tone' where common_name = 'Sage';
update public.herbs set primary_axis = 'moisture' where common_name = 'Shatavari';
update public.herbs set primary_axis = 'tone' where common_name = 'Skullcap';
update public.herbs set primary_axis = 'tone' where common_name = 'Witch Hazel';
update public.herbs set primary_axis = 'tone' where common_name = 'Yarrow';
update public.herbs set primary_axis = 'moisture' where common_name = 'Yellow Dock';

-- Angelica / Still Water -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H074', p.pattern_id, 'match', 'curated', 'Strongly supported on the two axes Angelica specializes in. Temperature: it is a warming aromatic stimulant (''glowing warmth'', Grieve; ''diffusively stimulating'', Cook) — it corrects the COLD. Moisture: it actively drains and disperses accumulated damp — carminative for wind/flatulence, diuretic for ''passive dropsy'' and ''diseases of the urinary organs'' (King''s), expectorant for cold, boggy ''chronic bronchitis'' (King''s, officinalis) — it corrects the DAMP. This maps almost exactly onto the app''s stored indications (Cold-Damp, Stagnation, Chronic cold respiratory). The RELAXED/atonic tone axis is served adequately but not perfectly: Angelica is partly relaxant (it releases gripping colic) yet is also classed ''tonic''/''stomachic'' and ''grateful to a feeble stomach'' (Grieve), so as a warming stimulant it revives atonic cold-damp function rather than astringing leaking tissue. Net: the curriculu', null, 'Practical refinement (not a downgrade): prefer dried root, the seed/fruit (strongest — Grieve), or garden angelica A. officinalis; avoid the fresh green root juice of A. atropurpurea, which Cook reports ''is said to be injurious.'' Also honor the two stated contraindications below (inflamed/hot states; diabetic tendency).', false
from public.eden_patterns p where p.slug = 'the_still_water'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- California Poppy / Burning Bowstring -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H005', p.pattern_id, 'conditional', 'curated', 'Two of three axes are correctly addressed, one is not, and the founder should know which is which. TENSE leg, SUPPORTED by primary PD sources and this is the strong part of the recommendation: a ''powerful soporific and analgesic'' (USD 1918) whose action vector is relaxation is precisely the corrective for a gripped, constricted state. The app''s own tissue_states_indicated (Tension, Spasm, Anxiety, Insomnia, Pain) map cleanly onto the sources'' classing, so the indication list and the classing agree. HOT leg, WEAKLY SUPPORTED: no PD source assigns this herb a temperature. The Cool value rests entirely on modern secondary classing plus my own inference from Boericke''s ''Slowing of circulation.'' It is probably right, but it is not primary-sourced, and the audit should record that. DRY leg, NOT ADDRESSED AND MILDLY ADVERSE: the same modern source the app appears to follow classes the herb as d', null, '1) Use the AERIAL PARTS, the part both the PD and modern sources actually use, not the root and not the seed pods. 2) Dose at the nervine/anxiolytic level for calming tension, NOT at the analgesic/hypnotic level; the USD''s escalation to 185 grains a day (Dujardin-Beaumetz) is a nineteenth-century sedative dose and is not a curriculum dose. 3) Because the dry leg is unaddressed, pair with a moistening demulcent whenever dryness is pronounced rather than giving California Poppy alone. 4) Short courses only, not standing daily use, given that the same sources reporting ''harmless'' also report resp', false
from public.eden_patterns p where p.slug = 'the_burning_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Cleavers / Overflowing Cup -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H010', p.pattern_id, 'match', 'curated', 'Two of three axes are directly and strongly served: Cleavers is refrigerant (cools the Hot) and a draining diuretic/alterative (drains the Damp). The empirical record confirms use in exactly the hot-damp-relaxed presentations of this pattern: weeping/leaking skin and lymphatic damp-heat. King''s 1898: ''useful in many cutaneous diseases, as psoriasis, eczema, lichen, cancer, and scrofula''; Grieve 1931 gives ''scurvy, scrofula, psoriasis and skin diseases.'' The one axis in tension is tone: the pattern is Relaxed/lax while Cleavers carries a mild relaxant (Cook) quality, so on paper it does not TONE lax tissue. In practice its relaxant action is a gentle soothing of irritated mucosa rather than a deep atony-inducing relaxation, and the dominant cool+drain vector addresses the pattern''s driving Heat and Damp, so the fit holds. Must be given as cold infusion or fresh juice (boiling destroys the', null, null, false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Cleavers / Pressure Cooker -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H010', p.pattern_id, 'match', 'curated', 'Strongest fit of the two, and arguably Cleavers'' single best-matching pattern: all three axes align. Refrigerant cools the Hot; diuretic/alterative drains the Damp; and Cook''s ''peculiarly soothing relaxant'' plus Felter''s indication for ''renal and cystic irritation with burning'' and Cook''s ''irritation at the neck of the bladder'' and ''all forms of scalding urine'' describe precisely a hot, damp, gripped/tense urinary state that a relaxant relieves. Felter''s Specific Indications, ''Dysuria and painful urination in febrile and inflammatory states; renal and cystic irritation with burning,'' read as a textbook Pressure-Cooker urinary picture. Give as cold/tepid infusion or fresh expressed juice, not a decoction.', null, null, false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Cramp Bark / Burning Bowstring -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H090', p.pattern_id, 'match', 'curated', 'The defining feature of this pattern is TENSE, and tension-release is precisely this herb''s specialty (''relaxing cramps and spasms of all kinds,'' King''s 1898). It adds no heat (not a stimulant), so it will not aggravate the Hot axis. The one caveat is moisture: the pattern is already Dry and the bark carries a faint astringent drying tendency, so the herb corrects the tension but does nothing to cool or moisten.', null, 'Slot it in as the tension-corrector, but pair with a cooling/moistening agent if heat and dryness are pronounced, since cramp bark itself neither cools nor moistens.', false
from public.eden_patterns p where p.slug = 'the_burning_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Cramp Bark / Frozen Knot -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H090', p.pattern_id, 'conditional', 'curated', 'Correct on the tone axis — the herb directly relaxes the tense ''knot'' (Felter: cramp-like contraction of hollow viscera and voluntary musculature). But this pattern is COLD, and the PD corpus assigns cramp bark NO warmth; it is thermally neutral at best. Used alone it releases the spasm while leaving the coldness unaddressed. Its faint astringency is mildly helpful against the Damp.', null, 'Recommend only when paired with a warming stimulant (e.g. ginger or a warm carminative) to supply the heat this pattern needs; cramp bark supplies the antispasmodic action, not the warmth.', false
from public.eden_patterns p where p.slug = 'the_frozen_knot'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Cramp Bark / Pressure Cooker -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H090', p.pattern_id, 'match', 'curated', 'The best fit of the three. The pattern''s danger is a tense lid over hot, damp pressure; cramp bark relaxes that constriction and lets the pressure vent, which is exactly its indication (''spasmodic contraction,'' ''bearing-down, expulsive pain''). It adds no heat (neutral temperature is an asset here) and its mild astringency slightly counters the Damp. Strong on tone, neutral-to-helpful on temperature and moisture.', null, null, false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Fennel / Still Water -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H016', p.pattern_id, 'conditional', 'curated', 'Two of three axes are supported and one is contradicted. SUPPORTED — temperature: Fennel warms (USD 1918, taste "warm, sweet, and agreeably aromatic"; King''s 1898 and Felter 1922 both class it "stimulant"), which is the right direction for a cold pattern. SUPPORTED — moisture: Fennel drains damp (King''s 1898, "diuretic, and diaphoretic"; Culpeper 1653, boiled with fish "for it consumes that phlegmatic humour"; "good to break wind, to provoke urine"), the right direction for a damp pattern. CONTRADICTED — tone: Still Water is already relaxed, lax and leaking, and Fennel is classed at the relaxant extreme of its class — Cook 1869, "They are among the most relaxing and least pungent of all the aromatics." There is no astringent or tonic language for Fennel anywhere in the PD corpus, so it cannot correct the atony and its own action pushes the tone axis the wrong way. Two further qualificati', null, 'Adjunct only, never the lead herb. Use the seed as infusion or powder at the historical dose (King''s 1898: powdered seed 10 to 30 grains; Felter 1922 Infusion: 1 fluidrachm for infants, 2 fluidounces for adults) — NOT the volatile oil, which concentrates the relaxant and secretory actions without adding any tone (King''s Oil of Fennel: "It is emmenagogue, and increases the lacteal secretions"). Pair with a tonic-astringent to hold tissue tone, since Fennel supplies none, and pair with a genuine warming stimulant if real thermal drive is needed. Culpeper 1653 notes a form distinction worth using', false
from public.eden_patterns p where p.slug = 'the_still_water'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Gentian / Overflowing Cup -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H096', p.pattern_id, 'conditional', 'curated', 'One axis of three is right, and the one that is wrong is guarded by an explicit contraindication. TONE — CORRECT. Overflowing Cup is relaxed/lax, and toning atonic digestive tissue is precisely what gentian is the specialist at: Cook, "gives firmness to the stomach, alvine canal, gall-ducts and uterus"; Felter''s specific indication, "atony of stomach and bowels, with imperfect digestion." TEMPERATURE — WRONG DIRECTION. Overflowing Cup is hot; gentian warms. King''s: it "gives more force to the circulation, and slightly elevates the heat of the body." Cook: "the stimulant quality predominating." MOISTURE — WRONG DIRECTION OR NEUTRAL. Overflowing Cup is damp; gentian does not dry, and the US Dispensatory 1918 records that it "markedly increased the gastric secretions." Nothing in the PD corpus classes it as a drainer. There IS real PD warrant for gentian in damp-relaxed GUT states specifica', null, 'Use only where ALL of the following hold. (1) The heat is low-grade and subacute, not active gastric irritability or inflammation — if there is burning, tenderness, or inflamed mucosa, the sources withdraw it outright. (2) The presenting picture is genuinely ATONIC digestion (poor appetite, sense of epigastric depression, weak digestive force), which is what gentian is for. (3) SMALL DOSES ONLY, at the low end of the PD range: King''s gives powder 10-30 grains, infusion 1-2 fluid ounces, tincture 1-2 fluid drachms, specific gentiana 5-40 drops. Cook warns that "Large doses, such as are too freq', false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Holy Basil (Tulsi) / Still Water -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H027', p.pattern_id, 'conditional', 'curated', 'Two of three axes are supported and one is not. TEMPERATURE and MOISTURE: strongly supported. Grieve 1931 classes O. tenuiflorum "an aromatic stimulant"; USDisp 1918 gives the genus "the ordinary properties of the aromatic plants"; Ayurvedic classing is Heating, Dry (ruksha), Light (laghu), Sharp (tikshna) and explicitly "Kapha-" - and Kapha IS cold/damp/heavy, which is Still Water almost verbatim. So as a warming, damp-draining, stagnation-moving agent for a cold sodden body, the recommendation holds. TONE: not supported, and this is the honest gap. Still Water is already relaxed/atonic/leaking. The only tone-axis classing in the whole corpus for any Ocimum is King''s 1898 "The oil is nervine and carminative" - a RELAXANT direction - and every modern action list adds antispasmodic, sedative, anxiolytic. Nothing in any source, PD or modern, calls Tulsi astringent or tonic-astringent. Tuls', null, 'Keep the Still Water recommendation ONLY as a temperature-and-moisture agent: dried leaf, hot infusion, taken warm, for the cold/damp/stagnant presentation (sodden lungs, boggy digestion, heavy sluggish mind). Do NOT let it carry the tone axis. If laxity, leaking, or atonic discharge is the leading sign, Tulsi must be paired with a true tonic-astringent as the corrective; it cannot supply that itself. Avoid the sedative-dose framing (large evening doses for stress/sleep) in Still Water, since that leans on the relaxant action and works against the pattern. Not for pregnancy or lactation at any', false
from public.eden_patterns p where p.slug = 'the_still_water'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Juniper Berry / Frozen Knot -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H106', p.pattern_id, 'conditional', 'curated', 'The curriculum is on solid ground here and I can support it on all three axes. COLD is met by the stimulant heat (Culpeper "hot in the third degree"; Felter "a gastric stimulant and a stimulating diuretic"). DAMP is met by the universal diuretic drainage. TENSE is met by Cook''s own classing — "a mild stimulant and relaxant" — and, more tellingly, by Cook''s indication picture: "answering an excellent purpose in all renal congestions, aching through the back and loins, catarrh of the bladder," which is a cold, congested, gripped presentation rather than a hot one. Marked conditional rather than match ONLY because the corpus''s flat prohibition rides close to this pattern: a Frozen Knot that has begun to heat and irritate crosses into territory Felter forbids absolutely. The knot must stay cold.', null, 'Use the BERRY as infusion or the fluid extract, not the volatile oil (Cook: the oil is "more stimulating" and "should not be employed in inflamed or even sensitive conditions"). Respect a hard dose ceiling — Felter: "No preparation of juniper should be given in doses larger than recommended above." Berries 1-2 drachms (King''s); infusion 2-4 fluidounces (Felter). Discontinue on any sign of urinary irritation, scanty urine, or blood. Not to be used if the presentation shows active inflammation, however cold the surrounding picture looks.', false
from public.eden_patterns p where p.slug = 'the_frozen_knot'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Lemon Balm / Burning Bowstring -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H032', p.pattern_id, 'conditional', 'curated', 'Two axes support it, one opposes. TENSE — strong, unambiguous match on the herb''s primary axis: King''s 1898 "antispasmodic"; Salmon 1710 "Neurotick... something Hysterick"; Cook 1869 "soothes the nerves"; Culpeper 1653 drives "troublesome cares and thoughts out of the mind." HOT — supported by action, not by substance. The herb is "hot and dry in the second degree" (Gerard 1633; Salmon 1710), but its diaphoretic action vents heat, and the fever use is attested four times over: Cook 1869 ("all classes of fever patients, in preference to cold water"), King''s 1898 ("febrile diseases"), Scudder 1898 ("febrile and inflammatory diseases"), Grieve 1931 ("cooling tea for feverish patients"). DRY — this is the genuine problem. Burning Bowstring is already dry, and lemon balm''s moisture action is drying in the only direction it goes: Cook 1869, "It slightly favors the flow of sweat and urine." Swe', null, 'Give as a copious warm WATER infusion, never as a concentrated aromatic. Grieve''s proportion is the citable one: "pour 1 pint of boiling water upon 1 oz. of herb, infuse 15 minutes, allow to cool, then strain and drink freely." King''s likewise specifies "a warm infusion, drank freely." The water in the vehicle is what offsets the drying action; at that dilution the fluid delivered exceeds the fluid the mild diaphoresis costs. AVOID the concentrated hot-dry forms in a dry pattern, which the PD sources themselves describe: Salmon''s herb "infused in Aqua Vitæ," and the London Dispensary 1696 "ess', false
from public.eden_patterns p where p.slug = 'the_burning_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Linden / Pressure Cooker -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H034', p.pattern_id, 'conditional', 'curated', 'One of three axes is well supported; the other two are not, and one may run the wrong way. TENSE — supported strongly. Linden''s documented specialty: King''s, "to allay irritation and restlessness, and to promote rest and sleep," and "restlessness, nervous headaches, painful and difficult digestion, and mild hysteria"; Grieve, "nervous vomiting or palpitation" plus use "against spasms." A Pressure Cooker patient''s gripped, wound-up presentation is exactly what these entries describe. HOT — NOT supported. No public-domain source in this corpus calls Tilia cooling. Gerard puts it at "a temperate heat"; King''s classes it "stimulant" and deploys the HOT infusion for "colds and catarrhal conditions" and "to check diarrhoea from cold"; Gerard''s flowers treat "pain of the head proceeding of a cold cause." Every temperature-bearing indication on record is a COLD-cause indication. Linden is theref', null, 'Use the FLOWERS only (not bark/leaves — Gerard classes those "somewhat drying and astringent," wrong tone direction for a tense pattern). Serve the infusion TEPID/COOLED, not hot: the hot infusion is the form the sources reserve for cold conditions and the form that drives heat outward. Standard strength on record: 30-40 grains of flowers to 1 pint water (King''s, 1898). Pair with a separately-justified cooling agent for the Hot axis and, if damp is prominent, a separately-justified drainer — linden supplies only the relaxant leg. Use fresh-season, well-stored flowers (see contraindications). T', false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Burning Bowstring -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'match', 'curated', 'Bullseye. Marshmallow corrects all three axes: it MOISTENS the dryness (core demulcent action), RELAXES the tension/spasm (emollient, no astringency), and SOOTHES the heat/inflammation (Felter: soothes ''irritated and inflamed mucous surfaces''; Cook: ''irritable coughs''). A hot, dry, gripped mucosa — dry irritable cough, hot spasmodic gut, scalding irritated bladder — is marshmallow''s ideal indication. Strongly supported.', null, null, false
from public.eden_patterns p where p.slug = 'the_burning_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Drawn Bowstring -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'conditional', 'curated', 'Two of three axes squarely corrected: MOISTENS the dryness and RELAXES the tension — marshmallow''s home ground. The gap is temperature: the pattern is COLD and marshmallow is thermally mild/near-neutral (Galenically ''moderately hot'' but functionally cooling on inflammation), so it does not supply warmth. Because it is not a strong cooler, it will not badly aggravate the cold, but it also will not resolve it.', null, 'Use for the dryness and tension components, but pair with a warming stimulant (e.g. ginger, cinnamon) to address the cold; marshmallow alone leaves the temperature axis untreated.', false
from public.eden_patterns p where p.slug = 'the_drawn_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Open Flame -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'conditional', 'curated', 'Corrects two axes well — MOISTENS the dryness/irritation and SOOTHES the heat (hot, dry, irritable relaxed mucosa such as a raw sore throat or irritated bladder is a classic eclectic use). BUT the tone axis is RELAXED/lax/leaking, and marshmallow is a relaxant ''unaccompanied by any astringency'' (Grieve), so it does not restore tone and can marginally deepen laxity. Its relaxation is soothing rather than strongly atony-inducing, so short-term demulcent use is defensible, but it is not a tone corrective here.', null, 'Good as a soothing demulcent for the heat and dryness; where laxity/leaking must be restored, pair with an astringent tonic (e.g. rose, agrimony, plantain). Do not rely on marshmallow to tighten lax tissue.', false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Spent Candle -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'conditional', 'curated', 'Weakest of the four recommendations — only ONE of three axes is corrected. Marshmallow MOISTENS the dryness and offers nutritive mucilage (historically ''food for the poor''), which suits a depleted state. But it does not warm the cold, and as a no-astringency relaxant it does nothing for — may slightly worsen — the lax tone. Justified purely on the moisture/nutritive axis, not on comprehensive pattern match.', null, 'Use only as moistening/nutritive support alongside warming and astringent-tonic herbs; not a standalone corrective for a cold, lax, depleted state.', false
from public.eden_patterns p where p.slug = 'the_spent_candle'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Frozen Knot -> avoid
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'avoid', 'curated', 'Caution is correct. Marshmallow ADDS damp (mucilage) to an already-damp pattern and supplies no warmth to the cold — it aggravates two of the three axes. It would relax the tension (the one helpful vector), but a cold, damp, congested tissue does not need more cold mucilage. The app''s own contraindication ''Excessive moisture conditions'' aligns with avoiding this pattern.', null, null, false
from public.eden_patterns p where p.slug = 'the_frozen_knot'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Overflowing Cup -> avoid
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'avoid', 'curated', 'Caution is correct. Marshmallow would soothe the heat (one helpful vector) but it ADDS damp to a damp state and further RELAXES an already lax, leaking tissue (Grieve: relaxing, no astringency). A hot, damp, atonic, over-secreting condition needs drying and toning, which is the opposite of marshmallow''s action.', null, null, false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Marshmallow / Still Water -> avoid
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H036', p.pattern_id, 'avoid', 'curated', 'Caution is correct and strongest here — marshmallow is wrong on all three axes. It adds damp to damp, supplies no warmth to the cold, and relaxes an already lax, boggy, stagnant tissue. This cold/damp/relaxed state is the single worst indication for a moistening relaxant demulcent.', null, null, false
from public.eden_patterns p where p.slug = 'the_still_water'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Milk Thistle / Overflowing Cup -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H038', p.pattern_id, 'match', 'curated', 'This is the pattern the PD corpus actually describes. Relaxed/atonic tissue plus damp congestion plus leaking is exactly Petersen''s "venous engorgement...venous stasis with veins enlarged" and "chronic liver and splenic troubles of a congestive nature," and King''s "Rademacher valued the seeds in hemorrhages associated with splenic or hepatic disorders." Ellingwood''s indication list — congestion of liver, spleen and kidneys, hemorrhoids, venous stasis, irregular uterine hemorrhages, gross varicosity — is a relaxed-and-overflowing picture throughout. The tonic-astringent direction of action moves the tissue the right way (tightening what has gone lax), and the decongestant effect addresses the damp/stagnation. The only unsupported leg is the Hot leg: no PD source establishes a temperature, so the herb is being used here for the moisture and tone legs, not the heat leg. Keep the recommendat', null, null, false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Milk Thistle / Pressure Cooker -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H038', p.pattern_id, 'conditional', 'curated', 'Half-supported, and the unsupported half is the tone axis — which is the axis this herb specializes in, so this is not a minor gap. SUPPORTING: the deobstruent/biliary tradition is real. Grieve, "It is in popular use in Germany for curing jaundice and kindred biliary derangements," and Ellingwood indicates it for periodic biliary lithiasis, gallstones, right-side stitching pain, and "Congestion of the liver, spleen and kidneys" — an obstructed, gripped, damp liver. AGAINST: not one source in the corpus classes milk thistle as antispasmodic, relaxant, nervine or carminative. Its documented action direction is to TIGHTEN lax vessels. Giving a tone-raising remedy as the lead herb in a genuinely tense, constricted presentation is pushing the tense axis further in the wrong direction. It also acts too slowly to answer an acute gripped state — Petersen, "Must be given a long time as it acts sl', null, 'Use ONLY as a secondary, slow-acting portal decongestant, paired with an explicit relaxant/antispasmodic corrective to carry the tense axis (the corrective must come from another herb — milk thistle supplies none). Restrict to the chronic congested-liver, jaundice and biliary-lithiasis presentation, not to acute spasm or colic. Use the SEED only, in the PD drop-dose tincture range (King''s 1–20 drops; Petersen 2–5 drops, 3–4x daily) or the modern seed extract, and expect weeks, not days. If the case is acutely tense, drop it from the formula and revisit once the tension is released.', false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Nettle / Overflowing Cup -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H042', p.pattern_id, 'match', 'curated', 'Nettle''s home pattern; the corpus describes it almost line by line. Relaxed/leaking tissue is met by the astringent-tonic classing every source gives it. Damp is met by the anti-secretory action: Felter 1922, "Profuse choleraic and excessive mucous discharges, as in cholera infantum and dysentery, are reputed to have been controlled by urtica," and King''s indications, "large mucous evacuations... copious watery and mucous passages." The hot/damp weeping skin picture is named directly: King''s "chronic eczematous eruptions," Felter "eczema of infants." Passive haemorrhage, the classic hot-damp-relaxed leak, is covered by Cook, "As a local arrester of bleeding, it has few equals." Only friction is temperature, since nettle is mildly stimulating rather than cooling, but the tone and moisture corrections dominate and the corpus applies it to inflamed weeping states regardless. Keep this recom', null, null, false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Nettle / Spent Candle -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H042', p.pattern_id, 'conditional', 'curated', 'Two axes of three support it, one opposes. Relaxed/atonic is met directly by the astringent-tonic classing (Cook: "a strong astringent, with moderately stimulating and tonic qualities"). Cold is mildly met by that same "moderately stimulating" quality. The depletion is met by the nutritive claim, though only the 1931 secondary carries it: Grieve, "the formic acid in the Nettle, with the phosphates and a trace of iron, which constitute it such a valuable food medicinally" — no Eclectic primary makes a trophorestorative claim. The problem is the DRY axis: nettle''s whole documented mechanism is restraint of secretion and outflow, so at astringent strength into an already dry, spent body it deepens the very dryness that defines the pattern. INFERENCE: the corpus''s own form distinctions supply the fix, since the astringency is attributed to the ROOT (Cook) while the nutritive value attaches t', null, 'Use the LEAF / young tops as a nutritive long infusion or as food, at food dose, NOT the ROOT at astringent medicinal dose (Cook root dose "from five to ten grains"; King''s "from 20 to 40 grains"). Pair with a demulcent or moistening agent to offset the drying vector. Do not run high-dose root or specific medicine for extended periods in this pattern.', false
from public.eden_patterns p where p.slug = 'the_spent_candle'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Nettle / Drawn Bowstring -> avoid
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H042', p.pattern_id, 'avoid', 'curated', 'THE EVIDENCE DOES NOT SUPPORT THIS RECOMMENDATION AND POINTS THE OTHER WAY ON TWO OF THREE AXES. The pattern is already dry and already tense. Nettle''s two best-attested actions are drying and tightening: it is classed as an astringent by every source retrieved (King''s "astringent, tonic"; Cook "a strong astringent"; Grieve "astringent properties"), with tannic and gallic acids named as the responsible constituents (Felter). Giving a tonic-astringent into constricted tissue tightens what is already gripped, and a secretion-restraining agent into a dry body desiccates it further. The only supporting axis is the mild warmth of "moderately stimulating," a weak argument for an herb whose principal identity is astringency. Nothing in the corpus indicates nettle for spasm, constriction, or griping — there is no antispasmodic, relaxant, or nervine classing anywhere in the retrieved sources. The', null, null, false
from public.eden_patterns p where p.slug = 'the_drawn_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Nettle / Pressure Cooker -> avoid
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H042', p.pattern_id, 'avoid', 'curated', 'THE EVIDENCE CONTRADICTS THIS RECOMMENDATION, and a source states the objection almost explicitly. Only one axis is served: the damp, which nettle''s anti-secretory action does drain. The other two run wrong. Tense is opposed by the astringent-tonic classing, which tightens tissue already gripped and under pressure. Hot is opposed by the stimulating quality — Cook "moderately stimulating," Grieve "a stimulating tonic," King''s fresh leaf that will "stimulate, inflame, and even raise blisters." Decisively, Cook 1869 rules the herb out of exactly this hot-tense-acute territory: "it is certainly an unsuitable article to use in febrile and acute nephritic difficulties." Where King''s and Felter DO apply nettle to inflamed tissue the indications are qualified as CHRONIC ("chronic eczematous eruptions," "Chronic cystitis"), a relaxed-boggy picture, not the acute gripped one. If the recommendation', null, null, false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Oregon Grape / Overflowing Cup -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H044', p.pattern_id, 'match', 'curated', 'Strong three-axis fit, well supported by the PD corpus. TONE: the herb is a ''peptic bitter and tonic'' (Felter) indicated precisely for the relaxed/lax pole — ''profusely secreting, tumid mucous tissues'' (King''s) and ''atonic dyspepsia'' — which it firms by ''controlling catarrhal outpouring and erosion of tissue'' (Felter). MOISTURE: it drains the damp (promotes excretion/secretion and elimination, augments renal and biliary flow), so its action-direction corrects the Damp pole. TEMPERATURE: traditional/modern energetics class it Cool-to-Cold, appropriate for the Hot pole (the PD sources do not state a degree, so this axis rests on traditional classing, not eclectic text). The app''s own tissue-state tag ''Damp-Heat... Sluggish liver'' maps cleanly onto Overflowing Cup, and ''hepatic torpor'' + ''yellow skin, with marked weakness'' (King''s) is a textbook damp-heat-with-atony picture. Verdict: curric', null, null, false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Prickly Ash / Frozen Knot -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H105', p.pattern_id, 'conditional', 'curated', 'Two of three axes fit cleanly. COLD: Prickly Ash is precisely the warming diffusive stimulant a cold pattern needs -- ''a warm glow throughout the system'' (Ellingwood 1919), ''warms the stomach'' (Felter 1922). DAMP/stasis: it moves congestion and stagnation -- ''overcoming blood stasis and congestion'' (Ellingwood), ''capillary engorgement... sluggish circulation... tympanites in bowel disorders'' (Felter). The TENSE axis is the weak link: the herb is documented over and over as a stimulant-TONIC for the OPPOSITE tone state -- ''lack of tone in the nervous system... relaxation of mucous membranes'' (Ellingwood), ''atonicity of the nervous system'' and ''relaxation of mucous tissues'' (King''s 1898). Its only claim on ''tense/gripped'' tissue is the berries'' carminative/antispasmodic action on cold cramping. So the recommendation is defensible but not clean: it warms and de-stagnates a Frozen Knot corre', null, 'Warranted specifically when the Tense presentation is cold, gas-distended, cramping/colicky -- use the BERRIES, which King''s (1898) classes as ''stimulant, carminative, and antispasmodic,'' for ''flatulent colic,'' ''tympanites,'' and ''uterine cramps'' (Felter 1922), in small-to-moderate doses. Not a substitute for a dedicated warming antispasmodic where tension/rigidity dominates and there is no atony; and withhold entirely if any heat/inflammation is present (Felter: ''should not be given in inflammatory conditions'').', false
from public.eden_patterns p where p.slug = 'the_frozen_knot'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Raspberry Leaf / Open Flame -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H048', p.pattern_id, 'match', 'curated', 'Supported. As an astringent, raspberry leaf''s specialty is exactly the RELAXED (lax, leaking, atonic) tone of this pattern. King''s 1898 indicates the leaf infusion for ''relaxed conditions of the intestines,'' ''passive hemorrhage from the stomach, bowels, or uterus,'' and ''colliquative diarrhoea'' — a hot, draining, atonic leak. Grieve 1931: it ''is a reliable remedy for extreme laxity of the bowels.'' Its cool-to-neutral temperature gently opposes the Hot leg. CAVEAT on the moisture leg: a DRYING astringent applied to an already-Dry tissue is the weakest fit; the herb''s drying/toning is most appropriate where the leak is frankly damp, which is why the unlisted Overflowing Cup (Hot/Damp/Relaxed) and Still Water (Cold/Damp/Relaxed) are equally or better supported. Net: the decisive tone leg and the sources'' explicit use for hot atonic leakage make Open Flame a genuine match.', null, null, false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Red Clover / Overflowing Cup -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H049', p.pattern_id, 'conditional', 'curated', 'Supported on TWO of three axes. Red clover is ''an excellent alterative'' (King''s 1898) and ''deobstruent ... in chronic skin diseases'' (Felter 1922) whose extract ''secures a good discharge'' (Cook 1869) — a depurative that drains hot, damp, boggy lymphatic and skin terrain, which is exactly the Hot+Damp face of Overflowing Cup. Heat-clearing fits the Hot component (by inference — no source states a temperature). BUT the third axis, Relaxed/lax tissue, is not addressed: the PD corpus classes red clover antispasmodic/soothing = a RELAXANT, with NO internal astringent or tonic action, so it does not correct laxity or leaking and could even relax an already-atonic tissue further. The recommendation is defensible for the alterative/damp-heat role, not for the tissue-tone dimension.', null, 'Use for the heat + damp + lymphatic-stagnation dimension of Overflowing Cup; because red clover is a relaxant and not a tonic-astringent, pair it with a toning/astringing herb wherever the tissue is frankly lax or leaking. Note the cooling action is inferred, not source-stated.', false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Rose / Open Flame -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H052', p.pattern_id, 'match', 'curated', 'Best-supported pattern. Rose cools the Hot axis (Culpeper/Grieve: ''cooling,'' refrigerant, ''against heat and inflammation'') and its astringent-tonic action directly addresses the Relaxed/lax/leaking axis: King''s — ''passive hemorrhages, and excessive mucous discharges... beneficial in bowel complaints''; Culpeper (in Grieve) — ''good against all kinds of fluxes... stops tickling coughs.'' Astringing a hot, lax, leaking surface is exactly the classical indication. The only friction is the Dry axis (rose is mildly drying, not moistening), so on a markedly parched tissue pair it with a demulcent — but the tone-and-temperature fit is squarely correct.', null, 'If the Dry axis is pronounced, pair with a demulcent/moistening herb, since rose contributes astringency (drying), not moisture.', false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Rose / Burning Bowstring -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H052', p.pattern_id, 'conditional', 'curated', 'Split verdict driven by actionDirection. Rose cools the Hot axis (supported) and its RELAXING-cordial action on the heart/nerves (''a very good cordial to strengthen the heart and spirit'') genuinely suits the gripped, grief-tense emotional picture the name evokes — this is why the curriculum reaches for it. BUT its TISSUE action is astringent/binding = tightening, which is counter to a Tense (already-constricted) tissue state, and it is mildly DRYING, counter to the Dry axis. So the sources support rose here only as a cooling emotional/nervous relaxant, not as a tissue astringent. The recommendation stands only in that narrow, conditional sense.', null, 'Use as a cooling nervine/cordial in small aromatic forms (hydrosol, glycerite, light infusion) for the emotional-tension and heat picture, and pair with a relaxant + a demulcent to offset rose''s tissue-tightening and drying tendency. Do NOT lean on it as a tissue astringent in a Tense/Dry state.', false
from public.eden_patterns p where p.slug = 'the_burning_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Rosemary / Frozen Knot -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H053', p.pattern_id, 'match', 'curated', 'Three-axis match. Rosemary is warm (corrects Cold — stimulant, all three sources), drying/dispersing (corrects Damp — diaphoretic + astringent), AND antispasmodic-relaxant (corrects Tense — Cook: ''stimulating and relaxing... antispasmodic in mild hysteria, painful menstruation''; King''s: ''antispasmodic''). Cook''s own indications map onto a cold-caused constriction: ''recent colds, recent suppression of the menses from exposure'' and ''painful menstruation'' are cold, gripped, cramping states — precisely a Frozen Knot. This is the strongest of the two curriculum picks; the corrective on all three axes is documented, not inferred.', null, null, false
from public.eden_patterns p where p.slug = 'the_frozen_knot'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Rosemary / Still Water -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H053', p.pattern_id, 'match', 'curated', 'Warm (corrects Cold) and drying (corrects Damp) as above. The Relaxed/atonic axis is met by the OTHER half of rosemary''s tone action: Grieve classes it ''Tonic, astringent'' (astringent tightens lax tissue; tannin per King''s), and Rosemary Wine is given for a weak, cold constitution ''for weak heart palpitations and dropsy'' (Grieve) — palpitation = atonic weakness, dropsy = watery/damp accumulation. A warming aromatic stimulant-tonic rousing a cold, sluggish, boggy, atonic state is a textbook Still Water remedy. Slightly softer than the Frozen Knot verdict because the best-documented internal uses (antispasmodic) point at Tense states, but the astringent-tonic + stimulant-to-torpor evidence genuinely covers the Relaxed axis. MATCH.', null, null, false
from public.eden_patterns p where p.slug = 'the_still_water'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Sage / Overflowing Cup -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H054', p.pattern_id, 'conditional', 'curated', 'Strongest of the two curriculum picks. Overflowing Cup is a hot, DAMP, RELAXED/leaking picture — excessive secretion and a lax weepy surface. Sage''s drying-astringent-tonic action addresses all of it: it drains the damp and firms the relaxed leak. Grieve uses it for the sweats of phthisis (a hot, wasting, sweating state): ''It will check excessive perspiration in phthisis cases''; King''s/Felter list ''colliquative sweating'' and ''excessive secretion''; Grieve calls it ''excellent for relaxed throat and tonsils'' and for the ''ulcerated throat'' gargle. The app''s stored tissue states (Damp excess, Excessive secretion, Tissue laxity, Hot flashes) map directly onto this pattern. Only caveat: sage''s own mild warmth runs with the pattern''s heat, but it is only ''feeble''/''moderately'' stimulant and the astringent-drying effect dominates.', null, 'Use the COLD/cool infusion (astringent, secretion- and sweat-restraining); the warm infusion is diaphoretic and would aggravate a hot, sweating patient. Moderate leaf-tea dose (King''s: infusion 2-4 fl oz; leaves 20-30 gr), NOT the essential oil.', false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Sage / Open Flame -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H054', p.pattern_id, 'conditional', 'curated', 'Partially supported and the weaker pick. The RELAXED (tone) axis matches sage''s core indication — ''skin soft and relaxed... restrain exhausting sweats'' (King''s), relaxed uvula/throat — and Grieve''s use in hot phthisis sweats supports a hot, leaking surface. BUT two frictions: (1) the pattern is already DRY, so sage''s drying corrects nothing here — its only real contribution is the tone (astringent restraint of the leak); (2) King''s explicitly flags REDUCED benefit for sweats ''preceded by hectic fever, and dry harsh skin'' — a hot + dry surface is exactly where sage is ''less likely to prove beneficial.'' Note too that sage''s textbook sweat picture is actually COLD, not hot: King''s specific indications say ''extremities COLD, and circulation enfeebled'' — i.e. Spent Candle (Cold/Dry/Relaxed) is sage''s cleaner energetic home, and its herb-warmth is a mild same-direction push against Open Flame''', null, 'Cold infusion only, and best where the RELAXED leak (night sweats, relaxed throat, hot flashes) dominates and the skin is still soft/relaxed rather than dry and harsh; if the surface has gone dry-harsh-hectic, King''s says expect less benefit — pair with a moistening/cooling corrective or prefer a demulcent-astringent.', false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Shatavari / Spent Candle -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H103', p.pattern_id, 'conditional', 'curated', 'Two of the three axes are strongly supported and precisely match the app''s own stored tissue states. Shatavari is the classical nourishing DEMULCENT RASAYANA for dryness and wasting: its sweet, unctuous, mucilaginous, tissue-building action directly corrects the DRYNESS and the depletion/ATROPHY/EXHAUSTION/DEFICIENCY of a spent, burnt-out constitution (Raj Nighantu 4.116-119: "sweet ... very good rasāyana"; mucilage constituent per Wikipedia). BUT the temperature axis crosses: Spent Candle is COLD and shatavari is COLD in potency (Raj Nighantu: "cold"). An unqualified cold, heavy, mucilaginous herb given to an already cold, low-vitality, low-digestive-fire person can deepen the chill, sit heavy, and dampen agni. So the recommendation is right on WHAT it rebuilds (dry, spent, atrophic tissue) but needs a temperature correction to be safe on a cold pattern.', null, 'Give in a WARMING vehicle / with a warming corrective so it moistens and rebuilds without adding cold: classically the dried root decocted in warm milk with ghee, or combined with warming carminatives (dried ginger, pippali/long pepper, cardamom, cinnamon). Prefer dried root over any cooling fresh-juice preparation. This offsets the śīta (cold) vīrya and protects weak digestion in the depleted Spent-Candle patient.', false
from public.eden_patterns p where p.slug = 'the_spent_candle'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Witch Hazel / Open Flame -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H067', p.pattern_id, 'match', 'curated', 'Well supported on two of three axes and on the dominant selector. The ''relaxed'' axis is a bullseye: witch hazel is THE astringent-tonic for atonic, lax, leaking tissue — King''s, ''conditions due to relaxation of venous structures''; Ellingwood, ''relaxed mucous membranes.'' The ''hot'' axis is met by its cooling/sedative, anti-inflammatory action — ''sedative'' (King''s, Grieve), ''inflamed swellings,'' ''sore throat with deep redness.'' The single weak axis is moisture: witch hazel''s action is DRYING, so it does not correct Open Flame''s dryness and could over-dry a depleted person if pushed internally. In practice this rarely bites, because a hot, relaxed tissue almost always presents with local weeping/discharge/passive bleeding, which the drying astringency is exactly right to staunch. Note also that the sources describe an even cleaner match at Hot/DAMP/Relaxed (Overflowing Cup), which the curric', null, 'Best as a topical/local astringent (compress, wash, suppository) or in short internal courses, on lax tissue that is actively leaking, weeping, or passively bleeding. Because the herb dries rather than moistens, in a markedly dry or depleted constitution pair it with or follow a demulcent/moistener and avoid prolonged tannin dosing. Choose the form for potency: bark/leaf decoction or tincture for full astringency; the distillate (''witch hazel water'') is gentler (little tannin, mainly cooling).', false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Yarrow / Overflowing Cup -> match
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H069', p.pattern_id, 'match', 'curated', 'Best fit of the two. Yarrow corrects TWO of the three axes directly: its astringent-tonic tightens the relaxed leaking tissue, and its astringent/diuretic/diaphoretic drying drains the excess damp and profuse discharge. Ellingwood''s picture is textbook Overflowing Cup: ''general relaxed conditions... leucorrhea, where there is a profuse discharge, or thick, heavy mucus from enfeebled mucous membranes,'' plus ''all forms of passive hemorrhage.'' King''s adds ''leucorrhoea with relaxed and irritated vaginal walls'' and ''menorrhagia'' — hot, damp, relaxed, over-secreting. The one axis it does not sedate is heat, but the warm diaphoretic/diuretic action vents that heat via sweat and urine, so the warmth is compatible rather than aggravating here.', null, null, false
from public.eden_patterns p where p.slug = 'the_overflowing_cup'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Yarrow / Open Flame -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H069', p.pattern_id, 'conditional', 'curated', 'The tone axis (the feature that distinguishes Open Flame from other hot patterns) is squarely addressed: yarrow''s astringent-tonic tightens the lax, atonic, leaking membrane and staunches passive hemorrhage (hematuria, small hemorrhages — King''s/Ellingwood), and its diaphoresis vents the heat. The friction is moisture: yarrow ACTS drying (astringent + diuretic + diaphoretic) and Open Flame is already dry, so unqualified use can deepen the dryness even while it fixes the relaxation. Appropriate where a hot, lax membrane is still leaking blood or thin discharge; needs a moisture guardrail otherwise.', null, 'Prefer the COLD infusion (maximizes tonic-astringent tightening, minimizes further fluid-driving diaphoresis), and pair with a demulcent/moistening corrective (e.g. marshmallow) when dryness is pronounced. Reserve the hot diaphoretic prep for when venting heat matters more than conserving fluid.', false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Yellow Dock / Pressure Cooker -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H070', p.pattern_id, 'conditional', 'curated', 'Two of the three axes fit: yellow dock is cool (suits Hot) and is a decided alterative/depurant/detergent that DRAINS damp (suits Damp) — ''decidedly alterative, tonic, mildly astringent, and detergent'' (King''s 1898); ''renal depurant and general alterative'' (Ellingwood 1919). But the third axis is wrong-signed. Pressure Cooker is a TENSE, constricted tissue state, and yellow dock is a tissue-TIGHTENER (mildly astringent + tonic) with NO relaxant/antispasmodic action. Its documented tissue affinity is the opposite pole — LAX, atonic tissue: ''low deposits in glands and cellular tissues, and tendency to indolent ulcers; feeble recuperative power ... hypersecretion'' (King''s 1898), and it is used to CHECK ''exhaustive morning diarrhea'' (Ellingwood 1919). So on the evidence its damp/RELAXED homes (Overflowing Cup, Still Water) are the true fit, and it addresses only the temperature and moisture ', null, 'Use only as a SECONDARY blood-purifying / damp-draining adjunct inside a formula whose lead herb is a relaxant or antispasmodic that actually releases the tension. Not appropriate as a stand-alone for Pressure Cooker; keep the dose in the alterative range (specific rumex, fraction of a drop to 30 drops — King''s 1898), since heavier astringent dosing could aggravate a gripped, constricted tissue.', false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Lemon Balm / Open Flame -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H032', p.pattern_id, 'conditional', 'curated', 'REVISED FROM ''avoid'' AFTER THE GUIDE CLAIM WAS NARROWED. The research verdict of avoid rested entirely on the tone axis: lemon balm''s best-attested action is relaxation (King''s ''antispasmodic''; Cook ''soothes the nerves''; Salmon ''Neurotick''), and the Open Flame is already lax, so a relaxant pushes the failing axis further. No public-domain source classes Melissa officinalis as astringent or tonic, so there is no counterweight. That finding stands and is not softened. What changed is the claim: the guide entry no longer presents lemon balm as doing tone work, and now directs the reader to the roster''s astringents (witch hazel, raspberry leaf, rose) for the laxity. On the axis it IS claimed for, the evidence is strong: Cook 1869 says it ''may be used without hesitation by all classes of fever patients, in preference to cold water'', King''s 1898 calls it ''serviceable as a diaphoretic in febril', null, 'Take it as the cooling herb only. It relaxes tissue tone, and this pattern is already lax, so it should not be leaned on for the slackness, the leaking, or the loss of tissue hold. Pair it with the astringents in this pattern''s kit (witch hazel, raspberry leaf, rose) which supply the tone lemon balm does not.', false
from public.eden_patterns p where p.slug = 'the_open_flame'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Skullcap / Pressure Cooker -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H056', p.pattern_id, 'conditional', 'curated', 'Tone is the decisive axis and skullcap opposes the pattern''s tense pole on it, with four independent primary sources classing it as a relaxant: King''s 1898 ''Scullcap is tonic, nervine, and antispasmodic''; Cook 1869 ''equally relaxant and stimulant; antispasmodic''; Felter 1922 ''calmative to the nervous and muscular systems''; Ellingwood 1919 files it under minor nerve sedatives. Damp is opposed too, by a dry substance plus documented drainage through skin and kidneys (Ellingwood: ''stimulates the skin and kidneys to increased activity''). TEMPERATURE IS NOT CLAIMED: a dedicated three-search pass over 68 pre-1929 works found NO source assigning Scutellaria lateriflora any temperature, and the silence is deliberate rather than a gap (Lyle uses warming/cooling language freely elsewhere in the same volume; Schoepf 1787 leaves the quality field blank; Cook places it at the neutral midpoint). Skull', null, 'Suits tension carried over a long stretch with depletion underneath, not acute inflammatory heat: Cook 1869 indicates it where trouble is ''due to feebleness with agitation, but not connected with acute or sub-acute inflammatory excitement.'' Freshness is decisive: King''s 1898 warns ''The drug loses its properties largely when dried, and by age becomes inert; hence the many failures in therapy from the use of scutellaria.'' Use fresh-plant tincture or recently dried herb within the season, and never simmer it.', false
from public.eden_patterns p where p.slug = 'the_pressure_cooker'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

-- Shatavari / Drawn Bowstring -> conditional
insert into public.herbs_eden_patterns
  (herb_id, pattern_id, relationship, derivation, rationale, benefit_note, condition_note, surfaced)
select 'H103', p.pattern_id, 'conditional', 'curated', 'Moisture is the decisive axis and shatavari opposes the pattern''s dry pole strongly, classed demulcent in every public-domain source located across 1877-1926 (Dutt 1877; Watt 1889; Dymock 1893; Nadkarni 1926), and demulcent in both substance and effect rather than only one. Tone is opposed too, though mildly: Watt and Nadkarni both class it antispasmodic, and its most-documented preparation is an oil rubbed into stiff necks and aching joints. THE COST IS REAL AND NOT SOFTENED: temperature REINFORCES the pattern''s cold pole, with Dutt ''cooling'', Watt ''refrigerant'', Dymock ''heavy and cold'', and Sushruta calling the cooling a potency rather than merely a quality. What makes this conditional rather than avoid is that the same tradition which calls it cold also assigns it to the wind-subduing group, wind being the cold, dry, gripping principle, and resolves the tension with a warming correcti', null, 'Never the lead or sole herb in a frankly cold pattern, and never as a cold-water infusion or plain cold powder. Give it underneath a warming lead herb and in the warm fatty vehicle the sources actually specify: the attested preparation, Satavari ghrita (Dutt 1877; Dymock 1893), is simmered in ghee and milk and given with long pepper, which is the warming corrective and is not optional to the formula. Modern equivalent: root simmered in whole milk or taken in ghee, with a warming spice.', false
from public.eden_patterns p where p.slug = 'the_drawn_bowstring'
on conflict (herb_id, pattern_id) do update set
  relationship = excluded.relationship, derivation = 'curated',
  rationale = excluded.rationale, condition_note = excluded.condition_note;

update public.herbs_eden_patterns set surfaced = true
 where derivation = 'curated' and primary_citation is not null and secondary_citation is not null;

commit;