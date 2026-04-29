# Pull Request

<!--
Eden Apothecary PR template — enforces §8.5 four-screen test discipline.
Per Manual v4.1 §8.5: Every PR pre-merge must pass an explicit four-test
review. Any "No" requires explicit deviation rationale; any unjustified
"N/A" is treated as "No" and blocks merge.

Replace `<answer>` with one of: ✅ YES / ❌ NO / 🔶 PARTIAL / ⚪ N/A.
For PARTIAL or N/A, write a one-line deviation rationale right after.
-->

## Why

<!-- One short paragraph: what real problem this PR closes, who it's for, and why now. -->

## What changes

<!-- The user-facing or system-level summary. Lead with the visitor / customer / operator outcome, not the file diff. -->

## §8.1 / §8.2 / §8.3 register reference

<!-- Which item in the Product Realignment Register does this PR close? Format: §8.1.X — short title.
     If this PR doesn't reference §8 (rare during sprint), document the deviation rationale here. -->

§ <!-- e.g., §8.1.4 -->

## §8.5 Four-Screen Test (mandatory)

| Test | Answer | Rationale |
|---|---|---|
| **Terrain** — does this filter / sort / score / annotate by constitution + tier? | <answer> | <one-line note; required if PARTIAL or N/A> |
| **Worldview** — does language carry stewardship + body-as-temple framing rather than influencer-wellness syntax? | <answer> | <one-line note; required if PARTIAL or N/A> |
| **Tier** — does this reinforce the Free → Seed → Root upsell ladder? | <answer> | <one-line note; required if PARTIAL or N/A> |
| **Safety** — does this flag contraindications + scope-of-practice limits + Class 2+ caution where appropriate? | <answer> | <one-line note; required if PARTIAL or N/A> |

<!--
A "No" or unjustified "N/A" blocks merge per §8.5.
Even infra-only PRs (EF deploys, migrations, cron setup, .github/, tooling) must answer all four — typically as three "N/A justified" + one substantive answer (often Safety, since most infra changes have a reliability dimension).
-->

## Lock alignment

<!-- Which Manual Locks does this PR honor or extend? List by number. -->

- Lock #<num> — <one-line reason>

## Smoke verification plan

<!-- How do we know this works on prod after merge? List the concrete checks. -->

1. <check 1>
2. <check 2>

## Files changed

<!-- Brief inventory by intent, not diff. -->

- <path> — <one-line intent>

## Out of scope / deferred

<!-- Anything intentionally NOT in this PR that a reader might expect. -->

## Manual entries this PR triggers (EOS pass)

<!-- Any §0.8 Lock additions, §3 / §4 / §5 reality updates, §8 register status flips, §9 Session Log entries
     that should land in the next Manual bump. The end-of-session Manual update reads this list. -->

- <none> | <e.g., §8.1.X status flip from in-progress to shipped>
