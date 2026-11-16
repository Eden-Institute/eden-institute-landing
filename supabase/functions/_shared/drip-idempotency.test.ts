// Tests for _shared/drip-idempotency.ts (2026-11-16, Lane 2 area 6 N1: one Resend
// Idempotency-Key per drip attempt so a lost "mark sent" cannot send twice).
import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { dripIdempotencyKey, IDEMPOTENCY_KEY_MAX, readIdempotencyConflict } from './drip-idempotency.ts';

const ID = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';

Deno.test('key names the function, the queue table, the row and the retry count', () => {
  assertEquals(dripIdempotencyKey('magnet_email_queue', ID, 0), `nurture-emails/magnet_email_queue/${ID}/0`);
  assertEquals(dripIdempotencyKey('founding_family_queue', ID, 3), `nurture-emails/founding_family_queue/${ID}/3`);
});

Deno.test('a row that never failed (null or missing retry_count) gets attempt 0', () => {
  assertEquals(dripIdempotencyKey('buyer_email_queue', ID, null), `nurture-emails/buyer_email_queue/${ID}/0`);
  assertEquals(dripIdempotencyKey('buyer_email_queue', ID, undefined), `nurture-emails/buyer_email_queue/${ID}/0`);
  assertEquals(dripIdempotencyKey('buyer_email_queue', ID, -2), `nurture-emails/buyer_email_queue/${ID}/0`);
  assertEquals(dripIdempotencyKey('buyer_email_queue', ID, Number.NaN), `nurture-emails/buyer_email_queue/${ID}/0`);
});

Deno.test('the same row with no recorded failure reuses the same key (a lost mark-sent or an overlapping run is refused by Resend)', () => {
  const first = dripIdempotencyKey('nurture_email_queue', ID, 1);
  const repeat = dripIdempotencyKey('nurture_email_queue', ID, 1);
  assertEquals(first, repeat);
});

Deno.test('a recorded failure (retry_count up by one) gets a fresh key, so a stored failure can never be replayed', () => {
  const before = dripIdempotencyKey('launch_email_queue', ID, 2);
  const after = dripIdempotencyKey('launch_email_queue', ID, 3);
  assertEquals(before === after, false);
});

Deno.test('different tables never share a key for the same id', () => {
  assertEquals(
    dripIdempotencyKey('magnet_email_queue', ID, 0) === dripIdempotencyKey('followup_email_queue', ID, 0),
    false,
  );
});

Deno.test('keys stay inside Resend\'s 256-character limit and refuse a missing table or id', () => {
  assertEquals(dripIdempotencyKey('founding_family_queue', ID, 999).length <= IDEMPOTENCY_KEY_MAX, true);
  assertThrows(() => dripIdempotencyKey('', ID, 0));
  assertThrows(() => dripIdempotencyKey('magnet_email_queue', '', 0));
  assertThrows(() => dripIdempotencyKey('x'.repeat(300), ID, 0));
});

Deno.test('409 invalid_idempotent_request = already sent; 409 concurrent_idempotent_requests = in flight', () => {
  assertEquals(readIdempotencyConflict(409, 'invalid_idempotent_request'), 'already_sent');
  assertEquals(readIdempotencyConflict(409, 'concurrent_idempotent_requests'), 'in_flight');
});

Deno.test('any other answer is not an idempotency outcome and is handled as a normal failure', () => {
  assertEquals(readIdempotencyConflict(409, 'something_else'), null);
  assertEquals(readIdempotencyConflict(409, undefined), null);
  assertEquals(readIdempotencyConflict(429, 'concurrent_idempotent_requests'), null);
  assertEquals(readIdempotencyConflict(400, 'invalid_idempotency_key'), null);
  assertEquals(readIdempotencyConflict(500, null), null);
  assertEquals(readIdempotencyConflict(null, 'invalid_idempotent_request'), null);
});
