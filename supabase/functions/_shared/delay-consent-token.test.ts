// Run with:
//   SUPABASE_SERVICE_ROLE_KEY=test-key deno test --allow-env supabase/functions/_shared/delay-consent-token.test.ts
//
// These tokens are the only thing standing between a stranger and cancelling someone
// else's order, so the tamper cases matter more than the happy path.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { signDelayToken, verifyDelayToken } from './delay-consent-token.ts';

Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-signing-key');

const PAYLOAD = {
  o: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  r: 'consented' as const,
};

Deno.test('a signed token round-trips', async () => {
  const t = await signDelayToken(PAYLOAD);
  assertEquals(await verifyDelayToken(t), PAYLOAD);
});

Deno.test('consent and cancel tokens differ and keep their meaning', async () => {
  const yes = await signDelayToken({ ...PAYLOAD, r: 'consented' });
  const no = await signDelayToken({ ...PAYLOAD, r: 'cancelled' });
  assert(yes !== no, 'the two responses must not produce the same token');
  assertEquals((await verifyDelayToken(no))?.r, 'cancelled');
});

Deno.test('editing the payload to target another order is rejected', async () => {
  // The attack this exists to stop: take your own valid link, swap the order id.
  const t = await signDelayToken(PAYLOAD);
  const [p, sig] = t.split('.');
  const decoded = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  decoded.o = '33333333-3333-4333-8333-333333333333';
  const forged = btoa(JSON.stringify(decoded))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assertEquals(await verifyDelayToken(`${forged}.${sig}`), null);
});

Deno.test('flipping consent to cancellation is rejected', async () => {
  const t = await signDelayToken({ ...PAYLOAD, r: 'consented' });
  const [p, sig] = t.split('.');
  const decoded = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  decoded.r = 'cancelled';
  const forged = btoa(JSON.stringify(decoded))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assertEquals(await verifyDelayToken(`${forged}.${sig}`), null);
});

Deno.test('a tampered signature is rejected', async () => {
  const t = await signDelayToken(PAYLOAD);
  const [p] = t.split('.');
  assertEquals(await verifyDelayToken(`${p}.AAAA`), null);
});

Deno.test('malformed tokens return null rather than throwing', async () => {
  for (const bad of ['', '.', 'nodot', 'a.b.c', '!!!.???']) {
    assertEquals(await verifyDelayToken(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

Deno.test('a token signed with a different key is rejected', async () => {
  const t = await signDelayToken(PAYLOAD);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'a-different-key');
  try {
    assertEquals(await verifyDelayToken(t), null);
  } finally {
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-signing-key');
  }
});

Deno.test('an unknown response value is rejected even if correctly signed', async () => {
  // Signed by us, but not a value the endpoint knows how to act on.
  const json = JSON.stringify({ ...PAYLOAD, r: 'refunded' });
  const t = await signDelayToken(JSON.parse(json));
  assertEquals(await verifyDelayToken(t), null);
});
