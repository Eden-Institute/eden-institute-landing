// Back to Eden book shop (2026-09-25). Run: deno test supabase/functions/_shared/book-shop.test.ts
import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  LULU_PRODUCTS,
  isBookBand,
  luluBandForSku,
  luluBookByKey,
  luluLineExternalId,
  normalizeLuluBand,
  parseLuluLineExternalId,
  printBandForOrder,
  printableProblems,
} from './lulu-config.ts';
import { buildLuluLineItems, loadPrintables, LuluPrintableRow, OrderItemWithProduct } from './lulu-fulfillment.ts';
import { buildDeliveredEmail, buildOrderConfirmationEmail, buildShippedEmail, orderSmsText } from './order-messages.ts';
import { BOOK_RECEIPT_NAMES, bookDigitalReceipt, renderReceiptHtml, renderReceiptText } from './receipt.ts';
import { BOOK_DIGITAL, bookDigitalBySku, isDownloadToken, newDownloadToken, renderBookDeliveryEmail } from './book-shop.ts';
import { OrderRow } from './order-db.ts';

// deno-lint-ignore no-explicit-any
function fakeDb(rows: any[]): any {
  return { from: () => ({ select: () => Promise.resolve({ data: rows, error: null }) }), rpc: () => null };
}
const item = (sku: string, quantity = 1): OrderItemWithProduct => ({ quantity, product: { sku, name: sku, fulfillment: 'lulu' } });

const PB = '0600X0900.BW.STD.PB.060UW444.MXX';
const COIL = '0850X1100.FC.STD.CO.060UW444.MXX';
const bteRows: LuluPrintableRow[] = [
  { band: 'bte', book_key: 'pb', title: 'Back to Eden: A Biblical Foundation for Herbal Healing', pod_package_id: PB, page_count: 186, interior_url: 'https://x.test/pb.pdf', cover_url: 'https://x.test/pbc.pdf', printable_id: null },
  { band: 'bte', book_key: 'sj', title: 'Back to Eden: Study & Journal Edition', pod_package_id: COIL, page_count: 386, interior_url: 'https://x.test/sj.pdf', cover_url: 'https://x.test/sjc.pdf', printable_id: null },
  { band: 'bte', book_key: 'sg', title: 'Back to Eden: Study Guide', pod_package_id: COIL, page_count: 266, interior_url: 'https://x.test/sg.pdf', cover_url: 'https://x.test/sgc.pdf', printable_id: null },
];

Deno.test('Back to Eden is its own band and never falls back to Sprouts', () => {
  assertEquals(normalizeLuluBand('bte'), 'bte');
  assert(isBookBand('bte'));
  assertFalse(isBookBand('sprouts'));
  for (const sku of ['bte_paperback_print', 'bte_study_journal_print', 'bte_study_guide_print']) {
    assertEquals(luluBandForSku(sku), 'bte');
    assertEquals(printBandForOrder({ lookup_key: sku }), 'bte');
  }
  assertEquals(LULU_PRODUCTS.filter((p) => p.band === 'bte').map((p) => p.books), [['pb'], ['sj'], ['sg']]);
});

Deno.test('package ids and page counts match the founder Lulu settings and the final files', () => {
  assertEquals(luluBookByKey('pb', 'bte')?.podPackageId, PB);
  assertEquals(luluBookByKey('sj', 'bte')?.podPackageId, COIL);
  assertEquals(luluBookByKey('sg', 'bte')?.podPackageId, COIL);
  assertEquals([186, 386, 266], ['pb', 'sj', 'sg'].map((k) => luluBookByKey(k, 'bte')?.pageCount));
});

Deno.test('external ids round-trip for the book keys', () => {
  for (const k of ['pb', 'sj', 'sg'] as const) {
    assertEquals(luluLineExternalId('bte', k), `bte-${k}`);
    assertEquals(parseLuluLineExternalId(`bte-${k}`), { band: 'bte', key: k });
  }
});

Deno.test('printables: paperback + Study Guide is one job with two lines', async () => {
  const printables = await loadPrintables(fakeDb(bteRows));
  const out = buildLuluLineItems([item('bte_paperback_print'), item('bte_study_guide_print', 2)], printables);
  assertEquals(out.map((l) => [l.external_id, l.quantity, l.pod_package_id]), [['bte-pb', 1, PB], ['bte-sg', 2, COIL]]);
});

