// Tests for _shared/free-week-order.ts (punch #473, founder tap 2026-11-23 "One band, then the other").
// A model of drainMagnetQueue runs every 15 minutes over a family's free-week rows with the real
// order check, the 2-day band spacing and the one-email-a-day guard, and the tests read off what
// each family receives and when.
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  centralDayNumber,
  FREE_WEEK_ORDER_POSITIONS,
  FREE_WEEK_STEPS,
  type FreeWeekOrderRow,
  isFreeWeekOrderStep,
  planFreeWeekStep,
} from './free-week-order.ts';
import { BAND_SPACING_MS, FREE_WEEK_BAND_SPACED_POSITIONS, freeWeekLessonSendAt, type LessonNumber } from './free-week-lessons.ts';
import { centralParts, nextMorningSendAt } from './next-morning.ts';
import { nextCentralMorning } from './send-day-guard.ts';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const ORDER = [1, 11, 12, 13, 14, 15, 2, 8];

type Band = 'sprouts' | 'seedlings';
type Row = FreeWeekOrderRow & { holds: number };

let seq = 0;
// Random ids, so ties on scheduled_for come back in a random order (the live bug).
function rid(rand: () => number): string {
  return `${Math.floor(rand() * 1e9).toString(16).padStart(8, '0')}-${(seq++).toString(16)}`;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The rows resend-waitlist queues for one free-week sign-up (positions 1, 11-15, 2, 8). */
function signUp(band: Band, signupMs: number, rand: () => number): Row[] {
  const nm = nextMorningSendAt(signupMs);
  const at: [number, number][] = [
    [1, nm],
    ...([1, 2, 3, 4, 5] as LessonNumber[]).map((k): [number, number] => [10 + k, freeWeekLessonSendAt(nm, k)]),
    [2, signupMs + 7 * DAY],
    [8, signupMs + 10 * DAY],
  ];
  return at.map(([pos, ms]) => ({
    id: rid(rand), band, sequence_position: pos, status: 'pending',
    scheduled_for: new Date(ms).toISOString(), sent_at: null, holds: 0,
  }));
}

/**
 * drainMagnetQueue, every 15 minutes from `startMs` for `days`: due rows in
 * scheduled_for.asc, band.desc, id.asc; then per row the order check (this file), the 2-day band
 * spacing, the one-a-day guard (any send to this address on this Central day holds the row to 8 AM
 * tomorrow), then the send. `owns` cancels that band's Day 10 note (the ownsBand skip).
 */
function drain(rows: Row[], startMs: number, days: number, opts: { owns?: Band; tick?: number } = {}): Row[] {
  const tick = opts.tick ?? 15 * MIN;
  const sendDays = new Set<number>();
  for (const r of rows) if (r.status === 'sent' && r.sent_at) sendDays.add(centralDayNumber(new Date(r.sent_at)));
  const end = startMs + days * DAY;
  for (let now = Math.ceil(startMs / tick) * tick; now <= end; now += tick) {
    let clock = now;
    const due = rows
      .filter((r) => r.status === 'pending' && Date.parse(r.scheduled_for!) <= now)
      .sort((a, b) =>
        Date.parse(a.scheduled_for!) - Date.parse(b.scheduled_for!) ||
        (a.band! < b.band! ? 1 : a.band! > b.band! ? -1 : 0) ||
        (a.id < b.id ? -1 : 1));
    for (const r of due) {
      const at = new Date(clock);
      const plan = planFreeWeekStep(r, rows, at);
      if (!plan.send) {
        assert(plan.until.getTime() > clock, 'a hold always moves the row later');
        r.scheduled_for = plan.until.toISOString();
        r.holds++;
        continue;
      }
      if (FREE_WEEK_BAND_SPACED_POSITIONS.has(r.sequence_position)) {
        const sib = rows.find((o) => o.band !== r.band && o.sequence_position === r.sequence_position && o.status === 'sent' &&
          Date.parse(o.sent_at!) >= clock - BAND_SPACING_MS);
        if (sib) {
          r.scheduled_for = new Date(Date.parse(sib.sent_at!) + BAND_SPACING_MS).toISOString();
          r.holds++;
          continue;
        }
      }
      if (r.sequence_position === 8 && opts.owns === r.band) {
        r.status = 'cancelled';
        continue;
      }
      const today = centralDayNumber(at);
      if (sendDays.has(today)) {
        r.scheduled_for = nextCentralMorning(at).toISOString();
        r.holds++;
        continue;
      }
      sendDays.add(today);
      clock += 1000;
      r.status = 'sent';
      r.sent_at = new Date(clock).toISOString();
    }
  }
  return rows;
}

function sentInOrder(rows: Row[], band: Band): Row[] {
  return rows.filter((r) => r.band === band && r.status === 'sent').sort((a, b) => Date.parse(a.sent_at!) - Date.parse(b.sent_at!));
}
const dayN = (r: Row) => centralDayNumber(new Date(r.sent_at!));

function assertOneADay(rows: Row[]) {
  const days = rows.filter((r) => r.status === 'sent').map(dayN);
  assertEquals(new Set(days).size, days.length, 'never two free-week emails on one Central day');
}

function assertBandRunsInOrder(rows: Row[], band: Band, expected = ORDER) {
  const got = sentInOrder(rows, band).map((r) => r.sequence_position);
  assertEquals(got, expected, `${band}: note, Lessons 1-5, Day 7, Day 10, in that order`);
}

/** Days after the band's note on which each step went: on schedule this is 0,1,2,3,4,5,6,9. */
function rhythm(rows: Row[], band: Band): number[] {
  const s = sentInOrder(rows, band);
  return s.map((r) => dayN(r) - dayN(s[0]));
}

Deno.test('steps: note, Lessons 1-5, Day 7, Day 10; the same positions the band spacing covers', () => {
  assertEquals([...FREE_WEEK_ORDER_POSITIONS], ORDER);
  assertEquals(FREE_WEEK_STEPS.map((s) => s.day), [1, 2, 3, 4, 5, 6, 7, 10]);
  assertEquals(new Set(FREE_WEEK_ORDER_POSITIONS), new Set(FREE_WEEK_BAND_SPACED_POSITIONS));
  for (const pos of [3, 4, 5, 6, 7, 9, 10, 16]) assert(!isFreeWeekOrderStep(pos), `position ${pos}`);
  // A dormant or unknown position is never held by this check.
  const row = { id: 'x', band: 'sprouts', sequence_position: 3, status: 'pending', scheduled_for: '2026-11-24T14:00:00Z', sent_at: null };
  assertEquals(planFreeWeekStep(row, [row]), { send: true });
});

Deno.test('one band only: every step goes exactly when it was queued (nothing held), any sign-up time', () => {
  // 2:13 PM, 3:27 AM, 11:50 PM and 12:30 AM Central, a March afternoon, and the week before the November change.
  const signups = [
    '2026-11-24T20:13:00Z', '2026-11-20T09:27:00Z', '2026-11-25T05:50:00Z', '2026-11-25T06:30:00Z',
    '2027-03-08T19:00:00Z', '2027-11-01T05:40:00Z', '2027-10-29T19:00:00Z',
  ];
  for (const s of signups) {
    for (const band of ['sprouts', 'seedlings'] as Band[]) {
      const rand = mulberry(Date.parse(s));
      const rows = signUp(band, Date.parse(s), rand);
      const queued = new Map(rows.map((r) => [r.id, Date.parse(r.scheduled_for!)]));
      drain(rows, Date.parse(s), 14);
      assertBandRunsInOrder(rows, band);
      for (const r of rows) {
        assertEquals(r.holds, 0, `${s} ${band} position ${r.sequence_position} was never held`);
        assert(Date.parse(r.sent_at!) - queued.get(r.id)! < 15 * MIN, `${s} ${band} ${r.sequence_position} sent on time`);
      }
    }
  }
});

Deno.test('one band, the one known exception: a 12:xx AM sign-up whose Day 10 falls after the November change', () => {
  // Day 7 and Day 10 are queued at sign-up time + 7 and + 10 days. For a sign-up between midnight and
  // 1 AM Central in the 10 days before the fall clock change, Day 10 lands at 11:xx PM, only 2 Central
  // days after Day 7, so the 3-day gap moves it to 8 AM the next morning. Nothing else moves.
  const s = Date.parse('2027-10-30T05:45:00Z'); // Sat Oct 30 2027, 12:45 AM CDT
  const rand = mulberry(s);
  const rows = signUp('sprouts', s, rand);
  drain(rows, s, 14);
  assertBandRunsInOrder(rows, 'sprouts');
  for (const r of rows.filter((x) => x.sequence_position !== 8)) assertEquals(r.holds, 0, `position ${r.sequence_position}`);
  const day10 = rows.find((r) => r.sequence_position === 8)!;
  assertEquals(day10.holds, 1);
  assertEquals(centralParts(Date.parse(day10.sent_at!)).h, 8);
  assertEquals(dayN(day10) - centralDayNumber(new Date(s + 10 * DAY)), 1);
});

Deno.test('both bands in the same minute: Sprouts runs Days 1-10, then Seedlings runs its own 10 days, one a day', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rand = mulberry(seed);
    const signup = Date.parse('2026-11-21T16:09:00Z') + seed * 37 * MIN;
    const rows = [...signUp('sprouts', signup, rand), ...signUp('seedlings', signup + 20 * 1000, rand)];
    drain(rows, signup, 30);
    assertBandRunsInOrder(rows, 'sprouts');
    assertBandRunsInOrder(rows, 'seedlings');
    assertOneADay(rows);
    const sp = sentInOrder(rows, 'sprouts');
    const sd = sentInOrder(rows, 'seedlings');
    // Seedlings' note goes the morning after Sprouts' Day 10 note, at 8 AM Central.
    assertEquals(dayN(sd[0]) - dayN(sp[sp.length - 1]), 1, `seed ${seed}: second band starts the next day`);
    assertEquals(centralParts(Date.parse(sd[0].sent_at!)).h, 8);
    // The second band keeps the free-week rhythm: lessons daily, Day 7, then Day 10 three days later.
    assertEquals(rhythm(rows, 'seedlings'), [0, 1, 2, 3, 4, 5, 6, 9], `seed ${seed}`);
    // The first band was never slowed down.
    for (const r of sp) assertEquals(r.holds, 0);
  }
});

