// Lulu print-order hardening, 2026-11-11 (Lane 2 deep audit area 3, L1 L2 L3 L5 L6 L7;
// founder go "Yes, build + ship all 7"; L4 is tested in notify-founder-digest). Drives the
// real submitLuluJob / applyLuluPrintJob / releaseStaleLuluClaims against an in-memory
// database, with Lulu, Resend and the file hosts stubbed: nothing leaves this process.
//   deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/lulu-hardening.test.ts
// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertFalse, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-test-key');
Deno.env.set('RESEND_API_KEY', 're_test');
Deno.env.set('FOUNDER_EMAIL', 'founder@example.com');
Deno.env.set('LULU_CLIENT_KEY', 'k');
Deno.env.set('LULU_CLIENT_SECRET', 's');
Deno.env.set('LULU_SHIPPING_LEVEL', 'MAIL');
Deno.env.delete('LULU_SHIPPING_LEVEL_FALLBACK');
Deno.env.delete('LULU_API_BASE');
Deno.env.delete('SENTRY_DSN');

const lf = await import('./lulu-fulfillment.ts');
const pf = await import('./print-file-check.ts');

// ---------------------------------------------------------------- in-memory database
type Row = Record<string, any>;
type Op = { table: string; op: string; payload?: Row; filters: string[] };

function cmp(a: unknown, b: unknown): number {
  const da = typeof a === 'string' ? Date.parse(a) : NaN;
  const dbb = typeof b === 'string' ? Date.parse(b) : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(dbb)) return da - dbb;
  return (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;
}

/** A chainable stand-in for the supabase client, enough for the Lulu rail. */
function memDb(tables: Record<string, Row[]>, hooks: { loseClaimReply?: boolean; failOrderJobIdWrite?: boolean } = {}) {
  const ops: Op[] = [];
  let lostOnce = false;
  const db = {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const desc: string[] = [];
      let op = 'select';
      let payload: Row | null = null;
      let limitN: number | null = null;
      let single = false;
      let returning = false;
      const rows = () => (tables[table] ??= []);
      const run = () => {
        const matched = rows().filter((r) => filters.every((f) => f(r)));
        if (op === 'insert') {
          rows().push({ ...payload });
          return { data: null, error: null };
        }
        if (op === 'update') {
          if (hooks.failOrderJobIdWrite && table === 'orders' && payload && payload.lulu_print_job_id != null) {
            return { data: null, error: { message: 'simulated orders write failure' } };
          }
          for (const r of matched) Object.assign(r, payload);
          // A claim whose PATCH committed but whose reply was lost (a 504, then a repeat that matched nothing).
          if (hooks.loseClaimReply && !lostOnce && table === 'lulu_jobs' && payload?.status === 'in_progress') {
            lostOnce = true;
            return { data: null, error: null };
          }
          if (!returning) return { data: null, error: null };
          const out = matched.map((r) => ({ ...r }));
          return { data: single ? (out[0] ?? null) : out, error: null };
        }
        let out = matched.map((r) => ({ ...r }));
        if (limitN != null) out = out.slice(0, limitN);
        return { data: single ? (out[0] ?? null) : out, error: null, count: out.length };
      };
      const b: any = {
        select() { if (op !== 'select') returning = true; return b; },
        insert(p: Row) { op = 'insert'; payload = p; return b; },
        update(p: Row) { op = 'update'; payload = p; return b; },
        eq(k: string, v: unknown) { desc.push(`${k}=${v}`); filters.push((r) => String(r[k]) === String(v)); return b; },
        in(k: string, vs: unknown[]) { desc.push(`${k} in ${vs}`); filters.push((r) => vs.map(String).includes(String(r[k]))); return b; },
        lt(k: string, v: unknown) { desc.push(`${k}<${v}`); filters.push((r) => r[k] != null && cmp(r[k], v) < 0); return b; },
        gte(k: string, v: unknown) { filters.push((r) => r[k] != null && cmp(r[k], v) >= 0); return b; },
        is(k: string, v: unknown) { filters.push((r) => (r[k] ?? null) === v); return b; },
        order() { return b; },
        limit(n: number) { limitN = n; return b; },
        maybeSingle() { single = true; return b; },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          ops.push({ table, op, payload: payload ?? undefined, filters: desc });
          return Promise.resolve().then(run).then(resolve, reject);
        },
      };
      return b;
    },
  };
  return { db: db as any, ops, tables };
}

