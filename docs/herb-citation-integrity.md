# Herb citation integrity

Written 2026-07-21, after a QC pass against pre-1900 materia medica found four herb
citations whose quoted text does not appear in the work it is attributed to.

## What went wrong

Four rows carried a fabricated excerpt: Eleuthero, Ginkgo, Lion's Mane, Maitake. Three
more carried a paraphrase presented as a quotation: Astragalus, Reishi, Turkey Tail. All
seven were removed in `20260721170000_remove_unverifiable_herb_citations.sql`.

The Lion's Mane row is the instructive one. Its excerpt reads "sweet, neutral", which is
exactly that row's stored taste and temperature. **That is the shape of a citation written
to justify a value, rather than a value read out of a source.** It is the pattern to watch
for when reviewing the rest.

## The structural condition that allowed it

A citation with no verbatim excerpt cannot be checked by anyone. Measured across all 300
rows on 2026-07-21:

| Condition | Rows |
|---|---|
| **Primary citation with no `excerpt`** | **201** |
| Primary citation with no `url` | 62 |
| Non-numeric `year` (e.g. "c. 200 CE", "16th century") | 74 |
| Primary citation dated 1900 or later | 57 |
| Secondary citation dated 1900 or later | 238 |

Two thirds of the table carries a source attribution that cannot be verified even in
principle. Lock #43 requires that a surfaced claim have two citations; it does not require
that either be checkable. That is the gap.

## Triage query

Ranks the remaining rows by how unverifiable their citation is. Highest score first.

```sql
select
  herb_id,
  common_name,
  primary_text_citation->>'title' as title,
  primary_text_citation->>'year'  as year,
  primary_text_citation->>'url'   as url,
  (case when primary_text_citation->>'excerpt' is null then 4 else 0 end)
  + (case when primary_text_citation->>'url' is null then 2 else 0 end)
  + (case when (primary_text_citation->>'year') !~ '^[0-9]{3,4}$' then 1 else 0 end)
  + (case when primary_text_citation->>'url' ilike '%ctext.org%' then 3 else 0 end)
  as unverifiability
from public.herbs
where primary_text_citation is not null
order by unverifiability desc, herb_id;
```

`ctext.org` scores high on its own: it serves a CAPTCHA interstitial to automated access
and its API returns `ERR_REQUIRES_AUTHENTICATION`, so no text can have been read there.
The same applies to `archive.org/details/shennong-bencao-jing`, dated "1892" in the rows
that cite it, which corresponds to no verifiable pre-1900 edition.

## Standard going forward

A herb citation should carry, at minimum:

1. **A verbatim excerpt** in the source's own language and orthography. Chinese sources
   quote the 氣味 line in characters; Sanskrit-derived claims quote the transliteration.
   A paraphrase is not a citation.
2. **A resolvable URL** to a text that can actually be fetched and searched. Not a
   CAPTCHA-gated portal, not a catalogue page, not an item with no OCR layer.
3. **A numeric publication year.** Where the work is ancient, cite the *recension* and its
   year, e.g. the Sun Xingyan recension (1799) of the Shennong Bencao Jing (c. 200 CE).
4. **The species as the source names it**, so cross-species drift is visible. The classical
   五加皮 is *Acanthopanax*, not *Eleutherococcus senticosus*; Chinese Shan Zha is
   *Crataegus pinnatifida*, not *C. monogyna*; Huang Qin is *Scutellaria baicalensis*, not
   *S. lateriflora*.

Per the founder's ruling of 2026-07-21, energetics claims must rest on sources published
**1899 or earlier**. Modern works may support safety, constituents and pharmacology, but
not a temperature, taste or potency assignment.

## Sources that were verified as reachable and quotable

Established during the 2026-07-21 pass, with working access methods:

| Source | Year | Notes |
|---|---|---|
| Bencao Gangmu 本草綱目, Siku Quanshu recension | 1596 | Chinese Wikisource, raw wikitext. The richest source: grade, channel entry, incompatibilities, processing, adulterants, and Li Shizhen's adjudication of disputes. |
| Shennong Bencao Jing, Sun Xingyan recension | 1799 (of c. 200 CE) | Chinese Wikisource. Gives the Han layer with Wu Pu variant readings. |
| Zhenglei Bencao 證類本草 | 1108 | Prints Bencao Jing and Mingyi Bielu readings fused, so contradictions stay visible. |
| Ben Cao Cong Xin 本草從新 | 1757 | Corroboration only. |
| Pharmacographia Indica (Dymock, Warden, Hooper) | 1890-93 | English report of Sanskrit nighantu virya. Second-hand; label it so. |
| Materia Medica of the Hindus (U. C. Dutt) | 1877 | Rarely gives a thermal quality. |
| Salmon, Botanologia | 1710 | archive.org `gri_33125012917387_djvu.txt`, 7 MB. Covers post-1600 introductions that Gerard and Culpeper miss. |
| Rafinesque, Medical Flora | 1828-30 | Use the full archive.org OCR. The henriettes-herb transcription **stops at "Cnicus"**, and he files plants under genus names he invented (Echinacea = HELICHROA, Oregon Grape = ODOSTEMON). |

**Known dead ends.** `ctext.org` is CAPTCHA-gated. Zhiwu Mingshi Tukao (1848) has no
reachable full text anywhere. F. Porter Smith (1871) does **not** transmit the
han/liang/wen/re system at all, so under a pre-1900 rule the only route to Chinese
temperature is the Chinese-language texts themselves. No pre-1900 Sanskrit printing was
located, which is why *vipaka* could not be sourced for a single herb.
