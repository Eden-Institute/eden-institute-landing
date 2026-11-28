// Tests for online-year-family.ts (OY6 + OY7, punch #472).
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { centralDate, handleOnlineYearFamily, notebookLicenseLine, notebookMasterPath, notebookPrintPath, type FamilyDeps } from './online-year-family.ts';
import { sha256Hex, type SigninLicense } from './online-year-signin.ts';

const T0 = new Date('2026-12-01T15:00:00Z');
const DAY = 86_400_000;
const TOKEN = 'a'.repeat(43);
const L1 = '11111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

class World {
  now = new Date(T0);
  env: Record<string, string> = { ONLINE_YEAR_ENABLED: 'true' };
  signedOut: string | null = null;
  licenses: SigninLicense[] = [
    { id: L1, band: 'sprouts', child_name: 'Ada', kind: 'first_child', starts_at: T0.toISOString(), ends_at: new Date(T0.getTime() + 365 * DAY).toISOString(), status: 'active' },
    { id: L2, band: 'sprouts', child_name: 'Ben', kind: 'sibling', starts_at: T0.toISOString(), ends_at: new Date(T0.getTime() + 365 * DAY).toISOString(), status: 'active' },
  ];
  store = new Map<string, Uint8Array>([[notebookMasterPath('sprouts', 1), new Uint8Array([1, 2, 3])]]);
  stamps: { line: string; name: string | null; email: string }[] = [];
  done: { license_id: string; week: number; done_on: string }[] = [];

  deps(): FamilyDeps {
    return {
      cors: {},
      now: () => new Date(this.now),
      env: (k) => this.env[k],
      findDeviceByTokenHash: async (h) =>
        h === (await sha256Hex(TOKEN)) ? { id: 'd1', parent_id: 'p1', last_seen_at: T0.toISOString(), signed_out_at: this.signedOut } : null,
      findParentById: async () => ({ id: 'p1', email: 'ruth@example.com', first_name: 'Ruth', license_name: 'Ruth Smith' }),
      listLicenses: async () => this.licenses,
      touchDevice: async () => {},
      exists: async (p) => this.store.has(p),
      download: async (p) => {
        const b = this.store.get(p);
        if (!b) throw new Error(`missing ${p}`);
        return b;
      },
      upload: async (p, b) => void this.store.set(p, b),
      signUrl: async (p, s) => `signed:${s}:${p}`,
      stamp: async (m, o) => {
        this.stamps.push({ line: o.licenseLine, name: o.purchaserName, email: o.email });
        return new Uint8Array([...m, 9]);
      },
      listDone: async (ids) => this.done.filter((d) => ids.includes(d.license_id)),
      markDone: async (id, week, on) => {
        if (!this.done.some((d) => d.license_id === id && d.week === week)) this.done.push({ license_id: id, week, done_on: on });
      },
    };
  }
  async call(body: Record<string, unknown>) {
    const res = await handleOnlineYearFamily(new Request('https://x', { method: 'POST', body: JSON.stringify({ token: TOKEN, ...body }) }), this.deps());
    return { status: res.status, body: await res.json() };
  }
}

Deno.test('dark: 404 for every action until ONLINE_YEAR_ENABLED', async () => {
  const w = new World();
  w.env = {};
  for (const action of ['print', 'done', 'progress']) assertEquals((await w.call({ action, license_id: L1, week: 1 })).status, 404);
});

Deno.test("print: stamps the child's week once with both names, keeps it, and reprints without stamping again", async () => {
  const w = new World();
  const a = await w.call({ action: 'print', license_id: L1, week: 1 });
  assertEquals(a, { status: 200, body: { url: `signed:600:${notebookPrintPath(L1, 1)}`, expires_in: 600 } });
  assertEquals(w.stamps, [{ line: "Ada's Notebook pages · for use at home", name: 'Ruth Smith', email: 'ruth@example.com' }]);
  assertEquals(w.store.get(notebookPrintPath(L1, 1)), new Uint8Array([1, 2, 3, 9]));
  await w.call({ action: 'print', license_id: L1, week: 1 });
  assertEquals(w.stamps.length, 1);
  // A sibling gets their own copy with their own name.
  await w.call({ action: 'print', license_id: L2, week: 1 });
  assertEquals(w.stamps[1].line, "Ben's Notebook pages · for use at home");
});

Deno.test("print/done: another family's license, an ended year, a signed-out device and bad input are refused", async () => {
  const w = new World();
  assertEquals((await w.call({ action: 'print', license_id: OTHER, week: 1 })).body, { error: 'YEAR_ENDED' });
  w.licenses[0] = { ...w.licenses[0], ends_at: new Date(T0.getTime() - DAY).toISOString() };
  assertEquals((await w.call({ action: 'print', license_id: L1, week: 1 })).body, { error: 'YEAR_ENDED' });
  assertEquals((await w.call({ action: 'done', license_id: L1, week: 1 })).body, { error: 'YEAR_ENDED' });
  assertEquals((await w.call({ action: 'print', license_id: L2, week: 37 })).body, { error: 'BAD_REQUEST' });
  assertEquals((await w.call({ action: 'print', license_id: 'nope', week: 1 })).body, { error: 'BAD_REQUEST' });
  w.signedOut = T0.toISOString();
  assertEquals((await w.call({ action: 'progress' })).body, { error: 'SIGNED_OUT' });
});

Deno.test('done: dated in Central time; the first date a week was done is the one kept', async () => {
  const w = new World();
  w.now = new Date('2026-12-02T03:30:00Z'); // still Dec 1 in Central
  assertEquals((await w.call({ action: 'done', license_id: L1, week: 1 })).body, { license_id: L1, week: 1, done_on: '2026-12-01' });
  w.now = new Date('2026-12-05T15:00:00Z');
  await w.call({ action: 'done', license_id: L1, week: 1 });
  assertEquals(w.done, [{ license_id: L1, week: 1, done_on: '2026-12-01' }]);
});

Deno.test('progress: every active license with its done weeks in order; ended years keep their log', async () => {
  const w = new World();
  await w.call({ action: 'done', license_id: L1, week: 2 });
  await w.call({ action: 'done', license_id: L1, week: 1 });
  w.licenses[1] = { ...w.licenses[1], ends_at: new Date(T0.getTime() - DAY).toISOString() };
  const r = await w.call({ action: 'progress' });
  assertEquals(r.status, 200);
  assertEquals(r.body.licenses.length, 2);
  assertEquals(r.body.licenses[0].child_name, 'Ada');
  assertEquals(r.body.licenses[0].done.map((d: { week: number }) => d.week), [1, 2]);
  assertEquals(r.body.licenses[1].done, []);
});

Deno.test('helpers', () => {
  assertEquals(notebookMasterPath('seedlings', 7), 'nb/seedlings/W07.pdf');
  assertEquals(notebookLicenseLine('Ada'), "Ada's Notebook pages · for use at home");
  assertEquals(centralDate(new Date('2026-07-04T04:59:00Z')), '2026-07-03');
});
