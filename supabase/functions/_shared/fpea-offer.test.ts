// Run with: deno test --no-lock --allow-env --allow-read supabase/functions/_shared/fpea-offer.test.ts
//
// FPEA 2027 convention offer (founder decisions 2026-10-30). What each block pins:
//   - the window, at its exact edges, in America/New_York (offsets proven, not assumed)
//   - the server gate: refused outside the window, bypassed only when asked (E2E twin)
//   - the Starter price: 25% off the list price, only with the offer
//   - print sessions: shipping 0 with the offer; printShippingCents itself unchanged
//   - the webhook gift: the right Starter band(s), and NO credit, promo code or Stripe call
//   - REGRESSION: every normal (non-FPEA) email, receipt and order confirmation is
//     byte-for-byte what origin/main produced before this offer existed (golden hashes),
//     and a request without `offer` can never reach an FPEA branch

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  FPEA_ENDS_AT_MS,
  FPEA_GIFT_BANDS_BY_SKU,
  FPEA_OFFER_ID,
  FPEA_OPENS_AT_MS,
  FPEA_SHIPPING_NAME,
  FPEA_STARTER_DISCOUNT_PERCENT,
  applyFpeaPrintOffer,
  applyFpeaStarterOffer,
  checkFpeaWindow,
  fpeaGiftBands,
  fpeaGiftDeliveryKey,
  fpeaLastDayLabel,
  fpeaLastDayShortLabel,
  fpeaOpensLabel,
  fpeaSessionExpiresAt,
  fpeaStarterPriceCents,
  fpeaWindowState,
  isFpeaGiftDeliveryKey,
  isFpeaOfferMetadata,
  offerNotApplicableRefusal,
  parseGiftBands,
  parseRequestedOffer,
} from './fpea-offer.ts';
import { queueFpeaGiftStarters } from './fpea-gift.ts';
import { STARTER_BANDS } from './starter-config.ts';
import { printShippingCents } from './print-pricing.ts';
import { luluBandsForSku, LULU_PRODUCTS } from './lulu-config.ts';
import { renderStarterDeliveryEmail } from './starter-email.ts';
import { loadOrderReceipt, renderReceiptHtml, renderReceiptText } from './receipt.ts';
import { buildOrderConfirmationEmail } from './order-messages.ts';
import type { OrderRow } from './order-db.ts';
import * as GOLDEN_INPUTS from './testdata/fpea-regression-inputs.ts';

const EM_DASH = /—/;
const SEC = 1000;

function nyWallClock(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
}

// ── The window ────────────────────────────────────────────────────────────

Deno.test('window bounds are midnight in New York, proven by formatting, not by the comment', () => {
  assertEquals(nyWallClock(FPEA_OPENS_AT_MS), '05/27/2027, 00:00:00');
  assertEquals(nyWallClock(FPEA_ENDS_AT_MS), '06/06/2027, 00:00:00');
  assertEquals(nyWallClock(FPEA_ENDS_AT_MS - SEC), '06/05/2027, 23:59:59');
  // Independently: the same instants as ISO strings with the EDT offset.
  assertEquals(FPEA_OPENS_AT_MS, Date.parse('2027-05-27T00:00:00-04:00'));
  assertEquals(FPEA_ENDS_AT_MS, Date.parse('2027-06-06T00:00:00-04:00'));
});

Deno.test('window edges: 2027-05-26 23:59:59 closed, 05-27 00:00 open, 06-05 23:59:59 open, 06-06 00:00 ended', () => {
  assertEquals(fpeaWindowState(Date.parse('2027-05-26T23:59:59-04:00')), 'not_open');
  assertEquals(fpeaWindowState(Date.parse('2027-05-26T23:59:59.999-04:00')), 'not_open');
  assertEquals(fpeaWindowState(Date.parse('2027-05-27T00:00:00-04:00')), 'open');
  assertEquals(fpeaWindowState(Date.parse('2027-06-01T12:00:00-04:00')), 'open');
  assertEquals(fpeaWindowState(Date.parse('2027-06-05T23:59:59-04:00')), 'open');
  assertEquals(fpeaWindowState(Date.parse('2027-06-05T23:59:59.999-04:00')), 'open');
  assertEquals(fpeaWindowState(Date.parse('2027-06-06T00:00:00-04:00')), 'ended');
  // UTC midnight on the first day is still the evening before in New York.
  assertEquals(fpeaWindowState(Date.parse('2027-05-27T00:00:00Z')), 'not_open');
  // Today (the day this was built) and long after.
  assertEquals(fpeaWindowState(Date.parse('2026-10-30T12:00:00Z')), 'not_open');
  assertEquals(fpeaWindowState(Date.parse('2028-01-01T00:00:00Z')), 'ended');
  assertEquals(fpeaWindowState(NaN), 'ended');
});

