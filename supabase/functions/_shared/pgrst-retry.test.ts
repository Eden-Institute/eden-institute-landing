// deno test supabase/functions/_shared/pgrst-retry.test.ts
//
// The retry policy for gateway 502/503/504s. No network: fetch is stubbed.

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isRepeatSafe, makeRetryingFetch } from './pgrst-retry.ts';

const URL_WITH_EMAIL =
  'https://example.supabase.co/rest/v1/email_list_unsubscribes?email=eq.someone%40example.com&limit=1';

function stub(outcomes: Array<number | Error>) {
  const calls: Array<{ method: string; body: unknown }> = [];
  const sleeps: number[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ method: init?.method ?? (input instanceof Request ? input.method : 'GET'), body: init?.body });
    const next = outcomes[Math.min(calls.length - 1, outcomes.length - 1)];
    if (next instanceof Error) return Promise.reject(next);
    const body = next === 204 ? null : next === 504 ? '{"message":"Gateway Timeout"}' : '[]';
    return Promise.resolve(new Response(body, { status: next }));
  };
  const f = makeRetryingFetch({ fetchImpl, sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); } });
  return { f, calls, sleeps };
}

async function quietly<T>(fn: () => Promise<T>): Promise<{ result: T; warnings: string[] }> {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = orig;
  }
}

Deno.test('GET that gets a 504 is retried and the success is returned', async () => {
  const { f, calls, sleeps } = stub([504, 200]);
  const { result } = await quietly(() => f(URL_WITH_EMAIL));
  assertEquals(result.status, 200);
  assertEquals(calls.length, 2);
  assertEquals(sleeps, [500]);
});

Deno.test('gives up after two retries and returns the last 504', async () => {
  const { f, calls, sleeps } = stub([504, 503, 502]);
  const { result } = await quietly(() => f(URL_WITH_EMAIL));
  assertEquals(result.status, 502);
  assertEquals(calls.length, 3);
  assertEquals(sleeps, [500, 2000]);
});

Deno.test('the mark-sent PATCH is retried with the same body', async () => {
  const { f, calls } = stub([504, 204]);
  const body = JSON.stringify({ status: 'sent' });
  const { result } = await quietly(() =>
    f('https://example.supabase.co/rest/v1/nurture_email_queue?id=eq.abc', { method: 'PATCH', body })
  );
  assertEquals(result.status, 204);
  assertEquals(calls.map((c) => [c.method, c.body]), [['PATCH', body], ['PATCH', body]]);
});

Deno.test('a plain INSERT is never repeated', async () => {
  const { f, calls } = stub([504, 201]);
  const res = await f('https://example.supabase.co/rest/v1/quiz_completions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: '{}',
  });
  assertEquals(res.status, 504);
  assertEquals(calls.length, 1);
});

Deno.test('an RPC POST is never repeated', async () => {
  const { f, calls } = stub([504, 200]);
  const res = await f('https://example.supabase.co/rest/v1/rpc/founding_gate', { method: 'POST', body: '{}' });
  assertEquals(res.status, 504);
  assertEquals(calls.length, 1);
});

Deno.test('an upsert POST (merge-duplicates) is retried', async () => {
  const { f, calls } = stub([504, 201]);
  const { result } = await quietly(() =>
    f('https://example.supabase.co/rest/v1/magnet_email_queue?on_conflict=recipient_email,band,sequence_position', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: '[]',
    })
  );
  assertEquals(result.status, 201);
  assertEquals(calls.length, 2);
});

Deno.test('other errors (400, 409, 500) are returned untouched', async () => {
  for (const status of [400, 409, 500]) {
    const { f, calls } = stub([status, 200]);
    const res = await f(URL_WITH_EMAIL);
    assertEquals(res.status, status);
    assertEquals(calls.length, 1);
  }
});

