import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildChapterEmail2,
  buildChapterEmail3,
  buildParentsEmail,
  buildQuizEmail1,
  buildQuizEmail2,
  buildQuizEmail3,
  buildRefundNote,
} from "./lead-track-templates.ts"

const ANSWERS = { yes: "https://edeninstitute.health/answer?t=T&a=yes", no: "https://edeninstitute.health/answer?t=T&a=no" }
const SLUGS = [
  "burning-bowstring", "open-flame", "pressure-cooker", "overflowing-cup",
  "drawn-bowstring", "spent-candle", "frozen-knot", "still-water",
]
const SHOP = "Shop Medicinal Herbs"

function all() {
  return [
    ...SLUGS.flatMap((s) => [buildQuizEmail1("Ann", "The X", s), buildQuizEmail2("Ann", "The X", s, ANSWERS), buildQuizEmail3("Ann", "The X", s, false)]),
    buildParentsEmail("Ann", "quiz"),
    buildParentsEmail("Ann", "chapter"),
    buildChapterEmail2("Ann", ANSWERS),
    buildChapterEmail3("Ann"),
    buildRefundNote("Ann"),
  ]
}

Deno.test("copy rules: no em dashes, an unsubscribe link and the postal line in every email", () => {
  for (const e of all()) {
    assert(!e.html.includes("—") && !e.subject.includes("—"), `em dash in "${e.subject}"`)
    assertStringIncludes(e.html, "{{UNSUB_URL}}")
    assertStringIncludes(e.html, "303 Holly Cir, Unit 3262, Clarksville, TN 37043")
    assert(!/undefined|\[object|NaN/.test(e.html), `template leftover in "${e.subject}"`)
  }
})

Deno.test("approved subjects", () => {
  assertEquals(buildQuizEmail1("Ann", "The Burning Bowstring", "burning-bowstring").subject, "Your result: The Burning Bowstring")
  assertEquals(buildQuizEmail2("Ann", "The Burning Bowstring", "burning-bowstring", ANSWERS).subject, "One small thing to try this week")
  assertEquals(buildQuizEmail3("Ann", "The Burning Bowstring", "burning-bowstring", false).subject, "A Creator who does not make copies")
  assertEquals(buildParentsEmail("Ann", "quiz").subject, "For your children: a free week of Eden's Table")
  assertEquals(buildChapterEmail2("Ann", ANSWERS).subject, "One line from Chapter 1")
  assertEquals(buildChapterEmail3("Ann").subject, "Symptoms are signals")
  assertEquals(buildRefundNote("Ann").subject, "Can I ask what didn't fit?")
})

Deno.test("each pattern gets its own guide verse; an unknown slug still renders", () => {
  assertStringIncludes(buildQuizEmail1("Ann", "The Burning Bowstring", "burning-bowstring").html, "Proverbs 14:30")
  assertStringIncludes(buildQuizEmail1("Ann", "The Still Water", "still-water").html, "Colossians 3:23")
  assertStringIncludes(buildQuizEmail1("Ann", "The X", "not-a-pattern").html, "Isaiah 43:18-19")
  assertStringIncludes(buildQuizEmail1("Ann", "The Burning Bowstring", "burning-bowstring").html, "/go/deep-dive/burning-bowstring")
})

Deno.test("day-2 emails carry the Yes / No links and no shop card", () => {
  for (const e of [buildQuizEmail2("Ann", "The X", "frozen-knot", ANSWERS), buildChapterEmail2("Ann", ANSWERS)]) {
    assertStringIncludes(e.html, `href="${ANSWERS.yes}"`)
    assertStringIncludes(e.html, `href="${ANSWERS.no}"`)
    assertStringIncludes(e.html, "Do you have children at home?")
    assert(!e.html.includes(SHOP), "day-2 email promises nothing to buy")
  }
  assert(!buildRefundNote("Ann").html.includes(SHOP), "refund note sells nothing")
  assert(buildQuizEmail1("Ann", "The X", "frozen-knot").html.includes(SHOP))
})

Deno.test("quiz Email 3 drops the guide line for someone who owns the guide", () => {
  assertStringIncludes(buildQuizEmail3("Ann", "The Frozen Knot", "frozen-knot", false).html, "/go/deep-dive/frozen-knot")
  assert(!buildQuizEmail3("Ann", "The Frozen Knot", "frozen-knot", true).html.includes("/go/deep-dive/"))
})

Deno.test("Email 4 names the tap, and each track keeps its own footer", () => {
  assertStringIncludes(buildParentsEmail("Ann", "quiz").html, "You tapped Yes when I asked if you have children at home")
  assertStringIncludes(buildParentsEmail("Ann", "quiz").html, "completed the Constitutional Assessment")
  assertStringIncludes(buildParentsEmail("Ann", "chapter").html, "asked for the free chapter of Back to Eden")
})

Deno.test("names are escaped, and an empty name still greets", () => {
  assertStringIncludes(buildRefundNote("<b>x</b>").html, "Hi &lt;b&gt;x&lt;/b&gt;,")
  assertStringIncludes(buildChapterEmail3("  ").html, "Hi friend,")
})