Deno.test('the date labels customers read come from the constants', () => {
  assertEquals(fpeaOpensLabel(), 'May 27, 2027');
  assertEquals(fpeaLastDayLabel(), 'June 5, 2027');
  assertEquals(fpeaLastDayShortLabel(), 'June 5');
});

// ── The server gate ───────────────────────────────────────────────────────

Deno.test('server gate: refuses before the window with OFFER_NOT_OPEN and after it with OFFER_ENDED', () => {
  const before = checkFpeaWindow(FPEA_OPENS_AT_MS - SEC, { bypassWindow: false });
  assert(!before.ok);
  assertEquals([before.status, before.code], [403, 'OFFER_NOT_OPEN']);
  assertEquals(before.error, 'The FPEA convention offer opens on May 27, 2027.');

  const after = checkFpeaWindow(FPEA_ENDS_AT_MS, { bypassWindow: false });
  assert(!after.ok);
  assertEquals([after.status, after.code], [403, 'OFFER_ENDED']);
  assertEquals(after.error, 'The FPEA convention offer ended on June 5, 2027. Everything is still available at the regular price.');

  for (const r of [before, after, offerNotApplicableRefusal()]) assert(!EM_DASH.test(r.error));
});

Deno.test('server gate: accepts inside the window; the E2E bypass only ever opens a CLOSED window, and says so', () => {
  assertEquals(checkFpeaWindow(FPEA_OPENS_AT_MS, { bypassWindow: false }), { ok: true, windowBypassed: false });
  assertEquals(checkFpeaWindow(FPEA_ENDS_AT_MS - 1, { bypassWindow: false }), { ok: true, windowBypassed: false });
  assertEquals(checkFpeaWindow(FPEA_OPENS_AT_MS, { bypassWindow: true }), { ok: true, windowBypassed: false });
  assertEquals(checkFpeaWindow(FPEA_OPENS_AT_MS - SEC, { bypassWindow: true }), { ok: true, windowBypassed: true });
  assertEquals(checkFpeaWindow(FPEA_ENDS_AT_MS, { bypassWindow: true }), { ok: true, windowBypassed: true });
});

Deno.test('a request without `offer` is NOT an offer request; anything but the exact id is refused, never ignored', () => {
  for (const raw of [undefined, null, '']) assertEquals(parseRequestedOffer(raw), { kind: 'none' });
  assertEquals(parseRequestedOffer(FPEA_OFFER_ID), { kind: 'fpea' });
  for (const raw of ['FPEA2027', 'fpea', 'fpea2028', ' fpea2027', 1, true, {}, []]) {
    assertEquals(parseRequestedOffer(raw), { kind: 'unknown' }, `value ${JSON.stringify(raw)}`);
  }
});

Deno.test('REGRESSION: the request bodies every existing buy box sends carry no offer, so they never enter an FPEA branch', () => {
  // The exact keys PrintBuyBox, StarterBuyBox, BookCheckoutController and the
  // preorder box send today (none of them has an `offer` field).
  const bodies: Record<string, unknown>[] = [
    { print_shop: true, items: [{ sku: 'sprouts_print_set', qty: 1 }], sms_consent: false, success_url: 'x', cancel_url: 'y', attribution: {} },
    { lookup_key: 'sprouts_starter_unit', attribution: {} },
    { lookup_key: 'seedlings_starter_unit', attribution: {} },
    { book_digital: true, sku: 'bte_pdf' },
    { lookup_key: 'deep_dive_guide', promo_code: 'X' },
  ];
  for (const b of bodies) assertEquals(parseRequestedOffer(b.offer), { kind: 'none' });
});

