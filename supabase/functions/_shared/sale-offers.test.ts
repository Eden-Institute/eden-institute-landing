// Run with: deno test --no-lock --allow-env --allow-read supabase/functions/_shared/sale-offers.test.ts
//
// The two site-wide 2027 sale weeks (founder decision 2026-11-20, whole site) and the
// offer registry they share with FPEA. What each block pins:
//   - both windows, at their exact edges, in America/Chicago (CST in February, CDT in
//     July: proven by formatting, not assumed)
//   - activeSiteSale: the right week or nothing, and never the FPEA offer
//   - the server gates: window refused outside, perk refused where it does not apply
//   - Spring: the Starter at 25% off the real Price, the FPEA mechanics exactly
//   - Summer: print shipping 0 and the gifted Starter(s), the FPEA mechanics exactly
//   - after payment: the webhook, receipt, confirmation and gift email key on the
//     print-gift offer and name it; gift keys have their own prefix
//   - FPEA reads exactly as before through the registry

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  FPEA_OFFER,
  FPEA_OFFER_ID,
  SALE_OFFERS,
  SPRING_2027_OFFER,
  SPRING_2027_OFFER_ID,
  SUMMER_2027_OFFER,
  SUMMER_2027_OFFER_ID,
  activeSiteSale,
  applySalePrintOffer,
  applySaleStarterOffer,
  checkOfferWindow,
  giftOfferForDeliveryKey,
  offerGiftDeliveryKey,
  offerLastDayLabel,
  offerNotApplicableRefusalFor,
  offerOpensLabel,
  offerSessionExpiresAt,
  offerStarterPriceCents,
  offerWindowState,
  parseRequestedSaleOffer,
  printGiftOfferFromMetadata,
  saleOfferById,
  saleOfferFromMetadata,
} from './sale-offers.ts';
import * as FPEA from './fpea-offer.ts';
import { queueFpeaGiftStarters, queueOfferGiftStarters } from './fpea-gift.ts';
import { STARTER_BANDS } from './starter-config.ts';
import { printShippingCents } from './print-pricing.ts';
import { renderStarterDeliveryEmail } from './starter-email.ts';
import { loadOrderReceipt } from './receipt.ts';
import { buildOrderConfirmationEmail } from './order-messages.ts';
import type { OrderRow } from './order-db.ts';
import * as GOLDEN_INPUTS from './testdata/fpea-regression-inputs.ts';

const EM_DASH = /—/;
const SEC = 1000;

function chicagoWallClock(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  });
}

// ── The registry ──────────────────────────────────────────────────────────

Deno.test('registry: three offers, unique ids and gift prefixes, perks as decided', () => {
  assertEquals(SALE_OFFERS.map((o) => o.id), ['fpea2027', 'spring2027', 'summer2027']);
  assertEquals([SPRING_2027_OFFER_ID, SUMMER_2027_OFFER_ID], ['spring2027', 'summer2027']);
  const prefixes = SALE_OFFERS.map((o) => o.giftKeyPrefix).filter(Boolean);
  assertEquals(new Set(prefixes).size, prefixes.length);
  for (const p of prefixes) for (const taken of ['cs_', 'esa_', 'gift_']) assert(!p!.startsWith(taken), `${p} collides with ${taken}`);
  // FPEA: both perks, /fpea only. Spring: Starter only. Summer: print only.
  assertEquals([FPEA_OFFER.siteWide, FPEA_OFFER.starterDiscountPercent, FPEA_OFFER.printGift], [false, 25, true]);
  assertEquals([SPRING_2027_OFFER.siteWide, SPRING_2027_OFFER.starterDiscountPercent, SPRING_2027_OFFER.printGift], [true, 25, false]);
  assertEquals([SUMMER_2027_OFFER.siteWide, SUMMER_2027_OFFER.starterDiscountPercent, SUMMER_2027_OFFER.printGift], [true, null, true]);
  assertEquals([SPRING_2027_OFFER.giftKeyPrefix, SUMMER_2027_OFFER.giftKeyPrefix], [null, 'summer2027_']);
  for (const o of SALE_OFFERS) {
    for (const v of Object.values(o.copy)) if (v) assert(!EM_DASH.test(v), `${o.id}: ${v}`);
    assert(o.endsAtMs > o.opensAtMs);
  }
});

