// supabase/functions/_shared/free-week-order.ts
//
// Free-week order for families who take BOTH bands (punch #473).
//
// Founder decision 2026-11-23 ~10:05 CT, tap "One band, then the other": still one Eden email a
// day; the second band's free week starts after the first band's is done and runs its own welcome
// note, Lessons 1-5, Day 7 check-in and Day 10 Starter note, in that order. No new wording.
//
// Why this exists: the 11/20 one-email-a-day guard (send-day-guard.ts) moved every second-band row to
// 8:00:00 AM the next morning while the first band sent its daily lesson. When the first band ran
// out, all of the second band's held rows shared one scheduled_for, and the drain's last tie-break
// (id.asc, a random uuid) would have sent them in random order: Lesson 3 before the welcome note,
// the Day 7 check-in first.
//
// The rule, checked by nurture-emails drainMagnetQueue for every free-week row right before it
// would send (after the opt-out check, before the 2-day band spacing and the one-a-day guard):
//   1. Band order. A band whose free week has not started yet (its next-morning note, position 1,
//      is not sent) waits while the other band still has free-week rows pending, if the other band
//      goes first: it already started, or neither started and its first row is due sooner (a tie
//      goes to Sprouts, the drain's band.desc tie-break). A band that already started is never
//      paused, so a family already partway through both keeps going (one email a day).
//   2. Step order. Within a band, a step never goes while an earlier step is still pending.
//   3. Rhythm. A step goes no sooner than the free-week day gap after the band's latest sent
//      step (Day 1 note, Days 2-6 lessons, Day 7 check-in, Day 10 Starter note), counted in
//      Central calendar days. On schedule (the first band) this never holds anything: the queue
//      times already keep these gaps.
// A held row moves to 8 AM Central on the first day it could go, worked out from the family's
// rows, so it is read once more instead of every morning. Nothing here sends, cancels or changes
// wording; it only decides "send now" or "hold until".

import { centralDay, centralMorning } from './send-day-guard.ts';
import { FREE_WEEK_LESSON_POSITIONS } from './free-week-lessons.ts';

export type FreeWeekOrderBand = 'sprouts' | 'seedlings';

/** One band's free-week steps in the order a family gets them, and the day each lands on (Day 1 = the next-morning note). */
export const FREE_WEEK_STEPS: readonly { pos: number; day: number }[] = [
  { pos: 1, day: 1 }, // next-morning note
  ...FREE_WEEK_LESSON_POSITIONS.map((pos, i) => ({ pos, day: i + 2 })), // Lessons 1-5 on Days 2-6
  { pos: 2, day: 7 }, // Day 7 check-in
  { pos: 8, day: 10 }, // Day 10 Starter note
];

/** magnet_email_queue positions this rule covers (the same set the 2-day band spacing covers). */
export const FREE_WEEK_ORDER_POSITIONS: readonly number[] = FREE_WEEK_STEPS.map((s) => s.pos);

const STEP_DAY = new Map<number, number>(FREE_WEEK_STEPS.map((s) => [s.pos, s.day]));
const STEP_RANK = new Map<number, number>(FREE_WEEK_STEPS.map((s, i) => [s.pos, i]));

export function isFreeWeekOrderStep(pos: number): boolean {
  return STEP_DAY.has(pos);
}

/** A magnet_email_queue row as the order check reads it. */
export interface FreeWeekOrderRow {
  id: string;
  band: string | null;
  sequence_position: number;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
}

export type FreeWeekHoldReason = 'other_band_first' | 'earlier_step' | 'step_gap';
export type FreeWeekPlan = { send: true } | { send: false; until: Date; reason: FreeWeekHoldReason };

/** The drain treats anything but 'seedlings' as Sprouts (nurture-emails drainMagnetQueue); so does this. */
function bandOf(b: string | null): FreeWeekOrderBand {
  return b === 'seedlings' ? 'seedlings' : 'sprouts';
}