Deno.test('REGRESSION (structural): create-checkout reaches the FPEA helpers only behind its offer guards', async () => {
  const src = await Deno.readTextFile(new URL('../create-checkout/index.ts', import.meta.url));
  const count = (needle: string) => src.split(needle).length - 1;
  // Each apply call exists once, directly inside its own guard.
  assertEquals(count('applyFpeaStarterOffer(sessionParams'), 1);
  assertEquals(count('applyFpeaPrintOffer(sessionParams'), 1);
  assert(/if \(fpeaStarter\) \{\s*\n\s*applyFpeaStarterOffer\(sessionParams/.test(src));
  assert(/if \(fpeaPrint\) \{\s*\n\s*applyFpeaPrintOffer\(sessionParams/.test(src));
  // fpeaStarter / fpeaPrint start null and are set only after the window gate passes.
  assertEquals(count('let fpeaStarter: { windowBypassed: boolean } | null = null'), 1);
  assertEquals(count('let fpeaPrint: { windowBypassed: boolean; giftBands: FpeaGiftBand[] } | null = null'), 1);
  // Cart recovery is skipped only for FPEA sessions; the Back to Eden PDF path is untouched.
  assertEquals(count('if (!fpeaStarter) applyCheckoutRecovery(sessionParams)'), 1);
  assertEquals(count('if (!fpeaPrint) applyCheckoutRecovery(sessionParams)'), 1);
  assertEquals(count('applyCheckoutRecovery(sessionParams)'), 3);
});

// ── Pricing ───────────────────────────────────────────────────────────────

Deno.test('Starter price: 25% off the list price, $39.00 -> $29.25, for both bands', () => {
  assertEquals(FPEA_STARTER_DISCOUNT_PERCENT, 25);
  assertEquals(fpeaStarterPriceCents(3900), 2925);
  for (const band of ['sprouts', 'seedlings'] as const) {
    assertEquals(fpeaStarterPriceCents(STARTER_BANDS[band].priceCents), 2925, band);
  }
  assertEquals(fpeaStarterPriceCents(4999), 3749); // rounds to the nearest cent
  for (const bad of [0, -3900, 39.5, NaN]) assertThrows(() => fpeaStarterPriceCents(bad));
});

Deno.test('the /fpea Starter price the page shows comes from the same list price as STARTER_BANDS', async () => {
  // StarterBuyBox cannot import starter-config.ts (it reads Deno.env), so its own
  // PRICE_VALUE mirror is the page's list price. Hold the two equal for both bands.
  const src = await Deno.readTextFile(new URL('../../../web/components/islands/StarterBuyBox.tsx', import.meta.url));
  const m = src.match(/^const PRICE_VALUE = (\d+);/m);
  assert(m, 'PRICE_VALUE not found in StarterBuyBox.tsx');
  for (const band of ['sprouts', 'seedlings'] as const) assertEquals(Number(m[1]) * 100, STARTER_BANDS[band].priceCents, band);
  assert(src.includes('const listCents = PRICE_VALUE * 100;'));
  assert(src.includes('fpeaStarterPriceCents(listCents)'));
});

/** The Starter session exactly as create-checkout builds it today, before the offer. */
function normalStarterSession() {
  const metadata: Record<string, string> = { lookup_key: 'sprouts_starter_unit', attr_utm_source: 'qr' };
  const params: Record<string, any> = {
    mode: 'payment',
    line_items: [{ price: 'price_live_sprouts', quantity: 1 }],
    success_url: 'https://edeninstitute.health/starter/thank-you?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://edeninstitute.health/fpea?checkout=cancelled&item=starter-sprouts#starter-sprouts',
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    customer_creation: 'always',
    payment_intent_data: { metadata },
    metadata,
    invoice_creation: { enabled: true },
  };
  return { params, metadata };
}

Deno.test('Starter session with the offer: price_data at 2925 on the SAME product, lookup_key intact, no promo codes, no recovery', () => {
  const { params, metadata } = normalStarterSession();
  const now = Date.parse('2027-05-28T10:00:00-04:00');
  applyFpeaStarterOffer(params, metadata, { unit_amount: 3900, currency: 'usd', product: 'prod_V94RkwvXDYflDy', tax_behavior: 'exclusive' }, { windowBypassed: false, nowMs: now });
  assertEquals(params.line_items, [{ price_data: { currency: 'usd', unit_amount: 2925, product: 'prod_V94RkwvXDYflDy', tax_behavior: 'exclusive' }, quantity: 1 }]);
  assertEquals(params.allow_promotion_codes, false);
  assertEquals(params.discounts, undefined);
  assertEquals(metadata.lookup_key, 'sprouts_starter_unit'); // the webhook's normal paid-Starter dispatch
  assertEquals(metadata.offer, FPEA_OFFER_ID);
  assertEquals([metadata.offer_list_price_cents, metadata.offer_price_cents], ['3900', '2925']);
  assertEquals(params.payment_intent_data.metadata.offer, FPEA_OFFER_ID); // same object
  assertEquals(metadata.offer_window_bypassed, undefined);
  assertEquals(params.after_expiration, undefined);
  assertEquals(params.customer_creation, 'always'); // the Sprouts Customer binding, unchanged
  assert(params.expires_at * 1000 >= now + 30 * 60 * SEC && params.expires_at * 1000 <= now + 24 * 3600 * SEC);
  assert(!EM_DASH.test(params.custom_text.submit.message));
});

Deno.test('Starter session with the offer: an unspecified tax behaviour stays unspecified (Seedlings), a priceless Price is refused', () => {
  const { params, metadata } = normalStarterSession();
  applyFpeaStarterOffer(params, metadata, { unit_amount: 3900, currency: 'usd', product: { id: 'prod_VJavRFzu8VU6Ic' }, tax_behavior: 'unspecified' }, { windowBypassed: false, nowMs: FPEA_OPENS_AT_MS });
  assertEquals(params.line_items[0].price_data, { currency: 'usd', unit_amount: 2925, product: 'prod_VJavRFzu8VU6Ic' });
  const s2 = normalStarterSession();
  assertThrows(() => applyFpeaStarterOffer(s2.params, s2.metadata, { unit_amount: null, currency: 'usd', product: 'prod_x' }, { windowBypassed: false, nowMs: FPEA_OPENS_AT_MS }));
  assertThrows(() => applyFpeaStarterOffer(s2.params, s2.metadata, { unit_amount: 3900, currency: 'usd', product: null }, { windowBypassed: false, nowMs: FPEA_OPENS_AT_MS }));
});

/** The print session exactly as create-checkout builds it today for one Sprouts set. */
function normalPrintSession(shippingCents: number) {
  const metadata: Record<string, string> = {
    print_sku: 'sprouts_print_set',
    print_cart: '[{"sku":"sprouts_print_set","qty":1}]',
    fulfillment: 'lulu',
    sms_consent: 'false',
    affiliate_promo_code: 'KAMI10',
    affiliate_promo_id: 'promo_x',
  };
  const params: Record<string, any> = {
    mode: 'payment',
    line_items: [{ price: 'price_set', quantity: 1 }],
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: [{
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: shippingCents, currency: 'usd' },
        display_name: 'Shipping',
        tax_behavior: 'exclusive',
        tax_code: 'txcd_92010001',
      },
    }],
    custom_text: {
      submit: { message: 'Printed to order for you and shipped within the United States, tracked.' },
      shipping_address: { message: 'Your books ship from our print partner to this address.' },
    },
    metadata,
    payment_intent_data: { metadata },
    discounts: [{ promotion_code: 'promo_x' }],
  };
  return { params, metadata };
}

Deno.test('print session with the offer: shipping charges 0 under a plain name, no promo codes, gift bands in metadata', () => {
  const normal = printShippingCents([{ sku: 'sprouts_print_set', qty: 1 }])!;
  assertEquals(normal, 1200); // unchanged formula
  const { params, metadata } = normalPrintSession(normal);
  applyFpeaPrintOffer(params, metadata, { giftBands: ['sprouts'], windowBypassed: false, nowMs: FPEA_OPENS_AT_MS });
  const rate = params.shipping_options[0].shipping_rate_data;
  assertEquals(rate.fixed_amount, { amount: 0, currency: 'usd' });
  assertEquals(rate.display_name, FPEA_SHIPPING_NAME);
  assertEquals([rate.type, rate.tax_behavior, rate.tax_code], ['fixed_amount', 'exclusive', 'txcd_92010001']);
  assertEquals(params.line_items, [{ price: 'price_set', quantity: 1 }]); // the set's price is not touched
  assertEquals(params.discounts, undefined);
  assertEquals(params.allow_promotion_codes, false);
  assertEquals(metadata.affiliate_promo_code, undefined);
  assertEquals(metadata.affiliate_promo_id, undefined);
  assertEquals(metadata.offer, FPEA_OFFER_ID);
  assertEquals(metadata.offer_gift_starters, 'sprouts');
  assertEquals(metadata.print_sku, 'sprouts_print_set'); // the webhook's print dispatch key, unchanged
  assertEquals(params.payment_intent_data.metadata.offer, FPEA_OFFER_ID);
  assert(params.custom_text.submit.message.startsWith('FPEA convention offer: shipping is free, and the Sprouts Starter Unit download will be emailed to you right after you pay.'));
  assert(params.custom_text.submit.message.endsWith('Printed to order for you and shipped within the United States, tracked.'));
  assertEquals(params.custom_text.shipping_address, { message: 'Your books ship from our print partner to this address.' });
  assertEquals(params.after_expiration, undefined);
  assert(!EM_DASH.test(params.custom_text.submit.message));
});

Deno.test('print session with the offer: the bundle note names both Starters; a bypassed window is stamped', () => {
  const { params, metadata } = normalPrintSession(printShippingCents([{ sku: 'both_bands_print_set', qty: 1 }])!);
  applyFpeaPrintOffer(params, metadata, { giftBands: ['sprouts', 'seedlings'], windowBypassed: true, nowMs: FPEA_OPENS_AT_MS - 86400 * SEC });
  assertEquals(params.shipping_options[0].shipping_rate_data.fixed_amount.amount, 0);
  assertEquals(metadata.offer_gift_starters, 'sprouts,seedlings');
  assertEquals(metadata.offer_window_bypassed, 'true');
  assert(params.custom_text.submit.message.includes('the Sprouts and Seedlings Starter Unit downloads will be emailed'));
});

Deno.test('normal print shipping is unchanged: printShippingCents still charges what /books shows', () => {
  assertEquals(printShippingCents([{ sku: 'sprouts_print_set', qty: 1 }]), 1200);
  assertEquals(printShippingCents([{ sku: 'seedlings_print_set', qty: 1 }]), 1200);
  assertEquals(printShippingCents([{ sku: 'both_bands_print_set', qty: 1 }]), 1600);
});

Deno.test('FPEA sessions expire inside Stripe\'s 30 minute to 24 hour range, and at the window\'s end when that comes first', () => {
  const mid = Date.parse('2027-06-01T12:00:00-04:00');
  assertEquals(fpeaSessionExpiresAt(mid), Math.floor((mid + 23 * 3600 * SEC) / 1000));
  const lateEvening = Date.parse('2027-06-05T20:00:00-04:00');
  assertEquals(fpeaSessionExpiresAt(lateEvening), FPEA_ENDS_AT_MS / 1000);
  const lastMinutes = Date.parse('2027-06-05T23:50:00-04:00');
  assertEquals(fpeaSessionExpiresAt(lastMinutes), Math.floor((lastMinutes + 31 * 60 * SEC) / 1000));
  for (const now of [mid, lateEvening, lastMinutes, FPEA_OPENS_AT_MS - 86400 * SEC, FPEA_ENDS_AT_MS + 86400 * SEC]) {
    const secs = fpeaSessionExpiresAt(now) - now / 1000;
    assert(secs >= 30 * 60 && secs <= 24 * 3600, `expiry ${secs}s out of Stripe's range`);
  }
});

// ── Which Starters a cart gifts ───────────────────────────────────────────

Deno.test('gift bands: Sprouts set -> Sprouts, Seedlings set -> Seedlings, bundle -> both; notebooks and books -> none', () => {
  assertEquals(fpeaGiftBands(['sprouts_print_set']), ['sprouts']);
  assertEquals(fpeaGiftBands(['seedlings_print_set']), ['seedlings']);
  assertEquals(fpeaGiftBands(['both_bands_print_set']), ['sprouts', 'seedlings']);
  assertEquals(fpeaGiftBands(['both_bands_print_set', 'sprouts_nb_print', 'seedlings_nb_print']), ['sprouts', 'seedlings']);
  assertEquals(fpeaGiftBands(['sprouts_print_set', 'sprouts_nb_print']), ['sprouts']);
  assertEquals(fpeaGiftBands(['sprouts_nb_print', 'seedlings_nb_print']), []);
  assertEquals(fpeaGiftBands(['bte_paperback_print', 'bte_study_guide_print']), []);
  assertEquals(fpeaGiftBands([]), []);
  assertEquals(parseGiftBands('sprouts,seedlings'), ['sprouts', 'seedlings']);
  assertEquals(parseGiftBands('seedlings,evil'), ['seedlings']);
  assertEquals(parseGiftBands(undefined), []);
});

Deno.test('gift bands agree with the print catalogue (lulu-config) for every set SKU', () => {
  for (const [sku, bands] of Object.entries(FPEA_GIFT_BANDS_BY_SKU)) {
    assert(LULU_PRODUCTS.some((p) => p.sku === sku), `${sku} is not a print product`);
    assertEquals([...luluBandsForSku(sku)].sort(), [...bands].sort(), sku);
  }
});

// ── After payment: the webhook's gift ─────────────────────────────────────

function fakeDb(behaviour: (row: Record<string, unknown>) => { code?: string; message?: string } | null = () => null) {
  const calls: { table: string; op: string; row: Record<string, unknown> }[] = [];
  const db = {
    from(table: string) {
      return {
        insert: (row: Record<string, unknown>) => {
          calls.push({ table, op: 'insert', row });
          return Promise.resolve({ error: behaviour(row) });
        },
        select: () => { calls.push({ table, op: 'select', row: {} }); throw new Error('unexpected select'); },
        update: () => { calls.push({ table, op: 'update', row: {} }); throw new Error('unexpected update'); },
        upsert: () => { calls.push({ table, op: 'upsert', row: {} }); throw new Error('unexpected upsert'); },
      };
    },
  };
  return { db, calls };
}

let tokenN = 0;
const token = () => `tok${++tokenN}`;
const SID = 'cs_live_a1B2c3';

Deno.test('webhook gift, Sprouts set: one pending Sprouts delivery, keyed to the print session, nothing else written', async () => {
  const { db, calls } = fakeDb();
  const out = await queueFpeaGiftStarters(db, { sessionId: SID, orderId: 'ord-1', email: ' Mom@Example.com ', purchaserName: 'Ann Lee', skus: ['sprouts_print_set', 'sprouts_nb_print'] }, token);
  assertEquals(out.bands, ['sprouts']);
  assertEquals(out.queued, [fpeaGiftDeliveryKey(SID, 'sprouts')]);
  assertEquals(out.errors, []);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, 'starter_deliveries');
  const row = calls[0].row;
  assertEquals(row.stripe_checkout_session_id, `fpea_${SID}_sprouts`);
  assertEquals([row.order_id, row.email, row.purchaser_name, row.status], ['ord-1', 'mom@example.com', 'Ann Lee', 'pending']);
  assertEquals('band' in row, false); // Sprouts takes the column default, like every Sprouts row
  assert(isFpeaGiftDeliveryKey(row.stripe_checkout_session_id as string));
});

Deno.test('webhook gift, Seedlings set: one Seedlings delivery that names its band', async () => {
  const { db, calls } = fakeDb();
  const out = await queueFpeaGiftStarters(db, { sessionId: SID, orderId: null, email: 'a@b.co', purchaserName: null, skus: ['seedlings_print_set'] }, token);
  assertEquals(out.bands, ['seedlings']);
  assertEquals(calls.map((c) => [c.table, c.row.stripe_checkout_session_id, c.row.band]), [['starter_deliveries', `fpea_${SID}_seedlings`, 'seedlings']]);
});

Deno.test('webhook gift, both-years bundle: BOTH Starters, two distinct keys and tokens', async () => {
  const { db, calls } = fakeDb();
  const out = await queueFpeaGiftStarters(db, { sessionId: SID, orderId: 'ord-2', email: 'a@b.co', purchaserName: 'A', skus: ['both_bands_print_set', 'seedlings_nb_print'] }, token);
  assertEquals(out.bands, ['sprouts', 'seedlings']);
  assertEquals(out.queued, [`fpea_${SID}_sprouts`, `fpea_${SID}_seedlings`]);
  assertEquals(calls.map((c) => c.row.band ?? 'sprouts(default)'), ['sprouts(default)', 'seedlings']);
  assert(calls[0].row.download_token !== calls[1].row.download_token);
});

Deno.test('webhook gift: NO credit, NO promotion code, NO Stripe; only starter_deliveries is ever touched', async () => {
  for (const skus of [['sprouts_print_set'], ['seedlings_print_set'], ['both_bands_print_set']]) {
    const { db, calls } = fakeDb();
    await queueFpeaGiftStarters(db, { sessionId: SID, orderId: 'o', email: 'a@b.co', purchaserName: null, skus }, token);
    assert(calls.length > 0);
    for (const c of calls) assertEquals([c.table, c.op], ['starter_deliveries', 'insert']);
    for (const c of calls) assertEquals(Object.keys(c.row).some((k) => /credit|promo|coupon/i.test(k)), false);
  }
  // The module cannot reach the credit machinery at all: it imports nothing that does.
  const src = await Deno.readTextFile(new URL('./fpea-gift.ts', import.meta.url));
  // Code only: block comments and line comments removed.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const forbidden of ['starter-credit', 'starter_credits', 'issueStarterCredit', 'promotionCodes', 'coupons', 'Stripe']) {
    assert(!code.includes(forbidden), `fpea-gift.ts code mentions ${forbidden}`);
  }
  assertEquals((src.match(/^import .*$/gm) ?? []).map((l) => l.replace(/.*from '(.*)';$/, '$1')), ['./fpea-offer.ts']);
});

