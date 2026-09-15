/**
 * One source for the herb count and the Apothecary tier prices.
 *
 * The count drifted three ways at once: "one hundred herbs" on Start, the
 * welcome tour and the tier comparison, "100 monograph library" on the Astro
 * homepage, and "300 herbs" everywhere else, while production held 300 rows.
 * Customer-facing copy now reads HERB_CATALOG_SIZE (src/lib/herbCatalog.ts)
 * and tier prices read APOTHECARY_PRICES (src/lib/apothecaryPrices.ts). These
 * tests fail if a page hardcodes either again.
 *
 * Scope: every .ts/.tsx/.astro file under src/ and web/, except
 *   - src/pages/Index.tsx (owned by a separate change),
 *   - src/integrations/supabase/types.ts (generated),
 *   - src/test/ (tests quote the strings they forbid),
 *   - the two source modules themselves.
 * Comment lines are ignored: a code comment explaining "all 300 herbs x 8
 * patterns" is documentation, not copy a customer reads.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { HERB_CATALOG_SIZE } from "@/lib/herbCatalog";
import { APOTHECARY_PRICES } from "@/lib/apothecaryPrices";
import { PUBLIC_TIERS, TIER_DEPTH } from "@/lib/apothecaryTiers";

const ROOT = join(__dirname, "..", "..");
const EXCLUDED = new Set(
  [
    "src/pages/Index.tsx",
    "src/integrations/supabase/types.ts",
    "src/lib/herbCatalog.ts",
    "src/lib/apothecaryPrices.ts",
  ].map((p) => p.split("/").join(sep)),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|astro)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

interface SourceLine {
  file: string;
  line: number;
  text: string;
}

/** Non-comment lines of every in-scope file. */
function codeLines(): SourceLine[] {
  const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "web"))].filter((f) => {
    const rel = relative(ROOT, f);
    return !EXCLUDED.has(rel) && !rel.startsWith(join("src", "test"));
  });
  const lines: SourceLine[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((text, i) => {
        const t = text.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        lines.push({ file: relative(ROOT, file), line: i + 1, text });
      });
  }
  return lines;
}

const LINES = codeLines();

function offenders(pattern: RegExp): string[] {
  return LINES.filter((l) => pattern.test(l.text)).map(
    (l) => `${l.file}:${l.line}: ${l.text.trim()}`,
  );
}

