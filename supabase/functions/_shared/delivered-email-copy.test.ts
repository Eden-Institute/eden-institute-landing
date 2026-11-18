// deno test supabase/functions/_shared/delivered-email-copy.test.ts
//
// 2026-11-18 (Camila's yes via Lane 0): the delivered email said "Somewhere in that box is the very first plant
// your kids are going to meet", and a buyer asked whether plants come in the box (they do not). And an ESA
// family's extra-notebook-only box got the same "open the Teacher's Guide" wording although no guide was in it.
// No network, no database.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDeliveredEmail, buildShippedEmail, isNotebookOnlyOrder } from './order-messages.ts';
import { DELIVERED_HERBS_NOTE, DELIVERED_NOTE, DELIVERED_NOTEBOOK_NOTE } from './founding-family-templates.ts';
import { OrderRow } from './order-db.ts';

const order: OrderRow = {
  id: 'o1',
  order_number: 'ET-1100',
  customer_email: 'buyer@example.com',
  customer_phone: '+19315550100',
  shipping_name: 'Ada Lovelace',
  product_label: null,
  amount_total_cents: 26100,
  currency: 'usd',
  sms_consent: true,
  status: 'shipped',
  shipping_carrier: 'USPS',
  tracking_number: 'T1',
  tracking_url: 'https://example.test/t/T1',
};

Deno.test('delivered email: the plant is on the Week 1 pages, not in the box, and herbs are not included', () => {
  for (const lookup_key of [null, 'sprouts_print_set', 'seedlings_print_set']) {
    const m = buildDeliveredEmail({ ...order, lookup_key });
    assert(!/Somewhere in that box/i.test(m.html), `${lookup_key}: old line still there`);
    assert(m.html.includes(DELIVERED_NOTE), `${lookup_key}: new note missing`);
    assert(m.html.includes('the herbs are not in the box'), `${lookup_key}: herbs line missing`);
    assert(m.html.includes('https://edeninstitute.health/homeschool/herbs'), `${lookup_key}: herb list link missing`);
    assert(m.html.includes('Now go find your first plant.'), `${lookup_key}: closing line`);
    assert(m.subject.endsWith('books are here'), m.subject);
  }
});

Deno.test('notebook-only box: its own subject and note, never the Teacher\'s Guide plant line', () => {
  for (const [lookup_key, band] of [['sprouts_nb_print', 'Sprouts'], ['seedlings_nb_print', 'Seedlings']]) {
    const o = { ...order, lookup_key, product_label: `${band} Extra Student Notebook`, amount_total_cents: 3999 };
    const d = buildDeliveredEmail(o);
    assertEquals(d.subject, `Your ${band} notebook is here`);
    assert(d.html.includes(DELIVERED_NOTEBOOK_NOTE), 'notebook note missing');
    assert(!d.html.includes(DELIVERED_NOTE) && !d.html.includes('herbs are not in the box'), 'set wording leaked');
    assert(!d.html.includes('go find your first plant'), 'set closing leaked');
    const s = buildShippedEmail(o);
    assertEquals(s.subject, `Your ${band} notebook shipped`);
    assert(s.html.includes('open the notebook to Week 1'), 'notebook shipped line missing');
    assert(!s.html.includes('When the box lands, open the Teacher'), 'set shipped line leaked');
    if (band === 'Seedlings') assert(!(d.html + s.html + d.subject + s.subject).includes('Sprouts'));
  }
});

Deno.test('isNotebookOnlyOrder: only an order led by an add-on notebook', () => {
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: null }), false);
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: 'sprouts_print_set' }), false);
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: 'seedlings_print_set' }), false);
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: 'both_bands_print_set' }), false);
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: 'not_a_lulu_sku' }), false);
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: 'sprouts_nb_print' }), true);
  assertEquals(isNotebookOnlyOrder({ ...order, lookup_key: 'seedlings_nb_print' }), true);
});

Deno.test('new notes carry no em or en dash', () => {
  for (const t of [DELIVERED_NOTE, DELIVERED_HERBS_NOTE, DELIVERED_NOTEBOOK_NOTE]) assert(!/[—–]/.test(t), t);
});
