import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  buildBookTenets,
  buildBookThanks,
  buildBookWords,
  buildGuideBook,
  buildGuideHowTo,
  buildGuideParents,
  buildPrintReviewAsk,
  buildSecondBandStarterCheckIn,
  buildSecondBandStarterThanks,
  buildStarterWeeks10Email,
  buildTwoBandPrintThanks,
  buildTwoBandRhythm,
  buildTwoBandWords,
} from "./purchase-track-templates.ts"
import { buildPartialRefundEmail, buildPrintCancelledEmail } from "./order-messages.ts"
import type { OrderRow } from "./order-db.ts"

const SHOP = "Shop Medicinal Herbs"
const POSTAL = "303 Holly Cir, Unit 3262, Clarksville, TN 37043"

function all() {
  return [
    buildStarterWeeks10Email("Ann", "sprouts"),
    buildStarterWeeks10Email("Ann", "seedlings", true),
    buildSecondBandStarterThanks("Ann", "seedlings", "sprouts"),
    buildSecondBandStarterCheckIn("Ann", "sprouts"),
    buildPrintReviewAsk("Ann", "seedlings"),
    buildTwoBandPrintThanks("Ann", { kind: "both" }, true),
    buildTwoBandPrintThanks("Ann", { kind: "second", band: "sprouts", owned: "seedlings" }, true),
    buildTwoBandRhythm("Ann"),
    buildTwoBandWords("Ann"),
    ...(["paperback", "study_journal", "study_guide"] as const).flatMap((e) => [buildBookThanks("Ann", e, true), buildBookThanks("Ann", e, false)]),
    buildBookTenets("Ann", true),
    buildBookTenets("Ann", false),
    buildBookWords("Ann", true),
    buildBookWords("Ann", false),
    buildGuideHowTo("Ann", "The Still Water", "still-water"),
    buildGuideBook("Ann", "The Still Water"),
    buildGuideParents("Ann", true),
    buildGuideParents("Ann", false),
  ]
}