Deno.test('webhook gift: a redelivered webhook queues nothing twice; one band failing does not stop the other', async () => {
  const dup = fakeDb(() => ({ code: '23505', message: 'duplicate key' }));
  const again = await queueFpeaGiftStarters(dup.db, { sessionId: SID, orderId: 'o', email: 'a@b.co', purchaserName: null, skus: ['both_bands_print_set'] }, token);
  assertEquals(again.queued, []);
  assertEquals(again.alreadyQueued.length, 2);
  assertEquals(again.errors, []);

  const flaky = fakeDb((row) => (row.band === 'seedlings' ? { code: '500', message: 'boom' } : null));
  const out = await queueFpeaGiftStarters(flaky.db, { sessionId: SID, orderId: 'o', email: 'a@b.co', purchaserName: null, skus: ['both_bands_print_set'] }, token);
  assertEquals(out.queued, [`fpea_${SID}_sprouts`]);
  assertEquals(out.errors, ['seedlings: boom']);
});

Deno.test('webhook gift: no email means nothing queued and an error to report; no printed set means nothing at all', async () => {
  const a = fakeDb();
  const noEmail = await queueFpeaGiftStarters(a.db, { sessionId: SID, orderId: 'o', email: null, purchaserName: null, skus: ['sprouts_print_set'] }, token);
  assertEquals([a.calls.length, noEmail.errors.length], [0, 1]);
  const b = fakeDb();
  const none = await queueFpeaGiftStarters(b.db, { sessionId: SID, orderId: 'o', email: 'a@b.co', purchaserName: null, skus: ['sprouts_nb_print'] }, token);
  assertEquals([b.calls.length, none.errors.length, none.bands.length], [0, 0, 0]);
});

