/**
 * Last MARKED touch beside the first touch (founder approved 2026-10-18).
 *
 * First touch never credits the nurture email or Friday note that brings a buyer
 * back to buy. Pins: the most recent arrival with UTMs, an ad click id or another
 * site's referrer is the last touch; clicks inside the site (even tagged ones),
 * direct visits, Stripe/Klarna returns, in-app route changes, reloads and
 * back/forward never overwrite it; an ad click keeps only its NAME; it is held 90
 * days under the first-touch consent rule; first touch is unchanged; the server
 * carries it as attr_last_* inside Stripe's limits and maps it to its own columns;
 * the founder Orders tab reads it as "Sales by last source".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATTRIBUTION_FIELDS,
  CLICK_MARKERS,
  attributionColumnsFromMetadata,
  checkoutAttributionMetadata,
  lastTouchColumnsFromMetadata,
  sanitizeLastTouch,
} from "../../supabase/functions/_shared/purchase-attribution";
import {
  LAST_TOUCH_TTL_MS,
  captureFirstTouch,
  getAttribution,
  getCheckoutAttribution,
  resetLastTouchForTests,
} from "@/lib/attribution";
import { NO_LAST_TOUCH, orderLastSourceText, salesByLastSource } from "@/components/founder/OrdersTab";

// OrdersTab imports the client at module load; only its pure helpers are under test.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const LAST_SESSION_KEY = "eden_last_touch_v1";
const LAST_PERSIST_KEY = "eden_last_touch_90d_v1";
const CONSENT_KEY = "eden-marketing-consent";
const GCLID = "Cj0KCQjw-abc_123XYZ";

const PIN = "/freebies?utm_source=pinterest&utm_medium=pin&utm_content=chamomile_tea";
const NURTURE = "/homeschool?utm_source=email&utm_medium=nurture&utm_content=free_week_day_3";

/** A new page load: fresh module state, this URL and referrer, and a Navigation
 *  Timing entry of the given type for this very URL. */
function arrive(url: string, referrer = "", type: NavigationTimingType = "navigate", navUrl?: string) {
  resetLastTouchForTests();
  window.history.replaceState({}, "", url);
  vi.spyOn(document, "referrer", "get").mockReturnValue(referrer);
  const entry = { name: navUrl ?? window.location.href, type } as unknown as PerformanceEntry;
  window.performance.getEntriesByType = vi.fn(() => [entry]) as unknown as Performance["getEntriesByType"];
  captureFirstTouch();
}

function closeTab() {
  window.sessionStorage.clear();
}

