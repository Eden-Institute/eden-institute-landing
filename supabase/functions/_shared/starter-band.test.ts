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
  starterBandHasCredit,
  starterPrepaymentProblems,
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
  // FOUNDER DECISION 2026-11-22: the credit moved to a new printed-set coupon
  // (the kit-only STRIPE_STARTER_CREDIT_COUPON_ID is legacy). Everything else in
  // this entry is unchanged.
  assertEquals(s.credit, {
    cents: 3900,
    couponEnv: 'STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS',
    appliesToSkus: ['sprouts_print_set', 'both_bands_print_set', 'sprouts_kit'],
  });
  assert(starterBandHasCredit('sprouts'));
  assertEquals(s.successUrl, 'https://edeninstitute.health/starter/thank-you?session_id={CHECKOUT_SESSION_ID}');
});

Deno.test('Seedlings registry entry carries the 2026-09-23 values', () => {
  const s = STARTER_BANDS.seedlings;
  assertEquals(s.lookupKey, 'seedlings_starter_unit');
  assertEquals(s.priceCents, 3900);
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
});

Deno.test('FOUNDER DECISION 2026-11-22 (replacing 2026-09-23): the Seedlings Starter earns a credit on its own coupon', () => {
  assertEquals(STARTER_BANDS.seedlings.credit, {
    cents: 3900,
    couponEnv: 'STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS',
    appliesToSkus: ['seedlings_print_set', 'both_bands_print_set'],
  });
  assertEquals(starterBandHasCredit('seedlings'), true);
  // The credit lives in `credit` alone: no coupon, credit or Stripe env var
  // anywhere else in the Seedlings config.
  const { credit: _credit, ...rest } = STARTER_BANDS.seedlings;
  const json = JSON.stringify(rest);
  assert(!/coupon|credit|STRIPE_/i.test(json), json);
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

Deno.test('2026-11-22: Seedlings sellability depends on its own printed-set coupon, and only that', () => {
  withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS: null, STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS: 'coupon_sprouts' }, () => {
    assertEquals(missingStarterEnv('seedlings'), ['STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS']);
  });
  withEnv({
    STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS: 'coupon_seedlings',
    STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS: null,
    STRIPE_STARTER_CREDIT_COUPON_ID: null,
  }, () => {
    assertEquals(missingStarterEnv('seedlings'), []);
  });
});

Deno.test('Sprouts sellability depends only on its own coupon (the printed-set one since 2026-11-22)', () => {
  withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS: null, STRIPE_STARTER_CREDIT_COUPON_ID: 'coupon_legacy' }, () => {
    assertEquals(missingStarterEnv('sprouts'), ['STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS']);
  });
  withEnv({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SPROUTS: 'coupon_sprouts', STRIPE_STARTER_CREDIT_COUPON_ID: null }, () => {
    assertEquals(missingStarterEnv('sprouts'), []);
  });
});

// ---------------------------------------------------------------------------
// Pre-payment guard (create-checkout, before any Stripe session): for Seedlings
// it is its coupon env (since 2026-11-22) and then the migration probe. It never
// reads or writes starter_credits, and it has no Stripe client to touch at all.
// ---------------------------------------------------------------------------

const SEEDLINGS_COUPON_ENV = { STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS: 'coupon_test_seedlings' };

