// supabase/functions/_shared/paid-receipt.ts
//
// The "reimbursement-ready receipt" on /esa/florida (added 2026-11-20, Lane 2c). A family who
// bought on our own store with a card enters their order number, the email on the order, the
// parent name and the student name(s), and gets back a one-page, paid-in-full, itemized PDF to
// upload to their scholarship program for reimbursement.
//
// What a Florida reviewer needs (sources on /esa/florida):
//   - Step Up For Students: the full date and amount paid, and an invoice must say "paid in full".
//   - AAA 2026-27 Purchasing Handbook (rev 11/10/26): itemized, physical goods shipped to the
//     residential address on the scholarship account.
//
// Pure (no network, no Deno APIs) so paid-receipt.test.ts covers every rule. The edge function
// esa-receipt does the lookups and calls these.
//
// Privacy and safety rules, all deliberate:
//   - Nothing is shown unless the order number AND the email on the order both match. A wrong
//     number and a wrong email get the SAME answer, so the form cannot be used to learn whether
//     an order number exists or which email bought it.
//   - "Paid in full" is printed only when Stripe itself says the charge succeeded, matches the
//     order total and has no refund on it. Our own order row is not enough: a partial refund
//     does not change orders.status.
//   - Orders paid by a program directly (ESA invoices, no Stripe payment) and $0 orders are
//     refused: there is nothing to reimburse.
//
// Voice rule: no em dashes.

import { timingSafeEqual } from './timing-safe-equal.ts';
import type { Receipt } from './receipt.ts';

export const MAX_RECEIPT_STUDENTS = 6;

export interface ReceiptRequest {
  orderNumber: string;
  email: string;
  parentName: string;
  students: string[];
}

