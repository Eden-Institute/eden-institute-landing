// Plants of the Nativity, Advent 2026 (Lane SEO batch 5, b5_advent).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADVENT_ATTRS,
  ADVENT_BUTTON,
  ADVENT_HEADING,
  ADVENT_HIDE_FROM,
  ADVENT_LINE,
  adventOfferHtml,
} from "../../web/lib/adventOffer";

const read = (p: string) => readFileSync(p, "utf8");
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("adventOfferHtml", () => {
  it("opens the Advent pop-up with source advent_2026, named per placement", () => {
    const doc = parse(adventOfferHtml("herb"));
    expect(doc.querySelector("aside p")?.textContent).toBe(ADVENT_HEADING);
    const b = doc.querySelector("button[data-waitlist-source]")!;
    expect(b.textContent).toBe(ADVENT_BUTTON);
    expect(b.getAttribute("data-waitlist-source")).toBe("advent_2026");
    expect(b.getAttribute("data-waitlist-form-name")).toBe("herb_advent");
    expect(b.getAttribute("data-cta")).toBe("herb-advent");
    for (const [k, v] of Object.entries(ADVENT_ATTRS)) expect(b.getAttribute(k)).toBe(v);
    expect(doc.querySelector("aside")?.getAttribute("data-advent-until")).toBe(ADVENT_HIDE_FROM);
  });

  it("hides from the moment the last Sunday email goes (Dec 20, 7 PM Central)", () => {
    expect(Date.parse(ADVENT_HIDE_FROM)).toBe(Date.parse("2026-12-21T01:00:00Z"));
    expect(read("web/components/AdventOffer.astro")).toContain("Date.now() >= until");
  });

  it("uses the founder-reviewed box copy, with no em dashes", () => {
    expect(ADVENT_HEADING).toBe("Plants of the Nativity, four Advent Sundays");
    expect(ADVENT_LINE).toBe(
      "Four short Sunday emails through Advent, each one teaching a plant from the Christmas story. We start with frankincense on Nov 29.",
    );
    for (const f of ["web/lib/adventOffer.ts", "web/components/AdventOffer.astro", "web/pages/advent.astro"]) {
      expect(read(f).includes("—"), f).toBe(false);
    }
  });

  it("is on every plant page, on articles that mount the pop-up, and on /advent (noindex)", () => {
    expect(read("web/pages/herbs/[slug].astro")).toContain('<AdventOffer placement="herb" />');
    expect(read("web/pages/learn/[slug].astro")).toContain(
      '{(d.freeWeekOffer || d.bookOffer) && <AdventOffer placement="learn_end" class="mt-6" />}',
    );
    const page = read("web/pages/advent.astro");
    expect(page).toContain('<AdventOffer placement="advent_page" />');
    expect(page).toContain("<WaitlistController client:only");
    expect(page).toMatch(/noindex=\{true\}/);
  });
});

describe("Advent back end", () => {
  const sql = read("supabase/migrations/20261117033011_advent_optins_and_audience.sql");

  it("the opt-in table is service-role only, with RLS on", () => {
    expect(sql).toContain("create table if not exists public.seasonal_optins");
    expect(sql).toContain("alter table public.seasonal_optins enable row level security;");
    expect(sql).toContain("grant select, insert, update on table public.seasonal_optins to service_role;");
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated)/);
  });

  it("broadcast_audience knows advent_2026 and gives the founder a copy", () => {
    expect(sql).toContain(
      "when p_audience = 'advent_2026' then l.email in (select s.email from seasonal s where s.series = 'advent_2026')",
    );
    expect(sql).toContain("'catchup_unused', 'catchup_quiet', 'advent_2026')");
    expect(read("supabase/functions/_shared/broadcast-stage-plan.ts")).toContain("'advent_2026',");
  });

  it("resend-waitlist records the opt-in for everyone and sends the approved note", () => {
    const ef = read("supabase/functions/resend-waitlist/index.ts");
    expect(ef).toContain("seasonal_optins?on_conflict=email,series");
    expect(ef).toContain("} else if (source === ADVENT_SOURCE) {");
    expect(ef).toContain("emailContent = buildAdventConfirmEmail(firstNameHtml);");
  });
});
