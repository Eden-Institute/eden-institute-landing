import { describe, expect, it } from "vitest";
import {
  buildWeek1Tables,
  chicagoToday,
  instagramShare,
  monthLabel,
  recentMonthStarts,
  recentWeekStarts,
  week1SourcesSince,
  weekLabel,
  type Week1SourcesData,
} from "@/lib/week1Sources";

// Saturday 2026-10-17, 5 PM in Chicago (CDT, UTC-5).
const SAT_OCT_17 = new Date("2026-10-17T22:00:00Z");

const zeros = {
  total: 0,
  instagram_tagged: 0,
  instagram_referrer: 0,
  facebook: 0,
  other_tagged: 0,
  untagged: 0,
};

describe("chicagoToday", () => {
  it("uses the Chicago calendar date, not UTC", () => {
    // 03:30 UTC Monday is still Sunday evening in Chicago.
    expect(chicagoToday(new Date("2026-10-19T03:30:00Z"))).toEqual({ y: 2026, m: 10, d: 18 });
  });
});

describe("recentWeekStarts", () => {
  it("returns 12 Monday keys, newest first, starting with this week", () => {
    const weeks = recentWeekStarts(SAT_OCT_17);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toBe("2026-10-12");
    expect(weeks[1]).toBe("2026-10-05");
    expect(weeks[11]).toBe("2026-07-27");
    for (const w of weeks) {
      const [y, m, d] = w.split("-").map(Number);
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1);
    }
  });

  it("treats Sunday as the end of the ISO week", () => {
    expect(recentWeekStarts(new Date("2026-10-18T17:00:00Z"))[0]).toBe("2026-10-12");
  });

  it("keeps Sunday night in Chicago in the old week even when UTC is already Monday", () => {
    expect(recentWeekStarts(new Date("2026-10-19T03:30:00Z"))[0]).toBe("2026-10-12");
    expect(recentWeekStarts(new Date("2026-10-19T05:30:00Z"))[0]).toBe("2026-10-19");
  });

  it("steps cleanly across the November DST change", () => {
    expect(recentWeekStarts(new Date("2026-11-10T18:00:00Z"), 3)).toEqual([
      "2026-11-09",
      "2026-11-02",
      "2026-10-26",
    ]);
  });
});

describe("recentMonthStarts", () => {
  it("returns 6 first-of-month keys, newest first", () => {
    expect(recentMonthStarts(SAT_OCT_17)).toEqual([
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
      "2026-05-01",
    ]);
  });

  it("rolls back across a year boundary", () => {
    expect(recentMonthStarts(new Date("2027-02-10T18:00:00Z"))).toEqual([
      "2027-02-01",
      "2027-01-01",
      "2026-12-01",
      "2026-11-01",
      "2026-10-01",
      "2026-09-01",
    ]);
  });

  it("uses the Chicago month on the last evening of a month", () => {
    // 04:30 UTC Nov 1 = 11:30 PM Oct 31 in Chicago.
    expect(recentMonthStarts(new Date("2026-11-01T04:30:00Z"))[0]).toBe("2026-10-01");
  });
});

describe("week1SourcesSince", () => {
  it("starts a day before the oldest bucket shown (the 6th month back)", () => {
    expect(week1SourcesSince(SAT_OCT_17)).toBe("2026-04-30T00:00:00.000Z");
  });
});

describe("labels", () => {
  it("formats week and month keys without a timezone shift", () => {
    expect(weekLabel("2026-10-12")).toBe("Oct 12");
    expect(monthLabel("2026-10-01")).toBe("Oct 2026");
  });
});

describe("buildWeek1Tables", () => {
  const data: Week1SourcesData = {
    by_week: [
      // Outside the 12 weeks shown: ignored.
      { week_start: "2026-06-01", ...zeros, total: 50, untagged: 50 },
      { week_start: "2026-10-05", total: 14, instagram_tagged: 2, instagram_referrer: 2, facebook: 2, other_tagged: 1, untagged: 7 },
      { week_start: "2026-10-12", total: 11, instagram_tagged: 0, instagram_referrer: 0, facebook: 2, other_tagged: 5, untagged: 4 },
    ],
    by_month: [
      { month_start: "2026-09-01", total: 53, instagram_tagged: 0, instagram_referrer: 0, facebook: 35, other_tagged: 0, untagged: 18 },
      { month_start: "2026-10-01", total: 32, instagram_tagged: 2, instagram_referrer: 2, facebook: 7, other_tagged: 6, untagged: 15 },
    ],
  };

  it("fills every week and month, newest first, with zeros where nothing came in", () => {
    const { weeks, months } = buildWeek1Tables(data, SAT_OCT_17);
    expect(weeks.map((w) => w.key)).toEqual(recentWeekStarts(SAT_OCT_17));
    expect(months.map((m) => m.key)).toEqual(recentMonthStarts(SAT_OCT_17));
    expect(weeks[2]).toMatchObject({ key: "2026-09-28", ...zeros, instagram: 0, current: false });
    expect(months[5]).toMatchObject({ key: "2026-05-01", label: "May 2026", ...zeros });
    expect(weeks.reduce((s, w) => s + w.total, 0)).toBe(25); // the June week is not shown
  });

  it("adds tagged and referrer Instagram and flags only the current period", () => {
    const { weeks, months } = buildWeek1Tables(data, SAT_OCT_17);
    expect(weeks[0]).toMatchObject({ key: "2026-10-12", label: "Oct 12", total: 11, instagram: 0, current: true });
    expect(weeks[1]).toMatchObject({ key: "2026-10-05", total: 14, instagram_tagged: 2, instagram_referrer: 2, instagram: 4, current: false });
    expect(months[0]).toMatchObject({ key: "2026-10-01", label: "Oct 2026", instagram: 4, current: true });
    expect(weeks.filter((w) => w.current)).toHaveLength(1);
    expect(months.filter((m) => m.current)).toHaveLength(1);
  });

  it("tolerates a null payload and non-numeric counts", () => {
    const empty = buildWeek1Tables(null, SAT_OCT_17);
    expect(empty.weeks).toHaveLength(12);
    expect(empty.months).toHaveLength(6);
    expect(empty.weeks.every((w) => w.total === 0)).toBe(true);

    const odd = buildWeek1Tables(
      {
        by_week: [{ week_start: "2026-10-12", total: "3", instagram_tagged: null, instagram_referrer: 1 } as never],
        by_month: [],
      },
      SAT_OCT_17,
    );
    expect(odd.weeks[0]).toMatchObject({ total: 3, instagram_tagged: 0, instagram_referrer: 1, instagram: 1 });
  });
});

describe("instagramShare", () => {
  it("sums Instagram over the rows and rounds the share", () => {
    const { weeks } = buildWeek1Tables(
      {
        by_week: [
          { week_start: "2026-10-05", total: 14, instagram_tagged: 2, instagram_referrer: 2, facebook: 2, other_tagged: 1, untagged: 7 },
          { week_start: "2026-10-12", total: 11, instagram_tagged: 0, instagram_referrer: 0, facebook: 2, other_tagged: 5, untagged: 4 },
        ],
        by_month: [],
      },
      SAT_OCT_17,
    );
    expect(instagramShare(weeks)).toEqual({ instagram: 4, total: 25, pct: "16%" });
  });

  it("shows a dash rather than 0% when there were no sign-ups", () => {
    expect(instagramShare(buildWeek1Tables(null, SAT_OCT_17).weeks)).toEqual({ instagram: 0, total: 0, pct: "—" });
  });
});