Deno.test('FPEA through the registry is exactly the old FPEA values', () => {
  assertEquals(FPEA.FPEA_OFFER_ID, 'fpea2027');
  assertEquals(FPEA.FPEA_TIME_ZONE, 'America/New_York');
  assertEquals(FPEA.FPEA_OPENS_AT_MS, Date.UTC(2027, 4, 27, 4, 0, 0));
  assertEquals(FPEA.FPEA_ENDS_AT_MS, Date.UTC(2027, 5, 6, 4, 0, 0));
  assertEquals(FPEA.FPEA_GIFT_KEY_PREFIX, 'fpea_');
  assertEquals(FPEA.FPEA_SHIPPING_NAME, 'Free shipping (FPEA convention offer)');
  assertEquals(FPEA.FPEA_STARTER_CHECKOUT_NOTE, 'FPEA convention price: 25% off the Starter Unit. Your download link is on the next page and in your email.');
  assertEquals(FPEA.offerNotApplicableRefusal().error, 'The FPEA convention offer is for the printed curriculum sets and the Starter Units.');
  assertEquals(FPEA.FPEA_PRINT_SET_SKUS, ['sprouts_print_set', 'seedlings_print_set', 'both_bands_print_set']);
});

// ── Windows ───────────────────────────────────────────────────────────────

Deno.test('Spring Planning Week bounds are midnight in Chicago, Central STANDARD time (UTC-6)', () => {
  assertEquals(chicagoWallClock(SPRING_2027_OFFER.opensAtMs), '02/22/2027, 00:00:00 CST');
  assertEquals(chicagoWallClock(SPRING_2027_OFFER.endsAtMs - SEC), '02/28/2027, 23:59:59 CST');
  assertEquals(chicagoWallClock(SPRING_2027_OFFER.endsAtMs), '03/01/2027, 00:00:00 CST');
  assertEquals(SPRING_2027_OFFER.opensAtMs, Date.parse('2027-02-22T00:00:00-06:00'));
  assertEquals(SPRING_2027_OFFER.endsAtMs, Date.parse('2027-03-01T00:00:00-06:00'));
  assertEquals(SPRING_2027_OFFER.timeZone, 'America/Chicago');
  assertEquals([offerOpensLabel(SPRING_2027_OFFER), offerLastDayLabel(SPRING_2027_OFFER)], ['February 22, 2027', 'February 28, 2027']);
});

Deno.test('Back-to-School Week bounds are midnight in Chicago, Central DAYLIGHT time (UTC-5)', () => {
  assertEquals(chicagoWallClock(SUMMER_2027_OFFER.opensAtMs), '07/05/2027, 00:00:00 CDT');
  assertEquals(chicagoWallClock(SUMMER_2027_OFFER.endsAtMs - SEC), '07/11/2027, 23:59:59 CDT');
  assertEquals(chicagoWallClock(SUMMER_2027_OFFER.endsAtMs), '07/12/2027, 00:00:00 CDT');
  assertEquals(SUMMER_2027_OFFER.opensAtMs, Date.parse('2027-07-05T00:00:00-05:00'));
  assertEquals(SUMMER_2027_OFFER.endsAtMs, Date.parse('2027-07-12T00:00:00-05:00'));
  assertEquals([offerOpensLabel(SUMMER_2027_OFFER), offerLastDayLabel(SUMMER_2027_OFFER)], ['July 5, 2027', 'July 11, 2027']);
});

