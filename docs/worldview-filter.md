# The worldview filter

**Founder ruling, 2026-07-22, restating Lock #14 and Lock #44 as an operating test:**

> We take all of the observations and diagnoses, the things that these different frameworks got
> right, and we use that. We discard any kind of spiritual attribution. Everything is filtered
> through a Biblical worldview. We take the good and discard the stuff that does not align.
> **That is the hardest lock of the entire thing.**

This document exists because a research pass in July 2026 nearly shipped two additions that fail
this test, and neither was caught by the person doing the work. It was caught by the founder
asking whether the work conflicted with the lock at all.

---

## The test

For any claim from any tradition, ask:

> **Does this describe what the body or the herb is DOING, or does it make a claim about where
> life comes from, or about what humans ultimately are for?**

The first is an observation. Take it. The second is a spiritual attribution. Discard it.

`HerbCard.tsx` already states this correctly in code: the app honours each tradition's
pattern-observation while "explicitly NOT carrying forward its spiritual attribution of vital
force (qi-as-cosmic, prana-as-Brahman, the Tao as ground of being)." Per Lock #14, the source of
vital force is named plainly as the Holy Spirit.

**Discarding the attribution is not discarding the source.** We keep saying where an observation
came from. Li Shizhen observed something in 1596 and we cite him for it. What we do not do is
adopt his cosmology because we found his pharmacology useful.

---

## Worked examples

These are real cases from the July 2026 pass. They are here because the general rule is easy to
agree with and hard to apply.

### PASSES — observation, take it

| Claim | Why it passes |
|---|---|
| Rehmannia takes nine steamings and nine sun-dryings, and must never contact copper or iron | Technique. Describes a procedure and its consequence. |
| Red willow root resembles Manjistha; taken by mistake it causes 内障眼 (cataract), checked with licorice water | Adulterant observation with a named harm and a named remedy. |
| Fang Feng 殺附子毒, it reduces aconite's toxicity | A claim about what happens in a pot. Empirical, testable. |
| Dong Quai 极善滑腸，瀉者禁用, extremely apt to loosen the bowels, forbidden in diarrhoea | A clinical prohibition based on an observed effect. |
| 畏 / 惡 / 反 drug relations, including the 十八反 | Co-use observations accumulated over centuries. |
| Bupleurum acts on liver, gallbladder and digestion | Site of action. Already held in `system_affinity`. |
| Astragalus is sweet | Taste. |

### FAILS — spiritual attribution, discard it

| Claim | Why it fails |
|---|---|
| 久服輕身延年, prolonged use lightens the body and extends years | 輕身 is Daoist immortality-cultivation vocabulary. This is a claim about transcendence through substances, not about health. |
| The three grades as 養命 / 養性 / 治病, nourishing destiny / nourishing nature / treating disease | The top tier is explicitly about cultivating one's allotted destiny. That is a claim about what humans are for. |
| 入手足太隂氣分, enters the Hand and Foot Taiyin at the qi division | Asserts that qi travels in named channels. The content IS the model; strip the metaphysics and nothing observational remains that `system_affinity` does not already hold. |
| Any herb framed as extending life, conferring longevity, or lightening the body | Directly Lock #14. |

### The hard middle

**Toxicity and duration classification survives; its framing does not.**

The Shennong Bencao Jing sorts drugs into three grades. The *framing* is transcendence
(久服輕身延年). But underneath sits a real observation: after centuries of use, some plants were
found non-toxic and safe to take for long periods, and others were found toxic and reserved for
acute attack. **That observation is exactly the kind this brand exists to recover.** It is kept,
under a name that describes what it observes, with the source cited and the soteriology dropped.

**Pattern labels survive.** TCM and Ayurvedic pattern names are permitted by Lock #44 as
observational labels, and are already in the table (`tcm_pattern_match`,
`ayurvedic_dosha_match`). They describe what the body is doing. They are not permitted to become
claims about life-source.

---

## Applied: what this changed

**`channel_entry` was dropped before it shipped.** Proposed as the most distinctive addition in
the whole harvest. On inspection its observational half is redundant with `system_affinity`
(astragalus 入手足太隂 says Lung and Spleen; `system_affinity` already reads "Immune,
Cardiovascular, Lungs, Spleen"), and its remainder is the meridian model itself. Where a classical
source names a site of action the database is missing, it belongs in `system_affinity`, not in a
new column carrying the framework with it.

**`shennong_grade` became `traditional_use_duration`.** Same underlying classification, renamed
for what it observes, with values that state duration and toxicity rather than rank. The Shennong
provenance stays in the column comment: this is a historical observation about how the oldest
Chinese pharmacopoeia classified these plants, not an endorsement of why it classified them that
way.

**Everything else in the harvest passes.** Preparation doctrine, adulterant warnings, drug
incompatibilities, positive pairings, dietary avoidances and clinical contraindications are all
observational.

---

## Standing rule for anyone adding cross-tradition material

1. Write down the claim in the source's own words.
2. Ask what it would take for the claim to be TRUE. If the answer requires a cosmology, it fails.
   If it requires only that plants and bodies behave a certain way, it passes.
3. If a claim is observational but arrives wrapped in framing, **keep the observation, drop the
   wrapper, and keep the citation.**
4. If the observation is already in the table under a Biblically neutral name, do not add a second
   column that reintroduces the framework.
5. When in doubt, ask the founder. This lock is the hardest one, and the failure mode is not
   malice, it is enthusiasm. Rich material is persuasive, and the persuasion is the risk.
