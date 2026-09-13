// Pinterest tag helper and tag consent. The promises that matter most are
// pinned here: the raw email never reaches pintrk (only its SHA-256 hex, and
// only with marketing consent), a Stripe session id never reaches pintrk (only a
// one-way reference), a confirmation page reload or reopen never reports a
// second checkout, and a visitor who clicked Decline sends nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_REF_LENGTH,
  centsToValue,
  checkoutRef,
  normalizeEmail,
  pinCheckoutOnce,
  pinSetHashedEmail,
  pinTrack,
  pinTrackOnce,
  sha256Hex,
} from "@/lib/pinterestTag";
import { applyTagConsent, GA_MEASUREMENT_ID, setMarketingConsent } from "@/lib/consent";

const CONSENT_KEY = "eden-marketing-consent";
const GA_DISABLE = `ga-disable-${GA_MEASUREMENT_ID}`;
// Computed independently with Node's crypto module.
const HASH = "7b17fb0bd173f625b58636fb796407c22b3d16fc78302d79f0fd30c2fc2fc068"; // name@example.com
const BOOKS_SESSION = "cs_test_books_1";
const BOOKS_REF = "83ee5ded323268fed15d671f1fad79d6"; // first 32 of sha256(cs_test_books_1)
const STARTER_SESSION = "cs_test_starter_1";
const STARTER_REF = "aa9a43167501ac636d6dfa42e5d7ce76"; // first 32 of sha256(cs_test_starter_1)
const DUP_SESSION = "cs_test_dup_1";
const DUP_REF = "41fce118fd438b2ce93b3e804bda795e"; // first 32 of sha256(cs_test_dup_1)

type W = { pintrk?: unknown; gtag?: unknown } & Record<string, unknown>;
const w = () => window as unknown as W;

describe("pinterestTag", () => {
  let calls: unknown[][];

  beforeEach(() => {
    calls = [];
    w().pintrk = (...args: unknown[]) => {
      calls.push(args);
    };
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    delete w().pintrk;
  });

  it("normalizes and hashes an email the way Pinterest documents", async () => {
    expect(normalizeEmail("  Name@Example.COM ")).toBe("name@example.com");
    expect(await sha256Hex("name@example.com")).toBe(HASH);
  });

  it("converts cents to a plain dollar number", () => {
    expect(centsToValue(26100)).toBe(261);
    expect(centsToValue(3999)).toBe(39.99);
  });

  it("attaches nothing without marketing consent", async () => {
    await pinSetHashedEmail("name@example.com");
    localStorage.setItem(CONSENT_KEY, "denied");
    await pinSetHashedEmail("name@example.com");
    expect(calls).toEqual([]);
  });

  it("with consent, sends only the hash, never the raw address", async () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    await pinSetHashedEmail("  Name@Example.COM ");
    expect(calls).toEqual([["set", { em: HASH }]]);
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("example.com");
  });

  it("is a silent no-op when the tag is absent", async () => {
    delete w().pintrk;
    localStorage.setItem(CONSENT_KEY, "granted");
    await expect(pinSetHashedEmail("name@example.com")).resolves.toBeUndefined();
    expect(() => pinTrack("lead", { lead_type: "x" })).not.toThrow();
    expect(() => pinTrackOnce("cs_test_1", "checkout", { value: 1 })).not.toThrow();
    await expect(pinCheckoutOnce("cs_test_absent", { value: 1 })).resolves.toBeUndefined();
  });

  it("fires checkout once per key, so a reload does not double-count", () => {
    pinTrackOnce("key_abc", "checkout", { value: 261, event_id: "key_abc" });
    pinTrackOnce("key_abc", "checkout", { value: 261, event_id: "key_abc" });
    pinTrackOnce("key_other", "checkout", { value: 39, event_id: "key_other" });
    expect(calls).toEqual([
      ["track", "checkout", { value: 261, event_id: "key_abc" }],
      ["track", "checkout", { value: 39, event_id: "key_other" }],
    ]);
  });

  it("keeps the checkout dedupe key in localStorage, so a new tab does not re-report", () => {
    pinTrackOnce("key_tab", "checkout", { value: 1 });
    expect(localStorage.getItem("pintrk_checkout_key_tab")).toBe("1");
    sessionStorage.clear(); // a reopened link in a new tab has a fresh sessionStorage
    pinTrackOnce("key_tab", "checkout", { value: 1 });
    expect(calls).toHaveLength(1);
  });

  it("never throws when pintrk itself throws", () => {
    w().pintrk = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(() => pinTrack("addtocart", { value: 39 })).not.toThrow();
  });

  describe("declined visitor", () => {
    beforeEach(() => {
      localStorage.setItem(CONSENT_KEY, "denied");
    });

    it("pinTrack, pinTrackOnce and pinSetHashedEmail send nothing", async () => {
      pinTrack("lead", { lead_type: "sprouts_magnet" });
      pinTrack("addtocart", { value: 39 });
      pinTrackOnce("key_denied", "checkout", { value: 39 });
      await pinSetHashedEmail("name@example.com");
      expect(calls).toEqual([]);
      // Nothing is stored either, so nothing is used up.
      expect(localStorage.getItem("pintrk_checkout_key_denied")).toBeNull();
    });

    it("pinCheckoutOnce sends nothing and stores nothing", async () => {
      await pinCheckoutOnce(BOOKS_SESSION, { value: 261, order_id: "ET-1" }, "name@example.com");
      expect(calls).toEqual([]);
      expect(localStorage.getItem(`pintrk_checkout_${BOOKS_REF}`)).toBeNull();
    });
  });

  describe("hashed checkout ids", () => {
    it("derives a 32-hex reference from the session id", async () => {
      expect(CHECKOUT_REF_LENGTH).toBe(32);
      expect(await checkoutRef(BOOKS_SESSION)).toBe(BOOKS_REF);
      expect(await checkoutRef("")).toBeNull();
    });

    it("/books: order_id is the order number, event_id is the reference, never the session id", async () => {
      localStorage.setItem(CONSENT_KEY, "granted");
      await pinCheckoutOnce(
        BOOKS_SESSION,
        { value: 261, currency: "USD", order_quantity: 1, order_id: "ET-1026" },
        "name@example.com",
      );
      expect(calls).toEqual([
        ["set", { em: HASH }],
        ["track", "checkout", { value: 261, currency: "USD", order_quantity: 1, order_id: "ET-1026", event_id: BOOKS_REF }],
      ]);
      expect(JSON.stringify(calls)).not.toContain(BOOKS_SESSION);
      expect(localStorage.getItem(`pintrk_checkout_${BOOKS_REF}`)).toBe("1");
      // The raw session id is not stored as a key either.
      expect(Object.keys(localStorage).join(" ")).not.toContain(BOOKS_SESSION);
    });

    it("/starter: order_id and event_id are both the reference; no email without consent", async () => {
      await pinCheckoutOnce(STARTER_SESSION, { value: 39, currency: "USD", order_quantity: 1 }, "name@example.com");
      expect(calls).toEqual([
        ["track", "checkout", { value: 39, currency: "USD", order_quantity: 1, order_id: STARTER_REF, event_id: STARTER_REF }],
      ]);
      expect(JSON.stringify(calls)).not.toContain(STARTER_SESSION);
    });

    it("reports once even when called repeatedly or concurrently for the same order", async () => {
      await Promise.all([
        pinCheckoutOnce(DUP_SESSION, { value: 39 }),
        pinCheckoutOnce(DUP_SESSION, { value: 39 }),
      ]);
      await pinCheckoutOnce(DUP_SESSION, { value: 39 });
      expect(calls).toEqual([["track", "checkout", { value: 39, order_id: DUP_REF, event_id: DUP_REF }]]);
    });
  });
});

