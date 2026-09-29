// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/checkout-recovery.test.ts
//
// Abandoned-checkout recovery (2026-09-28): the session params, the webhook's skip
// rules, the email, and a source check that the params reach exactly the three
// create-checkout paths they should (main, print, Back to Eden PDF) and never the
// closed preorder path. No network.

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CART_RECOVERY_EXPIRY_SECONDS,
  CART_RECOVERY_SUBJECT,
  applyCheckoutRecovery,
  buildCartRecoveryEmail,
  createCheckoutSessionWithRecovery,
  decideCartRecovery,
  isRecoveryParamRejection,
  stripCheckoutRecovery,
  firstNameFrom,
  precheckExpiredSession,
  recoveryItemNames,
  type ExpiredSessionLike,
  type RecoveryFacts,
} from './checkout-recovery.ts';
import { EMAIL_LISTS, isEmailList } from './email-unsubscribe.ts';

const POSTAL = 'Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043';
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);
const URL_OK = 'https://checkout.stripe.com/r/live_abc123';

// ── params ──

Deno.test('payment session: 3h expiry, promotional consent auto, recovery enabled', () => {
  const p = applyCheckoutRecovery({ mode: 'payment', allow_promotion_codes: true } as Record<string, unknown>, NOW);
  assertEquals(p.expires_at, Math.floor(NOW / 1000) + 3 * 3600);
  assertEquals(CART_RECOVERY_EXPIRY_SECONDS, 10800);
  assertEquals(p.consent_collection, { promotions: 'auto' });
  assertEquals(p.after_expiration, { recovery: { enabled: true, allow_promotion_codes: true } });
});

Deno.test('recovery promo field mirrors the original: off when a code was pre-applied', () => {
  const p = applyCheckoutRecovery({ mode: 'payment', discounts: [{ promotion_code: 'promo_1' }] } as Record<string, unknown>, NOW);
  assertEquals(p.after_expiration, { recovery: { enabled: true, allow_promotion_codes: false } });
});

Deno.test('recovery promo field mirrors the original: off when promo codes were not allowed', () => {
  const p = applyCheckoutRecovery({ mode: 'payment', allow_promotion_codes: false } as Record<string, unknown>, NOW);
  assertEquals((p.after_expiration as any).recovery.allow_promotion_codes, false);
  const q = applyCheckoutRecovery({ mode: 'payment' } as Record<string, unknown>, NOW);
  assertEquals((q.after_expiration as any).recovery.allow_promotion_codes, false);
});

Deno.test('expiry is at least Stripe\'s 30-minute minimum and at most its 24-hour maximum', () => {
  assert(CART_RECOVERY_EXPIRY_SECONDS >= 30 * 60 && CART_RECOVERY_EXPIRY_SECONDS <= 24 * 3600);
});

Deno.test('subscription session is untouched', () => {
  const p = applyCheckoutRecovery({ mode: 'subscription', allow_promotion_codes: true } as Record<string, unknown>, NOW);
  assertEquals(p, { mode: 'subscription', allow_promotion_codes: true });
});

Deno.test('an existing consent_collection field is kept', () => {
  const p = applyCheckoutRecovery({ mode: 'payment', consent_collection: { terms_of_service: 'required' } } as Record<string, unknown>, NOW);
  assertEquals(p.consent_collection, { terms_of_service: 'required', promotions: 'auto' });
});

// ── webhook rules ──

function expired(over: Partial<ExpiredSessionLike> = {}): ExpiredSessionLike {
  return {
    id: 'cs_live_1',
    created: Math.floor(NOW / 1000),
    metadata: { print_sku: 'sprouts_print_set' },
    consent: { promotions: 'opt_in' },
    customer_details: { email: ' Sarah@Example.COM ', name: 'Sarah Jane Smith' },
    after_expiration: { recovery: { url: URL_OK } },
    ...over,
  };
}

