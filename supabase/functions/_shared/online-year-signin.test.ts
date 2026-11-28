// Tests for online-year-signin.ts (OY4, punch #472). Run: deno test --no-lock --allow-env supabase/functions/_shared/
import { assert, assertEquals, assertMatch, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildSigninCodeEmail,
  codeHash,
  deviceLimit,
  handleOnlineYearSignin,
  likeExact,
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_REQUESTS_PER_IP_PER_HOUR,
  newCode,
  sha256Hex,
  type SigninCode,
  type SigninDeps,
  type SigninDevice,
  type SigninLicense,
  type SigninParent,
} from './online-year-signin.ts';

const T0 = new Date('2026-12-01T15:00:00Z');
const DAY = 86_400_000;
const lic = (over: Partial<SigninLicense> = {}): SigninLicense => ({
  id: crypto.randomUUID(), band: 'sprouts', child_name: 'Ada', kind: 'first_child',
  starts_at: new Date(T0.getTime() - 30 * DAY).toISOString(), ends_at: new Date(T0.getTime() + 300 * DAY).toISOString(),
  status: 'active', ...over,
});

class World {
  now = new Date(T0);
  parents: SigninParent[] = [{ id: 'p1', email: 'Mom@Example.com', first_name: 'Ruth', license_name: 'Ruth Smith' }];
  licenses: Record<string, SigninLicense[]> = { p1: [lic()] };
  codes: (SigninCode & { email_lower: string; created_at: string })[] = [];
  devices: (SigninDevice & { token_hash: string; signed_out_reason: string | null })[] = [];
  sent: { to: string; firstName: string | null; code: string }[] = [];
  buckets: Record<string, number> = {};
  env: Record<string, string> = { ONLINE_YEAR_ENABLED: 'true' };
  ip = '203.0.113.9';

  deps(): SigninDeps {
    return {
      cors: { 'Access-Control-Allow-Origin': '*' },
      now: () => new Date(this.now),
      env: (k) => this.env[k],
      ip: this.ip,
      bumpRate: async (k) => (this.buckets[k] = (this.buckets[k] ?? 0) + 1),
      findParentByEmail: async (e) => this.parents.find((p) => p.email.toLowerCase() === e) ?? null,
      findParentById: async (id) => this.parents.find((p) => p.id === id) ?? null,
      listLicenses: async (pid) => this.licenses[pid] ?? [],
      recentCodes: async (e, since) =>
        this.codes.filter((c) => c.email_lower === e && c.created_at >= since).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      insertCode: async (r) => {
        this.codes.push({ id: crypto.randomUUID(), code_hash: r.code_hash, expires_at: r.expires_at, attempts: 0, used_at: null, email_lower: r.email_lower, created_at: this.now.toISOString() });
      },
      bumpCodeAttempts: async (id) => ++this.codes.find((c) => c.id === id)!.attempts,
      useCode: async (id, at) => {
        const c = this.codes.find((x) => x.id === id)!;
        if (c.used_at) return false;
        c.used_at = at;
        return true;
      },
      sendCodeEmail: async (to, firstName, code) => (this.sent.push({ to, firstName, code }), true),
      liveDevices: async (pid) => this.devices.filter((d) => d.parent_id === pid && !d.signed_out_at).sort((a, b) => a.last_seen_at.localeCompare(b.last_seen_at)),
      insertDevice: async (r) => {
        this.devices.push({ id: crypto.randomUUID(), parent_id: r.parent_id, token_hash: r.token_hash, last_seen_at: this.now.toISOString(), signed_out_at: null, signed_out_reason: null });
      },
      signOutDevice: async (id, reason, at) => {
        const d = this.devices.find((x) => x.id === id)!;
        d.signed_out_at = at;
        d.signed_out_reason = reason;
      },
      findDeviceByTokenHash: async (h) => this.devices.find((d) => d.token_hash === h) ?? null,
      touchDevice: async (id, at) => {
        this.devices.find((d) => d.id === id)!.last_seen_at = at;
      },
      signUrls: async (paths, seconds) => paths.map((p) => `signed:${seconds}:${p}`),
      defer: async (w) => {
        await w;
      },
    };
  }

