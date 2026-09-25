// supabase/functions/_shared/book-shop.ts
//
// The Back to Eden book shop (founder request 2026-09-25). Six products on
// /back-to-eden: three printed titles and the same three as PDFs.
//
//   PRINTED  bte_paperback_print, bte_study_journal_print, bte_study_guide_print
//            Sold on the existing Lulu print rail as band 'bte' (lulu-config.ts).
//            Their price, shipping tier and lookup key live in the products table.
//   DIGITAL  bte_paperback_digital, bte_study_journal_digital, bte_study_guide_digital
//            Defined HERE. Checkout charges the Stripe Price carrying the SKU as its
//            lookup key; stripe-webhook records the order, writes a book_downloads
//            row with a token and emails the link; book-download turns the token
//            into a short-lived signed URL.
//
// Prices are the founder's (2026-09-25) and the Stripe Prices are hers, created in
// the Dashboard with these lookup keys. `retailCents` here is only the amount the
// E2E test twin charges on its test key; real buyers pay the Stripe Price.
//
// ONE SWITCH: BOOK_SHOP_LIVE=true opens both the printed and the digital checkout
// for these six. Until then only an admin or E2E request can start a checkout.
//
// Voice rule: no em dashes in anything a buyer reads.

import { escapeHtml } from './html-escape.ts';
import { emailWrapperTransactional } from './nurture-email-templates.ts';
import { Receipt, renderReceiptHtml } from './receipt.ts';

export const BOOK_BUCKET = 'book-files';
export const BOOK_PAGE = 'https://edeninstitute.health/back-to-eden';
export const BOOK_THANK_YOU = `${BOOK_PAGE}/thank-you`;
export const BOOK_DOWNLOAD_PAGE = `${BOOK_PAGE}/download`;
const RETURNS_URL = 'https://edeninstitute.health/returns';

export type BookDigitalSku = 'bte_paperback_digital' | 'bte_study_journal_digital' | 'bte_study_guide_digital';

export interface BookDigital {
  sku: BookDigitalSku;
  /** Stripe Price lookup key. Equal to the SKU on purpose. */
  lookupKey: string;
  /** What the buyer reads on the page, the email and the receipt. */
  title: string;
  /** Object path in BOOK_BUCKET. */
  path: string;
  /** Name the browser saves the file under. */
  filename: string;
  pages: number;
  /** Test-twin amount only (see header). */
  retailCents: number;
}

export const BOOK_DIGITAL: Record<BookDigitalSku, BookDigital> = {
  bte_paperback_digital: {
    sku: 'bte_paperback_digital',
    lookupKey: 'bte_paperback_digital',
    title: 'Back to Eden, Digital Edition (PDF)',
    path: 'digital/back-to-eden.pdf',
    filename: 'Back to Eden - Camila Johnson.pdf',
    pages: 186,
    retailCents: 1499,
  },
  bte_study_journal_digital: {
    sku: 'bte_study_journal_digital',
    lookupKey: 'bte_study_journal_digital',
    title: 'Back to Eden, Study & Journal Edition, Digital (PDF)',
    path: 'digital/back-to-eden-study-journal-edition.pdf',
    filename: 'Back to Eden Study and Journal Edition - Camila Johnson.pdf',
    pages: 386,
    retailCents: 2900,
  },
  bte_study_guide_digital: {
    sku: 'bte_study_guide_digital',
    lookupKey: 'bte_study_guide_digital',
    title: 'Back to Eden, Study Guide, Digital (PDF)',
    path: 'digital/back-to-eden-study-guide.pdf',
    filename: 'Back to Eden Study Guide - Camila Johnson.pdf',
    pages: 266,
    retailCents: 1900,
  },
};

export function bookDigitalBySku(sku: unknown): BookDigital | null {
  return typeof sku === 'string' && Object.prototype.hasOwnProperty.call(BOOK_DIGITAL, sku)
    ? BOOK_DIGITAL[sku as BookDigitalSku]
    : null;
}

/** The founder's go-live switch for all six Back to Eden products. */
export function bookShopLive(): boolean {
  return Deno.env.get('BOOK_SHOP_LIVE') === 'true';
}

