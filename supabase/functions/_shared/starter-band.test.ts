// Run with: deno test --allow-env supabase/functions/_shared/starter-band.test.ts
//
// The Seedlings Starter Unit (2026-09-23) shares every rail with Sprouts, so the
// failure that matters is a CROSSED WIRE: a Seedlings buyer receiving a file,
// email, receipt or invoice that says "Sprouts", or the reverse, or a Sprouts
// buyer seeing anything at all change. Each test here pins one of those.
//
// Credit minting per band is tested in starter-credit.test.ts, beside the fakes
// that file already has.

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  STARTER_BANDS,
  STARTER_FILENAMES,
  STARTER_LOOKUP_KEY,
  STARTER_LOOKUP_KEYS,
  STARTER_MASTERS,
  STARTER_PAGE_URL,
  missingStarterEnv,
  missingStarterMasters,
  normalizeStarterBand,
  starterBandForLookupKey,
  starterCreditCouponId,
  starterCreditTargetProductId,
} from './starter-config.ts';
import { renderStarterDeliveryEmail } from './starter-email.ts';
import {
  STARTER_ORDER_LABEL,
  curriculumInvoiceCreation,
  renderReceiptHtml,
  renderReceiptText,
  starterOrderLabel,
  starterReceipt,
} from './receipt.ts';
import { buildStarterOfferEmail } from './nurture-email-templates.ts';

const SPROUTS = /sprouts/i;
const SEEDLINGS = /seedlings/i;

const ORDER = {
  order_number: 'EDN-1001',
  created_at: '2026-09-23T15:00:00Z',
  amount_total_cents: 3900,
  tax_cents: 0,
  raw: {
    amount_subtotal: 3900,
    total_details: { amount_discount: 0, amount_tax: 0 },
    customer_details: { name: 'Pat Parent' },
    eden_payment_card: { brand: 'visa', last4: '4242' },
  },
};

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

Deno.test('Sprouts registry entry IS the original constants, unchanged', () => {
  const s = STARTER_BANDS.sprouts;
  assertEquals(STARTER_LOOKUP_KEY, 'sprouts_starter_unit');
  assertEquals(s.lookupKey, STARTER_LOOKUP_KEY);
  assertEquals(s.masters, STARTER_MASTERS);
  assertEquals(s.filenames, STARTER_FILENAMES);
  assertEquals(s.pageUrl, STARTER_PAGE_URL);
  assertEquals(STARTER_MASTERS, {
    teachersGuide: 'sample/edens-table-9wk-teachers-guide.pdf',
    studentNotebook: 'sample/edens-table-9wk-student-notebook.pdf',
    readAloud: 'sample/edens-table-9wk-read-aloud.pdf',
  });
  assertEquals(STARTER_FILENAMES, {
    teachersGuide: 'Edens-Table-Sprouts-Starter-Teachers-Guide.pdf',
    studentNotebook: 'Edens-Table-Sprouts-Starter-Student-Notebook.pdf',
    readAloud: 'Edens-Table-Sprouts-Starter-Read-Aloud.pdf',
  });
  assertEquals(s.creditCouponEnv, 'STRIPE_STARTER_CREDIT_COUPON_ID');
  assertEquals(s.creditTarget, { kind: 'product_id', productId: 'prod_UbK7PJQPkKhcnE' });
  assertEquals(s.successUrl, 'https://edeninstitute.health/starter/thank-you?session_id={CHECKOUT_SESSION_ID}');
});

Deno.test('Seedlings registry entry carries the 2026-09-23 values', () => {
  const s = STARTER_BANDS.seedlings;
  assertEquals(s.lookupKey, 'seedlings_starter_unit');
  assertEquals(s.priceCents, 3900);
  assertEquals(s.creditCents, 3900);
  assertEquals(s.masters, {
    teachersGuide: 'sample/edens-table-seedlings-9wk-teachers-guide.pdf',
    studentNotebook: 'sample/edens-table-seedlings-9wk-student-notebook.pdf',
    readAloud: 'sample/edens-table-seedlings-9wk-read-aloud.pdf',
  });
  assertEquals(s.filenames, {
    teachersGuide: 'Edens-Table-Seedlings-Starter-Teachers-Guide.pdf',
    studentNotebook: 'Edens-Table-Seedlings-Starter-Student-Notebook.pdf',
    readAloud: 'Edens-Table-Seedlings-Starter-Read-Aloud.pdf',
  });
  assertEquals(s.creditCouponEnv, 'STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID');
  assertEquals(s.creditTarget, { kind: 'env', envVar: 'STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID' });
});

