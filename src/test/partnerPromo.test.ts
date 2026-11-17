// 2026-11-17, Lane 2 area 9 C1: a partner's ?promo= link carries the code into checkout on the
// books, printed-set and Starter buy boxes, remembered for the visit, never with the FPEA offer.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanPromoCode, PARTNER_PROMO_KEY, partnerPromoBody, partnerPromoCode } from "../../web/lib/partnerPromo";

function memoryStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("partner promo codes from links", () => {
  it("reads ?promo= and upper-cases it", () => {
    expect(partnerPromoCode("?promo=liz10", memoryStore())).toBe("LIZ10");
    expect(partnerPromoCode("?utm_source=ig&promo=KAMI10", memoryStore())).toBe("KAMI10");
  });

  it("remembers the code for the visit, so a later page without ?promo= still sends it", () => {
    const store = memoryStore();
    expect(partnerPromoCode("?promo=SARAI10", store)).toBe("SARAI10");
    expect(store.m.get(PARTNER_PROMO_KEY)).toBe("SARAI10");
    expect(partnerPromoCode("", store)).toBe("SARAI10");
  });

  it("a new ?promo= on a later page replaces the remembered one", () => {
    const store = memoryStore({ [PARTNER_PROMO_KEY]: "OLD10" });
    expect(partnerPromoCode("?promo=NEW10", store)).toBe("NEW10");
    expect(partnerPromoCode("", store)).toBe("NEW10");
  });

  it("ignores anything that is not code-shaped, in the URL or in storage", () => {
    for (const bad of ["", "a", "x".repeat(41), "LIZ 10", "<script>", "10%", "-LIZ10", "LIZ10;drop"]) {
      expect(cleanPromoCode(bad)).toBe("");
      expect(partnerPromoCode(`?promo=${encodeURIComponent(bad)}`, memoryStore())).toBe("");
    }
    expect(partnerPromoCode("", memoryStore({ [PARTNER_PROMO_KEY]: "<b>" }))).toBe("");
    expect(cleanPromoCode(undefined)).toBe("");
    expect(cleanPromoCode("EDEN-S-APMSMZ")).toBe("EDEN-S-APMSMZ");
  });

  it("works with no storage at all (private mode): the URL still counts", () => {
    expect(partnerPromoCode("?promo=VAL10", null)).toBe("VAL10");
    expect(partnerPromoCode("", null)).toBe("");
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(partnerPromoCode("?promo=VAL10", throwing)).toBe("VAL10");
    expect(partnerPromoCode("", throwing)).toBe("");
  });

  it("the request fragment carries the code, and nothing at all with the FPEA offer or no code", () => {
    expect(partnerPromoBody("LIZ10")).toEqual({ promo_code: "LIZ10" });
    expect(partnerPromoBody("LIZ10", "fpea_2027")).toEqual({});
    expect(partnerPromoBody("")).toEqual({});
  });

  it("the books, printed-set and Starter buy boxes send it, and the site remembers it on landing", () => {
    for (const f of ["BookCheckoutController", "PrintBuyBox", "StarterBuyBox"]) {
      const src = readFileSync(`web/components/islands/${f}.tsx`, "utf8");
      expect(src, f).toMatch(/partnerPromoBody\(partnerPromoCode\(\)/);
    }
    const analytics = readFileSync("web/components/islands/SiteAnalytics.tsx", "utf8");
    expect(analytics).toMatch(/partnerPromoCode\(\);/);
    // The two boxes with an FPEA offer pass it, so the code is never stacked on the offer.
    for (const f of ["PrintBuyBox", "StarterBuyBox"]) {
      expect(readFileSync(`web/components/islands/${f}.tsx`, "utf8"), f).toMatch(/partnerPromoBody\(partnerPromoCode\(\), offer\)/);
    }
  });
});
