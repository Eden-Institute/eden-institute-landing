// Matches a ClassWallet / Odyssey payment notice to exactly one issued ESA invoice.
// Pure (no network), unit-tested in esa-payment-match.test.ts.
//
// WHY IT IS CONSERVATIVE. As of 2026-09-14 no real ClassWallet payment email has ever arrived, so its
// subject and fields are unknown. The Alabama ESP guide (p.6) says the vendor payment report carries a
// transaction id, status, date, student and amount, but an email may carry less. So:
//   - "matched" needs the invoice TOTAL in the notice AND either the invoice NUMBER or the STUDENT'S
//     full name. Only "matched" can ever be applied automatically, and only after the founder has
//     confirmed 3 matched payments by hand (esa_auto_confirm_ready()).
//   - "amount_only" (one issued invoice has that total, but nothing names it) always waits for a tap.
//   - "ambiguous", "amount_mismatch" and "unmatched" alert the founder and change nothing.

export type MatchStatus = "matched" | "amount_only" | "ambiguous" | "amount_mismatch" | "unmatched";

export interface OpenInvoice {
  id: string;
  invoice_number: string;
  student_name: string;
  parent_name: string;
  total_cents: number;
  state: string;
}

export interface MatchResult {
  status: MatchStatus;
  /** The invoice to apply (matched / amount_only), else null. */
  invoiceId: string | null;
  /** Invoices worth showing the founder with a confirm link (ambiguous, amount_only, mismatch). */
  candidateIds: string[];
  amountsCents: number[];
  reason: string;
}

/** Strip HTML, decode the few entities that matter, collapse whitespace. */
export function noticeText(raw: string): string {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;|&dollar;/gi, "$")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every dollar amount written with cents ("$266.33", "$ 1,261.00", "USD 40.81"). */
export function amountsIn(text: string): number[] {
  const out = new Set<number>();
  const re = /(?:\$|USD)\s?((?:\d{1,3}(?:,\d{3})+)|\d+)\.(\d{2})\b/gi;
  for (const m of text.matchAll(re)) out.add(Number(m[1].replace(/,/g, "")) * 100 + Number(m[2]));
  return [...out];
}

const norm = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** True when the student's first AND last name both appear as whole words (any order, e.g. "Doe, Sam"). */
export function namesStudent(text: string, studentName: string): boolean {
  const hay = ` ${norm(text)} `;
  const parts = norm(studentName).split(" ").filter((p) => p.length > 1);
  if (parts.length < 2) return false;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return hay.includes(` ${first} `) && hay.includes(` ${last} `);
}

export function matchPayment(rawNotice: string, open: OpenInvoice[]): MatchResult {
  const text = noticeText(rawNotice);
  const amounts = amountsIn(text);
  const upper = text.toUpperCase();

  const byNumber = open.filter((i) => upper.includes(i.invoice_number.toUpperCase()));
  const named = open.filter((i) => namesStudent(text, i.student_name));
  const withAmount = open.filter((i) => amounts.includes(i.total_cents));

  // 1. Invoice number + total: the strongest possible signal.
  const numberAndAmount = byNumber.filter((i) => amounts.includes(i.total_cents));
  if (numberAndAmount.length === 1) {
    return { status: "matched", invoiceId: numberAndAmount[0].id, candidateIds: [numberAndAmount[0].id], amountsCents: amounts, reason: "invoice number and total both in the notice" };
  }
  // 2. Student name + total.
  const nameAndAmount = named.filter((i) => amounts.includes(i.total_cents));
  if (nameAndAmount.length === 1) {
    return { status: "matched", invoiceId: nameAndAmount[0].id, candidateIds: [nameAndAmount[0].id], amountsCents: amounts, reason: "student name and total both in the notice" };
  }
  if (nameAndAmount.length > 1 || numberAndAmount.length > 1) {
    const ids = [...new Set([...nameAndAmount, ...numberAndAmount].map((i) => i.id))];
    return { status: "ambiguous", invoiceId: null, candidateIds: ids, amountsCents: amounts, reason: "more than one open invoice has this student and total" };
  }
  // 3. Named (by number or student) but no amount on the notice equals its total.
  const namedAny = [...new Set([...byNumber, ...named].map((i) => i.id))];
  if (namedAny.length > 0 && amounts.length > 0) {
    return { status: "amount_mismatch", invoiceId: null, candidateIds: namedAny, amountsCents: amounts, reason: "the notice names an open invoice but the amount does not equal its total" };
  }
  // 4. Only the total lines up.
  if (withAmount.length === 1) {
    return { status: "amount_only", invoiceId: withAmount[0].id, candidateIds: [withAmount[0].id], amountsCents: amounts, reason: "one open invoice has this total, but the notice does not name the student or invoice" };
  }
  if (withAmount.length > 1) {
    return { status: "ambiguous", invoiceId: null, candidateIds: withAmount.map((i) => i.id), amountsCents: amounts, reason: "several open invoices have this total and nothing names one" };
  }
  if (namedAny.length > 0) {
    return { status: "amount_mismatch", invoiceId: null, candidateIds: namedAny, amountsCents: amounts, reason: "the notice names an open invoice but carries no readable amount" };
  }
  return { status: "unmatched", invoiceId: null, candidateIds: [], amountsCents: amounts, reason: amounts.length ? "no open invoice has this total or name" : "no amount or name found in the notice" };
}