// ---------------------------------------------------------------- fixtures
const COIL = '0850X1100BWSTDCO060UC444MXX';
const A5 = '0600X0800FCPRESS080CW444MXX';
const FILE = (k: string) => `https://files.test/download?id=secret-${k}&confirm=t`;

function printables(): Row[] {
  return [
    { band: 'sprouts', book_key: 'tg', title: "Sprouts: Teacher's Guide", pod_package_id: COIL, page_count: 240, interior_url: FILE('tg'), cover_url: FILE('tgc'), printable_id: null },
    { band: 'sprouts', book_key: 'nb', title: 'Sprouts: Student Notebook', pod_package_id: COIL, page_count: 224, interior_url: FILE('nb'), cover_url: FILE('nbc'), printable_id: null },
    { band: 'sprouts', book_key: 'ra', title: 'Sprouts: Read-Aloud Storybook', pod_package_id: A5, page_count: 112, interior_url: FILE('ra'), cover_url: FILE('rac'), printable_id: null },
  ];
}

function order(over: Row = {}): Row {
  return {
    id: 'ord-1', order_number: 'ET-2001', status: 'ready_to_fulfill', customer_email: 'buyer@example.com',
    customer_phone: '+19315550100', shipping_name: 'Pat Buyer',
    shipping_address: { line1: '1 Main St', city: 'Nashville', postal_code: '37201', country: 'US', state: 'TN' },
    created_at: '2026-11-10T12:00:00.000Z', lulu_print_job_id: null, lulu_status: null, lulu_status_message: null,
    ...over,
  };
}

function jobRow(over: Row = {}): Row {
  return {
    id: 'job-1', order_id: 'ord-1', status: 'pending', attempts: 0, last_error: null, print_job_id: null,
    submitted_at: null, created_at: '2026-11-10T12:00:01.000Z', updated_at: '2026-11-10T12:00:01.000Z', ...over,
  };
}

function world(opts: { order?: Row; job?: Row; hooks?: { loseClaimReply?: boolean; failOrderJobIdWrite?: boolean } } = {}) {
  return memDb({
    orders: [order(opts.order)],
    lulu_jobs: [jobRow(opts.job)],
    order_items: [{ order_id: 'ord-1', quantity: 1, product: { sku: 'sprouts_print_set', name: 'Sprouts set', fulfillment: 'lulu' } }],
    lulu_printables: printables(),
  }, opts.hooks);
}