Deno.test('precheck passes a consenting shopper with an email and a recovery link', () => {
  const r = precheckExpiredSession(expired());
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.email, 'sarah@example.com');
    assertEquals(r.recoveryUrl, URL_OK);
    assertEquals(r.firstName, 'Sarah');
  }
});

Deno.test('precheck skips, in order, with reasons', () => {
  const reason = (s: ExpiredSessionLike) => {
    const r = precheckExpiredSession(s);
    return r.ok ? null : r.reason;
  };
  assertEquals(reason(expired({ metadata: { preorder_sku: 'sprouts_kit' }, consent: null })), 'preorder_session');
  assertEquals(reason(expired({ metadata: { e2e_test: 'true' } })), 'e2e_session');
  assertEquals(reason(expired({ consent: { promotions: 'opt_out' } })), 'no_promotional_consent');
  assertEquals(reason(expired({ consent: null })), 'no_promotional_consent');
  assertEquals(reason(expired({ customer_details: null, customer_email: null })), 'no_email');
  assertEquals(reason(expired({ after_expiration: null })), 'no_recovery_url');
  assertEquals(reason(expired({ after_expiration: { recovery: { url: 'javascript:alert(1)' } } })), 'recovery_url_not_https');
});

Deno.test('precheck falls back to customer_email', () => {
  const r = precheckExpiredSession(expired({ customer_details: { email: null, name: null }, customer_email: 'a@b.co' }));
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.email, 'a@b.co');
    assertEquals(r.firstName, null);
  }
});

Deno.test('decide: purchase, cooldown, global suppression, list opt-out, else send', () => {
  const clear: RecoveryFacts = { alreadyPurchased: false, recentlySent: false, globallySuppressed: false, listUnsubscribed: false };
  assertEquals(decideCartRecovery(clear), null);
  assertEquals(decideCartRecovery({ ...clear, alreadyPurchased: true, recentlySent: true }), 'already_purchased');
  assertEquals(decideCartRecovery({ ...clear, recentlySent: true }), 'recently_sent');
  assertEquals(decideCartRecovery({ ...clear, globallySuppressed: true }), 'globally_suppressed');
  assertEquals(decideCartRecovery({ ...clear, listUnsubscribed: true }), 'unsubscribed_cart');
});

Deno.test('item names: descriptions, blanks dropped, at most 10', () => {
  assertEquals(recoveryItemNames([{ description: ' Back to Eden (PDF) ' }, { description: '' }, { description: null }]), ['Back to Eden (PDF)']);
  assertEquals(recoveryItemNames(Array.from({ length: 12 }, (_, i) => ({ description: `Item ${i}` }))).length, 10);
  assertEquals(recoveryItemNames(null), []);
});

Deno.test('first name is the first word of the billing name', () => {
  assertEquals(firstNameFrom('  Mary Beth Jones'), 'Mary');
  assertEquals(firstNameFrom(''), null);
  assertEquals(firstNameFrom(null), null);
});

// ── the email ──

Deno.test('email: subject, greeting, approved copy, button to the recovery URL, signature', () => {
  const { subject, html, text } = buildCartRecoveryEmail({ firstName: 'Sarah', items: ['Sprouts Print Set'], recoveryUrl: URL_OK });
  assertEquals(subject, 'You left something in your cart');
  assertEquals(subject, CART_RECOVERY_SUBJECT);
  assertStringIncludes(html, 'Hi Sarah,');
  assertStringIncludes(html, 'It looks like you started an order and didn&#39;t get to finish. No pressure at all.');
  assertStringIncludes(html, `href="${URL_OK}"`);
  assertStringIncludes(html, '>Finish my order</a>');
  assertStringIncludes(html, 'This link works for 30 days.');
  assertStringIncludes(html, 'just reply to this email and it comes straight to me.');
  assertStringIncludes(html, '>Camila</p>');
  assertStringIncludes(html, '<em>Sprouts Print Set</em>');
  assertStringIncludes(text, 'Hi Sarah,');
  assertStringIncludes(text, "It looks like you started an order and didn't get to finish. No pressure at all. Here's a link to pick up right where you left off:");
  assertStringIncludes(text, 'Sprouts Print Set');
  assertStringIncludes(text, URL_OK);
  assertStringIncludes(text, 'Camila\nThe Eden Institute');
});

