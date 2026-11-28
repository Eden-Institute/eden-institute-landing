import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { certificateLine, longDate, makePortfolioPdf, portfolioIntro, portfolioRows, schoolYear, yearFinished } from "../../web/lib/onlineYearPortfolio";

const base = { child: "Ada", band: "sprouts" as const, starts_at: "2026-12-01T15:00:00Z", ends_at: "2027-12-01T15:00:00Z" };

describe("Online Year portfolio and certificate (OY7)", () => {
  it("lists done weeks in order with the date, the plant and the week's Scripture", () => {
    const rows = portfolioRows("sprouts", [{ week: 2, done_on: "2026-12-08" }, { week: 1, done_on: "2026-12-01" }]);
    expect(rows.map((r) => r.week)).toEqual([1, 2]);
    expect(rows[0]).toEqual({
      week: 1,
      date: "December 1, 2026",
      plant: "Lavender",
      scripture: "Psalm 139:14: I am fearfully and wonderfully made; wonderful are Your works.",
    });
    expect(portfolioRows("seedlings", [{ week: 1, done_on: "2026-12-01" }])[0].plant).toBe("Elderberry");
  });

  it("uses the approved portfolio and certificate words", () => {
    expect(portfolioIntro("Ada")).toBe("Ada's portfolio: week, date finished, plant, Scripture, plus the standards the year is aligned to.");
    const done = Array.from({ length: 36 }, (_, i) => ({ week: i + 1, done_on: "2027-08-01" }));
    expect(certificateLine({ ...base, done })).toBe("Ada finished the Sprouts year of Eden's Table and learned 36 plants. 2026-2027");
    expect(certificateLine({ ...base, band: "seedlings", done: done.slice(0, 30) })).toBe("Ada finished the Seedlings year of Eden's Table and learned 30 plants. 2026-2027");
  });

  it("earns the certificate at 36 weeks or when the year ends, not before", () => {
    const now = new Date("2027-06-01T00:00:00Z");
    expect(yearFinished({ ...base, done: [{ week: 1, done_on: "2026-12-01" }], now })).toBe(false);
    expect(yearFinished({ ...base, done: Array.from({ length: 36 }, (_, i) => ({ week: i + 1, done_on: "2027-05-01" })), now })).toBe(true);
    expect(yearFinished({ ...base, done: [], now: new Date("2027-12-02T00:00:00Z") })).toBe(true);
  });

  it("dates read as families write them", () => {
    expect(longDate("2026-12-01")).toBe("December 1, 2026");
    expect(schoolYear("2026-12-01T15:00:00Z", "2027-12-01T15:00:00Z")).toBe("2026-2027");
  });

  it("builds a real PDF: log pages, the standards, and the certificate page only when earned", async () => {
    const some = await PDFDocument.load(await makePortfolioPdf({ ...base, done: [{ week: 1, done_on: "2026-12-01" }], now: new Date("2027-01-01T00:00:00Z") }));
    const all = await PDFDocument.load(
      await makePortfolioPdf({ ...base, child: "Zoë", done: Array.from({ length: 36 }, (_, i) => ({ week: i + 1, done_on: "2027-08-01" })), now: new Date("2027-09-01T00:00:00Z") }),
    );
    expect(some.getTitle()).toBe("Ada's portfolio");
    expect(all.getPageCount()).toBeGreaterThan(some.getPageCount());
    expect(some.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
