// GA4 purchase for digital orders (2026-10-07). Pinned: value is the amount paid
// after discount minus tax, item_id is the order's lookup_key with the page's id as
// fallback, the raw session id never reaches gtag, one order is reported once
// (sharing the print event's key), it waits out a pending order row, and Decline,
// test-mode and refunded orders send nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { buildGa4DigitalPurchase, reportGa4DigitalPurchaseOnce } from "@/lib/ga4DigitalPurchase";

const CONSENT_KEY = "eden-marketing-consent";
const SESSION = "cs_live_books_1";
const REF = "f1899b9932ea9a7a8519dc917af56a1e"; // first 32 of sha256(cs_live_books_1)
const FALLBACK = { id: "sprouts_starter_unit", name: "Sprouts Starter Unit" };

const starter = { pending: false, stage: "received", lookup_key: "sprouts_starter_unit", product_label: "Sprouts Starter Unit, Digital Curriculum, Weeks 1 to 9", amount_total_cents: 3900, tax_cents: 0, currency: "usd" };

describe("buildGa4DigitalPurchase", () => {
  it("reports a $39 Starter Unit (ET-1033 shape)", () => {
    expect(buildGa4DigitalPurchase("ref", starter, FALLBACK)).toEqual({
      transaction_id: "ref",
      value: 39,
      currency: "USD",
      tax: 0,
      items: [{ item_id: "sprouts_starter_unit", item_name: "Sprouts Starter Unit, Digital Curriculum, Weeks 1 to 9", price: 39, quantity: 1 }],
    });
  });

  it("uses the amount actually paid after a code, without tax (ET-1036 shape)", () => {
    const p = buildGa4DigitalPurchase("ref", { lookup_key: "bte_paperback_digital", product_label: "Back to Eden PDF", amount_total_cents: 110, tax_cents: 10, currency: "usd" }, FALLBACK)!;
    expect(p.value).toBe(1);
    expect(p.tax).toBe(0.1);
    expect(p.items[0].item_id).toBe("bte_paperback_digital");
  });

  it("falls back to the page's product id and name when the order has none", () => {
    const p = buildGa4DigitalPurchase("ref", { amount_total_cents: 499, tax_cents: 0 }, { id: "deep_dive_guide", name: "Deep-Dive Guide" })!;
    expect(p.items[0]).toEqual({ item_id: "deep_dive_guide", item_name: "Deep-Dive Guide", price: 4.99, quantity: 1 });
    expect(p.currency).toBe("USD");
  });

  it("returns null when the order carries no amount", () => {
    expect(buildGa4DigitalPurchase("ref", { lookup_key: "x" }, FALLBACK)).toBeNull();
  });
});

describe("reportGa4DigitalPurchaseOnce", () => {
  let calls: unknown[][];
  beforeEach(() => {
    calls = [];
    localStorage.clear();
    invoke.mockReset();
    (window as unknown as { gtag: unknown }).gtag = (...args: unknown[]) => calls.push(args);
  });
  afterEach(() => {
    localStorage.clear();
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("fires one purchase, keyed by the hashed reference, never the session id", async () => {
    invoke.mockResolvedValue({ data: starter, error: null });
    await reportGa4DigitalPurchaseOnce(SESSION, FALLBACK, 0);
    await reportGa4DigitalPurchaseOnce(SESSION, FALLBACK, 0);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe("purchase");
    expect((calls[0][2] as { transaction_id: string; value: number }).transaction_id).toBe(REF);
    expect((calls[0][2] as { value: number }).value).toBe(39);
    expect(JSON.stringify(calls)).not.toContain(SESSION);
    expect(localStorage.getItem(`ga4_purchase_${REF}`)).toBe("1");
  });

  it("waits for a pending order row, then reports it", async () => {
    invoke.mockResolvedValueOnce({ data: { pending: true }, error: null }).mockResolvedValue({ data: starter, error: null });
    await reportGa4DigitalPurchaseOnce("cs_live_digital_pending", FALLBACK, 0);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(1);
  });

  it("does nothing when the print event already reported this order", async () => {
    localStorage.setItem(`ga4_purchase_${REF}`, "1");
    invoke.mockResolvedValue({ data: starter, error: null });
    await reportGa4DigitalPurchaseOnce(SESSION, FALLBACK, 0);
    expect(calls).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sends nothing after Decline", async () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    invoke.mockResolvedValue({ data: starter, error: null });
    await reportGa4DigitalPurchaseOnce("cs_live_digital_declined", FALLBACK, 0);
    expect(calls).toHaveLength(0);
  });

  it("sends nothing for a refunded order", async () => {
    invoke.mockResolvedValue({ data: { ...starter, stage: "cancelled" }, error: null });
    await reportGa4DigitalPurchaseOnce("cs_live_digital_refunded", FALLBACK, 0);
    expect(calls).toHaveLength(0);
  });

  it("sends nothing, and marks nothing, for a Stripe test-mode (E2E) order", async () => {
    invoke.mockResolvedValue({ data: starter, error: null });
    await reportGa4DigitalPurchaseOnce("cs_test_books_1", FALLBACK, 0);
    expect(calls).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).some((k) => k.startsWith("ga4_purchase_"))).toBe(false);
  });

  it("gives up quietly when the order never appears", async () => {
    invoke.mockResolvedValue({ data: { pending: true }, error: null });
    await reportGa4DigitalPurchaseOnce("cs_live_digital_never", FALLBACK, 0);
    expect(calls).toHaveLength(0);
  });
});
