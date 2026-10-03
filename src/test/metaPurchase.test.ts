// Meta Pixel Purchase for physical orders. Pinned: eventID is the raw session id
// (the server CAPI event's event_id, so Meta merges the two), content_ids are the
// feed skus, value matches GA4, digital-only orders send nothing, a reload never
// reports twice, nothing fires without Accept or without the Pixel, and a
// Stripe test-mode (E2E) order never reaches Meta.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderAnalytics } from "@/lib/ga4Purchase";

const CONSENT_KEY = "eden-marketing-consent";
const SESSION = "cs_live_books_1";

const order = (over: Partial<OrderAnalytics> = {}) => ({
  tax_cents: 0,
  currency: "usd",
  analytics: {
    shipping_cents: 1000,
    discount_cents: 0,
    items: [
      { sku: "bte_paperback_print", name: "Back to Eden, Paperback", unit_price_cents: 2499, quantity: 1, physical: true },
      { sku: "bte_study_guide_print", name: "Back to Eden, Study Guide", unit_price_cents: 4400, quantity: 2, physical: true },
    ],
    ...over,
  } as OrderAnalytics,
});

// metaTrack only fires once the Pixel was injected, which needs a live host.
// Stub metaPixel so these tests see exactly what reaches fbq.
const track = vi.fn();
vi.mock("@/lib/metaPixel", () => ({ metaTrack: (...a: unknown[]) => track(...a) }));

async function load() {
  vi.resetModules();
  return (await import("@/lib/metaPurchase")).reportMetaPurchaseOnce;
}

beforeEach(() => {
  localStorage.clear();
  track.mockReset();
  localStorage.setItem(CONSENT_KEY, "granted");
  (window as unknown as { fbq?: unknown }).fbq = () => {};
});

afterEach(() => {
  delete (window as unknown as { fbq?: unknown }).fbq;
  localStorage.clear();
});

describe("reportMetaPurchaseOnce", () => {
  it("sends Purchase with feed ids, GA4's value, and the session id as eventID", async () => {
    const report = await load();
    await report(SESSION, order());
    expect(track).toHaveBeenCalledTimes(1);
    const [name, params, eventID] = track.mock.calls[0];
    expect(name).toBe("Purchase");
    expect(eventID).toBe(SESSION);
    expect(params).toEqual({
      value: 112.99,
      currency: "USD",
      content_ids: ["bte_paperback_print", "bte_study_guide_print"],
      contents: [
        { id: "bte_paperback_print", quantity: 1, item_price: 24.99 },
        { id: "bte_study_guide_print", quantity: 2, item_price: 44 },
      ],
      content_type: "product",
      num_items: 3,
    });
  });

  it("sends once per order, even across a reload", async () => {
    await (await load())(SESSION, order());
    await (await load())(SESSION, order());
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for a digital-only order", async () => {
    await (await load())(SESSION, order({ items: [{ sku: "x", name: "PDF", unit_price_cents: 1499, quantity: 1, physical: false }] }));
    expect(track).not.toHaveBeenCalled();
  });

  it("sends nothing, and marks nothing, without Accept or without the Pixel", async () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    await (await load())(SESSION, order());
    localStorage.removeItem(CONSENT_KEY);
    await (await load())(SESSION, order());
    localStorage.setItem(CONSENT_KEY, "granted");
    delete (window as unknown as { fbq?: unknown }).fbq;
    await (await load())(SESSION, order());
    expect(track).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).some((k) => k.startsWith("meta_purchase_"))).toBe(false);
  });

  it("sends nothing, and marks nothing, for a Stripe test-mode (E2E) order", async () => {
    await (await load())("cs_test_books_1", order());
    expect(track).not.toHaveBeenCalled();
    expect(Object.keys(localStorage).some((k) => k.startsWith("meta_purchase_"))).toBe(false);
  });
});
