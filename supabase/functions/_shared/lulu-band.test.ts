// deno test supabase/functions/_shared/lulu-band.test.ts
//
// The print rail's band dimension (2026-09-23): Sprouts output must be exactly
// what it was before bands existed, and Seedlings must route to its own rows
// with no Sprouts text leaking into anything a Seedlings buyer or Lulu sees.
// No network, no database: a fake Db returns fixed lulu_printables rows.

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  LULU_BOOKS,
  SEEDLINGS_PAGE_COUNTS,
  luluBandForSku,
  luluBookByKey,
  luluLineExternalId,
  luluProductBySku,
  parseLuluLineExternalId,
  printBandForOrder,
  printableProblems,
} from './lulu-config.ts';
import { buildLuluLineItems, loadPrintables, LuluPrintableRow, OrderItemWithProduct } from './lulu-fulfillment.ts';
import {
  buildDeliveredEmail,
  buildOrderConfirmationEmail,
  buildShippedEmail,
  orderSmsText,
} from './order-messages.ts';
import { curriculumInvoiceCreation, RECEIPT_NAMES } from './receipt.ts';
import { OrderRow } from './order-db.ts';

const COIL = '0850X1100.FC.STD.CO.080CW444.GXX';
const A5 = '0583X0827.FC.STD.PB.080CW444.GXX';

// deno-lint-ignore no-explicit-any
function fakeDb(rows: any[]): any {
  return { from: () => ({ select: () => Promise.resolve({ data: rows, error: null }) }), rpc: () => null };
}

/** The three live Sprouts rows as they are today: no band column yet. */
const sproutsRowsPreMigration: LuluPrintableRow[] = [
  { book_key: 'tg', title: "Eden's Table Sprouts: Teacher's Guide", pod_package_id: COIL, page_count: 240, interior_url: 'https://x.test/s-tg.pdf', cover_url: 'https://x.test/s-tgc.pdf', printable_id: null },
  { book_key: 'nb', title: "Eden's Table Sprouts: Student Notebook", pod_package_id: COIL, page_count: 224, interior_url: 'https://x.test/s-nb.pdf', cover_url: 'https://x.test/s-nbc.pdf', printable_id: null },
  { book_key: 'ra', title: "Eden's Table Sprouts: Read-Aloud Storybook", pod_package_id: A5, page_count: 112, interior_url: 'https://x.test/s-ra.pdf', cover_url: 'https://x.test/s-rac.pdf', printable_id: null },
];
const sproutsRows = sproutsRowsPreMigration.map((r) => ({ ...r, band: 'sprouts' }));
/** Seedlings rows as the migration seeds them plus the files the main session adds. */
const seedlingsRows: LuluPrintableRow[] = [
  { band: 'seedlings', book_key: 'tg', title: "Eden's Table Seedlings: Teacher's Guide", pod_package_id: COIL, page_count: null, interior_url: 'https://x.test/g-tg.pdf', cover_url: 'https://x.test/g-tgc.pdf', printable_id: null },
  { band: 'seedlings', book_key: 'nb', title: "Eden's Table Seedlings: Student Notebook", pod_package_id: COIL, page_count: null, interior_url: 'https://x.test/g-nb.pdf', cover_url: 'https://x.test/g-nbc.pdf', printable_id: null },
  { band: 'seedlings', book_key: 'ra', title: "Eden's Table Seedlings: Read-Aloud Storybook", pod_package_id: A5, page_count: null, interior_url: 'https://x.test/g-ra.pdf', cover_url: 'https://x.test/g-rac.pdf', printable_id: null },
];

const item = (sku: string, quantity = 1): OrderItemWithProduct => ({ quantity, product: { sku, name: sku, fulfillment: 'lulu' } });

// The exact payload the Sprouts set produced before bands (lulu-fulfillment on origin/main 62e1b47).
const SPROUTS_SET_PAYLOAD = [
  { title: "Eden's Table Sprouts: Teacher's Guide", quantity: 1, external_id: 'tg', pod_package_id: COIL, interior: { source_url: 'https://x.test/s-tg.pdf' }, cover: { source_url: 'https://x.test/s-tgc.pdf' } },
  { title: "Eden's Table Sprouts: Student Notebook", quantity: 1, external_id: 'nb', pod_package_id: COIL, interior: { source_url: 'https://x.test/s-nb.pdf' }, cover: { source_url: 'https://x.test/s-nbc.pdf' } },
  { title: "Eden's Table Sprouts: Read-Aloud Storybook", quantity: 1, external_id: 'ra', pod_package_id: A5, interior: { source_url: 'https://x.test/s-ra.pdf' }, cover: { source_url: 'https://x.test/s-rac.pdf' } },
];