Deno.test('window edges: the first and last second are open, one second either side is not', () => {
  const s = SPRING_2027_OFFER;
  assertEquals(offerWindowState(s, Date.parse('2027-02-21T23:59:59.999-06:00')), 'not_open');
  assertEquals(offerWindowState(s, Date.parse('2027-02-22T00:00:00-06:00')), 'open');
  assertEquals(offerWindowState(s, Date.parse('2027-02-28T23:59:59.999-06:00')), 'open');
  assertEquals(offerWindowState(s, Date.parse('2027-03-01T00:00:00-06:00')), 'ended');
  // UTC midnight on Feb 22 is still Feb 21 in Chicago.
  assertEquals(offerWindowState(s, Date.parse('2027-02-22T00:00:00Z')), 'not_open');
  const u = SUMMER_2027_OFFER;
  assertEquals(offerWindowState(u, Date.parse('2027-07-04T23:59:59.999-05:00')), 'not_open');
  assertEquals(offerWindowState(u, Date.parse('2027-07-05T00:00:00-05:00')), 'open');
  assertEquals(offerWindowState(u, Date.parse('2027-07-11T23:59:59.999-05:00')), 'open');
  assertEquals(offerWindowState(u, Date.parse('2027-07-12T00:00:00-05:00')), 'ended');
  for (const o of [s, u]) assertEquals(offerWindowState(o, NaN), 'ended');
});

Deno.test('activeSiteSale: the open week, nothing between weeks, and never FPEA', () => {
  assertEquals(activeSiteSale(Date.parse('2026-11-20T12:00:00Z')), null); // the day this was built
  assertEquals(activeSiteSale(Date.parse('2027-02-21T23:59:59-06:00')), null);
  assertEquals(activeSiteSale(Date.parse('2027-02-22T00:00:00-06:00'))?.id, 'spring2027');
  assertEquals(activeSiteSale(Date.parse('2027-02-28T23:59:59-06:00'))?.id, 'spring2027');
  assertEquals(activeSiteSale(Date.parse('2027-03-01T00:00:00-06:00')), null);
  // Inside the FPEA window the site shows nothing: FPEA stays on /fpea.
  assertEquals(FPEA.fpeaWindowState(Date.parse('2027-06-01T12:00:00-04:00')), 'open');
  assertEquals(activeSiteSale(Date.parse('2027-06-01T12:00:00-04:00')), null);
  assertEquals(activeSiteSale(Date.parse('2027-07-05T00:00:00-05:00'))?.id, 'summer2027');
  assertEquals(activeSiteSale(Date.parse('2027-07-11T23:59:59-05:00'))?.id, 'summer2027');
  assertEquals(activeSiteSale(Date.parse('2027-07-12T00:00:00-05:00')), null);
  assertEquals(activeSiteSale(NaN), null);
});

// ── The server gates ──────────────────────────────────────────────────────

Deno.test('request parsing: the three exact ids, nothing else, and no offer stays no offer', () => {
  for (const raw of [undefined, null, '']) assertEquals(parseRequestedSaleOffer(raw), { kind: 'none' });
  for (const o of SALE_OFFERS) assertEquals(parseRequestedSaleOffer(o.id), { kind: 'offer', offer: o });
  for (const raw of ['SPRING2027', 'spring', 'spring2028', ' summer2027', 'summer2027 ', 'fpea', 1, true, {}, []]) {
    assertEquals(parseRequestedSaleOffer(raw), { kind: 'unknown' }, `value ${JSON.stringify(raw)}`);
  }
  // The FPEA-only parser still reads the new ids as unknown (it is not what create-checkout uses).
  assertEquals(FPEA.parseRequestedOffer('spring2027'), { kind: 'unknown' });
});

