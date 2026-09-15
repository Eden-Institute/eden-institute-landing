// deno test supabase/functions/_shared/digest-run-claim.test.ts
//
// Claiming a digest day: fresh insert, skips, takeovers of failed and dead
// pending runs, lost responses, and a run racing another. No network: a tiny
// in-memory stand-in for the digest_runs endpoints.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  addDays,
  centralToday,
  claimDigestRun,
  claimRun,
  DIGEST_RUNS,
  digestWindow,
  isRealYmd,
  RECAP_RUNS,
  STALE_PENDING_MS,
  WEEKLY_TRENDS_RUNS,
} from './digest-run-claim.ts';

interface Row { id: string; digest_date: string; status: string; triggered_at: string }

function fakeRuns(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.digest_date, { ...r }]));
  const hooks = {
    /** Commit the write, then answer 504 as if the response was lost. */
    loseInsertResponse: false,
    losePatchResponse: false,
    /** Runs just before the takeover PATCH is applied (simulate another run getting there first). */
    beforePatch: null as null | (() => void),
  };
  let n = 0;
  const sbFetch = (path: string, init: RequestInit = {}) => {
    const url = new URL(`https://x${path}`);
    const method = init.method ?? 'GET';
    const json = (status: number, body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (method === 'POST') {
      const b = JSON.parse(String(init.body));
      if (rows.has(b.digest_date)) return json(409, { code: '23505' });
      const row = { id: `run-${++n}`, digest_date: b.digest_date, status: b.status, triggered_at: b.triggered_at };
      rows.set(row.digest_date, row);
      return hooks.loseInsertResponse ? json(504, { message: 'Gateway Timeout' }) : json(201, [row]);
    }
    if (method === 'GET') {
      const d = url.searchParams.get('digest_date')!.replace('eq.', '');
      const r = rows.get(d);
      return json(200, r ? [{ id: r.id, status: r.status, triggered_at: r.triggered_at }] : []);
    }
    if (method === 'PATCH') {
      hooks.beforePatch?.();
      const id = url.searchParams.get('id')!.replace('eq.', '');
      const status = url.searchParams.get('status')!.replace('eq.', '');
      const trig = url.searchParams.get('triggered_at')!.replace('eq.', '');
      const b = JSON.parse(String(init.body));
      const r = [...rows.values()].find((x) => x.id === id);
      const matched = r && r.status === status && Date.parse(r.triggered_at) === Date.parse(trig) ? [r] : [];
      for (const m of matched) Object.assign(m, { status: b.status, triggered_at: b.triggered_at });
      return hooks.losePatchResponse ? json(504, { message: 'Gateway Timeout' }) : json(200, matched);
    }
    return json(405, {});
  };
  return { rows, hooks, sbFetch };
}

const DAY = '2026-09-12';
const W = digestWindow(DAY);
const NOW = new Date('2026-09-13T14:37:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

Deno.test('first run of the day inserts and owns it', async () => {
  const f = fakeRuns();
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'owned', id: 'run-1', takeover: null });
  assertEquals(f.rows.get(DAY)!.status, 'pending');
});

Deno.test('a sent day is skipped and left alone', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'sent', triggered_at: ago(3600_000) }]);
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'skip', reason: 'already_ran', status: 'sent' });
  assertEquals(f.rows.get(DAY)!.status, 'sent');
});

Deno.test('a skipped_zero day is also already_ran', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'skipped_zero', triggered_at: ago(3600_000) }]);
  assertEquals((await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW })).kind, 'skip');
});

Deno.test('a failed day is taken over', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'failed', triggered_at: ago(60_000) }]);
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'owned', id: 'a', takeover: 'failed' });
  assertEquals(f.rows.get(DAY)!.status, 'pending');
  assertEquals(f.rows.get(DAY)!.triggered_at, NOW.toISOString());
});

Deno.test('the 2026-09-12 case: pending left 37 minutes ago is taken over', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'pending', triggered_at: '2026-09-13T14:00:46.037563+00:00' }]);
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'owned', id: 'a', takeover: 'stale_pending' });
});

Deno.test('a pending run younger than the stale limit is left to finish', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'pending', triggered_at: ago(STALE_PENDING_MS - 1000) }]);
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'skip', reason: 'in_progress', status: 'pending' });
});

Deno.test('an INSERT that committed but lost its response is still owned', async () => {
  const f = fakeRuns();
  f.hooks.loseInsertResponse = true;
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'owned', id: 'run-1', takeover: null });
});

