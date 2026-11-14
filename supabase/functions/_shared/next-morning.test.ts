// Tests for _shared/next-morning.ts (2026-11-13, Lane 2 area 5 F10: the free-week
// next-morning note goes at 8 AM Central the next morning, founder tap 2026-11-13).
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  centralMorningLabel,
  centralParts,
  centralWallTimeToUtc,
  NEXT_MORNING_HOUR_CENTRAL,
  NEXT_MORNING_MIN_GAP_HOURS,
  nextMorningSendAt,
} from './next-morning.ts';

const iso = (ms: number) => new Date(ms).toISOString();

Deno.test('settings are 8 AM Central with a 6 hour minimum gap', () => {
  assertEquals(NEXT_MORNING_HOUR_CENTRAL, 8);
  assertEquals(NEXT_MORNING_MIN_GAP_HOURS, 6);
});

Deno.test('8 AM Central converts to 14:00Z in winter (CST) and 13:00Z in summer (CDT)', () => {
  assertEquals(iso(centralWallTimeToUtc(2026, 11, 14, 8)), '2026-11-14T14:00:00.000Z');
  assertEquals(iso(centralWallTimeToUtc(2026, 7, 4, 8)), '2026-07-04T13:00:00.000Z');
});

Deno.test('day overflow rolls into the next month and year', () => {
  assertEquals(iso(centralWallTimeToUtc(2026, 11, 31, 8)), '2026-12-01T14:00:00.000Z');
  assertEquals(iso(centralWallTimeToUtc(2026, 12, 32, 8)), '2027-01-01T14:00:00.000Z');
});

Deno.test('an evening sign-up gets it at 8 AM Central the next day', () => {
  // Thu Nov 12 2026, 9:24 PM CST = Fri 03:24Z. Old rule: Fri 3:24 PM. New: Fri 8 AM.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-13T03:24:00Z'))), '2026-11-13T14:00:00.000Z');
});

Deno.test('a mid-morning sign-up gets it the next morning, not at 3 AM', () => {
  // Thu Nov 12, 9:45 AM CST. Old rule: Fri 3:45 AM. New: Fri 8 AM.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-12T15:45:00Z'))), '2026-11-13T14:00:00.000Z');
});

Deno.test('a sign-up just before or just after 8 AM still waits for the next day', () => {
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-12T13:59:00Z'))), '2026-11-13T14:00:00.000Z'); // 7:59 AM
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-12T14:00:00Z'))), '2026-11-13T14:00:00.000Z'); // 8:00 AM
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-12T14:01:00Z'))), '2026-11-13T14:00:00.000Z'); // 8:01 AM
});

Deno.test('midnight to 2 AM Central gets it at 8 AM that same morning; 2 AM on gets the next day', () => {
  // Fri Nov 13, 12:30 AM CST = 06:30Z: same morning, 7.5 h later.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-13T06:30:00Z'))), '2026-11-13T14:00:00.000Z');
  // Fri Nov 13, 2:00 AM CST = 08:00Z: exactly 6 h, still same morning.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-13T08:00:00Z'))), '2026-11-13T14:00:00.000Z');
  // Fri Nov 13, 2:01 AM CST: the following day.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-13T08:01:00Z'))), '2026-11-14T14:00:00.000Z');
  // Fri Nov 13, 5:00 AM CST (an early riser): the following day, never 3 h later.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-13T11:00:00Z'))), '2026-11-14T14:00:00.000Z');
});

Deno.test('11:59 PM Central gets the next morning, about 8 hours later', () => {
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-14T05:59:00Z'))), '2026-11-14T14:00:00.000Z');
});

Deno.test('daylight saving: the send is 8 AM local on both sides of each change', () => {
  // Spring forward Sun Mar 8 2026. Sat Mar 7, 8 PM CST = Mar 8 02:00Z -> Sun 8 AM CDT = 13:00Z.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-03-08T02:00:00Z'))), '2026-03-08T13:00:00.000Z');
  // Fall back Sun Nov 1 2026. Sat Oct 31, 8 PM CDT = Nov 1 01:00Z -> Sun 8 AM CST = 14:00Z.
  assertEquals(iso(nextMorningSendAt(Date.parse('2026-11-01T01:00:00Z'))), '2026-11-01T14:00:00.000Z');
  // Fall back 2027 (Sun Nov 7): Sat Nov 6 2027, 6 PM CDT = Nov 6 23:00Z -> Sun 8 AM CST.
  assertEquals(iso(nextMorningSendAt(Date.parse('2027-11-06T23:00:00Z'))), '2027-11-07T14:00:00.000Z');
});

// The longest wait is a 2:01 AM sign-up (about 30 h), plus the extra hour on the
// night the clocks fall back, so the bound is 31 h.
Deno.test('every sign-up minute over a year lands at 8:00 AM Central, 6 to 31 hours later', () => {
  const start = Date.parse('2026-01-01T00:00:00Z');
  const end = Date.parse('2027-01-01T00:00:00Z');
  for (let t = start; t < end; t += 37 * 60_000) {
    const at = nextMorningSendAt(t);
    const p = centralParts(at);
    assertEquals([p.h, p.min], [8, 0], `sign-up ${iso(t)} -> ${iso(at)}`);
    const gapH = (at - t) / 3_600_000;
    assert(gapH >= 6 && gapH <= 31.01, `gap ${gapH} h for sign-up ${iso(t)}`);
  }
});

Deno.test('founder alert label reads like a person wrote it', () => {
  assertEquals(centralMorningLabel(Date.parse('2026-11-14T14:00:00Z')), '8 AM Central on Sat, Nov 14');
});