Deno.test('email: "Hi there," when there is no name', () => {
  const { html, text } = buildCartRecoveryEmail({ firstName: null, items: [], recoveryUrl: URL_OK });
  assertStringIncludes(html, 'Hi there,');
  assert(text.startsWith('Hi there,'));
});

Deno.test('email: item block omitted when there are no items', () => {
  const { html } = buildCartRecoveryEmail({ firstName: 'Sarah', items: [], recoveryUrl: URL_OK });
  assert(!html.includes('<em>'), 'no item block');
});

Deno.test('email: name and items are HTML-escaped', () => {
  const { html } = buildCartRecoveryEmail({
    firstName: '<script>x</script>',
    items: ['Book & <b>Journal</b>'],
    recoveryUrl: 'https://checkout.stripe.com/r/live_a?x="y"',
  });
  assert(!html.includes('<script>'), 'name escaped');
  assertStringIncludes(html, '&lt;script&gt;');
  assertStringIncludes(html, '<em>Book &amp; &lt;b&gt;Journal&lt;/b&gt;</em>');
  assertStringIncludes(html, 'href="https://checkout.stripe.com/r/live_a?x=&quot;y&quot;"');
});

Deno.test('email: postal address and exactly one unsubscribe link, in HTML and text', () => {
  const { html, text } = buildCartRecoveryEmail({ firstName: 'Sarah', items: ['A'], recoveryUrl: URL_OK });
  assertStringIncludes(html, POSTAL);
  assertEquals(html.split('{{UNSUB_URL}}').length - 1, 1);
  assertEquals(text.split('{{UNSUB_URL}}').length - 1, 1);
  assertStringIncludes(text, '303 Holly Cir, Unit 3262, Clarksville, TN 37043');
});

Deno.test('email: no em dash anywhere', () => {
  for (const firstName of ['Sarah', null]) {
    const { subject, html, text } = buildCartRecoveryEmail({ firstName, items: ['A', 'B'], recoveryUrl: URL_OK });
    for (const s of [subject, html, text]) {
      assert(!s.includes('—') && !s.includes('&mdash;'), 'em dash');
    }
  }
});

Deno.test('the cart list is a valid unsubscribe list (the unsubscribe function accepts it)', () => {
  assert(isEmailList('cart'));
  assertEquals(EMAIL_LISTS.cart, 'checkout reminder emails');
});

// ── create-checkout wiring (source check) ──

Deno.test('create-checkout: recovery params on main, print and book PDF; never on preorder', async () => {
  const src = (await Deno.readTextFile(new URL('../create-checkout/index.ts', import.meta.url))).replace(/\r\n/g, '\n');

  // Split into the four session-creating regions by their function headers.
  const at = (marker: string) => {
    const i = src.indexOf(marker);
    assert(i >= 0, `missing ${marker}`);
    return i;
  };
  const preorderStart = at('async function handlePreorderCheckout(');
  const printStart = at('async function handlePrintCheckout(');
  const bookStart = at('async function handleBookDigitalCheckout(');
  const main = src.slice(0, preorderStart);
  const preorder = src.slice(preorderStart, printStart);
  const print = src.slice(printStart, bookStart);
  const book = src.slice(bookStart);

  const RAW = 'stripe.checkout.sessions.create(sessionParams)';
  const SAFE = 'createCheckoutSessionWithRecovery(stripe, sessionParams)';
  const count = (s: string, needle: string) => s.split(needle).length - 1;
  const applies = (s: string) => count(s, 'applyCheckoutRecovery(sessionParams)');

  for (const [name, region] of [['main', main], ['print', print], ['book digital', book]] as const) {
    assertEquals(count(region, SAFE), 1, `${name}: session created through the fail-safe helper`);
    assertEquals(count(region, RAW), 0, `${name}: no raw sessions.create left`);
    assertEquals(applies(region), 1, `${name}: recovery applied`);
    // Applied after the promo logic and immediately before the create.
    const applyAt = region.indexOf('applyCheckoutRecovery(sessionParams)');
    const createAt = region.indexOf(SAFE);
    assert(applyAt < createAt, `${name}: applied before create`);
    assert(region.lastIndexOf('allow_promotion_codes', createAt) < applyAt, `${name}: applied after the promo state is final`);
    assert(region.lastIndexOf('discounts', createAt) < applyAt, `${name}: applied after any pre-applied discount`);
  }
  assertEquals(count(preorder, RAW), 1, 'preorder: one plain session create');
  assertEquals(count(preorder, SAFE), 0, 'preorder: untouched');
  assertEquals(applies(preorder), 0, 'preorder: recovery NOT applied');
  assert(!preorder.includes('after_expiration') && !preorder.includes('consent_collection'), 'preorder: no recovery params');
});

