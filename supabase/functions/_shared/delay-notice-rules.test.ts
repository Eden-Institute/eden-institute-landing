// Run with: deno test supabase/functions/_shared/delay-notice-rules.test.ts
//
// This is the highest-stakes pure function in the preorder system. Getting it backwards
// does not throw, does not log, and does not show up in any test of the happy path: it
// silently sends an opt-out notice where the rule demands opt-in, leaving orders standing
// that should have been cancelled and refunded. Hence the boundary cases below.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { requiresOptIn } from './delay-notice-rules.ts';

const CURRENT = '2026-12-31';

Deno.test('a slip of 30 days exactly stays opt-out (the rule says "30 days or less")', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-30', currentShipsOn: CURRENT, priorNoticeCount: 0 }),
    false,
  );
});

Deno.test('a slip of 31 days requires opt-in', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-31', currentShipsOn: CURRENT, priorNoticeCount: 0 }),
    true,
  );
});

Deno.test('a short slip is opt-out', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-07', currentShipsOn: CURRENT, priorNoticeCount: 0 }),
    false,
  );
});

Deno.test('no definite revised date always requires opt-in', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: null, currentShipsOn: CURRENT, priorNoticeCount: 0 }),
    true,
  );
});

Deno.test('a SECOND notice requires opt-in even for a one-day slip', () => {
  // 435.2(b)(2): silence can never be consent on a subsequent notice.
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-01', currentShipsOn: CURRENT, priorNoticeCount: 1 }),
    true,
  );
});

Deno.test('a third notice still requires opt-in', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-02', currentShipsOn: CURRENT, priorNoticeCount: 2 }),
    true,
  );
});

Deno.test('no current ship date to measure against resolves to opt-in', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-05', currentShipsOn: null, priorNoticeCount: 0 }),
    true,
  );
});

Deno.test('unparseable dates resolve to opt-in rather than guessing', () => {
  assertEquals(
    requiresOptIn({ revisedShipDate: 'sometime', currentShipsOn: CURRENT, priorNoticeCount: 0 }),
    true,
  );
  assertEquals(
    requiresOptIn({ revisedShipDate: '2027-01-05', currentShipsOn: 'whenever', priorNoticeCount: 0 }),
    true,
  );
});

Deno.test('a revised date EARLIER than the current one resolves to opt-in', () => {
  // Nonsensical input (that is not a delay), so refuse to treat silence as consent.
  assertEquals(
    requiresOptIn({ revisedShipDate: '2026-12-01', currentShipsOn: CURRENT, priorNoticeCount: 0 }),
    true,
  );
});

Deno.test('crossing a month boundary is counted in days, not months', () => {
  // Nov 30 -> Dec 29 is 29 days, so opt-out despite spanning two months.
  assertEquals(
    requiresOptIn({ revisedShipDate: '2026-12-29', currentShipsOn: '2026-11-30', priorNoticeCount: 0 }),
    false,
  );
  // Nov 30 -> Dec 31 is 31 days.
  assertEquals(
    requiresOptIn({ revisedShipDate: '2026-12-31', currentShipsOn: '2026-11-30', priorNoticeCount: 0 }),
    true,
  );
});
