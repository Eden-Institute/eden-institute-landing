// ESA invoice issuing: idempotency, the site-wide hourly cap, and the issue-or-void sequence used by
// the esa-invoice edge function. Added 2026-09-16 (founder decision 2026-09-15, "fix all five now").
//
// Network-free: every database, storage and email call is passed in (IssueDeps), so the sequence is
// unit-tested in esa-invoice-issue.test.ts with fakes.
//
// The sequence for one form fill:
//   1. each invoice number is issued together with its row (status 'pending') in ONE database call
//      (esa_insert_pending_invoice), so a number never exists without a row;
//   2. its PDF is drawn and stored, and pdf_path recorded;
//   3. once every row and PDF is in place, the batch becomes 'issued' (esa_finish_invoice_request);
//   4. only then does the caller send any email.
// If anything in 1-3 fails, the batch's pending rows become 'void' with the reason recorded (a
// recorded void number, not a silent gap), stored PDFs are removed best-effort, and the founder is
// alerted.

import type { EsaStateCode, InvoicePlan, Submission } from "./esa-invoice.ts";
import { esc } from "./html-escape.ts";

/** Site-wide cap on ACCEPTED invoice requests per clock hour, across every family and connection.
 *  The founder can change this number (decision 2026-09-15 chose 30). */
export const ESA_INVOICE_HOURLY_CAP = 30;

export const RATE_LIMITED_MESSAGE =
  "We are getting a lot of invoice requests right now. Please try again in a few minutes, or email hello@edeninstitute.health.";

/** Bucket key for the site-wide cap: one bucket per UTC clock hour. */
export function hourlyCapKey(now: Date = new Date()): string {
  return `esa_invoice_global:${now.toISOString().slice(0, 13)}`;
}

