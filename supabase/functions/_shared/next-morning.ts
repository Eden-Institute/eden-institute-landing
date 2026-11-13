// supabase/functions/_shared/next-morning.ts
//
// When the free-week "next-morning note" (magnet_email_queue position 1) goes out.
// Added 2026-11-13 (Lane 2 deep audit, area 5 finding F10; founder tap 2026-11-13
// "Send at 8 AM Central").
//
// Both free-week welcomes promise "Tomorrow morning I will send you a short note on
// how to get started." Since #352 (2026-10-14) the note was queued at sign-up + 18 h,
// so it landed in the morning only 33 of 91 times (Oct 14 to Nov 13): an evening
// sign-up got it the next afternoon, a mid-morning sign-up in the middle of the night.
// The note now goes at 8:00 AM Central (6 AM Pacific, 9 AM Eastern) the next morning,
// whatever time the family signed up. Her welcome wording stays as written.
//
// "The next morning" = the first 8:00 AM Central at least NEXT_MORNING_MIN_GAP_HOURS
// after the sign-up. With 6 hours, a sign-up between midnight and 2 AM Central (still
// "tonight" to most people) gets it at 8 AM that same morning; a sign-up from 2 AM on
// gets it at 8 AM the following day. 8 AM is never inside a daylight-saving jump
// (those happen at 2 AM), so the conversion below is exact on every day of the year.
//
// The drain cron (Vercel drain-nurture-queue) runs every 15 minutes, so the note
// actually leaves between 8:00 and about 8:15 AM Central. Both-band families still get
// the second band's note 2 days after the first (#640, applied at send time).

export const NEXT_MORNING_HOUR_CENTRAL = 8;
export const NEXT_MORNING_MIN_GAP_HOURS = 6;

const TZ = 'America/Chicago';
const HOUR_MS = 3_600_000;

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** The Central (America/Chicago) wall-clock date and time of an instant. */
export function centralParts(ms: number): { y: number; m: number; d: number; h: number; min: number } {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: Number(p.minute) };
}

/**
 * UTC ms of hour:00 Central on the Central calendar date y-m-d (m is 1-12; d may run
 * past the month end, Date.UTC rolls it over). Central is UTC-5 (CDT) or UTC-6 (CST):
 * exactly one of the two reads back as hour:00 Central for any hour outside 1-2 AM.
 */
export function centralWallTimeToUtc(y: number, m: number, d: number, hour: number): number {
  for (const offsetHours of [5, 6]) {
    const ms = Date.UTC(y, m - 1, d, hour + offsetHours);
    const back = centralParts(ms);
    if (back.h === hour && back.min === 0) return ms;
  }
  throw new Error(`no ${hour}:00 Central on ${y}-${m}-${d}`);
}

/** When to send the next-morning note for a sign-up at `signupMs` (UTC ms). */
export function nextMorningSendAt(signupMs: number): number {
  const earliest = signupMs + NEXT_MORNING_MIN_GAP_HOURS * HOUR_MS;
  const { y, m, d } = centralParts(signupMs);
  // Day 0 (same Central date) or day 1 always qualifies: day 1's 8 AM is at least
  // 8 hours after any time on day 0. Day 2 is a belt-and-braces fallback.
  for (let k = 0; k <= 2; k++) {
    const at = centralWallTimeToUtc(y, m, d + k, NEXT_MORNING_HOUR_CENTRAL);
    if (at >= earliest) return at;
  }
  return centralWallTimeToUtc(y, m, d + 2, NEXT_MORNING_HOUR_CENTRAL);
}

const labelFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });

/** "8 AM Central on Sat, Nov 14" for founder alerts. */
export function centralMorningLabel(ms: number): string {
  return `${NEXT_MORNING_HOUR_CENTRAL} AM Central on ${labelFmt.format(new Date(ms))}`;
}
