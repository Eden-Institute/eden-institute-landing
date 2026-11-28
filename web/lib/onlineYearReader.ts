// web/lib/onlineYearReader.ts
//
// The pure half of the Online Year reader (/online-year/sign-in, OY5, punch #472): how the printed Teacher's
// Guide is laid out, which pages a section covers, the approved top and name lines filled in, and the calls to
// the online-year-signin function. Unit tested in src/test/onlineYearReader.test.ts.
//
// Book layout (OY0 build, checked by eye on weeks 1, 16 and 36 of the files Lulu prints from):
//   Sprouts TG   240 pp = 12 front + 36 weeks x 6 + 12 back    Sprouts storybook   112 pp
//   Seedlings TG 245 pp =  9 front + 36 weeks x 6 + 20 back    Seedlings storybook 160 pp
// The same numbers live in supabase/functions/_shared/online-year-signin.ts READER_PAGES (the server refuses
// pages outside them).

import { OY_APPROVED, OY_APPROVED_ORDER_ERRORS, OY_APPROVED_READER, OY_APPROVED_THANK_YOU, OY_READER_DRAFT, type OnlineYearBandKey } from "./onlineYearCopy";
import { SEEDLINGS_WEEKS, SPROUTS_WEEKS } from "./scopeAndSequence";

export const TG_LAYOUT: Record<OnlineYearBandKey, { front: number; perWeek: number; total: number }> = {
  sprouts: { front: 12, perWeek: 6, total: 240 },
  seedlings: { front: 9, perWeek: 6, total: 245 },
};
export const RA_PAGES: Record<OnlineYearBandKey, number> = { sprouts: 112, seedlings: 160 };
export const PAGES_PER_CALL = 12;

export type TgSection = { kind: "front" } | { kind: "week"; week: number } | { kind: "back" };

/** Inclusive 1-based page range of a Teacher's Guide section. */
export function tgRange(band: OnlineYearBandKey, s: TgSection): [number, number] {
  const L = TG_LAYOUT[band];
  if (s.kind === "front") return [1, L.front];
  if (s.kind === "back") return [L.front + 36 * L.perWeek + 1, L.total];
  if (!Number.isInteger(s.week) || s.week < 1 || s.week > 36) throw new Error(`no week ${s.week}`);
  const from = L.front + (s.week - 1) * L.perWeek + 1;
  return [from, from + L.perWeek - 1];
}

/** Split a page range into calls of at most PAGES_PER_CALL pages (the server's limit). */
export function chunks(from: number, to: number, size = PAGES_PER_CALL): [number, number][] {
  const out: [number, number][] = [];
  for (let a = from; a <= to; a += size) out.push([a, Math.min(to, a + size - 1)]);
  return out;
}

export function plantFor(band: OnlineYearBandKey, week: number): string {
  const w = (band === "sprouts" ? SPROUTS_WEEKS : SEEDLINGS_WEEKS).find((x) => x.week === week);
  return w ? w.plant : "";
}

/** "Week 1 · Lavender" (draft label, see OY_READER_DRAFT.week). */
export function weekLabel(band: OnlineYearBandKey, week: number): string {
  return OY_READER_DRAFT.week.replace("[N]", String(week)).replace("[Plant]", plantFor(band, week));
}

/** A license end date as families read it: in Central time, the business's own zone (NP note, OY3 QA). */
export function endDateText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", year: "numeric", month: "long", day: "numeric" });
}

export function topLine(band: OnlineYearBandKey, endsAtIso: string): string {
  return OY_APPROVED_READER.topLine.replace("[Band]", OY_APPROVED.bandLabel[band]).replace("[end date]", endDateText(endsAtIso));
}

export function licensedLine(name: string, email: string): string {
  return OY_APPROVED_READER.licensedLine.replace("[parent's name]", name).replace("[email]", email);
}

export function atLimitLine(devices: number): string {
  return OY_APPROVED_READER.atLimit.replace("[N]", String(devices));
}

export function yearEndedLine(child: string, endsAtIso: string): string {
  return OY_APPROVED_READER.yearEnded.replace("[Child]", child).replace("[end date]", endDateText(endsAtIso));
}

