// online-year-order-status (punch #472): the handler with injected fakes, plus the pure shaping.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  handleOnlineYearOrderStatus,
  isCheckoutSessionId,
  onlineYearBandFromLookupKey,
  shapeOnlineYearStatus,
  type OnlineYearStatusDeps,
  type OnlineYearStatusLicense,
  type OnlineYearStatusOrder,
} from './online-year-status.ts';

const TOKEN = 'p'.repeat(32);
const SID = 'cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuV';
const env = (m: Record<string, string> = {}) => (k: string) => ({ ONLINE_YEAR_PREVIEW_TOKEN: TOKEN, ...m })[k];

function fakeDeps(
  orders: Record<string, OnlineYearStatusOrder>,
  licenses: Record<string, OnlineYearStatusLicense[]>,
  opts: { env?: Record<string, string>; failOrders?: boolean } = {},
) {
  const calls = { findOrder: 0, listLicenses: 0 };
  const logs: string[] = [];
  const deps: OnlineYearStatusDeps = {
    cors: { 'Access-Control-Allow-Origin': '*' },
    env: env(opts.env),
    log: (l) => logs.push(l),
    findOrder: (sid) => {
      calls.findOrder++;
      if (opts.failOrders) return Promise.reject(new Error('boom'));
      return Promise.resolve(orders[sid] ?? null);
    },
    listLicenses: (id) => {
      calls.listLicenses++;
      return Promise.resolve(licenses[id] ?? []);
    },
  };
  return { deps, calls, logs };
}

