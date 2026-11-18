// deno test supabase/functions/_shared/send-before-failure.test.ts
//
// Area 6 NEW-1 (2026-11-18; Camila's tap "Yes, build + ship"): a drip row that fails BEFORE its send (an opt-out
// or ownership check could not run) backs off and gives up like any failure, but keeps its retry_count, which is
// part of its Idempotency-Key. Otherwise: Resend accepts, "mark sent" is lost, the next run's check hits one
// gateway error, the count goes up, the key changes, and the family gets the email twice.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { planSendFailure, RETRY_WINDOW_MS } from './send-backoff.ts';
import { dripIdempotencyKey } from './drip-idempotency.ts';

const T0 = new Date('2026-11-18T12:00:00.000Z');

Deno.test('a failed pre-send check keeps the count (and so the key), but still backs off', () => {
  const row = { retry_count: 0, first_failed_at: null };
  const plan = planSendFailure(row, { status: null, message: 'opt-out check (homeschool): could not check (504 ...)', beforeSend: true }, T0);
  assertEquals(plan.action, 'retry');
  assertEquals(plan.patch.retry_count, 0);
  assert(plan.patch.next_attempt_at && Date.parse(plan.patch.next_attempt_at) > T0.getTime(), 'it waits before trying again');
  assertEquals(plan.patch.first_failed_at, T0.toISOString(), 'the 24-hour window starts');
  assertEquals(dripIdempotencyKey('magnet_email_queue', 'r1', plan.patch.retry_count), dripIdempotencyKey('magnet_email_queue', 'r1', row.retry_count));
});

Deno.test('a failed send still moves to a new key, exactly as before', () => {
  const plan = planSendFailure({ retry_count: 0, first_failed_at: null }, { status: 429, name: 'daily_quota_exceeded', message: 'quota' }, T0);
  assertEquals(plan.patch.retry_count, 1);
  const thrown = planSendFailure({ retry_count: 2, first_failed_at: null }, { status: null, message: 'network' }, T0);
  assertEquals(thrown.patch.retry_count, 3, 'a throw during the send (beforeSend absent) counts as before');
});

Deno.test('a pre-send failure still gives up after 24 hours (the founder alert path), count unchanged', () => {
  const first = new Date(T0.getTime() - RETRY_WINDOW_MS - 1000).toISOString();
  const plan = planSendFailure({ retry_count: 1, first_failed_at: first }, { status: null, message: 'could not check', beforeSend: true }, T0);
  assertEquals(plan.action, 'give_up');
  if (plan.action !== 'give_up') return;
  assertEquals(plan.patch.status, 'failed');
  assertEquals(plan.patch.retry_count, 1);
  assert(plan.patch.gave_up_at, 'gave_up_at is set, so the hourly founder alert sees it');
});

Deno.test('repeated pre-send failures keep the first short wait (each drain run tries again) until the 24 h window ends', () => {
  const first = planSendFailure({ retry_count: 0, first_failed_at: null }, { status: null, message: 'x', beforeSend: true }, T0);
  const later = new Date(T0.getTime() + 60 * 60 * 1000);
  const again = planSendFailure({ retry_count: 0, first_failed_at: T0.toISOString() }, { status: null, message: 'x', beforeSend: true }, later);
  const wait = (p: typeof first, now: Date) => Date.parse(p.patch.next_attempt_at as string) - now.getTime();
  assertEquals(wait(again, later), wait(first, T0));
  assertEquals(again.patch.first_failed_at, T0.toISOString(), 'the window keeps its original start');
});