export function lastTwoWeeksLine(endsAtIso: string): string {
  return OY_APPROVED_READER.lastTwoWeeks.replace("[end date]", endDateText(endsAtIso));
}

/** True in the last 14 days before a year ends (the approved "Last 2 weeks" line). */
export function inLastTwoWeeks(endsAtIso: string, now: Date = new Date()): boolean {
  const left = Date.parse(endsAtIso) - now.getTime();
  return left > 0 && left <= 14 * 86_400_000;
}

// ── Talking to online-year-signin ──────────────────────────────────────────────────────────────────────────

export const DEVICE_TOKEN_KEY = "eden_oy_device";
export const PREVIEW_KEY = "eden_oy_preview";
export const PREVIEW_HEADER = "x-online-year-preview";

export interface ReaderLicense {
  id: string;
  band: OnlineYearBandKey;
  child_name: string;
  kind: "first_child" | "sibling";
  starts_at: string;
  ends_at: string;
}
export interface ReaderSession {
  parent: { first_name: string | null; license_name: string | null; email: string };
  licenses: ReaderLicense[];
  device_limit: number;
}

/** The name on every page: the name from checkout, else the first name, else the email alone. */
export function displayName(s: ReaderSession): string {
  return (s.parent.license_name ?? "").trim() || (s.parent.first_name ?? "").trim() || s.parent.email;
}

/** The first-child license that opens a band's books, live or most recently ended. */
export function bandLicense(s: ReaderSession, band: OnlineYearBandKey): ReaderLicense | null {
  const first = s.licenses.filter((l) => l.band === band && l.kind === "first_child");
  first.sort((a, b) => b.ends_at.localeCompare(a.ends_at));
  return first[0] ?? null;
}

export function bandsHeld(s: ReaderSession): OnlineYearBandKey[] {
  return (["sprouts", "seedlings"] as const).filter((b) => bandLicense(s, b));
}

export type ApiResult = { status: number; body: Record<string, unknown> };

export async function callSignin(body: Record<string, unknown>, opts: { url: string; apikey: string; preview?: string | null; fetchImpl?: typeof fetch }): Promise<ApiResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: opts.apikey };
  if (opts.preview) headers[PREVIEW_HEADER] = opts.preview;
  const res = await (opts.fetchImpl ?? fetch)(`${opts.url}/functions/v1/online-year-signin`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "omit",
  });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = await res.json();
  } catch {
    /* an HTML error page from the gateway */
  }
  return { status: res.status, body: parsed };
}

/**
 * When a per-IP limit lifts, as a clock time in the viewer's own time zone ("3:00 PM"). The server says how many
 * seconds remain (retry_after_seconds); without it, the next top of the hour, which is when the buckets reset.
 */
export function retryTimeText(retryAfterSeconds: unknown, now: Date = new Date(), timeZone?: string): string {
  const secs = typeof retryAfterSeconds === "number" && retryAfterSeconds > 0 && retryAfterSeconds <= 3600
    ? retryAfterSeconds
    : 3600 - (Math.floor(now.getTime() / 1000) % 3600);
  return new Date(now.getTime() + secs * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) });
}

/** Which approved sentence a function error shows. `body` is the function's answer (for RATE_LIMITED's time). */
export function errorLine(code: unknown, body: Record<string, unknown> = {}, now: Date = new Date()): string {
  switch (code) {
    case "CODE_INVALID":
      return OY_READER_DRAFT.codeInvalid;
    case "TOO_MANY_ATTEMPTS":
      return OY_READER_DRAFT.tooManyTries;
    case "RATE_LIMITED":
      return OY_READER_DRAFT.slowDown.replace("[time]", retryTimeText(body.retry_after_seconds, now));
    case "SIGNED_OUT":
      return OY_READER_DRAFT.signedOut;
    case "NO_LICENSE":
      return OY_READER_DRAFT.noYearHere;
    case "EMAIL_INVALID":
      return OY_APPROVED_ORDER_ERRORS.email; // approved order-page line
    default:
      return OY_APPROVED_THANK_YOU.help; // approved help line
  }
}