Deno.test('the webhook keys on metadata.offer and nothing else', () => {
  assert(isFpeaOfferMetadata({ offer: 'fpea2027', print_sku: 'sprouts_print_set' }));
  for (const m of [undefined, null, {}, { offer: 'FPEA2027' }, { print_sku: 'sprouts_print_set' }, 'fpea2027']) {
    assertEquals(isFpeaOfferMetadata(m), false, JSON.stringify(m));
  }
  assertEquals(isFpeaGiftDeliveryKey('cs_live_abc'), false);
  assertEquals(isFpeaGiftDeliveryKey('esa_abc'), false);
  assertEquals(isFpeaGiftDeliveryKey(null), false);
});

// ── The gifted Starter's email, the receipt and the confirmation ─────────

Deno.test('gift email: says FPEA and free, names the band, drops the refund line and the sell-the-print block, never shows a code', () => {
  for (const band of ['sprouts', 'seedlings'] as const) {
    const name = STARTER_BANDS[band].bandName;
    const other = band === 'sprouts' ? /seedlings/i : /sprouts/i;
    const r = renderStarterDeliveryEmail({ firstName: 'Ann', email: 'a@b.co', creditCode: 'EDEN-S-ABC234', downloadToken: 'tok', receipt: null, band, gift: FPEA_OFFER_ID });
    assertEquals(r.subject, `Your free ${name} Starter Unit is ready`);
    for (const part of [r.html, r.text]) {
      assert(part.includes(`Thank you for your order at the FPEA convention! As promised, here are the first nine weeks of Eden's Table, ${name}, free`));
      assert(part.includes('Printing begins 48 hours after you ordered'));
      assert(part.includes('/starter/downloads?t=tok'));
      assert(!part.includes('not refundable'));
      assert(!part.includes('See the printed year'));
      assert(!part.includes('EDEN-S-'));
      assert(!/\bkit\b|preorder|credit/i.test(part));
      assert(!EM_DASH.test(part));
      assert(!other.test(part), `${band} gift email mentions the other band`);
    }
  }
});

