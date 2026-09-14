// Draws one ESA invoice (one student) as a single Letter page, following the layout of the
// founder-approved Word templates (ESA_Invoice_Templates_2026-09-13.docx): seller block top
// left, INVOICE + number + date top right, Bill to / Ship to, item table, total, delivery and
// state lines, thank-you line.
//
// Standard fonts only (Helvetica): the invoice is plain text, and embedding a TTF would add
// ~150 KB and memory per request for nothing. Standard fonts cannot encode every character,
// so every string is passed through `safe()` first (unencodable characters become "?" rather
// than crashing the request on a name like "Nguyễn").

import { PDFDocument, PDFFont, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=denonext";
import {
  deliveryLine,
  forbiddenOnInvoice,
  type InvoicePlan,
  money,
  secondDate,
  SELLER_LINES,
  STATE_RULES,
  THANK_YOU,
  usDate,
} from "./esa-invoice.ts";

const FOREST = rgb(0x2b / 255, 0x3a / 255, 0x1e / 255);
const GOLD = rgb(0xc5 / 255, 0xa4 / 255, 0x4e / 255);
const INK = rgb(0x1e / 255, 0x1e / 255, 0x14 / 255);
const MUTED = rgb(0x5c / 255, 0x4a / 255, 0x28 / 255);
const LINEN = rgb(0xf5 / 255, 0xed / 255, 0xd6 / 255);

export interface RenderedInvoice {
  bytes: Uint8Array;
  /** Every string drawn, joined, for the post-render checks and tests. */
  text: string;
}

export async function renderInvoicePdf(
  plan: InvoicePlan,
  invoiceNumber: string,
  invoiceDate: string,
): Promise<RenderedInvoice> {
  const rules = STATE_RULES[plan.state];
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${invoiceNumber}`);
  doc.setAuthor("Rooted in Faith Ventures LLC");
  doc.setCreator("Eden's Table");
  doc.setProducer("Eden's Table");
  const page = doc.addPage([612, 792]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const drawn: string[] = [];
  const staticText: string[] = [];

  const charsets = new Map<PDFFont, Set<number>>();
  const safe = (f: PDFFont, s: string) => {
    let cs = charsets.get(f);
    if (!cs) {
      cs = new Set(f.getCharacterSet());
      charsets.set(f, cs);
    }
    return Array.from(s.normalize("NFC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-"))
      .map((ch) => (cs!.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("");
  };
  const text = (s: string, x: number, y: number, size: number, f = reg, color = INK, isStatic = true) => {
    const t = safe(f, s);
    page.drawText(t, { x, y, size, font: f, color });
    drawn.push(t);
    if (isStatic) staticText.push(t);
  };
  const right = (s: string, xr: number, y: number, size: number, f = reg, color = INK, isStatic = true) => {
    const t = safe(f, s);
    text(t, xr - f.widthOfTextAtSize(t, size), y, size, f, color, isStatic);
  };
  const wrap = (s: string, width: number, size: number, f = reg): string[] => {
    const words = safe(f, s).split(" ");
    const lines: string[] = [];
    let cur = "";
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

  // Seller block + INVOICE header
  let y = 736;
  text(SELLER_LINES[0], L, y, 18, bold, FOREST);
  y -= 18;
  for (const line of SELLER_LINES.slice(1)) {
    text(line, L, y, 10, reg, MUTED);
    y -= 13;
  }
  right("INVOICE", R, 730, 26, bold, FOREST);
  right(`Invoice number: ${invoiceNumber}`, R, 706, 10.5, reg, INK, false);
  right(`Invoice date: ${usDate(invoiceDate)}`, R, 692, 10.5, reg, INK, false);

  page.drawRectangle({ x: L, y: 640, width: R - L, height: 1.5, color: GOLD });

  // Bill to / Ship to
  const colW = (R - L - 24) / 2;
  const boxTop = 626;
  const billLines: [string, boolean][] = [
    [`${rules.holderLabel}: ${plan.parentName}`, false],
    [`Student: ${plan.studentName}`, false],
  ];
  if (rules.programLine) billLines.push([rules.programLine, true]);
  const shipLines: [string, boolean][] = plan.shipTo.split("\n").map((l) => [l, false] as [string, boolean]);
  if (rules.paymentLine) shipLines.push([rules.paymentLine, true]);

  const wrapped = (rows: [string, boolean][]) => rows.flatMap(([s, st]) => wrap(s, colW - 16, 10).map((l) => [l, st] as [string, boolean]));
  const billW = wrapped(billLines);
  const shipW = wrapped(shipLines);
  const boxH = 30 + Math.max(billW.length, shipW.length) * 13;
  for (const [i, [label, rows]] of ([["BILL TO", billW], ["SHIP TO", shipW]] as [string, [string, boolean][]][]).entries()) {
    const x = L + i * (colW + 24);
    page.drawRectangle({ x, y: boxTop - boxH, width: colW, height: boxH, color: LINEN });
    text(label, x + 8, boxTop - 16, 8.5, bold, FOREST);
    let ly = boxTop - 30;
    for (const [l, st] of rows) {
      text(l, x + 8, ly, 10, reg, INK, st);
      ly -= 13;
    }
  }

  // Item table
  y = boxTop - boxH - 28;
  const cols = { item: L + 6, sku: 350, qty: 430, unit: 500, amount: R - 6 };
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 20, color: FOREST });
  const hdr = (s: string, x: number, alignRight = false) =>
    alignRight ? right(s, x, y, 9, bold, LINEN) : text(s, x, y, 9, bold, LINEN);
  hdr(rules.itemHeader, cols.item);
  hdr("SKU", cols.sku);
  hdr("Qty", cols.qty + 14, true);
  hdr("Unit price", cols.unit, true);
  hdr("Amount", cols.amount, true);
  y -= 26;

  const itemW = cols.sku - cols.item - 12;
  for (const it of plan.items) {
    const titleLines = wrap(it.title, itemW, 9.5, bold);
    const descLines = wrap(it.description, itemW, 8.5, reg);
    const rowTop = y;
    text(it.sku, cols.sku, rowTop, 9);
    right(String(it.qty), cols.qty + 14, rowTop, 9.5);
    right(money(it.unitCents), cols.unit, rowTop, 9.5);
    right(money(it.amountCents), cols.amount, rowTop, 9.5, bold);
    for (const l of titleLines) {
      text(l, cols.item, y, 9.5, bold);
      y -= 12;
    }
    for (const l of descLines) {
      text(l, cols.item, y, 8.5, reg, MUTED);
      y -= 11;
    }
    y -= 8;
    page.drawRectangle({ x: L, y: y + 2, width: R - L, height: 0.5, color: GOLD });
    y -= 12;
  }

  if (plan.feeCents) {
    const pct = `${(rules.feeRate * 100).toFixed(4)}%`;
    text(`Payment processing fee (${pct})`, cols.item, y, 9.5, bold);
    right(pct, cols.unit, y, 9.5);
    right(money(plan.feeCents), cols.amount, y, 9.5, bold);
    y -= 12;
    for (const l of wrap(`${pct} of the items above, to cover the 2% processing fee on this payment.`, itemW, 8.5)) {
      text(l, cols.item, y, 8.5, reg, MUTED);
      y -= 11;
    }
    y -= 8;
    page.drawRectangle({ x: L, y: y + 2, width: R - L, height: 0.5, color: GOLD });
    y -= 12;
  }

  // Total
  page.drawRectangle({ x: 300, y: y - 8, width: R - 300, height: 24, color: LINEN });
  text(rules.totalLabel, 308, y, 10.5, bold, FOREST);
  right(money(plan.totalCents), cols.amount, y, 12, bold, FOREST);
  y -= 40;

  // Delivery + state lines
  for (const l of wrap(deliveryLine(plan), R - L, 10)) {
    text(l, L, y, 10);
    y -= 14;
  }
  const second = secondDate(plan, invoiceDate);
  if (second && rules.secondDateLabel) {
    text(`${rules.secondDateLabel}: ${usDate(second)}`, L, y, 10, bold);
    y -= 14;
  }
  for (const line of rules.extraLines) {
    text(line, L, y, 10);
    y -= 14;
  }
  y -= 10;
  text(THANK_YOU, L, y, 10, reg, MUTED);

  const hits = forbiddenOnInvoice(plan.state, staticText.join(" "));
  if (hits.length) throw new Error(`invoice ${invoiceNumber} failed wording checks: ${hits.join("; ")}`);

  const bytes = await doc.save({ useObjectStreams: true });
  return { bytes, text: drawn.join("\n") };
}