// ── config ───────────────────────────────────────────────────────────────────

Deno.test('Sprouts books and products are unchanged', () => {
  assertEquals(luluBookByKey('tg'), { band: 'sprouts', key: 'tg', title: "Eden's Table Sprouts: Teacher's Guide", podPackageId: COIL, pageCount: 240 });
  assertEquals(luluBookByKey('nb')?.pageCount, 224);
  assertEquals(luluBookByKey('ra')?.podPackageId, A5);
  assertEquals(luluBookByKey('ra')?.pageCount, 112);
  assertEquals(luluProductBySku('sprouts_print_set')?.books, ['tg', 'nb', 'ra']);
  assertEquals(luluProductBySku('sprouts_nb_print')?.books, ['nb']);
  assertEquals(luluBandForSku('sprouts_print_set'), 'sprouts');
  assertEquals(luluBandForSku('sprouts_nb_print'), 'sprouts');
});

Deno.test('Seedlings uses the Sprouts packages and the one page-count table', () => {
  for (const key of ['tg', 'nb', 'ra'] as const) {
    const s = luluBookByKey(key, 'seedlings')!;
    assertEquals(s.podPackageId, luluBookByKey(key, 'sprouts')!.podPackageId);
    assertEquals(s.pageCount, SEEDLINGS_PAGE_COUNTS[key]);
    assert(!s.title.includes('Sprouts'), s.title);
  }
  assertEquals(SEEDLINGS_PAGE_COUNTS, { tg: 245, nb: 227, ra: 160 });
  assertEquals(luluProductBySku('seedlings_print_set')?.band, 'seedlings');
  assertEquals(luluProductBySku('seedlings_print_set')?.books, ['tg', 'nb', 'ra']);
  assertEquals(luluProductBySku('seedlings_nb_print')?.books, ['nb']);
  assertEquals(luluProductBySku('seedlings_nb_print')?.maxQtyPerOrder, luluProductBySku('sprouts_nb_print')?.maxQtyPerOrder);
  assertEquals(luluBandForSku('seedlings_nb_print'), 'seedlings');
  assertEquals(LULU_BOOKS.length, 6);
});

Deno.test('Seedlings page counts sit inside Lulu limits for their bindings', () => {
  // Coil 2 to 470, perfect bound 32 to 800 (spec sheet, 2026-09-10).
  assert(SEEDLINGS_PAGE_COUNTS.tg >= 2 && SEEDLINGS_PAGE_COUNTS.tg <= 470);
  assert(SEEDLINGS_PAGE_COUNTS.nb >= 2 && SEEDLINGS_PAGE_COUNTS.nb <= 470);
  assert(SEEDLINGS_PAGE_COUNTS.ra >= 32 && SEEDLINGS_PAGE_COUNTS.ra <= 800);
});

Deno.test('external ids: Sprouts keeps the bare key, Seedlings is prefixed, both round-trip', () => {
  assertEquals(luluLineExternalId('sprouts', 'tg'), 'tg');
  assertEquals(luluLineExternalId('seedlings', 'tg'), 'seedlings-tg');
  assertEquals(parseLuluLineExternalId('tg'), { band: 'sprouts', key: 'tg' });
  assertEquals(parseLuluLineExternalId('seedlings-ra'), { band: 'seedlings', key: 'ra' });
  assertEquals(parseLuluLineExternalId('sprouts-tg'), null);
  assertEquals(parseLuluLineExternalId('cultivators-tg'), null);
  assertEquals(parseLuluLineExternalId('ET-1030'), null);
});

Deno.test('printBandForOrder reads lookup_key; everything else is Sprouts', () => {
  assertEquals(printBandForOrder({ lookup_key: 'seedlings_print_set' }), 'seedlings');
  assertEquals(printBandForOrder({ lookup_key: 'seedlings_nb_print' }), 'seedlings');
  assertEquals(printBandForOrder({ lookup_key: 'sprouts_print_set' }), 'sprouts');
  assertEquals(printBandForOrder({ lookup_key: 'sprouts_kit' }), 'sprouts');
  assertEquals(printBandForOrder({}), 'sprouts');
  assertEquals(printBandForOrder(null), 'sprouts');
});

// ── line items ───────────────────────────────────────────────────────────────