/** One message for "no such order" and "wrong email", so neither can be told apart. */
export const NOT_FOUND_MESSAGE =
  'We could not find an order with that order number and email. Please check both against your order confirmation email, or write to hello@edeninstitute.health.';

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** "ET-1043", "et 1043", "ET1043" and "1043" all mean ET-1043. Anything else is null. */
export function normalizeOrderNumber(raw: unknown): string | null {
  const s = str(raw, 20).toUpperCase().replace(/^#/, '');
  const m = s.match(/^(?:ET[\s-]?)?(\d{4,6})$/);
  return m ? `ET-${m[1]}` : null;
}

export function parseReceiptRequest(raw: unknown): { ok: true; value: ReceiptRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Please fill in the form.' };
  const b = raw as Record<string, unknown>;
  const orderNumber = normalizeOrderNumber(b.orderNumber);
  if (!orderNumber) {
    return { ok: false, error: 'Please enter your order number. It starts with ET- and is in your order confirmation email, for example ET-1043.' };
  }
  const email = str(b.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Please enter the email address you used to order.' };
  const parentName = str(b.parentName, 80);
  if (parentName.length < 3 || !parentName.includes(' ')) {
    return { ok: false, error: "Please enter the parent's first and last name, as it appears on the scholarship account." };
  }
  if (!Array.isArray(b.students) || b.students.length === 0) return { ok: false, error: "Please enter at least one student's name." };
  if (b.students.length > MAX_RECEIPT_STUDENTS) {
    return { ok: false, error: `Please list up to ${MAX_RECEIPT_STUDENTS} students, or email us for more.` };
  }
  const students: string[] = [];
  for (const [i, s] of (b.students as unknown[]).entries()) {
    const name = str(s, 80);
    if (name.length < 3 || !name.includes(' ')) return { ok: false, error: `Please enter student ${i + 1}'s first and last name.` };
    students.push(name);
  }
  return { ok: true, value: { orderNumber, email, parentName, students } };
}

/** Case-insensitive, whitespace-trimmed, constant-time email comparison. */
export function emailMatches(given: string, onOrder: string | null | undefined): boolean {
  if (!onOrder) return false;
  return timingSafeEqual(given.trim().toLowerCase(), onOrder.trim().toLowerCase());
}

/** The order fields the eligibility check reads. */
export interface ReceiptOrder {
  order_number: string | null;
  customer_email: string | null;
  status: string;
  amount_total_cents: number | null;
  stripe_payment_intent_id?: string | null;
  // deno-lint-ignore no-explicit-any
  raw?: any;
}

/** The Stripe facts that prove payment, read live from the PaymentIntent and its latest charge. */
export interface StripePaymentFacts {
  intentStatus: string;
  amountReceived: number;
  chargePaid: boolean;
  chargeRefunded: boolean;
  amountRefunded: number;
  disputed: boolean;
  /** charge.payment_method_details, as Stripe returns it. */
  // deno-lint-ignore no-explicit-any
  methodDetails: any;
}

export type Refusal = { ok: false; code: string; message: string };

const EMAIL_US = 'Please write to hello@edeninstitute.health and we will help you by hand.';

/** The PaymentIntent id for an order: the column, else the Checkout Session kept on raw. */
export function paymentIntentId(order: ReceiptOrder): string | null {
  const col = order.stripe_payment_intent_id;
  if (typeof col === 'string' && col.startsWith('pi_')) return col;
  const fromRaw = order.raw?.payment_intent;
  return typeof fromRaw === 'string' && fromRaw.startsWith('pi_') ? fromRaw : null;
}

/** True when the order was an E2E test purchase (paid on the Stripe TEST key). */
export function isE2eOrder(order: ReceiptOrder): boolean {
  return order.raw?.metadata?.e2e_test === 'true';
}

/**
 * Checks on our own order row, before Stripe is asked anything. Returns null when the order may
 * proceed to the Stripe check.
 */
export function orderRefusal(order: ReceiptOrder): Refusal | null {
  if (order.status === 'refunded' || order.status === 'cancelled') {
    return { ok: false, code: 'REFUNDED', message: `This order was refunded or cancelled, so we cannot issue a paid receipt for it. ${EMAIL_US}` };
  }
  if (order.status === 'preorder_hold') {
    return { ok: false, code: 'PREORDER', message: `This order is still on hold, so a receipt for it would not help with reimbursement yet. ${EMAIL_US}` };
  }
  if (!order.amount_total_cents || order.amount_total_cents <= 0) {
    return { ok: false, code: 'ZERO_TOTAL', message: `This order had nothing to pay, so there is nothing to reimburse. ${EMAIL_US}` };
  }
  if (!paymentIntentId(order)) {
    return {
      ok: false,
      code: 'NOT_CARD',
      message: `This order was not paid by card on our store (for example, a scholarship program paid us directly), so it does not need a reimbursement receipt. ${EMAIL_US}`,
    };
  }
  return null;
}

/** The Stripe check: paid, for the order's full amount, with nothing refunded or disputed. */
export function stripeRefusal(order: ReceiptOrder, f: StripePaymentFacts): Refusal | null {
  const total = order.amount_total_cents ?? 0;
  if (f.intentStatus !== 'succeeded' || !f.chargePaid) {
    return { ok: false, code: 'UNPAID', message: `We could not confirm the payment on this order. ${EMAIL_US}` };
  }
  if (f.chargeRefunded || f.amountRefunded > 0) {
    return { ok: false, code: 'REFUNDED', message: `Part or all of this order was refunded, so we cannot print "Paid in full" on it. ${EMAIL_US}` };
  }
  if (f.disputed) {
    return { ok: false, code: 'DISPUTED', message: `This payment is under review with the card company. ${EMAIL_US}` };
  }
  if (f.amountReceived !== total) {
    return { ok: false, code: 'AMOUNT_MISMATCH', message: `We could not match the payment to the order total. ${EMAIL_US}` };
  }
  return null;
}

const CARD_BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
};

/**
 * How the order was paid, from Stripe's charge.payment_method_details: "Visa ending 4242" for a
 * card (the same wording the order emails use, receipt.ts paidWithFromRaw), "Klarna" for Klarna.
 * Null when Stripe gives nothing usable; the caller then refuses rather than print a guess.
 */
// deno-lint-ignore no-explicit-any
export function paymentMethodLabel(details: any): string | null {
  const type = details?.type;
  if (type === 'card') {
    const c = details.card;
    if (typeof c?.last4 !== 'string' || !/^\d{4}$/.test(c.last4)) return null;
    const brand = (typeof c.brand === 'string' && CARD_BRANDS[c.brand]) || 'Card';
    const wallet = c.wallet?.type === 'apple_pay' ? ' (Apple Pay)' : c.wallet?.type === 'google_pay' ? ' (Google Pay)' : '';
    return `${brand} ending ${c.last4}${wallet}`;
  }
  if (type === 'klarna') return 'Klarna';
  if (type === 'link') return 'Link by Stripe';
  if (type === 'cashapp') return 'Cash App Pay';
  if (type === 'us_bank_account') {
    const last4 = details.us_bank_account?.last4;
    return typeof last4 === 'string' && /^\d{4}$/.test(last4) ? `Bank account ending ${last4}` : 'Bank account';
  }
  return null;
}

/** Shipping address as printed lines, from orders.shipping_address. Empty for a download. */
// deno-lint-ignore no-explicit-any
export function shipToLines(name: string | null | undefined, addr: any): string[] {
  if (!addr || typeof addr !== 'object' || !addr.line1) return [];
  const cityLine = [addr.city, [addr.state, addr.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [name, addr.line1, addr.line2, cityLine].filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
}

export interface PaidReceipt {
  receipt: Receipt;
  paidWith: string;
  parentName: string;
  students: string[];
  /** Printed lines of the shipping address, empty for a download-only order. */
  shipTo: string[];
  /** The date the receipt was made, "November 20, 2026". */
  issuedOn: string;
}

/** "November 20, 2026" in Central time, the date format receipt.ts prints. */
export function longCentralDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
}

/** The PDF's file name. The order number only: no names. */
export function receiptFilename(orderNumber: string): string {
  return `Eden's Table paid receipt ${orderNumber}.pdf`;
}