/** A Central calendar date as a whole day count (only differences between two of these mean anything). */
export function centralDayNumber(at: Date): number {
  const [y, m, d] = centralDay(at).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function dayOf(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? centralDayNumber(new Date(ms)) : null;
}

/** A sent step's day: the day it was due, or the day it went if that was earlier (it never is). */
function sentDay(r: FreeWeekOrderRow): number | null {
  const due = dayOf(r.scheduled_for);
  const went = dayOf(r.sent_at);
  if (due === null) return went;
  if (went === null) return due;
  return Math.min(due, went);
}

/** Has this band's free week started? Its next-morning note went (or, for an old run with no note row, anything went). */
function started(rows: FreeWeekOrderRow[]): boolean {
  const note = rows.find((r) => r.sequence_position === 1);
  if (note) return note.status === 'sent';
  return rows.some((r) => r.status === 'sent');
}

function pendingRows(rows: FreeWeekOrderRow[]): FreeWeekOrderRow[] {
  return rows.filter((r) => r.status === 'pending');
}

/** Earliest scheduled_for among a band's pending rows (Infinity if none or unreadable). */
function firstDueMs(rows: FreeWeekOrderRow[]): number {
  let min = Infinity;
  for (const r of pendingRows(rows)) {
    const ms = r.scheduled_for ? Date.parse(r.scheduled_for) : NaN;
    if (Number.isFinite(ms) && ms < min) min = ms;
  }
  return min;
}

/**
 * The Central day each of a band's PENDING steps can go, walking the steps in order: never before
 * today, never before its own scheduled day, and never sooner than the day gap after the step before
 * it (sent or projected).
 */
export function projectFreeWeekBand(rows: FreeWeekOrderRow[], today: number): Map<number, number> {
  const proj = new Map<number, number>();
  let last: { day: number; stepDay: number } | null = null;
  for (const { pos, day: stepDay } of FREE_WEEK_STEPS) {
    const r = rows.find((x) => x.sequence_position === pos);
    if (!r) continue;
    if (r.status === 'sent') {
      const d = sentDay(r);
      // An old run's step sent months ago never pulls the anchor backwards.
      if (d !== null && (!last || d >= last.day)) last = { day: d, stepDay };
      continue;
    }
    if (r.status !== 'pending') continue; // cancelled or failed: skipped, never waited on
    let d = Math.max(today, dayOf(r.scheduled_for) ?? today);
    if (last) d = Math.max(d, last.day + stepDay - last.stepDay);
    proj.set(pos, d);
    last = { day: d, stepDay };
  }
  return proj;
}

/**
 * Send this free-week row now, or hold it until 8 AM Central on a later day.
 * `row` is the due row the drain read; `family` is every free-week row for the same address (both
 * bands; it may or may not include `row` itself; the drain's copy of `row` is used either way).
 */
export function planFreeWeekStep(row: FreeWeekOrderRow, family: FreeWeekOrderRow[], now: Date = new Date()): FreeWeekPlan {
  const pos = row.sequence_position;
  if (!isFreeWeekOrderStep(pos)) return { send: true };
  const today = centralDayNumber(now);
  const holdUntil = (day: number): Date => centralMorning(now, Math.max(day, today + 1) - today);

  const band = bandOf(row.band);
  const others = family.filter((r) => r.id !== row.id && isFreeWeekOrderStep(r.sequence_position));
  const mine = [...others.filter((r) => bandOf(r.band) === band), { ...row, status: 'pending' }];
  const theirs = others.filter((r) => bandOf(r.band) !== band);

  // 1. Band order.
  if (!started(mine) && pendingRows(theirs).length > 0) {
    let theyGoFirst = started(theirs);
    if (!theyGoFirst) {
      const a = firstDueMs(mine);
      const b = firstDueMs(theirs);
      theyGoFirst = b < a || (b === a && band === 'seedlings');
    }
    if (theyGoFirst) {
      const end = Math.max(today, ...projectFreeWeekBand(theirs, today).values());
      return { send: false, until: holdUntil(end + 1), reason: 'other_band_first' };
    }
  }

  // 2. Step order and 3. rhythm.
  const rank = STEP_RANK.get(pos)!;
  const proj = projectFreeWeekBand(mine, today);
  const due = proj.get(pos) ?? today;
  const earlierPending = mine.some((r) => r.status === 'pending' && r.id !== row.id && (STEP_RANK.get(r.sequence_position) ?? -1) < rank);
  if (earlierPending) return { send: false, until: holdUntil(due), reason: 'earlier_step' };
  if (due > today) return { send: false, until: holdUntil(due), reason: 'step_gap' };
  return { send: true };
}