/** Lulu token + create, Resend, and the file host. */
function stubFetch(opts: { fileStatus?: number; fileBody?: string; createLineItems?: unknown[] } = {}) {
  const calls = { posts: 0, resend: [] as string[], files: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith('/protocol/openid-connect/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    }
    if (url === 'https://api.lulu.com/print-jobs/' && init?.method === 'POST') {
      calls.posts++;
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: 9001, external_id: body.external_id, status: { name: 'CREATED' }, line_items: opts.createLineItems ?? [] }), { status: 201 });
    }
    if (url === 'https://api.resend.com/emails') {
      calls.resend.push(String(JSON.parse(String(init?.body ?? '{}')).subject));
      return new Response(JSON.stringify({ id: 'r1' }), { status: 200 });
    }
    if (url.startsWith('https://files.test/')) {
      calls.files++;
      const st = opts.fileStatus ?? 206;
      return new Response(opts.fileBody ?? '%PDF-1.7 rest of file', { status: st, headers: { 'content-type': st < 300 ? 'application/pdf' : 'text/html' } });
    }
    return new Response(`not stubbed: ${url}`, { status: 599 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/** The Lulu lookup, faked. `jobs` is what Lulu's list returns for any search. */
function fakeApi(jobs: Row[] = [], opts: { throws?: boolean; byId?: Record<number, Row> } = {}) {
  const searches: Row[] = [];
  const gets: number[] = [];
  const api = {
    listPrintJobs: (p: Row) => {
      searches.push(p);
      if (opts.throws) return Promise.reject(new Error('lulu 503'));
      return Promise.resolve({ count: jobs.length, next: null, results: jobs });
    },
    getPrintJob: (id: number) => {
      gets.push(id);
      const j = opts.byId?.[id];
      return j ? Promise.resolve(j) : Promise.reject(new Error(`lulu 404 for ${id}`));
    },
  };
  return { api: api as any, searches, gets };
}

const job = (w: ReturnType<typeof world>) => w.tables.lulu_jobs[0];
const ord = (w: ReturnType<typeof world>) => w.tables.orders[0];

// ---------------------------------------------------------------- L7 retry spacing
Deno.test('L7: a failed job waits out its delay; pending never waits', () => {
  const t = Date.parse('2026-11-11T10:00:00.000Z');
  const at = (min: number) => new Date(t + min * 60_000);
  const failed = (attempts: number) => ({ status: 'failed' as const, attempts, updated_at: new Date(t).toISOString() });
  assert(lf.luluRetryDue({ status: 'pending', attempts: 0, updated_at: null }, at(0)));
  assertFalse(lf.luluRetryDue(failed(1), at(9)));
  assert(lf.luluRetryDue(failed(1), at(10)));
  assertFalse(lf.luluRetryDue(failed(4), at(79)));
  assert(lf.luluRetryDue(failed(4), at(80)));
  assertFalse(lf.luluRetryDue(failed(7), at(639)));
  assert(lf.luluRetryDue(failed(7), at(640)));
  assert(lf.luluRetryDue({ status: 'failed', attempts: 2, updated_at: 'garbage' }, at(0)), 'an unreadable time never strands an order');
  assertFalse(lf.luluRetryDue({ status: 'submitted', attempts: 1, updated_at: null }, at(999)));
  assertEquals(lf.LULU_JOB_MAX_ATTEMPTS, 8);
  assertEquals(lf.LULU_RETRY_DELAYS_MINUTES.length, lf.LULU_JOB_MAX_ATTEMPTS - 1);
  assertEquals(lf.LULU_RETRY_DELAYS_MINUTES.reduce((a: number, b: number) => a + b, 0), 1270);
});

Deno.test('L7: the try that uses up the last one emails the founder; earlier tries do not', async () => {
  for (const [attempts, alerts] of [[2, 0], [7, 1]] as const) {
    const w = world({ job: { status: 'failed', attempts, last_error: 'Lulu 500', updated_at: '2026-11-10T00:00:00.000Z' } });
    const f = stubFetch({ fileStatus: 404 });
    try {
      const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([]).api);
      assertEquals(r.status, 'failed');
      assertEquals(job(w).attempts, attempts + 1);
      const sent = f.calls.resend.filter((s) => s.includes('NOT sent after 8 tries'));
      assertEquals(sent.length, alerts, `attempt ${attempts + 1}`);
      if (alerts) assertStringIncludes(sent[0], 'ET-2001');
    } finally {
      f.restore();
    }
  }
});

// ---------------------------------------------------------------- L1 claim
Deno.test('L1: claim stamps carry microseconds and survive PostgREST trimming trailing zeros', () => {
  const s = lf.luluClaimStamp(new Date('2026-11-11T14:22:33.120Z'));
  assert(/^2026-11-11T14:22:33\.120\d{3}Z$/.test(s), s);
  assertEquals(lf.timestampMicros('2026-11-11T14:22:33.123450Z'), lf.timestampMicros('2026-11-11T14:22:33.12345+00:00'));
  assertEquals(lf.timestampMicros('2026-11-11 14:22:33.5+00'), lf.timestampMicros('2026-11-11T14:22:33.500000Z'));
  assert(lf.timestampMicros('2026-11-11T14:22:33.123456Z') !== lf.timestampMicros('2026-11-11T14:22:33.123457Z'));
  assertEquals(lf.timestampMicros('not a time'), null);
});

Deno.test('L1: a claim whose reply was lost is confirmed by re-reading, and the job is sent once', async () => {
  const w = world({ hooks: { loseClaimReply: true } });
  const f = stubFetch();
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([]).api);
    assertEquals(r.status, 'submitted');
    assertEquals(f.calls.posts, 1);
    assertEquals(job(w).status, 'submitted');
    assertEquals(ord(w).lulu_print_job_id, 9001);
  } finally {
    f.restore();
  }
});