/** 64 hex characters from the platform CSPRNG: the emailed download credential. */
export function newDownloadToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isDownloadToken(t: unknown): t is string {
  return typeof t === 'string' && /^[0-9a-f]{64}$/.test(t);
}

// ── Delivery email ───────────────────────────────────────────────────────────

const BRAND = { forest: '#2C3E2D', text: '#3D3832' };
function p(text: string, extra = ''): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}
function heading(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;color:${BRAND.forest};margin:0 0 16px 0;font-weight:bold;">${text}</h2>`;
}
function button(label: string, href: string): string {
  // Outlined, like every other Eden email button (see starter-email.ts for why).
  return `<p style="margin:8px 0 20px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;border:2px solid ${BRAND.forest};color:${BRAND.forest};font-family:Georgia,serif;font-size:16px;font-weight:bold;padding:12px 28px;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}
function small(text: string): string {
  return p(`<span style="font-size:14px;color:#5A6B5F;">${text}</span>`);
}

export interface BookDeliveryModel {
  firstName: string | null;
  email: string;
  book: BookDigital;
  downloadToken: string;
  receipt?: Receipt | null;
}

export function bookDownloadUrl(token: string): string {
  return `${BOOK_DOWNLOAD_PAGE}?t=${encodeURIComponent(token)}`;
}

export function renderBookDeliveryEmail(m: BookDeliveryModel): { subject: string; html: string; text: string } {
  const url = bookDownloadUrl(m.downloadToken);
  const hi = m.firstName ? `Hi ${escapeHtml(m.firstName)},` : 'Hi there,';
  const isStudy = m.book.sku !== 'bte_paperback_digital';
  const body =
    p(hi) +
    p(`Thank you so much for buying <em>Back to Eden</em>. Your ${escapeHtml(m.book.title)} is ready.`) +
    heading('Your download') +
    button('Download your book', url) +
    small(`Save this email. The link keeps working, so you can download your book again any time, on any device.`) +
    small(`<strong>If the file opens as a blank white screen</strong>, nothing is wrong with it. Some email apps open links in a small built in browser that cannot show a PDF. Press and hold the button, choose Open in Safari or Open in Chrome, and it will open properly. Opening this email on a computer works too.`) +
    (isStudy
      ? p(`It prints on regular letter paper, so you can print a chapter at a time and write right on the pages.`)
      : '') +
    (m.receipt ? heading('Your receipt') + renderReceiptHtml(m.receipt) : '') +
    small(`This book is for you and your household. Because it is a digital download, it is not refundable once it has been downloaded. Our full policy is <a href="${RETURNS_URL}" style="color:${BRAND.forest};">here</a>.`) +
    p(`Grace and health,`, 'margin-top:24px;') +
    p(`<strong>Camila</strong><br><span style="font-size:14px;">The Eden Institute</span>`);

  const text = [
    m.firstName ? `Hi ${m.firstName},` : 'Hi there,',
    '',
    `Thank you so much for buying Back to Eden. Your ${m.book.title} is ready.`,
    '',
    `Download your book: ${url}`,
    '',
    'Save this email. The link keeps working, so you can download your book again any time, on any device.',
    '',
    'If the file opens as a blank white screen, nothing is wrong with it. Some email apps open links in a small built in browser that cannot show a PDF. Press and hold the link, choose Open in Safari or Open in Chrome, and it will open properly.',
    '',
    `This book is for you and your household. Because it is a digital download, it is not refundable once it has been downloaded. Full policy: ${RETURNS_URL}`,
    '',
    'Grace and health,',
    'Camila',
    'The Eden Institute',
  ].join('\n');

  return { subject: 'Your copy of Back to Eden is ready', html: emailWrapperTransactional(body, 'order'), text };
}

const FROM = 'Camila at The Eden Institute <hello@edeninstitute.health>';
const REPLY_TO = 'hello@edeninstitute.health';

/** Send the delivery email through Resend. Throws on failure so the caller can record and retry. */
export async function sendBookDeliveryEmail(m: BookDeliveryModel): Promise<string | null> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY is not set; cannot email a book download link');
  const { subject, html, text } = renderBookDeliveryEmail(m);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [m.email], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text().catch(() => '')}`);
  const out = await res.json().catch(() => ({})) as { id?: string };
  return out.id ?? null;
}
