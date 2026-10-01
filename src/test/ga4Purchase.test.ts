// GA4 purchase for Merchant Center. Pinned: item_id is the feed sku, value is
// physical goods after discount and before shipping/tax, digital lines are left
// out, the raw session id never reaches gtag, a reload never reports twice, and
// a visitor who clicked Decline sends nothing.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildGa4Purchase, reportGa4PurchaseOnce, type OrderAnalytics } from "@/lib/ga4Purchase";

const CONSENT_KEY = "eden-marketing-consent";
const SESSION = "cs_test_books_1";
const REF = "83ee5ded323268fed15d671f1fad79d6"; // first 32 of sha256(cs_test_books_1)

const set = (over: Partial<OrderAnalytics> = {}): OrderAnalytics => ({
  shipping_cents: 1200,
  discount_cents: 0,
  items: [{ sku: "sprouts_print_set", name: "Sprouts Printed Curriculum Set", unit_price_cents: 24900, quantity: 1, physical: true }],
  ...over,
});

describe("buildGa4Purchase", () => {
  it("reports a printed set with feed id, subtotal, shipping and tax", () => {
    expect(buildGa4Purchase("ref", set(), 2480, "usd")).toEqual({
      transaction_id: "ref",
      value: 249,
      currency: "USD",
      shipping: 12,
      tax: 24.8,
      items: [{ item_id: "sprouts_print_set", item_name: "Sprouts Printed Curriculum Set", price: 249, quantity: 1 }],
    });
  });

  it("takes a Stripe discount off value and carries it per unit (ET-1032 shape)", () => {
    const p = buildGa4Purchase("ref", set({ discount_cents: 20100, items: [{ sku: "seedlings_print_set", name: "Seedlings", unit_price_cents: 24900, quantity: 1, physical: true }] }), 570, "usd")!;
    expect(p.value).toBe(48);
    expect(p.items[0]).toMatchObject({ item_id: "seedlings_print_set", price: 249, discount: 201 });
  });

  it("reports every Back to Eden line in a multi-item order (ET-1035 shape)", () => {
    const p = buildGa4Purchase("ref", set({ shipping_cents: 1000, items: [
      { sku: "bte_paperback_print", name: "Back to Eden, Paperback", unit_price_cents: 2499, quantity: 1, physical: true },
      { sku: "bte_study_guide_print", name: "Back to Eden, Study Guide", unit_price_cents: 4400, quantity: 1, physical: true },
    ] }), 0, "usd")!;
    expect(p.value).toBe(68.99);
    expect(p.shipping).toBe(10);
    expect(p.items.map((i) => i.item_id)).toEqual(["bte_paperback_print", "bte_study_guide_print"]);
  });

  it("leaves digital lines out of items and value, sharing a discount by list total", () => {
    const p = buildGa4Purchase("ref", set({ discount_cents: 1000, items: [
      { sku: "sprouts_print_set", name: "Set", unit_price_cents: 24900, quantity: 1, physical: true },
      { sku: "some_pdf", name: "PDF", unit_price_cents: 100, quantity: 1, physical: false },
    ] }), 0, "usd")!;
    expect(p.items.map((i) => i.item_id)).toEqual(["sprouts_print_set"]);
    expect(p.value).toBe(239.04); // 249 - 9.96 (its 24900/25000 share of 10.00)
  });

  it("returns null when nothing physical was bought", () => {
    expect(buildGa4Purchase("ref", set({ items: [{ sku: "x", name: "PDF", unit_price_cents: 3900, quantity: 1, physical: false }] }), 0, "usd")).toBeNull();
  });
});

describe("reportGa4PurchaseOnce", () => {
  let calls: unknown[][];
  beforeEach(() => {
    calls = [];
    localStorage.clear();
    (window as unknown as { gtag: unknown }).gtag = (...args: unknown[]) => calls.push(args);
  });
  afterEach(() => {
    localStorage.clear();
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("fires one purchase, keyed by the hashed reference, never the session id", async () => {
    await reportGa4PurchaseOnce(SESSION, { analytics: set(), tax_cents: 0, currency: "usd" });
    await reportGa4PurchaseOnce(SESSION, { analytics: set(), tax_cents: 0, currency: "usd" });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("event");
    expect(calls[0][1]).toBe("purchase");
    expect((calls[0][2] as { transaction_id: string }).transaction_id).toBe(REF);
    expect(JSON.stringify(calls)).not.toContain(SESSION);
    expect(localStorage.getItem(`ga4_purchase_${REF}`)).toBe("1");
  });

  it("sends nothing after Decline", async () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    await reportGa4PurchaseOnce(SESSION, { analytics: set(), tax_cents: 0, currency: "usd" });
    expect(calls).toHaveLength(0);
  });

  it("sends nothing for an older print-order-status with no analytics block", async () => {
    await reportGa4PurchaseOnce(SESSION, { tax_cents: 0, currency: "usd" });
    expect(calls).toHaveLength(0);
  });
});