Deno.test('L1: a claim another worker holds is left alone', async () => {
  const w = world({ job: { status: 'in_progress', attempts: 1, updated_at: new Date().toISOString() } });
  const f = stubFetch();
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w), status: 'pending', attempts: 0 } as any, fakeApi([]).api);
    assertEquals(r.status, 'skipped');
    assertEquals(f.calls.posts, 0);
    assertEquals(job(w).status, 'in_progress');
  } finally {
    f.restore();
  }
});

Deno.test('L1: stale in_progress claims are released; a dead last try is closed and reported once', async () => {
  const now = new Date('2026-11-11T12:00:00.000Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  const w = memDb({
    orders: [order(), order({ id: 'ord-2', order_number: 'ET-2002' }), order({ id: 'ord-3', order_number: 'ET-2003' })],
    lulu_jobs: [
      jobRow({ id: 'j-stale', order_id: 'ord-1', status: 'in_progress', attempts: 2, updated_at: ago(20) }),
      jobRow({ id: 'j-last', order_id: 'ord-2', status: 'in_progress', attempts: 8, updated_at: ago(30) }),
      jobRow({ id: 'j-live', order_id: 'ord-3', status: 'in_progress', attempts: 1, updated_at: ago(5) }),
    ],
  });
  const f = stubFetch();
  try {
    const r = await lf.releaseStaleLuluClaims(w.db, now);
    assertEquals(r, { released: 2, exhausted: 1 });
    const byId = Object.fromEntries(w.tables.lulu_jobs.map((j) => [j.id, j]));
    assertEquals(byId['j-stale'].status, 'failed');
    assertStringIncludes(byId['j-stale'].last_error, 'stopped partway');
    assertEquals(byId['j-last'].status, 'failed');
    assertEquals(byId['j-live'].status, 'in_progress', 'a live claim is never touched');
    assertEquals(f.calls.resend.length, 1);
    assertStringIncludes(f.calls.resend[0], 'ET-2002');
    // A second drain finds nothing to release and sends nothing more.
    assertEquals(await lf.releaseStaleLuluClaims(w.db, now), { released: 0, exhausted: 0 });
    assertEquals(f.calls.resend.length, 1);
    // The released row now asks Lulu before any retry.
    assert(lf.luluJobNeedsLookup(byId['j-stale']));
  } finally {
    f.restore();
  }
});

// ---------------------------------------------------------------- L2 existing job lookup
Deno.test('L2: a never-tried job does not call the lookup and is sent normally', async () => {
  const w = world();
  const f = stubFetch();
  const a = fakeApi([]);
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, a.api);
    assertEquals(r.status, 'submitted');
    assertEquals(a.searches.length, 0);
    assertEquals(f.calls.posts, 1);
  } finally {
    f.restore();
  }
});

