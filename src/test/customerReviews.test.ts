import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = { value: true };
vi.mock("@/lib/productionHost", () => ({ isProductionHost: () => live.value, thirdPartyTagsAllowed: () => live.value }));
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import {
  buildGcrOptIn,
  estimatedDeliveryDate,
  orderShips,
  showCustomerReviewsOptIn,
  showCustomerReviewsOptInForSession,
} from "@/lib/customerReviews";

const order = { order_number: "ET-1042", email: "buyer@example.com", placed_at: "2026-10-02T15:00:00Z", stage: "received", delivery_country: "US" };
const digital = { ...order, order_number: "ET-1043", analytics: { items: [] } };
const gcrScripts = () => document.querySelectorAll('script[src^="https://apis.google.com/js/platform.js"]').length;

function renderWith() {
  const render = vi.fn();
  (window as unknown as { gapi: unknown }).gapi = { load: (_m: string, cb: () => void) => cb(), surveyoptin: { render } };
  (window as unknown as { renderOptIn: () => void }).renderOptIn();
  return render;
}

describe("Google Customer Reviews opt-in", () => {
  beforeEach(() => {
    live.value = true;
    localStorage.clear();
    document.body.innerHTML = "";
    invoke.mockReset();
  });
  afterEach(() => {
    delete (window as unknown as { renderOptIn?: unknown }).renderOptIn;
    delete (window as unknown as { gapi?: unknown }).gapi;
  });

  it("delivery date is the Central-time date of the order + 21 days by default", () => {
    expect(estimatedDeliveryDate("2026-10-02T15:00:00Z")).toBe("2026-10-23");
    expect(estimatedDeliveryDate("2026-12-20T23:30:00Z")).toBe("2027-01-10");
    expect(estimatedDeliveryDate("nope")).toBeNull();
  });

  it("uses Central time, not UTC, near midnight", () => {
    // 9:30 pm Central on Oct 16 is already Oct 17 in UTC.
    expect(estimatedDeliveryDate("2026-10-17T02:30:00Z", 0)).toBe("2026-10-16");
    expect(estimatedDeliveryDate("2026-10-17T02:30:00Z", 21)).toBe("2026-11-06");
    // Across the end of daylight saving time (Nov 1, 2026).
    expect(estimatedDeliveryDate("2026-10-25T05:30:00Z", 21)).toBe("2026-11-15");
  });

  it("a printed order ships; a digital one ships only with a physical line", () => {
    expect(orderShips(order, "printed")).toBe(true);
    expect(orderShips(digital, "digital")).toBe(false);
    expect(orderShips({ ...digital, analytics: { items: [{ physical: false }, { physical: true }] } }, "digital")).toBe(true);
    expect(orderShips({ ...digital, analytics: null }, "digital")).toBe(false);
  });

  it("builds Google's parameters: +21 days printed, the order date digital", () => {
    expect(buildGcrOptIn(order, "printed")).toEqual({
      merchant_id: 5861058138,
      order_id: "ET-1042",
      email: "buyer@example.com",
      delivery_country: "US",
      estimated_delivery_date: "2026-10-23",
    });
    expect(buildGcrOptIn(digital, "digital")).toEqual({
      merchant_id: 5861058138,
      order_id: "ET-1043",
      email: "buyer@example.com",
      delivery_country: "US",
      estimated_delivery_date: "2026-10-02",
    });
    expect(buildGcrOptIn({ ...order, email: null }, "printed")).toBeNull();
    expect(buildGcrOptIn({ ...order, order_number: "" }, "printed")).toBeNull();
  });

  it("sends the order's own country, and US when it has none or a bad one", () => {
    expect(buildGcrOptIn({ ...digital, delivery_country: "ca" }, "digital")?.delivery_country).toBe("CA");
    for (const c of [null, undefined, "", "ZZ", "USA", "1"]) {
      expect(buildGcrOptIn({ ...digital, delivery_country: c }, "digital")?.delivery_country, String(c)).toBe("US");
    }
  });

  it("loads Google's script once per order and renders with the order", () => {
    showCustomerReviewsOptIn(order, "printed");
    showCustomerReviewsOptIn(order, "printed");
    expect(gcrScripts()).toBe(1);
    expect(renderWith()).toHaveBeenCalledWith(expect.objectContaining({ order_id: "ET-1042", estimated_delivery_date: "2026-10-23" }));
  });

  it("shows nothing off the live site, after Decline, or for a cancelled order", () => {
    live.value = false;
    showCustomerReviewsOptIn({ ...order, order_number: "A" }, "printed");
    live.value = true;
    localStorage.setItem("eden-marketing-consent", "denied");
    showCustomerReviewsOptIn({ ...order, order_number: "B" }, "printed");
    localStorage.clear();
    showCustomerReviewsOptIn({ ...order, order_number: "C", stage: "cancelled" }, "printed");
    expect(gcrScripts()).toBe(0);
  });

  describe("digital pages, by checkout session id", () => {
    it("waits for the order row, then shows the opt-in dated the order day", async () => {
      invoke
        .mockResolvedValueOnce({ data: { pending: true }, error: null })
        .mockResolvedValueOnce({ data: { ...digital, order_number: "ET-1050", delivery_country: "CA", pending: false }, error: null });
      await showCustomerReviewsOptInForSession("cs_live_abc", 0);
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(invoke).toHaveBeenCalledWith("print-order-status", { body: { session_id: "cs_live_abc" } });
      expect(gcrScripts()).toBe(1);
      expect(renderWith()).toHaveBeenCalledWith(
        expect.objectContaining({ order_id: "ET-1050", delivery_country: "CA", estimated_delivery_date: "2026-10-02" }),
      );
    });

    it("asks nothing without a session id, off the live site, or after Decline", async () => {
      await showCustomerReviewsOptInForSession(null, 0);
      live.value = false;
      await showCustomerReviewsOptInForSession("cs_live_abc", 0);
      live.value = true;
      localStorage.setItem("eden-marketing-consent", "denied");
      await showCustomerReviewsOptInForSession("cs_live_abc", 0);
      expect(invoke).not.toHaveBeenCalled();
      expect(gcrScripts()).toBe(0);
    });

    it("gives up quietly when the order never appears or the lookup fails", async () => {
      invoke.mockResolvedValue({ data: { pending: true }, error: null });
      await showCustomerReviewsOptInForSession("cs_live_pending", 0);
      expect(invoke).toHaveBeenCalledTimes(8);
      invoke.mockReset();
      invoke.mockRejectedValue(new Error("network"));
      await expect(showCustomerReviewsOptInForSession("cs_live_err", 0)).resolves.toBeUndefined();
      expect(gcrScripts()).toBe(0);
    });

    it("shows nothing for a refunded digital order", async () => {
      invoke.mockResolvedValueOnce({ data: { ...digital, order_number: "ET-1051", stage: "cancelled", pending: false }, error: null });
      await showCustomerReviewsOptInForSession("cs_live_refunded", 0);
      expect(gcrScripts()).toBe(0);
    });
  });
});