const at = (path: string) => window.location.origin + path;

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  // arrive() shadows the prototype method with an own property; drop it.
  delete (window.performance as unknown as Record<string, unknown>).getEntriesByType;
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("last marked touch in the browser", () => {
  it("the email that brings a buyer back is the last touch; the first touch stays", () => {
    arrive(PIN, "https://www.pinterest.com/");
    closeTab();
    arrive(NURTURE, "https://mail.google.com/");
    closeTab();
    arrive("/books");

    const a = getCheckoutAttribution();
    expect(a).toMatchObject({ utm_source: "pinterest", utm_medium: "pin", utm_content: "chamomile_tea" });
    expect(a.last).toEqual({
      utm_source: "email",
      utm_medium: "nurture",
      utm_content: "free_week_day_3",
      referrer: "https://mail.google.com/",
      source_url: at("/homeschool"),
    });
  });

  it("one marked visit is both first and last", () => {
    arrive(PIN);
    const a = getCheckoutAttribution();
    expect(a.utm_source).toBe("pinterest");
    expect(a.last).toEqual({ utm_source: "pinterest", utm_medium: "pin", utm_content: "chamomile_tea", source_url: at("/freebies") });
  });

  it("a click inside the site never counts, even on a tagged button", () => {
    arrive(NURTURE, "https://mail.google.com/");
    arrive("/homeschool?utm_source=modal&utm_medium=post_signup", "https://edeninstitute.health/freebies");
    arrive("/homeschool?utm_source=modal&utm_medium=post_signup", "https://www.edeninstitute.health/");
    arrive("/books?utm_source=modal", at("/freebies"));
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
  });

  it("a direct visit or a bookmark changes nothing", () => {
    arrive(NURTURE, "https://mail.google.com/");
    closeTab();
    arrive("/books");
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
  });

  it("a return from Stripe or Klarna is not a source", () => {
    arrive(NURTURE);
    arrive("/books?checkout=cancelled", "https://checkout.stripe.com/");
    arrive("/books", "https://js.playground.klarna.com/");
    arrive("/books", "https://link.com/");
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
  });

  it("another website counts even with no tags", () => {
    arrive(NURTURE);
    arrive("/learn/is-herbalism-biblical", "https://www.facebook.com/");
    expect(getCheckoutAttribution().last).toEqual({
      referrer: "https://www.facebook.com/",
      source_url: at("/learn/is-herbalism-biblical"),
    });
  });

  it("an untagged ad click is labelled by kind, never by its id", () => {
    arrive(`/books?gclid=${GCLID}`, "https://www.google.com/");
    const google = getCheckoutAttribution().last;
    expect(google).toEqual({ click: "gclid", referrer: "https://www.google.com/", source_url: at("/books") });
    expect(JSON.stringify(google)).not.toContain(GCLID);

    arrive("/freebies?fbclid=IwAR0secret");
    const fb = getCheckoutAttribution().last;
    expect(fb).toEqual({ click: "fbclid", source_url: at("/freebies") });
    expect(JSON.stringify(fb)).not.toContain("IwAR0secret");
  });

  it("an in-app route change is not a new arrival (the referrer is the ORIGINAL one)", () => {
    arrive(NURTURE, "https://mail.google.com/");
    // Same page load: the app routes on, document.referrer still says Gmail.
    window.history.replaceState({}, "", "/apothecary/pricing");
    captureFirstTouch();
    getCheckoutAttribution();
    expect(getCheckoutAttribution().last?.source_url).toBe(at("/homeschool"));

    // Same page, its query rewritten (tags gone), Gmail still the referrer: still
    // the same arrival, so it must not replace the tagged one with a bare referrer.
    arrive(NURTURE, "https://mail.google.com/");
    window.history.replaceState({}, "", "/homeschool?band=seedlings");
    captureFirstTouch();
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");

    // A page load whose FIRST capture happens after routing away from where it landed.
    arrive("/apothecary/pricing", "https://www.facebook.com/", "navigate", at("/apothecary/auth"));
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
  });

  it("a reload or back/forward replays an old arrival, so it never overwrites", () => {
    arrive(NURTURE, "https://mail.google.com/");
    arrive(PIN, "https://www.pinterest.com/", "back_forward");
    arrive(PIN, "https://www.pinterest.com/", "reload");
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
  });

  it("survives closing the tab, is held 90 days, then dropped", () => {
    vi.useFakeTimers();
    const t0 = Date.parse("2026-10-18T12:00:00Z");
    vi.setSystemTime(new Date(t0));
    arrive(NURTURE);
    closeTab();

    vi.setSystemTime(new Date(t0 + LAST_TOUCH_TTL_MS - 1000));
    arrive("/books");
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
    closeTab();

    vi.setSystemTime(new Date(t0 + LAST_TOUCH_TTL_MS + 1000));
    arrive("/books");
    expect(getCheckoutAttribution()).not.toHaveProperty("last");
    expect(window.localStorage.getItem(LAST_PERSIST_KEY)).toBeNull();
  });

  it("the newer of the tab copy and the kept copy wins (another tab arrived later)", () => {
    const now = Date.now();
    const rec = (utm_source: string, t: number) =>
      JSON.stringify({ v: { utm_source }, at: t, exp: now + LAST_TOUCH_TTL_MS });
    window.sessionStorage.setItem(LAST_SESSION_KEY, rec("older_tab", now - 5000));
    window.localStorage.setItem(LAST_PERSIST_KEY, rec("newer_tab", now - 1000));
    expect(getCheckoutAttribution().last).toEqual({ utm_source: "newer_tab" });

    window.sessionStorage.setItem(LAST_SESSION_KEY, rec("this_tab", now));
    expect(getCheckoutAttribution().last).toEqual({ utm_source: "this_tab" });
  });

  it("Decline keeps it to this tab, and a later Decline removes the kept copy", () => {
    window.localStorage.setItem(CONSENT_KEY, "denied");
    arrive(NURTURE);
    expect(window.sessionStorage.getItem(LAST_SESSION_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(LAST_PERSIST_KEY)).toBeNull();
    closeTab();
    arrive("/books");
    expect(getCheckoutAttribution()).not.toHaveProperty("last");

    window.localStorage.removeItem(CONSENT_KEY);
    arrive(NURTURE);
    closeTab();
    expect(window.localStorage.getItem(LAST_PERSIST_KEY)).not.toBeNull();
    window.localStorage.setItem(CONSENT_KEY, "denied");
    arrive("/books");
    expect(getCheckoutAttribution()).not.toHaveProperty("last");
    expect(window.localStorage.getItem(LAST_PERSIST_KEY)).toBeNull();
  });

  it("signups never send it", () => {
    arrive(NURTURE);
    expect(getAttribution()).not.toHaveProperty("last");
  });

  it("corrupt or broken storage never throws and never blocks checkout", () => {
    window.localStorage.setItem(LAST_PERSIST_KEY, "{not json");
    window.sessionStorage.setItem(LAST_SESSION_KEY, JSON.stringify({ v: { utm_source: "x" } }));
    expect(() => getCheckoutAttribution()).not.toThrow();
    expect(getCheckoutAttribution()).not.toHaveProperty("last");

    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => arrive(NURTURE)).not.toThrow();
    expect(getCheckoutAttribution().last?.utm_medium).toBe("nurture");
  });
});