Deno.test('window gate: OFFER_NOT_OPEN before, OFFER_ENDED after, with the sale named and dated', () => {
  const s = SPRING_2027_OFFER;
  const before = checkOfferWindow(s, s.opensAtMs - SEC, { bypassWindow: false });
  assert(!before.ok);
  assertEquals([before.status, before.code, before.error], [403, 'OFFER_NOT_OPEN', 'The Spring Planning Week sale opens on February 22, 2027.']);
  const after = checkOfferWindow(s, s.endsAtMs, { bypassWindow: false });
  assert(!after.ok);
  assertEquals([after.status, after.code, after.error], [403, 'OFFER_ENDED', 'The Spring Planning Week sale ended on February 28, 2027. Everything is still available at the regular price.']);
  const u = SUMMER_2027_OFFER;
  const ub = checkOfferWindow(u, u.opensAtMs - SEC, { bypassWindow: false });
  assert(!ub.ok);
  assertEquals(ub.error, 'The Back-to-School Week sale opens on July 5, 2027.');
  const ua = checkOfferWindow(u, u.endsAtMs, { bypassWindow: false });
  assert(!ua.ok);
  assertEquals(ua.error, 'The Back-to-School Week sale ended on July 11, 2027. Everything is still available at the regular price.');
  for (const o of [s, u]) {
    assertEquals(checkOfferWindow(o, o.opensAtMs, { bypassWindow: false }), { ok: true, windowBypassed: false });
    assertEquals(checkOfferWindow(o, o.endsAtMs - 1, { bypassWindow: false }), { ok: true, windowBypassed: false });
    // The E2E twin's bypass only ever opens a CLOSED window, and says so.
    assertEquals(checkOfferWindow(o, o.opensAtMs - SEC, { bypassWindow: true }), { ok: true, windowBypassed: true });
  }
  for (const r of [before, after, ub, ua]) assert(!EM_DASH.test((r as { error: string }).error));
});

Deno.test('perk gate: spring on a print set and summer on a Starter are refused as OFFER_NOT_APPLICABLE', () => {
  const sp = offerNotApplicableRefusalFor(SPRING_2027_OFFER);
  assertEquals([sp.status, sp.code], [400, 'OFFER_NOT_APPLICABLE']);
  assertEquals(sp.error, 'The Spring Planning Week sale is for the Starter Units. The printed sets are at their regular price this week.');
  const su = offerNotApplicableRefusalFor(SUMMER_2027_OFFER);
  assertEquals(su.error, 'The Back-to-School Week sale is for the printed curriculum sets. The Starter Units are at their regular price this week.');
  // The session helpers refuse too, so a guard slip can never discount the wrong thing.
  const { params, metadata } = normalStarterSession();
  assertThrows(() => applySaleStarterOffer(params, metadata, STARTER_PRICE, { offer: SUMMER_2027_OFFER, windowBypassed: false, nowMs: SUMMER_2027_OFFER.opensAtMs }));
  const p = normalPrintSession(1200);
  assertThrows(() => applySalePrintOffer(p.params, p.metadata, { offer: SPRING_2027_OFFER, giftBands: ['sprouts'], windowBypassed: false, nowMs: SPRING_2027_OFFER.opensAtMs }));
  assertThrows(() => offerStarterPriceCents(SUMMER_2027_OFFER, 3900));
  assertThrows(() => offerGiftDeliveryKey(SPRING_2027_OFFER, 'cs_live_x', 'sprouts'));
});

Deno.test('create-checkout gates each perk on the offer it was asked for (structural)', async () => {
  const src = await Deno.readTextFile(new URL('../create-checkout/index.ts', import.meta.url));
  assert(src.includes('if (offer.starterDiscountPercent == null || !starterBandForLookupKey(lookup_key)) return offerRefused(offerNotApplicableRefusalFor(offer))'));
  assert(src.includes('if (!offer.printGift || giftBands.length === 0 || bands.some((b) => isBookBand(b))) return offerRefused(offerNotApplicableRefusalFor(offer))'));
  assert(src.includes('checkOfferWindow(offer, Date.now(), { bypassWindow: false })'));
  assert(src.includes('checkOfferWindow(offer, Date.now(), { bypassWindow: E2E_MODE })'));
  assert(src.includes('if (requestedOffer.kind === "unknown") return offerRefused(offerUnknownRefusal())'));
});

// ── Spring: the Starter at 25% off ────────────────────────────────────────

const STARTER_PRICE = { unit_amount: 3900, currency: 'usd', product: 'prod_V94RkwvXDYflDy', tax_behavior: 'exclusive' };