describe("herb count copy", () => {
  it("scans a real tree (guards against a vacuous pass)", () => {
    expect(LINES.length).toBeGreaterThan(5000);
    expect(LINES.some((l) => l.file.endsWith("Start.tsx"))).toBe(true);
    expect(LINES.some((l) => l.file.endsWith("index.astro"))).toBe(true);
  });

  it("the catalog constant matches the production row count", () => {
    // public.herbs held 300 rows (H001-H300, all Approved) on 2026-09-15.
    expect(HERB_CATALOG_SIZE).toBe(300);
  });

  it("no page says 'hundred herbs'", () => {
    expect(offenders(/hundred\s+herbs/i)).toEqual([]);
  });

  it("no page carries the stale 100 herbs / 100 monograph count", () => {
    expect(offenders(/\b100\s+(herb|monograph)/i)).toEqual([]);
  });

  it("no page hardcodes the current count instead of HERB_CATALOG_SIZE", () => {
    expect(offenders(/\b300\s+(herb|monograph)/i)).toEqual([]);
  });

  it("the pages that state a count read the constant", () => {
    for (const rel of [
      "src/pages/apothecary/Start.tsx",
      "src/pages/apothecary/WelcomeTour.tsx",
      "src/pages/apothecary/ApothecaryWelcome.tsx",
      "src/components/apothecary/TierComparison.tsx",
      "web/pages/index.astro",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toContain("HERB_CATALOG_SIZE");
    }
  });
});

describe("tier prices", () => {
  const TIER_PRICE_STRINGS = [
    APOTHECARY_PRICES.seed.monthly,
    APOTHECARY_PRICES.seed.yearly,
    APOTHECARY_PRICES.root.monthly,
    APOTHECARY_PRICES.root.yearly,
    APOTHECARY_PRICES.practitioner.monthly,
    APOTHECARY_PRICES.practitioner.yearly,
    APOTHECARY_PRICES.practitioner.standardMonthly,
    APOTHECARY_PRICES.practitioner.standardYearly,
  ];

  it("display prices are well-formed dollar strings", () => {
    for (const p of TIER_PRICE_STRINGS) expect(p).toMatch(/^\$\d+(\.\d{2})?$/);
  });

  it("no page hardcodes a Seed, Root or Practitioner price", () => {
    const escaped = TIER_PRICE_STRINGS.map((p) => p.replace(/[$.]/g, "\\$&"));
    // Not followed by another digit or a decimal part, so "$499" does not
    // flag "$4999" or "$499.50".
    const pattern = new RegExp(`(${escaped.join("|")})(?![\\d]|\\.\\d)`);
    expect(offenders(pattern)).toEqual([]);
  });

  it("the public tier cards use APOTHECARY_PRICES", () => {
    const byId = Object.fromEntries(PUBLIC_TIERS.map((t) => [t.id, t]));
    expect(byId.seed.monthlyPrice).toBe(APOTHECARY_PRICES.seed.monthly);
    expect(byId.root.monthlyPrice).toBe(APOTHECARY_PRICES.root.monthly);
    expect(byId.practitioner.monthlyPrice).toBe(APOTHECARY_PRICES.practitioner.monthly);
  });

  it("Pricing and Start wire every paid card to APOTHECARY_PRICES", () => {
    const pricing = readFileSync(join(ROOT, "src/pages/apothecary/Pricing.tsx"), "utf8");
    for (const key of [
      "APOTHECARY_PRICES.seed.monthly",
      "APOTHECARY_PRICES.seed.yearly",
      "APOTHECARY_PRICES.root.monthly",
      "APOTHECARY_PRICES.root.yearly",
      "APOTHECARY_PRICES.practitioner.monthly",
      "APOTHECARY_PRICES.practitioner.yearly",
      "APOTHECARY_PRICES.seed.monthlyLookupKey",
      "APOTHECARY_PRICES.root.yearlyLookupKey",
    ]) {
      expect(pricing, key).toContain(key);
    }
    const start = readFileSync(join(ROOT, "src/pages/apothecary/Start.tsx"), "utf8");
    for (const key of [
      "APOTHECARY_PRICES.seed.monthly",
      "APOTHECARY_PRICES.seed.yearly",
      "APOTHECARY_PRICES.root.monthly",
      "APOTHECARY_PRICES.root.yearly",
    ]) {
      expect(start, key).toContain(key);
    }
  });
});

describe("tier ladder matches the herb tier model", () => {
  const ROOT_ONLY = /interaction|refer|citation|source/i;

  it("Free and Seed never promise a Root field", () => {
    for (const item of [...TIER_DEPTH.free, ...TIER_DEPTH.seed]) {
      expect(item).not.toMatch(ROOT_ONLY);
    }
  });

  it("Root names interactions, refer-out and sources", () => {
    const root = TIER_DEPTH.root.join(" ");
    expect(root).toMatch(/interaction/i);
    expect(root).toMatch(/refer/i);
    expect(root).toMatch(/source/i);
  });

  it("Free promises every herb and the safety fields", () => {
    const free = TIER_DEPTH.free.join(" ");
    expect(free).toContain(String(HERB_CATALOG_SIZE));
    expect(free).toMatch(/contraindication/i);
    expect(free).toMatch(/pregnan/i);
  });

  it("no tier copy uses an em dash", () => {
    const all = [...TIER_DEPTH.free, ...TIER_DEPTH.seed, ...TIER_DEPTH.root];
    for (const item of all) expect(item).not.toContain("—");
  });
});