Deno.test('FPEA order receipt: shipping reads Free; the same order without the offer is unchanged', async () => {
  const fakeItems = { from: () => ({ select: () => ({ eq: async () => ({ data: GOLDEN_INPUTS.PRINT_ORDER_ITEMS, error: null }) }) }) };
  const base = GOLDEN_INPUTS.PRINT_ORDERS[0];
  const fpeaOrder: OrderRow = {
    ...base,
    amount_total_cents: 34998,
    raw: { ...base.raw, metadata: { ...base.raw.metadata, offer: FPEA_OFFER_ID, offer_gift_starters: 'sprouts' }, total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 2100 } },
  };
  // deno-lint-ignore no-explicit-any
  const receipt = (await loadOrderReceipt(fakeItems as any, fpeaOrder))!;
  assertEquals([receipt.shippingCents, receipt.freeShipping], [0, true]);
  assert(/<td[^>]*>Shipping<\/td>\s*<td[^>]*>Free<\/td>/.test(renderReceiptHtml(receipt)));
  assert(renderReceiptText(receipt).includes('Shipping   Free'));
});

Deno.test('FPEA order confirmation: one added paragraph naming free shipping and the gifted Starter(s)', () => {
  const base = GOLDEN_INPUTS.PRINT_ORDERS[0];
  const withOffer = (bands: string, lookup: string): OrderRow => ({
    ...base,
    lookup_key: lookup,
    raw: { ...base.raw, metadata: { ...base.raw.metadata, offer: FPEA_OFFER_ID, offer_gift_starters: bands } },
  });
  const sprouts = buildOrderConfirmationEmail(withOffer('sprouts', 'sprouts_print_set'), null).html;
  assert(sprouts.includes('Because you ordered with the FPEA convention offer, shipping is on me, and the Sprouts Starter Unit download is on its way in a separate email, so you can start this week while your books are printed.'));
  const both = buildOrderConfirmationEmail(withOffer('sprouts,seedlings', 'both_bands_print_set'), null).html;
  assert(both.includes('and the Sprouts and Seedlings Starter Unit downloads are on their way in separate emails,'));
  for (const html of [sprouts, both]) {
    assert(!EM_DASH.test(html));
    assert(!/\bkit\b|preorder|credit/i.test(html.replace(/<[^>]+>/g, ' ')));
  }
  // Without the offer the paragraph is absent.
  assert(!buildOrderConfirmationEmail(base, null).html.includes('FPEA'));
});