function normalStarterSession() {
  const metadata: Record<string, string> = { lookup_key: 'sprouts_starter_unit', affiliate_promo_code: 'LIZ10', affiliate_promo_id: 'promo_x' };
  // deno-lint-ignore no-explicit-any
  const params: Record<string, any> = {
    mode: 'payment',
    line_items: [{ price: 'price_live_sprouts', quantity: 1 }],
    allow_promotion_codes: true,
    discounts: [{ promotion_code: 'promo_x' }],
    payment_intent_data: { metadata },
    metadata,
  };
  return { params, metadata };
}

Deno.test('Spring Starter session: price_data at 25% off the real Price, same product, no codes, spring2027 stamped', () => {
  for (const band of ['sprouts', 'seedlings'] as const) {
    assertEquals(offerStarterPriceCents(SPRING_2027_OFFER, STARTER_BANDS[band].priceCents), 2925, band);
  }
  const { params, metadata } = normalStarterSession();
  const now = Date.parse('2027-02-24T10:00:00-06:00');
  applySaleStarterOffer(params, metadata, STARTER_PRICE, { offer: SPRING_2027_OFFER, windowBypassed: false, nowMs: now });
  assertEquals(params.line_items, [{ price_data: { currency: 'usd', unit_amount: 2925, product: 'prod_V94RkwvXDYflDy', tax_behavior: 'exclusive' }, quantity: 1 }]);
  assertEquals([params.allow_promotion_codes, params.discounts], [false, undefined]);
  assertEquals([metadata.affiliate_promo_code, metadata.affiliate_promo_id], [undefined, undefined]);
  assertEquals(metadata.lookup_key, 'sprouts_starter_unit');
  assertEquals(metadata.offer, 'spring2027');
  assertEquals([metadata.offer_list_price_cents, metadata.offer_price_cents], ['3900', '2925']);
  assertEquals(metadata.offer_window_bypassed, undefined);
  assertEquals(params.custom_text.submit.message, 'Spring Planning Week price: 25% off the Starter Unit. Your download link is on the next page and in your email.');
  assertEquals(params.after_expiration, undefined);
  assert(params.expires_at * 1000 >= now + 30 * 60 * SEC && params.expires_at * 1000 <= now + 24 * 3600 * SEC);
  // A paid spring Starter is not a print-gift session: the webhook queues no gift for it.
  assertEquals(printGiftOfferFromMetadata(metadata), null);
  assertEquals(saleOfferFromMetadata(metadata)?.id, 'spring2027');
});

Deno.test('offer sessions expire at the window end when that comes first, inside Stripe\'s range', () => {
  for (const o of [SPRING_2027_OFFER, SUMMER_2027_OFFER]) {
    const lateLastDay = o.endsAtMs - 4 * 3600 * SEC;
    assertEquals(offerSessionExpiresAt(o, lateLastDay), o.endsAtMs / 1000);
    const lastMinutes = o.endsAtMs - 10 * 60 * SEC;
    assertEquals(offerSessionExpiresAt(o, lastMinutes), Math.floor((lastMinutes + 31 * 60 * SEC) / 1000));
    const mid = o.opensAtMs + 2 * 86400 * SEC;
    assertEquals(offerSessionExpiresAt(o, mid), Math.floor((mid + 23 * 3600 * SEC) / 1000));
  }
});

// ── Summer: free shipping and the gifted Starter(s) ───────────────────────

function normalPrintSession(shippingCents: number) {
  const metadata: Record<string, string> = { print_sku: 'sprouts_print_set', fulfillment: 'lulu', affiliate_promo_code: 'KAMI10', affiliate_promo_id: 'promo_x' };
  // deno-lint-ignore no-explicit-any
  const params: Record<string, any> = {
    mode: 'payment',
    line_items: [{ price: 'price_set', quantity: 1 }],
    shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: shippingCents, currency: 'usd' }, display_name: 'Shipping', tax_behavior: 'exclusive', tax_code: 'txcd_92010001' } }],
    custom_text: { submit: { message: 'Printed to order for you and shipped within the United States, tracked.' } },
    metadata,
    payment_intent_data: { metadata },
    discounts: [{ promotion_code: 'promo_x' }],
  };
  return { params, metadata };
}