  async call(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    const res = await handleOnlineYearSignin(
      new Request('https://x/online-year-signin', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }),
      this.deps(),
    );
    return { status: res.status, body: await res.json() };
  }
  tick(ms: number) {
    this.now = new Date(this.now.getTime() + ms);
  }
  /** Request a code for Mom and return what was emailed. */
  async codeFor(email = 'mom@example.com') {
    const before = this.sent.length;
    await this.call({ action: 'request', email });
    return this.sent.length > before ? this.sent[this.sent.length - 1].code : null;
  }
  async signIn(label?: string) {
    const code = (await this.codeFor())!;
    this.tick(1000);
    return this.call({ action: 'verify', email: 'mom@example.com', code, label });
  }
}

Deno.test('dark: 404 not_found until ONLINE_YEAR_ENABLED, for every action', async () => {
  const w = new World();
  w.env = {};
  for (const action of ['request', 'verify', 'session', 'signout']) {
    const r = await w.call({ action, email: 'mom@example.com' });
    assertEquals(r.status, 404);
    assertEquals(r.body, { error: 'not_found' });
  }
  assertEquals(w.sent.length, 0);
});

Deno.test('dark: the preview header opens it (24+ character token only)', async () => {
  const w = new World();
  w.env = { ONLINE_YEAR_PREVIEW_TOKEN: 'p'.repeat(32) };
  assertEquals((await w.call({ action: 'request', email: 'mom@example.com' }, { 'x-online-year-preview': 'p'.repeat(32) })).status, 200);
  assertEquals((await w.call({ action: 'request', email: 'mom@example.com' }, { 'x-online-year-preview': 'wrong' })).status, 404);
});

Deno.test('request: the same { ok: true } for a family and a stranger; only the family gets a code', async () => {
  const w = new World();
  const a = await w.call({ action: 'request', email: '  MOM@example.COM ' });
  const b = await w.call({ action: 'request', email: 'stranger@example.com' });
  assertEquals(a, { status: 200, body: { ok: true } });
  assertEquals(b, { status: 200, body: { ok: true } });
  assertEquals(w.sent.length, 1);
  assertEquals(w.sent[0].to, 'Mom@Example.com');
  assertMatch(w.sent[0].code, /^\d{6}$/);
  // Only a hash is kept, bound to the address.
  assertEquals(w.codes[0].code_hash, await codeHash('mom@example.com', w.sent[0].code));
  assertNotEquals(w.codes[0].code_hash, w.sent[0].code);
});

Deno.test('request: a refunded or disputed family (no active license) gets no code, same answer', async () => {
  const w = new World();
  w.licenses.p1 = [lic({ status: 'closed' })];
  assertEquals((await w.call({ action: 'request', email: 'mom@example.com' })).body, { ok: true });
  assertEquals(w.sent.length, 0);
});

Deno.test('request: an ended year can still sign in (to see the approved "Year ended" screen)', async () => {
  const w = new World();
  w.licenses.p1 = [lic({ ends_at: new Date(T0.getTime() - DAY).toISOString() })];
  assert(await w.codeFor());
});

Deno.test('request: per-email hourly limit sends nothing more but answers the same', async () => {
  const w = new World();
  for (let i = 0; i < MAX_CODES_PER_EMAIL_PER_HOUR; i++) assert(await w.codeFor());
  const r = await w.call({ action: 'request', email: 'mom@example.com' });
  assertEquals(r.body, { ok: true });
  assertEquals(w.sent.length, MAX_CODES_PER_EMAIL_PER_HOUR);
});

