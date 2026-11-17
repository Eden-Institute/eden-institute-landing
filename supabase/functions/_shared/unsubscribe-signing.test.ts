// deno test --no-lock --allow-env supabase/functions/_shared/unsubscribe-signing.test.ts
//
// 2026-11-17, Lane 2 area 8 U2. The rules these pin:
//   - links are signed with UNSUB_SIGNING_SECRET when it is set, else the service-role key;
//   - a link verifies against EITHER key, so links sent before a key change keep working;
//   - a link that names an email and a list but is signed by no key we hold is told apart
//     ("bad_signature", the founder hears about it) from garbage ("malformed", silence);
//   - the founder alert key is per person, list and UTC day and never carries the address;
//   - the alert has no em dashes.
//
// Every test sets the env it needs: Deno runs tests in this file in order, sharing env.

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkUnsubToken, signUnsubToken, unsubSigningSecrets, verifyUnsubToken } from './email-unsubscribe.ts';
import { badLinkAlert, badLinkAlertKey } from './unsubscribe-request.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');

function useKeys(unsub: string | null, service: string | null) {
  if (unsub === null) Deno.env.delete('UNSUB_SIGNING_SECRET');
  else Deno.env.set('UNSUB_SIGNING_SECRET', unsub);
  if (service === null) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', service);
}

Deno.test('with no UNSUB_SIGNING_SECRET, links are signed and verified with the service-role key (old behaviour)', async () => {
  useKeys(null, 'service-key-A');
  assertEquals(unsubSigningSecrets(), ['service-key-A']);
  const t = await signUnsubToken('Mom@Example.com', 'homeschool');
  assertEquals(await verifyUnsubToken(t), { email: 'mom@example.com', list: 'homeschool' });
});

Deno.test('UNSUB_SIGNING_SECRET set to the same value as the service key signs byte-identical links', async () => {
  useKeys(null, 'service-key-A');
  const before = await signUnsubToken('mom@example.com', 'homeschool');
  useKeys('service-key-A', 'service-key-A');
  assertEquals(unsubSigningSecrets(), ['service-key-A']);
  assertEquals(await signUnsubToken('mom@example.com', 'homeschool'), before);
});

Deno.test('after the service key rotates, links signed before still verify through UNSUB_SIGNING_SECRET', async () => {
  useKeys(null, 'service-key-A');
  const oldLink = await signUnsubToken('mom@example.com', 'constitution');
  // The day of this change: UNSUB_SIGNING_SECRET is set to the then-current service key.
  // Later the service key rotates to B.
  useKeys('service-key-A', 'service-key-B');
  assertEquals(await verifyUnsubToken(oldLink), { email: 'mom@example.com', list: 'constitution' });
  // New links are signed with UNSUB_SIGNING_SECRET, so they match the old ones exactly.
  assertEquals(await signUnsubToken('mom@example.com', 'constitution'), oldLink);
});

Deno.test('a link signed with the current service key also verifies (either key works)', async () => {
  useKeys(null, 'service-key-B');
  const t = await signUnsubToken('dad@example.com', 'podcast');
  useKeys('service-key-A', 'service-key-B');
  assertEquals(await verifyUnsubToken(t), { email: 'dad@example.com', list: 'podcast' });
});

Deno.test('a real-looking link signed by a key we no longer hold is bad_signature, with its email and list', async () => {
  useKeys(null, 'gone-key');
  const t = await signUnsubToken('mom@example.com', 'homeschool');
  useKeys('service-key-A', 'service-key-B');
  assertEquals(await verifyUnsubToken(t), null);
  assertEquals(await checkUnsubToken(t), { ok: false, reason: 'bad_signature', email: 'mom@example.com', list: 'homeschool' });
});

Deno.test('a tampered email or list is bad_signature, never accepted', async () => {
  useKeys('service-key-A', 'service-key-A');
  const t = await signUnsubToken('mom@example.com', 'homeschool');
  const sig = t.slice(t.indexOf('.') + 1);
  const forged = btoa(JSON.stringify({ e: 'someone@else.com', l: 'homeschool' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const c = await checkUnsubToken(`${forged}.${sig}`);
  assertEquals(c.ok, false);
  assertEquals(!c.ok && c.reason, 'bad_signature');
});

Deno.test('garbage, empty, truncated or unknown-list tokens are malformed (no alert)', async () => {
  useKeys('service-key-A', 'service-key-A');
  const unknownList = btoa(JSON.stringify({ e: 'mom@example.com', l: 'everything' })).replace(/=+$/, '');
  for (const t of ['', 'abc', '.sig', 'not-base64!.sig', `${unknownList}.sig`]) {
    assertEquals(await checkUnsubToken(t), { ok: false, reason: 'malformed' }, t);
  }
  const good = await signUnsubToken('mom@example.com', 'homeschool');
  assertEquals((await checkUnsubToken(good.slice(0, good.indexOf('.')))).ok, false);
});

Deno.test('with neither key set, signing throws (never signs with an empty key)', async () => {
  useKeys(null, null);
  let threw = false;
  try {
    await signUnsubToken('mom@example.com', 'homeschool');
  } catch {
    threw = true;
  }
  assert(threw);
  useKeys('service-key-A', 'service-key-A');
});

Deno.test('alert key: per person, list and UTC day; no address in it; case-insensitive email', async () => {
  const day1 = Date.UTC(2026, 10, 17, 23, 59);
  const day2 = Date.UTC(2026, 10, 18, 0, 1);
  const k = await badLinkAlertKey('Mom@Example.com', 'homeschool', day1);
  assert(/^unsubscribe\/bad-link\/2026-11-17\/[0-9a-f]{16}$/.test(k), k);
  assert(!k.includes('example'), k);
  assertEquals(await badLinkAlertKey('mom@example.com ', 'homeschool', day1), k);
  assertNotEquals(await badLinkAlertKey('mom@example.com', 'constitution', day1), k);
  assertNotEquals(await badLinkAlertKey('mom@example.com', 'homeschool', day2), k);
  assert(k.length <= 256);
});

Deno.test('alert names the email, list and how they asked; tells her what to do; no em dashes', () => {
  const a = badLinkAlert({ email: 'Mom@Example.com', list: 'homeschool', listName: 'the homeschool preview emails', via: 'one_click' });
  assertEquals(a.subject, 'Eden alert: an unsubscribe was NOT saved');
  assert(a.text.includes('Email: mom@example.com'));
  assert(a.text.includes('List: the homeschool preview emails (homeschool)'));
  assert(a.text.includes('one-click'));
  assert(a.text.includes('email_list_unsubscribes (list homeschool)'));
  const b = badLinkAlert({ email: 'x@y.com', list: 'cart', listName: 'checkout reminder emails', via: 'form_post' });
  assert(b.text.includes('on our unsubscribe page'));
  for (const s of [a.subject, a.text, b.text]) assert(!/[—–]/.test(s), s);
});
