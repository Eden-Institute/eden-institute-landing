// web/lib/onlineYearThankYou.ts
//
// The pure half of /online-year/thank-you (punch #472): reads the online-year-order-status answer and
// fills the approved lines (web/lib/onlineYearCopy.ts OY_APPROVED_THANK_YOU) with the band, the
// children's names and their end dates. No I/O; unit tested in src/test/onlineYearThankYou.test.ts.
//
// End dates are written in the BUYER's time zone (the browser's, unless a time zone is passed, which
// the tests do): an 8 PM Central purchase ends at 02:00 UTC a year later, and must read as the 25th,
// not the UTC date (the 26th).
//
// Children in one order can end on different dates (an early renewal starts where the old year
// ends), so the children are grouped by the date shown, earliest date first, and each group gets
// the approved one-child or two-or-more sentence. Three or more names read "A, B and C".

import { OY_APPROVED, OY_APPROVED_THANK_YOU, type OnlineYearBandKey } from "./onlineYearCopy";

export interface OnlineYearChildYear {
  name: string;
  /** ISO timestamp from online_year_licenses.ends_at. */
  ends_at: string;
}

export interface OnlineYearReadyStatus {
  band: OnlineYearBandKey;
  children: OnlineYearChildYear[];
}

const BAND_WORD: Record<OnlineYearBandKey, string> = { sprouts: "Sprouts", seedlings: "Seedlings" };

/** The plan writes Sprouts; Seedlings buyers see Seedlings (3-5) and "Open Seedlings". */
export function onlineYearLineForBand(line: string, band: OnlineYearBandKey): string {
  return line
    .replace(OY_APPROVED.bandLabel.sprouts, () => OY_APPROVED.bandLabel[band])
    .replace(/\bSprouts\b/g, () => BAND_WORD[band]);
}

export function onlineYearReadyHeading(band: OnlineYearBandKey): string {
  return onlineYearLineForBand(OY_APPROVED_THANK_YOU.readyHeading, band);
}

export function onlineYearOpenButton(band: OnlineYearBandKey): string {
  return onlineYearLineForBand(OY_APPROVED_THANK_YOU.openButton, band);
}

/** "November 25, 2027" in the given time zone (default: the browser's own). */
export function formatOnlineYearEndDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

/** "Ava", "Ava and Ben", "Ava, Ben and Cal". */
export function joinChildNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** One approved sentence per end date shown, earliest first; names keep the order the status gave. */
export function onlineYearYearSentences(children: readonly OnlineYearChildYear[], timeZone?: string): string[] {
  const groups = new Map<string, { first: number; names: string[] }>();
  for (const c of children) {
    const label = formatOnlineYearEndDate(c.ends_at, timeZone);
    const at = Date.parse(c.ends_at);
    const g = groups.get(label);
    if (g) {
      g.names.push(c.name);
      g.first = Math.min(g.first, at);
    } else {
      groups.set(label, { first: at, names: [c.name] });
    }
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].first - b[1].first)
    .map(([label, g]) =>
      g.names.length === 1
        ? OY_APPROVED_THANK_YOU.yearOneChild.replace("[Child]", () => g.names[0]).replace("[end date]", () => label)
        : OY_APPROVED_THANK_YOU.yearTwoOrMore
            .replace("[Child] and [Child]", () => joinChildNames(g.names))
            .replace("[end date]", () => label),
    );
}

/** The Week 1 line: one child = her name where the plan writes [Child]; two or more = the approved "each child's name" line (no names). */
export function onlineYearStartWeek1(children: readonly OnlineYearChildYear[]): string {
  if (children.length >= 2) return OY_APPROVED_THANK_YOU.startWeek1TwoOrMore;
  return OY_APPROVED_THANK_YOU.startWeek1.replace("[Child]", () => children[0]?.name ?? "");
}

/** The status answer when it is ready and well formed; null for pending or anything unexpected. */
export function readOnlineYearReadyStatus(data: unknown): OnlineYearReadyStatus | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { state?: unknown; band?: unknown; children?: unknown };
  if (d.state !== "ready" || (d.band !== "sprouts" && d.band !== "seedlings")) return null;
  if (!Array.isArray(d.children) || d.children.length === 0) return null;
  const children: OnlineYearChildYear[] = [];
  for (const c of d.children as unknown[]) {
    const name = c && typeof c === "object" ? (c as { name?: unknown }).name : undefined;
    const ends = c && typeof c === "object" ? (c as { ends_at?: unknown }).ends_at : undefined;
    if (typeof name !== "string" || !name.trim() || typeof ends !== "string" || Number.isNaN(Date.parse(ends))) return null;
    children.push({ name: name.trim(), ends_at: ends });
  }
  return { band: d.band, children };
}