Deno.test('Summer print session: shipping 0 under its own name, no codes, gift bands and summer2027 stamped', () => {
  const { params, metadata } = normalPrintSession(printShippingCents([{ sku: 'sprouts_print_set', qty: 1 }])!);
  applySalePrintOffer(params, metadata, { offer: SUMMER_2027_OFFER, giftBands: ['sprouts'], windowBypassed: false, nowMs: SUMMER_2027_OFFER.opensAtMs });
  const rate = params.shipping_options[0].shipping_rate_data;
  assertEquals(rate.fixed_amount, { amount: 0, currency: 'usd' });
  assertEquals(rate.display_name, 'Free shipping (Back-to-School Week)');
  assertEquals([rate.tax_behavior, rate.tax_code], ['exclusive', 'txcd_92010001']);
  assertEquals(params.line_items, [{ price: 'price_set', quantity: 1 }]);
  assertEquals([params.discounts, params.allow_promotion_codes, metadata.affiliate_promo_code], [undefined, false, undefined]);
  assertEquals([metadata.offer, metadata.offer_gift_starters, metadata.print_sku], ['summer2027', 'sprouts', 'sprouts_print_set']);
  assertEquals(params.custom_text.submit.message, 'Back-to-School Week: shipping is free, and the Sprouts Starter Unit download will be emailed to you right after you pay. Printed to order for you and shipped within the United States, tracked.');
  assertEquals(params.after_expiration, undefined);
  assertEquals(printGiftOfferFromMetadata(metadata)?.id, 'summer2027');
});

Deno.test('Summer both-years set: both Starters named, two summer2027_ gift keys', async () => {
  const { params, metadata } = normalPrintSession(1600);
  applySalePrintOffer(params, metadata, { offer: SUMMER_2027_OFFER, giftBands: ['sprouts', 'seedlings'], windowBypassed: true, nowMs: SUMMER_2027_OFFER.opensAtMs - 86400 * SEC });
  assertEquals([metadata.offer_gift_starters, metadata.offer_window_bypassed], ['sprouts,seedlings', 'true']);
  assert(params.custom_text.submit.message.includes('the Sprouts and Seedlings Starter Unit downloads will be emailed'));

  const calls: Record<string, unknown>[] = [];
  const db = { from: (t: string) => ({ insert: (row: Record<string, unknown>) => { calls.push({ t, ...row }); return Promise.resolve({ error: null }); } }) };
  let n = 0;
  const out = await queueOfferGiftStarters(db, SUMMER_2027_OFFER, { sessionId: 'cs_live_S', orderId: 'o', email: 'A@B.co', purchaserName: null, skus: ['both_bands_print_set', 'sprouts_nb_print'] }, () => `t${++n}`);
  assertEquals(out.queued, ['summer2027_cs_live_S_sprouts', 'summer2027_cs_live_S_seedlings']);
  assertEquals(calls.map((c) => [c.t, c.band ?? 'default', c.email]), [['starter_deliveries', 'default', 'a@b.co'], ['starter_deliveries', 'seedlings', 'a@b.co']]);
  for (const c of calls) assertEquals(Object.keys(c).some((k) => /credit|promo|coupon/i.test(k)), false);
  // An offer without the print gift queues nothing, whatever the cart.
  const none = await queueOfferGiftStarters(db, SPRING_2027_OFFER, { sessionId: 'cs_live_S', orderId: 'o', email: 'a@b.co', purchaserName: null, skus: ['sprouts_print_set'] });
  assertEquals([none.bands.length, calls.length], [0, 2]);
  // The FPEA call is unchanged: fpea_ keys.
  const f = await queueFpeaGiftStarters(db, { sessionId: 'cs_live_F', orderId: 'o', email: 'a@b.co', purchaserName: null, skus: ['sprouts_print_set'] }, () => 'x');
  assertEquals(f.queued, ['fpea_cs_live_F_sprouts']);
});

// ── After payment ─────────────────────────────────────────────────────────

