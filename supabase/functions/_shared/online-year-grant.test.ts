// Online Year OY3 (punch #472): the pure grant rules. Dates, early renewal, siblings, idempotency,
// what closes a license, and the out-of-area flag.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  addMonthsUtc,
  onlineYearCloseReasonFor,
  onlineYearCountryFlags,
  onlineYearGrantInput,
  onlineYearOrderKey,
  onlineYearOrderLabel,
  onlineYearOutOfAreaAlert,
  planOnlineYearGrant,
  type OnlineYearExistingLicense,
} from "./online-year-grant.ts";
import { buildOnlineYearMetadata, type OnlineYearCartPlan } from "./online-year-checkout.ts";

const iso = (d: Date) => d.toISOString();
const PURCHASE = new Date("2026-12-01T15:30:00.000Z");
const ORDER = "order-new";

function cart(band: "sprouts" | "seedlings", children: [string, "first_child" | "sibling"][]): OnlineYearCartPlan {
  return { band, children: children.map(([name, kind]) => ({ name, kind })), lines: [] };
}

function lic(over: Partial<OnlineYearExistingLicense>): OnlineYearExistingLicense {
  return { id: "L1", band: "sprouts", child_name: "Ava", status: "active", ends_at: "2027-03-01T10:00:00.000Z", order_id: "order-old", renewed: false, ...over };
}

// ── addMonthsUtc ────────────────────────────────────────────────────────────

Deno.test("12 months from purchase: same day and time next year", () => {
  assertEquals(iso(addMonthsUtc(PURCHASE, 12)), "2027-12-01T15:30:00.000Z");
});

Deno.test("Feb 29 + 12 months clamps to Feb 28 (as Postgres does)", () => {
  assertEquals(iso(addMonthsUtc(new Date("2028-02-29T08:00:00Z"), 12)), "2029-02-28T08:00:00.000Z");
});

Deno.test("month ends clamp and years roll over", () => {
  assertEquals(iso(addMonthsUtc(new Date("2027-01-31T00:00:00Z"), 1)), "2027-02-28T00:00:00.000Z");
  assertEquals(iso(addMonthsUtc(new Date("2028-01-31T00:00:00Z"), 1)), "2028-02-29T00:00:00.000Z");
  assertEquals(iso(addMonthsUtc(new Date("2026-12-31T23:59:59.999Z"), 12)), "2027-12-31T23:59:59.999Z");
  assertEquals(iso(addMonthsUtc(new Date("2026-11-15T12:00:00Z"), 2)), "2027-01-15T12:00:00.000Z");
});

// ── planOnlineYearGrant ─────────────────────────────────────────────────────

Deno.test("a new family: every child starts on the purchase date, 12 months, no renewal", () => {
  const p = planOnlineYearGrant({ cart: cart("sprouts", [["Ava", "first_child"], ["Ben", "sibling"]]), orderId: ORDER, purchasedAt: PURCHASE, existing: [] });
  assertEquals(p.already, []);
  assertEquals(p.rows, [
    { child_name: "Ava", kind: "first_child", starts_at: "2026-12-01T15:30:00.000Z", ends_at: "2027-12-01T15:30:00.000Z", renews_license_id: null },
    { child_name: "Ben", kind: "sibling", starts_at: "2026-12-01T15:30:00.000Z", ends_at: "2027-12-01T15:30:00.000Z", renews_license_id: null },
  ]);
});

Deno.test("early renewal: the new year starts where her live year ends and points back at it", () => {
  const p = planOnlineYearGrant({ cart: cart("sprouts", [["Ava", "first_child"]]), orderId: ORDER, purchasedAt: PURCHASE, existing: [lic({})] });
  assertEquals(p.rows, [{ child_name: "Ava", kind: "first_child", starts_at: "2027-03-01T10:00:00.000Z", ends_at: "2028-03-01T10:00:00.000Z", renews_license_id: "L1" }]);
});

