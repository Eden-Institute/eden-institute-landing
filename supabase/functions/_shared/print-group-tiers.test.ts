// deno test supabase/functions/_shared/print-group-tiers.test.ts
//
// Founder decisions 2026-09-26: the co-op notebook tier (1-5 at $39.99, 6th on at
// $32, up to 100 an order, only with a set, the 5 counted across both bands in
// the bundle; shipping that covers Lulu's cost on every cart), the both-bands
// bundle (both_bands_print_set, both printed years in one order and one Lulu job)
// and Back to Eden group copies (10 a title until shipping is decided). No
// network, no database.

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  checkCartBands,
  LULU_BOOKS,
  luluBandsForSku,
  luluProductBySku,
  pickShippingLevel,
  printBandForOrder,
  printBandNameForOrder,
  printableProblems,
} from './lulu-config.ts';
import {
  buildLuluLineItems,
  loadPrintables,
  luluShippingProbeLines,
  LuluPrintableRow,
  OrderItemWithProduct,
} from './lulu-fulfillment.ts';
import { mergePrintLines, PrintProductKeys } from './print-lines.ts';
import { likelyNeedsGround, PARCEL_PAGE_EQUIV, printShippingCents, SHIPPING_RULES, splitVolumeTier, volumeTierTotal } from './print-pricing.ts';
import { curriculumInvoiceCreation, RECEIPT_NAMES, receiptBalances, receiptLinesForItems } from './receipt.ts';
import { buildOrderConfirmationEmail, buildShippedEmail, orderSmsText } from './order-messages.ts';
import { OrderRow } from './order-db.ts';

const COIL = '0850X1100.FC.STD.CO.080CW444.MXX';
const A5 = '0583X0827.FC.STD.PB.080CW444.MXX';

// deno-lint-ignore no-explicit-any
function fakeDb(rows: any[]): any {
  return { from: () => ({ select: () => Promise.resolve({ data: rows, error: null }) }), rpc: () => null };
}
const row = (band: string, key: string, pkg: string, pages: number): LuluPrintableRow => ({
  band, book_key: key, title: `${band} ${key}`, pod_package_id: pkg, page_count: pages,
  interior_url: `https://x.test/${band}-${key}.pdf`, cover_url: `https://x.test/${band}-${key}c.pdf`, printable_id: null,
});
const printableRows = [
  row('sprouts', 'tg', COIL, 240), row('sprouts', 'nb', COIL, 224), row('sprouts', 'ra', A5, 112),
  row('seedlings', 'tg', COIL, 245), row('seedlings', 'nb', COIL, 227), row('seedlings', 'ra', A5, 160),
];
const item = (sku: string, quantity = 1): OrderItemWithProduct => ({ quantity, product: { sku, name: sku, fulfillment: 'lulu' } });

// ── Caps ─────────────────────────────────────────────────────────────────────

Deno.test('caps: notebooks 100, sets and bundle 2, Back to Eden titles 10', () => {
  assertEquals(luluProductBySku('sprouts_nb_print')?.maxQtyPerOrder, 100);
  assertEquals(luluProductBySku('seedlings_nb_print')?.maxQtyPerOrder, 100);
  assertEquals(luluProductBySku('sprouts_print_set')?.maxQtyPerOrder, 2);
  assertEquals(luluProductBySku('seedlings_print_set')?.maxQtyPerOrder, 2);
  assertEquals(luluProductBySku('both_bands_print_set')?.maxQtyPerOrder, 2);
  for (const sku of ['bte_paperback_print', 'bte_study_journal_print', 'bte_study_guide_print']) {
    assertEquals(luluProductBySku(sku)?.maxQtyPerOrder, 10, sku);
  }
});

// ── Cart band rules ──────────────────────────────────────────────────────────

Deno.test('cart rules: single-band carts unchanged', () => {
  assertEquals(checkCartBands(['sprouts_print_set', 'sprouts_nb_print'], { requireSetForAddOns: true }), { ok: true, bands: ['sprouts'] });
  assertEquals(checkCartBands(['seedlings_print_set', 'seedlings_nb_print'], { requireSetForAddOns: true }), { ok: true, bands: ['seedlings'] });
  assertEquals(checkCartBands(['bte_paperback_print', 'bte_study_guide_print'], { requireSetForAddOns: true }), { ok: true, bands: ['bte'] });
});

