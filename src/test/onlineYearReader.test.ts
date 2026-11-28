import { describe, expect, it } from "vitest";
import { OY_APPROVED_READER, OY_READER_DRAFT, OY_READER_DRAFT_APPROVED } from "../../web/lib/onlineYearCopy";
import {
  atLimitLine,
  bandLicense,
  bandsHeld,
  callSignin,
  chunks,
  retryTimeText,
  displayName,
  endDateText,
  errorLine,
  inLastTwoWeeks,
  licensedLine,
  PREVIEW_HEADER,
  RA_PAGES,
  type ReaderSession,
  TG_LAYOUT,
  tgRange,
  topLine,
  weekLabel,
  yearEndedLine,
} from "../../web/lib/onlineYearReader";

describe("Online Year reader: book layout (OY0 build, checked by eye)", () => {
  it("puts every week of both Teacher's Guides on the right six pages", () => {
    expect(tgRange("sprouts", { kind: "week", week: 1 })).toEqual([13, 18]);
    expect(tgRange("sprouts", { kind: "week", week: 16 })).toEqual([103, 108]);
    expect(tgRange("sprouts", { kind: "week", week: 36 })).toEqual([223, 228]);
    expect(tgRange("seedlings", { kind: "week", week: 1 })).toEqual([10, 15]);
    expect(tgRange("seedlings", { kind: "week", week: 36 })).toEqual([220, 225]);
    expect(tgRange("sprouts", { kind: "front" })).toEqual([1, 12]);
    expect(tgRange("sprouts", { kind: "back" })).toEqual([229, 240]);
    expect(tgRange("seedlings", { kind: "back" })).toEqual([226, 245]);
    expect(() => tgRange("sprouts", { kind: "week", week: 37 })).toThrow();
  });

  it("matches the page counts the server enforces (online-year-signin READER_PAGES)", () => {
    expect(TG_LAYOUT.sprouts.total).toBe(240);
    expect(TG_LAYOUT.seedlings.total).toBe(245);
    expect(RA_PAGES).toEqual({ sprouts: 112, seedlings: 160 });
    for (const b of ["sprouts", "seedlings"] as const) expect(TG_LAYOUT[b].front + 36 * 6 <= TG_LAYOUT[b].total).toBe(true);
  });

  it("asks the server for at most 12 pages a call", () => {
    expect(chunks(226, 245)).toEqual([[226, 237], [238, 245]]);
    expect(chunks(13, 18)).toEqual([[13, 18]]);
  });

  it("labels weeks with the plant from the published scope and sequence", () => {
    expect(weekLabel("sprouts", 1)).toBe("Week 1 · Lavender");
    expect(weekLabel("seedlings", 1)).toBe("Week 1 · Elderberry");
  });
});