Deno.test("the renewal match ignores case and extra spaces in the name", () => {
  const p = planOnlineYearGrant({ cart: cart("sprouts", [["ava", "first_child"]]), orderId: ORDER, purchasedAt: PURCHASE, existing: [lic({ child_name: " Ava " })] });
  assertEquals(p.rows[0].renews_license_id, "L1");
});

Deno.test("a sibling added later gets 12 months from the day she adds him, even past the first child's end", () => {
  const p = planOnlineYearGrant({
    cart: cart("sprouts", [["Ben", "sibling"]]),
    orderId: ORDER,
    purchasedAt: PURCHASE,
    existing: [lic({ child_name: "Ava", ends_at: "2027-01-10T00:00:00.000Z" })],
  });
  assertEquals(p.rows, [{ child_name: "Ben", kind: "sibling", starts_at: "2026-12-01T15:30:00.000Z", ends_at: "2027-12-01T15:30:00.000Z", renews_license_id: null }]);
});

Deno.test("a sibling renewing early also loses no days", () => {
  const p = planOnlineYearGrant({
    cart: cart("sprouts", [["Ben", "sibling"]]),
    orderId: ORDER,
    purchasedAt: PURCHASE,
    existing: [lic({ id: "LB", child_name: "Ben", ends_at: "2027-02-01T09:00:00.000Z" })],
  });
  assertEquals(p.rows[0].starts_at, "2027-02-01T09:00:00.000Z");
  assertEquals(p.rows[0].renews_license_id, "LB");
});

Deno.test("an ended, a closed, or another band's license is not renewed: the year starts at purchase", () => {
  for (const old of [
    lic({ ends_at: "2026-11-30T00:00:00.000Z" }), // ended before she bought
    lic({ ends_at: PURCHASE.toISOString() }), // ends the very moment she buys: not live
    lic({ status: "closed" }), // refunded or disputed
    lic({ band: "seedlings" }), // other band
  ]) {
    const p = planOnlineYearGrant({ cart: cart("sprouts", [["Ava", "first_child"]]), orderId: ORDER, purchasedAt: PURCHASE, existing: [old] });
    assertEquals(p.rows[0].starts_at, "2026-12-01T15:30:00.000Z", JSON.stringify(old));
    assertEquals(p.rows[0].renews_license_id, null);
  }
});

Deno.test("a chain: renewing again continues from the latest live year", () => {
  const p = planOnlineYearGrant({
    cart: cart("sprouts", [["Ava", "first_child"]]),
    orderId: ORDER,
    purchasedAt: PURCHASE,
    existing: [
      lic({ id: "A", ends_at: "2027-03-01T10:00:00.000Z", renewed: true }),
      lic({ id: "R1", ends_at: "2028-03-01T10:00:00.000Z", order_id: "order-r1" }),
    ],
  });
  assertEquals(p.rows[0].starts_at, "2028-03-01T10:00:00.000Z");
  assertEquals(p.rows[0].ends_at, "2029-03-01T10:00:00.000Z");
  assertEquals(p.rows[0].renews_license_id, "R1");
});

Deno.test("a year whose renewal was refunded: still no days lost, but it cannot be pointed at twice", () => {
  const p = planOnlineYearGrant({
    cart: cart("sprouts", [["Ava", "first_child"]]),
    orderId: ORDER,
    purchasedAt: PURCHASE,
    existing: [lic({ id: "A", renewed: true }), lic({ id: "R1", status: "closed", ends_at: "2028-03-01T10:00:00.000Z", order_id: "order-r1" })],
  });
  assertEquals(p.rows[0].starts_at, "2027-03-01T10:00:00.000Z");
  assertEquals(p.rows[0].renews_license_id, null);
});

Deno.test("idempotent: a redelivered event finds the order's own licenses and plans nothing", () => {
  const existing = [
    lic({ id: "N1", child_name: "Ava", order_id: ORDER, ends_at: "2027-12-01T15:30:00.000Z" }),
    lic({ id: "N2", child_name: "Ben", order_id: ORDER, ends_at: "2027-12-01T15:30:00.000Z" }),
  ];
  const p = planOnlineYearGrant({ cart: cart("sprouts", [["Ava", "first_child"], ["Ben", "sibling"]]), orderId: ORDER, purchasedAt: PURCHASE, existing });
  assertEquals(p.rows, []);
  assertEquals(p.already, ["Ava", "Ben"]);
});

