# Wired quiz: family questions + priority ranking (draft 1, 2026-11-19)

Status: **APPROVED by Camila 2026-11-19 8:47 AM CT** on her review page https://claude.ai/artifact/PYtBLocibDLvypTK31iSGG (all 63 cards 'Use this one', no notes). Source of truth for Lane 2.

Intro line: A few quick questions about your family, so the curriculum matches fit your real life, not just your child.

## `kids`: How many children are you homeschooling this year?

- `1` 1
- `2` 2
- `3` 3
- `4` 4
- `5plus` 5 or more

Used for: The 'several kids together' part of each match (1 child vs 2 or more), and whether the Family Map is offered.

## `prep`: On a typical day, how much time can you spend getting lessons ready?

Helper: Not the teaching, just the prep.

- `open_and_go` 10 minutes or less: I need open-and-go
- `light` About 10 to 20 minutes
- `moderate` About 20 to 45 minutes
- `heavy` 45 minutes or more, or I like to plan ahead each week

Used for: The prep part of each match. The four answers are the prep levels you approved Nov 18 (Open-and-go 0-10 min, Light 10-20, Moderate 20-45, Heavy 45+ or weekly planning).

## `frustration`: What's your biggest homeschool frustration right now?

- `time` Finding time to plan and prepare
- `engagement` Keeping my child interested
- `multi_age` Teaching more than one age at once
- `enough` Wondering if we're doing enough
- `budget` Finding curriculum that fits our budget
- `choosing` Picking the right curriculum in the first place
- `other` Something else

Used for: PROPOSED: picks which of the 3 quick tips shows first on her results and shapes her emails. Not part of the curriculum score.

## `approach`: How would you describe the way you homeschool right now?

Helper: Pick the closest one.

- `classical` Classical: learning in stages, lots of memory work and great books
- `charlotte_mason` Charlotte Mason: living books, nature study, narration, short lessons
- `traditional` Traditional: textbooks and workbooks, like school at home
- `unit_study` Unit studies: one theme ties many subjects together
- `literature` Literature-based: we learn through great books
- `montessori` Montessori: hands-on materials and child-led work
- `waldorf` Waldorf: arts, rhythm and imagination
- `interest_led` Interest-led: we follow my child's interests
- `online` Online or video lessons
- `eclectic` A mix of several
- `starting` We're just getting started
- `unsure` Not sure yet

Used for: Compared with her child's best-fit approach on the results page. The first 10 match the approach list in the curriculum database exactly. Not part of the curriculum score.

## `budget`: About how much do you plan to spend on curriculum for this child this year?

Helper: All subjects together.

- `free` Free options only
- `under_100` Under $100
- `100_300` $100 to $300
- `300_600` $300 to $600
- `600_1000` $600 to $1,000
- `over_1000` More than $1,000
- `unsure` Not sure yet

Used for: The budget part of each match and the 'within my budget' filter. The bands follow the prices of your 30 approved curricula ($0 to $1,276; Eden's Table $249). PROPOSED: 'Not sure yet' leaves budget out of the match.

## `esa`: Are you using ESA or scholarship funds for curriculum this year?

Helper: ESA = a state education savings account.

- `yes` Yes
- `planning` Not yet, but I plan to
- `no` No
- `unsure` I'm not sure what that is

Used for: PROPOSED: a Yes or plan-to shows the 'Only show ESA-eligible options' box first, and 'not sure' adds a link to the ESA guide. Her state is asked only if she ticks that box (decided Nov 18).

## Priority ranking

Title: What matters most to you right now?

Body: Tap these in order, most important first. We'll use your order to sort [nickname]'s curriculum matches.

- `wiring` A great fit for how God wired [nickname]
- `budget` Staying within my budget
- `prep` Open-and-go: little prep for me
- `siblings` Teaching several of my kids together

After ranking: Your top pick counts for about half of each match score.
Buttons: Start over / Skip this step
Skip note: We'll use the most common order: a fit for [nickname] first, then little prep, then budget, then teaching together.

- Default order when she skips = the order you decided Nov 17 (wiring > open-and-go > budget > several kids).
- 'About half' is honest: the top pick carries 52.1% of the score (Rank Order Centroid weights 52.1 / 27.1 / 14.6 / 6.25).
- PROPOSED: tap-in-order instead of drag, because dragging is hard on a phone.
- PROPOSED: a mom with 1 child doesn't see 'Teaching several of my kids together'; it goes last automatically. That changes no match order, because with 1 child every curriculum scores the same on it.
