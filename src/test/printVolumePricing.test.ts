/**
 * Co-op notebook tier (founder decision 2026-09-26): extra Student Notebooks
 * 1-5 at $39.99, the 6th and beyond at $32. The split lives in
 * supabase/functions/_shared/print-pricing.ts and is shared by create-checkout
 * (the Stripe lines), receipt.ts (the receipt rows) and PrintBuyBox (what the
 * buyer sees), so this pins the arithmetic all three depend on.
 */
import { describe, it, expect } from "vitest";
import {
  likelyNeedsGround,
  pooledTierTotal,
  printShippingCents,
  splitVolumeTier,
  splitVolumeTierPooled,
  volumeTierTotal,
} from "../../supabase/functions/_shared/print-pricing";

const BASE = 3999;
const VOLUME = 3200;
const FROM = 6;

describe("splitVolumeTier", () => {
  it("7 notebooks = 5 x $39.99 + 2 x $32.00", () => {
    expect(splitVolumeTier(7, BASE, VOLUME, FROM)).toEqual([
      { qty: 5, unitCents: 3999, tier: "base" },
      { qty: 2, unitCents: 3200, tier: "volume" },
    ]);
    expect(volumeTierTotal(7, BASE, VOLUME, FROM)).toBe(5 * 3999 + 2 * 3200);
    expect(volumeTierTotal(7, BASE, VOLUME, FROM)).toBe(26395);
  });

  it("1 to 5 notebooks stay at the base price, one line", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(splitVolumeTier(n, BASE, VOLUME, FROM)).toEqual([{ qty: n, unitCents: BASE, tier: "base" }]);
      expect(volumeTierTotal(n, BASE, VOLUME, FROM)).toBe(n * BASE);
    }
  });

  it("the 6th notebook is the first at $32", () => {
    expect(splitVolumeTier(6, BASE, VOLUME, FROM)).toEqual([
      { qty: 5, unitCents: BASE, tier: "base" },
      { qty: 1, unitCents: VOLUME, tier: "volume" },
    ]);
    expect(volumeTierTotal(6, BASE, VOLUME, FROM)).toBe(5 * 3999 + 3200);
  });

  it("100 notebooks (the cap) = 5 x $39.99 + 95 x $32.00", () => {
    expect(volumeTierTotal(100, BASE, VOLUME, FROM)).toBe(5 * 3999 + 95 * 3200);
    expect(volumeTierTotal(100, BASE, VOLUME, FROM)).toBe(323995);
  });

  it("no tier configured means the flat price, exactly as before", () => {
    expect(splitVolumeTier(7, BASE, null, null)).toEqual([{ qty: 7, unitCents: BASE, tier: "base" }]);
    expect(splitVolumeTier(7, BASE, undefined, undefined)).toEqual([{ qty: 7, unitCents: BASE, tier: "base" }]);
    expect(splitVolumeTier(7, BASE, VOLUME, null)).toEqual([{ qty: 7, unitCents: BASE, tier: "base" }]);
  });

  it("a half-configured or nonsensical tier never charges more or less than intended", () => {
    // Volume price not lower than base: ignored.
    expect(volumeTierTotal(7, BASE, 4500, FROM)).toBe(7 * BASE);
    // Threshold below 2 would put the first unit at the volume price: ignored.
    expect(volumeTierTotal(7, BASE, VOLUME, 1)).toBe(7 * BASE);
    // Zero or fractional volume price: ignored.
    expect(volumeTierTotal(7, BASE, 0, FROM)).toBe(7 * BASE);
    expect(volumeTierTotal(7, BASE, 32.5, FROM)).toBe(7 * BASE);
  });

  it("returns nothing for a quantity below 1", () => {
    expect(splitVolumeTier(0, BASE, VOLUME, FROM)).toEqual([]);
    expect(splitVolumeTier(-3, BASE, VOLUME, FROM)).toEqual([]);
    expect(splitVolumeTier(2.5, BASE, VOLUME, FROM)).toEqual([]);
  });

  it("the parts always add back up to the quantity", () => {
    for (let n = 1; n <= 100; n++) {
      const parts = splitVolumeTier(n, BASE, VOLUME, FROM);
      expect(parts.reduce((s, p) => s + p.qty, 0)).toBe(n);
      expect(parts.every((p) => p.qty >= 1)).toBe(true);
    }
  });
});

