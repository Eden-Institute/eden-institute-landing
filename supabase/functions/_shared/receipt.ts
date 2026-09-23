// supabase/functions/_shared/receipt.ts
//
// Itemized receipts for curriculum purchases. Founder requirement 2026-09-12:
// Eden's Table is targeting scholarship states (Education Savings Accounts and
// similar programs), and those reviewers need a receipt that is ITEMIZED and says
// CURRICULUM. Before this file the order confirmation printed one line and the
// grand total, and the Starter Unit's label was the raw key sprouts_starter_unit.
//
// Three consumers:
//   - order-messages.ts   the printed-set confirmation email (loadOrderReceipt)
//   - starter-email.ts    the Starter Unit delivery email (starterReceipt)
//   - create-checkout     Stripe's own invoice (curriculumInvoiceCreation)
//
// Pure rendering functions take plain data, so render_receipt_audit.ts can test
// them without a database.
//
// Voice rule: no em dashes.

import type { Db, OrderRow } from './order-db.ts';
import { escapeHtml } from './html-escape.ts';

/**
 * The seller of record, printed on every receipt and every Stripe invoice.
 * Verified 2026-09-12 against memory r_rooted_in_faith_llc, the ESA Application
 * Kit and the Lulu billing record: the legal entity is Rooted in Faith Ventures
 * LLC, and this is the address FORMAT that document uses. Do not reformat it.
 */
export const SELLER_LEGAL_NAME = 'Rooted in Faith Ventures LLC';
// Brand names, shown in parentheses. Deliberately not labelled as an assumed
// name: no assumed-name filing is on record (TN entity 002118081), and a receipt
// is a legal document. If Camila files one, this line can say so.
export const SELLER_BRANDS = "The Eden Institute, Eden's Table Homeschool Curriculum";
export const SELLER_ADDRESS = '303 Holly Cir, Unit 3262, Clarksville, TN 37043';
// Support contact on every receipt and invoice (founder decision 2026-09-13). The
// phone matches web/pages/contact.astro.
export const SELLER_CONTACT = 'hello@edeninstitute.health, (931) 575-5895';

/**
 * Receipt names, keyed by SKU. Deliberately NOT products.name: that column drives
 * the /books buy box, and a name written for a scholarship reviewer ("Homeschool
 * Curriculum, Grades K-2") reads badly in a shop. Every name here contains the
 * word "Curriculum", which render_receipt_audit.ts enforces.
 */
export const RECEIPT_NAMES: Record<string, { name: string; grade: string }> = {
  sprouts_print_set: {
    name: "Sprouts Printed Curriculum Set: Teacher's Guide, Student Notebook and Read-Aloud Storybook (36 weeks)",
    grade: 'K-2',
  },
  sprouts_nb_print: {
    name: 'Sprouts Curriculum Student Notebook, additional printed copy',
    grade: 'K-2',
  },
  // 2026-09-23. Key = the seedlings_print_set SKU in lulu-config.ts.
  seedlings_print_set: {
    name: "Seedlings Printed Curriculum Set: Teacher's Guide, Student Notebook and Read-Aloud Storybook (36 weeks)",
    grade: '3-5',
  },
  sprouts_starter_unit: {
    name: 'Sprouts Starter Unit, Digital Curriculum, Weeks 1 to 9',
    grade: 'K-2',
  },
};

/** The label stored on orders.product_label for a Starter Unit purchase. */
export const STARTER_ORDER_LABEL = RECEIPT_NAMES.sprouts_starter_unit.name;

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitCents: number;
}