const post = (body: unknown, preview = true) =>
  new Request('https://x/online-year-order-status', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(preview ? { 'x-online-year-preview': TOKEN } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function call(req: Request, f: ReturnType<typeof fakeDeps>) {
  const res = await handleOnlineYearOrderStatus(req, f.deps);
  return { status: res.status, json: res.status === 200 || res.status >= 400 ? await res.json() : null, res };
}

const READY_ORDER: Record<string, OnlineYearStatusOrder> = { [SID]: { id: 'o1', lookup_key: 'online_year_seedlings' } };
const TWO_KIDS: Record<string, OnlineYearStatusLicense[]> = {
  o1: [
    // Created in one transaction: same created_at, so by name (as online_year_grant_purchase lists them).
    // Ben is new (12 months from the purchase); Ava renewed early, so her year starts at her old end date.
    { band: 'seedlings', child_name: 'Ben', ends_at: '2027-11-26T02:00:00+00:00', created_at: '2026-11-26T02:00:05.123+00:00' },
    { band: 'seedlings', child_name: 'Ava', ends_at: '2028-03-01T15:30:00+00:00', created_at: '2026-11-26T02:00:05.123+00:00' },
  ],
};

Deno.test('dark: 404 not_found without the preview header, and the database is never read', async () => {
  const f = fakeDeps(READY_ORDER, TWO_KIDS);
  const r = await call(post({ session_id: SID }, false), f);
  assertEquals([r.status, r.json], [404, { error: 'not_found' }]);
  assertEquals(f.calls, { findOrder: 0, listLicenses: 0 });
});

Deno.test('dark: a wrong preview token is still 404', async () => {
  const f = fakeDeps(READY_ORDER, TWO_KIDS);
  const req = new Request('https://x/', { method: 'POST', headers: { 'x-online-year-preview': 'q'.repeat(32) }, body: JSON.stringify({ session_id: SID }) });
  assertEquals((await call(req, f)).status, 404);
});

Deno.test('the launch switch opens it without the header', async () => {
  const f = fakeDeps(READY_ORDER, TWO_KIDS, { env: { ONLINE_YEAR_ENABLED: 'true' } });
  const r = await call(post({ session_id: SID }, false), f);
  assertEquals(r.status, 200);
  assertEquals(r.json.state, 'ready');
});

Deno.test('OPTIONS answers CORS even while dark (the browser preflight carries no header values)', async () => {
  const f = fakeDeps({}, {});
  const res = await handleOnlineYearOrderStatus(new Request('https://x/', { method: 'OPTIONS' }), f.deps);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('bad session id: 400 before any read', async () => {
  for (const body of [{}, { session_id: '' }, { session_id: 'cs_live_short' }, { session_id: 'pi_123456789012345678901234' }, { session_id: `${SID}'--` }, { session_id: 42 }, 'not json']) {
    const f = fakeDeps(READY_ORDER, TWO_KIDS);
    const r = await call(post(body), f);
    assertEquals([r.status, r.json], [400, { error: 'Missing or malformed session_id' }], JSON.stringify(body));
    assertEquals(f.calls.findOrder, 0);
  }
});

Deno.test('GET is refused (405) once open', async () => {
  const f = fakeDeps(READY_ORDER, TWO_KIDS);
  const r = await call(new Request('https://x/', { headers: { 'x-online-year-preview': TOKEN } }), f);
  assertEquals(r.status, 405);
});

Deno.test('pending: no order recorded for the session yet', async () => {
  const f = fakeDeps({}, {});
  const r = await call(post({ session_id: SID }), f);
  assertEquals([r.status, r.json], [200, { state: 'pending' }]);
  assertEquals(r.res.headers.get('Cache-Control'), 'no-store');
  assertEquals(f.calls.listLicenses, 0);
});

Deno.test('pending: the order is recorded but its licenses are not granted yet', async () => {
  const f = fakeDeps(READY_ORDER, {});
  const r = await call(post({ session_id: SID }), f);
  assertEquals(r.json, { state: 'pending' });
});

Deno.test('ready: two children with two different end dates, in created order then by name, nothing else returned', async () => {
  const f = fakeDeps(READY_ORDER, TWO_KIDS);
  const r = await call(post({ session_id: `  ${SID} ` }), f);
  assertEquals(r.status, 200);
  assertEquals(r.json, {
    state: 'ready',
    band: 'seedlings',
    children: [
      { name: 'Ava', ends_at: '2028-03-01T15:30:00+00:00' },
      { name: 'Ben', ends_at: '2027-11-26T02:00:00+00:00' },
    ],
  });
});

Deno.test('ready: a closed license is still listed (nothing is excluded by status)', async () => {
  const lic: OnlineYearStatusLicense[] = [{ band: 'sprouts', child_name: 'Cal', ends_at: '2027-11-25T18:00:00Z', created_at: '2026-11-25T18:00:01Z' }];
  const f = fakeDeps({ [SID]: { id: 'o2', lookup_key: 'online_year_sprouts' } }, { o2: lic });
  const r = await call(post({ session_id: SID }), f);
  assertEquals(r.json, { state: 'ready', band: 'sprouts', children: [{ name: 'Cal', ends_at: '2027-11-25T18:00:00Z' }] });
});

Deno.test('a session that belongs to a NON-Online-Year order answers pending, and its licenses are never read', async () => {
  for (const lookup_key of ['sprouts_print_set', 'starter_unit_sprouts', null]) {
    const f = fakeDeps({ [SID]: { id: 'o9', lookup_key } }, { o9: TWO_KIDS.o1 });
    const r = await call(post({ session_id: SID }), f);
    assertEquals([r.status, r.json], [200, { state: 'pending' }], String(lookup_key));
    assertEquals(f.calls.listLicenses, 0);
  }
});

Deno.test('an Online Year order whose band cannot be read (online_year_cart: paid, not grantable) stays pending', async () => {
  const f = fakeDeps({ [SID]: { id: 'o3', lookup_key: 'online_year_cart' } }, { o3: TWO_KIDS.o1 });
  assertEquals((await call(post({ session_id: SID }), f)).json, { state: 'pending' });
});

Deno.test('a read error is a 500 with no detail, and is logged', async () => {
  const f = fakeDeps({}, {}, { failOrders: true });
  const r = await call(post({ session_id: SID }), f);
  assertEquals([r.status, r.json], [500, { error: 'Could not load the order right now.' }]);
  assertEquals(f.logs.length, 1);
});

Deno.test('pure pieces: session id check, band from lookup_key, licenses in another band left out', () => {
  assertEquals(isCheckoutSessionId(SID), true);
  assertEquals(isCheckoutSessionId('cs_live_' + 'A'.repeat(20)), true);
  assertEquals(isCheckoutSessionId('cs_live_' + 'A'.repeat(19)), false);
  assertEquals(onlineYearBandFromLookupKey('online_year_sprouts'), 'sprouts');
  assertEquals(onlineYearBandFromLookupKey('online_year_seedlings'), 'seedlings');
  assertEquals(onlineYearBandFromLookupKey('online_year_cart'), null);
  assertEquals(onlineYearBandFromLookupKey('online_year_sprouts_first_child'), null);
  assertEquals(onlineYearBandFromLookupKey(undefined), null);
  assertEquals(
    shapeOnlineYearStatus({ id: 'o', lookup_key: 'online_year_sprouts' }, [
      { band: 'seedlings', child_name: 'X', ends_at: '2027-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' },
    ]),
    { state: 'pending' },
  );
  assertEquals(shapeOnlineYearStatus(null, []), { state: 'pending' });
  // Different created_at: the earlier one first, whatever the names.
  assertEquals(
    shapeOnlineYearStatus({ id: 'o', lookup_key: 'online_year_sprouts' }, [
      { band: 'sprouts', child_name: 'Abe', ends_at: '2027-02-01T00:00:00Z', created_at: '2026-02-01T00:00:00Z' },
      { band: 'sprouts', child_name: 'Zoe', ends_at: '2027-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' },
    ]),
    { state: 'ready', band: 'sprouts', children: [{ name: 'Zoe', ends_at: '2027-01-01T00:00:00Z' }, { name: 'Abe', ends_at: '2027-02-01T00:00:00Z' }] },
  );
});