// ── REGRESSION: byte-for-byte golden hashes from origin/main 5eee539 ─────

const GOLDEN: Record<string, string> = {
  starter_email_0: 'a75bacd45186e965f80dc736683937fe0675fc2e2f0ef5c386bf92970c967038',
  starter_email_1: 'a4431943685711ff8058d89f20c3d8cf81b68fedf08a0af5dc2a68e16a1dbd71',
  starter_email_2: '1e346959c52166fae5daeacc0dfc369a769fbad8df09e484f5c03b6e74584849',
  receipt_starter: '48d4b460a520972d3713c2f29108dea06820e8b05aa49672239b7704e78d186e',
  receipt_shipped: 'a96db1e3d0b0ffddaf134f5f59b698f2691e55347b065ac469558b4865062d64',
  receipt_zero: '1467e7f99c7771449aec6c063a09dac48b9ed10c796fb5bcff9a54d6193cda2e',
  order_receipt_0: 'a04c3c62386a81b2545053e5ffcc7e579aacf10489c7c21c23b630a2c0062664',
  confirmation_0: 'ccee98350ef98a2854d92948cc88eb9936f94a5bd0bb6f56733695897c086b86',
  order_receipt_1: 'd9586de8f222f5da83b636d33df5b92bd2bd63a82743df83df4718ad00c7f58c',
  confirmation_1: 'f6224d9fec9036222e00be121b9505edde6beff3eef604aa73e888623ae28e72',
  order_receipt_2: 'a04c3c62386a81b2545053e5ffcc7e579aacf10489c7c21c23b630a2c0062664',
  confirmation_2: '43ed4dfe7c5d55b932e7c1628cf735d01d5165315446bd30fa1aa0a412821aa3',
  order_receipt_3: 'a04c3c62386a81b2545053e5ffcc7e579aacf10489c7c21c23b630a2c0062664',
  confirmation_3: '09b965ec8e16b6ef74ce9a45b5576ec834604227ceed7310b8d41c06927c7a60',
};

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.test('REGRESSION: normal Starter emails, receipts and print confirmations are byte-for-byte unchanged', async () => {
  const got: Record<string, string> = {};
  for (const [i, m] of GOLDEN_INPUTS.STARTER_EMAIL_MODELS.entries()) {
    const r = renderStarterDeliveryEmail(m);
    got[`starter_email_${i}`] = await sha256(r.subject + '\n' + r.html + '\n' + r.text);
  }
  const receipts = { starter: GOLDEN_INPUTS.RECEIPT_STARTER, shipped: GOLDEN_INPUTS.RECEIPT_PRINT_SHIPPED, zero: GOLDEN_INPUTS.RECEIPT_PRINT_ZERO_SHIPPING };
  for (const [k, r] of Object.entries(receipts)) got[`receipt_${k}`] = await sha256(renderReceiptHtml(r) + '\n' + renderReceiptText(r));
  const fakeItems = { from: () => ({ select: () => ({ eq: async () => ({ data: GOLDEN_INPUTS.PRINT_ORDER_ITEMS, error: null }) }) }) };
  for (const [i, o] of GOLDEN_INPUTS.PRINT_ORDERS.entries()) {
    // deno-lint-ignore no-explicit-any
    const receipt = await loadOrderReceipt(fakeItems as any, o);
    got[`order_receipt_${i}`] = await sha256(JSON.stringify(receipt));
    const withR = buildOrderConfirmationEmail(o, receipt);
    const without = buildOrderConfirmationEmail(o, null);
    got[`confirmation_${i}`] = await sha256(withR.subject + '\n' + withR.html + '\n' + without.subject + '\n' + without.html);
  }
  assertEquals(got, GOLDEN);
});
