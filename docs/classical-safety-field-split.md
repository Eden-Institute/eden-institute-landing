# Splitting the classical safety field: what it found

The herb table has ONE `classical_contraindications` field. The verified classical text destined
for it turned out to be **bundled**, mixing four different things that a Chinese source keeps
carefully apart.

Two runs: `wf_fd30e75e-53c` (flawed, see "my two errors" below) and `wf_829d13b1-b84` (corrected).
Data: `safety_field_decomposition_v2.json`.

---

## The headline: only about a third of it was ever a contraindication

Of 294 classified clauses:

| Bucket | Count | Share | What it is |
|---|---|---|---|
| **Clinical contraindications** | 108 | 37% | Real patient-state prohibitions: 瀉者禁用, 孕婦忌之, 腸滑氣虚者禁之 |
| **Drug incompatibilities** | 83 | 28% | The negative 七情: 畏 fears, 惡 antagonised by, 反 opposes (the 十八反) |
| **Positive pairings** | **79** | **27%** | 使 envoy, 殺 neutralises toxicity, 勝 subdues, 解毒 resolves a toxin |
| **Dietary avoidances** | 24 | 8% | Tang and Song food lore: 忌鯉魚, 忌桃李菘菜雀肉青魚 |

Plus 118 clauses parked as unclassified rather than guessed at.

**79 positive pairings were sitting in a field labelled "contraindications".** Fang Feng's
殺附子毒 means it makes aconite *safer*. Coptis's 解巴豆毒 means it *resolves* croton poison. Gua
Lou's 枸杞為使 means goji is its guiding partner. Rendered from a contraindications field, every
one of those reads as "do not combine", which is the exact opposite of what the source says.

That is the argument for the split, and it is the most valuable thing this pass produced. Envoy
and toxicity-neutralising relations are formulation knowledge with no Western equivalent, and they
were one migration away from being shown to customers as warnings.

---

## My two errors in the first run, and what they cost

Both were setup mistakes, not source problems. Recording them because they are the kind that
recur.

**1. I batched by claim instead of by herb.** Thirteen herbs had more than one verified record.
My `feed[i::N]` split sent *every single one* of them to different agents, so no agent could see
both halves and none could merge. That dropped Cornelian Cherry's three-item prohibition including
**月事過多** (excessive menstruation), which is precisely the item an earlier adjudication had
warned about losing. Also lost Perilla's part-specific prohibitions (leaf versus seed) and Bitter
Sophora's three.

**2. I put 殺 in the incompatibility relation enum.** 相殺 means the herb neutralises another
drug's toxicity. It is protective. By listing it as a kind of incompatibility I invited the agents
to file positive relations as warnings, and they did. The agents followed the schema correctly;
the schema was wrong.

Fixing both: blockers went 4 → 0, problems 28 → 18, all 13 multi-record herbs merged, and
positive pairings recovered went 41 → 79.

---

## ⚠ NEEDS A HERBALIST'S RULING: three pregnancy signals

This is the one item I will not decide.

Three herbs carry a 墮胎 clause, and **the two passes disagree about what it means**:

| Herb | Clause | Source |
|---|---|---|
| H139 Kudzu | 「生者墮胎」 | 陳藏器, in BCGM |
| H253 Job's Tears | 「杀蛔堕胎」 | 王昂, 本草備要 1694 |
| H271 Corydalis | 「通經堕胎」 | |

The **verified harvest** graded all three as contraindications. The **decomposition** parked them
as unclassified, direction-uncertain, because 墮胎 in a 主治 (indications) run means a condition
being *treated*, not an effect being *caused*.

That distinction is exactly the one that produced the Bakuchi error, where 墮胎 in a 主治 field was
read as "causes miscarriage" when it meant "treats". So the caution is well founded. But the
consequence is that **a pregnancy signal currently reaches no safety field at all.**

Two real caveats the decomposition raised: the Job's Tears text survives only in simplified glyphs,
suggesting a modern digital intermediary; and the BCGM assigns 墮胎 to the Job's Tears **root**,
not the seed that is sold.

**Neither reading should be loaded until you rule.** Getting this wrong in either direction is bad:
a false pregnancy warning on a safe herb, or a missing one on an unsafe herb.

---

## Eight herbs needing a targeted fix before load