Deno.test('Seedlings taken first (a day earlier): Seedlings runs first, Sprouts waits for it', () => {
  const rand = mulberry(7);
  const s1 = Date.parse('2026-11-16T21:45:00Z');
  const rows = [...signUp('seedlings', s1, rand), ...signUp('sprouts', s1 + 1.6 * DAY, rand)];
  drain(rows, s1, 30);
  assertBandRunsInOrder(rows, 'seedlings');
  assertBandRunsInOrder(rows, 'sprouts');
  assertOneADay(rows);
  const sd = sentInOrder(rows, 'seedlings');
  const sp = sentInOrder(rows, 'sprouts');
  assertEquals(dayN(sp[0]) - dayN(sd[sd.length - 1]), 1);
  for (const r of sd) assertEquals(r.holds, 0);
});

Deno.test('the 11/24 live shape: second band held to 8:00:00 by the old guard releases in order', () => {
  // As the queue stood on Tue 11/24: Sprouts note + Lesson 1 (and for some, Lesson 2) sent; every
  // Seedlings row from the note to Lesson 5 held to 8:00:00 AM by the one-a-day guard, many on the
  // same morning. Any tie order (40 random id sets) must come out in order.
  for (let seed = 1; seed <= 40; seed++) {
    const rand = mulberry(seed * 101);
    const signup = Date.parse('2026-11-22T22:59:00Z'); // Sun 11/22 4:59 PM Central
    const sp = signUp('sprouts', signup, rand);
    const sd = signUp('seedlings', signup + 30 * 1000, rand);
    const sent = (r: Row, iso: string) => { r.status = 'sent'; r.sent_at = iso; };
    sent(sp[0], '2026-11-23T14:00:05Z');
    sent(sp[1], '2026-11-24T14:00:04Z');
    const wed = '2026-11-25T14:00:00.000Z';
    const thu = '2026-11-26T14:00:00.000Z';
    sd[0].scheduled_for = '2026-11-25T14:00:14.000Z';
    sd[1].scheduled_for = '2026-11-26T14:00:15.000Z';
    sd[2].scheduled_for = wed;
    sd[3].scheduled_for = thu;
    const rows = [...sp, ...sd];
    drain(rows, Date.parse('2026-11-24T16:45:00Z'), 30);
    assertBandRunsInOrder(rows, 'sprouts');
    assertBandRunsInOrder(rows, 'seedlings');
    assertOneADay(rows);
    const lastSprouts = sentInOrder(rows, 'sprouts').at(-1)!;
    assertEquals(dayN(sentInOrder(rows, 'seedlings')[0]) - dayN(lastSprouts), 1);
    assertEquals(rhythm(rows, 'seedlings'), [0, 1, 2, 3, 4, 5, 6, 9]);
  }
});