Deno.test('cart rules: two bands only with the bundle', () => {
  const mixed = checkCartBands(['sprouts_print_set', 'seedlings_print_set']);
  assert(!mixed.ok && mixed.code === 'PRINT_MIXED_BANDS');
  const mixedNb = checkCartBands(['sprouts_print_set', 'seedlings_nb_print']);
  assert(!mixedNb.ok && mixedNb.code === 'PRINT_MIXED_BANDS');
  assertEquals(
    checkCartBands(['both_bands_print_set', 'sprouts_nb_print', 'seedlings_nb_print'], { requireSetForAddOns: true }),
    { ok: true, bands: ['sprouts', 'seedlings'] },
  );
  // The bundle never admits Back to Eden.
  const withBook = checkCartBands(['both_bands_print_set', 'bte_paperback_print']);
  assert(!withBook.ok && withBook.code === 'PRINT_MIXED_BANDS');
});

Deno.test('cart rules: an extra notebook needs a set of its band in the same order', () => {
  const alone = checkCartBands(['sprouts_nb_print'], { requireSetForAddOns: true });
  assert(!alone.ok && alone.code === 'PRINT_ADDON_NEEDS_SET' && alone.sku === 'sprouts_nb_print');
  const seedAlone = checkCartBands(['seedlings_nb_print'], { requireSetForAddOns: true });
  assert(!seedAlone.ok && seedAlone.code === 'PRINT_ADDON_NEEDS_SET');
  // The Lulu side does not require it (ESA invoices sell a notebook on its own).
  assertEquals(checkCartBands(['seedlings_nb_print']), { ok: true, bands: ['seedlings'] });
});

// ── Lulu job for the bundle ──────────────────────────────────────────────────

Deno.test('bundle: one order line prints both bands, six books, each from its own rows', async () => {
  const printables = await loadPrintables(fakeDb(printableRows));
  const out = buildLuluLineItems([item('both_bands_print_set')], printables);
  assertEquals(out.map((l) => l.external_id), ['tg', 'nb', 'ra', 'seedlings-tg', 'seedlings-nb', 'seedlings-ra']);
  assertEquals(out.map((l) => l.interior?.source_url), [
    'https://x.test/sprouts-tg.pdf', 'https://x.test/sprouts-nb.pdf', 'https://x.test/sprouts-ra.pdf',
    'https://x.test/seedlings-tg.pdf', 'https://x.test/seedlings-nb.pdf', 'https://x.test/seedlings-ra.pdf',
  ]);
  assert(out.every((l) => l.quantity === 1));
});

Deno.test('bundle + extra notebooks of both bands: one job, quantities carried', async () => {
  const printables = await loadPrintables(fakeDb(printableRows));
  const out = buildLuluLineItems([item('both_bands_print_set'), item('sprouts_nb_print', 7), item('seedlings_nb_print', 100)], printables);
  assertEquals(out.length, 8);
  assertEquals(out[6], { ...out[1], quantity: 7 });
  assertEquals(out[7].external_id, 'seedlings-nb');
  assertEquals(out[7].quantity, 100);
});

Deno.test('a mixed order without the bundle is still refused at the Lulu step', async () => {
  const printables = await loadPrintables(fakeDb(printableRows));
  assertThrows(() => buildLuluLineItems([item('sprouts_print_set'), item('seedlings_print_set')], printables), Error, 'mixes sprouts and seedlings');
});

Deno.test('bundle: readiness covers both bands; messages and receipt name both years', () => {
  assertEquals(luluBandsForSku('both_bands_print_set'), ['sprouts', 'seedlings']);
  assertEquals(printableProblems('seedlings', printableRows), []);
  const noSeedFiles = printableRows.map((r) => (r.band === 'seedlings' ? { ...r, interior_url: null } : r));
  assertEquals(printableProblems('seedlings', noSeedFiles).length, 3);
  assertEquals(printBandForOrder({ lookup_key: 'both_bands_print_set' }), 'sprouts');
  assertEquals(printBandNameForOrder({ lookup_key: 'both_bands_print_set' }), 'Sprouts and Seedlings');
  assertEquals(printBandNameForOrder({ lookup_key: 'seedlings_print_set' }), 'Seedlings');
  assertEquals(printBandNameForOrder({ lookup_key: 'sprouts_print_set' }), 'Sprouts');
  assertEquals(printBandNameForOrder({ lookup_key: null }), 'Sprouts');
  assert(RECEIPT_NAMES.both_bands_print_set.name.includes('Curriculum'));
  const inv = curriculumInvoiceCreation('print', 'both');
  assert(inv.invoice_data.description.includes('Sprouts and Seedlings'));
  for (const f of inv.invoice_data.custom_fields) assert(f.value.length <= 140 && f.name.length <= 40);
});