| Herb | Issue |
|---|---|
| **H274 Gastrodia** | The Lei Xiao co-use prohibition 「凡使天麻勿用御風草…若同用令人有腸結之患」 was moved OUT to unclassified. The auditor calls it the most safety-load-bearing item on the row. |
| **H206 Manjistha** | The BCGM adulterant warning is missing from all five buckets: red willow root looks identical, and taking it by mistake 「令人患内障眼」, causes cataract, to be checked at once with licorice water. A stated 勿用 with a named harm. |
| **H283 Trichosanthes** | Composite quotes tagged with one relation verb. 枸杞為使 (goji is its envoy) sits inside the incompatibility bucket, and the reciprocal aconite entry was imported wholesale, bringing four substances that are *aconite's* antagonists into Trichosanthes' list. |
| **H142 Huang Qin** | Not fixed from run 1. A corrupt 畏 glyph transcribed as 辰 is still absorbed into a drug name, producing 「辰丹砂」 as though it were a substance, and collapsing 畏 relations into 惡. |
| **H214 Bitter Sophora** | 伏**水** should be 伏**汞**, subdues mercury. The glyph corruption is inherited from the upstream harvest string, so that needs correcting too, not just the re-filing. |
| **H281 Siler** | 「畏萆。」 is the 1757 transcription truncating 萆薢. As filed it names no real substance. |
| **H002 Astragalus** | A 附方-scoped line restricting *cooling drugs* inside one formula is filed as a herb-level contraindication. |
| **H215 Codonopsis** | A whole passage filed as a contraindication when only one span within it is one. |

---

## What this means for the schema

The single field should become **four**, and PR #331's `classical_contraindications` column is only
one of them:

- `classical_contraindications` — clinical, 108 items
- `drug_incompatibilities` — the negative 七情, 83 items, with the relation verb preserved
- `positive_pairings` — envoy and antidote relations, 79 items, **must never render as a warning**
- `dietary_avoidances` — 24 items, labelled so they do not read as medical advice

The relation verb has to travel with each incompatibility. 畏 and 惡 and 反 are not
interchangeable, and 反 in particular marks the 十八反, the most serious pairings in the corpus.

**Nothing loaded. Nothing written to production.**

---

## Update 2026-07-22: the eight named defects, resolved

All eight were resolved against the sources. 40 corrected entries, and **48 emendations flagged
rather than silently applied**, which is the discipline that matters most here.

The Huang Qin case is the model. Four witnesses collated across 1596 to 1799 (Bencao Gangmu,
Sun Xingyan 1799, Ben Cao Bei Yao 1694, Ben Cao Cong Xin 1757). The corrupt 辰 glyph is read as a
misplaced 畏, which the 1799 七情表 attests positively rather than by conjecture: 「黃芩　山茱萸，
龍骨為使；惡蔥實；畏丹砂、牡丹、藜蘆。」 The alternative hypothesis was recorded too, that 辰 is an
intruded gloss on 辰砂, a real synonym for cinnabar. **That alternative is exactly why the live bug
mattered:** 「辰丹砂」 reads to a customer as a plausible substance rather than as obvious garble.

A third defect surfaced that was not in the brief: the stored Huang Qin string had dropped the
使 clause entirely, so the database was missing both envoy relations.

### The final check found two defects that are the SCHEMA's fault, not the research's

**H283 Trichosanthes.** A reciprocal relation, 「秦椒　惡栝蔞、防葵」, is filed in
`drug_incompatibilities` while its own annotation says the entry lives on Qin Jiao's row and must
not be restated as 栝蔞惡秦椒. The prose forbids what the field assignment causes. Anything reading
that field surfaces a warning no classical witness states. **Reciprocal relations need a direction
flag, or their own field.**

**H206 Manjistha.** The cataract adulterant warning was filed under `not_this_herb`, which
elsewhere in the same batch means "import error, remove". Same field, two contradictory intended
actions. A loader would have **deleted a real safety warning with a named harm and a named
antidote**. Fixed by adding an `adulterant_warnings` column, which also gives a home to the
commercial fraud notes (dealers selling mixed roots as "combined chaihu"; alfalfa root faked as
astragalus, 能令人瘦, which makes people thin, the opposite of the intended effect).

**H215 Codonopsis was never delivered.** Seven of eight blocks came back. The verifier caught the
gap rather than papering over it, and separately confirmed that a pre-1900 source does exist
(党參 has its own 本草從新 1757 entry), so the row *could* be sourced legally. It remains
unverified, not cleared.

Two smaller items: the aconite-group expansion on H283 (附子/天雄/川烏/草烏) is standard 十八反
doctrine but is inference beyond what the four witnesses say, and should be labelled as inferred;
and 御風草 on H274 ships with no botanical identity, so the co-use prohibition cannot be acted on.

**Verdict: not loadable as filed, but the failures are schema problems and cheap.** H142, H214,
H281 and H002 are clean as they stand.