// ── fail-safe: Stripe refuses the recovery params ──

// The shape stripe-node throws (StripeInvalidRequestError), trimmed to what we read.
function stripeInvalid(message: string, param?: string): Error {
  const e = new Error(message) as Error & Record<string, unknown>;
  e.type = 'StripeInvalidRequestError';
  e.rawType = 'invalid_request_error';
  if (param) e.param = param;
  return e;
}
// The exact TEST-mode rejection seen 2026-09-28.
const TERMS_ERR = 'To set `consent_collection.promotions`, please visit https://dashboard.stripe.com/settings/checkout to agree to the Terms of Service.';

function fakeStripe(outcomes: Array<Error | { id: string }>) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    checkout: {
      sessions: {
        create(params: Record<string, unknown>): Promise<{ id: string }> {
          calls.push(structuredClone(params));
          const next = outcomes[calls.length - 1];
          if (!next) throw new Error('unexpected extra create call');
          return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
        },
      },
    },
  };
}
const quiet = () => Promise.resolve();
function recoveryParams(extra: Record<string, unknown> = {}) {
  return applyCheckoutRecovery({ mode: 'payment', allow_promotion_codes: true, ...extra } as Record<string, unknown>, NOW);
}
function silenced<T>(fn: () => Promise<T>): Promise<T> {
  const orig = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = orig;
  });
}

Deno.test('fail-safe (a): success first try, one call, params intact', async () => {
  const stripe = fakeStripe([{ id: 'cs_1' }]);
  const s = await createCheckoutSessionWithRecovery(stripe, recoveryParams(), quiet);
  assertEquals(s.id, 'cs_1');
  assertEquals(stripe.calls.length, 1);
  assertEquals(stripe.calls[0].consent_collection, { promotions: 'auto' });
  assert('after_expiration' in stripe.calls[0] && 'expires_at' in stripe.calls[0]);
});

Deno.test('fail-safe (b): consent_collection rejection retries once without any recovery param', async () => {
  const stripe = fakeStripe([stripeInvalid(TERMS_ERR), { id: 'cs_2' }]);
  let reported = 0;
  const s = await silenced(() =>
    createCheckoutSessionWithRecovery(stripe, recoveryParams(), () => {
      reported++;
      return Promise.resolve();
    })
  );
  assertEquals(s.id, 'cs_2');
  assertEquals(stripe.calls.length, 2);
  const retry = stripe.calls[1];
  assert(!('consent_collection' in retry), 'no consent_collection');
  assert(!('after_expiration' in retry), 'no after_expiration');
  assert(!('expires_at' in retry), 'no expires_at (24h default again)');
  assertEquals(retry.mode, 'payment');
  assertEquals(retry.allow_promotion_codes, true);
  assertEquals(reported, 1);
});

