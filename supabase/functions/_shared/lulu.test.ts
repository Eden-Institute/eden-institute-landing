// deno test supabase/functions/_shared/lulu.test.ts
//
// Pure pieces of the Lulu client: address mapping, signature verification,
// tracking extraction, cost parsing. No network.

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  luluCostCents,
  luluTrackingFromJob,
  stripeAddressToLulu,
  timingSafeEqual,
  verifyLuluSignature,
} from './lulu.ts';

const stripeOrder = {
  shipping_name: 'Camila Oliveira',
  shipping_address: {
    line1: '303 Holly Cir',
    line2: 'Unit 3262',
    city: 'Clarksville',
    state: 'TN',
    postal_code: '37043',
    country: 'US',
  },
  customer_phone: '+19315755895',
  customer_email: 'buyer@example.com',
};

Deno.test('stripeAddressToLulu maps every Stripe field onto Lulu names', () => {
  const out = stripeAddressToLulu(stripeOrder);
  assertEquals(out, {
    name: 'Camila Oliveira',
    street1: '303 Holly Cir',
    street2: 'Unit 3262',
    city: 'Clarksville',
    state_code: 'TN',
    postcode: '37043',
    country_code: 'US',
    phone_number: '+19315755895',
    email: 'buyer@example.com',
  });
});

Deno.test('stripeAddressToLulu names the missing fields', () => {
  assertThrows(
    () => stripeAddressToLulu({ ...stripeOrder, customer_phone: null, shipping_address: { ...stripeOrder.shipping_address, city: '' } }),
    Error,
    'shipping_address.city, customer_phone',
  );
});

Deno.test('stripeAddressToLulu rejects a phone Lulu would reject', () => {
  assertThrows(() => stripeAddressToLulu({ ...stripeOrder, customer_phone: '12' }), Error, 'phone pattern');
});

Deno.test('stripeAddressToLulu omits blank optional fields', () => {
  const out = stripeAddressToLulu({
    ...stripeOrder,
    shipping_address: { ...stripeOrder.shipping_address, line2: '  ', state: null },
  });
  assertEquals('street2' in out, false);
  assertEquals('state_code' in out, false);
});

Deno.test('verifyLuluSignature accepts hex and base64 digests, rejects others', async () => {
  const secret = 'test-secret';
  const body = '{"topic":"PRINT_JOB_STATUS_CHANGED","data":{"id":1}}';
  // Independently computed with the same primitives the client uses.
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = btoa(String.fromCharCode(...mac));

  assertEquals(await verifyLuluSignature(body, hex, secret), true);
  assertEquals(await verifyLuluSignature(body, hex.toUpperCase(), secret), true);
  assertEquals(await verifyLuluSignature(body, b64, secret), true);
  assertEquals(await verifyLuluSignature(body, hex, 'wrong-secret'), false);
  assertEquals(await verifyLuluSignature(body + ' ', hex, secret), false);
  assertEquals(await verifyLuluSignature(body, null, secret), false);
  assertEquals(await verifyLuluSignature(body, hex, ''), false);
});

Deno.test('timingSafeEqual', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true);
  assertEquals(timingSafeEqual('abc', 'abd'), false);
  assertEquals(timingSafeEqual('abc', 'ab'), false);
});

Deno.test('luluTrackingFromJob reads the SHIPPED status payload first', () => {
  const job = {
    id: 42776,
    status: {
      name: 'SHIPPED',
      line_item_statuses: [{
        name: 'SHIPPED',
        line_item_id: 57999,
        messages: {
          tracking_id: '3d4a53da_1',
          tracking_urls: ['https://example.test/track/3d4a53da_1'],
          carrier_name: 'Carrier',
        },
      }],
    },
    line_items: [{ tracking_id: 'ignored', tracking_urls: ['https://example.test/ignored'] }],
  };
  assertEquals(luluTrackingFromJob(job), {
    carrier: 'Carrier',
    trackingNumber: '3d4a53da_1',
    trackingUrl: 'https://example.test/track/3d4a53da_1',
  });
});

Deno.test('luluTrackingFromJob falls back to line items, then null', () => {
  assertEquals(
    luluTrackingFromJob({ id: 1, status: { name: 'SHIPPED' }, line_items: [{ tracking_id: 'X1', tracking_urls: [] }] }),
    { carrier: null, trackingNumber: 'X1', trackingUrl: null },
  );
  assertEquals(luluTrackingFromJob({ id: 1, status: { name: 'IN_PRODUCTION' } }), null);
});

Deno.test('luluCostCents parses the decimal string', () => {
  assertEquals(luluCostCents({ id: 1, status: { name: 'UNPAID' }, costs: { total_cost_incl_tax: '86.45' } }), 8645);
  assertEquals(luluCostCents({ id: 1, status: { name: 'CREATED' }, costs: { total_cost_incl_tax: null } }), null);
  assertEquals(luluCostCents({ id: 1, status: { name: 'CREATED' } }), null);
});
