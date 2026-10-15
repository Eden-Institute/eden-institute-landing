/**
 * Google Ads click ids into the checkout (2026-10-15).
 *
 * Pins: gclid / gbraid / wbraid ride into the Stripe session metadata as attr_*,
 * only as well-formed tokens; they never become order columns (no migration, the
 * webhook's write is unchanged); fbclid is never carried; in the browser the
 * LATEST ad click wins and is held 90 days; signups never send it; a visitor who
 * tapped Decline keeps nothing; broken storage never throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLICK_ID_FIELDS,
  attributionColumnsFromMetadata,
  checkoutAttributionMetadata,
  sanitizeClickIds,
} from "../../supabase/functions/_shared/purchase-attribution";
import {
  GOOGLE_CLICK_TTL_MS,
  captureFirstTouch,
  getAttribution,
  getCheckoutAttribution,
} from "@/lib/attribution";

const CLICK_KEY = "eden_google_click_v1";
const CONSENT_KEY = "eden-marketing-consent";
const GCLID = "Cj0KCQjw-abc_123XYZ";

function visit(url: string) {
  window.history.replaceState({}, "", url);
}

describe("sanitizeClickIds (server)", () => {
  it("keeps well-formed Google click ids", () => {
    expect(sanitizeClickIds({ gclid: ` ${GCLID} `, gbraid: "0AAAAA-x_1", wbraid: "CkAB" })).toEqual({
      gclid: GCLID,
      gbraid: "0AAAAA-x_1",
      wbraid: "CkAB",
    });
  });

  it("drops anything that is not a token, too long, or not a string", () => {
    expect(sanitizeClickIds({ gclid: "a b" })).toEqual({});
    expect(sanitizeClickIds({ gclid: "x<script>" })).toEqual({});
    expect(sanitizeClickIds({ gclid: "a".repeat(201) })).toEqual({});
    expect(sanitizeClickIds({ gclid: 42, gbraid: null, wbraid: "" })).toEqual({});
    for (const raw of [null, undefined, "str", [GCLID]]) expect(sanitizeClickIds(raw)).toEqual({});
  });

  it("goes into session metadata as attr_*, beside the UTMs", () => {
    const meta = checkoutAttributionMetadata({ attribution: { utm_source: "google", gclid: GCLID } });
    expect(meta).toEqual({ attr_utm_source: "google", attr_gclid: GCLID });
    for (const f of CLICK_ID_FIELDS) expect(`attr_${f}`.length).toBeLessThanOrEqual(40);
  });

  it("never carries fbclid", () => {
    expect(checkoutAttributionMetadata({ attribution: { fbclid: "IwAR0abc" } })).toEqual({});
  });

  it("never becomes an order column (no migration, webhook write unchanged)", () => {
    expect(attributionColumnsFromMetadata({ attr_gclid: GCLID })).toBeNull();
    expect(attributionColumnsFromMetadata({ attr_utm_source: "google", attr_gclid: GCLID })).toEqual({ attr_utm_source: "google" });
  });
});

describe("Google click ids in the browser", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    visit("/");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("an ad click reaches the checkout, and never a signup", () => {
    visit(`/books?utm_source=google&gclid=${GCLID}`);
    captureFirstTouch();
    window.sessionStorage.clear();
    visit("/books/thank-you");
    expect(getCheckoutAttribution()).toMatchObject({ utm_source: "google", gclid: GCLID });
    expect(getAttribution()).not.toHaveProperty("gclid");
  });

  it("the latest ad click wins, even though first touch does not change", () => {
    visit("/freebies?utm_source=pinterest");
    captureFirstTouch();
    visit(`/books?gclid=${GCLID}`);
    captureFirstTouch();
    expect(getCheckoutAttribution()).toMatchObject({ utm_source: "pinterest", gclid: GCLID });
    visit("/books?gclid=second_click");
    captureFirstTouch();
    expect(getCheckoutAttribution().gclid).toBe("second_click");
  });

  it("expires after 90 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    visit(`/books?gclid=${GCLID}`);
    captureFirstTouch();
    vi.setSystemTime(new Date(Date.parse("2026-10-01T12:00:00Z") + GOOGLE_CLICK_TTL_MS + 1000));
    // Back on a page with no click id: an id in the current URL is a fresh click.
    visit("/books");
    expect(getCheckoutAttribution()).not.toHaveProperty("gclid");
    expect(window.localStorage.getItem(CLICK_KEY)).toBeNull();
  });

  it("a visitor who tapped Decline keeps nothing, and Decline removes an old one", () => {
    visit(`/books?gclid=${GCLID}`);
    captureFirstTouch();
    expect(window.localStorage.getItem(CLICK_KEY)).not.toBeNull();
    window.localStorage.setItem(CONSENT_KEY, "denied");
    expect(getCheckoutAttribution()).not.toHaveProperty("gclid");
    expect(window.localStorage.getItem(CLICK_KEY)).toBeNull();
    visit("/books?gclid=after_decline");
    captureFirstTouch();
    expect(window.localStorage.getItem(CLICK_KEY)).toBeNull();
  });

  it("never throws when localStorage itself is broken", () => {
    visit(`/books?gclid=${GCLID}`);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => captureFirstTouch()).not.toThrow();
    expect(() => getCheckoutAttribution()).not.toThrow();
  });
});
