// supabase/functions/_shared/testdata/fpea-regression-inputs.ts
//
// Fixed inputs for the FPEA 2027 regression test (fpea-offer.test.ts). The golden
// SHA-256 hashes in that test were produced by rendering EXACTLY these inputs with
// the code on origin/main at 5eee539, BEFORE the FPEA offer existed. If a normal
// (non-FPEA) email, receipt or confirmation changes by a single byte, its hash
// changes and the test fails. Do not edit these inputs without regenerating the
// hashes from a pre-FPEA checkout of the same files.

import type { Receipt } from '../receipt.ts';
import type { OrderRow } from '../order-db.ts';
import type { StarterEmailModel } from '../starter-email.ts';

export const RECEIPT_STARTER: Receipt = {
  orderNumber: 'ET-1234',
  purchasedAt: '2026-10-20T15:04:05.000Z',
  billTo: 'Ada Lovelace',
  lines: [{ name: 'Sprouts Starter Unit', quantity: 1, unitCents: 3900 }],
  discountCents: 0,
  shippingCents: 0,
  taxCents: 312,
  totalCents: 4212,
  gradeLevel: 'K-2',
  paidWith: 'Visa ending 4242',
};

export const RECEIPT_PRINT_SHIPPED: Receipt = {
  orderNumber: 'ET-2001',
  purchasedAt: '2026-10-21T18:30:00.000Z',
  billTo: 'Grace Hopper',
  lines: [
    { name: 'Sprouts Printed Curriculum Set', quantity: 1, unitCents: 24900 },
    { name: 'Sprouts Extra Student Notebook', quantity: 2, unitCents: 3999 },
  ],
  discountCents: 0,
  shippingCents: 1350,
  taxCents: 2100,
  totalCents: 36348,
  gradeLevel: 'K-2',
  paidWith: null,
};

export const RECEIPT_PRINT_ZERO_SHIPPING: Receipt = {
  ...RECEIPT_PRINT_SHIPPED,
  orderNumber: 'ET-2002',
  shippingCents: 0,
  totalCents: 34998,
};

export const STARTER_EMAIL_MODELS: StarterEmailModel[] = [
  { firstName: 'Ada', email: 'ada@example.com', creditCode: null, downloadToken: 'tok_abc123', receipt: null },
  { firstName: null, email: 'b@example.com', creditCode: 'EDEN-S-ABC234', downloadToken: 'tok_def456', receipt: RECEIPT_STARTER, band: 'sprouts' },
  {
    firstName: 'Cy',
    email: 'c@example.com',
    creditCode: null,
    downloadToken: 'tok_ghi789',
    receipt: { ...RECEIPT_STARTER, lines: [{ name: 'Seedlings Starter Unit', quantity: 1, unitCents: 3900 }], gradeLevel: '3-5' },
    band: 'seedlings',
  },
];

function printOrder(over: Partial<OrderRow>): OrderRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    order_number: 'ET-2001',
    customer_email: 'grace@example.com',
    customer_phone: null,
    shipping_name: 'Grace Hopper',
    product_label: 'Sprouts Printed Curriculum Set',
    lookup_key: 'sprouts_print_set',
    amount_total_cents: 36348,
    tax_cents: 2100,
    created_at: '2026-10-21T18:30:00.000Z',
    raw: {
      id: 'cs_test_regression',
      metadata: { print_sku: 'sprouts_print_set', fulfillment: 'lulu', sms_consent: 'false' },
      total_details: { amount_discount: 0, amount_shipping: 1350, amount_tax: 2100 },
      customer_details: { name: 'Grace Hopper' },
    },
    currency: 'usd',
    sms_consent: false,
    status: 'ready_to_fulfill',
    is_preorder: false,
    fulfillment: 'lulu',
    ...over,
  } as OrderRow;
}

export const PRINT_ORDERS: OrderRow[] = [
  printOrder({}),
  printOrder({ order_number: null, product_label: null }),
  printOrder({ lookup_key: 'seedlings_print_set', product_label: 'Seedlings Printed Curriculum Set' }),
  printOrder({ lookup_key: 'both_bands_print_set', product_label: 'Sprouts and Seedlings Printed Curriculum Sets' }),
];

/** order_items rows as loadOrderReceipt selects them, for a fake db. */
export const PRINT_ORDER_ITEMS = [
  { quantity: 1, unit_price_cents: 24900, products: { sku: 'sprouts_print_set', name: 'Sprouts Printed Curriculum Set', volume_price_cents: null, volume_min_qty: null } },
  { quantity: 2, unit_price_cents: 3999, products: { sku: 'sprouts_nb_print', name: 'Sprouts Extra Student Notebook', volume_price_cents: 3200, volume_min_qty: 6 } },
];
