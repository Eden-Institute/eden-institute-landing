// src/lib/week1Sources.ts
//
// Client-side shaping for the founder dashboard "Week 1 sign-ups by source"
// panel (src/components/founder/Week1SourcesPanel.tsx). The counting and the
// source bucketing happen in the database (founder_week1_signups_by_source,
// supabase/migrations/20261017224116_founder_week1_signups_by_source.sql);
// this file only decides WHICH weeks and months to show, fills the ones with
// no sign-ups with zeros, and formats labels.
//
// Weeks are ISO weeks (Monday start) and months are calendar months, both in
// America/Chicago, matching the server's date_trunc(... at time zone
// 'America/Chicago') and the rest of /founder.

export const WEEK1_TZ = "America/Chicago";
export const WEEK1_WEEKS_SHOWN = 12;
export const WEEK1_MONTHS_SHOWN = 6;

export interface Week1SourceCounts {
  total: number;
  instagram_tagged: number;
  instagram_referrer: number;
  facebook: number;
  other_tagged: number;
  untagged: number;
}

export interface Week1WeekBucket extends Week1SourceCounts {
  week_start: string; // YYYY-MM-DD, a Monday
}

export interface Week1MonthBucket extends Week1SourceCounts {
  month_start: string; // YYYY-MM-01
}

/** The RPC payload. Only buckets with at least one sign-up are present. */
export interface Week1SourcesData {
  by_week: Week1WeekBucket[];
  by_month: Week1MonthBucket[];
}

export interface Week1TableRow extends Week1SourceCounts {
  key: string; // YYYY-MM-DD bucket start
  label: string; // "Oct 12" for a week, "Oct 2026" for a month
  instagram: number; // instagram_tagged + instagram_referrer
  current: boolean; // the week or month that contains today (still filling)
}

const COUNT_KEYS = [
  "total",
  "instagram_tagged",
  "instagram_referrer",
  "facebook",
  "other_tagged",
  "untagged",
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string {
  // Normalise through Date.UTC so day/month overflow rolls over correctly.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Today's calendar date in America/Chicago. */
export function chicagoToday(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WEEK1_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Monday-start week keys, newest first, the first one being this week (Chicago). */
export function recentWeekStarts(now: Date, count: number = WEEK1_WEEKS_SHOWN): string[] {
  const { y, m, d } = chicagoToday(now);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const mondayOffset = (dow + 6) % 7; // days since Monday
  return Array.from({ length: count }, (_, i) => ymd(y, m, d - mondayOffset - 7 * i));
}

/** First-of-month keys, newest first, the first one being this month (Chicago). */
export function recentMonthStarts(now: Date, count: number = WEEK1_MONTHS_SHOWN): string[] {
  const { y, m } = chicagoToday(now);
  return Array.from({ length: count }, (_, i) => ymd(y, m - i, 1));
}

/**
 * p_since for the RPC: UTC midnight of the day BEFORE the oldest week or month
 * shown. Starting a day early is deliberate and harmless: Chicago midnight is
 * 05:00 or 06:00 UTC, so this always covers the whole oldest bucket, and any
 * earlier rows it picks up fall in a bucket the panel does not display.
 */
export function week1SourcesSince(now: Date): string {
  const weeks = recentWeekStarts(now);
  const months = recentMonthStarts(now);
  const oldest = [weeks[weeks.length - 1], months[months.length - 1]].sort()[0];
  const [y, m, d] = oldest.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString();
}

function toCounts(src: Partial<Record<(typeof COUNT_KEYS)[number], unknown>> | undefined): Week1SourceCounts {
  const out = {} as Week1SourceCounts;
  for (const k of COUNT_KEYS) {
    const v = Number(src?.[k]);
    out[k] = Number.isFinite(v) ? v : 0;
  }
  return out;
}

export function weekLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  });
}

function rowsFor(
  keys: string[],
  byKey: Map<string, Week1SourceCounts>,
  label: (key: string) => string,
): Week1TableRow[] {
  return keys.map((key, i) => {
    const c = byKey.get(key) ?? toCounts(undefined);
    return {
      ...c,
      key,
      label: label(key),
      instagram: c.instagram_tagged + c.instagram_referrer,
      current: i === 0,
    };
  });
}

/**
 * The two panel tables, newest first: the last 12 ISO weeks and the last 6
 * calendar months, with every missing bucket filled with zeros. Buckets the
 * RPC returns outside those ranges are ignored.
 */
export function buildWeek1Tables(
  data: Week1SourcesData | null | undefined,
  now: Date,
): { weeks: Week1TableRow[]; months: Week1TableRow[] } {
  const weekMap = new Map<string, Week1SourceCounts>();
  for (const b of data?.by_week ?? []) {
    if (b && typeof b.week_start === "string") weekMap.set(b.week_start.slice(0, 10), toCounts(b));
  }
  const monthMap = new Map<string, Week1SourceCounts>();
  for (const b of data?.by_month ?? []) {
    if (b && typeof b.month_start === "string") monthMap.set(b.month_start.slice(0, 10), toCounts(b));
  }
  return {
    weeks: rowsFor(recentWeekStarts(now), weekMap, weekLabel),
    months: rowsFor(recentMonthStarts(now), monthMap, monthLabel),
  };
}

/** Instagram's share of the rows' sign-ups, for the call-out line. */
export function instagramShare(rows: Week1TableRow[]): { instagram: number; total: number; pct: string } {
  const instagram = rows.reduce((s, r) => s + r.instagram, 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const pct = total > 0 ? `${Math.round((instagram / total) * 100)}%` : "—";
  return { instagram, total, pct };
}
