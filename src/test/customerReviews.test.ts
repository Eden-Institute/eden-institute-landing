import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = { value: true };
vi.mock("@/lib/productionHost", () => ({ isProductionHost: () => live.value }));

import { buildGcrOptIn, estimatedDeliveryDate, showCustomerReviewsOptIn } from "@/lib/customerReviews";

const order = { order_number: "ET-1042", email: "buyer@example.com", placed_at: "2026-10-02T15:00:00Z", stage: "received" };
const gcrScripts = () => document.querySelectorAll('script[src^="https://apis.google.com/js/platform.js"]').length;

describe("Google Customer Reviews opt-in", () => {
  beforeEach(() => {
    live.value = true;
    localStorage.clear();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    delete (window as unknown as { renderOptIn?: unknown }).renderOptIn;
  });

  it("delivery date is order date + 21 days", () => {
    expect(estimatedDeliveryDate("2026-10-02T15:00:00Z")).toBe("2026-10-23");
    expect(estimatedDeliveryDate("2026-12-20T23:30:00Z")).toBe("2027-01-10");
    expect(estimatedDeliveryDate("nope")).toBeNull();
  });

  it("builds Google's parameters", () => {
    expect(buildGcrOptIn(order)).toEqual({
      merchant_id: 5861058138,
      order_id: "ET-1042",
      email: "buyer@example.com",
      delivery_country: "US",
      estimated_delivery_date: "2026-10-23",
    });
    expect(buildGcrOptIn({ ...order, email: null })).toBeNull();
    expect(buildGcrOptIn({ ...order, order_number: "" })).toBeNull();
  });

  it("loads Google's script once per order and renders with the order", () => {
    showCustomerReviewsOptIn(order);
    showCustomerReviewsOptIn(order);
    expect(gcrScripts()).toBe(1);
    const render = vi.fn();
    (window as unknown as { gapi: unknown }).gapi = { load: (_m: string, cb: () => void) => cb(), surveyoptin: { render } };
    (window as unknown as { renderOptIn: () => void }).renderOptIn();
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ order_id: "ET-1042", estimated_delivery_date: "2026-10-23" }));
  });

  it("shows nothing off the live site, after Decline, or for a cancelled order", () => {
    live.value = false;
    showCustomerReviewsOptIn({ ...order, order_number: "A" });
    live.value = true;
    localStorage.setItem("eden-marketing-consent", "denied");
    showCustomerReviewsOptIn({ ...order, order_number: "B" });
    localStorage.clear();
    showCustomerReviewsOptIn({ ...order, order_number: "C", stage: "cancelled" });
    expect(gcrScripts()).toBe(0);
  });
});