Deno.test('already partway through both bands (both notes sent): neither band is paused, each stays in order', () => {
  // Families who took both before 11/20 got both notes; they keep going, one email a day.
  const rand = mulberry(3);
  const signup = Date.parse('2026-11-17T20:32:00Z');
  const sp = signUp('sprouts', signup, rand).filter((r) => [1, 2, 8].includes(r.sequence_position));
  const sd = signUp('seedlings', signup + 11 * 1000, rand).filter((r) => [1, 2, 8].includes(r.sequence_position));
  sp[0].status = 'sent'; sp[0].sent_at = '2026-11-18T14:00:05Z';
  sd[0].status = 'sent'; sd[0].sent_at = '2026-11-20T14:15:03Z'; sd[0].scheduled_for = '2026-11-20T14:00:05Z';
  const rows = [...sp, ...sd];
  drain(rows, Date.parse('2026-11-24T16:45:00Z'), 20);
  assertBandRunsInOrder(rows, 'sprouts', [1, 2, 8]);
  assertBandRunsInOrder(rows, 'seedlings', [1, 2, 8]);
  assertOneADay(rows);
  // Sprouts was not held back for Seedlings: its check-in went when queued.
  assertEquals(sp[1].holds, 0);
  // Seedlings' check-in lands on its own Day 7 (6 days after its 11/20 note) or later, never before.
  assert(dayN(sd[1]) - dayN(sd[0]) >= 6);
  assert(dayN(sd[2]) - dayN(sd[1]) >= 3);
});