Deno.test('a network error on a GET is retried', async () => {
  const { f, calls } = stub([new TypeError('connection reset'), 200]);
  const { result } = await quietly(() => f(URL_WITH_EMAIL));
  assertEquals(result.status, 200);
  assertEquals(calls.length, 2);
});

Deno.test('a network error on a plain INSERT is thrown, not repeated', async () => {
  const { f, calls } = stub([new TypeError('connection reset'), 201]);
  await assertRejects(() => f('https://example.supabase.co/rest/v1/email_events', { method: 'POST', body: '{}' }));
  assertEquals(calls.length, 1);
});

Deno.test('an aborted request is not retried', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  const { f, calls } = stub([new DOMException('aborted', 'AbortError'), 200]);
  await assertRejects(() => f(URL_WITH_EMAIL, { signal: ctrl.signal }));
  assertEquals(calls.length, 1);
});

Deno.test('a Request object is cloned per attempt so its body survives a retry', async () => {
  const seen: string[] = [];
  let n = 0;
  const f = makeRetryingFetch({
    fetchImpl: async (input) => {
      seen.push(await (input as Request).text());
      return new Response(null, { status: n++ === 0 ? 504 : 204 });
    },
    sleep: () => Promise.resolve(),
  });
  const req = new Request('https://example.supabase.co/rest/v1/lulu_jobs?id=eq.1', { method: 'PATCH', body: '{"a":1}' });
  const { result } = await quietly(() => f(req));
  assertEquals(result.status, 204);
  assertEquals(seen, ['{"a":1}', '{"a":1}']);
});

Deno.test('retry log lines never carry the query string', async () => {
  const { f } = stub([504, 504, 200]);
  const { warnings } = await quietly(() => f(URL_WITH_EMAIL));
  assertEquals(warnings.length, 2);
  for (const w of warnings) {
    assertEquals(w.includes('example.com'), false);
    assertEquals(w.includes('?'), false);
    assertEquals(w.includes('/rest/v1/email_list_unsubscribes'), true);
  }
});

Deno.test('repeatSafe override: a read-only RPC POST is retried when the caller opts in', async () => {
  const calls: string[] = [];
  let n = 0;
  const f = makeRetryingFetch({
    fetchImpl: (_input, init) => {
      calls.push(init?.method ?? 'GET');
      return Promise.resolve(new Response('[]', { status: n++ === 0 ? 504 : 200 }));
    },
    sleep: () => Promise.resolve(),
    repeatSafe: () => true,
  });
  const { result } = await quietly(() =>
    f('https://example.supabase.co/rest/v1/rpc/lead_capture_digest_window', { method: 'POST', body: '{}' })
  );
  assertEquals(result.status, 200);
  assertEquals(calls, ['POST', 'POST']);
});

Deno.test('repeatSafe override still sends a stream body only once', async () => {
  let calls = 0;
  const f = makeRetryingFetch({
    fetchImpl: () => { calls++; return Promise.resolve(new Response('', { status: 504 })); },
    sleep: () => Promise.resolve(),
    repeatSafe: () => true,
  });
  const res = await f('https://example.supabase.co/rest/v1/rpc/x', {
    method: 'POST',
    body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{}')); c.close(); } }),
  });
  assertEquals(res.status, 504);
  assertEquals(calls, 1);
});

Deno.test('isRepeatSafe', () => {
  assertEquals(isRepeatSafe('get', null), true);
  assertEquals(isRepeatSafe('HEAD', null), true);
  assertEquals(isRepeatSafe('PATCH', 'return=minimal'), true);
  assertEquals(isRepeatSafe('DELETE', null), true);
  assertEquals(isRepeatSafe('POST', null), false);
  assertEquals(isRepeatSafe('POST', 'return=representation'), false);
  assertEquals(isRepeatSafe('POST', 'return=minimal,resolution=merge-duplicates'), true);
  assertEquals(isRepeatSafe('POST', 'resolution=ignore-duplicates'), true);
});