Deno.test('L2: a retry adopts the live job Lulu already holds instead of printing a second set', async () => {
  const w = world({ job: { status: 'failed', attempts: 1, last_error: 'orders update failed', updated_at: '2026-11-10T00:00:00.000Z' } });
  const f = stubFetch();
  const a = fakeApi([
    { id: 7001, external_id: 'ET-2001', status: { name: 'REJECTED' } }, // dead: ignored
    { id: 7002, external_id: 'ET-20011', status: { name: 'CREATED' } }, // another order the broad search also matched
    { id: 7003, external_id: 'ET-2001', status: { name: 'CREATED', message: 'created' }, date_created: '2026-11-10T12:00:05Z' },
  ]);
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, a.api);
    assertEquals(r.status, 'submitted');
    assertStringIncludes(String(r.detail), 'adopted existing Lulu job 7003');
    assertEquals(f.calls.posts, 0, 'nothing new is created at Lulu');
    assertEquals(ord(w).lulu_print_job_id, 7003);
    assertEquals(ord(w).status, 'in_production');
    assertEquals(job(w).status, 'submitted');
    assertEquals(job(w).print_job_id, 7003);
    assertEquals(a.searches[0].search, 'ET-2001');
    assertEquals(a.searches[0].created_after, '2026-11-09T12:00:00Z', 'second precision, a day before the order');
    assertEquals(f.calls.resend.length, 0);
  } finally {
    f.restore();
  }
});

Deno.test('L2: only dead or other-order jobs at Lulu means the retry is sent', async () => {
  const w = world({ job: { status: 'failed', attempts: 1, last_error: 'Lulu 500', updated_at: '2026-11-10T00:00:00.000Z' } });
  const f = stubFetch();
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([
      { id: 7001, external_id: 'ET-2001', status: { name: 'CANCELED' } },
      { id: 7002, external_id: 'ET-20011', status: { name: 'IN_PRODUCTION' } },
    ]).api);
    assertEquals(r.status, 'submitted');
    assertEquals(f.calls.posts, 1);
    assertEquals(ord(w).lulu_print_job_id, 9001);
  } finally {
    f.restore();
  }
});

Deno.test('L2: when Lulu cannot be asked, nothing is sent again', async () => {
  const w = world({ job: { status: 'failed', attempts: 1, last_error: 'Lulu 500', updated_at: '2026-11-10T00:00:00.000Z' } });
  const f = stubFetch();
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([], { throws: true }).api);
    assertEquals(r.status, 'failed');
    assertEquals(f.calls.posts, 0);
    assertStringIncludes(job(w).last_error, 'could not ask Lulu');
    assertStringIncludes(job(w).last_error, 'cannot print twice');
  } finally {
    f.restore();
  }
});

Deno.test('L2: a job created at Lulu but not recorded on the order is kept and adopted, never sent twice', async () => {
  const w = world({ hooks: { failOrderJobIdWrite: true } });
  const f = stubFetch();
  try {
    const first = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([]).api);
    assertEquals(first.status, 'failed');
    assertEquals(f.calls.posts, 1);
    assertEquals(job(w).print_job_id, 9001, 'the id Lulu returned is kept on the job row');
  } finally {
    f.restore();
  }
  // Next try: the orders table works again, and Lulu still holds job 9001.
  const w2 = memDb({ ...w.tables });
  const f2 = stubFetch();
  const a = fakeApi([], { byId: { 9001: { id: 9001, external_id: 'ET-2001', status: { name: 'CREATED' } } } });
  try {
    const second = await lf.submitLuluJob(w2.db, w2.tables.lulu_jobs[0] as any, a.api);
    assertEquals(second.status, 'submitted');
    assertEquals(f2.calls.posts, 0);
    assertEquals(a.gets, [9001]);
    assertEquals(w2.tables.orders[0].lulu_print_job_id, 9001);
  } finally {
    f2.restore();
  }
});

Deno.test('L2: two live jobs at Lulu: the oldest is tracked and the founder is told', async () => {
  const w = world({ job: { status: 'failed', attempts: 2, last_error: 'x', updated_at: '2026-11-10T00:00:00.000Z' } });
  const f = stubFetch();
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([
      { id: 7005, external_id: 'ET-2001', status: { name: 'CREATED' } },
      { id: 7004, external_id: 'ET-2001', status: { name: 'UNPAID' } },
    ]).api);
    assertEquals(r.print_job_id, 7004);
    assertEquals(f.calls.posts, 0);
    assertEquals(f.calls.resend.length, 1);
    assertStringIncludes(f.calls.resend[0], '2 live print jobs for order ET-2001');
  } finally {
    f.restore();
  }
});