Deno.test('request: per-IP limit answers 429 RATE_LIMITED; a bad address answers EMAIL_INVALID', async () => {
  const w = new World();
  for (let i = 0; i < MAX_REQUESTS_PER_IP_PER_HOUR; i++) await w.call({ action: 'request', email: `x${i}@example.com` });
  // T0 is 15:00:00 UTC on the hour, so the limit lifts a full hour later.
  assertEquals((await w.call({ action: 'request', email: 'mom@example.com' })).body, { error: 'RATE_LIMITED', retry_after_seconds: 3600 });
  w.tick(23 * 60_000 + 5_000);
  assertEquals((await w.call({ action: 'request', email: 'mom@example.com' })).body.retry_after_seconds, 3600 - 23 * 60 - 5);
  assertEquals((await new World().call({ action: 'request', email: 'not-an-email' })).body, { error: 'EMAIL_INVALID' });
});

Deno.test('verify: the right code signs in once; the token is random and only its hash is stored', async () => {
  const w = new World();
  const code = (await w.codeFor())!;
  const r = await w.call({ action: 'verify', email: 'mom@example.com', code: `${code.slice(0, 3)} ${code.slice(3)}` });
  assertEquals(r.status, 200);
  assertMatch(r.body.token, /^[A-Za-z0-9_-]{43}$/);
  assertEquals(r.body.first_name, 'Ruth');
  assertEquals(w.devices.length, 1);
  assertEquals(w.devices[0].token_hash, await sha256Hex(r.body.token));
  // The same code never works twice.
  assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code })).body, { error: 'CODE_INVALID' });
});

Deno.test('verify: wrong guesses count; the 5th wrong guess kills the code, even for the right one after', async () => {
  const w = new World();
  const code = (await w.codeFor())!;
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 1; i < MAX_CODE_ATTEMPTS; i++) assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code: wrong })).body.error, 'CODE_INVALID');
  assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code: wrong })).body.error, 'TOO_MANY_ATTEMPTS');
  assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code })).body.error, 'TOO_MANY_ATTEMPTS');
  assertEquals(w.devices.length, 0);
});

Deno.test('verify: a code stops working after 10 minutes, and a newer code retires the older one', async () => {
  const w = new World();
  const old = (await w.codeFor())!;
  w.tick(11 * 60_000);
  assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code: old })).body.error, 'CODE_INVALID');
  const a = (await w.codeFor())!;
  w.tick(1000);
  const b = (await w.codeFor())!;
  if (a !== b) assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code: a })).body.error, 'CODE_INVALID');
  assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code: b })).status, 200);
});

Deno.test('verify: a stranger with a guessed code gets the same CODE_INVALID', async () => {
  const w = new World();
  assertEquals((await w.call({ action: 'verify', email: 'stranger@example.com', code: '123456' })).body, { error: 'CODE_INVALID' });
  assertEquals((await w.call({ action: 'verify', email: 'mom@example.com', code: '12345' })).body, { error: 'CODE_INVALID' });
});

Deno.test('device limit: 3 with one child, +1 per additional live license, ended or refunded ones add nothing', () => {
  assertEquals(deviceLimit([lic()], T0), 3);
  assertEquals(deviceLimit([lic(), lic({ kind: 'sibling', child_name: 'Ben' })], T0), 4);
  assertEquals(deviceLimit([lic(), lic({ kind: 'sibling' }), lic({ band: 'seedlings', child_name: 'Cy' })], T0), 5);
  assertEquals(deviceLimit([lic(), lic({ kind: 'sibling', status: 'closed' })], T0), 3);
  assertEquals(deviceLimit([lic(), lic({ kind: 'sibling', ends_at: new Date(T0.getTime() - DAY).toISOString() })], T0), 3);
  assertEquals(deviceLimit([lic({ ends_at: new Date(T0.getTime() - DAY).toISOString() })], T0), 3);
});

