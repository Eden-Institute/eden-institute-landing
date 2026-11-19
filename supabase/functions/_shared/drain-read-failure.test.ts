// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/drain-read-failure.test.ts
//
// Area 6 NEW-3: a drain that cannot read its queue is reported, not counted as "nothing due".

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DRAIN_TABLES, readFailureAlert, readFailureAlertKey, readFailures } from './drain-read-failure.ts';

Deno.test('readFailures lists only the drains that said read_failed, in a stable order', () => {
  assertEquals(readFailures({
    magnet: { read_failed: true },
    queue: { read_failed: false },
    buyer: {},
    followup: undefined,
    founding_family: { read_failed: true },
  }), ['founding_family', 'magnet']);
  assertEquals(readFailures({ magnet: {}, queue: {} }), []);
});

Deno.test('every drain nurture-emails runs has a probe table', () => {
  for (const k of ['buyer', 'founding_family', 'queue', 'followup', 'magnet', 'launch', 'legacy_email5']) {
    assert(DRAIN_TABLES[k], k);
  }
});

Deno.test('one alert per UTC clock hour: same key inside the hour, new key the next hour', () => {
  assertEquals(readFailureAlertKey(new Date('2026-11-19T16:00:01Z')), 'nurture-read-failed-2026-11-19T16');
  assertEquals(readFailureAlertKey(new Date('2026-11-19T16:59:59Z')), 'nurture-read-failed-2026-11-19T16');
  assertEquals(readFailureAlertKey(new Date('2026-11-19T17:00:00Z')), 'nurture-read-failed-2026-11-19T17');
});

Deno.test('alert text: plain names, says nothing is lost, no em dash', () => {
  const a = readFailureAlert(['magnet', 'queue', 'buyer'], new Date('2026-11-19T16:20:00Z'));
  assertStringIncludes(a.text, 'free-week emails, quiz emails and buyer notes after a purchase');
  assertStringIncludes(a.text, 'No email has been lost');
  assertStringIncludes(a.text, 'at most one of these an hour');
  assert(!a.text.includes('—') && !a.subject.includes('—'), 'no em dash');
  assertEquals(a.idempotencyKey, 'nurture-read-failed-2026-11-19T16');
  assertStringIncludes(readFailureAlert(['magnet'], new Date()).text, 'failed too: free-week emails.');
});
