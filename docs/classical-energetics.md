> ## ⚠ READ `docs/worldview-filter.md` FIRST
>
> Everything here is filtered through Lock #14 + Lock #44: take the observations these
> frameworks got right, discard the spiritual attribution. Two proposed columns did not
> survive that test, and they were the two this research pass was most enthusiastic about.
> **`channel_entry` was dropped** (its observational half is already in `system_affinity`;
> the remainder is the meridian model itself). **`shennong_grade` became
> `traditional_use_duration`**, keeping the toxicity-and-duration observation and discarding
> the 久服輕身延年 life-extension framing.

# Classical energetics: what the pre-1900 sources carry, and what we do with it

Companion to migration `20260721180000_classical_energetics_columns.sql`, which adds the
columns but populates none of them.

## The two rules these columns live under

**1. Pre-1900 sources only.** Energetics claims cite works published **1899 or earlier**.
Modern works may support safety, constituents and pharmacology; they may not support a
temperature, taste or potency assignment. Founder ruling, 2026-07-21.

**2. Classical sources corroborate, disambiguate or add. They never override.** Where an old
source contradicts a clear modern value, the disagreement is **recorded in the record, not
applied to it**. These columns exist to hold the "add" case cleanly, so that adding classical
knowledge never means overwriting the modern energetics the app matches on.

## What is loaded, and what is held

A QC pass over 95 herbs harvested **743 candidate facts** from pre-1900 sources
(`docs/data/classical-energetics-harvest-2026-07-21.json`). Rather than load them, the three
highest-priority fields went through an **independent verification pass**: 254 claims re-read
at the source by ten verifiers who did not produce them, each in an isolated working directory
so that no agent could confirm a sibling's downloaded file.

**Result: zero refuted at claim level, no invented quotation found.** Every Chinese quotation
checked was a real substring of the named work, in the named juan, under a named authority.
32 of 254 (12.6%) came back partly verified, meaning the substance held but a detail was off.

| Field | Verified | Partly | Loaded? |
|---|---|---|---|
| `traditional_use_duration` | 72 | 1 | **Yes, 70 of them** |
| `classical_contraindications` | 80 | 16 | No |
| `channel_entry` | 70 | 15 | **DROPPED, fails the worldview filter** |

**Only `traditional_use_duration` is loaded** (`20260721190000_load_traditional_use_duration.sql`). It is
the field whose values rest on an objective test rather than a quotation: which juan the entry
falls in, or the 本經X品 note in the 1596 head line. Most were confirmed by both routes.

### Why the other two are held

Adjudication of the partly-verified set found four kinds of defect that a naive load would ship,
and they are worth naming because each is a different failure:

1. **An indication read as an adverse effect.** H296 Bakuchi: the harvest read 墮胎 in the 主治
   (indications) field as meaning the herb *causes* miscarriage. It is a condition being
   *treated*. That would have printed a pregnancy-safety warning that inverts its own source.
   The most dangerous item in the batch.
2. **An author credited with a doctrine he rejected.** H184 Fu Ling: 白補赤瀉 was attributed to
   Zhang Yuansu, but the 1596 text records him saying 赤瀉白補上古無此説, that the distinction has
   no ancient warrant. He disputes it.
3. **A wrong drug in an incompatibility list.** H184 again: the 畏 list ends 鱉甲 (turtle shell)
   where the source reads 龜甲 (tortoise plastron). Different material, and this field would
   drive formula-blocking logic.
4. **Content filed under the wrong tag.** H160 Green Tea, H284 Water Plantain and H175 Chen Pi
   each have the *grade* paragraph pasted under a contraindications tag. The pasted text is
   true, which is exactly why it is dangerous: a reviewer sees verified classical Chinese and
   waves it through, and the database ends up telling a customer that a contraindication for
   Chen Pi is that it is an upper-grade herb suitable for long life.

Also surfaced, and escalated out of this workstream: **H238 Shankhpushpi's botanical identity is
unsupported.** No pre-1900 source identifies it as *Convolvulus pluricaulis*; the string
"pluricaulis" does not appear in any volume of Pharmacographia Indica. That is a
what-plant-is-in-the-bottle problem, not an energetics one.

### A distinction to make before contraindications load

Several verified entries are **dietary avoidances** from a Tang or Song dietetic tradition
(忌桃李菘菜雀肉青魚, 忌鯉魚, 忌芸薹, avoid eel), not pattern-level prohibitions. Every one checks
out verbatim. But putting them in the same field as 孕婦忌之 flattens a real distinction and
will read to a customer as a medical warning. They need their own field or their own label.

And three neighbouring-entry bleeds were caught: the 三稜 caution belongs to San Leng and not to
Musta, which sits immediately after it in the same juan; the 芝 prohibitions belong to Ganoderma
and not to Turkey Tail; a 有痼疾人勿服 line near Goji attaches elsewhere.