describe("applyTagConsent", () => {
  let pin: unknown[][];
  let ga: unknown[][];

  beforeEach(() => {
    pin = [];
    ga = [];
    w().pintrk = (...args: unknown[]) => {
      pin.push(args);
    };
    w().gtag = (...args: unknown[]) => {
      ga.push(args);
    };
    delete w()[GA_DISABLE];
    localStorage.clear();
  });

  afterEach(() => {
    delete w().pintrk;
    delete w().gtag;
    delete w()[GA_DISABLE];
  });

  const all = (v: string) => ({ analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v });

  it("Decline tells Pinterest and Google Analytics to stop", () => {
    setMarketingConsent("denied");
    applyTagConsent("denied");
    expect(pin).toEqual([["setconsent", false]]);
    expect(ga).toEqual([["consent", "update", all("denied")]]);
    expect(w()[GA_DISABLE]).toBe(true);
    // And later events on the page are dropped.
    pinTrack("addtocart", { value: 39 });
    expect(pin).toHaveLength(1);
  });

  it("Accept after Decline turns both back on, and the hashed email is sent", async () => {
    setMarketingConsent("denied");
    applyTagConsent("denied");
    setMarketingConsent("granted");
    applyTagConsent("granted");
    expect(pin).toEqual([["setconsent", false], ["setconsent", true]]);
    expect(ga).toEqual([
      ["consent", "update", all("denied")],
      ["consent", "update", all("granted")],
    ]);
    expect(w()[GA_DISABLE]).toBe(false);
    await pinSetHashedEmail("name@example.com");
    pinTrack("lead", { lead_type: "sprouts_magnet" });
    expect(pin.slice(2)).toEqual([
      ["set", { em: HASH }],
      ["track", "lead", { lead_type: "sprouts_magnet" }],
    ]);
  });

  it("never throws when the tags are absent or throw", () => {
    delete w().pintrk;
    delete w().gtag;
    expect(() => applyTagConsent("denied")).not.toThrow();
    w().pintrk = () => {
      throw new Error("x");
    };
    w().gtag = () => {
      throw new Error("x");
    };
    expect(() => applyTagConsent("granted")).not.toThrow();
  });
});