describe("last marked touch on the server", () => {
  const FULL_LAST = {
    utm_source: "email",
    utm_medium: "newsletter",
    utm_campaign: "friday_note",
    utm_content: "oct_17",
    utm_term: "t",
    referrer: "https://mail.google.com/",
    source_url: "https://edeninstitute.health/books",
    click: "gclid",
  };

  it("rides as attr_last_* beside the first touch, inside Stripe's key limits", () => {
    const meta = checkoutAttributionMetadata({
      attribution: {
        utm_source: "pinterest", utm_medium: "pin", utm_campaign: "c", utm_content: "d", utm_term: "e",
        referrer: "https://www.pinterest.com/", source_url: "https://edeninstitute.health/freebies",
        gclid: GCLID, gbraid: "0AAAAA-x_1", wbraid: "CkAB",
        last: FULL_LAST,
      },
    });
    expect(meta).toMatchObject({
      attr_utm_source: "pinterest",
      attr_gclid: GCLID,
      attr_last_utm_source: "email",
      attr_last_utm_medium: "newsletter",
      attr_last_utm_campaign: "friday_note",
      attr_last_utm_content: "oct_17",
      attr_last_utm_term: "t",
      attr_last_referrer: "https://mail.google.com/",
      attr_last_source_url: "https://edeninstitute.health/books",
      attr_last_click: "gclid",
    });
    // Ten first-touch keys plus eight last-touch keys. create-checkout's fullest bag
    // (the preorder path) is 14 keys before attribution, so 32 of Stripe's 50.
    expect(Object.keys(meta)).toHaveLength(18);
    for (const k of Object.keys(meta)) expect(k.length).toBeLessThanOrEqual(40);
  });

  it("missing or junk last adds nothing and leaves the first touch exactly as it was", () => {
    const first = { utm_source: "pinterest", utm_medium: "pin" };
    const firstOnly = checkoutAttributionMetadata({ attribution: first });
    expect(firstOnly).toEqual({ attr_utm_source: "pinterest", attr_utm_medium: "pin" });
    for (const last of [undefined, null, "x", 42, [FULL_LAST], {}, { click: "msclkid" }, { utm_source: 5 }]) {
      expect(checkoutAttributionMetadata({ attribution: { ...first, last } })).toEqual(firstOnly);
    }
    expect(checkoutAttributionMetadata({ attribution: { last: FULL_LAST } })).not.toHaveProperty("attr_utm_source");
  });

  it("keeps only the four click names, and caps and cleans like the first touch", () => {
    for (const c of CLICK_MARKERS) expect(sanitizeLastTouch({ click: c })).toEqual({ click: c });
    for (const c of ["msclkid", "GCLID", GCLID, "", 1]) expect(sanitizeLastTouch({ click: c })).toEqual({});
    const out = sanitizeLastTouch({ utm_source: " a\nb ".repeat(100), referrer: "https://x.test/" + "r".repeat(5000) });
    expect(out.utm_source?.length).toBeLessThanOrEqual(200);
    expect(out.utm_source).not.toContain("\n");
    expect(out.referrer).toHaveLength(500);
  });

  it("maps to its own columns, and never into the first-touch write", () => {
    const sessionMetadata = {
      print_sku: "sprouts_print_set",
      ...checkoutAttributionMetadata({ attribution: { utm_source: "pinterest", last: FULL_LAST } }),
    };
    expect(attributionColumnsFromMetadata(sessionMetadata)).toEqual({ attr_utm_source: "pinterest" });
    expect(lastTouchColumnsFromMetadata(sessionMetadata)).toEqual({
      attr_last_utm_source: "email",
      attr_last_utm_medium: "newsletter",
      attr_last_utm_campaign: "friday_note",
      attr_last_utm_content: "oct_17",
      attr_last_utm_term: "t",
      attr_last_referrer: "https://mail.google.com/",
      attr_last_source_url: "https://edeninstitute.health/books",
      attr_last_click: "gclid",
    });
    expect(Object.keys(lastTouchColumnsFromMetadata(sessionMetadata) ?? {})).toHaveLength(ATTRIBUTION_FIELDS.length + 1);
  });

  it("an old session, or hand-edited junk, yields null (the webhook skips the write)", () => {
    expect(lastTouchColumnsFromMetadata({ attr_utm_source: "pinterest", fbp: "x" })).toBeNull();
    expect(lastTouchColumnsFromMetadata({ attr_last_utm_source: "  ", attr_last_click: "msclkid" })).toBeNull();
    expect(lastTouchColumnsFromMetadata(null)).toBeNull();
    expect(lastTouchColumnsFromMetadata(undefined)).toBeNull();
  });
});