/** true only when the limiter answered and the count is past the cap. null (limiter down) fails open. */
export function overHourlyCap(count: number | null, cap = ESA_INVOICE_HOURLY_CAP): boolean {
  return typeof count === "number" && count > cap;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The client's idempotency key, lower-cased, or null when absent or malformed. */
export function parseIdempotencyKey(v: unknown): string | null {
  return typeof v === "string" && UUID.test(v.trim()) ? v.trim().toLowerCase() : null;
}

/** SHA-256 of the normalised submission, so one key can never stand for two different forms. */
export async function submissionHash(sub: Submission): Promise<string> {
  const canonical = JSON.stringify({
    state: sub.state,
    parentName: sub.parentName,
    email: sub.email,
    phone: sub.phone,
    address: sub.address ? [sub.address.line1, sub.address.line2, sub.address.city, sub.address.region, sub.address.zip] : null,
    students: sub.students.map((s) => [s.first, s.last, s.choice]),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type ClaimOutcome = "claimed" | "completed" | "processing" | "failed" | "mismatch";

export interface IssuedInvoice {
  id: string;
  number: string;
  plan: InvoicePlan;
  pdf: Uint8Array;
  pdfPath: string;
}

export interface IssueDeps {
  /** esa_insert_pending_invoice: issues the number (or takes the test number) and inserts the row. */
  insertPending(row: Record<string, unknown>, testNumber: string | null): Promise<{ id: string; invoice_number: string }>;
  render(plan: InvoicePlan, number: string, invoiceDate: string): Promise<Uint8Array>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  setPdfPath(id: string, path: string): Promise<void>;
  /** esa_finish_invoice_request. Returns the invoice numbers it changed. */
  finish(ok: boolean, error: string | null): Promise<string[]>;
  removeObjects(paths: string[]): Promise<void>;
  alertFounder(subject: string, lines: string[]): Promise<boolean>;
}

export interface IssueInput {
  submissionId: string;
  sub: Submission;
  plans: InvoicePlan[];
  isTest: boolean;
  invoiceDate: string;
  secondDate: (plan: InvoicePlan, invoiceDate: string) => string | null;
  /** Only for test invoices. */
  testNumber?: (plan: InvoicePlan, index: number) => string;
}

export const pdfPathFor = (state: EsaStateCode, number: string) => `${state}/${number}.pdf`;

export function pendingRow(input: IssueInput, plan: InvoicePlan): Record<string, unknown> {
  return {
    submission_id: input.submissionId,
    is_test: input.isTest,
    state: plan.state,
    invoice_date: input.invoiceDate,
    second_date: input.secondDate(plan, input.invoiceDate),
    parent_name: plan.parentName,
    student_name: plan.studentName,
    family_email: plan.email,
    ship_to: plan.shipTo,
    ship_address: plan.printed ? input.sub.address : null,
    phone: input.sub.phone || null,
    items: plan.items.map((i) => ({ sku: i.sku, qty: i.qty, unit_cents: i.unitCents, amount_cents: i.amountCents })),
    subtotal_cents: plan.subtotalCents,
    fee_cents: plan.feeCents,
    total_cents: plan.totalCents,
  };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Issues every invoice of one form fill, or voids the whole batch. Throws the original error after
 *  cleaning up, so the caller answers the family with its usual error. */
export async function issueInvoices(input: IssueInput, deps: IssueDeps): Promise<IssuedInvoice[]> {
  const issued: IssuedInvoice[] = [];
  const numbers: string[] = [];
  const uploaded: string[] = [];
  try {
    for (const [idx, plan] of input.plans.entries()) {
      const testNumber = input.isTest ? (input.testNumber ? input.testNumber(plan, idx) : null) : null;
      if (input.isTest && !testNumber) throw new Error("test invoice without a test number");
      const row = await deps.insertPending(pendingRow(input, plan), testNumber);
      numbers.push(row.invoice_number);
      const pdf = await deps.render(plan, row.invoice_number, input.invoiceDate);
      const path = pdfPathFor(plan.state, row.invoice_number);
      await deps.upload(path, pdf);
      uploaded.push(path);
      await deps.setPdfPath(row.id, path);
      issued.push({ id: row.id, number: row.invoice_number, plan, pdf, pdfPath: path });
    }
    await deps.finish(true, null);
    return issued;
  } catch (e) {
    const msg = errMsg(e);
    let voided: string[] = [];
    try {
      voided = await deps.finish(false, msg);
    } catch (fe) {
      console.error("esa-invoice: could not void the failed batch:", errMsg(fe));
    }
    if (uploaded.length) await deps.removeObjects(uploaded).catch((re) => console.error("esa-invoice: orphan PDF cleanup failed:", errMsg(re)));
    const p = input.plans[0];
    await deps
      .alertFounder(`${input.isTest ? "[TEST] " : ""}ESA invoice FAILED for ${p?.email ?? "a family"}`, [
        `The /esa invoice form failed part way through, so the family saw an error and no email was sent.`,
        `Error: ${esc(msg.slice(0, 400))}`,
        numbers.length
          ? `Invoice numbers issued and recorded as void: ${(voided.length ? voided : numbers).join(", ")}. They stay in esa_invoices with the reason, so they are not gaps.`
          : `No invoice number was issued.`,
        uploaded.length ? `Stored PDFs removed: ${uploaded.join(", ")}.` : `No PDF had been stored.`,
        `Family: ${esc(p?.parentName ?? "")} (${esc(p?.email ?? "")}), ${input.plans.length} invoice${input.plans.length === 1 ? "" : "s"}. They can press the button again, or email hello@.`,
      ])
      .catch((ae) => console.error("esa-invoice: founder alert failed:", errMsg(ae)));
    throw e;
  }
}

/** Storage path of a recorded invoice number: ET-AZ-2026-001 -> AZ/..., ET-TEST-AZ-... -> AZ/... */
export function pdfPathForNumber(number: string): string | null {
  const m = /^ET-(?:TEST-)?(AZ|AR|AL|NH)-/.exec(number);
  return m ? pdfPathFor(m[1] as EsaStateCode, number) : null;
}
