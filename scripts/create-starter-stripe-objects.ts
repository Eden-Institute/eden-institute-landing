// scripts/create-starter-stripe-objects.ts
//
// Creates the three Stripe objects the Sprouts Starter Unit needs, in whichever
// mode the supplied key belongs to, and VERIFIES them by reading them back.
//
//   Product  "Eden's Table Sprouts Starter Unit", tax code txcd_10302000
//   Price    $39.00 one-time, lookup_key "sprouts_starter_unit"
//   Coupon   $39.00 off, duration once, applies_to the Sprouts kit product
//
// Run it with:
//   deno run --allow-net --allow-env scripts/create-starter-stripe-objects.ts
// with STRIPE_SECRET_KEY set to a key that can WRITE products, prices and
// coupons. The restricted key paired to the Stripe CLI on the founder's machine
// is READ-ONLY (punch #95), so this cannot run from there without a wider key.
//
// IDEMPOTENT. It looks for each object before creating it, so a second run
// reports what already exists and creates nothing. Safe to re-run after a
// partial failure.
//
// TWO TRAPS THIS SCRIPT EXISTS TO AVOID
//
// 1. `applies_to` is NOT returned on a coupon unless you expand it. A plain
//    retrieve shows no applies_to at all, which reads exactly like an
//    UNRESTRICTED coupon. On 2026-08-26 that briefly looked like the Stripe CLI
//    had silently dropped the restriction. It had not; the field was simply
//    hidden. An unrestricted $39-off coupon would apply to any product in the
//    account, including making the $19 notebook free, so the verification below
//    expands it and refuses to pass without it.
//
// 2. The tax code has to be set on the PRODUCT. Creating it without one makes
//    the product inherit the account preset, which is txcd_10000000 (General -
//    Electronically Supplied Services), not the digital-books code this product
//    should use. That is how the Deep-Dive Guide ended up on the preset.

const KEY = Deno.env.get('STRIPE_SECRET_KEY');
if (!KEY) {
  console.error('STRIPE_SECRET_KEY is not set. Export a key with write access to products, prices and coupons.');
  Deno.exit(1);
}
const LIVE = KEY.includes('_live_');

/** The Sprouts Complete Kit product. Both the $249 founding price and the $349
 *  retail price hang off this one product, verified against the live API
 *  2026-08-26, which is what lets a single product-scoped coupon keep working
 *  after the founding window closes. */
const KIT_PRODUCT_ID_LIVE = 'prod_UbK7PJQPkKhcnE';
const KIT_PRODUCT_ID = Deno.env.get('STRIPE_KIT_PRODUCT_ID') ?? (LIVE ? KIT_PRODUCT_ID_LIVE : '');

const LOOKUP_KEY = 'sprouts_starter_unit';
const PRICE_CENTS = 3900;
const CREDIT_CENTS = 3900;
const TAX_CODE = 'txcd_10302000'; // books transferred electronically

async function api(method: string, path: string, params: Record<string, string | number> = {}) {
  const body = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`https://api.stripe.com${path}${method === 'GET' && body.toString() ? `?${body}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Stripe-Version': '2024-12-18.acacia',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(method === 'POST' ? { body } : {}),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message}`);
  return json;
}

console.log(`Stripe mode: ${LIVE ? 'LIVE' : 'TEST'}\n`);

if (!KIT_PRODUCT_ID) {
  console.error(
    'No kit product id. In live mode this defaults to the verified value; in test mode set ' +
      'STRIPE_KIT_PRODUCT_ID to the test-mode Sprouts kit product so the coupon can be scoped to it.',
  );
  Deno.exit(1);
}

// ---- 1. Product -------------------------------------------------------------
// `lookup_keys` is an ARRAY parameter; sending it unbracketed returns
// "Invalid array" rather than an empty result, so the bracket is load-bearing.
const existingPrices = await api('GET', '/v1/prices', { 'lookup_keys[0]': LOOKUP_KEY, limit: 1 });
let productId: string;
let priceId: string;

if (existingPrices.data?.length) {
  priceId = existingPrices.data[0].id;
  productId = existingPrices.data[0].product;
  console.log(`Price already exists: ${priceId} (product ${productId}) — not creating`);
} else {
  const product = await api('POST', '/v1/products', {
    name: "Eden's Table Sprouts Starter Unit",
    description:
      "Weeks 1 to 6 of the Sprouts (K-2) Biblical herbalism curriculum: Teacher's Guide and Student Notebook, delivered as PDFs.",
    tax_code: TAX_CODE,
    'metadata[sku]': LOOKUP_KEY,
    'metadata[band]': 'sprouts',
  });
  productId = product.id;
  console.log(`Product created: ${productId}`);

  const price = await api('POST', '/v1/prices', {
    product: productId,
    unit_amount: PRICE_CENTS,
    currency: 'usd',
    nickname: 'Sprouts Starter Unit',
    tax_behavior: 'exclusive',
    lookup_key: LOOKUP_KEY,
  });
  priceId = price.id;
  console.log(`Price created:   ${priceId}`);
}

// ---- 2. Coupon --------------------------------------------------------------
// Coupons cannot be looked up by name, so this searches by metadata marker.
const coupons = await api('GET', '/v1/coupons', { limit: 100 });
// deno-lint-ignore no-explicit-any
let coupon = (coupons.data ?? []).find((c: any) => c.metadata?.purpose === 'starter_unit_credit' && c.valid);

if (coupon) {
  console.log(`Coupon already exists: ${coupon.id} — not creating`);
} else {
  coupon = await api('POST', '/v1/coupons', {
    amount_off: CREDIT_CENTS,
    currency: 'usd',
    duration: 'once',
    // Stripe caps coupon names at 40 characters.
    name: 'Starter Unit credit',
    'applies_to[products][0]': KIT_PRODUCT_ID,
    'metadata[purpose]': 'starter_unit_credit',
  });
  console.log(`Coupon created:  ${coupon.id}`);
}

// ---- 3. Verify by reading back ---------------------------------------------
console.log('\nVerifying...');
const product = await api('GET', `/v1/products/${productId}`);
const price = await api('GET', `/v1/prices/${priceId}`);
// The expand is the whole point: without it applies_to is absent and an
// unrestricted coupon looks identical to a correctly-scoped one.
const couponCheck = await api('GET', `/v1/coupons/${coupon.id}`, { 'expand[0]': 'applies_to' });

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
  if (!cond) failures++;
}

check('product tax code is digital books', product.tax_code === TAX_CODE, product.tax_code ?? '(none, inherits account preset)');
check('price is $39.00 USD', price.unit_amount === PRICE_CENTS && price.currency === 'usd', `${price.unit_amount} ${price.currency}`);
check('price carries the lookup key', price.lookup_key === LOOKUP_KEY, price.lookup_key ?? '(none)');
check('price is one-time, not recurring', price.recurring === null);
check('coupon is $39 off', couponCheck.amount_off === CREDIT_CENTS, String(couponCheck.amount_off));
check('coupon applies once', couponCheck.duration === 'once', couponCheck.duration);
check(
  'coupon is scoped to the kit product ONLY',
  couponCheck.applies_to?.products?.length === 1 && couponCheck.applies_to.products[0] === KIT_PRODUCT_ID,
  JSON.stringify(couponCheck.applies_to ?? null),
);

console.log('\nSet this secret on the Supabase project:');
console.log(`  STRIPE_STARTER_CREDIT_COUPON_ID=${coupon.id}`);
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED. Do not launch until these pass.`);
if (failures) Deno.exit(1);