Deno.test('no Seedlings file name, path or URL mentions Sprouts, and the reverse', () => {
  const sd = STARTER_BANDS.seedlings;
  for (const v of [...Object.values(sd.filenames), ...Object.values(sd.masters), sd.pageUrl, sd.successUrl, sd.productName, sd.bandName]) {
    assert(!SPROUTS.test(v), `Seedlings value mentions Sprouts: ${v}`);
  }
  const sp = STARTER_BANDS.sprouts;
  for (const v of [...Object.values(sp.filenames), ...Object.values(sp.masters), sp.pageUrl, sp.successUrl, sp.productName, sp.bandName]) {
    assert(!SEEDLINGS.test(v), `Sprouts value mentions Seedlings: ${v}`);
  }
});

Deno.test('lookup keys map to bands and nothing else does', () => {
  assertEquals([...STARTER_LOOKUP_KEYS], ['sprouts_starter_unit', 'seedlings_starter_unit']);
  assertEquals(starterBandForLookupKey('sprouts_starter_unit'), 'sprouts');
  assertEquals(starterBandForLookupKey('seedlings_starter_unit'), 'seedlings');
  assertEquals(starterBandForLookupKey('deep_dive_guide'), null);
  assertEquals(starterBandForLookupKey('sprouts_print_set'), null);
  assertEquals(starterBandForLookupKey(null), null);
});

Deno.test('a row with no band is Sprouts; an unknown band is refused, never guessed', () => {
  assertEquals(normalizeStarterBand(null), 'sprouts');
  assertEquals(normalizeStarterBand(undefined), 'sprouts');
  assertEquals(normalizeStarterBand('sprouts'), 'sprouts');
  assertEquals(normalizeStarterBand('seedlings'), 'seedlings');
  assertThrows(() => normalizeStarterBand('cultivators'));
  assertThrows(() => normalizeStarterBand('Seedlings'));
});

// ---------------------------------------------------------------------------
// Fail-loud configuration
// ---------------------------------------------------------------------------

