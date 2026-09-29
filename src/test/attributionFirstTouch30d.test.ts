/**
 * First-touch attribution kept for 30 days (founder request 2026-09-28).
 *
 * The makers market wall is scan-now-buy-later: a shopper scans a herb label at
 * Miss Lucille's, closes the tab, and orders from home. Pins: the source survives a
 * closed tab; it expires after 30 days; first touch is not overwritten by a later
 * tagged visit; a visitor who tapped Decline gets nothing persistent (and any old
 * copy is removed); and broken storage never throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_TOUCH_TTL_MS,
  captureFirstTouch,
  getCheckoutAttribution,
} from "@/lib/attribution";

const PERSIST_KEY = "eden_first_touch_30d_v1";
const SESSION_KEY = "eden_first_touch_v1";
const CONSENT_KEY = "eden-marketing-consent";

const LABEL_URL =
  "/homeschool?utm_source=makers_market&utm_medium=herb_label&utm_content=chamomile";

function visit(url: string) {
  window.history.replaceState({}, "", url);
}

function closeTab() {
  window.sessionStorage.clear();
}

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

describe("30-day first touch", () => {
  it("survives closing the tab: scan at the market, buy at home later", () => {
    visit(LABEL_URL);
    captureFirstTouch();
    closeTab();
    visit("/back-to-eden");
    expect(getCheckoutAttribution()).toMatchObject({
      utm_source: "makers_market",
      utm_medium: "herb_label",
      utm_content: "chamomile",
    });
  });

  it("expires after 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    visit(LABEL_URL);
    captureFirstTouch();
    closeTab();

    vi.setSystemTime(new Date(Date.parse("2026-10-01T12:00:00Z") + FIRST_TOUCH_TTL_MS + 1000));
    visit("/back-to-eden");
    expect(getCheckoutAttribution()).toEqual({});
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("stays first touch: a later tagged visit does not overwrite it", () => {
    visit(LABEL_URL);
    captureFirstTouch();
    closeTab();

    visit("/freebies?utm_source=pinterest&utm_medium=pin");
    captureFirstTouch();
    expect(getCheckoutAttribution()).toMatchObject({ utm_source: "makers_market" });
  });

  it("a visitor who tapped Decline gets the tab-only copy and nothing persistent", () => {
    window.localStorage.setItem(CONSENT_KEY, "denied");
    visit(LABEL_URL);
    captureFirstTouch();
    expect(window.sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
    closeTab();
    visit("/back-to-eden");
    expect(getCheckoutAttribution()).toEqual({});
  });

  it("Decline after the fact removes an existing 30-day copy", () => {
    visit(LABEL_URL);
    captureFirstTouch();
    expect(window.localStorage.getItem(PERSIST_KEY)).not.toBeNull();
    closeTab();

    window.localStorage.setItem(CONSENT_KEY, "denied");
    visit("/back-to-eden");
    expect(getCheckoutAttribution()).toEqual({});
    expect(window.localStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("ignores a corrupt stored copy instead of throwing", () => {
    window.localStorage.setItem(PERSIST_KEY, "{not json");
    expect(() => getCheckoutAttribution()).not.toThrow();
    expect(getCheckoutAttribution()).toEqual({});
  });

  it("never throws when localStorage itself is broken", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    visit(LABEL_URL);
    expect(() => captureFirstTouch()).not.toThrow();
    expect(getCheckoutAttribution()).toMatchObject({ utm_source: "makers_market" });
  });
});
