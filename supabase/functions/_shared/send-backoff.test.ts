// deno test supabase/functions/_shared/send-backoff.test.ts
//
// Transient vs permanent Resend failures, the backoff schedule, the 24-hour
// window, and the due filter the drain appends to its queue query.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  BACKOFF_MAX_MS,
  backoffDelayMs,
  classifySendFailure,
  dueFilter,
  planSendFailure,
  RETRY_WINDOW_MS,
} from './send-backoff.ts';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const T0 = new Date('2026-09-16T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

Deno.test('transient: rate limit, quota, 5xx, timeout, network', () => {
  assertEquals(classifySendFailure({ status: 429, name: 'rate_limit_exceeded' }), 'transient');
  assertEquals(
    classifySendFailure({ status: 429, name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' }),
    'transient',
  );
  assertEquals(classifySendFailure({ status: 500 }), 'transient');
  assertEquals(classifySendFailure({ status: 502, message: 'Bad Gateway' }), 'transient');
  assertEquals(classifySendFailure({ status: 503 }), 'transient');
  assertEquals(classifySendFailure({ status: 408 }), 'transient');
  assertEquals(classifySendFailure({ status: null, message: 'error sending request: connection reset' }), 'transient');
  assertEquals(classifySendFailure({ message: 'thrown' }), 'transient');
});

Deno.test('a quota message on an unusual status is still transient', () => {
  assertEquals(classifySendFailure({ status: 400, message: 'Monthly quota exceeded' }), 'transient');
});

Deno.test('401 and 403 (our key or domain) retry rather than failing the list', () => {
  assertEquals(classifySendFailure({ status: 401, name: 'missing_api_key' }), 'transient');
  assertEquals(classifySendFailure({ status: 403, message: 'The edeninstitute.health domain is not verified' }), 'transient');
});

Deno.test('permanent: validation and invalid address fail immediately', () => {
  assertEquals(classifySendFailure({ status: 400, name: 'validation_error', message: 'Invalid `to` field.' }), 'permanent');
  assertEquals(classifySendFailure({ status: 422, name: 'invalid_parameter', message: 'Invalid email address' }), 'permanent');
  assertEquals(classifySendFailure({ status: 404 }), 'permanent');
  const plan = planSendFailure({ retry_count: 0 }, { status: 422, message: 'Invalid email address' }, T0);
  assertEquals(plan.action, 'give_up');
  if (plan.action === 'give_up') {
    assertEquals(plan.reason, 'permanent');
    assertEquals(plan.patch.status, 'failed');
    // Permanent failures are not an outage and do not alert the founder.
    assertEquals(plan.patch.gave_up_at, null);
    assertEquals(plan.patch.retry_count, 1);
  }
});

Deno.test('backoff doubles from 5 minutes and caps at 2 hours', () => {
  assertEquals([1, 2, 3, 4, 5, 6, 7, 50].map(backoffDelayMs), [
    5 * MIN, 10 * MIN, 20 * MIN, 40 * MIN, 80 * MIN, 2 * HOUR, 2 * HOUR, 2 * HOUR,
  ]);
  assertEquals(backoffDelayMs(0), 5 * MIN);
  assertEquals(backoffDelayMs(-3), 5 * MIN);
  assertEquals(BACKOFF_MAX_MS, 2 * HOUR);
});

Deno.test('first transient failure: pending, first_failed_at stamped, next attempt in 5 minutes', () => {
  const plan = planSendFailure({ retry_count: 0, first_failed_at: null }, { status: 429 }, T0);
  assertEquals(plan, {
    action: 'retry',
    patch: {
      status: 'pending',
      retry_count: 1,
      first_failed_at: T0.toISOString(),
      next_attempt_at: at(5 * MIN).toISOString(),
      error_message: 'transient, retrying: 429 send failed',
    },
  });
});

Deno.test('later failures keep the original first_failed_at', () => {
  const plan = planSendFailure({ retry_count: 3, first_failed_at: T0.toISOString() }, { status: 503 }, at(3 * HOUR));
  assertEquals(plan.action, 'retry');
  if (plan.action === 'retry') {
    assertEquals(plan.patch.first_failed_at, T0.toISOString());
    assertEquals(plan.patch.retry_count, 4);
    assertEquals(plan.patch.next_attempt_at, at(3 * HOUR + 40 * MIN).toISOString());
  }
});

Deno.test('the last retry is pulled in to land on the 24-hour mark', () => {
  const plan = planSendFailure({ retry_count: 14, first_failed_at: T0.toISOString() }, { status: 429 }, at(23 * HOUR));
  assertEquals(plan.action, 'retry');
  if (plan.action === 'retry') assertEquals(plan.patch.next_attempt_at, at(RETRY_WINDOW_MS).toISOString());
});

Deno.test('a transient failure at or after 24 hours gives up', () => {
  const plan = planSendFailure({ retry_count: 15, first_failed_at: T0.toISOString() }, { status: 429 }, at(RETRY_WINDOW_MS));
  assertEquals(plan.action, 'give_up');
  if (plan.action === 'give_up') {
    assertEquals(plan.reason, 'window_expired');
    assertEquals(plan.patch.next_attempt_at, null);
    assertEquals(plan.patch.gave_up_at, at(RETRY_WINDOW_MS).toISOString());
    assert(plan.patch.error_message.startsWith('gave up after 24h'));
  }
});

Deno.test('a whole outage: retries keep coming for 24 hours, then one give-up', () => {
  let row: { retry_count: number; first_failed_at: string | null } = { retry_count: 0, first_failed_at: null };
  let now = T0;
  let retries = 0;
  let gaveUp = false;
  for (let i = 0; i < 100; i++) {
    const plan = planSendFailure(row, { status: 429, name: 'daily_quota_exceeded' }, now);
    if (plan.action === 'give_up') {
      assertEquals(plan.reason, 'window_expired');
      assertEquals(now.getTime() - T0.getTime(), RETRY_WINDOW_MS);
      gaveUp = true;
      break;
    }
    retries++;
    const next = Date.parse(plan.patch.next_attempt_at);
    assert(next > now.getTime(), 'next attempt must be in the future');
    row = { retry_count: plan.patch.retry_count, first_failed_at: plan.patch.first_failed_at };
    now = new Date(next);
  }
  assert(gaveUp);
  // 5+10+20+40+80 min = 2h35m, then 2h steps, the last pulled in to 24h: 5 + 11 = 16 retries.
  assertEquals(retries, 16);
});

Deno.test('legacy rows (retry_count set, no first_failed_at) start their window now', () => {
  const plan = planSendFailure({ retry_count: 2 }, { status: 500 }, T0);
  assertEquals(plan.action, 'retry');
  if (plan.action === 'retry') {
    assertEquals(plan.patch.first_failed_at, T0.toISOString());
    assertEquals(plan.patch.next_attempt_at, at(20 * MIN).toISOString());
  }
});

Deno.test('a future first_failed_at cannot stretch the window', () => {
  const plan = planSendFailure({ retry_count: 1, first_failed_at: at(48 * HOUR).toISOString() }, { status: 429 }, T0);
  if (plan.action !== 'retry') throw new Error('expected retry');
  assertEquals(plan.patch.first_failed_at, T0.toISOString());
});

Deno.test('due filter keeps never-failed rows and rows whose wait is over', () => {
  assertEquals(
    dueFilter('2026-09-16T12:00:00.000Z'),
    'or=(next_attempt_at.is.null,next_attempt_at.lte.2026-09-16T12%3A00%3A00.000Z)',
  );
});