Deno.test('L2: which rows must ask Lulu first', () => {
  assertFalse(lf.luluJobNeedsLookup({ attempts: 0, print_job_id: null, last_error: null }));
  assert(lf.luluJobNeedsLookup({ attempts: 1, print_job_id: null, last_error: null }));
  assert(lf.luluJobNeedsLookup({ attempts: 0, print_job_id: 5, last_error: null }));
  assert(lf.luluJobNeedsLookup({ attempts: 0, print_job_id: null, last_error: 'resubmitted by founder' }));
});

// ---------------------------------------------------------------- L3 events from another job
Deno.test('L3: a late REJECTED from the dead first job does not touch the live order (the ET-1043 case)', async () => {
  const w = world({
    order: { order_number: 'ET-1043', status: 'in_production', lulu_print_job_id: 3141658, lulu_status: 'IN_PRODUCTION', lulu_status_message: 'Print-job is currently in production' },
    job: { status: 'submitted', attempts: 1, print_job_id: 3141658 },
  });
  const f = stubFetch();
  try {
    const r = await lf.applyLuluPrintJob(w.db, { id: 3140703, external_id: 'ET-1043', status: { name: 'REJECTED', message: 'bad file' } } as any);
    assertStringIncludes(r.applied, 'ignored');
    assertEquals(ord(w).lulu_status, 'IN_PRODUCTION');
    assertEquals(ord(w).lulu_print_job_id, 3141658);
    assertEquals(job(w).status, 'submitted');
    assertEquals(f.calls.resend.length, 0, 'nothing to do, so nobody is emailed');
    assertFalse(w.ops.some((o) => o.op === 'update'), 'no write at all');
  } finally {
    f.restore();
  }
});

Deno.test('L3: an OLD job that SHIPPED is reported (a second set may have printed) but not applied', async () => {
  const w = world({ order: { order_number: 'ET-1044', status: 'in_production', lulu_print_job_id: 3141659, lulu_status: 'IN_PRODUCTION' } });
  const f = stubFetch();
  try {
    const r = await lf.applyLuluPrintJob(w.db, { id: 3140704, external_id: 'ET-1044', status: { name: 'SHIPPED' } } as any);
    assertStringIncludes(r.applied, 'ignored');
    assertEquals(ord(w).status, 'in_production');
    assertEquals(f.calls.resend.length, 1);
    assertStringIncludes(f.calls.resend[0], 'OLD print job for order ET-1044');
  } finally {
    f.restore();
  }
});

Deno.test('L3: the job released for a Resubmit cannot re-attach itself; a brand-new job still can', async () => {
  const released = world({ order: { lulu_print_job_id: null, lulu_status_message: 'previous Lulu job 3140703 REJECTED; resubmitted by founder' } });
  const f = stubFetch();
  try {
    const r = await lf.applyLuluPrintJob(released.db, { id: 3140703, external_id: 'ET-2001', status: { name: 'REJECTED' } } as any);
    assertStringIncludes(r.applied, 'ignored');
    assertEquals(ord(released).lulu_print_job_id, null);
    // The first event of a job whose id the submit has not written yet is still applied.
    const fresh = world({ order: { status: 'in_production' } });
    const r2 = await lf.applyLuluPrintJob(fresh.db, { id: 9100, external_id: 'ET-2001', status: { name: 'IN_PRODUCTION' } } as any);
    assertEquals(r2.applied, 'status recorded');
    assertEquals(ord(fresh).lulu_print_job_id, 9100);
  } finally {
    f.restore();
  }
  assertEquals(lf.staleLuluJobReason({ lulu_print_job_id: 5, lulu_status_message: null }, 5), null);
  assertEquals(lf.staleLuluJobReason({ lulu_print_job_id: null, lulu_status_message: 'previous Lulu job 51 X' }, 5), null, 'job 5 is not job 51');
});

