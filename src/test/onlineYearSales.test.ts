import { describe, expect, it } from "vitest";
import { ONLINE_YEAR_ON_SALE } from "../../web/lib/onlineYearLaunch";
import { OY_APPROVED_CARD, OY_APPROVED_FAQ, OY_SALES_LINES, onlineYearDetails, starterCreditLineOnSale } from "../../web/lib/onlineYearCopy";

describe("Online Year on the website (OY9)", () => {
  it("stays off the public site until launch day flips the switch", () => {
    expect(ONLINE_YEAR_ON_SALE).toBe(false);
  });

  it("uses the approved card, word for word", () => {
    expect(OY_APPROVED_CARD.step).toBe("Step 3 · The whole year, online");
    expect(OY_APPROVED_CARD.price).toBe("$149 a year");
    expect(OY_APPROVED_CARD.points).toHaveLength(6);
    expect(OY_APPROVED_CARD.button).toBe("Start the Online Year");
  });

  it("names the right band in the details (Seedlings uses the same words with its band name and grades)", () => {
    expect(onlineYearDetails("sprouts")[0]).toMatch(/^The Online Year opens all 36 weeks of Sprouts \(K-2\) in your browser/);
    expect(onlineYearDetails("seedlings")[0]).toMatch(/^The Online Year opens all 36 weeks of Seedlings \(3-5\) in your browser/);
    expect(onlineYearDetails("sprouts")).toHaveLength(6);
  });

  it("keeps the ESA question off the page until the Online Year can be ordered through ESA", () => {
    expect(OY_APPROVED_FAQ).toHaveLength(9);
    expect(OY_APPROVED_FAQ.some((f) => /ESA|scholarship/i.test(f.q + f.a))).toBe(false);
    expect(OY_APPROVED_FAQ.find((f) => f.q === "Does my Starter Unit count toward it?")!.a).toContain("your first year is $110");
  });

  it("launch-day Starter credit line and the sales lines", () => {
    expect(starterCreditLineOnSale("Sprouts")).toBe("Comes with a $39 credit toward the Sprouts year, printed or online, whenever you're ready for the rest.");
    expect(OY_SALES_LINES.anchor).toBe("All 36 weeks on screen for $149, against $249 plus $12 shipping for the printed set.");
    expect(JSON.stringify({ OY_APPROVED_CARD, OY_APPROVED_FAQ, OY_SALES_LINES, d: onlineYearDetails("sprouts") })).not.toMatch(/—/);
  });
});
