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

## Why nothing is loaded yet

A QC pass over 95 herbs harvested **743 candidate facts** from pre-1900 sources. They are in
`docs/data/classical-energetics-harvest-2026-07-21.json`, marked UNVERIFIED, and they are
**not** written to any row.

The reason is the migration immediately before this one. `20260721170000` had to withdraw
four herb citations whose quoted text did not appear in the work it named, plus three
paraphrases presented as quotations. Loading 743 unverified quotations one hour later would
reproduce that failure at two orders of magnitude.

The columns settle the shape. The content follows verification, not the other way round.

## What was found, by kind

Rates are from the fifteen herbs documented row by row; the reach column is an extrapolation
and is labelled as one.

| Addition | Found in | Rough reach across 300 |
|---|---|---|
| Preparation doctrine | 13-14 of 15 | most herbs with any classical entry |
| Shennong grade (incl. informative absence) | 11 of 15 | every herb with a Chinese entry |
| Contraindications | 10 of 15 | two thirds of herbs with a classical entry |
| Channel entry | 8 full, 3 partial of 15 | Chinese-tradition herbs only |
| Incompatibility and envoy pairs | 8 of 15 | Chinese-tradition herbs only |
| Adulteration or fraud warning | 5 of 15 | a third, concentrated in commercial roots |
| Provenance-dependent action | 4 of 15 | a quarter |
| Guna | 2 of 4 Ayurvedic | Ayurvedic subset only |
| **Vipaka** | **0 of 4 Ayurvedic** | **zero without a Sanskrit source** |

### Shennong grade, the one that earns its column

The grade encodes intended **duration** of use, which is the question a daily-herb product
asks every day.

| Herb | Grade | What it licenses |
|---|---|---|
| Astragalus | 上品 upper | daily use warranted |
| Ginseng | 上品 upper | 久服輕身延年 |
| Reishi | 上品 upper | all six zhi, explicitly non-toxic |
| Schisandra | 上品 upper | prolonged use sanctioned |
| Rehmannia | 上品 upper | 久服，輕身、不老 |
| Bupleurum | 上品 upper | 久服，輕身、明目、益精 |
| **Dong Quai** | **中品 middle** | **not the indefinite-daily class; no 久服 formula** |
| Ginkgo | later entry | enters at the Yuan; no ancient daily-use warrant |
| Black pepper | later entry | Tang Bencao (659 CE), plus a 1757 有毒 note |
| Lion's Mane | not in canon | no classical entry at all |

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
2. **Load `shennong_grade` first.** Small closed vocabulary, unambiguous in the source, fast to
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
