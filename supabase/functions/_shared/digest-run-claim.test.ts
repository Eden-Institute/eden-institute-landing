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
  digestWindow,
  isRealYmd,
  STALE_PENDING_MS,
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
