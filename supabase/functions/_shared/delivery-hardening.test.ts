// Delivery hardening, 2026-11-10 (Lane 2 deep audit area 2, D1 D2 D3 D5; founder go
// "Yes, build + ship all 5"). Stubs fetch and the database: nothing reaches Supabase,
// Storage or Resend.
//   deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/delivery-hardening.test.ts
import { assert, assertEquals, assertFalse, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-test-key');
Deno.env.set('RESEND_API_KEY', 're_test');
Deno.env.set('FOUNDER_EMAIL', 'founder@example.com');

const sf = await import('./starter-fulfillment.ts');
const rs = await import('./resend-idempotency.ts');
const bs = await import('./book-shop.ts');

// ---------------------------------------------------------------- fakes
type Op = { table: string; op: string; payload?: Record<string, unknown>; filters: string[] };

/** A chainable stand-in for the supabase client, enough for fulfilStarterDelivery. */
function fakeDb(opts: { refusals?: number } = {}) {
  const ops: Op[] = [];
  const db = {
    from(table: string) {
      const rec: Op = { table, op: 'select', filters: [] };
      // deno-lint-ignore no-explicit-any
      const b: any = {
        update(p: Record<string, unknown>) { rec.op = 'update'; rec.payload = p; return b; },
        insert(p: Record<string, unknown>) { rec.op = 'insert'; rec.payload = p; ops.push(rec); return Promise.resolve({ data: null, error: null }); },
        select(_cols?: string, o?: { head?: boolean }) { if (rec.op === 'select' && o?.head) rec.op = 'count'; return b; },
        eq(k: string, v: unknown) { rec.filters.push(`${k}=${v}`); return b; },
        or(s: string) { rec.filters.push(`or:${s}`); return b; },
        maybeSingle() { return b; },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          ops.push(rec);
          let result: unknown = { data: null, error: null };
          // The claim: update ... .or(...).select('id') on starter_deliveries.
          if (rec.op === 'update' && table === 'starter_deliveries' && rec.filters.some((f) => f.startsWith('or:'))) {
            result = { data: [{ id: 'del-1' }], error: null };
          } else if (rec.op === 'count') {
            result = { count: opts.refusals ?? 0, error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return b;
    },
    rpc() { return Promise.resolve({ data: null, error: null }); },
  };
  return { db, ops };
}

type Call = { url: string; headers: Record<string, string>; body: string };

/** Routes Storage signing and Resend; `delivery` answers the buyer's delivery send. */
function stubFetch(delivery: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries());
    const body = String(init?.body ?? '');
    calls.push({ url, headers, body });
    if (url.includes('/storage/v1/object/sign/')) {
      return new Response(JSON.stringify({ signedURL: '/object/sign/starter-unit/x.pdf?token=t' }), { status: 200 });
    }
    if (url === 'https://api.resend.com/emails') {
      if (body.includes('NOT delivered after')) return new Response(JSON.stringify({ id: 'alert-1' }), { status: 200 });
      return await delivery();
    }
    return new Response('not stubbed', { status: 404 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/** A row whose three files are already stamped, so the run goes straight to the email. */
function row(over: Record<string, unknown> = {}) {
  return {
    id: 'del-1', stripe_checkout_session_id: 'cs_test_secret_session', order_id: null,
    email: 'buyer@example.com', purchaser_name: 'Pat Buyer', status: 'pending', attempts: 0, sent_at: null,
    tg_object_path: 'personalised/del-1/teachers-guide.pdf',
    nb_object_path: 'personalised/del-1/student-notebook.pdf',
    ra_object_path: 'personalised/del-1/read-aloud.pdf',
    download_token: 'a'.repeat(64), band: 'sprouts', ...over,
  };
}

const deliverySends = (calls: Call[]) => calls.filter((c) => c.url === 'https://api.resend.com/emails' && !c.body.includes('NOT delivered after'));
const founderAlerts = (calls: Call[]) => calls.filter((c) => c.url === 'https://api.resend.com/emails' && c.body.includes('NOT delivered after'));
const emailRefusalsLogged = (ops: Op[]) => ops.filter((o) => o.table === 'starter_delivery_attempts' && o.op === 'insert' && o.payload?.stage === 'email' && o.payload?.ok === false);
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });

// ---------------------------------------------------------------- resend-idempotency
Deno.test('D2 key: kind/row/generation, generation clamped to a whole number >= 0, never over 256 chars', () => {
  assertEquals(rs.deliveryIdempotencyKey('starter-delivery', 'abc', 0), 'starter-delivery/abc/0');
  assertEquals(rs.deliveryIdempotencyKey('book-delivery', 'abc', 3), 'book-delivery/abc/3');
  assertEquals(rs.deliveryIdempotencyKey('book-delivery', 'abc', -2), 'book-delivery/abc/0');
  assertEquals(rs.deliveryIdempotencyKey('book-delivery', 'abc', Number.NaN), 'book-delivery/abc/0');
  assertEquals(rs.deliveryIdempotencyKey('book-delivery', 'abc', 2.7), 'book-delivery/abc/2');
  assert(rs.deliveryIdempotencyKey('starter-delivery', 'x'.repeat(400), 1).length <= 256);
});

Deno.test('D2 classify: 2xx sent; the two Resend 409s by name; everything else refused', () => {
  assertEquals(rs.classifyResendResponse(200, '{"id":"e1"}'), 'sent');
  assertEquals(rs.classifyResendResponse(409, '{"statusCode":409,"name":"invalid_idempotent_request","message":"x"}'), 'already_sent');
  assertEquals(rs.classifyResendResponse(409, '{"statusCode":409,"name":"concurrent_idempotent_requests","message":"x"}'), 'in_flight');
  assertEquals(rs.classifyResendResponse(409, 'invalid_idempotent_request (not json)'), 'already_sent');
  assertEquals(rs.classifyResendResponse(409, '{"name":"something_else"}'), 'refused');
  assertEquals(rs.classifyResendResponse(500, '{"name":"invalid_idempotent_request"}'), 'refused', 'only a 409 can mean already sent');
  assertEquals(rs.classifyResendResponse(429, ''), 'refused');
});

// ---------------------------------------------------------------- D2 Starter
Deno.test('D2 Starter: the delivery email carries Idempotency-Key starter-delivery/<row id>/0 and the row is marked sent', async () => {
  const s = stubFetch(() => ok({ id: 'em-1' }));
  const { db, ops } = fakeDb();
  try {
    const r = await sf.fulfilStarterDelivery(db, row(), null);
    assertEquals(r.status, 'sent');
    const sends = deliverySends(s.calls);
    assertEquals(sends.length, 1);
    assertEquals(sends[0].headers['idempotency-key'], 'starter-delivery/del-1/0');
    assert(ops.some((o) => o.table === 'starter_deliveries' && o.op === 'update' && o.payload?.status === 'sent'));
  } finally { s.restore(); }
});

Deno.test('D2 Starter: each logged refusal moves the key on, so a failure Resend may keep is never replayed', async () => {
  const s = stubFetch(() => ok({ id: 'em-1' }));
  const { db } = fakeDb({ refusals: 2 });
  try {
    await sf.fulfilStarterDelivery(db, row({ attempts: 2 }), null);
    assertEquals(deliverySends(s.calls)[0].headers['idempotency-key'], 'starter-delivery/del-1/2');
  } finally { s.restore(); }
});

Deno.test('D2 Starter: 409 invalid_idempotent_request means the buyer already has it: marked sent, not failed', async () => {
  const s = stubFetch(() => new Response('{"statusCode":409,"name":"invalid_idempotent_request","message":"used"}', { status: 409 }));
  const { db, ops } = fakeDb();
  try {
    const r = await sf.fulfilStarterDelivery(db, row({ status: 'in_progress', attempts: 1 }), null);
    assertEquals(r.status, 'sent');
    assert(ops.some((o) => o.table === 'starter_deliveries' && o.op === 'update' && o.payload?.status === 'sent'));
    assertEquals(emailRefusalsLogged(ops).length, 0);
  } finally { s.restore(); }
});

Deno.test('D2 Starter: a definite refusal is logged (next key differs); a concurrent 409 and a network error are not (same key)', async () => {
  for (const [label, answer, logged] of [
    ['500', () => new Response('{"name":"application_error"}', { status: 500 }), 1],
    ['concurrent 409', () => new Response('{"name":"concurrent_idempotent_requests"}', { status: 409 }), 0],
    ['network error', () => { throw new TypeError('connection reset'); }, 0],
  ] as const) {
    const s = stubFetch(answer as () => Response);
    const { db, ops } = fakeDb();
    try {
      const r = await sf.fulfilStarterDelivery(db, row(), null);
      assertEquals(r.status, 'failed', label);
      assertEquals(emailRefusalsLogged(ops).length, logged, label);
      assert(ops.some((o) => o.table === 'starter_deliveries' && o.op === 'update' && o.payload?.status === 'failed'), label);
    } finally { s.restore(); }
  }
});

// ---------------------------------------------------------------- D1
Deno.test('D1: the try that uses up the retries emails the founder at once; earlier tries do not', async () => {
  const refuse = () => new Response('{"name":"application_error"}', { status: 500 });
  let s = stubFetch(refuse);
  try {
    const r = await sf.fulfilStarterDelivery(fakeDb().db, row({ attempts: sf.STARTER_MAX_ATTEMPTS - 2 }), null);
    assertEquals(r.status, 'failed');
    assertEquals(founderAlerts(s.calls).length, 0, 'try 4 of 5: no alert');
  } finally { s.restore(); }

  s = stubFetch(refuse);
  try {
    await sf.fulfilStarterDelivery(fakeDb().db, row({ attempts: sf.STARTER_MAX_ATTEMPTS - 1 }), null);
    const alerts = founderAlerts(s.calls);
    assertEquals(alerts.length, 1, 'try 5 of 5: one alert');
    const sent = JSON.parse(alerts[0].body);
    assertEquals(sent.to, 'founder@example.com');
    assertStringIncludes(sent.subject, `NOT delivered after ${sf.STARTER_MAX_ATTEMPTS} tries (sprouts)`);
    assertStringIncludes(sent.text, 'buyer@example.com');
    assertStringIncludes(sent.text, 'del-1');
    assertFalse(sent.text.includes('cs_test_secret_session'), 'the session key is a credential for ESA rows: never emailed');
  } finally { s.restore(); }
});

Deno.test('D1 alert wording: plain, no em dashes, says nothing retries, names the dead-worker case', () => {
  const a = sf.starterExhaustedAlert({ deliveryId: 'd1', email: 'b@example.com', band: 'seedlings', attempts: 5, lastError: 'boom' });
  assertStringIncludes(a.subject, 'NOT delivered after 5 tries (seedlings)');
  assertStringIncludes(a.text, 'boom');
  assertStringIncludes(a.text, 'Nothing retries on its own');
  const dead = sf.starterExhaustedAlert({ deliveryId: 'd1', email: 'b@example.com', band: 'sprouts', attempts: 5, lastError: '', workerDied: true });
  assertStringIncludes(dead.text, 'stopped partway through its last try');
  for (const t of [a.subject, a.text, dead.text]) assertFalse(t.includes('—'), 'no em dash');
});

// ---------------------------------------------------------------- D3
Deno.test('D3: the live masters (2026-11-10) pass, one band at a time', () => {
  for (const set of [[13713600, 12382407, 2779988], [11474118, 12656076, 3932314]]) {
    let total = 0;
    for (const bytes of set) {
      assertEquals(sf.masterSizeProblem('m.pdf', bytes, total), null, `${bytes}`);
      total += bytes;
    }
  }
});

Deno.test('D3: the raw 9/1 Canva exports are refused by name, per file and per delivery', () => {
  const mbytes = (m: number) => Math.round(m * 1048576);
  assertStringIncludes(sf.masterSizeProblem('tg.pdf', mbytes(41.67), 0) ?? '', 'tg.pdf is 41.67 MB, over the 18.00 MB per-file limit');
  assertStringIncludes(sf.masterSizeProblem('ra.pdf', mbytes(21.58), 0) ?? '', 'per-file limit');
  assertStringIncludes(sf.masterSizeProblem('nb.pdf', mbytes(17), mbytes(20)) ?? '', 'limit for one delivery');
  assert(sf.STARTER_MASTERS_TOTAL_MAX_BYTES >= 2 * sf.STARTER_MASTER_MAX_BYTES - 1);
});

Deno.test('D3: the guard runs on the declared length and on the real bytes, before anything is stamped', async () => {
  const src = await Deno.readTextFile(new URL('./starter-fulfillment.ts', import.meta.url));
  assert(src.includes('storageDownload(STARTER_SOURCE_BUCKET, f.master, STARTER_MASTER_MAX_BYTES)'));
  const guard = src.indexOf('masterSizeProblem(f.master, data.length, bytes)');
  const stamp = src.indexOf('await stampFooter(');
  assert(guard > 0 && stamp > guard, 'size check precedes stamping');
});

// ---------------------------------------------------------------- D1 drain
Deno.test('D1 drain: a worker that died on its LAST try is closed and reported once, on the drain only', async () => {
  const src = await Deno.readTextFile(new URL('../starter-fulfill/index.ts', import.meta.url));
  assert(src.includes('const MAX_ATTEMPTS = STARTER_MAX_ATTEMPTS;'));
  assert(src.includes('const closedDead = sessionId ? 0 : await closeDeadFinalAttempts(staleBefore);'));
  const fn = src.slice(src.indexOf('async function closeDeadFinalAttempts'), src.indexOf('serve('));
  for (const needle of [".eq('status', 'in_progress')", ".lt('updated_at', staleBefore)", ".gte('attempts', MAX_ATTEMPTS)", ".is('sent_at', null)", 'workerDied: true']) {
    assert(fn.includes(needle), needle);
  }
});

// ---------------------------------------------------------------- D2 book
const bookModel = () => ({
  firstName: 'Pat', email: 'buyer@example.com', book: bs.bookDigitalBySku('bte_paperback_digital')!,
  downloadToken: 'b'.repeat(64), receipt: null,
});

Deno.test('D2 book: the key goes on the request; a 409 invalid_idempotent_request returns null (already sent), a 500 throws', async () => {
  let s = stubFetch(() => ok({ id: 'bk-1' }));
  try {
    assertEquals(await bs.sendBookDeliveryEmail(bookModel(), 'book-delivery/r1/0'), 'bk-1');
    assertEquals(s.calls[0].headers['idempotency-key'], 'book-delivery/r1/0');
  } finally { s.restore(); }

  s = stubFetch(() => new Response('{"name":"invalid_idempotent_request"}', { status: 409 }));
  try {
    assertEquals(await bs.sendBookDeliveryEmail(bookModel(), 'book-delivery/r1/0'), null);
  } finally { s.restore(); }

  s = stubFetch(() => new Response('{"name":"application_error"}', { status: 500 }));
  try {
    await assertRejects(() => bs.sendBookDeliveryEmail(bookModel(), 'book-delivery/r1/1'), Error, 'Resend send failed: 500');
  } finally { s.restore(); }
});

Deno.test('D2 book: without a key nothing changes (no header, a 409 still throws)', async () => {
  const s = stubFetch(() => new Response('{"name":"invalid_idempotent_request"}', { status: 409 }));
  try {
    await assertRejects(() => bs.sendBookDeliveryEmail(bookModel()), Error, 'Resend send failed: 409');
    assertEquals(s.calls[0].headers['idempotency-key'], undefined);
  } finally { s.restore(); }
});

Deno.test('D2 book: stripe-webhook keys the send on the row and its failure count', async () => {
  const src = await Deno.readTextFile(new URL('../stripe-webhook/index.ts', import.meta.url));
  assert(src.includes('deliveryIdempotencyKey("book-delivery", dl.id, dl.email_attempts ?? 0)'));
});

// ---------------------------------------------------------------- D5
Deno.test('D5: every failure exit of sendGuidePdf tells the founder; none is console-only', async () => {
  const src = await Deno.readTextFile(new URL('../stripe-webhook/index.ts', import.meta.url));
  const start = src.indexOf('async function sendGuidePdf(');
  const body = src.slice(start, src.indexOf('\nserve(', start));
  assertEquals(body.match(/await guidePdfFailed\(/g)?.length, 5, 'key missing, no guide, PDF not built, Resend refused, unexpected error');
  assertFalse(/console\.(error|warn)\(/.test(body), 'no bare console-only failure left');
  const helper = src.slice(src.indexOf('async function guidePdfFailed('), start);
  assert(helper.includes('await notifyFounder('));
  assertFalse(helper.includes('—'), 'no em dash');
});
