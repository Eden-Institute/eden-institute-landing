// Google product data (punch #0, 2026-11-03): every /esa item names an image that
// already ships with the site and belongs to its own band, and print offers carry the
// same delivery time as the Merchant Center feed. Founder 2026-11-03: no new or swapped
// site images, so these only fill blanks with photos already in public/.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ESA_STATES } from "../../web/lib/esaStates";
import { printOfferPolicies, RETURN_POLICY } from "../../web/lib/merchantOffer";

const SITE = "https://edeninstitute.health/";

describe("/esa Product images", () => {
  const items = ESA_STATES.flatMap((s) => s.items.map((i) => ({ state: s.slug, ...i })));

  it("covers every item", () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it.each(items.map((i) => [`${i.state}: ${i.name}`, i.image] as const))("%s", (_label, image) => {
    expect(image.startsWith(SITE)).toBe(true);
    expect(existsSync(resolve(__dirname, "../../public", image.slice(SITE.length)))).toBe(true);
  });

  it("never shows one band's photo on the other band's item", () => {
    for (const i of items) {
      const file = i.image.split("/").pop()!;
      if (i.name.startsWith("Seedlings")) expect(file).toMatch(/^ET_Seedlings_/);
      if (i.name.startsWith("Sprouts")) expect(file).not.toMatch(/Seedlings/);
    }
  });
});

describe("printOfferPolicies", () => {
  it("matches the feed's delivery time: no handling days, 10 to 15 business days in transit", () => {
    const { shippingDetails, hasMerchantReturnPolicy } = printOfferPolicies("sprouts_print_set");
    expect(shippingDetails.deliveryTime.handlingTime).toMatchObject({ minValue: 0, maxValue: 0, unitCode: "DAY" });
    expect(shippingDetails.deliveryTime.transitTime).toMatchObject({ minValue: 10, maxValue: 15, unitCode: "DAY" });
    expect(shippingDetails.deliveryTime.businessDays.dayOfWeek).toHaveLength(5);
    expect(hasMerchantReturnPolicy).toBe(RETURN_POLICY);
  });
});