Deno.test("idempotent per child: only the child missing from a half-granted order is planned", () => {
  const existing = [lic({ id: "N1", child_name: "Ava", order_id: ORDER, ends_at: "2027-12-01T15:30:00.000Z" })];
  const p = planOnlineYearGrant({ cart: cart("sprouts", [["Ava", "first_child"], ["Ben", "sibling"]]), orderId: ORDER, purchasedAt: PURCHASE, existing });
  assertEquals(p.already, ["Ava"]);
  assertEquals(p.rows.map((r) => r.child_name), ["Ben"]);
  assertEquals(p.rows[0].renews_license_id, null); // the order's own license is never "renewed"
});

// ── onlineYearGrantInput ────────────────────────────────────────────────────

const META = buildOnlineYearMetadata({ band: "seedlings", children: [{ name: "Ava", kind: "first_child" }, { name: "Ben", kind: "sibling" }], lines: [] });
const CREATED = Math.floor(PURCHASE.getTime() / 1000);

Deno.test("input: the email lower-cased, the card name for the license line, the purchase time from the event", () => {
  const r = onlineYearGrantInput({
    payment_status: "paid",
    metadata: { ...META, email: "ignored@example.com" },
    customer_details: { email: "  Mom@Example.COM ", name: "  Jane   Doe " },
  }, CREATED);
  assert(r.ok);
  assertEquals(r.email, "mom@example.com");
  assertEquals(r.licenseName, "Jane Doe");
  assertEquals(r.purchasedAt.getTime(), Math.floor(PURCHASE.getTime() / 1000) * 1000);
  assertEquals(r.cart.band, "seedlings");
  assertEquals(r.cart.children.map((c) => `${c.name}:${c.kind}`), ["Ava:first_child", "Ben:sibling"]);
});

Deno.test("input: falls back to customer_email, then the metadata email; no name means the email alone", () => {
  const a = onlineYearGrantInput({ payment_status: "paid", metadata: META, customer_email: "A@B.co" }, CREATED);
  assert(a.ok);
  assertEquals(a.email, "a@b.co");
  assertEquals(a.licenseName, null);
  const b = onlineYearGrantInput({ payment_status: "paid", metadata: { ...META, email: "C@D.co" } }, CREATED);
  assert(b.ok);
  assertEquals(b.email, "c@d.co");
});

Deno.test("input: a 121-character card name is not used", () => {
  const r = onlineYearGrantInput({ payment_status: "paid", metadata: META, customer_details: { email: "a@b.co", name: "x".repeat(121) } }, CREATED);
  assert(r.ok);
  assertEquals(r.licenseName, null);
});

Deno.test("input: unpaid, a broken cart, no email, no event time are each refused with a reason", () => {
  const ok = { payment_status: "paid", metadata: META, customer_details: { email: "a@b.co" } };
  assertEquals(onlineYearGrantInput({ ...ok, payment_status: "unpaid" }, CREATED), { ok: false, reason: "unpaid" });
  assertEquals(onlineYearGrantInput({ ...ok, metadata: { ...META, oy_children: "3" } }, CREATED), { ok: false, reason: "bad_metadata" });
  assertEquals(onlineYearGrantInput({ ...ok, metadata: { ...META, oy_kind_2: "first_child" } }, CREATED), { ok: false, reason: "bad_metadata" });
  assertEquals(onlineYearGrantInput({ payment_status: "paid", metadata: META }, CREATED), { ok: false, reason: "no_email" });
  assertEquals(onlineYearGrantInput(ok, null), { ok: false, reason: "no_purchase_time" });
  // A 100%-off order is a real order and is granted.
  assert(onlineYearGrantInput({ ...ok, payment_status: "no_payment_required" }, CREATED).ok);
});

// ── order key and label ─────────────────────────────────────────────────────

