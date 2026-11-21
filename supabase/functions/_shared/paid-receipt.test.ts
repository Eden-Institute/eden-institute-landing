// deno test supabase/functions/_shared/paid-receipt.test.ts
// The reimbursement-ready receipt (/esa/florida, esa-receipt). Pure rules plus one real PDF render.
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  emailMatches,
  isE2eOrder,
  normalizeOrderNumber,
  NOT_FOUND_MESSAGE,
  orderRefusal,
  parseReceiptRequest,
  paymentIntentId,
  paymentMethodLabel,
  receiptFilename,
  shipToLines,
  stripeRefusal,
  type ReceiptOrder,
  type StripePaymentFacts,
} from './paid-receipt.ts';
import { renderPaidReceiptPdf } from './paid-receipt-pdf.ts';
import { receiptBalances, SELLER_ADDRESS, SELLER_LEGAL_NAME, type Receipt } from './receipt.ts';

const ORDER: ReceiptOrder = {
  order_number: 'ET-9100',
  customer_email: 'Mom@Example.com',
  status: 'shipped',
  amount_total_cents: 26100,
  stripe_payment_intent_id: 'pi_123',
  raw: {},
};

const PAID: StripePaymentFacts = {
  intentStatus: 'succeeded',
  amountReceived: 26100,
  chargePaid: true,
  chargeRefunded: false,
  amountRefunded: 0,
  disputed: false,
  methodDetails: { type: 'card', card: { brand: 'visa', last4: '4242' } },
};

Deno.test('order numbers: the forms families type all mean the same order', () => {
  for (const s of ['ET-1043', 'et-1043', 'ET1043', 'ET 1043', '1043', ' #ET-1043 ']) assertEquals(normalizeOrderNumber(s), 'ET-1043');
  for (const s of ['', 'ET-12', 'AB-1043', 'ET-1043x', '1043; drop', null, 42]) assertEquals(normalizeOrderNumber(s), null);
});

Deno.test('parseReceiptRequest validates every field', () => {
  const ok = parseReceiptRequest({ orderNumber: 'et1043', email: ' Mom@Example.com ', parentName: 'Jane Doe', students: ['Sam Doe', 'Ava Doe'] });
  assert(ok.ok);
  if (ok.ok) {
    assertEquals(ok.value.orderNumber, 'ET-1043');
    assertEquals(ok.value.email, 'mom@example.com');
    assertEquals(ok.value.students, ['Sam Doe', 'Ava Doe']);
  }
  assert(!parseReceiptRequest({ orderNumber: 'x', email: 'a@b.co', parentName: 'Jane Doe', students: ['Sam Doe'] }).ok);
  assert(!parseReceiptRequest({ orderNumber: 'ET-1043', email: 'nope', parentName: 'Jane Doe', students: ['Sam Doe'] }).ok);
  assert(!parseReceiptRequest({ orderNumber: 'ET-1043', email: 'a@b.co', parentName: 'Jane', students: ['Sam Doe'] }).ok);
  assert(!parseReceiptRequest({ orderNumber: 'ET-1043', email: 'a@b.co', parentName: 'Jane Doe', students: [] }).ok);
  assert(!parseReceiptRequest({ orderNumber: 'ET-1043', email: 'a@b.co', parentName: 'Jane Doe', students: ['Sam'] }).ok);
  assert(!parseReceiptRequest({ orderNumber: 'ET-1043', email: 'a@b.co', parentName: 'Jane Doe', students: Array(7).fill('Sam Doe') }).ok);
});

Deno.test('email check is case- and space-insensitive and refuses a missing email', () => {
  assert(emailMatches('mom@example.com', ' Mom@Example.com'));
  assert(!emailMatches('dad@example.com', 'mom@example.com'));
  assert(!emailMatches('mom@example.com', null));
  // One message for both failures, so the form cannot reveal whether an order exists.
  assertStringIncludes(NOT_FOUND_MESSAGE, 'order number and email');
});

Deno.test('orderRefusal: refunded, cancelled, held, $0 and program-paid orders get no paid receipt', () => {
  assertEquals(orderRefusal(ORDER), null);
  assertEquals(orderRefusal({ ...ORDER, status: 'refunded' })?.code, 'REFUNDED');
  assertEquals(orderRefusal({ ...ORDER, status: 'cancelled' })?.code, 'REFUNDED');
  assertEquals(orderRefusal({ ...ORDER, status: 'preorder_hold' })?.code, 'PREORDER');
  assertEquals(orderRefusal({ ...ORDER, amount_total_cents: 0 })?.code, 'ZERO_TOTAL');
  // ESA invoice orders (ClassWallet paid us directly) have no PaymentIntent.
  assertEquals(orderRefusal({ ...ORDER, stripe_payment_intent_id: null })?.code, 'NOT_CARD');
  // The intent on the stored Checkout Session counts when the column is empty.
  assertEquals(paymentIntentId({ ...ORDER, stripe_payment_intent_id: null, raw: { payment_intent: 'pi_raw' } }), 'pi_raw');
});

