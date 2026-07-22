# The 97 temperature sources, verified

Run `wf_ec8fdcfa-e31`, 2026-07-22. Fourteen independent verifiers, isolated directories.
Data: `temperature_source_verification.json`, `temperature_agreement.json`.

## 89 of 97 confirmed, the best rate any pass in this project has produced

| Verdict | Count |
|---|---|
| **CONFIRMED, and a real temperature** | **89** |
| NOT_A_TEMPERATURE | 3 |
| WRONG_SPECIES_OR_PART | 3 |
| LOCATOR_WRONG | 2 |

For comparison, earlier single passes lost between 12% and 88% to independent re-read. This one lost
8%, which suggests the accumulated method (right corpus per herb, full-text download and grep,
isolated directories, named traps) is now working.

## Against the stored values: 61 agree, 8 disagree, 20 need a human eye

The hunters were never shown the stored values, so this comparison was done afterwards against
production.

**61 agree** with the stored pole. These are pure additive provenance: they give a period source
for a value the database already holds.

**8 disagree.** Per the standing rule these are **recorded, not applied**. Classical sources
corroborate, disambiguate or add; they never override a clear modern value.

| Herb | Stored | Source says | Source |
|---|---|---|---|
| Tormentil | cool | hot | Gerard (1633) |
| Flax / Linseed | cool | hot | Culpeper (1653) |
| Cacao | warm | cold | Pomet (1712) |
| Pumpkin Seed | neutral | cold | Culpeper (1653) |
| Anise | warm | neutral | Culpeper (1653) |
| Dill | warm | neutral | Gerard (1633) |
| Senna | cold | neutral | Gerard (1633) |
| Capillaris Wormwood | cool | neutral | Bencao Gangmu (1596) |

Six of the eight are the Galenic-versus-modern split already documented across this project:
classical Western sources call aromatic and alterative herbs hot where modern energetics calls them
cool. That is a category difference, not an error, and the resolution is to record both.

**20 are ambiguous** because the source gives a compound assignment (e.g. "hot and dry in the third
degree") that a simple pole comparison cannot classify. They need reading individually.

## Three rejections worth naming

**Stone Root.** Rafinesque's "a warm stimulant" was accepted earlier in this project as a thermal
assignment. This verifier calls it NOT_A_TEMPERATURE. **That is the unresolved policy question
surfacing again**: does a felt-heat word paired with an action word count? The project has now
answered it both ways, and it needs a written ruling before the next batch.

**Skunk Cabbage** and **Prickly Ash** likewise turn on whether an action word carries a temperature.

**Kanchnar, Guggul, Cape Aloes** are wrong species or part: the passage is genuine but describes a
different plant or a different part than the row.

## 23 of the 89 are second-hand reports

Dymock, Dutt, Watt and Ainslie are English compilers reporting the Sanskrit nighantus, not the
classical texts. Admissible under the pre-1900 rule, but each must be labelled a **report of** the
classical assignment rather than the assignment itself. Shatavari is the sharp case: Dymock says
"These two plants **appear to be** the Satavari and Maha-satavari of the Nighantas", so even the
Sanskrit identification is his inference, and the thermal applies to **both** *A. racemosus* and
*A. sarmentosus* jointly rather than to the row's species alone.

## What is not yet decided

Where these citations should live. Most of these rows already carry a `primary_text_citation`, and
for the 62 post-1900 rows the new source is strictly better. For the rest it is additional rather
than replacement. That is a schema decision, not a data one, and it has not been made.
