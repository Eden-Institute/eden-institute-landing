// supabase/functions/_shared/paid-receipt-pdf.ts
//
// Draws the reimbursement-ready receipt (paid-receipt.ts) as one Letter page. Same toolkit and
// look as the ESA invoice (esa-invoice-pdf.ts): pdf-lib, standard Helvetica (no font embedding,
// no memory cost), and every string passed through `safe()` so a name like "Nguyễn" prints "?"
// for the one letter the font cannot encode instead of failing the request.
//
// Every number on the page comes from the Receipt that receipt.ts builds for the order emails,
// so this receipt and the confirmation email can never disagree.
//
// Voice rule: no em dashes.

import { PDFDocument, PDFFont, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1?target=denonext';
import { SELLER_ADDRESS, SELLER_BRANDS, SELLER_CONTACT, SELLER_LEGAL_NAME, usd } from './receipt.ts';
import { longCentralDate, type PaidReceipt } from './paid-receipt.ts';

const FOREST = rgb(0x2b / 255, 0x3a / 255, 0x1e / 255);
const GOLD = rgb(0xc5 / 255, 0xa4 / 255, 0x4e / 255);
const INK = rgb(0x1e / 255, 0x1e / 255, 0x14 / 255);
const MUTED = rgb(0x5c / 255, 0x4a / 255, 0x28 / 255);
const LINEN = rgb(0xf5 / 255, 0xed / 255, 0xd6 / 255);
const PAID_GREEN = rgb(0x1f / 255, 0x6b / 255, 0x3a / 255);

export interface RenderedReceipt {
  bytes: Uint8Array;
  /** Every string drawn, joined, for the tests. */
  text: string;
}

export async function renderPaidReceiptPdf(p: PaidReceipt): Promise<RenderedReceipt> {
  const r = p.receipt;
  if (!r.orderNumber || !r.purchasedAt) throw new Error('paid receipt needs an order number and a purchase date');
  const datePaid = longCentralDate(r.purchasedAt);

  const doc = await PDFDocument.create();
  doc.setTitle(`Paid receipt ${r.orderNumber}`);
  doc.setAuthor(SELLER_LEGAL_NAME);
  doc.setCreator("Eden's Table");
  doc.setProducer("Eden's Table");
  const page = doc.addPage([612, 792]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const drawn: string[] = [];

  const charsets = new Map<PDFFont, Set<number>>();
  const safe = (f: PDFFont, s: string) => {
    let cs = charsets.get(f);
    if (!cs) {
      cs = new Set(f.getCharacterSet());
      charsets.set(f, cs);
    }
    return Array.from(s.normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-'))
      .map((ch) => {
        if (cs!.has(ch.codePointAt(0)!)) return ch;
        // A letter the font lacks ("ễ") prints as its plain letter ("e") before falling back to "?".
        const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
        return base && cs!.has(base.codePointAt(0)!) ? base : '?';
      })
      .join('');
  };
  const text = (s: string, x: number, y: number, size: number, f = reg, color = INK) => {
    const t = safe(f, s);
    page.drawText(t, { x, y, size, font: f, color });
    drawn.push(t);
  };
  const right = (s: string, xr: number, y: number, size: number, f = reg, color = INK) => {
    const t = safe(f, s);
    text(t, xr - f.widthOfTextAtSize(t, size), y, size, f, color);
  };
  const wrap = (s: string, width: number, size: number, f = reg): string[] => {
    const words = safe(f, s).split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const L = 54;
  const R = 558;

  // Seller block (left) and RECEIPT header (right).
  let y = 736;
  text(SELLER_LEGAL_NAME, L, y, 16, bold, FOREST);
  y -= 16;
  for (const line of [SELLER_BRANDS, SELLER_ADDRESS, SELLER_CONTACT]) {
    for (const l of wrap(line, 290, 9.5)) {
      text(l, L, y, 9.5, reg, MUTED);
      y -= 12;
    }
  }
  right('RECEIPT', R, 730, 26, bold, FOREST);
  right(`Order number: ${r.orderNumber}`, R, 706, 10.5);
  right(`Date paid: ${datePaid}`, R, 692, 10.5, bold);
  right(`Receipt printed: ${p.issuedOn}`, R, 678, 9, reg, MUTED);

  y = Math.min(y, 664) - 6;
  page.drawRectangle({ x: L, y, width: R - L, height: 1.5, color: GOLD });

  // PAID IN FULL band.
  y -= 50;
  page.drawRectangle({ x: L, y, width: R - L, height: 40, borderColor: PAID_GREEN, borderWidth: 2, color: rgb(1, 1, 1) });
  text('PAID IN FULL', L + 14, y + 14, 18, bold, PAID_GREEN);
  right(`${usd(r.totalCents)} paid ${datePaid} by ${p.paidWith}`, R - 14, y + 22, 10, bold, INK);
  right('Balance due: $0.00', R - 14, y + 9, 10, reg, INK);

  // Parent and students (left), shipped to (right).
  const colW = (R - L - 24) / 2;
  const boxTop = y - 16;
  const left: string[] = [
    ...wrap(`Parent: ${p.parentName}`, colW - 16, 10),
    ...wrap(`Student${p.students.length > 1 ? 's' : ''}: ${p.students.join(', ')}`, colW - 16, 10),
  ];
  if (r.gradeLevel) left.push(`Grade level: ${r.gradeLevel}`);
  const rightLines = p.shipTo.length ? p.shipTo.flatMap((l) => wrap(l, colW - 16, 10)) : ['Digital download, delivered by email'];
  const boxH = 30 + Math.max(left.length, rightLines.length) * 13;
  for (const [i, [label, rows]] of ([['FOR', left], [p.shipTo.length ? 'SHIPPED TO' : 'DELIVERY', rightLines]] as [string, string[]][]).entries()) {
    const x = L + i * (colW + 24);
    page.drawRectangle({ x, y: boxTop - boxH, width: colW, height: boxH, color: LINEN });
    text(label, x + 8, boxTop - 16, 8.5, bold, FOREST);
    let ly = boxTop - 30;
    for (const l of rows) {
      text(l, x + 8, ly, 10);
      ly -= 13;
    }
  }

  // Item table.
  y = boxTop - boxH - 28;
  const cols = { item: L + 6, qty: 400, unit: 480, amount: R - 6 };
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 20, color: FOREST });
  text(r.heading === 'Itemized receipt' ? 'Item' : 'Item (homeschool curriculum)', cols.item, y, 9, bold, LINEN);
  right('Qty', cols.qty, y, 9, bold, LINEN);
  right('Unit price', cols.unit, y, 9, bold, LINEN);
  right('Amount', cols.amount, y, 9, bold, LINEN);
  y -= 26;
  const itemW = cols.qty - cols.item - 40;
  for (const it of r.lines) {
    right(String(it.quantity), cols.qty, y, 9.5);
    right(usd(it.unitCents), cols.unit, y, 9.5);
    right(usd(it.unitCents * it.quantity), cols.amount, y, 9.5, bold);
    for (const l of wrap(it.name, itemW, 9.5, bold)) {
      text(l, cols.item, y, 9.5, bold);
      y -= 12;
    }
    y -= 6;
    page.drawRectangle({ x: L, y: y + 2, width: R - L, height: 0.5, color: GOLD });
    y -= 14;
  }

  // Totals.
  const subtotal = r.lines.reduce((n, l) => n + l.unitCents * l.quantity, 0);
  const rows: [string, string][] = [['Subtotal', usd(subtotal)]];
  if (r.discountCents > 0) rows.push(['Discount', usd(-r.discountCents)]);
  if (r.shippingCents > 0) rows.push(['Shipping', usd(r.shippingCents)]);
  else if (r.freeShipping) rows.push(['Shipping', 'Free']);
  rows.push(['Sales tax', usd(r.taxCents)]);
  for (const [label, value] of rows) {
    text(label, 320, y, 10);
    right(value, cols.amount, y, 10);
    y -= 15;
  }
  y -= 4;
  page.drawRectangle({ x: 310, y: y - 8, width: R - 310, height: 24, color: LINEN });
  text('Total paid', 320, y, 11, bold, FOREST);
  right(usd(r.totalCents), cols.amount, y, 12, bold, FOREST);
  y -= 24;
  text('Balance due', 320, y, 10);
  right('$0.00', cols.amount, y, 10, bold);
  y -= 34;

  // Statement lines.
  const statements = [
    `Paid in full. ${SELLER_LEGAL_NAME} received ${usd(r.totalCents)} on ${datePaid} by ${p.paidWith} for order ${r.orderNumber}. Nothing is owed on this order.`,
    'Printed from our order records at the request of the person who placed the order.',
  ];
  for (const s of statements) {
    for (const l of wrap(s, R - L, 9.5)) {
      text(l, L, y, 9.5, reg, INK);
      y -= 13;
    }
    y -= 4;
  }
  text(`Questions about this receipt: ${SELLER_CONTACT}`, L, y - 4, 9, reg, MUTED);

  const bytes = await doc.save({ useObjectStreams: true });
  return { bytes, text: drawn.join('\n') };
}