Deno.test('gift keys map back to their offer; bought, ESA and founder-gift keys map to none', () => {
  assertEquals(giftOfferForDeliveryKey(offerGiftDeliveryKey(SUMMER_2027_OFFER, 'cs_live_a', 'seedlings'))?.id, 'summer2027');
  assertEquals(giftOfferForDeliveryKey('fpea_cs_live_a_sprouts')?.id, FPEA_OFFER_ID);
  for (const k of ['cs_live_a', 'cs_test_a', 'esa_0123', 'gift_sprouts_0123', '', null, undefined]) assertEquals(giftOfferForDeliveryKey(k), null);
  assertEquals(FPEA.isFpeaGiftDeliveryKey('summer2027_cs_live_a_sprouts'), false);
});

Deno.test('the webhook keys on a known print-gift offer in metadata.offer and nothing else', () => {
  assertEquals(printGiftOfferFromMetadata({ offer: 'summer2027' })?.id, 'summer2027');
  assertEquals(printGiftOfferFromMetadata({ offer: 'fpea2027' })?.id, 'fpea2027');
  for (const m of [undefined, null, {}, { offer: 'spring2027' }, { offer: 'SUMMER2027' }, { print_sku: 'sprouts_print_set' }, 'summer2027']) {
    assertEquals(printGiftOfferFromMetadata(m), null, JSON.stringify(m));
  }
  assertEquals(saleOfferById('nope'), null);
});

Deno.test('summer gift email names Back-to-School Week, says free, drops the refund line and never says FPEA', () => {
  for (const band of ['sprouts', 'seedlings'] as const) {
    const name = STARTER_BANDS[band].bandName;
    const r = renderStarterDeliveryEmail({ firstName: 'Ann', email: 'a@b.co', creditCode: 'EDEN-S-ABC234', downloadToken: 'tok', receipt: null, band, gift: SUMMER_2027_OFFER_ID });
    assertEquals(r.subject, `Your free ${name} Starter Unit is ready`);
    for (const part of [r.html, r.text]) {
      assert(part.includes(`Thank you for your order during Back-to-School Week! As promised, here are the first nine weeks of Eden's Table, ${name}, free`));
      assert(part.includes('Printing begins 48 hours after you ordered'));
      assert(!part.includes('not refundable'));
      assert(!part.includes('See the printed year'));
      assert(!/FPEA|convention|EDEN-S-|\bkit\b|preorder|credit/i.test(part));
      assert(!EM_DASH.test(part));
    }
  }
});

Deno.test('summer order: confirmation names Back-to-School Week and the gift; receipt shipping reads Free', async () => {
  const base = GOLDEN_INPUTS.PRINT_ORDERS[0];
  const order = (bands: string): OrderRow => ({
    ...base,
    raw: { ...base.raw, metadata: { ...base.raw.metadata, offer: SUMMER_2027_OFFER_ID, offer_gift_starters: bands }, total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 2100 } },
  });
  const html = buildOrderConfirmationEmail(order('sprouts'), null).html;
  assert(html.includes('Because you ordered during Back-to-School Week, shipping is on me, and the Sprouts Starter Unit download is on its way in a separate email, so you can start this week while your books are printed.'));
  assert(!/FPEA/.test(html));
  assert(!EM_DASH.test(html));
  const fakeItems = { from: () => ({ select: () => ({ eq: async () => ({ data: GOLDEN_INPUTS.PRINT_ORDER_ITEMS, error: null }) }) }) };
  // deno-lint-ignore no-explicit-any
  const receipt = (await loadOrderReceipt(fakeItems as any, order('sprouts')))!;
  assertEquals([receipt.shippingCents, receipt.freeShipping], [0, true]);
  // A spring2027 stamp on an order is not a print gift: no paragraph, no "Free" row.
  const spring: OrderRow = { ...base, raw: { ...base.raw, metadata: { ...base.raw.metadata, offer: SPRING_2027_OFFER_ID } } };
  assertEquals(buildOrderConfirmationEmail(spring, null).html, buildOrderConfirmationEmail(base, null).html);
});