Deno.test('bundle order emails and texts say Sprouts and Seedlings', () => {
  const o: OrderRow = {
    id: 'o1', order_number: 'ET-1200', customer_email: 'buyer@example.com', customer_phone: '+19315550100',
    shipping_name: 'Ada Lovelace', product_label: null, amount_total_cents: 44100, currency: 'usd', sms_consent: true,
    status: 'ready_to_fulfill', shipping_carrier: 'USPS', tracking_number: 'T1', tracking_url: 'https://example.test/t/T1',
    lookup_key: 'both_bands_print_set',
  };
  assertEquals(buildOrderConfirmationEmail(o).subject, 'Your Sprouts and Seedlings books are ordered (ET-1200)');
  assertEquals(buildShippedEmail(o).subject, 'Your Sprouts and Seedlings books shipped');
  assert(orderSmsText('order_received_sms', o).startsWith('Thank you for your Sprouts and Seedlings order'));
});

// ── Webhook line resolution ─────────────────────────────────────────────────

const PRODUCTS: PrintProductKeys[] = [
  { sku: 'sprouts_print_set', stripe_retail_price_id: 'price_set', stripe_lookup_key: null },
  { sku: 'sprouts_nb_print', stripe_retail_price_id: 'price_nb', stripe_lookup_key: null },
  { sku: 'both_bands_print_set', stripe_retail_price_id: null, stripe_lookup_key: 'both_bands_print_set' },
  { sku: 'seedlings_nb_print', stripe_retail_price_id: 'price_snb', stripe_lookup_key: null },
  { sku: 'bte_paperback_print', stripe_retail_price_id: null, stripe_lookup_key: 'bte_paperback_print' },
];

Deno.test('webhook: 7 notebooks charged as 5 + 2 become ONE order line of 7 at the base price', () => {
  const lines = [
    { quantity: 1, price: { id: 'price_set', product: 'prod_set', unit_amount: 24900 } },
    { quantity: 5, price: { id: 'price_nb', product: 'prod_nb', unit_amount: 3999 } },
    { quantity: 2, price: { id: 'price_inline_1', product: 'prod_nb', unit_amount: 3200 } },
  ];
  assertEquals(mergePrintLines(lines, PRODUCTS), [
    { sku: 'sprouts_print_set', isFounding: false, quantity: 1, unitPriceCents: 24900 },
    { sku: 'sprouts_nb_print', isFounding: false, quantity: 7, unitPriceCents: 3999 },
  ]);
});

Deno.test('webhook: lookup-key prices resolve (bundle, Back to Eden) instead of falling back', () => {
  const lines = [
    { quantity: 1, price: { id: 'price_live_bundle', lookup_key: 'both_bands_print_set', product: 'prod_b', unit_amount: 42900 } },
    { quantity: 6, price: { id: 'price_snb', product: 'prod_snb', unit_amount: 3999 } },
    { quantity: 1, price: { id: 'price_inline_2', product: 'prod_snb', unit_amount: 3200 } },
  ];
  assertEquals(mergePrintLines(lines, PRODUCTS), [
    { sku: 'both_bands_print_set', isFounding: false, quantity: 1, unitPriceCents: 42900 },
    { sku: 'seedlings_nb_print', isFounding: false, quantity: 7, unitPriceCents: 3999 },
  ]);
  assertEquals(mergePrintLines([{ quantity: 12, price: { id: 'p_x', lookup_key: 'bte_paperback_print', unit_amount: 2499 } }], PRODUCTS), [
    { sku: 'bte_paperback_print', isFounding: false, quantity: 12, unitPriceCents: 2499 },
  ]);
});

Deno.test('webhook: any unplaceable line means metadata fallback (null), as before', () => {
  // E2E: inline prices on throwaway products.
  assertEquals(mergePrintLines([{ quantity: 1, price: { id: 'price_e2e', product: 'prod_e2e', unit_amount: 24900 } }], PRODUCTS), null);
  assertEquals(mergePrintLines([], PRODUCTS), null);
  // Bundle: Seedlings used the whole allowance, so Sprouts is ONLY an inline $32 line
  // with no base line to match its product. Metadata fallback (right quantities).
  assertEquals(mergePrintLines([
    { quantity: 1, price: { id: 'p_b', lookup_key: 'both_bands_print_set', product: 'prod_b', unit_amount: 42900 } },
    { quantity: 5, price: { id: 'price_snb', product: 'prod_snb', unit_amount: 3999 } },
    { quantity: 2, price: { id: 'price_inline_3', product: 'prod_snb', unit_amount: 3200 } },
    { quantity: 2, price: { id: 'price_inline_4', product: 'prod_nb', unit_amount: 3200 } },
  ], PRODUCTS), null);
});