describe("Sales by last source (founder Orders tab)", () => {
  it("reads a last touch the way the Source column reads a first touch", () => {
    expect(orderLastSourceText({ attr_last_utm_source: "email", attr_last_utm_medium: "nurture", attr_last_utm_content: "day_3" }))
      .toBe("email / nurture / day_3");
    expect(orderLastSourceText({ attr_last_referrer: "https://www.google.com/", attr_last_click: "gclid" }))
      .toBe("google.com (gclid click)");
    expect(orderLastSourceText({ attr_last_click: "fbclid" })).toBe("fbclid click");
    expect(orderLastSourceText({ attr_last_referrer: "https://l.instagram.com/" })).toBe("l.instagram.com");
    expect(orderLastSourceText({})).toBeNull();
  });

  it("totals orders and money by source / medium, counted like Gross", () => {
    const row = (over: Record<string, unknown>) => ({
      is_internal: false,
      status: "ready_to_fulfill",
      amount_total_cents: 1000,
      ...over,
    });
    const totals = salesByLastSource([
      row({ attr_last_utm_source: "email", attr_last_utm_medium: "nurture", attr_last_utm_content: "day_3" }),
      row({ attr_last_utm_source: "email", attr_last_utm_medium: "nurture", attr_last_utm_content: "day_5", amount_total_cents: 2500 }),
      row({ attr_last_utm_source: "email", attr_last_utm_medium: "newsletter" }),
      row({ attr_last_referrer: "https://www.google.com/", attr_last_click: "gclid", amount_total_cents: 500 }),
      row({ amount_total_cents: 700 }),
      row({ attr_last_utm_source: "email", attr_last_utm_medium: "nurture", is_internal: true, amount_total_cents: 9999 }),
      row({ attr_last_utm_source: "email", attr_last_utm_medium: "nurture", status: "refunded", amount_total_cents: 9999 }),
      row({ attr_last_utm_source: "email", attr_last_utm_medium: "newsletter", status: "cancelled" }),
    ] as Parameters<typeof salesByLastSource>[0]);
    expect(totals).toEqual([
      { source: "email / nurture", orders: 2, cents: 3500 },
      { source: "email / newsletter", orders: 1, cents: 1000 },
      { source: NO_LAST_TOUCH, orders: 1, cents: 700 },
      { source: "google.com (gclid click)", orders: 1, cents: 500 },
    ]);
  });

  it("an empty window is an empty table, not a zero row", () => {
    expect(salesByLastSource([])).toEqual([]);
  });
});
