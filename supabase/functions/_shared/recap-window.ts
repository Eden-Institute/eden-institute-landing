// supabase/functions/_shared/recap-window.ts
//
// Where the live EVENING RECAP window starts (founder-evening-recap).
//
// Until 2026-11-06 the recap covered "today, 00:00 CT up to the moment it runs". It runs at
// 01:00 UTC (7 PM CST / 8 PM CDT), so anything that happened between the recap and midnight
// landed in NO recap at all: the next evening's window started at the following midnight.
// ESA orders ET-1043 and ET-1044 ($300.99, paid 2026-11-04 8:24 PM CT) never appeared in one.
// Camila's go, 2026-11-06: each recap covers the time since the previous evening's recap.
//
// The start is anchored on the cron's UTC hour, not "24 hours ago", so consecutive recaps meet
// exactly (no gap, no overlap) whether the 01:00 run or the 01:37 retry pass is the one that
// sends, and it is unaffected by daylight saving (the cron itself is fixed in UTC).
//
// Keep RECAP_CRON_UTC_HOUR in step with the schedule of /api/cron/founder-evening-recap in
// vercel.json.

export const RECAP_CRON_UTC_HOUR = 1;

// A run within this much of a scheduled slot still belongs to that slot, so the 01:00 run and
// the 01:37 retry both anchor on the PREVIOUS evening's slot rather than on their own.
const SLOT_SLACK_MS = 3 * 60 * 60 * 1000;

/** Start of the live recap window: the newest scheduled recap slot at least three hours before `now`. */
export function recapWindowStart(now: Date, cronUtcHour = RECAP_CRON_UTC_HOUR): Date {
  const ref = new Date(now.getTime() - SLOT_SLACK_MS);
  const anchor = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), cronUtcHour));
  if (anchor.getTime() > ref.getTime()) anchor.setUTCDate(anchor.getUTCDate() - 1);
  return anchor;
}