// ── Receipt ──────────────────────────────────────────────────────────────────

Deno.test('receipt: a 7-notebook line splits back to 5 x $39.99 + 2 x $32.00 and balances', () => {
  const nb = { quantity: 7, unit_price_cents: 3999, products: { sku: 'sprouts_nb_print', name: 'x', volume_price_cents: 3200, volume_min_qty: 6 } };
  const set = { quantity: 1, unit_price_cents: 24900, products: { sku: 'sprouts_print_set', name: 'x', volume_price_cents: null, volume_min_qty: null } };
  const lines = receiptLinesForItems([set, nb]);
  assertEquals(lines.map((l) => [l.quantity, l.unitCents]), [[1, 24900], [5, 3999], [2, 3200]]);
  assert(lines[2].name.endsWith('volume price'));
  const subtotal = 24900 + volumeTierTotal(7, 3999, 3200, 6);
  assertEquals(subtotal, 24900 + 26395);
  const shipping = printShippingCents([{ sku: 'sprouts_print_set', qty: 1 }, { sku: 'sprouts_nb_print', qty: 7 }])!;
  assertEquals(shipping, 1200 + 7 * 75 + 1500);
  const receipt = {
    orderNumber: 'ET-1', purchasedAt: null, billTo: null, lines, discountCents: 0, shippingCents: shipping, taxCents: 0,
    totalCents: subtotal + shipping, gradeLevel: 'K-2', paidWith: null,
  };
  assert(receiptBalances(receipt));
  // Before the migration (no volume columns) a 1-5 line reads exactly as before.
  assertEquals(receiptLinesForItems([{ quantity: 3, unit_price_cents: 3999, products: { sku: 'sprouts_nb_print', name: 'x' } }]).length, 1);
  assertEquals(splitVolumeTier(3, 3999, 3200, 6).length, 1);
});

Deno.test('receipt: bundle notebooks share ONE allowance of 5 across both bands', () => {
  const vol = { volume_price_cents: 3200, volume_min_qty: 6 };
  const rows = [
    { quantity: 1, unit_price_cents: 42900, products: { sku: 'both_bands_print_set', name: 'x', volume_price_cents: null, volume_min_qty: null } },
    { quantity: 3, unit_price_cents: 3999, products: { sku: 'sprouts_nb_print', name: 'x', ...vol } },
    { quantity: 4, unit_price_cents: 3999, products: { sku: 'seedlings_nb_print', name: 'x', ...vol } },
  ];
  const lines = receiptLinesForItems(rows);
  const nbTotal = lines.filter((l) => l.unitCents !== 42900).reduce((n, l) => n + l.quantity * l.unitCents, 0);
  assertEquals(nbTotal, 5 * 3999 + 2 * 3200);
  // Seedlings sorts first and takes 4 of the 5; Sprouts gets 1 at base and 2 at volume.
  assertEquals(lines.map((l) => [l.quantity, l.unitCents]), [[1, 42900], [1, 3999], [2, 3200], [4, 3999]]);
  const shipping = printShippingCents([
    { sku: 'both_bands_print_set', qty: 1 }, { sku: 'sprouts_nb_print', qty: 3 }, { sku: 'seedlings_nb_print', qty: 4 },
  ])!;
  assert(receiptBalances({
    orderNumber: 'ET-2', purchasedAt: null, billTo: null, lines, discountCents: 0, shippingCents: shipping, taxCents: 0,
    totalCents: 42900 + nbTotal + shipping, gradeLevel: 'K-2 and 3-5', paidWith: null,
  }));
});

