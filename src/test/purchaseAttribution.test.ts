/**
 * Purchase attribution (2026-09-26): first-touch UTMs, referrer and landing URL
 * ride from the browser through create-checkout into Stripe Checkout metadata
 * (attr_*), and stripe-webhook copies them onto orders / payments.
 *
 * Pins: the sanitizer only ever passes the seven known string fields, trimmed and
 * capped under Stripe's metadata limits; the metadata <-> column mapping is exact;
 * missing or junk attribution produces nothing (it can never fail a checkout); and
 * EVERY create-checkout caller in the codebase sends it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTRIBUTION_FIELDS,
  attributionColumnsFromMetadata,
  attributionToMetadata,
  checkoutAttributionMetadata,
  sanitizeAttribution,
} from "../../supabase/functions/_shared/purchase-attribution";
import { getCheckoutAttribution } from "@/lib/attribution";
import { orderSourceText } from "@/components/founder/OrdersTab";

// OrdersTab imports the client at module load; only its pure helper is under test.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const QR = {
  utm_source: "makers_market",
  utm_medium: "plant_card",
  utm_content: "lavender",
};

describe("sanitizeAttribution", () => {
  it("keeps the known fields exactly", () => {
    const full = {
      ...QR,
      utm_campaign: "fall_2026",
      utm_term: "herbs",
      referrer: "https://www.pinterest.com/",
      source_url: "https://edeninstitute.health/books",
    };
    expect(sanitizeAttribution(full)).toEqual(full);
  });

  it("drops unknown keys, non-strings and empty values", () => {
    expect(
      sanitizeAttribution({
        ...QR,
        utm_campaign: 42,
        utm_term: "   ",
        referrer: null,
        source_url: { href: "x" },
        lookup_key: "sprouts_starter_unit",
        email: "a@b.c",
      }),
    ).toEqual(QR);
  });

  it("returns {} for anything that is not a plain object", () => {
    for (const raw of [undefined, null, "utm_source=x", 7, true, ["makers_market"]]) {
      expect(sanitizeAttribution(raw)).toEqual({});
    }
  });

  it("trims and strips control characters", () => {
    expect(sanitizeAttribution({ utm_source: "  pin\nterest\t ", utm_medium: "\u0000social" })).toEqual({
      utm_source: "pin terest",
      utm_medium: "social",
    });
  });

  it("caps UTMs at 200 and URLs at 500, inside Stripe's 500-char value limit", () => {
    const out = sanitizeAttribution({
      utm_source: "s".repeat(5000),
      referrer: "https://x.test/" + "r".repeat(5000),
      source_url: "https://edeninstitute.health/" + "p".repeat(5000),
    });
    expect(out.utm_source).toHaveLength(200);
    expect(out.referrer).toHaveLength(500);
    expect(out.source_url).toHaveLength(500);
  });
});

describe("Stripe metadata mapping", () => {
  it("prefixes every field with attr_ and stays inside Stripe's key limits", () => {
    const meta = attributionToMetadata({
      utm_source: "a", utm_medium: "b", utm_campaign: "c", utm_content: "d",
      utm_term: "e", referrer: "f", source_url: "g",
    });
    expect(Object.keys(meta).sort()).toEqual(ATTRIBUTION_FIELDS.map((f) => `attr_${f}`).sort());
    for (const k of Object.keys(meta)) expect(k.length).toBeLessThanOrEqual(40);
    // create-checkout's fullest bag is ~15 keys; this adds at most 7, far under 50.
    expect(Object.keys(meta).length).toBe(7);
  });

  it("checkoutAttributionMetadata reads body.attribution and ignores everything else", () => {
    const body = { lookup_key: "deep_dive_guide", fbp: "fb.1", utm_source: "flat_is_ignored", attribution: QR };
    expect(checkoutAttributionMetadata(body)).toEqual({
      attr_utm_source: "makers_market",
      attr_utm_medium: "plant_card",
      attr_utm_content: "lavender",
    });
  });

  it("a body with no or junk attribution adds no metadata at all", () => {
    for (const body of [{}, { attribution: null }, { attribution: "x" }, { attribution: {} }, null, undefined, "str"]) {
      expect(checkoutAttributionMetadata(body)).toEqual({});
    }
  });

  it("round-trips checkout metadata to the order columns", () => {
    const sessionMetadata = {
      print_sku: "sprouts_print_set",
      fbp: "fb.1.2",
      ...checkoutAttributionMetadata({ attribution: { ...QR, referrer: "https://l.instagram.com/" } }),
    };
    expect(attributionColumnsFromMetadata(sessionMetadata)).toEqual({
      attr_utm_source: "makers_market",
      attr_utm_medium: "plant_card",
      attr_utm_content: "lavender",
      attr_referrer: "https://l.instagram.com/",
    });
  });

  it("an old session with no attr_* metadata yields null (the webhook skips the write)", () => {
    expect(attributionColumnsFromMetadata({ lookup_key: "deep_dive_guide", fbp: "x" })).toBeNull();
    expect(attributionColumnsFromMetadata({})).toBeNull();
    expect(attributionColumnsFromMetadata(null)).toBeNull();
    expect(attributionColumnsFromMetadata(undefined)).toBeNull();
    expect(attributionColumnsFromMetadata({ attr_utm_source: "  " })).toBeNull();
  });

  it("re-sanitizes on the way out (metadata can be hand-edited in Stripe)", () => {
    expect(attributionColumnsFromMetadata({ attr_utm_source: " x ".repeat(300), attr_bogus: "y" })).toEqual({
      attr_utm_source: " x ".repeat(300).trim().slice(0, 200).trim(),
    });
  });
});

describe("getCheckoutAttribution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });

  it("returns the first-touch values held for the session", () => {
    window.sessionStorage.setItem("eden_first_touch_v1", JSON.stringify(QR));
    expect(getCheckoutAttribution()).toEqual(QR);
  });

  it("never throws, even when storage is broken", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => getCheckoutAttribution()).not.toThrow();
    expect(typeof getCheckoutAttribution()).toBe("object");
  });
});

describe("orderSourceText (founder Orders tab)", () => {
  it("shows source / medium / content", () => {
    expect(orderSourceText({ attr_utm_source: "makers_market", attr_utm_medium: "plant_card", attr_utm_content: "lavender" }))
      .toBe("makers_market / plant_card / lavender");
  });
  it("falls back to the referring host, then to null", () => {
    expect(orderSourceText({ attr_referrer: "https://www.pinterest.com/pin/123" })).toBe("pinterest.com");
    expect(orderSourceText({})).toBeNull();
  });
});

describe("every create-checkout caller sends attribution", () => {
  const root = path.resolve(__dirname, "../..");
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(tsx?|astro)$/.test(name) && !/\.test\./.test(name)) out.push(p);
    }
    return out;
  }
  const callers = [...walk(path.join(root, "src")), ...walk(path.join(root, "web"))].filter((p) =>
    /functions\.invoke\([^)]*["']create-checkout["']/.test(readFileSync(p, "utf8")),
  );

  it("finds the known callers", () => {
    expect(callers.length).toBeGreaterThanOrEqual(8);
  });

  it.each(callers.map((p) => [path.relative(root, p)]))("%s", (rel) => {
    const src = readFileSync(path.join(root, rel), "utf8");
    const invokes = src.match(/functions\.invoke\(/g)?.length ?? 0;
    const sends = src.match(/attribution: getCheckoutAttribution\(\)/g)?.length ?? 0;
    expect(invokes).toBeGreaterThan(0);
    expect(sends).toBeGreaterThanOrEqual(1);
    // Each getFbAttribution() spread into a checkout body carries attribution too.
    expect(sends).toBe(src.match(/\.\.\.getFbAttribution\(\)/g)?.length ?? 0);
  });
});