Deno.test('fail-safe (b2): an after_expiration rejection by param is also caught', async () => {
  const stripe = fakeStripe([stripeInvalid('Invalid object', 'after_expiration[recovery]'), { id: 'cs_3' }]);
  const s = await silenced(() => createCheckoutSessionWithRecovery(stripe, recoveryParams(), quiet));
  assertEquals(s.id, 'cs_3');
  assertEquals(stripe.calls.length, 2);
});

Deno.test('fail-safe (c): any other invalid_request_error is rethrown after one call', async () => {
  const err = stripeInvalid('No such price: price_x', 'line_items[0][price]');
  const stripe = fakeStripe([err, { id: 'never' }]);
  let thrown: unknown = null;
  try {
    await createCheckoutSessionWithRecovery(stripe, recoveryParams(), quiet);
  } catch (e) {
    thrown = e;
  }
  assert(thrown === err, 'same error, unchanged');
  assertEquals(stripe.calls.length, 1);
});

Deno.test('fail-safe (c2): a non-Stripe error is rethrown after one call', async () => {
  const err = new Error('network down: consent_collection');
  const stripe = fakeStripe([err, { id: 'never' }]);
  let thrown: unknown = null;
  try {
    await createCheckoutSessionWithRecovery(stripe, recoveryParams(), quiet);
  } catch (e) {
    thrown = e;
  }
  assert(thrown === err);
  assertEquals(stripe.calls.length, 1);
});

Deno.test('fail-safe (d): the retry failing propagates its error, no third call', async () => {
  const second = stripeInvalid('Something else went wrong');
  const stripe = fakeStripe([stripeInvalid(TERMS_ERR), second, { id: 'never' }]);
  let thrown: unknown = null;
  try {
    await silenced(() => createCheckoutSessionWithRecovery(stripe, recoveryParams(), quiet));
  } catch (e) {
    thrown = e;
  }
  assert(thrown === second, 'second error propagates');
  assertEquals(stripe.calls.length, 2);
});

Deno.test('fail-safe (d2): even a second consent rejection is not retried again', async () => {
  const stripe = fakeStripe([stripeInvalid(TERMS_ERR), stripeInvalid(TERMS_ERR), { id: 'never' }]);
  let threw = false;
  try {
    await silenced(() => createCheckoutSessionWithRecovery(stripe, recoveryParams(), quiet));
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals(stripe.calls.length, 2);
});

Deno.test('fail-safe (e): pre-existing consent_collection keys are restored exactly on fallback', async () => {
  const stripe = fakeStripe([stripeInvalid(TERMS_ERR), { id: 'cs_4' }]);
  const params = recoveryParams({ consent_collection: { terms_of_service: 'required' } });
  assertEquals(params.consent_collection, { terms_of_service: 'required', promotions: 'auto' });
  await silenced(() => createCheckoutSessionWithRecovery(stripe, params, quiet));
  assertEquals(stripe.calls[1].consent_collection, { terms_of_service: 'required' });
});

Deno.test('stripCheckoutRecovery without a prior apply drops only promotions', () => {
  const p = stripCheckoutRecovery({
    mode: 'payment',
    expires_at: 1,
    after_expiration: {},
    consent_collection: { promotions: 'auto', terms_of_service: 'required' },
  } as Record<string, unknown>);
  assertEquals(p, { mode: 'payment', consent_collection: { terms_of_service: 'required' } });
});

Deno.test('isRecoveryParamRejection reads type, rawType, param and message', () => {
  assert(isRecoveryParamRejection(stripeInvalid(TERMS_ERR)));
  assert(isRecoveryParamRejection({ rawType: 'invalid_request_error', param: 'consent_collection[promotions]', message: 'x' }));
  assert(isRecoveryParamRejection({ raw: { type: 'invalid_request_error', param: 'after_expiration' }, message: 'x' }));
  assert(!isRecoveryParamRejection({ type: 'StripeAPIError', message: TERMS_ERR }));
  assert(!isRecoveryParamRejection(stripeInvalid('No such price', 'line_items[0][price]')));
  assert(!isRecoveryParamRejection(null));
});
