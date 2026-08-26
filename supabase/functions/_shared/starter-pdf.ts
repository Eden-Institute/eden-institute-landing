// supabase/functions/_shared/starter-pdf.ts
//
// Per-buyer footer stamping for the Starter Unit PDFs.
//
// FOUNDER DECISION 2026-08-26. Camila asked whether the licence line could live
// in the email instead of the PDF, which would leave the files untouched. It can,
// but it collapses a second requirement: the buyer's name and email in the footer
// is the sharing deterrent, and that is impossible without writing to the file.
// She chose the one-line footer, so this module exists and does exactly one
// thing: add a single line at the foot of every page. Nothing else on any page
// moves.
//
// WHY THIS IS NOT DONE IN THE WEBHOOK. The two masters total about 20MB. Parsing,
// stamping and re-serialising them takes long enough that doing it inline would
// risk the Stripe webhook timing out, and a timed-out webhook is retried, which
// means re-doing work that already half-happened. So the webhook records the sale
// and queues; starter-fulfill does this.
//
// WHY THE FOOTER IS DRAWN, NOT COMPOSITED. pdf-lib's drawText on the existing
// page keeps every original content stream intact. The alternative (rebuilding
// pages) would re-encode the artwork, and these files are print-derived assets
// where re-encoding is exactly what nobody wants.

import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1?target=denonext';

/** Eden bark, matching the curriculum's own body text colour. */
const FOOTER_COLOR = rgb(0.11, 0.23, 0.18);
const FOOTER_SIZE = 6.5;
/** Distance from the trimmed page edge. Inside the safe margin on every page size. */
const FOOTER_MARGIN = 14;

export interface StampOptions {
  purchaserName: string | null;
  email: string;
  licenseLine: string;
}

export interface StampResult {
  bytes: Uint8Array;
  pagesStamped: number;
}

/**
 * Build the footer text.
 *
 * Name is optional because Stripe Checkout does not guarantee one: card billing
 * name is usually present but can be absent, and an empty "Licensed to  ." reads
 * like a bug. When there is no name the email carries the identification on its
 * own, which is the part that actually matters for deterrence.
 */
export function footerText(opts: StampOptions): string {
  const who = opts.purchaserName?.trim()
    ? `${opts.purchaserName.trim()} (${opts.email})`
    : opts.email;
  return `Licensed to ${who}. ${opts.licenseLine}`;
}

/**
 * Stamp one line at the foot of every page.
 *
 * Returns the new bytes; the input is never mutated and the master in storage is
 * never written back to.
 *
 * Overlong footers are truncated rather than allowed to run off the page or wrap
 * into the artwork: a very long name plus a long email can exceed a narrow page
 * width, and silently overflowing would print buyer PII across a lesson.
 */
export async function stampFooter(
  masterBytes: Uint8Array,
  opts: StampOptions,
): Promise<StampResult> {
  const doc = await PDFDocument.load(masterBytes, {
    // These are trusted, print-derived files, and skipping the integrity pass is
    // what makes a 12MB parse tolerable inside an edge function.
    updateMetadata: false,
  });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const raw = footerText(opts);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width } = page.getSize();
    const maxWidth = width - FOOTER_MARGIN * 2;

    let text = raw;
    let textWidth = font.widthOfTextAtSize(text, FOOTER_SIZE);
    if (textWidth > maxWidth) {
      // Trim from the licence tail, never from the identifying half.
      while (text.length > 12 && textWidth > maxWidth) {
        text = text.slice(0, -2);
        textWidth = font.widthOfTextAtSize(text + '...', FOOTER_SIZE);
      }
      text += '...';
      textWidth = font.widthOfTextAtSize(text, FOOTER_SIZE);
    }

    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: FOOTER_MARGIN,
      size: FOOTER_SIZE,
      font,
      color: FOOTER_COLOR,
      opacity: 0.75,
    });
  }

  // useObjectStreams keeps the output close to the input size. Without it pdf-lib
  // expands the xref table and a 12.7MB file comes back noticeably larger, which
  // matters when two of them ride the same Resend request budget.
  const bytes = await doc.save({ useObjectStreams: true });
  return { bytes, pagesStamped: pages.length };
}