Deno.test('Sprouts set payload is byte-for-byte the pre-band payload, before and after the migration', async () => {
  for (const rows of [sproutsRowsPreMigration, [...sproutsRows, ...seedlingsRows]]) {
    const printables = await loadPrintables(fakeDb(rows));
    assertEquals(buildLuluLineItems([item('sprouts_print_set')], printables), SPROUTS_SET_PAYLOAD);
  }
});

Deno.test('Sprouts set + extra notebooks still one job, notebook from Sprouts', async () => {
  const printables = await loadPrintables(fakeDb([...sproutsRows, ...seedlingsRows]));
  const out = buildLuluLineItems([item('sprouts_print_set'), item('sprouts_nb_print', 2)], printables);
  assertEquals(out.length, 4);
  assertEquals(out[3], { ...SPROUTS_SET_PAYLOAD[1], quantity: 2 });
});

Deno.test('Seedlings set + extra notebooks: one job, notebook from Seedlings', async () => {
  const printables = await loadPrintables(fakeDb([...sproutsRows, ...seedlingsRows]));
  const out = buildLuluLineItems([item('seedlings_print_set'), item('seedlings_nb_print', 2)], printables);
  assertEquals(out.map((l) => l.external_id), ['seedlings-tg', 'seedlings-nb', 'seedlings-ra', 'seedlings-nb']);
  assertEquals(out[3].interior?.source_url, 'https://x.test/g-nb.pdf');
  assertEquals(out[3].quantity, 2);
  const nbOnly = buildLuluLineItems([item('seedlings_nb_print')], printables);
  assertEquals(nbOnly.map((l) => l.external_id), ['seedlings-nb']);
  assertThrows(() => buildLuluLineItems([item('sprouts_print_set'), item('seedlings_nb_print')], printables), Error, 'mixes sprouts and seedlings');
});

Deno.test('Seedlings set routes to Seedlings rows only, with no Sprouts text', async () => {
  const printables = await loadPrintables(fakeDb([...sproutsRows, ...seedlingsRows]));
  const out = buildLuluLineItems([item('seedlings_print_set', 2)], printables);
  assertEquals(out.map((l) => l.external_id), ['seedlings-tg', 'seedlings-nb', 'seedlings-ra']);
  assertEquals(out.map((l) => l.pod_package_id), [COIL, COIL, A5]);
  assertEquals(out.map((l) => l.interior?.source_url), ['https://x.test/g-tg.pdf', 'https://x.test/g-nb.pdf', 'https://x.test/g-ra.pdf']);
  assertEquals(out.map((l) => l.cover?.source_url), ['https://x.test/g-tgc.pdf', 'https://x.test/g-nbc.pdf', 'https://x.test/g-rac.pdf']);
  assert(out.every((l) => l.quantity === 2));
  const text = JSON.stringify(out);
  assert(!text.includes('Sprouts'), text);
  assert(!text.includes('/s-'), 'a Sprouts file URL leaked into a Seedlings job');
});

Deno.test('Seedlings with no rows or no files fails loudly, never falls back to Sprouts', async () => {
  const onlySprouts = await loadPrintables(fakeDb(sproutsRowsPreMigration));
  assertThrows(() => buildLuluLineItems([item('seedlings_print_set')], onlySprouts), Error, "no row for 'seedlings/tg'");
  const noFiles = await loadPrintables(fakeDb([...sproutsRows, ...seedlingsRows.map((r) => ({ ...r, interior_url: null, cover_url: null }))]));
  assertThrows(() => buildLuluLineItems([item('seedlings_print_set')], noFiles), Error, "book 'seedlings/tg' has no printable_id and is missing interior_url, cover_url");
});

Deno.test('a mixed-band order is refused', async () => {
  const printables = await loadPrintables(fakeDb([...sproutsRows, ...seedlingsRows]));
  assertThrows(() => buildLuluLineItems([item('sprouts_print_set'), item('seedlings_print_set')], printables), Error, 'mixes sprouts and seedlings');
});

Deno.test('printableProblems gates checkout per band', () => {
  assertEquals(printableProblems('seedlings', [...sproutsRows, ...seedlingsRows]), []);
  assertEquals(printableProblems('seedlings', sproutsRowsPreMigration).length, 3);
  assertEquals(
    printableProblems('seedlings', seedlingsRows.map((r) => (r.book_key === 'ra' ? { ...r, cover_url: null } : r))),
    ['seedlings/ra: missing cover_url'],
  );
  // A cached printable id is enough on its own.
  assertEquals(printableProblems('seedlings', seedlingsRows.map((r) => ({ ...r, interior_url: null, cover_url: null, printable_id: 'p' }))), []);
  // Rows with no band column are Sprouts.
  assertEquals(printableProblems('sprouts', sproutsRowsPreMigration), []);
});

