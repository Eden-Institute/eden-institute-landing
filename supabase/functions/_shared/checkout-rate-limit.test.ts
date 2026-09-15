// Run with: deno test supabase/functions/_shared/checkout-rate-limit.test.ts
//
// Covers the pure request-parsing half of the checkout limiter plus its fail-open
// contract. The counter itself is a SQL function and is not exercised here.
//
// clientIp deserves tests despite looking trivial: getting the header precedence
// wrong is silent. Taking the RIGHT-most x-forwarded-for entry keys every visitor to
// Supabase's proxy, which would collapse all traffic onto one bucket and rate-limit
// the whole internet as a single client. Preferring the left-most x-forwarded-for
// entry over cf-connecting-ip lets a client choose its own bucket, because that
// entry is whatever the client sent.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { clientIp, enforceCheckoutRateLimit } from './checkout-rate-limit.ts';

const reqWith = (headers: Record<string, string>) =>
  new Request('https://example.test/create-checkout', { method: 'POST', headers });

Deno.test('clientIp prefers cf-connecting-ip over a client-supplied x-forwarded-for', () => {
  assertEquals(
    clientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7', 'cf-connecting-ip': '203.0.113.7' })),
    '203.0.113.7',
  );
});

Deno.test('without cf-connecting-ip, clientIp takes the left-most x-forwarded-for entry', () => {
  assertEquals(
    clientIp(reqWith({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })),
    '203.0.113.7',
  );
});

Deno.test('clientIp trims whitespace around the entry', () => {
  assertEquals(clientIp(reqWith({ 'x-forwarded-for': '  203.0.113.7 , 70.41.3.18' })), '203.0.113.7');
});

Deno.test('clientIp uses cf-connecting-ip alone, and falls back to x-real-ip last', () => {
  assertEquals(clientIp(reqWith({ 'cf-connecting-ip': '198.51.100.4' })), '198.51.100.4');
  assertEquals(clientIp(reqWith({ 'x-real-ip': '198.51.100.9' })), '198.51.100.9');
});

Deno.test('an empty cf-connecting-ip falls through to x-forwarded-for', () => {
  assertEquals(clientIp(reqWith({ 'cf-connecting-ip': '', 'x-forwarded-for': '203.0.113.7' })), '203.0.113.7');
});

Deno.test('clientIp returns null when no forwarding header is present', () => {
  assertEquals(clientIp(reqWith({})), null);
});

Deno.test('an empty x-forwarded-for does not produce an empty-string key', () => {
  // An empty key would bucket every such caller together; null makes the caller allow.
  assertEquals(clientIp(reqWith({ 'x-forwarded-for': '' })), null);
});

Deno.test('no usable IP allows the request rather than blocking everyone', async () => {
  const db = { rpc: () => Promise.resolve({ data: 1, error: null }) };
  const r = await enforceCheckoutRateLimit(db, reqWith({}));
  assertEquals(r.allowed, true);
  assertEquals(r.count, null);
});

Deno.test('an RPC error fails OPEN', async () => {
  const db = { rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }) };
  const r = await enforceCheckoutRateLimit(db, reqWith({ 'x-forwarded-for': '203.0.113.7' }));
  assertEquals(r.allowed, true);
  assertEquals(r.count, null);
});

Deno.test('a thrown RPC fails OPEN', async () => {
  const db = { rpc: () => { throw new Error('network down'); } };
  const r = await enforceCheckoutRateLimit(db, reqWith({ 'x-forwarded-for': '203.0.113.7' }));
  assertEquals(r.allowed, true);
});

Deno.test('allows at the limit and refuses past it', async () => {
  const at = { rpc: () => Promise.resolve({ data: 10, error: null }) };
  const over = { rpc: () => Promise.resolve({ data: 11, error: null }) };
  const req = reqWith({ 'x-forwarded-for': '203.0.113.7' });

  const rAt = await enforceCheckoutRateLimit(at, req, 10);
  assertEquals(rAt.allowed, true, '10th request within a limit of 10 is allowed');

  const rOver = await enforceCheckoutRateLimit(over, req, 10);
  assertEquals(rOver.allowed, false, '11th request is refused');
  assertEquals(rOver.count, 11);
});
