// Mountain Rose Herbs affiliate links on /herbs pages (2026-11-16).
import { describe, expect, it } from "vitest";
import { HERB_MRH_LINKS, SAFETY_EXCLUDED_HERBS, mrhLinkForHerb } from "@/lib/herbAffiliateLinks";

describe("herb affiliate links", () => {
  it("keys on herb ids and every link is her get.aspr.app affiliate link", () => {
    const entries = Object.entries(HERB_MRH_LINKS);
    expect(entries.length).toBeGreaterThan(100);
    for (const [herbId, l] of entries) {
      expect(herbId).toMatch(/^H\d{3}$/);
      expect(l.href).toMatch(/^https:\/\/get\.aspr\.app\/SH1p[A-Za-z0-9]+/);
      expect(l.href).not.toMatch(/mountainroseherbs\.com\/[^?%]*\?(?!transaction_id)/);
      if (l.href.includes("?url=")) expect(decodeURIComponent(l.href)).toContain("transaction_id={transaction_id}");
      expect(l.product.trim().length).toBeGreaterThan(2);
      expect(l.product).not.toMatch(/[–—]/);
    }
  });

  it("never links a safety-excluded herb", () => {
    expect(SAFETY_EXCLUDED_HERBS.length).toBeGreaterThan(0);
    for (const herbId of SAFETY_EXCLUDED_HERBS) expect(mrhLinkForHerb(herbId)).toBeNull();
    expect(mrhLinkForHerb("H171")).toBeNull(); // Lobelia, left out by hand
  });

  it("reuses the curriculum code for Calendula (H004) and returns null for unknown herbs", () => {
    expect(mrhLinkForHerb("H004")?.href).toBe("https://get.aspr.app/SH1pAD");
    expect(mrhLinkForHerb("H999")).toBeNull();
  });
});