## What was found, by kind

Rates are from the fifteen herbs documented row by row; the reach column is an extrapolation
and is labelled as one.

| Addition | Found in | Rough reach across 300 |
|---|---|---|
| Preparation doctrine | 13-14 of 15 | most herbs with any classical entry |
| Use-duration class (incl. informative absence) | 11 of 15 | every herb with a Chinese entry |
| Contraindications | 10 of 15 | two thirds of herbs with a classical entry |
| ~~Channel entry~~ DROPPED | 8 full, 3 partial of 15 | fails the worldview filter; observational half already in `system_affinity` |
| Incompatibility and envoy pairs | 8 of 15 | Chinese-tradition herbs only |
| Adulteration or fraud warning | 5 of 15 | a third, concentrated in commercial roots |
| Provenance-dependent action | 4 of 15 | a quarter |
| Guna | 2 of 4 Ayurvedic | Ayurvedic subset only |
| **Vipaka** | **0 of 4 Ayurvedic** | **zero without a Sanskrit source** |

### Use-duration class, the one that earns its column

The classical grade encodes intended **duration** of use, which is the question a daily-herb
product asks every day. The observation is kept; the 久服輕身延年 life-extension framing is not.

| Herb | Class | What it reflects |
|---|---|---|
| Astragalus | long_term | found safe over long periods |
| Ginseng | long_term | classed non-toxic |
| Reishi | long_term | all six zhi, explicitly non-toxic |
| Schisandra | long_term | prolonged use sanctioned |
| Rehmannia | long_term | classed non-toxic |
| Bupleurum | long_term | classed non-toxic |
| **Dong Quai** | **corrective** | **not the indefinite-daily class** |
| Ginkgo | later_entry | enters at the Yuan; no ancient long-use warrant |
| Black pepper | later_entry | Tang Bencao (659 CE), plus a 1757 有毒 note |
| Lion's Mane | not_classified | no classical entry at all |

### Vipaka is empty and should stay empty

*Vipaka*, the post-digestive effect, can invert the immediate taste: something sweet on the
tongue can be pungent after digestion and behave accordingly over weeks. It is exactly the
long-arc property a daily product would want.

**It was found zero times, for any herb, in any reachable pre-1900 source.** Dymock (1890-93),
Dutt (1877), Ainslie (1826) and Watt (1889) all omit the category; they transmit *rasa* and
often *virya*, sometimes *guna*, and never *vipaka*. No pre-1900 Sanskrit printing was located.

No column is added for it. A plausible vipaka is precisely the kind of invention this project
has already been burned by.

## Three findings that no column fixes

**Provenance changes the temperature.** Tao Hongjing, in the Bencao Gangmu (1596):
出隴西者温補，出白水者冷補. Longxi-sourced astragalus is a *warming* tonic; Baishui-sourced is a
*cooling* one. Same drug, same part, opposite thermal action, decided by growing region.
Schisandra and Dong Quai split the same way. **If Eden's sourcing changes, the classical
energetic changes with it.** This is a flag plus a note, not a column.

**Preparation changes the temperature.** Ginseng root is 甘微寒 raw and warm cooked, resolved
explicitly by Li Yanwen: 人參生用氣涼，熟用氣温. Ginkgo kernel is neutral raw, warm and slightly
toxic cooked. Rehmannia has three states, not two, and sun-dried is neutral where fire-dried
is warm. A single temperature cell forces a choice the sources refuse to make. This wants a
part-and-preparation qualifier on the existing column rather than a new one.

**Several rows collapse distinct classical drugs into one.** Reishi is six *zhi* in one row,
and the stored "warm, sweet" belongs to purple *zhi*, a different species from the red *zhi*
that is *Ganoderma lucidum*. Dong Quai has a four-way part distinction: head stops blood, tail
breaks blood, body harmonises, whole does both. Ginseng root, rhizome neck and leaf are three
drugs, the neck an emetic that drains where the root supplements. **This is a row-granularity
question and no column answers it.**

## Suggested order of work

1. **Verify the harvest.** Independent re-reading of the quoted lines, in the original texts,
   before anything is loaded. This is the gate.
2. **Load `traditional_use_duration` first.** Small closed vocabulary, unambiguous in the source, fast to
   check, and it answers a live product question.
3. **Then `classical_contraindications`**, as the field most likely to be asked for by a
   practitioner customer and the one whose absence is a real gap.
4. **Then `channel_entry` and `preparation_doctrine`**, which are where the distinctive content
   is but which need the most careful transcription.
5. **Leave `vipaka` alone** until a pre-1900 Sanskrit source exists.

## Sources confirmed reachable

See `docs/herb-citation-integrity.md` for the verified source list, working access routes, and
the known dead ends (ctext.org is CAPTCHA-gated; Zhiwu Mingshi Tukao has no reachable full
text; Porter Smith 1871 does not transmit the han/liang system at all).