Deno.test("copy rules: no em dashes, an unsubscribe link and the postal line in every email", () => {
  for (const e of all()) {
    assert(!e.html.includes("—") && !e.subject.includes("—"), `em dash in "${e.subject}"`)
    assertStringIncludes(e.html, "{{UNSUB_URL}}")
    assertStringIncludes(e.html, POSTAL)
    assert(!/undefined|\[object|NaN|null/.test(e.html.replace(/<!DOCTYPE[^>]*>/, "")), `template leftover in "${e.subject}"`)
    assertStringIncludes(e.html, "placed an order at edeninstitute.health")
  }
})

Deno.test("approved subjects", () => {
  assertEquals(buildStarterWeeks10Email("Ann", "sprouts").subject, "Weeks 10 to 36 are ready")
  assertEquals(buildSecondBandStarterThanks("Ann", "seedlings", "sprouts").subject, "Two bands at one table")
  assertEquals(buildSecondBandStarterCheckIn("Ann", "seedlings").subject, "How is the second band going?")
  assertEquals(buildPrintReviewAsk("Ann", "sprouts").subject, "A month with your Sprouts books")
  assertEquals(buildTwoBandPrintThanks("Ann", { kind: "both" }, false).subject, "Two bands on your shelf")
  assertEquals(buildTwoBandRhythm("Ann").subject, "Two bands, one week")
  assertEquals(buildTwoBandWords("Ann").subject, "A month with two bands")
  assertEquals(buildBookThanks("Ann", "paperback", true).subject, "How to read Back to Eden")
  assertEquals(buildBookTenets("Ann", true).subject, "The five tenets before any herb")
  assertEquals(buildBookWords("Ann", false).subject, "What do you think so far?")
  assertEquals(buildGuideHowTo("Ann", "The Burning Bowstring", "burning-bowstring").subject, "How to use your Burning Bowstring guide")
  assertEquals(buildGuideBook("Ann", "The Burning Bowstring").subject, "The book behind your guide")
  assertEquals(buildGuideParents("Ann", false).subject, "For your children: a free week of Eden's Table")
})

Deno.test("each band links to its own printed year, and the second band says so", () => {
  assertStringIncludes(buildStarterWeeks10Email("Ann", "sprouts").html, 'href="https://edeninstitute.health/books"')
  const seedlings = buildStarterWeeks10Email("Ann", "seedlings", true).html
  assertStringIncludes(seedlings, 'href="https://edeninstitute.health/books#seedlings"')
  assertStringIncludes(seedlings, "since you added Seedlings to your table")
  assert(!seedlings.includes("Sprouts"), "a Seedlings email never names Sprouts")
  assertStringIncludes(buildStarterWeeks10Email("Ann", "sprouts").html, "since you started the Sprouts Starter Unit")
})

Deno.test("the Founding 50 invite only on a both-bands thank-you, and only when open", () => {
  assertStringIncludes(buildTwoBandPrintThanks("Ann", { kind: "both" }, true).html, "foundingfifty")
  assert(!buildTwoBandPrintThanks("Ann", { kind: "both" }, false).html.includes("foundingfifty"))
  assert(!buildTwoBandPrintThanks("Ann", { kind: "second", band: "seedlings", owned: "sprouts" }, true).html.includes("foundingfifty"))
  assertStringIncludes(
    buildTwoBandPrintThanks("Ann", { kind: "second", band: "seedlings", owned: "sprouts" }, false).html,
    "the printed Seedlings year! With Sprouts already at your house",
  )
})

Deno.test("Back to Eden: the edition line and the print wording follow the order", () => {
  assertStringIncludes(buildBookThanks("Ann", "study_journal", false).html, "Your Study &amp; Journal Edition has a short study guide")
  assertStringIncludes(buildBookThanks("Ann", "study_guide", true).html, "Your Study Guide is made to stay open beside the book")
  assertStringIncludes(buildBookThanks("Ann", "paperback", true).html, "Your copy is being printed now")
  assert(!buildBookThanks("Ann", "paperback", false).html.includes("being printed"))
  assertStringIncludes(buildBookTenets("Ann", true).html, "If your copy has not arrived yet")
  assert(!buildBookTenets("Ann", false).html.includes("arrived"))
  assertStringIncludes(buildBookWords("Ann", true).html, "has been at your house about two weeks")
})

Deno.test("guide emails use the short pattern name and the guide page", () => {
  const how = buildGuideHowTo("Ann", "The Still Water", "still-water").html
  assertStringIncludes(how, "your <strong>Still Water</strong> Deep-Dive Guide")
  assertStringIncludes(how, 'href="https://edeninstitute.health/guide/still-water"')
  assertStringIncludes(buildGuideBook("Ann", "The Still Water").html, "Your Still Water guide comes from my book")
  assertStringIncludes(buildGuideParents("Ann", true).html, "You tapped Yes when I asked if you have children at home")
  assertStringIncludes(buildGuideParents("Ann", false).html, "If you have children at home, this one is for them.")
})

Deno.test("reply and nothing-to-buy emails carry no shop card; next-step emails do", () => {
  for (const e of [
    buildSecondBandStarterThanks("Ann", "seedlings", "sprouts"), buildSecondBandStarterCheckIn("Ann", "sprouts"),
    buildPrintReviewAsk("Ann", "sprouts"), buildTwoBandPrintThanks("Ann", { kind: "both" }, true), buildTwoBandRhythm("Ann"),
    buildTwoBandWords("Ann"), buildBookThanks("Ann", "paperback", true), buildBookTenets("Ann", true), buildBookWords("Ann", true),
  ]) assert(!e.html.includes(SHOP), `shop card in "${e.subject}"`)
  for (const e of [buildStarterWeeks10Email("Ann", "sprouts"), buildGuideHowTo("Ann", "The X", "x"), buildGuideBook("Ann", "The X"), buildGuideParents("Ann", false)]) {
    assertStringIncludes(e.html, SHOP)
  }
})

function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    order_number: "ET-1028",
    customer_email: "buyer@example.com",
    customer_phone: null,
    shipping_name: "Jane Doe",
    product_label: "Sprouts Printed Curriculum Set",
    amount_total_cents: 26100,
    currency: "usd",
    sms_consent: false,
    status: "in_production",
    is_preorder: false,
    ...over,
  }
}

Deno.test("partial refund: this refund's amount, the order, no shop card, no unsubscribe placeholder", () => {
  const { subject, html } = buildPartialRefundEmail(order(), 1200)
  assertEquals(subject, "Part of your order was refunded (ET-1028)")
  assertStringIncludes(html, "Hi Jane,")
  assertStringIncludes(html, "<strong>$12.00</strong> is on its way back to you for order <strong>ET-1028</strong> (Sprouts Printed Curriculum Set)")
  assertStringIncludes(html, "The rest of your order stays exactly as it is.")
  assert(!html.includes(SHOP))
  assert(!html.includes("{{UNSUB_URL}}"))
  assert(!html.includes("—"))
})

Deno.test("print cancelled: says what happened, offers a refund, promises no date", () => {
  const { subject, html } = buildPrintCancelledEmail(order({ shipping_name: null, raw: { customer_details: { name: "ann lee" } } } as Partial<OrderRow>))
  assertEquals(subject, "A problem printing your order (ET-1028)")
  assertStringIncludes(html, "Hi ann,")
  assertStringIncludes(html, "cancelled the print job for order <strong>ET-1028</strong>")
  assertStringIncludes(html, "I will refund you in full")
  assert(!html.includes(SHOP))
  assert(!/\b(days|weeks|tomorrow)\b/.test(html.replace(/<[^>]+>/g, " ")), "no time promise")
})
