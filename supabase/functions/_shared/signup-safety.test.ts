// Tests for _shared/signup-safety.ts (2026-11-12, Lane 2 area 5 F1 / F4 / F6).
import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  insertOrFetchWithRetry,
  isRetryableWelcomeStatus,
  rowsOrThrow,
  sendWelcomeWithRetry,
} from './signup-safety.ts';

type Call = { url: string; init?: RequestInit };

function scripted(replies: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    const next = replies.shift();
    if (!next) return Promise.reject(new Error('no scripted reply left'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { calls, fetchImpl };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const noSleep = () => Promise.resolve();
const PAYLOAD = { from: 'a@b.c', to: ['x@y.z'], subject: 's', html: '<p>h</p>' };

// ── F1: welcome send ──

Deno.test('welcome: accepted on the first try is one POST and reports the Resend id', async () => {
  const { calls, fetchImpl } = scripted([json(200, { id: 'em_1' })]);
  const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/abc', fetchImpl, sleep: noSleep });
  assertEquals(r, { ok: true, status: 200, id: 'em_1', attempts: 1 });
  assertEquals(calls.length, 1);
  const h = new Headers(calls[0].init?.headers);
  assertEquals(h.get('Idempotency-Key'), 'welcome/abc');
  assertEquals(h.get('Authorization'), 'Bearer k');
});

Deno.test('welcome: a 429 is tried once more with the SAME idempotency key, then accepted', async () => {
  const { calls, fetchImpl } = scripted([json(429, { name: 'rate_limit_exceeded' }), json(200, { id: 'em_2' })]);
  const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/same', fetchImpl, sleep: noSleep });
  assertEquals(r.ok, true);
  assertEquals(r.attempts, 2);
  assertEquals(calls.length, 2);
  assertEquals(new Headers(calls[0].init?.headers).get('Idempotency-Key'), 'welcome/same');
  assertEquals(new Headers(calls[1].init?.headers).get('Idempotency-Key'), 'welcome/same');
  assertEquals(calls[0].init?.body, calls[1].init?.body);
});

Deno.test('welcome: a refusal (422/403) is NOT counted as sent and is not retried', async () => {
  for (const status of [403, 422]) {
    const { calls, fetchImpl } = scripted([json(status, { name: 'validation_error', message: 'bad' })]);
    const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/r', fetchImpl, sleep: noSleep });
    assertEquals(r.ok, false);
    assertEquals(r.status, status);
    assertEquals(r.attempts, 1);
    assert(r.error?.includes('validation_error'));
    assertEquals(calls.length, 1);
  }
});

Deno.test('welcome: two 5xx in a row report the failure after 2 tries', async () => {
  const { calls, fetchImpl } = scripted([json(502, {}), new Response('<html>Bad gateway</html>', { status: 503 })]);
  const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/5', fetchImpl, sleep: noSleep });
  assertEquals(r.ok, false);
  assertEquals(r.status, 503);
  assertEquals(r.attempts, 2);
  assert(r.error?.includes('Bad gateway'));
  assertEquals(calls.length, 2);
});

Deno.test('welcome: a network error then a non-JSON 502 page never throws', async () => {
  const { fetchImpl } = scripted([new TypeError('connection reset'), new Response('<html>502</html>', { status: 502 })]);
  const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/n', fetchImpl, sleep: noSleep });
  assertEquals(r.ok, false);
  assertEquals(r.status, 502);
  assertEquals(r.attempts, 2);
});

Deno.test('welcome: a lost first reply then 409 on the retry counts as accepted (Resend holds the key)', async () => {
  const { fetchImpl } = scripted([new TypeError('timed out'), json(409, { name: 'concurrent_idempotent_requests' })]);
  const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/t', fetchImpl, sleep: noSleep });
  assertEquals(r.ok, true);
  assertEquals(r.status, 409);
  assertEquals(r.attempts, 2);
});

Deno.test('welcome: a 409 on the FIRST try is a refusal (fresh key, nothing to match)', async () => {
  const { calls, fetchImpl } = scripted([json(409, { name: 'invalid_idempotent_request' })]);
  const r = await sendWelcomeWithRetry(PAYLOAD, { apiKey: 'k', idempotencyKey: 'welcome/f', fetchImpl, sleep: noSleep });
  assertEquals(r.ok, false);
  assertEquals(calls.length, 1);
});

Deno.test('welcome: which statuses get a second try', () => {
  assertEquals([null, 429, 500, 502, 503, 504].map(isRetryableWelcomeStatus), [true, true, true, true, true, true]);
  assertEquals([400, 401, 403, 404, 409, 422].map(isRetryableWelcomeStatus), [false, false, false, false, false, false]);
});

// ── F4: sign-up row ──

const ROW = [{ id: 'w1', resend_contact_id: 'rc1' }];

Deno.test('signup row: inserted on the first try', async () => {
  let inserts = 0, lookups = 0;
  const r = await insertOrFetchWithRetry(
    () => { inserts++; return Promise.resolve(json(201, ROW)); },
    () => { lookups++; return Promise.resolve(json(200, [])); },
    { sleep: noSleep, log: () => {} },
  );
  assertEquals(r, { id: 'w1', resend_contact_id: 'rc1' });
  assertEquals([inserts, lookups], [1, 0]);
});

Deno.test('signup row: an existing sign-up (409) is looked up', async () => {
  let lookups = 0;
  const r = await insertOrFetchWithRetry(
    () => Promise.resolve(json(409, { code: '23505' })),
    () => { lookups++; return Promise.resolve(json(200, [{ id: 'w2', resend_contact_id: null }])); },
    { sleep: noSleep, log: () => {} },
  );
  assertEquals(r, { id: 'w2', resend_contact_id: null });
  assertEquals(lookups, 1);
});

Deno.test('signup row: a gateway 504 is retried; a repeat that finds the committed row (409) returns it', async () => {
  const replies = [json(504, { message: 'Gateway Timeout' }), json(409, { code: '23505' })];
  let inserts = 0;
  const r = await insertOrFetchWithRetry(
    () => { inserts++; return Promise.resolve(replies.shift()!); },
    () => Promise.resolve(json(200, ROW)),
    { sleep: noSleep, log: () => {} },
  );
  assertEquals(r?.id, 'w1');
  assertEquals(inserts, 2);
});

Deno.test('signup row: a network error is retried, then inserted', async () => {
  let inserts = 0;
  const r = await insertOrFetchWithRetry(
    () => { inserts++; return inserts === 1 ? Promise.reject(new TypeError('reset')) : Promise.resolve(json(201, ROW)); },
    () => Promise.resolve(json(200, [])),
    { sleep: noSleep, log: () => {} },
  );
  assertEquals(r?.id, 'w1');
  assertEquals(inserts, 2);
});

Deno.test('signup row: two 504s give null (the caller alerts the founder); a 400 is not retried', async () => {
  let inserts = 0;
  const logs: string[] = [];
  const r = await insertOrFetchWithRetry(
    () => { inserts++; return Promise.resolve(json(504, {})); },
    () => Promise.resolve(json(200, [])),
    { sleep: noSleep, log: (m) => logs.push(m) },
  );
  assertEquals(r, null);
  assertEquals(inserts, 2);
  assertEquals(logs.length, 2);

  let inserts400 = 0;
  const r400 = await insertOrFetchWithRetry(
    () => { inserts400++; return Promise.resolve(json(400, { message: 'bad column' })); },
    () => Promise.resolve(json(200, [])),
    { sleep: noSleep, log: () => {} },
  );
  assertEquals(r400, null);
  assertEquals(inserts400, 1);
});

Deno.test('signup row: a 409 whose lookup 504s is retried as a whole', async () => {
  const lookups = [json(504, {}), json(200, ROW)];
  let inserts = 0;
  const r = await insertOrFetchWithRetry(
    () => { inserts++; return Promise.resolve(json(409, {})); },
    () => Promise.resolve(lookups.shift()!),
    { sleep: noSleep, log: () => {} },
  );
  assertEquals(r?.id, 'w1');
  assertEquals(inserts, 2);
});

// ── F6: fail-closed checks ──

Deno.test('rowsOrThrow: a list passes through; an error object throws instead of reading as "no"', () => {
  assertEquals(rowsOrThrow([], 'opt-out check'), []);
  assertEquals(rowsOrThrow([{ email: 'a' }], 'opt-out check').length, 1);
  assertThrows(() => rowsOrThrow({ message: 'JWT expired', code: 'PGRST301' }, 'opt-out check (homeschool)'), Error, 'opt-out check (homeschool): could not check');
  assertThrows(() => rowsOrThrow(null, 'owner check'), Error, 'could not check');
});
