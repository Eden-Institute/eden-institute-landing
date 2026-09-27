// deno test supabase/functions/_shared/print-session-lock.test.ts
//
// Heavy print orders lock the address on a Stripe Customer. Stripe refuses a
// session carrying custom_text.shipping_address without
// shipping_address_collection (live 500 on every heavy checkout, 2026-09-27).
// No network.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { lockShipToSessionParams } from './print-session-lock.ts';

function printParams() {
  // The shape create-checkout builds for every print cart before the heavy branch.
  return {
    mode: 'payment',
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: 3225, currency: 'usd' } } }],
    phone_number_collection: { enabled: true },
    customer_creation: 'always',
    custom_text: {
      submit: { message: 'Printed to order for you.' },
      shipping_address: { message: 'Your books ship to this address.' },
    },
    metadata: { print_cart: 'sprouts_print_set:1,sprouts_nb_print:7' },
  } as Record<string, any>;
}

Deno.test('heavy order: no shipping_address_collection and no custom_text.shipping_address', () => {
  const p = lockShipToSessionParams(printParams());
  assert(!('shipping_address_collection' in p));
  assert(!('customer_creation' in p));
  assert(!('shipping_address' in (p.custom_text ?? {})));
});

Deno.test('heavy order: keeps everything else, including the submit text', () => {
  const p = lockShipToSessionParams(printParams());
  assertEquals(p.custom_text, { submit: { message: 'Printed to order for you.' } });
  assertEquals(p.shipping_options[0].shipping_rate_data.fixed_amount.amount, 3225);
  assertEquals(p.phone_number_collection, { enabled: true });
  assertEquals(p.automatic_tax, { enabled: true });
  assertEquals(p.metadata.print_cart, 'sprouts_print_set:1,sprouts_nb_print:7');
});

Deno.test('heavy order: an emptied custom_text is dropped, not sent as {}', () => {
  const p = printParams();
  delete p.custom_text.submit;
  lockShipToSessionParams(p);
  assert(!('custom_text' in p));
});

Deno.test('heavy order: params without custom_text are fine', () => {
  const p = printParams();
  delete p.custom_text;
  lockShipToSessionParams(p);
  assert(!('custom_text' in p));
  assert(!('shipping_address_collection' in p));
});

Deno.test('create-checkout calls the lock in its heavy branch and nowhere strips the address form by hand', async () => {
  const src = await Deno.readTextFile(new URL('../create-checkout/index.ts', import.meta.url));
  const branch = src.indexOf('if (shipTo) {');
  assert(branch > 0, 'heavy-order branch not found');
  const call = src.indexOf('lockShipToSessionParams(sessionParams)', branch);
  const customer = src.indexOf('stripe.customers.create', branch);
  assert(call > branch && call < customer, 'lockShipToSessionParams must run in the heavy branch, before the Customer is created');
  assertEquals(src.match(/delete sessionParams\.shipping_address_collection/g), null);
});
