// Server-side GA4 (2026-10-28): what stripe-webhook sends, and when it does not.
// The webhook wiring itself runs in Deno; these pin the pure rules it relies on.
import { describe, expect, it, vi } from "vitest";
import {
  buildPurchase,
  buildRefund,
  checkoutRef,
  decideGa4,
  fallbackClientId,
  ga4VisitorFromMetadata,
  gaVisitorToMetadata,
  sendGa4,
} from "../../supabase/functions/_shared/ga4-mp";
import { checkoutAttributionMetadata } from "../../supabase/functions/_shared/purchase-attribution";
import { checkoutRef as browserCheckoutRef } from "@/lib/pinterestTag";

const LIVE = { livemode: true, e2e: false, isInternal: false, consent: null, hasSecret: true } as const;

describe("visitor metadata", () => {
  it("passes only well-formed ids and the two consent words", () => {
    expect(gaVisitorToMetadata({ client_id: "1234567890.1700000000", session_id: "1700000123", consent: "granted" })).toEqual({
      ga_client_id: "1234567890.1700000000",
      ga_session_id: "1700000123",
      ga_consent: "granted",
    });
    expect(gaVisitorToMetadata({ client_id: "GA1.1.123.456", session_id: "abc", consent: "yes" })).toEqual({});
    expect(gaVisitorToMetadata("nope")).toEqual({});
    expect(gaVisitorToMetadata(null)).toEqual({});
  });

  it("rides into the checkout metadata beside the attribution", () => {
    const meta = checkoutAttributionMetadata({
      attribution: { utm_source: "pinterest", ga: { client_id: "1.2", session_id: "1700000123", consent: "denied" } },
    });
    expect(meta).toMatchObject({ attr_utm_source: "pinterest", ga_client_id: "1.2", ga_session_id: "1700000123", ga_consent: "denied" });
  });

  it("re-validates on the way out of Stripe", () => {
    expect(ga4VisitorFromMetadata({ ga_client_id: "1.2", ga_session_id: "1700000123", ga_consent: "denied" })).toEqual({
      clientId: "1.2",
      sessionId: "1700000123",
      consent: "denied",
    });
    expect(ga4VisitorFromMetadata({ ga_client_id: "edited by hand", ga_consent: "maybe" })).toEqual({
      clientId: null,
      sessionId: null,
      consent: null,
    });
    expect(ga4VisitorFromMetadata(null)).toEqual({ clientId: null, sessionId: null, consent: null });
  });
});

describe("decideGa4", () => {
  it("sends a live, outside, undeclined sale when the secret is set", () => {
    expect(decideGa4(LIVE)).toBeNull();
    expect(decideGa4({ ...LIVE, consent: "granted" })).toBeNull();
  });
  it("names every reason it does not", () => {
    expect(decideGa4({ ...LIVE, livemode: false })).toBe("skipped_test");
    expect(decideGa4({ ...LIVE, e2e: true })).toBe("skipped_test");
    expect(decideGa4({ ...LIVE, isInternal: true })).toBe("skipped_internal");
    expect(decideGa4({ ...LIVE, consent: "denied" })).toBe("skipped_declined");
    expect(decideGa4({ ...LIVE, hasSecret: false })).toBe("skipped_no_secret");
  });
});

describe("ids", () => {
  it("derives the same checkout reference as the browser, never the session id", async () => {
    const sid = "cs_live_b1qUnDMJC0LuL5ehAiPij6ajcKU6ycIAQvBGrYLLAwga0Iau1mWASCG9Y0";
    const server = await checkoutRef(sid);
    expect(server).toBe(await browserCheckoutRef(sid));
    expect(server).toMatch(/^[0-9a-f]{32}$/);
    expect(server).not.toContain("cs_live");
  });

  it("gives a stable, GA-shaped fallback client id", () => {
    const a = fallbackClientId("sub_1TvI7M2NWfYbCZT89etghz8s", 1700000000);
    expect(a).toMatch(/^\d{10}\.1700000000$/);
    expect(fallbackClientId("sub_1TvI7M2NWfYbCZT89etghz8s", 1700000000)).toBe(a);
    expect(fallbackClientId("sub_other", 1700000000)).not.toBe(a);
  });
});

describe("payloads", () => {
  it("purchase: value is the full amount the ledger records, joined to the visit", () => {
    const now = Math.floor(Date.now() / 1000);
    const p = buildPurchase({
      clientId: "1.2",
      sessionId: "1700000123",
      transactionId: "abc",
      valueCents: 2900,
      currency: "usd",
      taxCents: 0,
      shippingCents: 0,
      items: [{ item_id: "bte_study_journal_digital", item_name: "Back to Eden: Study & Journal Edition, digital (PDF)", price: 29, quantity: 1 }],
      epochSeconds: now,
    });
    expect(p.client_id).toBe("1.2");
    expect(p.timestamp_micros).toBe(String(now * 1_000_000));
    expect(p.events[0].name).toBe("purchase");
    expect(p.events[0].params).toMatchObject({ transaction_id: "abc", value: 29, currency: "USD", tax: 0, shipping: 0, session_id: "1700000123" });
  });

  it("purchase: tax and shipping are reported but stay inside value", () => {
    const p = buildPurchase({
      clientId: "1.2", sessionId: null, transactionId: "t", valueCents: 28580, currency: "usd",
      taxCents: 1830, shippingCents: 1850, items: [], epochSeconds: null,
    });
    expect(p.events[0].params).toMatchObject({ value: 285.8, tax: 18.3, shipping: 18.5 });
    expect(p.events[0].params).not.toHaveProperty("session_id");
    expect(p).not.toHaveProperty("timestamp_micros");
  });

  it("drops a timestamp older than GA accepts", () => {
    const p = buildPurchase({ clientId: "1.2", sessionId: null, transactionId: "t", valueCents: 100, currency: "usd", items: [], epochSeconds: 1_000_000_000 });
    expect(p).not.toHaveProperty("timestamp_micros");
  });

  it("refund: the refunded amount against the sale's transaction id", () => {
    const r = buildRefund({ clientId: "1.2", transactionId: "abc", valueCents: 3299, currency: "usd", epochSeconds: null });
    expect(r.events).toEqual([{ name: "refund", params: { transaction_id: "abc", value: 32.99, currency: "USD" } }]);
  });
});

describe("sendGa4", () => {
  it("posts JSON to the Measurement Protocol with the measurement id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const res = await sendGa4({ client_id: "1.2", events: [] }, "s3cret", fetchImpl as unknown as typeof fetch);
    expect(res.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://www.google-analytics.com/mp/collect?measurement_id=G-5DVHEZPKL0&api_secret=s3cret");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ client_id: "1.2", events: [] });
  });

  it("never throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));
    await expect(sendGa4({ client_id: "1.2", events: [] }, "s", fetchImpl as unknown as typeof fetch)).resolves.toEqual({ ok: false, status: 0 });
  });
});