export interface Receipt {
  orderNumber: string | null;
  /** ISO timestamp of the purchase. */
  purchasedAt: string | null;
  billTo: string | null;
  lines: ReceiptLine[];
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  /** e.g. 'K-2'. Shown on the receipt because program reviewers ask for it. */
  gradeLevel: string | null;
  /** e.g. 'Visa ending 4242'. Null for a non-card payment or when unknown. */
  paidWith: string | null;
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
 * "Visa ending 4242", from the card stripe-webhook stamps on orders.raw as
 * eden_payment_card (Utah's ESA program requires the last 4 on a receipt). There
 * is no card column on orders, so it rides in raw. Returns null for anything that
 * is not a card with a 4-digit last4, so a receipt never prints "undefined".
 */
// deno-lint-ignore no-explicit-any
export function paidWithFromRaw(raw: any): string | null {
  const card = raw?.eden_payment_card;
  if (typeof card?.last4 !== 'string' || !/^\d{4}$/.test(card.last4)) return null;
  const brand = (typeof card.brand === 'string' && CARD_BRANDS[card.brand]) || 'Card';
  return `${brand} ending ${card.last4}`;
}

export function usd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
}

// deno-lint-ignore no-explicit-any
function num(v: any): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/**
 * Build the receipt for a printed-set order from its stored rows. Lines come from
 * order_items (written BEFORE the confirmation fires, see order-flow.ts), shipping
 * and discount from the Stripe session kept on orders.raw, tax from orders.tax_cents.
 * Returns null if there are no line items, so the caller can fall back rather
 * than send a receipt with nothing on it.
 */
export async function loadOrderReceipt(db: Db, order: OrderRow): Promise<Receipt | null> {
  const { data, error } = await db.from('order_items')
    .select('quantity, unit_price_cents, products(sku, name)')
    .eq('order_id', order.id);
  if (error || !Array.isArray(data) || data.length === 0) return null;

  // deno-lint-ignore no-explicit-any
  const lines: ReceiptLine[] = data.map((r: any) => {
    const sku = r.products?.sku as string | undefined;
    const name = (sku && RECEIPT_NAMES[sku]?.name) ?? r.products?.name ?? sku ?? 'Curriculum item';
    return { name, quantity: num(r.quantity) || 1, unitCents: num(r.unit_price_cents) };
  });
  // Stable order: the set first, add-ons after.
  lines.sort((a, b) => b.unitCents - a.unitCents);

  // deno-lint-ignore no-explicit-any
  const raw = (order as any).raw ?? {};
  const totals = raw.total_details ?? {};
  // deno-lint-ignore no-explicit-any
  const firstSku = (data[0] as any)?.products?.sku as string | undefined;

  return {
    orderNumber: order.order_number,
    // deno-lint-ignore no-explicit-any
    purchasedAt: (order as any).created_at ?? null,
    billTo: order.shipping_name ?? raw.customer_details?.name ?? null,
    lines,
    discountCents: num(totals.amount_discount),
    shippingCents: num(totals.amount_shipping),
    // deno-lint-ignore no-explicit-any
    taxCents: num((order as any).tax_cents ?? totals.amount_tax),
    totalCents: num(order.amount_total_cents),
    gradeLevel: (firstSku && RECEIPT_NAMES[firstSku]?.grade) ?? null,
    paidWith: paidWithFromRaw(raw),
  };
}

/**
 * Build the receipt for a Starter Unit purchase. One line at the pre-discount
 * price (Stripe's amount_subtotal), with any discount and tax shown separately,
 * so the lines always add up to what the card was charged.
 */
// deno-lint-ignore no-explicit-any
export function starterReceipt(order: any): Receipt {
  const raw = order?.raw ?? {};
  const totals = raw.total_details ?? {};
  const total = num(order?.amount_total_cents);
  const tax = num(order?.tax_cents ?? totals.amount_tax);
  const discount = num(totals.amount_discount);
  const subtotal = typeof raw.amount_subtotal === 'number' ? raw.amount_subtotal : total - tax + discount;
  return {
    orderNumber: order?.order_number ?? null,
    purchasedAt: order?.created_at ?? null,
    billTo: raw.customer_details?.name ?? null,
    lines: [{ name: STARTER_ORDER_LABEL, quantity: 1, unitCents: subtotal }],
    discountCents: discount,
    shippingCents: 0,
    taxCents: tax,
    totalCents: total,
    gradeLevel: RECEIPT_NAMES.sprouts_starter_unit.grade,
    paidWith: paidWithFromRaw(raw),
  };
}

/**
 * The itemized receipt as an email-safe HTML table. Inline styles only: mail
 * clients strip <style>. Every row is a real table row so it survives Gmail,
 * Apple Mail and Outlook, and prints cleanly for a reimbursement file.
 */
export function renderReceiptHtml(r: Receipt): string {
  const cell = 'font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#3D3832;padding:6px 0;vertical-align:top;';
  const right = cell + 'text-align:right;white-space:nowrap;padding-left:12px;';
  const muted = 'font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#6B665A;margin:0;';
  const date = longDate(r.purchasedAt);

  const itemRows = r.lines.map((l) => `
<tr>
  <td style="${cell}">${escapeHtml(l.name)}${l.quantity > 1 ? `<br><span style="font-size:13px;color:#6B665A;">${l.quantity} x ${usd(l.unitCents)}</span>` : ''}</td>
  <td style="${right}">${usd(l.unitCents * l.quantity)}</td>
</tr>`).join('');

  const subtotal = r.lines.reduce((n, l) => n + l.unitCents * l.quantity, 0);
  const summary = (label: string, cents: number, strong = false) => `
<tr>
  <td style="${cell}${strong ? 'font-weight:bold;border-top:1px solid #D9CFB8;padding-top:10px;' : ''}">${label}</td>
  <td style="${right}${strong ? 'font-weight:bold;border-top:1px solid #D9CFB8;padding-top:10px;' : ''}">${usd(cents)}</td>
</tr>`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0D7C2;border-radius:6px;background-color:#FBF8F1;margin:8px 0 20px 0;">
<tr><td style="padding:18px 20px;">
  <p style="font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:3px;color:#8A6D1F;text-transform:uppercase;margin:0 0 10px 0;">Itemized receipt: homeschool curriculum</p>
  ${r.orderNumber ? `<p style="${muted}">Order <strong style="color:#3D3832;">${r.orderNumber}</strong></p>` : ''}
  ${date ? `<p style="${muted}">Purchased ${date}</p>` : ''}
  ${r.billTo ? `<p style="${muted}">Bill to ${escapeHtml(r.billTo)}</p>` : ''}
  ${r.gradeLevel ? `<p style="${muted}">Grade level ${r.gradeLevel}</p>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
    <tr>
      <td style="${cell}font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6B665A;border-bottom:1px solid #D9CFB8;">Item</td>
      <td style="${right}font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6B665A;border-bottom:1px solid #D9CFB8;">Amount</td>
    </tr>
    ${itemRows}
    ${summary('Subtotal', subtotal)}
    ${r.discountCents > 0 ? summary('Discount', -r.discountCents) : ''}
    ${r.shippingCents > 0 ? summary('Shipping', r.shippingCents) : ''}
    ${summary('Sales tax', r.taxCents)}
    ${summary('Total paid', r.totalCents, true)}
  </table>
  ${r.paidWith ? `<p style="${muted}margin-top:10px;">Paid by ${r.paidWith}</p>` : ''}
  <p style="${muted}margin-top:14px;">Sold by ${SELLER_LEGAL_NAME} (${SELLER_BRANDS}), ${SELLER_ADDRESS}. ${SELLER_CONTACT}</p>
</td></tr>
</table>`;
}

/** The same receipt as plain text, for the text/plain part of the email. */
export function renderReceiptText(r: Receipt): string {
  const date = longDate(r.purchasedAt);
  const out: string[] = ['ITEMIZED RECEIPT: HOMESCHOOL CURRICULUM'];
  if (r.orderNumber) out.push(`Order ${r.orderNumber}`);
  if (date) out.push(`Purchased ${date}`);
  if (r.billTo) out.push(`Bill to ${r.billTo}`);
  if (r.gradeLevel) out.push(`Grade level ${r.gradeLevel}`);
  out.push('');
  for (const l of r.lines) {
    out.push(`${l.name}`);
    out.push(`  ${l.quantity} x ${usd(l.unitCents)} = ${usd(l.unitCents * l.quantity)}`);
  }
  const subtotal = r.lines.reduce((n, l) => n + l.unitCents * l.quantity, 0);
  out.push('', `Subtotal   ${usd(subtotal)}`);
  if (r.discountCents > 0) out.push(`Discount   ${usd(-r.discountCents)}`);
  if (r.shippingCents > 0) out.push(`Shipping   ${usd(r.shippingCents)}`);
  out.push(`Sales tax  ${usd(r.taxCents)}`, `Total paid ${usd(r.totalCents)}`);
  if (r.paidWith) out.push(`Paid by ${r.paidWith}`);
  out.push('', `Sold by ${SELLER_LEGAL_NAME} (${SELLER_BRANDS}), ${SELLER_ADDRESS}. ${SELLER_CONTACT}`);
  return out.join('\n');
}

/** True when the lines, discount, shipping and tax add up to what was charged. */
export function receiptBalances(r: Receipt): boolean {
  const subtotal = r.lines.reduce((n, l) => n + l.unitCents * l.quantity, 0);
  return subtotal - r.discountCents + r.shippingCents + r.taxCents === r.totalCents;
}

/**
 * Stripe Checkout `invoice_creation` for a curriculum purchase. Founder decision
 * 2026-09-12: turn on invoicing (Stripe charges a small per-invoice fee for it).
 * Stripe then issues a numbered, itemized invoice with a hosted page and PDF,
 * which is the document scholarship programs most often ask for.
 *
 * Line-item names on that invoice come from the Stripe PRODUCT names, which live
 * in the Dashboard and cannot be read from here. The custom fields and description
 * guarantee the word "curriculum" appears on the invoice whatever those names are.
 *
 * Validated in Stripe TEST mode on 2026-09-12 against the exact print and Starter
 * session shapes (shipping, automatic tax, phone collection, customer creation,
 * custom text, promotion codes): all accepted. Note the nesting: invoice_data
 * lives INSIDE invoice_creation; a top-level invoice_data is refused.
 * Custom field values are capped at 140 characters, names at 40, four fields max.
 */
//
// `band` (2026-09-23) defaults to Sprouts, and the Sprouts output is unchanged
// character for character. Seedlings swaps the band name and grades only.
export function curriculumInvoiceCreation(kind: 'print' | 'starter', band: 'sprouts' | 'seedlings' = 'sprouts') {
  const name = band === 'seedlings' ? 'Seedlings' : 'Sprouts';
  const grades = band === 'seedlings' ? '3-5' : 'K-2';
  const grade = `${grades} (${name})`;
  return {
    enabled: true,
    invoice_data: {
      description: kind === 'print'
        ? `Homeschool curriculum purchase: Eden's Table ${name} printed curriculum, a ${grades} Christian homeschool curriculum.`
        : `Homeschool curriculum purchase: Eden's Table ${name} Starter Unit, digital curriculum, weeks 1 to 9.`,
      custom_fields: [
        { name: 'Item type', value: 'Homeschool curriculum' },
        { name: 'Grade level', value: grade },
        { name: 'Format', value: kind === 'print' ? 'Printed books, shipped' : 'Digital download (PDF)' },
      ],
      footer: `${SELLER_LEGAL_NAME} (${SELLER_BRANDS}), ${SELLER_ADDRESS}. ${SELLER_CONTACT}`,
      metadata: { receipt_kind: `curriculum_${kind}` },
    },
  };
}