// Founder 2026-09-26: in the both-bands bundle the first 5 extra notebooks are
// counted ACROSS both bands; every notebook after that, either band, is $32.
describe("splitVolumeTierPooled (bundle, across bands)", () => {
  const nb = (key: string, qty: number) => ({ key, qty, baseCents: BASE, volumeCents: VOLUME, volumeMinQty: FROM });

  it("3 Sprouts + 4 Seedlings = 5 at $39.99 + 2 at $32, not 7 at $39.99", () => {
    const lines = [nb("sprouts_nb_print", 3), nb("seedlings_nb_print", 4)];
    expect(pooledTierTotal(lines)).toBe(5 * 3999 + 2 * 3200);
    const split = splitVolumeTierPooled(lines);
    // The allowance goes in SKU order: seedlings_nb_print sorts first.
    expect(split.get("seedlings_nb_print")).toEqual([{ qty: 4, unitCents: BASE, tier: "base" }]);
    expect(split.get("sprouts_nb_print")).toEqual([
      { qty: 1, unitCents: BASE, tier: "base" },
      { qty: 2, unitCents: VOLUME, tier: "volume" },
    ]);
  });

  it("request order never changes the split", () => {
    const a = splitVolumeTierPooled([nb("sprouts_nb_print", 3), nb("seedlings_nb_print", 4)]);
    const b = splitVolumeTierPooled([nb("seedlings_nb_print", 4), nb("sprouts_nb_print", 3)]);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it("a band past the allowance is all $32", () => {
    const split = splitVolumeTierPooled([nb("sprouts_nb_print", 2), nb("seedlings_nb_print", 7)]);
    expect(split.get("seedlings_nb_print")).toEqual([
      { qty: 5, unitCents: BASE, tier: "base" },
      { qty: 2, unitCents: VOLUME, tier: "volume" },
    ]);
    expect(split.get("sprouts_nb_print")).toEqual([{ qty: 2, unitCents: VOLUME, tier: "volume" }]);
    expect(pooledTierTotal([nb("sprouts_nb_print", 2), nb("seedlings_nb_print", 7)])).toBe(5 * 3999 + 4 * 3200);
  });

  it("the set line (no tier) never uses the allowance", () => {
    const lines = [{ key: "both_bands_print_set", qty: 1, baseCents: 42900 }, nb("sprouts_nb_print", 6)];
    expect(pooledTierTotal(lines)).toBe(42900 + 5 * 3999 + 3200);
  });

  it("50 + 50 across the bundle = 5 x $39.99 + 95 x $32", () => {
    expect(pooledTierTotal([nb("sprouts_nb_print", 50), nb("seedlings_nb_print", 50)])).toBe(5 * 3999 + 95 * 3200);
  });
});

// Founder 2026-09-26: shipping covers Lulu's cost for every cart. The full
// cart-by-cart check against Lulu's quotes is the Deno test
// (supabase/functions/_shared/print-group-tiers.test.ts); these pin the formula.
describe("printShippingCents", () => {
  const S = (items: [string, number][]) => printShippingCents(items.map(([sku, qty]) => ({ sku, qty })));
  it("keeps $12 for one set and $10 for one coil book; one paperback is $8", () => {
    expect(S([["sprouts_print_set", 1]])).toBe(1200);
    expect(S([["seedlings_print_set", 1]])).toBe(1200);
    expect(S([["bte_study_guide_print", 1]])).toBe(1000);
    expect(S([["bte_study_journal_print", 1]])).toBe(1000);
    expect(S([["bte_paperback_print", 1]])).toBe(800);
  });
  it("bundle $16; each extra set $2, extra bundle $4.25, extra notebook $0.75", () => {
    expect(S([["both_bands_print_set", 1]])).toBe(1600);
    expect(S([["sprouts_print_set", 2]])).toBe(1400);
    expect(S([["sprouts_print_set", 1], ["sprouts_nb_print", 5]])).toBe(1200 + 5 * 75);
    expect(S([["both_bands_print_set", 1], ["sprouts_nb_print", 1], ["seedlings_nb_print", 1]])).toBe(1600 + 150);
  });
  it("adds $15 when a curriculum parcel is too heavy for MAIL", () => {
    // Sprouts set + 6 notebooks is the first Sprouts cart Lulu will not send by MAIL.
    expect(S([["sprouts_print_set", 1], ["sprouts_nb_print", 6]])).toBe(1200 + 6 * 75 + 1500);
    expect(S([["sprouts_print_set", 1], ["sprouts_nb_print", 100]])).toBe(1200 + 100 * 75 + 1500);
    expect(S([["both_bands_print_set", 2]])).toBe(1600 + 425 + 1500);
  });
  it("books: paperback $8 + $1.25 a copy, coil $10 + $2.50 a copy, paperback + Study Guide $11.25", () => {
    expect(S([["bte_paperback_print", 10]])).toBe(800 + 9 * 125);
    expect(S([["bte_study_journal_print", 10]])).toBe(1000 + 9 * 250);
    expect(S([["bte_paperback_print", 1], ["bte_study_guide_print", 1]])).toBe(1125);
  });
  it("refuses to price a SKU it has no rule for", () => {
    expect(S([["sprouts_print_set", 1], ["mystery_sku", 1]])).toBeNull();
  });
});

// Display-only estimate, matched to the Lulu quote edges read 2026-09-26.
describe("likelyNeedsGround", () => {
  it("MAIL was offered: no note", () => {
    expect(likelyNeedsGround([{ sku: "sprouts_print_set", qty: 1 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "sprouts_print_set", qty: 1 }, { sku: "sprouts_nb_print", qty: 5 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "sprouts_print_set", qty: 2 }, { sku: "sprouts_nb_print", qty: 2 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "seedlings_print_set", qty: 2 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "both_bands_print_set", qty: 1 }, { sku: "sprouts_nb_print", qty: 2 }])).toBe(false);
  });
  it("MAIL was not offered: note shown", () => {
    expect(likelyNeedsGround([{ sku: "sprouts_print_set", qty: 1 }, { sku: "sprouts_nb_print", qty: 6 }])).toBe(true);
    expect(likelyNeedsGround([{ sku: "seedlings_print_set", qty: 1 }, { sku: "seedlings_nb_print", qty: 5 }])).toBe(true);
    expect(likelyNeedsGround([{ sku: "both_bands_print_set", qty: 1 }, { sku: "seedlings_nb_print", qty: 3 }])).toBe(true);
    expect(likelyNeedsGround([{ sku: "both_bands_print_set", qty: 2 }])).toBe(true);
  });
  it("Back to Eden: Study Guide from 8, Study & Journal from 6; paperback never (cap 10)", () => {
    expect(likelyNeedsGround([{ sku: "bte_study_guide_print", qty: 7 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "bte_study_guide_print", qty: 8 }])).toBe(true);
    expect(likelyNeedsGround([{ sku: "bte_study_journal_print", qty: 5 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "bte_study_journal_print", qty: 6 }])).toBe(true);
    expect(likelyNeedsGround([{ sku: "bte_paperback_print", qty: 10 }])).toBe(false);
    expect(likelyNeedsGround([{ sku: "bte_paperback_print", qty: 1 }, { sku: "bte_study_guide_print", qty: 1 }])).toBe(false);
  });
});