Deno.test('checkout refuses Back to Eden until its print files are in', () => {
  const noFiles = bteRows.map((r) => ({ ...r, interior_url: null, cover_url: null }));
  assertEquals(printableProblems('bte', noFiles).length, 3);
  assertEquals(printableProblems('bte', bteRows), []);
});

const order = (lookup_key: string): OrderRow => ({
  id: 'o1', order_number: 'ET-9001', customer_email: 'reader@example.com', shipping_name: 'Ruth Reader',
  lookup_key, product_label: 'Back to Eden, Paperback', amount_total_cents: 3099, tracking_number: '9400',
  shipping_carrier: 'USPS', tracking_url: 'https://tools.usps.com/x',
// deno-lint-ignore no-explicit-any
} as any);

Deno.test('book order messages never use curriculum wording', () => {
  const o = order('bte_paperback_print');
  const texts = [
    buildOrderConfirmationEmail(o).html, buildOrderConfirmationEmail(o).subject,
    buildShippedEmail(o).html, buildShippedEmail(o).subject,
    buildDeliveredEmail(o).html, buildDeliveredEmail(o).subject,
    orderSmsText('order_received_sms', o), orderSmsText('shipped_sms', o), orderSmsText('delivered_sms', o),
  ].join('\n')
    // The footer's social links and the seller's legal brand line legitimately say it.
    .replace(/EdensTableHomeschoolCurriculum|edenstablehomeschoolcurriculum|Eden's Table Homeschool Curriculum/g, '');
  for (const banned of ['Sprouts', 'Seedlings', 'Week 1', "Teacher's Guide", 'urriculum','—']) {
    assertFalse(texts.includes(banned), `book messages contain '${banned}'`);
  }
  assert(buildOrderConfirmationEmail(o).subject.startsWith('Your copy of Back to Eden is ordered'));
});

Deno.test('curriculum messages are unchanged by the book branch', () => {
  const o = order('sprouts_print_set');
  assert(buildOrderConfirmationEmail(o).subject.startsWith('Your Sprouts books are ordered'));
  assert(orderSmsText('shipped_sms', o).startsWith('Your Sprouts books'));
});

Deno.test('digital catalogue, receipts and tokens', () => {
  assertEquals(Object.keys(BOOK_DIGITAL).length, 3);
  for (const b of Object.values(BOOK_DIGITAL)) {
    assertEquals(b.lookupKey, b.sku);
    assert(BOOK_RECEIPT_NAMES[b.sku], `receipt name for ${b.sku}`);
    assertEquals(bookDigitalBySku(b.sku), b);
  }
  assertEquals(bookDigitalBySku('toString'), null);
  assertEquals(bookDigitalBySku('bte_paperback_print'), null);
  const t = newDownloadToken();
  assert(isDownloadToken(t));
  assertFalse(isDownloadToken(t.slice(1)));

  const r = bookDigitalReceipt({ order_number: 'ET-9002', amount_total_cents: 1604, tax_cents: 105, raw: { amount_subtotal: 1499, total_details: { amount_discount: 0 } } }, 'bte_paperback_digital');
  assertEquals(r.lines[0].unitCents, 1499);
  assertEquals(r.gradeLevel, null);
  const both = (renderReceiptHtml(r) + renderReceiptText(r)).replace(/Eden's Table Homeschool Curriculum/g, '');
  assertFalse(/curriculum/i.test(both), 'book receipt says curriculum');
  assert(both.includes('Itemized receipt') || both.includes('ITEMIZED RECEIPT'));
});

Deno.test('delivery email links the download page with the token and has no em dash', () => {
  const token = 'a'.repeat(64);
  const m = renderBookDeliveryEmail({ firstName: 'Ruth', email: 'r@example.com', book: BOOK_DIGITAL.bte_study_guide_digital, downloadToken: token });
  assert(m.html.includes(`https://edeninstitute.health/back-to-eden/download?t=${token}`));
  assert(m.text.includes(token));
  assertFalse((m.html + m.text + m.subject).includes('—'));
});