// ---------------------------------------------------------------- L5 print files
Deno.test('L5: checkPrintFileUrl tells a PDF from an error, a web page and silence', async () => {
  const ok = await pf.checkPrintFileUrl('https://f.test/a', { fetchImpl: () => Promise.resolve(new Response('%PDF-1.4 ...', { status: 206 })) });
  assertEquals(ok.state, 'ok');
  const gone = await pf.checkPrintFileUrl('https://f.test/a', { fetchImpl: () => Promise.resolve(new Response('File Deleted', { status: 404 })) });
  assertEquals([gone.state, gone.status], ['bad', 404]);
  const page = await pf.checkPrintFileUrl('https://f.test/a', {
    fetchImpl: () => Promise.resolve(new Response('<!DOCTYPE html>', { status: 200, headers: { 'content-type': 'text/html' } })),
  });
  assertEquals(page.state, 'bad');
  assertStringIncludes(page.detail, 'not a PDF');
  const silent = await pf.checkPrintFileUrl('https://f.test/a', { fetchImpl: () => Promise.reject(new TypeError('connection reset')) });
  assertEquals(silent.state, 'unreachable');
});

Deno.test('L5: a server that ignores Range is read for one chunk only, never the whole file', async () => {
  let pulls = 0;
  const huge = new ReadableStream<Uint8Array>({
    pull(c) {
      pulls++;
      c.enqueue(pulls === 1 ? new TextEncoder().encode('%PDF-1.7') : new Uint8Array(1 << 20));
      if (pulls > 500) c.close();
    },
  });
  const r = await pf.checkPrintFileUrl('https://f.test/big', { fetchImpl: () => Promise.resolve(new Response(huge, { status: 200 })) });
  assertEquals(r.state, 'ok');
  assert(pulls <= 3, `read ${pulls} chunks`);
  assertEquals(pf.printFileHost('https://drive.usercontent.google.com/download?id=SECRET&confirm=t'), 'drive.usercontent.google.com/download');
});

Deno.test('L5: a dead file stops the job before Lulu is asked, and the reason names no secret', async () => {
  const w = world();
  const f = stubFetch({ fileStatus: 404, fileBody: 'File Deleted' });
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([]).api);
    assertEquals(r.status, 'failed');
    assertEquals(f.calls.posts, 0);
    assertStringIncludes(job(w).last_error, 'print file check failed');
    assertStringIncludes(job(w).last_error, 'HTTP 404');
    assertFalse(job(w).last_error.includes('secret-'), 'the file id stays out of the error');
  } finally {
    f.restore();
  }
});

Deno.test('L5: a file host that does not answer does not hold up a paid order', async () => {
  await lf.assertPrintFilesLookRight(
    [{ title: 't', quantity: 1, external_id: 'tg', pod_package_id: COIL, interior: { source_url: 'https://x.test/i' }, cover: { source_url: 'https://x.test/c' } }] as any,
    'ET-1',
    () => Promise.resolve({ url: '', state: 'unreachable', detail: 'no answer (TimeoutError)' }),
  );
  await assertRejects(
    () => lf.assertPrintFilesLookRight(
      [{ title: 't', quantity: 1, external_id: 'tg', pod_package_id: COIL, interior: { source_url: 'https://x.test/i' }, cover: { source_url: 'https://x.test/c' } }] as any,
      'ET-1',
      (url) => Promise.resolve({ url, state: url.endsWith('/c') ? 'bad' : 'ok', detail: url.endsWith('/c') ? 'HTTP 403' : 'ok' }),
    ),
    Error,
    'tg cover (x.test/c): HTTP 403',
  );
});

// ---------------------------------------------------------------- L6 no printable-id cache
Deno.test('L6: a successful job never writes printable ids back into lulu_printables', async () => {
  const w = world();
  const f = stubFetch({ createLineItems: [{ external_id: 'tg', printable_id: 'pr-1' }, { external_id: 'nb', printable_id: 'pr-2' }] });
  try {
    const r = await lf.submitLuluJob(w.db, { ...job(w) } as any, fakeApi([]).api);
    assertEquals(r.status, 'submitted');
    assertFalse(w.ops.some((o) => o.table === 'lulu_printables' && o.op === 'update'));
    assert(w.tables.lulu_printables.every((p) => p.printable_id === null));
  } finally {
    f.restore();
  }
});