Deno.test('first band owns its Starter (Day 10 note cancelled): the second band starts the day after', () => {
  const rand = mulberry(11);
  const signup = Date.parse('2026-11-21T17:02:00Z');
  const rows = [...signUp('sprouts', signup, rand), ...signUp('seedlings', signup + 13 * 1000, rand)];
  drain(rows, signup, 30, { owns: 'sprouts' });
  assertBandRunsInOrder(rows, 'sprouts', [1, 11, 12, 13, 14, 15, 2]);
  assertBandRunsInOrder(rows, 'seedlings');
  assertOneADay(rows);
  const day10 = centralDayNumber(new Date(signup + 10 * DAY));
  assertEquals(dayN(sentInOrder(rows, 'seedlings')[0]), day10 + 1);
});

Deno.test('a held step moves to 8 AM Central on a later day, across the clock change too', () => {
  const rand = mulberry(5);
  for (const signup of [Date.parse('2026-11-21T17:02:00Z'), Date.parse('2027-10-28T17:02:00Z'), Date.parse('2027-03-05T17:02:00Z')]) {
    const rows = [...signUp('sprouts', signup, rand), ...signUp('seedlings', signup + 5000, rand)];
    rows[0].status = 'sent';
    rows[0].sent_at = rows[0].scheduled_for;
    const sdNote = rows[8];
    const now = new Date(Date.parse(sdNote.scheduled_for!) + 5 * MIN);
    const plan = planFreeWeekStep(sdNote, rows, now);
    assert(!plan.send);
    if (!plan.send) {
      assertEquals(plan.reason, 'other_band_first');
      assertEquals(centralParts(plan.until.getTime()).h, 8);
      assertEquals(centralParts(plan.until.getTime()).min, 0);
      // The day after Sprouts' Day 10 note.
      assertEquals(centralDayNumber(plan.until), centralDayNumber(new Date(Date.parse(rows[7].scheduled_for!))) + 1);
    }
  }
});

