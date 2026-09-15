// deno test --no-lock --allow-env supabase/functions/_shared/guide-access.test.ts
//
// Pins the emailed Deep-Dive Guide link: tokens round-trip, expire after 7 days and
// reject tampering; a link request answers identically whether or not the email
// bought the guide; a verify returns the guide only for a live order.

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  GENERIC_LINK_RESPONSE,
  GUIDE_ACCESS_TTL_SECONDS,
  GUIDE_LINK_PER_HOUR,
  guideAccessUrl,
  guideLinkEmailHtml,
  handleLinkRequest,
  handleVerify,
  parseGuideAccessBody,
  signGuideAccessToken,
  verifyGuideAccessToken,
  type LinkRequestDeps,
} from './guide-access.ts';
import { signUnsubToken, verifyUnsubToken } from './email-unsubscribe.ts';

Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
Deno.env.delete('GUIDE_ACCESS_SECRET');

const ORDER = '11111111-1111-4111-8111-111111111111';
const NOW = 1_800_000_000;

Deno.test('a token round-trips with a 7 day expiry', async () => {
  const t = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
  assertEquals(await verifyGuideAccessToken(t, NOW), {
    orderId: ORDER,
    slug: 'frozen-knot',
    expiresAt: NOW + GUIDE_ACCESS_TTL_SECONDS,
  });
  assertEquals(GUIDE_ACCESS_TTL_SECONDS, 7 * 24 * 60 * 60);
});

Deno.test('a token works up to its expiry and not after', async () => {
  const t = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
  assert(await verifyGuideAccessToken(t, NOW + GUIDE_ACCESS_TTL_SECONDS - 1));
  assertEquals(await verifyGuideAccessToken(t, NOW + GUIDE_ACCESS_TTL_SECONDS), null);
  assertEquals(await verifyGuideAccessToken(t, NOW + GUIDE_ACCESS_TTL_SECONDS + 86400), null);
});

Deno.test('editing the payload (another guide, a later expiry) is rejected', async () => {
  const t = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
  const [, sig] = t.split('.');
  for (const payload of [
    { v: 1, o: ORDER, s: 'still-water', x: NOW + GUIDE_ACCESS_TTL_SECONDS },
    { v: 1, o: ORDER, s: 'frozen-knot', x: NOW + 10 * GUIDE_ACCESS_TTL_SECONDS },
  ]) {
    const p = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assertEquals(await verifyGuideAccessToken(`${p}.${sig}`, NOW), null);
  }
});

Deno.test('garbage and non-strings are rejected without throwing', async () => {
  for (const t of ['', '.', 'abc', 'a.b.c', 'a.b', '%%%.%%%', 42, null, undefined, 'x'.repeat(5000)]) {
    assertEquals(await verifyGuideAccessToken(t, NOW), null);
  }
});

Deno.test('a token signed with a different secret is rejected', async () => {
  const t = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
  Deno.env.set('GUIDE_ACCESS_SECRET', 'a-new-secret');
  try {
    assertEquals(await verifyGuideAccessToken(t, NOW), null);
    const t2 = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
    assert(await verifyGuideAccessToken(t2, NOW));
  } finally {
    Deno.env.delete('GUIDE_ACCESS_SECRET');
  }
});

Deno.test('guide tokens and unsubscribe tokens cannot stand in for each other', async () => {
  const unsub = await signUnsubToken('a@example.com', 'constitution');
  assertEquals(await verifyGuideAccessToken(unsub, NOW), null);
  const guide = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
  assertEquals(await verifyUnsubToken(guide), null);
});

