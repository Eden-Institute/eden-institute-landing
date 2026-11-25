/**
 * /online-year/thank-you (punch #472): the approved lines filled with the band, the names and the end dates
 * (web/lib/onlineYearThankYou.ts). Every time zone is passed explicitly, so the results do not depend on the
 * machine running the test.
 */
import { describe, it, expect } from "vitest";
import {
  formatOnlineYearEndDate,
  joinChildNames,
  onlineYearStartWeek1,
  onlineYearYearSentences,
  readOnlineYearReadyStatus,
} from "../../web/lib/onlineYearThankYou";

const CHI = "America/Chicago";

describe("end dates in the buyer's time zone", () => {
  it("an 8 PM Central purchase ends at 02:00 UTC a year later and reads as the 25th in Central, not the UTC date", () => {
    const ends = "2027-11-26T02:00:00+00:00";
    expect(formatOnlineYearEndDate(ends, CHI)).toBe("November 25, 2027");
    expect(formatOnlineYearEndDate(ends, "UTC")).toBe("November 26, 2027");
    expect(onlineYearYearSentences([{ name: "Ava", ends_at: ends }], CHI)).toEqual(["Ava's year runs through November 25, 2027."]);
  });

  it("formats like 'November 25, 2027' (Sydney is ahead of UTC)", () => {
    expect(formatOnlineYearEndDate("2027-11-25T15:00:00Z", "Australia/Sydney")).toBe("November 26, 2027");
    expect(formatOnlineYearEndDate("2028-03-01T15:30:00Z", CHI)).toBe("March 1, 2028");
  });
});

describe("the children + end date sentence", () => {
  const D1 = "2027-11-25T18:00:00Z"; // Nov 25 in Central
  it("one child: the approved one-child sentence", () => {
    expect(onlineYearYearSentences([{ name: "Ava", ends_at: D1 }], CHI)).toEqual(["Ava's year runs through November 25, 2027."]);
  });

  it("two children, same date: the approved two-children sentence", () => {
    expect(onlineYearYearSentences([{ name: "Ava", ends_at: D1 }, { name: "Ben", ends_at: D1 }], CHI)).toEqual([
      "Ava and Ben's years run through November 25, 2027.",
    ]);
  });

  it("three or more names: 'A, B and C's years run through...'", () => {
    const kids = ["Ava", "Ben", "Cal", "Dee"].map((name) => ({ name, ends_at: D1 }));
    expect(onlineYearYearSentences(kids.slice(0, 3), CHI)).toEqual(["Ava, Ben and Cal's years run through November 25, 2027."]);
    expect(onlineYearYearSentences(kids, CHI)).toEqual(["Ava, Ben, Cal and Dee's years run through November 25, 2027."]);
  });

  it("different end dates (an early renewal): one sentence per date, earliest date first, names in the order given", () => {
    const kids = [
      { name: "Ava", ends_at: "2028-03-01T15:30:00Z" }, // renewed early: starts where her old year ends
      { name: "Ben", ends_at: "2027-11-26T02:00:00Z" },
      { name: "Cal", ends_at: "2027-11-26T02:00:00Z" },
    ];
    expect(onlineYearYearSentences(kids, CHI)).toEqual([
      "Ben and Cal's years run through November 25, 2027.",
      "Ava's year runs through March 1, 2028.",
    ]);
  });

  it("groups by the date the BUYER sees: two instants on one Central day are one sentence, two in UTC", () => {
    const kids = [
      { name: "Ava", ends_at: "2027-11-25T23:00:00Z" }, // 5 PM Central, Nov 25
      { name: "Ben", ends_at: "2027-11-26T03:00:00Z" }, // 9 PM Central, Nov 25 (Nov 26 in UTC)
    ];
    expect(onlineYearYearSentences(kids, CHI)).toEqual(["Ava and Ben's years run through November 25, 2027."]);
    expect(onlineYearYearSentences(kids, "UTC")).toEqual([
      "Ava's year runs through November 25, 2027.",
      "Ben's year runs through November 26, 2027.",
    ]);
  });

  it("names with an apostrophe or a hyphen go in as typed", () => {
    expect(onlineYearYearSentences([{ name: "D'Andre", ends_at: D1 }, { name: "Mary-Kate", ends_at: D1 }], CHI)).toEqual([
      "D'Andre and Mary-Kate's years run through November 25, 2027.",
    ]);
  });

  it("joinChildNames", () => {
    expect(joinChildNames([])).toBe("");
    expect(joinChildNames(["Ava"])).toBe("Ava");
    expect(joinChildNames(["Ava", "Ben"])).toBe("Ava and Ben");
    expect(joinChildNames(["Ava", "Ben", "Cal"])).toBe("Ava, Ben and Cal");
  });
});

describe("the Week 1 line", () => {
  it("puts the child's name where the plan writes [Child]", () => {
    expect(onlineYearStartWeek1([{ name: "Ava", ends_at: "2027-11-25T18:00:00Z" }])).toBe(
      "Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and Ava's name goes on every page.",
    );
  });
  it("two or more children: the approved 'each child's name' line, no names", () => {
    for (const n of [2, 3]) {
      const kids = ["Ava", "Ben", "Cal"].slice(0, n).map((name) => ({ name, ends_at: "x" }));
      expect(onlineYearStartWeek1(kids)).toBe(
        "Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and each child's name goes on their own pages.",
      );
    }
  });
});

describe("reading the status answer", () => {
  it("ready and well formed", () => {
    expect(readOnlineYearReadyStatus({ state: "ready", band: "seedlings", children: [{ name: "Ava", ends_at: "2027-11-26T02:00:00+00:00" }] })).toEqual({
      band: "seedlings",
      children: [{ name: "Ava", ends_at: "2027-11-26T02:00:00+00:00" }],
    });
  });
  it("pending, malformed or unexpected answers are not ready", () => {
    for (const d of [
      null,
      "ready",
      { state: "pending" },
      { state: "ready", band: "kit", children: [{ name: "Ava", ends_at: "2027-11-26T02:00:00Z" }] },
      { state: "ready", band: "sprouts", children: [] },
      { state: "ready", band: "sprouts", children: [{ name: "", ends_at: "2027-11-26T02:00:00Z" }] },
      { state: "ready", band: "sprouts", children: [{ name: "Ava", ends_at: "not a date" }] },
      { state: "ready", band: "sprouts", children: [null] },
      { error: "not_found" },
    ]) {
      expect(readOnlineYearReadyStatus(d), JSON.stringify(d)).toBeNull();
    }
  });
});