describe("Online Year reader: the approved lines, filled in", () => {
  it("top line, name line, device line, year-ended line", () => {
    expect(topLine("sprouts", "2027-12-01T15:00:00Z")).toBe("Online Year · Sprouts (K-2) · open through December 1, 2027");
    expect(licensedLine("Ruth Smith", "ruth@example.com")).toBe("Licensed to Ruth Smith · ruth@example.com · for use at home");
    expect(atLimitLine(3)).toBe("You're signed in on 3 devices, your family's limit. Signing in here signs out the one you used longest ago.");
    expect(yearEndedLine("Ada", "2027-12-01T15:00:00Z")).toBe(
      "Ada's Online Year ended on December 1, 2027. Everything you printed is yours to keep. Renew for another 12 months to pick up where you left off.",
    );
  });

  it("shows end dates in Central time, not UTC", () => {
    // 03:00 UTC on Dec 2 is still Dec 1 in Central.
    expect(endDateText("2027-12-02T03:00:00Z")).toBe("December 1, 2027");
  });

  it("knows the last two weeks of a year", () => {
    const now = new Date("2027-11-20T12:00:00Z");
    expect(inLastTwoWeeks("2027-12-01T12:00:00Z", now)).toBe(true);
    expect(inLastTwoWeeks("2027-12-20T12:00:00Z", now)).toBe(false);
    expect(inLastTwoWeeks("2027-11-19T12:00:00Z", now)).toBe(false);
  });

  it("maps every server error to a line, and the approved lines carry no em dashes", () => {
    for (const c of ["CODE_INVALID", "TOO_MANY_ATTEMPTS", "RATE_LIMITED", "SIGNED_OUT", "NO_LICENSE", "EMAIL_INVALID", "SOMETHING_WRONG"]) {
      expect(errorLine(c).length).toBeGreaterThan(10);
    }
    expect(JSON.stringify({ OY_APPROVED_READER, OY_READER_DRAFT })).not.toMatch(/—/);
  });

  it("the reader lines are the words Camila approved on her review page (2026-11-28)", () => {
    expect(OY_READER_DRAFT_APPROVED).toBe(true);
    expect(OY_READER_DRAFT).toEqual({
      sendCodeButton: "Email me a code",
      codeLabel: "Your 6-digit code",
      codeInvalid: "That code didn't work. Check the newest email from us, or send a new code.",
      tooManyTries: "That code has had too many tries. Please send a new code.",
      slowDown: "Too many tries for now. You can try again at [time].",
      signedOut: "You've been signed out on this device. Sign in again to keep going.",
      noYearHere: "Your Online Year isn't for this band. Choose your band above.",
      teachersGuide: "Teacher's Guide",
      storybook: "Read-Aloud",
      beforeWeek1: "Getting Started",
      week: "Week [N] · [Plant]",
      backOfBook: "Academic Standards & Final Notes",
      previous: "Previous pages",
      next: "Next pages",
      signOut: "Sign out of this device",
      loading: "Opening your pages...",
    });
  });

  it("tells her exactly when she can try again after too many tries", () => {
    const now = new Date("2026-12-01T20:37:00Z");
    // 23 minutes left in the hour: 21:00 UTC is 3:00 PM in Central.
    expect(retryTimeText(23 * 60, now, "America/Chicago")).toBe("3:00 PM");
    // No number from the server: the next top of the hour, which is when the limit resets.
    expect(retryTimeText(undefined, now, "America/Chicago")).toBe("3:00 PM");
    expect(errorLine("RATE_LIMITED", { retry_after_seconds: 23 * 60 }, now)).toMatch(/^Too many tries for now\. You can try again at \d{1,2}:00 (AM|PM)\.$/);
  });
});

describe("Online Year reader: the session", () => {
  const s: ReaderSession = {
    parent: { first_name: "Ruth", license_name: "Ruth Smith", email: "ruth@example.com" },
    licenses: [
      { id: "1", band: "sprouts", child_name: "Ada", kind: "first_child", starts_at: "2026-12-01T00:00:00Z", ends_at: "2027-12-01T00:00:00Z" },
      { id: "2", band: "sprouts", child_name: "Ben", kind: "sibling", starts_at: "2026-12-05T00:00:00Z", ends_at: "2027-12-05T00:00:00Z" },
    ],
    device_limit: 4,
  };
  it("opens the band whose first-child year it holds, and names the family on every page", () => {
    expect(bandsHeld(s)).toEqual(["sprouts"]);
    expect(bandLicense(s, "sprouts")?.child_name).toBe("Ada");
    expect(bandLicense(s, "seedlings")).toBeNull();
    expect(displayName(s)).toBe("Ruth Smith");
    expect(displayName({ ...s, parent: { first_name: null, license_name: null, email: "x@y.com" } })).toBe("x@y.com");
  });

  it("calls online-year-signin with the publishable key, no cookies, and the preview header only when set", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await callSignin({ action: "request", email: "a@b.com" }, { url: "https://x.supabase.co", apikey: "pk", preview: "p".repeat(30), fetchImpl: fake });
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(seen[0].url).toBe("https://x.supabase.co/functions/v1/online-year-signin");
    expect(seen[0].init.credentials).toBe("omit");
    expect((seen[0].init.headers as Record<string, string>)[PREVIEW_HEADER]).toBe("p".repeat(30));
    await callSignin({ action: "session", token: "t" }, { url: "https://x.supabase.co", apikey: "pk", fetchImpl: fake });
    expect((seen[1].init.headers as Record<string, string>)[PREVIEW_HEADER]).toBeUndefined();
  });
});

describe("Online Year reader: print, done and portfolio lines (approved Nov 23)", () => {
  it("fills in the child and the week", async () => {
    const { printLine, doneLine, portfolioButtonLine } = await import("../../web/lib/onlineYearReader");
    expect(printLine("Ada")).toBe("Print Ada's Notebook pages for this week");
    expect(doneLine(3, "Ada")).toBe("Mark Week 3 done for Ada");
    expect(portfolioButtonLine("Ada")).toBe("Download Ada's portfolio");
  });
});