Deno.test('a takeover PATCH that committed but lost its response is still owned', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'failed', triggered_at: ago(60_000) }]);
  f.hooks.losePatchResponse = true;
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'owned', id: 'a', takeover: 'failed' });
});

Deno.test('two runs racing for a failed day: only one owns it', async () => {
  const f = fakeRuns([{ id: 'a', digest_date: DAY, status: 'failed', triggered_at: ago(60_000) }]);
  const other = new Date(NOW.getTime() + 5).toISOString();
  f.hooks.beforePatch = () => {
    f.hooks.beforePatch = null;
    Object.assign(f.rows.get(DAY)!, { status: 'pending', triggered_at: other });
  };
  const r = await claimDigestRun(f.sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r, { kind: 'skip', reason: 'claimed_elsewhere', status: 'pending' });
  assertEquals(f.rows.get(DAY)!.triggered_at, other);
});

Deno.test('no row and a failed insert is an error, not a send', async () => {
  const sbFetch = (_p: string, init: RequestInit = {}) =>
    Promise.resolve(new Response(init.method === 'POST' ? '{"message":"boom"}' : '[]', { status: init.method === 'POST' ? 500 : 200 }));
  const r = await claimDigestRun(sbFetch, { digestDate: DAY, ...W, now: NOW });
  assertEquals(r.kind, 'error');
});

Deno.test('dates: Central today, day arithmetic, validation, window', () => {
  assertEquals(centralToday(new Date('2026-09-14T04:59:00Z')), '2026-09-13'); // 23:59 CDT
  assertEquals(centralToday(new Date('2026-09-14T05:00:00Z')), '2026-09-14'); // 00:00 CDT
  assertEquals(centralToday(new Date('2026-12-01T05:30:00Z')), '2026-11-30'); // 23:30 CST
  assertEquals(addDays('2026-09-13', -1), '2026-09-12');
  assertEquals(addDays('2026-12-31', 1), '2027-01-01');
  assertEquals(addDays('2026-03-01', -1), '2026-02-28');
  assertEquals(isRealYmd('2026-09-12'), true);
  assertEquals(isRealYmd('2026-02-30'), false);
  assertEquals(isRealYmd('9/12/2026'), false);
  // Identical to the window the scheduled run stored for 2026-09-12 (06:00Z to 06:00Z).
  assertEquals(Date.parse(W.windowStart), Date.parse('2026-09-12T06:00:00Z'));
  assertEquals(Date.parse(W.windowEnd), Date.parse('2026-09-13T06:00:00Z'));
});


// ── claimRun on the other report tables ──

interface GenRow { id: string; date: string; status: string; triggered_at: string; extra: Record<string, unknown> }

/** Same stand-in, parameterised on table and date column, recording every request path. */
function fakeTable(table: string, dateColumn: string, seed: GenRow[] = []) {
  const rows = new Map<string, GenRow>(seed.map((r) => [r.date, { ...r }]));
  const paths: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  let n = 0;
  const sbFetch = (path: string, init: RequestInit = {}) => {
    paths.push(`${init.method ?? 'GET'} ${path}`);
    const url = new URL(`https://x${path}`);
    const method = init.method ?? 'GET';
    const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (!url.pathname.startsWith(`/rest/v1/${table}`)) return json(404, { message: 'wrong table' });
    if (method === 'POST') {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      if (rows.has(b[dateColumn])) return json(409, { code: '23505' });
      const row = { id: `r-${++n}`, date: b[dateColumn], status: b.status, triggered_at: b.triggered_at, extra: b };
      rows.set(row.date, row);
      return json(201, [row]);
    }
    if (method === 'GET') {
      const d = url.searchParams.get(dateColumn)!.replace('eq.', '');
      const r = rows.get(d);
      return json(200, r ? [{ id: r.id, status: r.status, triggered_at: r.triggered_at }] : []);
    }
    if (method === 'PATCH') {
      const id = url.searchParams.get('id')!.replace('eq.', '');
      const status = url.searchParams.get('status')!.replace('eq.', '');
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      const r = [...rows.values()].find((x) => x.id === id && x.status === status);
      if (r) Object.assign(r, { status: b.status, triggered_at: b.triggered_at });
      return json(200, r ? [r] : []);
    }
    return json(405, {});
  };
  return { rows, paths, bodies, sbFetch };
}

const FRIDAY = '2026-09-18';
const FRIDAY_RETRY = new Date('2026-09-18T14:37:00.000Z');

