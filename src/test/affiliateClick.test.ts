import { describe, expect, it } from "vitest";
import { affiliateClick } from "@/lib/affiliateClick";

const PAGE = "https://edeninstitute.health/herbs/chamomile";

describe("affiliateClick", () => {
  it("names a Mountain Rose short link by its code", () => {
    expect(affiliateClick("https://get.aspr.app/SH1pA8", "sponsored noopener", PAGE)).toEqual({ cta: "aff-mrh", placement: "SH1pA8" });
  });

  it("names a Mountain Rose deep link by the product it lands on", () => {
    const deep = "https://get.aspr.app/SH1p9w?url=" + encodeURIComponent("https://mountainroseherbs.com/damiana-leaf?transaction_id={transaction_id}");
    expect(affiliateClick(deep, "sponsored noopener", PAGE)).toEqual({ cta: "aff-mrh", placement: "damiana-leaf" });
  });

  it("names an Amazon product by its ASIN and a short link by its code", () => {
    expect(affiliateClick("https://www.amazon.com/dp/b0abc12345?tag=mobile088c05e-20", null, PAGE)).toEqual({ cta: "aff-amazon", placement: "B0ABC12345" });
    expect(affiliateClick("https://amzn.to/3xYz", "sponsored", PAGE)).toEqual({ cta: "aff-amazon", placement: "3xYz" });
  });

  it("counts Home Science Tools by product even without rel=sponsored", () => {
    expect(affiliateClick("https://www.homesciencetools.com/product/magnifier-3x/?aff=258", null, PAGE)).toEqual({ cta: "aff-hst", placement: "magnifier-3x" });
  });

  it("counts any other sponsored link by its host", () => {
    expect(affiliateClick("https://www.azedvendors.com/listing", "sponsored noopener", PAGE)).toEqual({ cta: "aff-other", placement: "azedvendors.com" });
  });

  it("ignores ordinary outbound links, our own site, and non-web links", () => {
    expect(affiliateClick("https://hslda.org/legal", "noopener", PAGE)).toBeNull();
    expect(affiliateClick("/books", "sponsored", PAGE)).toBeNull();
    expect(affiliateClick("https://edeninstitute.health/starter", "sponsored", PAGE)).toBeNull();
    expect(affiliateClick("mailto:hello@example.com", "sponsored", PAGE)).toBeNull();
    expect(affiliateClick(null, "sponsored", PAGE)).toBeNull();
  });

  it("keeps the placement within the 50 characters the RPC stores", () => {
    const long = "https://www.homesciencetools.com/product/" + "a".repeat(80) + "/";
    expect(affiliateClick(long, null, PAGE)!.placement).toHaveLength(50);
  });
});