Deno.test('device limit: the 4th device sees AT_LIMIT (code kept); "Sign in here" signs out the one used longest ago', async () => {
  const w = new World();
  for (let i = 0; i < 3; i++) {
    assertEquals((await w.signIn(`device ${i}`)).status, 200);
    w.tick(60_000);
  }
  // Device 1 was used most recently after device 0, so device 0 is the one used longest ago... make device 1 the oldest instead.
  w.devices[1].last_seen_at = new Date(T0.getTime() - DAY).toISOString();
  const code = (await w.codeFor())!;
  const first = await w.call({ action: 'verify', email: 'mom@example.com', code });
  assertEquals(first, { status: 409, body: { error: 'AT_LIMIT', devices: 3, limit: 3 } });
  assertEquals(w.codes[w.codes.length - 1].used_at, null);
  const second = await w.call({ action: 'verify', email: 'mom@example.com', code, confirm: true });
  assertEquals(second.status, 200);
  const live = w.devices.filter((d) => !d.signed_out_at);
  assertEquals(live.length, 3);
  assertEquals(w.devices[1].signed_out_reason, 'limit');
  assertEquals(w.devices.filter((d) => d.signed_out_reason === 'limit').length, 1);
});

Deno.test('device limit: a sibling license makes room for a 4th device without signing anyone out', async () => {
  const w = new World();
  w.licenses.p1.push(lic({ kind: 'sibling', child_name: 'Ben' }));
  for (let i = 0; i < 4; i++) assertEquals((await w.signIn()).status, 200);
  assertEquals(w.devices.filter((d) => !d.signed_out_at).length, 4);
});

Deno.test('session: a live token returns the family and its licenses and marks the device seen; signout ends it', async () => {
  const w = new World();
  const { body } = await w.signIn();
  w.tick(5 * 60_000);
  const s = await w.call({ action: 'session', token: body.token });
  assertEquals(s.status, 200);
  assertEquals(s.body.parent, { first_name: 'Ruth', license_name: 'Ruth Smith', email: 'Mom@Example.com' });
  assertEquals(s.body.licenses.length, 1);
  assertEquals(s.body.device_limit, 3);
  assertEquals(w.devices[0].last_seen_at, w.now.toISOString());
  assertEquals((await w.call({ action: 'signout', token: body.token })).body, { ok: true });
  assertEquals(w.devices[0].signed_out_reason, 'user');
  assertEquals((await w.call({ action: 'session', token: body.token })).body, { error: 'SIGNED_OUT' });
});

Deno.test('session: a refund (license closed) signs every device out at the next look', async () => {
  const w = new World();
  const { body } = await w.signIn();
  w.licenses.p1 = w.licenses.p1.map((l) => ({ ...l, status: 'closed' }));
  assertEquals((await w.call({ action: 'session', token: body.token })).status, 401);
  assertEquals((await w.call({ action: 'session', token: 'x'.repeat(10) })).body, { error: 'SIGNED_OUT' });
});

Deno.test('likeExact escapes the ilike pattern characters, so an address matches only itself', () => {
  assertEquals(likeExact('a_b%c\\d@x.com'), 'a\\_b\\%c\\\\d@x.com');
  assertEquals(likeExact('plain@example.com'), 'plain@example.com');
});

Deno.test('newCode: always six digits, any byte pattern', () => {
  let i = 0;
  const seq = [[255, 255, 255, 255], [0, 0, 0, 7], [1, 2, 3, 4]];
  assertEquals(newCode(() => new Uint8Array(seq[i++])), '000007');
  for (let k = 0; k < 200; k++) assertMatch(newCode(), /^\d{6}$/);
});