function withEnv(vars: Record<string, string | null>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = Deno.env.get(k);
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test('Seedlings is not sellable until its coupon AND print-set product are set', () => {
  withEnv({
    STRIPE_STARTER_CREDIT_COUPON_ID: 'coupon_sprouts',
    STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID: null,
    STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID: null,
  }, () => {
    assertEquals(missingStarterEnv('sprouts'), []);
    assertEquals(missingStarterEnv('seedlings'), [
      'STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID',
      'STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID',
    ]);
    assertThrows(() => starterCreditCouponId('seedlings'), Error, 'STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID');
    assertThrows(() => starterCreditTargetProductId('seedlings'), Error, 'STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID');
    // The Sprouts target is the verified constant, never env.
    assertEquals(starterCreditTargetProductId('sprouts'), 'prod_UbK7PJQPkKhcnE');
  });
  withEnv({
    STRIPE_STARTER_CREDIT_COUPON_ID: 'coupon_sprouts',
    STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID: 'coupon_seedlings',
    STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID: 'prod_test_seedlings',
  }, () => {
    assertEquals(missingStarterEnv('seedlings'), []);
    assertEquals(starterCreditCouponId('seedlings'), 'coupon_seedlings');
    assertEquals(starterCreditTargetProductId('seedlings'), 'prod_test_seedlings');
  });
});

Deno.test('Seedlings refuses to share the Sprouts coupon', () => {
  withEnv({
    STRIPE_STARTER_CREDIT_COUPON_ID: 'coupon_same',
    STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID: 'coupon_same',
    STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID: 'prod_test_seedlings',
  }, () => {
    const missing = missingStarterEnv('seedlings');
    assertEquals(missing.length, 1);
    assert(missing[0].includes('must differ'));
  });
});

Deno.test('Sprouts sellability still depends only on its own coupon', () => {
  withEnv({
    STRIPE_STARTER_CREDIT_COUPON_ID: null,
    STRIPE_SEEDLINGS_STARTER_CREDIT_COUPON_ID: 'coupon_seedlings',
    STRIPE_SEEDLINGS_PRINT_SET_PRODUCT_ID: 'prod_test_seedlings',
  }, () => {
    assertEquals(missingStarterEnv('sprouts'), ['STRIPE_STARTER_CREDIT_COUPON_ID']);
  });
});

Deno.test('a missing master is reported by path', () => {
  const all = Object.values(STARTER_BANDS.seedlings.masters);
  assertEquals(missingStarterMasters('seedlings', all), []);
  assertEquals(missingStarterMasters('seedlings', []), all);
  assertEquals(
    missingStarterMasters('seedlings', [all[0], all[1]]),
    ['sample/edens-table-seedlings-9wk-read-aloud.pdf'],
  );
  // The Sprouts masters do not satisfy Seedlings.
  assertEquals(missingStarterMasters('seedlings', Object.values(STARTER_MASTERS)), all);
});

// ---------------------------------------------------------------------------
// What a buyer reads
// ---------------------------------------------------------------------------

function deliveryEmail(band?: 'sprouts' | 'seedlings') {
  return renderStarterDeliveryEmail({
    firstName: 'Pat',
    email: 'pat@example.com',
    creditCode: 'EDEN-S-ABC234',
    downloadToken: 'a'.repeat(64),
    receipt: starterReceipt(ORDER, band ? STARTER_BANDS[band].lookupKey : undefined),
    ...(band ? { band } : {}),
  });
}

Deno.test('ACCEPTANCE: the Seedlings delivery email never says Sprouts', () => {
  const m = deliveryEmail('seedlings');
  for (const part of [m.subject, m.html, m.text]) {
    assert(!SPROUTS.test(part), 'Seedlings delivery email mentions Sprouts');
  }
  assert(m.html.includes("Eden's Table, Seedlings"));
  assert(m.text.includes("Eden's Table, Seedlings"));
  assert(m.html.includes('Seedlings Starter Unit, Digital Curriculum, Weeks 1 to 9'));
  assert(m.html.includes('Grade level 3-5'));
  // No printed Seedlings year to link to yet, so no link to the Sprouts books.
  assert(!m.html.includes('edeninstitute.health/books'));
  assert(!m.text.includes('edeninstitute.health/books'));
  assert(!m.html.includes('—') && !m.text.includes('—'), 'em dash in Seedlings email');
});

Deno.test('ACCEPTANCE: the Sprouts delivery email never says Seedlings, and band defaults to Sprouts', () => {
  const implicit = deliveryEmail();
  const explicit = deliveryEmail('sprouts');
  assertEquals(implicit, explicit);
  for (const part of [explicit.subject, explicit.html, explicit.text]) {
    assert(!SEEDLINGS.test(part), 'Sprouts delivery email mentions Seedlings');
  }
  assert(explicit.html.includes("Eden's Table, Sprouts"));
  assert(explicit.html.includes('https://edeninstitute.health/books'));
});

Deno.test('receipts name the band that was bought', () => {
  assertEquals(starterOrderLabel('sprouts_starter_unit'), STARTER_ORDER_LABEL);
  assertEquals(starterOrderLabel('seedlings_starter_unit'), 'Seedlings Starter Unit, Digital Curriculum, Weeks 1 to 9');
  assertThrows(() => starterOrderLabel('nope'));

  assertEquals(starterReceipt(ORDER), starterReceipt(ORDER, 'sprouts_starter_unit'));
  const sd = starterReceipt(ORDER, 'seedlings_starter_unit');
  assertEquals(sd.gradeLevel, '3-5');
  for (const s of [renderReceiptHtml(sd), renderReceiptText(sd)]) assert(!SPROUTS.test(s));
  const sp = starterReceipt(ORDER);
  assertEquals(sp.gradeLevel, 'K-2');
  for (const s of [renderReceiptHtml(sp), renderReceiptText(sp)]) assert(!SEEDLINGS.test(s));
});

Deno.test('the Stripe invoice names the band that was bought', () => {
  assertEquals(curriculumInvoiceCreation('starter'), curriculumInvoiceCreation('starter', 'sprouts'));
  assertEquals(curriculumInvoiceCreation('print'), curriculumInvoiceCreation('print', 'sprouts'));
  const sp = JSON.stringify(curriculumInvoiceCreation('starter'));
  assert(!SEEDLINGS.test(sp));
  assert(sp.includes("Eden's Table Sprouts Starter Unit, digital curriculum, weeks 1 to 9."));
  assert(sp.includes('K-2 (Sprouts)'));
  const sd = JSON.stringify(curriculumInvoiceCreation('starter', 'seedlings'));
  assert(!SPROUTS.test(sd), 'Seedlings invoice mentions Sprouts');
  assert(sd.includes("Eden's Table Seedlings Starter Unit, digital curriculum, weeks 1 to 9."));
  assert(sd.includes('3-5 (Seedlings)'));
  // Stripe caps custom field values at 140 characters.
  for (const f of curriculumInvoiceCreation('starter', 'seedlings').invoice_data.custom_fields) {
    assert(f.value.length <= 140 && f.name.length <= 40);
  }
});

Deno.test('the Seedlings lead offer sells the Seedlings Starter Unit, not Sprouts', () => {
  const sd = buildStarterOfferEmail('Sarah', 'seedlings');
  assert(!/not ready to sell/i.test(sd.html));
  assert(sd.html.includes('https://edeninstitute.health/starter/seedlings'));
  assert(sd.html.includes('Seedlings Starter Unit'));
  assert(!SPROUTS.test(sd.subject + sd.html), 'Seedlings lead offer mentions Sprouts');
  assert(!sd.html.includes('—'));

  const sp = buildStarterOfferEmail('Sarah', 'sprouts');
  assertEquals(sp.subject, 'What comes after Lavender');
  assert(sp.html.includes("'https://edeninstitute.health/starter'") || sp.html.includes('href="https://edeninstitute.health/starter"'));
  assert(!SEEDLINGS.test(sp.subject + sp.html));
});