Deno.test('the token carries no email address', async () => {
  const t = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW);
  assert(!atob(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')).includes('@'));
});

Deno.test('the access URL points at the guide page', () => {
  assertEquals(guideAccessUrl('frozen-knot', 'a.b'), 'https://edeninstitute.health/guide/frozen-knot?access=a.b');
});

Deno.test('email copy: wording, button, escaped link, no em dashes', () => {
  const html = guideLinkEmailHtml('https://edeninstitute.health/guide/frozen-knot?access=a.b&x="y"');
  assert(html.includes('Here is your link to your Deep-Dive Guide. It works for 7 days, and you can request a new one any time from the guide page.'));
  assert(html.includes('>Open my guide</a>'));
  assert(html.includes('access=a.b&amp;x=&quot;y&quot;'));
  assert(!html.includes(String.fromCharCode(0x2014)), 'no em dashes');
});

const known = (s: string) => ['frozen-knot', 'still-water'].includes(s);

Deno.test('body parsing: verify, request, invalid', () => {
  assertEquals(parseGuideAccessBody({ token: 'a.b' }, known), { mode: 'verify', token: 'a.b' });
  assertEquals(parseGuideAccessBody({ email: '  Buyer@Example.com ', slug: 'Frozen-Knot' }, known), {
    mode: 'request',
    email: 'buyer@example.com',
    slug: 'frozen-knot',
  });
  assertEquals(parseGuideAccessBody({ email: 'not-an-email', slug: 'frozen-knot' }, known), { mode: 'invalid' });
  assertEquals(parseGuideAccessBody({ email: 'a@b.co', slug: 'no-such-guide' }, known), { mode: 'invalid' });
  assertEquals(parseGuideAccessBody(null, known), { mode: 'invalid' });
});

function deps(opts: { orderId: string | null; counts?: Record<string, number> }) {
  const sent: { email: string; url: string }[] = [];
  const bumped: string[] = [];
  const d: LinkRequestDeps = {
    bump: (key) => {
      bumped.push(key);
      return Promise.resolve(opts.counts?.[key.split(':')[0]] ?? 1);
    },
    findOrder: () => Promise.resolve(opts.orderId),
    sendLink: (email, url) => {
      sent.push({ email, url });
      return Promise.resolve(true);
    },
    defer: async (w) => {
      await w;
    },
  };
  return { d, sent, bumped };
}

const REQ = { email: 'buyer@example.com', slug: 'frozen-knot', ip: '203.0.113.9' };

Deno.test('no enumeration: identical response with and without a purchase', async () => {
  const buyer = deps({ orderId: ORDER });
  const stranger = deps({ orderId: null });
  const a = await handleLinkRequest(REQ, buyer.d);
  const b = await handleLinkRequest(REQ, stranger.d);
  assertEquals(a, b);
  assertEquals(a, { status: 200, body: { ...GENERIC_LINK_RESPONSE } });
  assertEquals(JSON.stringify(a.body), '{"ok":true}');

  assertEquals(buyer.sent.length, 1);
  assertEquals(buyer.sent[0].email, 'buyer@example.com');
  assert(buyer.sent[0].url.startsWith('https://edeninstitute.health/guide/frozen-knot?access='));
  const token = decodeURIComponent(buyer.sent[0].url.split('access=')[1]);
  assertEquals((await verifyGuideAccessToken(token))?.orderId, ORDER);
  assertEquals(stranger.sent.length, 0);
});

Deno.test('no enumeration: a full per-email bucket still answers ok and sends nothing', async () => {
  const x = deps({ orderId: ORDER, counts: { guide_link_email: GUIDE_LINK_PER_HOUR + 1 } });
  assertEquals(await handleLinkRequest(REQ, x.d), { status: 200, body: { ok: true } });
  assertEquals(x.sent.length, 0);
});

Deno.test('a failing lookup or send still answers ok', async () => {
  const x = deps({ orderId: ORDER });
  x.d.findOrder = () => Promise.reject(new Error('db down'));
  assertEquals(await handleLinkRequest(REQ, x.d), { status: 200, body: { ok: true } });
});

Deno.test('per-IP limit: 5 an hour, then 429 before any lookup', async () => {
  const x = deps({ orderId: ORDER, counts: { guide_link_ip: GUIDE_LINK_PER_HOUR } });
  assertEquals((await handleLinkRequest(REQ, x.d)).status, 200);
  const y = deps({ orderId: ORDER, counts: { guide_link_ip: GUIDE_LINK_PER_HOUR + 1 } });
  const r = await handleLinkRequest(REQ, y.d);
  assertEquals(r.status, 429);
  assertEquals(y.sent.length, 0);
  assertEquals(y.bumped, ['guide_link_ip:203.0.113.9']);
});

Deno.test('rate buckets are keyed per IP and per email', async () => {
  const x = deps({ orderId: null });
  await handleLinkRequest(REQ, x.d);
  assertEquals(x.bumped, ['guide_link_ip:203.0.113.9', 'guide_link_email:buyer@example.com']);
});

Deno.test('a limiter outage fails open', async () => {
  const x = deps({ orderId: ORDER });
  x.d.bump = () => Promise.resolve(null);
  assertEquals(await handleLinkRequest(REQ, x.d), { status: 200, body: { ok: true } });
  assertEquals(x.sent.length, 1);
});

Deno.test('verify returns the guide only for a valid token on a live order', async () => {
  const guide = { slug: 'frozen-knot', nickname: 'The Frozen Knot' };
  const getGuide = (s: string) => (s === 'frozen-knot' ? guide : null);
  const t = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' });

  const ok = await handleVerify(t, { orderStillValid: () => Promise.resolve(true), getGuide });
  assertEquals(ok.body.ok, true);
  assertEquals(ok.body.guide, guide);
  assertEquals(ok.body.slug, 'frozen-knot');

  const refunded = await handleVerify(t, { orderStillValid: () => Promise.resolve(false), getGuide });
  assertEquals(refunded.body, { ok: false });

  const bad = await handleVerify(t + 'x', { orderStillValid: () => Promise.resolve(true), getGuide });
  assertEquals(bad.body, { ok: false });

  const expired = await signGuideAccessToken({ orderId: ORDER, slug: 'frozen-knot' }, NOW - GUIDE_ACCESS_TTL_SECONDS * 100);
  const old = await handleVerify(expired, { orderStillValid: () => Promise.resolve(true), getGuide });
  assertEquals(old.body, { ok: false });
  assertNotEquals(expired, t);
});