Deno.test("order key per band; label from the approved product names", () => {
  assertEquals(onlineYearOrderKey("sprouts"), "online_year_sprouts");
  assertEquals(onlineYearOrderKey("seedlings"), "online_year_seedlings");
  assertEquals(onlineYearOrderLabel(cart("sprouts", [["Ava", "first_child"]])), "Eden's Table Online Year: Sprouts (K-2), first child");
  assertEquals(onlineYearOrderLabel(cart("seedlings", [["Ava", "first_child"], ["Ben", "sibling"]])), "Eden's Table Online Year: Seedlings (3-5), first child + 1 sibling");
  assertEquals(onlineYearOrderLabel(cart("sprouts", [["Ava", "first_child"], ["Ben", "sibling"], ["Cy", "sibling"]])), "Eden's Table Online Year: Sprouts (K-2), first child + 2 siblings");
  assertEquals(onlineYearOrderLabel(cart("sprouts", [["Ben", "sibling"]])), "Eden's Table Online Year: Sprouts (K-2), sibling");
  assertEquals(onlineYearOrderLabel(cart("sprouts", [["Ben", "sibling"], ["Cy", "sibling"]])), "Eden's Table Online Year: Sprouts (K-2), 2 siblings");
});

// ── closing ─────────────────────────────────────────────────────────────────

Deno.test("close: a full refund and a dispute close; a partial refund and anything else do not", () => {
  assertEquals(onlineYearCloseReasonFor("charge.refunded", { refunded: true }), "refunded");
  assertEquals(onlineYearCloseReasonFor("charge.refunded", { refunded: false }), null);
  assertEquals(onlineYearCloseReasonFor("charge.refunded", null), null);
  assertEquals(onlineYearCloseReasonFor("charge.dispute.created"), "disputed");
  assertEquals(onlineYearCloseReasonFor("checkout.session.completed"), null);
});

// ── out-of-area flag ────────────────────────────────────────────────────────

Deno.test("country flag: U.S., Canada and Australia pass, in any case; anything else is flagged, card and billing apart", () => {
  assertEquals(onlineYearCountryFlags({ billingCountry: "US", cardCountry: "US" }), []);
  assertEquals(onlineYearCountryFlags({ billingCountry: "ca", cardCountry: "AU" }), []);
  assertEquals(onlineYearCountryFlags({ billingCountry: "GB", cardCountry: "US" }), [{ which: "billing", country: "GB" }]);
  assertEquals(onlineYearCountryFlags({ billingCountry: "US", cardCountry: "br" }), [{ which: "card", country: "BR" }]);
  assertEquals(onlineYearCountryFlags({ billingCountry: "DE", cardCountry: "DE" }), [{ which: "billing", country: "DE" }, { which: "card", country: "DE" }]);
  // Unknown (a non-card payment has no card country) is not a flag.
  assertEquals(onlineYearCountryFlags({ billingCountry: "US", cardCountry: null }), []);
  assertEquals(onlineYearCountryFlags({}), []);
});

Deno.test("country alert: names the order, says nothing was refunded or blocked, TEST on the twin", () => {
  const a = onlineYearOutOfAreaAlert({
    orderLabel: "Eden's Table Online Year: Sprouts (K-2), first child",
    orderNumber: "ET-1100",
    sessionId: "cs_1",
    email: "mom@example.com",
    typedCountry: "US",
    billingCountry: "US",
    cardCountry: "BR",
    flags: [{ which: "card", country: "BR" }],
    test: false,
  });
  assertEquals(a.subject, "Online Year order ET-1100 paid from outside the U.S., Canada and Australia");
  assert(a.text.includes("the card is from BR"));
  assert(a.text.includes("Nothing was refunded or blocked"));
  assert(a.text.includes("mom@example.com"));
  const t = onlineYearOutOfAreaAlert({ orderLabel: "x", orderNumber: null, sessionId: "cs_2", email: "e@x.co", typedCountry: null, billingCountry: "GB", cardCountry: null, flags: [{ which: "billing", country: "GB" }], test: true });
  assertEquals(t.subject, "TEST (E2E): Online Year order cs_2 paid from outside the U.S., Canada and Australia");
  assert(t.text.includes("the billing address is in GB"));
});