// ── messages, receipts, invoices ─────────────────────────────────────────────

const baseOrder: OrderRow = {
  id: 'o1',
  order_number: 'ET-1100',
  customer_email: 'buyer@example.com',
  customer_phone: '+19315550100',
  shipping_name: 'Ada Lovelace',
  product_label: null,
  amount_total_cents: 26100,
  currency: 'usd',
  sms_consent: true,
  status: 'ready_to_fulfill',
  shipping_carrier: 'USPS',
  tracking_number: 'T1',
  tracking_url: 'https://example.test/t/T1',
};

Deno.test('Sprouts order messages are unchanged', () => {
  for (const o of [baseOrder, { ...baseOrder, lookup_key: 'sprouts_print_set' }]) {
    assertEquals(buildOrderConfirmationEmail(o).subject, 'Your Sprouts books are ordered (ET-1100)');
    assertEquals(buildShippedEmail(o).subject, 'Your Sprouts books shipped');
    assertEquals(buildDeliveredEmail(o).subject, 'Your Sprouts books are here');
    assert(buildOrderConfirmationEmail(o).html.includes('your Sprouts set'));
    assertEquals(
      orderSmsText('order_received_sms', o),
      'Thank you for your Sprouts order from The Eden Institute! Order ET-1100. Your payment went through today. Your books print in 48 hours; reply to your confirmation email before then to change anything. I will text you when they ship. Reply STOP to opt out.',
    );
    assertEquals(
      orderSmsText('delivered_sms', o),
      'Your Sprouts books from The Eden Institute were delivered today! Anything wrong with them, reply to your confirmation email and I will make it right. Reply STOP to opt out.',
    );
  }
});

Deno.test('Seedlings order messages never say Sprouts', () => {
  const o = { ...baseOrder, lookup_key: 'seedlings_print_set' };
  const all = [
    buildOrderConfirmationEmail(o),
    buildShippedEmail(o),
    buildDeliveredEmail(o),
  ];
  assertEquals(all.map((m) => m.subject), [
    'Your Seedlings books are ordered (ET-1100)',
    'Your Seedlings books shipped',
    'Your Seedlings books are here',
  ]);
  for (const m of all) assert(!m.subject.includes('Sprouts') && !m.html.includes('Sprouts'), m.subject);
  for (const k of ['order_received_sms', 'shipped_sms', 'delivered_sms']) {
    const t = orderSmsText(k, o);
    assert(t.includes('Seedlings') && !t.includes('Sprouts'), t);
  }
});

Deno.test('print invoice: Sprouts exact, Seedlings swaps band and grades', () => {
  const s = curriculumInvoiceCreation('print');
  assertEquals(s.invoice_data.description, "Homeschool curriculum purchase: Eden's Table Sprouts printed curriculum, a K-2 Christian homeschool curriculum.");
  assertEquals(s.invoice_data.custom_fields[1], { name: 'Grade level', value: 'K-2 (Sprouts)' });
  assertEquals(curriculumInvoiceCreation('print', 'sprouts'), s);
  const g = curriculumInvoiceCreation('print', 'seedlings');
  assertEquals(g.invoice_data.description, "Homeschool curriculum purchase: Eden's Table Seedlings printed curriculum, a 3-5 Christian homeschool curriculum.");
  assert(!JSON.stringify(g).includes('Sprouts'));
});

Deno.test('receipt name for the Seedlings extra notebook says curriculum and not Sprouts', () => {
  const r = RECEIPT_NAMES.seedlings_nb_print;
  assertEquals(r.grade, '3-5');
  assert(r.name.includes('Curriculum') && !r.name.includes('Sprouts'), r.name);
});

Deno.test('receipt name for the Seedlings set says curriculum and not Sprouts', () => {
  const r = RECEIPT_NAMES.seedlings_print_set;
  assertEquals(r.grade, '3-5');
  assert(r.name.includes('Curriculum') && !r.name.includes('Sprouts'), r.name);
  assertEquals(RECEIPT_NAMES.sprouts_print_set.name, "Sprouts Printed Curriculum Set: Teacher's Guide, Student Notebook and Read-Aloud Storybook (36 weeks)");
});