// Founder 2026-09-26: "whatever covers my cost, I don't want to pay any of the
// shipping". Every cart the buy boxes allow was quoted by Lulu's public
// shipping-options endpoint (read-only, 2026-09-26; identical for TN, CA, NY, TX,
// FL, WA, ME, MT, AK, HI and an APO address). The charge must cover Lulu shipping
// at the level the job will use (MAIL when offered, else GROUND_HD) + the $0.75
// per-job fee + 10% for the sales tax Lulu charges on them, AND pay Stripe's fee
// on the shipping line itself: 6%, the worst of the methods checkout accepts
// (cards 2.9%, Klarna 5.99%, Affirm and Afterpay 6%, stripe.com pricing 2026-09-26).
Deno.test('shipping covers Lulu cost on all 837 quoted carts', async () => {
  const data = JSON.parse(await Deno.readTextFile(new URL('./testdata/lulu-shipping-quotes-2026-09-26.json', import.meta.url)));
  const fee = data.fee_per_job as number;
  let n = 0, minMargin = Infinity;
  for (const q of data.quotes as { cart: [string, number][]; level: string; ship: number }[]) {
    const items = q.cart.map(([sku, qty]) => ({ sku, qty }));
    const charge = printShippingCents(items)!;
    const cost = Math.ceil(((q.ship + fee) * 1.10 / 0.94) * 100);
    assert(charge >= cost, `${JSON.stringify(q.cart)}: charge ${charge} < cost ${cost} (${q.level} $${q.ship})`);
    // The weight rule says "ground" exactly when Lulu refuses MAIL, for curriculum
    // AND books: it drives the ground surcharge and the street-address requirement.
    assertEquals(likelyNeedsGround(items), q.level === 'GROUND_HD', JSON.stringify(q.cart));
    minMargin = Math.min(minMargin, charge - cost);
    n++;
  }
  assertEquals(n, 837);
  assert(minMargin >= 0);
});

Deno.test('every Lulu product has a shipping rule, and checkout-reachable carts price', () => {
  for (const p of ['sprouts_print_set', 'seedlings_print_set', 'both_bands_print_set', 'sprouts_nb_print', 'seedlings_nb_print',
    'bte_paperback_print', 'bte_study_guide_print', 'bte_study_journal_print']) {
    assert(SHIPPING_RULES[p], p);
    assert(luluProductBySku(p), p);
  }
  assertEquals(printShippingCents([{ sku: 'sprouts_print_set', qty: 1 }]), 1200);
  assertEquals(printShippingCents([{ sku: 'nope', qty: 1 }]), null);
});

Deno.test('parcel weight table matches the page counts in LULU_BOOKS', () => {
  const pages = (band: string, key: string) => LULU_BOOKS.find((b) => b.band === band && b.key === key)!.pageCount!;
  const a5 = (5.83 * 8.27) / (8.5 * 11);
  const set = (band: string) => pages(band, 'tg') + pages(band, 'nb') + pages(band, 'ra') * a5;
  assertEquals(PARCEL_PAGE_EQUIV.sprouts_print_set, set('sprouts'));
  assertEquals(PARCEL_PAGE_EQUIV.seedlings_print_set, set('seedlings'));
  assertEquals(PARCEL_PAGE_EQUIV.both_bands_print_set, set('sprouts') + set('seedlings'));
  assertEquals(PARCEL_PAGE_EQUIV.sprouts_nb_print, pages('sprouts', 'nb'));
  assertEquals(PARCEL_PAGE_EQUIV.seedlings_nb_print, pages('seedlings', 'nb'));
});

// ── Shipping level ───────────────────────────────────────────────────────────

Deno.test('shipping level: primary unless Lulu does not offer it and the fallback is offered', () => {
  // Levels Lulu offered 2026-09-26: set + 5 extra notebooks, then set + 6.
  const light = ['EXPEDITED', 'EXPRESS', 'GROUND_HD', 'PRIORITY_MAIL', 'MAIL'];
  const heavy = ['EXPEDITED', 'GROUND_HD', 'EXPRESS'];
  assertEquals(pickShippingLevel('MAIL', null, heavy), 'MAIL');
  assertEquals(pickShippingLevel('MAIL', 'GROUND_HD', light), 'MAIL');
  assertEquals(pickShippingLevel('MAIL', 'GROUND_HD', heavy), 'GROUND_HD');
  assertEquals(pickShippingLevel('MAIL', 'PRIORITY_MAIL', heavy), 'MAIL');
  assertEquals(pickShippingLevel('MAIL', 'GROUND_HD', null), 'MAIL');
});

Deno.test('shipping probe lists every book with its package, pages and quantity', async () => {
  const printables = await loadPrintables(fakeDb(printableRows));
  const probe = luluShippingProbeLines([item('both_bands_print_set'), item('sprouts_nb_print', 9)], printables);
  assertEquals(probe, [
    { pod_package_id: COIL, page_count: 240, quantity: 1 },
    { pod_package_id: COIL, page_count: 224, quantity: 1 },
    { pod_package_id: A5, page_count: 112, quantity: 1 },
    { pod_package_id: COIL, page_count: 245, quantity: 1 },
    { pod_package_id: COIL, page_count: 227, quantity: 1 },
    { pod_package_id: A5, page_count: 160, quantity: 1 },
    { pod_package_id: COIL, page_count: 224, quantity: 9 },
  ]);
});
