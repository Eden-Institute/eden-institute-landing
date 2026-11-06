// deno test supabase/functions/_shared/recap-window.test.ts
//
// The evening recap window starts at the previous scheduled recap (01:00 UTC), so no
// evening hour falls between two recaps (the 2026-11-04 ESA orders did).

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { recapWindowStart } from './recap-window.ts';

const iso = (s: string) => recapWindowStart(new Date(s)).toISOString();

Deno.test('the 01:00 UTC run covers since yesterday 01:00 UTC', () => {
  assertEquals(iso('2026-11-07T01:00:05Z'), '2026-11-06T01:00:00.000Z');
});

Deno.test('the 01:37 retry pass anchors on the same slot as the 01:00 run', () => {
  assertEquals(iso('2026-11-07T01:37:00Z'), '2026-11-06T01:00:00.000Z');
});

Deno.test('a late takeover inside the slot still anchors on the previous evening', () => {
  assertEquals(iso('2026-11-07T03:59:00Z'), '2026-11-06T01:00:00.000Z');
});

Deno.test('a manual run later in the day covers since last night\'s recap', () => {
  // 15:00 UTC = 9 AM CST: last night's recap was 01:00 UTC today.
  assertEquals(iso('2026-11-07T15:00:00Z'), '2026-11-07T01:00:00.000Z');
});

Deno.test('consecutive scheduled recaps meet exactly: no gap, no overlap', () => {
  const first = new Date('2026-11-06T01:00:04Z');
  const second = new Date('2026-11-07T01:00:04Z');
  assertEquals(recapWindowStart(second).getTime() - recapWindowStart(first).getTime(), 24 * 60 * 60 * 1000);
});

Deno.test('the 2026-11-04 8:24 PM CT orders fall inside the 11/5 recap window', () => {
  const start = recapWindowStart(new Date('2026-11-06T01:00:06Z')); // the 11/5 evening recap
  const ordered = new Date('2026-11-05T02:24:22Z'); // ET-1043, 8:24 PM CST on 11/4
  assertEquals(start.getTime() <= ordered.getTime(), true);
});

Deno.test('month and year boundaries', () => {
  assertEquals(iso('2026-12-01T01:00:05Z'), '2026-11-30T01:00:00.000Z');
  assertEquals(iso('2027-01-01T01:00:05Z'), '2026-12-31T01:00:00.000Z');
});

Deno.test('daylight saving does not move the anchor (cron is fixed in UTC)', () => {
  // US DST began 2027-03-14; the 01:00 UTC slot is 7 PM CST before and 8 PM CDT after.
  assertEquals(iso('2027-03-15T01:00:05Z'), '2027-03-14T01:00:00.000Z');
});
