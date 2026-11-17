// 2026-11-17, Lane 2 area 10 D3: the dashboard's click-to-open rate is people who clicked / people who
// opened, so it can never pass 100% because one reader clicked several links.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ctr } from "../lib/emailRates";

describe("email click-to-open rate", () => {
  it("is unique clicks over unique opens, rounded", () => {
    expect(ctr(18, 50)).toBe("36%");
    expect(ctr(1, 3)).toBe("33%");
    expect(ctr(0, 10)).toBe("0%");
  });

  it("shows a dash when nobody opened (Apple Mail privacy can hide opens)", () => {
    expect(ctr(3, 0)).toBe("—");
  });

  it("the table passes the unique columns, not the totals", () => {
    const src = readFileSync("src/components/founder/EmailEngagementTab.tsx", "utf8");
    expect(src).toMatch(/ctr\(e\.unique_clicks, e\.unique_opens\)/);
    expect(src).not.toMatch(/ctr\(e\.clicks, e\.opens\)/);
  });
});