Deno.test('a band never sends a later step while an earlier one is pending (e.g. a retry in backoff)', () => {
  const rand = mulberry(9);
  const signup = Date.parse('2026-11-21T17:02:00Z');
  const rows = signUp('sprouts', signup, rand);
  rows[0].status = 'sent'; rows[0].sent_at = rows[0].scheduled_for;
  rows[1].scheduled_for = new Date(Date.parse(rows[2].scheduled_for!) + 3 * 60 * MIN).toISOString(); // Lesson 1 retrying
  const now = new Date(Date.parse(rows[2].scheduled_for!) + MIN);
  const plan = planFreeWeekStep(rows[2], rows, now);
  assert(!plan.send && plan.reason === 'earlier_step');
});

Deno.test('nurture-emails runs the order check after the opt-out check and before the spacing, dedup and send', async () => {
  const src = (await Deno.readTextFile(new URL('../nurture-emails/index.ts', import.meta.url))).replace(/\r\n/g, '\n');
  assertStringIncludes(src, "import { FREE_WEEK_ORDER_POSITIONS, isFreeWeekOrderStep, planFreeWeekStep } from '../_shared/free-week-order.ts';");
  const start = src.indexOf('async function drainMagnetQueue(');
  const drainSrc = src.slice(start, src.indexOf('\n}\n', start));
  const iBlocked = drainSrc.indexOf("sendBlocked(email, 'homeschool', row.created_at)");
  const iOrder = drainSrc.indexOf('planFreeWeekStep(row, family, new Date())');
  const iSpacing = drainSrc.indexOf('BAND_SPACED_POSITIONS.has(pos)');
  const iSend = drainSrc.indexOf('await sendEmail(');
  assert(iBlocked > 0 && iOrder > iBlocked, 'order check after the opt-out check');
  assert(iSpacing > iOrder, 'order check before the band spacing');
  assert(iSend > iOrder, 'order check before sendEmail claims the day');
  // Reads the family's rows fail-closed, holds only a still-pending row, and moves on.
  assertStringIncludes(drainSrc, "'free-week order check',");
  assertStringIncludes(drainSrc, 'rowsOrThrow(');
  assertStringIncludes(drainSrc, 'sequence_position=in.(${FREE_WEEK_ORDER_POSITIONS.join(\',\')})&select=id,band,sequence_position,status,scheduled_for,sent_at');
  const hold = drainSrc.slice(iOrder, iSpacing);
  assertStringIncludes(hold, 'magnet_email_queue?id=eq.${row.id}&status=eq.pending');
  assertStringIncludes(hold, 'scheduled_for: plan.until.toISOString()');
  assertStringIncludes(hold, 'continue;');
});