async function withEnvAsync<T>(vars: Record<string, string | null>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = Deno.env.get(k);
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

/** A db that records every table asked for, and fails the band probe if told to. */
function probeDb(bandColumnExists: boolean) {
  const tables: string[] = [];
  return {
    tables,
    from(table: string) {
      tables.push(table);
      const q = {
        select(_c: string) { return q; },
        limit(_n: number) {
          return Promise.resolve({
            data: [],
            error: bandColumnExists ? null : { message: `column ${table}.band does not exist`, code: '42703' },
          });
        },
      };
      return q;
    },
  };
}

Deno.test('pre-payment: Seedlings is sellable once its coupon is set and the migration applied, touching only starter_deliveries', async () => {
  await withEnvAsync(SEEDLINGS_COUPON_ENV, async () => {
    const db = probeDb(true);
    assertEquals(await starterPrepaymentProblems(db, 'seedlings'), []);
    assertEquals(db.tables, ['starter_deliveries']);
  });
});

Deno.test('pre-payment: an unapplied migration refuses the Seedlings sale', async () => {
  await withEnvAsync(SEEDLINGS_COUPON_ENV, async () => {
    const db = probeDb(false);
    const problems = await starterPrepaymentProblems(db, 'seedlings');
    assertEquals(problems.length, 1);
    assert(problems[0].includes('starter_deliveries.band'), problems[0]);
    assert(!db.tables.includes('starter_credits'));
  });
});

Deno.test('pre-payment: a throwing probe refuses the sale instead of throwing', async () => {
  await withEnvAsync(SEEDLINGS_COUPON_ENV, async () => {
    const db = { from() { throw new Error('network down'); } };
    const problems = await starterPrepaymentProblems(db, 'seedlings');
    assertEquals(problems.length, 1);
    assert(problems[0].includes('network down'));
  });
});

Deno.test('pre-payment (2026-11-22): a missing Seedlings coupon refuses the sale before any probe', async () => {
  await withEnvAsync({ STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS: null }, async () => {
    const db = probeDb(true);
    assertEquals(await starterPrepaymentProblems(db, 'seedlings'), ['env STRIPE_STARTER_PRINT_CREDIT_COUPON_SEEDLINGS not set']);
    assertEquals(db.tables, [], 'refused before the database was asked anything');
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
  // The printed Seedlings year is on sale (2026-09-24): the email links to ITS buy box on
  // /books (#seedlings), never to the bare /books page where the Sprouts set sits first.
  assert(m.html.includes('https://edeninstitute.health/books#seedlings'));
  assert(m.text.includes('https://edeninstitute.health/books#seedlings'));
  assert(!/edeninstitute\.health\/books(?!#seedlings)/.test(m.html + m.text), 'Seedlings email links to the Sprouts books');
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

// 2026-09-24, both bands on sale: each offer carries ONE start-rule line naming
// the other band (founder's rule). Outside that line, neither mentions the other.
const SEEDLINGS_NEW_TO_HERBS_LINE = /<p[^>]*>New to herbs\? Even with a child in grades 3 to 5, most families start with <a href="https:\/\/edeninstitute\.health\/starter" [^>]*>Sprouts<\/a>, because its thirty-six plants are the ones Seedlings builds on\.<\/p>/;
const SPROUTS_OLDER_KIDS_LINE = /<p[^>]*>If you have children in grades 3 to 5 who already know the basics of herbs, they can go straight to <a href="https:\/\/edeninstitute\.health\/starter\/seedlings" [^>]*>Seedlings<\/a>, the next thirty-six plants\.<\/p>/;

Deno.test('the Seedlings lead offer sells the Seedlings Starter Unit, not Sprouts', () => {
  const sd = buildStarterOfferEmail('Sarah', 'seedlings');
  assert(!/not ready to sell/i.test(sd.html));
  assert(sd.html.includes('https://edeninstitute.health/starter/seedlings'));
  assert(sd.html.includes('Seedlings Starter Unit'));
  assert(SEEDLINGS_NEW_TO_HERBS_LINE.test(sd.html), 'Seedlings offer carries the new-to-herbs line');
  assert(!SPROUTS.test(sd.subject + sd.html.replace(SEEDLINGS_NEW_TO_HERBS_LINE, '')), 'Seedlings lead offer mentions Sprouts outside the start-rule line');
  assert(!sd.html.includes('—'));

  const sp = buildStarterOfferEmail('Sarah', 'sprouts');
  assertEquals(sp.subject, 'What comes after Lavender');
  assert(sp.html.includes("'https://edeninstitute.health/starter'") || sp.html.includes('href="https://edeninstitute.health/starter"'));
  assert(sp.html.includes('href="https://edeninstitute.health/books#buy"'), 'Sprouts whole-year link goes to the Sprouts buy box');
  assert(SPROUTS_OLDER_KIDS_LINE.test(sp.html), 'Sprouts offer carries the older-kids line');
  assert(!SEEDLINGS.test(sp.subject + sp.html.replace(SPROUTS_OLDER_KIDS_LINE, '')), 'Sprouts lead offer mentions Seedlings outside the start-rule line');
  assert(!sp.html.includes('—'));
});

// ---------------------------------------------------------------------------
// FOUNDER DECISION 2026-09-23: no credit, code or "$39 toward" anywhere a
// Seedlings buyer or lead reads. 2026-11-22: Seedlings buyers now EARN a credit,
// but that change ships with NO copy change (Lane 2 drafts the wording for the
// founder separately), so this test still holds: the delivery email does not print
// the code even when the fulfiller now passes it in.
// ---------------------------------------------------------------------------

const CREDIT_WORDING = /credit|coupon|promo(tion)? code|\btoward\b|EDEN-S-/i;

Deno.test('ACCEPTANCE: no credit wording in any Seedlings output', () => {
  // The fulfiller passes creditCode null for Seedlings; even if a code leaked in,
  // the email must not print it.
  const withLeakedCode = renderStarterDeliveryEmail({
    firstName: 'Pat',
    email: 'pat@example.com',
    creditCode: 'EDEN-S-ABC234',
    downloadToken: 'a'.repeat(64),
    receipt: starterReceipt(ORDER, 'seedlings_starter_unit'),
    band: 'seedlings',
  });
  const outputs: Record<string, string> = {
    'delivery email subject': withLeakedCode.subject,
    'delivery email html': withLeakedCode.html,
    'delivery email text': withLeakedCode.text,
    'receipt html': renderReceiptHtml(starterReceipt(ORDER, 'seedlings_starter_unit')),
    'receipt text': renderReceiptText(starterReceipt(ORDER, 'seedlings_starter_unit')),
    'stripe invoice': JSON.stringify(curriculumInvoiceCreation('starter', 'seedlings')),
    'nurture offer': (() => { const m = buildStarterOfferEmail('Sarah', 'seedlings'); return m.subject + m.html; })(),
  };
  for (const [label, text] of Object.entries(outputs)) {
    const hit = text.match(CREDIT_WORDING);
    assert(!hit, `Seedlings ${label} carries credit wording: "${hit?.[0]}"`);
  }
});
