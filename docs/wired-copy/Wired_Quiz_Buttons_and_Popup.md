# Wired quiz: button + pop-up copy (draft 1, 2026-11-19)

Status: **APPROVED by Camila 2026-11-19 5:14 PM CT** on her review page https://claude.ai/artifact/XuM3CK6df7mGFEK3xeN53X (all 10 cards Use this one, no notes). Source of truth for Lane 2.

## Buttons and the pop-up, by placement

The 9 places you decided Nov 17. Each card shows the words and the placement name used to count clicks.

### Site-wide header link (Placement: header)

A: Wired Quiz
B: Free Kids' Quiz
Small menu link, every page.

### /homeschool page (a card in the page) (Placement: homeschool_inline)

Headline A: How is your child wired?
Headline B: See how God wired your child
Text: A free, 8-minute quiz for homeschool moms: your child's strengths and interests right now, and curriculum that fits them and your real life.
Button: Take the free quiz

### Eden's Table sample page (Placement: sample_inline)

Headline: Before you choose curriculum, see how your child is wired
Text: Free, about 8 minutes. You'll get your child's top 3 wirings and curriculum matches from the whole market, Eden's Table included and scored by the same rules.
Button: Start the quiz

### Freebies page (Placement: freebies_inline)

Headline: One more free one: Fearfully & Wonderfully Wired
Text: See how God wired each of your kids, in about 8 minutes.
Button: Take the quiz

### Every /esa/[state] page (Placement: esa_inline)

Headline: Using ESA funds? Find curriculum that fits your child
Text: Our free quiz shows how your child is wired, and you can narrow the matches to options that are ESA-eligible in [State].
Button: Take the free quiz

### Home page (Placement: home_inline)

Headline: Every child is wired on purpose
Text: Find out how yours is, free, in about 8 minutes.
Button: Take the Wired quiz

### Body-pattern quiz results page (Placement: bodypattern_results)

Headline: Homeschooling too?
Text: Our free kids' quiz shows how God wired each of your children, and finds curriculum that fits them.
Button: Take the kids' quiz

### End of every blog post (Placement: blog_end)

Wondering how your child is wired? Take our free, 8-minute quiz.
Button: Take the quiz

### Exit pop-up (takes turns 50/50 with the exit box you already have, decided Nov 17) (Placement: exit_popup)

Version A. Headline: Before you go: how is your child wired? / Text: Free, about 8 minutes, with curriculum matches that fit your real life. / Buttons: Take the quiz / No thanks
Version B. Headline: Free for homeschool moms / Text: See your child's top 3 strengths right now, plus 3 things to try this week. / Buttons: Show me / Maybe later
Same trigger as the existing exit box. Once closed, it stays closed for that visitor.

## How they're counted and tested

One card.

### Tracking and testing (Setup)

- Every button links to /wired inside the site, so no UTM tags (they would erase the visitor's real source). Clicks are counted with record_cta_click('wired', page, placement), using the placement names shown on each card.
- Facts used: the quiz is free, about 8 minutes, K-12, gives the top 3 wirings, 3 tips and curriculum matches, and has an ESA filter by state. Nothing else is promised.
- Traffic is small right now, so test one thing at a time. First test: the pop-up taking turns with the existing exit box (already decided). The A/B lines on the header and /homeschool wait until that one reads out.