Deno.test('weekly: first Friday run inserts on run_date into weekly_trends_runs', async () => {
  const f = fakeTable('weekly_trends_runs', 'run_date');
  const r = await claimRun(f.sbFetch, WEEKLY_TRENDS_RUNS, { date: FRIDAY, now: FRIDAY_RETRY });
  assertEquals(r, { kind: 'owned', id: 'r-1', takeover: null });
  assertEquals(f.bodies[0], { run_date: FRIDAY, status: 'pending', triggered_at: FRIDAY_RETRY.toISOString() });
});

Deno.test('weekly: the 14:37 retry skips a Friday the 14:00 run sent', async () => {
  const f = fakeTable('weekly_trends_runs', 'run_date', [
    { id: 'w', date: FRIDAY, status: 'sent', triggered_at: '2026-09-18T14:00:02Z', extra: {} },
  ]);
  const r = await claimRun(f.sbFetch, WEEKLY_TRENDS_RUNS, { date: FRIDAY, now: FRIDAY_RETRY });
  assertEquals(r, { kind: 'skip', reason: 'already_ran', status: 'sent' });
  assertEquals(f.paths.some((p) => p.startsWith('PATCH')), false);
});

Deno.test('weekly: the 14:37 retry takes over a failed Friday and clears its result columns', async () => {
  const f = fakeTable('weekly_trends_runs', 'run_date', [
    { id: 'w', date: FRIDAY, status: 'failed', triggered_at: '2026-09-18T14:00:02Z', extra: {} },
  ]);
  const r = await claimRun(f.sbFetch, WEEKLY_TRENDS_RUNS, { date: FRIDAY, now: FRIDAY_RETRY });
  assertEquals(r, { kind: 'owned', id: 'w', takeover: 'failed' });
  assertEquals(f.bodies.at(-1), {
    status: 'pending',
    triggered_at: FRIDAY_RETRY.toISOString(),
    completed_at: null,
    error_message: null,
    leads_this_week: null,
  });
});

Deno.test('weekly: a pending row left by a run that died at 14:00 is taken over at 14:37', async () => {
  const f = fakeTable('weekly_trends_runs', 'run_date', [
    { id: 'w', date: FRIDAY, status: 'pending', triggered_at: '2026-09-18T14:00:02Z', extra: {} },
  ]);
  const r = await claimRun(f.sbFetch, WEEKLY_TRENDS_RUNS, { date: FRIDAY, now: FRIDAY_RETRY });
  assertEquals(r, { kind: 'owned', id: 'w', takeover: 'stale_pending' });
});

Deno.test('recap: claims recap_date in recap_runs; a sent evening is skipped at 01:37', async () => {
  const f = fakeTable('recap_runs', 'recap_date');
  const main = new Date('2026-09-17T01:00:00.000Z');
  const retry = new Date('2026-09-17T01:37:00.000Z');
  // Both passes resolve to the same Central day (20:00 and 20:37 CDT on 9/16).
  assertEquals(centralToday(main), '2026-09-16');
  assertEquals(centralToday(retry), '2026-09-16');
  assertEquals((await claimRun(f.sbFetch, RECAP_RUNS, { date: '2026-09-16', now: main })).kind, 'owned');
  f.rows.get('2026-09-16')!.status = 'sent';
  const r = await claimRun(f.sbFetch, RECAP_RUNS, { date: '2026-09-16', now: retry });
  assertEquals(r, { kind: 'skip', reason: 'already_ran', status: 'sent' });
});

Deno.test('recap: a takeover resets resend_id, not the digest columns', async () => {
  const f = fakeTable('recap_runs', 'recap_date', [
    { id: 'e', date: '2026-09-16', status: 'failed', triggered_at: '2026-09-17T01:00:05Z', extra: {} },
  ]);
  await claimRun(f.sbFetch, RECAP_RUNS, { date: '2026-09-16', now: new Date('2026-09-17T01:37:00Z') });
  const patchBody = f.bodies.at(-1)!;
  assertEquals('resend_id' in patchBody, true);
  assertEquals('captures_count' in patchBody, false);
});

Deno.test('recap: skipped_zero is not a done status there, so it is not silently treated as sent', () => {
  assertEquals(RECAP_RUNS.doneStatuses.includes('skipped_zero'), false);
  assertEquals(DIGEST_RUNS.doneStatuses.includes('skipped_zero'), true);
});
