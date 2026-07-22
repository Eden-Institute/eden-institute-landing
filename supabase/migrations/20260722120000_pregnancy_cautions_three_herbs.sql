-- Three pregnancy cautions, scoped per herb. Founder ruling 2026-07-22.
--
-- These are the first values written to classical_contraindications. The rest of
-- the decomposed safety data is still held back over defects; these three go in
-- ahead of it because they are a pregnancy signal and because the founder ruled
-- specifically on them.
--
-- ── THE PROBLEM THEY RESOLVE ────────────────────────────────────────────────
-- Three herbs carry a 墮胎 clause, and two research passes disagreed about what
-- it means. Read as an effect it is a miscarriage warning. Read inside a 主治
-- (indications) run it is a condition being TREATED, not caused. That exact
-- ambiguity already produced one error on this project: Bakuchi's 墮胎 sits in a
-- 主治 field and was misread as "causes miscarriage" when it means "treats",
-- which would have shipped a pregnancy warning inverting its own source.
--
-- So the caution here is real and the scoping matters. The founder ruled:
-- treat as a caution, scoped per herb. Asymmetric cost, a false warning being
-- cheaper than a missed one, but not applied indiscriminately.
--
-- ── ONE CORRECTION TO THE SCOPING AS ORIGINALLY PUT ─────────────────────────
-- The founder was told Job's Tears should be scoped to the ROOT and not the
-- seed, on the strength of the Bencao Gangmu. Fuller reading shows that is only
-- half true, and the row records both claims rather than the simpler one:
--   * BCGM (1596) 卷二十三, under 根 (root): 「煮服墮胎」, boiled and taken it
--     causes abortion. Well attested, and the root is NOT the article sold.
--   * 本草備要 (1694) assigns it to 薏苡仁, the SEED, which IS the article sold:
--     「殺蛔墮胎」. But the only reachable text is a simplified-character
--     transcription, not confirmed against a woodblock scan.
-- Recording both, with the evidence quality of each stated, is more honest than
-- scoping to the root alone.
--
-- ── SOURCES, ALL PRE-1900 AND INDEPENDENTLY VERIFIED ────────────────────────
-- Each line below was re-read at the source by a verifier who did not produce
-- it. Attributions were checked: 藏器 is Chen Cangqi, 宗奭 is Kou Zongshi.

begin;

-- Kudzu / Ge Gen. The 生者 qualifier is load-bearing: it limits the claim to the
-- RAW root. The same sentence goes on to say the STEAMED form dispels wine
-- toxin, so the source itself distinguishes the two preparations.
update public.herbs
   set classical_contraindications =
'PREGNANCY, RAW FORM ONLY. 陳藏器, in 本草綱目 (1596) 卷18上 主治: 「生者墮胎」 — the RAW root causes abortion. The qualifier 生者 is part of the claim: the same sentence continues 「蒸食消酒毒」, steamed and eaten it dispels wine toxin, so the source distinguishes the preparations. Avoid raw kudzu in pregnancy; the cooked and starch forms are not covered by this line.

ALSO STATED CLASSICALLY. 張元素, same entry: 「升陽生津，脾虚作渴者非此不除，勿多用，恐傷胃氣」 — do not use in quantity, it may injure stomach qi. 朱震亨: 「凡㿀痘已見紅㸃，不可用葛根升麻湯，恐表虚反増㿀爛」 — not once pox eruptions show red points. 吳儀洛, 本草從新 (1757) 卷五: 「上盛下虛之人，雖有脾胃病，亦不宜服；即當用者，亦宜少用，多則反傷胃氣，以其升散太過也。（夏月表虛汗多、尤忌。）」 — unsuitable where the upper body is replete and the lower vacuous, and especially to be avoided in summer with copious spontaneous sweating.'
 where herb_id = 'H139';

-- Job's Tears / Coix. Two claims, two plant parts, two evidence qualities. Both
-- recorded rather than collapsed.
update public.herbs
   set classical_contraindications =
'PREGNANCY. Two claims, on two different parts, with different evidence behind them. Both are recorded rather than merged.

ROOT, well attested: 本草綱目 (1596) 卷二十三, under 根: 「煮服墮胎」 — boiled and taken, it causes abortion. Note the root is not the article normally sold.

SEED, one witness only: 本草備要 (汪昂, 1694), 薏苡仁: 「殺蛔墮胎」 — kills roundworm and causes abortion. This is the seed, which IS the article sold, but the only reachable text is a simplified-character transcription that has not been confirmed against a woodblock scan. Treat as a genuine caution of lesser evidentiary weight, not as equivalent to the root claim.

ALSO STATED CLASSICALLY. 吳儀洛, 本草從新 (1757) 卷十二: 「大便燥結，因寒筋急，勿用」 — not in dry constipation, nor in sinew tension arising from cold. 寇宗奭, in 本草綱目 卷二十三 發明, records the same cold-tension exclusion from the 本經; 汪昂 in 本草備要 explicitly disputes it: 「《衍義》云∶因寒筋急者不可用，恐不然」. The disagreement is genuine and is left standing.'
 where herb_id = 'H253';

-- Corydalis / Yan Hu Suo. The richest of the three, and the one whose row most
-- needs it: it is currently presented as a general analgesic.
update public.herbs
   set classical_contraindications =
'PREGNANCY AND BLOOD-DEFICIENCY STATES. 吳儀洛, 本草從新 (1757), 延胡索, verbatim and contiguous: 「爲活血利氣之藥。然辛溫走而不守。通經堕胎。瘀滞有餘者宜之。生用破血，炒用調血。經事先期，虚而崩漏，產後虚晕，均忌之。」

It moves blood and frees qi, but being acrid and warm it travels without holding. It opens the menses and causes abortion. It suits repletion with stasis. Raw it breaks blood, stir-fried it regulates blood.

FORBIDDEN in all of: menses arriving early, vacuity flooding and spotting, and postpartum dizziness from vacuity. Together with the abortion clause this is a substantive exclusion set for a herb otherwise presented as a general analgesic.'
 where herb_id = 'H271';

commit;