Deno.test('the sign-in code email is the approved "Email 5", word for word, with no links', () => {
  const m = buildSigninCodeEmail('Ruth', '042917', 'Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043');
  assertEquals(m.subject, 'Your Eden sign-in code: 042917');
  assert(m.html.includes('It works for the next 10 minutes.</div>'), 'preview line');
  for (const line of [
    'Hi Ruth,',
    "Here's your code to sign in to your Online Year: 042917",
    "It works for the next 10 minutes. If you didn't ask for it, you can ignore this email; nobody can get in without it.",
    'Camila',
    'The Eden Institute',
    "You're getting this because someone asked to sign in to your Online Year. Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043",
  ]) assert(m.text.includes(line), line);
  assert(!/href=/i.test(m.html), 'no links');
  assert(!/—/.test(m.html + m.text), 'no em dashes');
  assert(buildSigninCodeEmail(null, '000001', 'x').text.startsWith('Hi,'));
  assert(buildSigninCodeEmail('<b>', '000001', 'x').html.includes('Hi &lt;b&gt;,'));
});

// ── OY5 reader: signed page links ────────────────────────────────────────────────────────────────────────

Deno.test('pages: a signed-in family with a live Sprouts year gets short-lived links, in order, with the book size', async () => {
  const w = new World();
  const { body } = await w.signIn();
  const r = await w.call({ action: 'pages', token: body.token, band: 'sprouts', book: 'tg', from: 13, to: 18 });
  assertEquals(r.status, 200);
  assertEquals(r.body.total, 240);
  assertEquals(r.body.expires_in, 600);
  assertEquals(r.body.pages.map((p: { page: number }) => p.page), [13, 14, 15, 16, 17, 18]);
  assertEquals(r.body.pages[0].url, 'signed:600:reader/sprouts/tg/p013.webp');
  const ra = await w.call({ action: 'pages', token: body.token, band: 'sprouts', book: 'ra', from: 112, to: 112 });
  assertEquals(ra.body.pages[0].url, 'signed:600:reader/sprouts/ra/p112.webp');
});

Deno.test('pages: another band, an ended year, a refund, a sibling-only license and a signed-out device get nothing', async () => {
  const w = new World();
  const { body } = await w.signIn();
  assertEquals((await w.call({ action: 'pages', token: body.token, band: 'seedlings', book: 'tg', from: 1, to: 2 })).body, { error: 'NO_LICENSE' });
  w.licenses.p1 = [lic({ ends_at: new Date(T0.getTime() - DAY).toISOString() })];
  assertEquals((await w.call({ action: 'pages', token: body.token, band: 'sprouts', book: 'tg', from: 1, to: 2 })).body, { error: 'YEAR_ENDED' });
  w.licenses.p1 = [lic({ status: 'closed' }), lic({ kind: 'sibling', child_name: 'Ben' })];
  assertEquals((await w.call({ action: 'pages', token: body.token, band: 'sprouts', book: 'tg', from: 1, to: 2 })).body, { error: 'YEAR_ENDED' });
  w.licenses.p1 = [lic()];
  await w.call({ action: 'signout', token: body.token });
  assertEquals((await w.call({ action: 'pages', token: body.token, band: 'sprouts', book: 'tg', from: 1, to: 2 })).body, { error: 'SIGNED_OUT' });
});

Deno.test('pages: at most 12 pages a call, inside the book, and only real bands and books', async () => {
  const w = new World();
  const { body } = await w.signIn();
  const bad = (x: Record<string, unknown>) => w.call({ action: 'pages', token: body.token, band: 'sprouts', book: 'tg', from: 1, to: 2, ...x });
  assertEquals((await bad({ from: 1, to: 13 })).body, { error: 'BAD_REQUEST' });
  assertEquals((await bad({ from: 0, to: 1 })).body, { error: 'BAD_REQUEST' });
  assertEquals((await bad({ from: 240, to: 241 })).body, { error: 'BAD_REQUEST' });
  assertEquals((await bad({ from: 5, to: 4 })).body, { error: 'BAD_REQUEST' });
  assertEquals((await bad({ band: 'cultivators' })).body, { error: 'BAD_REQUEST' });
  assertEquals((await bad({ book: 'nb' })).body, { error: 'BAD_REQUEST' });
  assertEquals((await bad({ from: 1, to: 12 })).status, 200);
  assertEquals((await bad({ from: 229, to: 240 })).status, 200);
});