Deno.test('stripeRefusal: "Paid in full" only for a succeeded, unrefunded, undisputed charge of the full total', () => {
  assertEquals(stripeRefusal(ORDER, PAID), null);
  assertEquals(stripeRefusal(ORDER, { ...PAID, intentStatus: 'processing' })?.code, 'UNPAID');
  assertEquals(stripeRefusal(ORDER, { ...PAID, chargePaid: false })?.code, 'UNPAID');
  // A partial refund leaves orders.status alone; Stripe is what catches it.
  assertEquals(stripeRefusal(ORDER, { ...PAID, amountRefunded: 1200 })?.code, 'REFUNDED');
  assertEquals(stripeRefusal(ORDER, { ...PAID, chargeRefunded: true })?.code, 'REFUNDED');
  assertEquals(stripeRefusal(ORDER, { ...PAID, disputed: true })?.code, 'DISPUTED');
  assertEquals(stripeRefusal(ORDER, { ...PAID, amountReceived: 26000 })?.code, 'AMOUNT_MISMATCH');
});

Deno.test('payment method wording matches the order emails ("Visa ending 4242")', () => {
  assertEquals(paymentMethodLabel(PAID.methodDetails), 'Visa ending 4242');
  assertEquals(paymentMethodLabel({ type: 'card', card: { brand: 'amex', last4: '0005', wallet: { type: 'apple_pay' } } }), 'American Express ending 0005 (Apple Pay)');
  assertEquals(paymentMethodLabel({ type: 'klarna' }), 'Klarna');
  assertEquals(paymentMethodLabel({ type: 'card', card: { brand: 'visa' } }), null);
  assertEquals(paymentMethodLabel(null), null);
});

Deno.test('E2E orders are recognised so they are checked on the Stripe TEST key', () => {
  assert(isE2eOrder({ ...ORDER, raw: { metadata: { e2e_test: 'true' } } }));
  assert(!isE2eOrder(ORDER));
});

Deno.test('ship-to lines and the filename carry no stray values', () => {
  assertEquals(shipToLines('Jane Doe', { line1: '1 Main St', line2: null, city: 'Tampa', state: 'FL', postal_code: '33601' }), ['Jane Doe', '1 Main St', 'Tampa, FL 33601']);
  assertEquals(shipToLines('Jane Doe', null), []);
  assertEquals(receiptFilename('ET-9100'), "Eden's Table paid receipt ET-9100.pdf");
});

Deno.test('the PDF says Paid in full, the full date, every item, the total, the card and the students', async () => {
  const receipt: Receipt = {
    orderNumber: 'ET-9100',
    purchasedAt: '2026-11-05T02:24:22Z', // Nov 4, 2026 in Central time
    billTo: 'Jane Doe',
    lines: [
      { name: "Sprouts Printed Curriculum Set: Teacher's Guide, Student Notebook and Read-Aloud Storybook (36 weeks)", quantity: 1, unitCents: 24900 },
      { name: 'Sprouts Curriculum Student Notebook, additional printed copy', quantity: 2, unitCents: 3999 },
    ],
    discountCents: 0,
    shippingCents: 1350,
    taxCents: 0,
    totalCents: 24900 + 7998 + 1350,
    gradeLevel: 'K-2',
    paidWith: 'Visa ending 4242',
  };
  assert(receiptBalances(receipt));
  const { bytes, text } = await renderPaidReceiptPdf({
    receipt,
    paidWith: 'Visa ending 4242',
    parentName: 'Jane Doe',
    students: ['Sam Nguyễn', 'Ava Doe'],
    shipTo: ['Jane Doe', '1 Main St', 'Tampa, FL 33601'],
    issuedOn: 'November 20, 2026',
  });
  assertEquals(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-');
  for (const must of [
    'PAID IN FULL',
    'Date paid: November 4, 2026',
    'Order number: ET-9100',
    SELLER_LEGAL_NAME,
    SELLER_ADDRESS,
    'Visa ending 4242',
    'Balance due',
    '$342.48',
    '$79.98',
    'Students: Sam Nguyen, Ava Doe',
    'Parent: Jane Doe',
    'Tampa, FL 33601',
  ]) assertStringIncludes(text, must);
  assert(!/—/.test(text), 'no em dash on the receipt');
  // Write it out for a visual check when PAID_RECEIPT_OUT is set.
  const out = Deno.env.get('PAID_RECEIPT_OUT');
  if (out) await Deno.writeFile(out, bytes);
});
