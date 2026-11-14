// ESA payment intake: POST {action: "intake"} on the esa-payment edge function. Moved here from
// esa-payment/index.ts on 2026-11-13 so it can be tested (that file starts a server on import).
// Lane 2 deep audit area 4, findings E1 and E11; founder go 2026-11-13 "Yes, build + ship".
//
// scripts/esa_payment_intake.py (the 9 PM wrap) posts EVERY ClassWallet / Odyssey payment notice of
// the last 14 days on every run and relies on this to skip the ones already handled. The notice is
// saved to esa_payments first (unique gmail_msg_id), then matched (_shared/esa-payment-match.ts)
// against open invoices:
//   matched and esa_auto_confirm_ready()  -> applied automatically, founder gets a note
//   matched (before 3 confirmations) or amount_only -> founder gets a one-tap Confirm link
//   ambiguous / amount_mismatch           -> founder gets a Confirm link per candidate invoice
//   unmatched                             -> founder alert, nothing applied
//
// E1: a notice is finished only once the founder has been told about it (founder_notified_at).
// Before 2026-11-13 any saved notice was answered "duplicate", so a failure after the save (the
// mark-paid call, a Confirm-link insert, the email) left it unapplied for good while the failure
// alert promised a retry. Now an unfinished notice is matched and acted on again by the next run,
// reusing any Confirm links it already made, and a notice that was applied automatically before the
// run stopped has its fulfilment started if it never began. The founder_notified_at stamp never
// throws: a failed stamp after a fully successful run used to raise a false "could not be
// processed, nothing was applied" alert.

import { matchPayment, noticeText, type OpenInvoice } from "./esa-payment-match.ts";
import { money } from "./esa-invoice.ts";
import {
  applyPayment,
  emailFounderAlert,
  emailFounderConfirm,
  type EsaInvoiceRow,
  getInvoice,
  rest,
  retryFulfilment,
  rpc,
} from "./esa-fulfil.ts";
import { esc } from "./html-escape.ts";
import { intakeResumeStep, normaliseReceivedAt } from "./esa-payment-intake.ts";

export interface IntakeResult {
  status: number;
  body: Record<string, unknown>;
}

interface PaymentRow {
  id: string;
  match_status: string;
  applied: boolean;
  founder_notified_at: string | null;
  invoice_id: string | null;
}

/** Stamp the notice as told to the founder. Never throws (see E1 above); a lost stamp only means the
 *  next run tells her again. */
async function markNotified(paymentId: string): Promise<void> {
  await rest(`esa_payments?id=eq.${paymentId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ founder_notified_at: new Date().toISOString() }),
  }).catch((e) => console.error(`esa intake: could not stamp founder_notified_at on ${paymentId}:`, e instanceof Error ? e.message : String(e)));
}

/** A Confirm link still open for this payment and invoice (from an earlier run that stopped), or a new one. */
async function confirmToken(paymentId: string, invoiceId: string): Promise<string> {
  const open = await rest<{ token: string }[]>(
    `esa_payment_confirmations?payment_id=eq.${paymentId}&invoice_id=eq.${invoiceId}&used_at=is.null` +
      `&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=token&order=created_at.asc&limit=1`,
  );
  if (open.length) return open[0].token;
  const [tok] = await rest<{ token: string }[]>("esa_payment_confirmations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ payment_id: paymentId, invoice_id: invoiceId }),
  });
  return tok.token;
}

/** Applied automatically on an earlier run that stopped before the founder was told. */
async function finishApplied(prior: PaymentRow): Promise<IntakeResult> {
  const inv = prior.invoice_id ? await getInvoice(prior.invoice_id) : null;
  // Not applied automatically (she pressed Confirm paid herself, or it was marked by hand): she
  // already knows, so only the stamp is missing.
  if (!inv || inv.paid_via !== "auto") {
    await markNotified(prior.id);
    return { status: 200, body: { duplicate: true, match_status: prior.match_status, applied: true } };
  }
  let fulfilment = inv.fulfilment_status;
  let note = "";
  let lines: string[];
  if (inv.status === "paid" && inv.fulfilment_status === "none") {
    // Marked paid, then the run stopped before fulfilment began: start it now.
    const r = await retryFulfilment(inv.id);
    fulfilment = r.fulfilment;
    note = r.note ?? "";
    lines = [
      `A ClassWallet payment matched invoice ${esc(inv.invoice_number)} (${esc(inv.student_name)}) and was applied automatically on an earlier run, but that run stopped before fulfilment started. It was started now.`,
      `Fulfilment: ${esc(fulfilment)}${note ? ` (${esc(note)})` : ""}.`,
    ];
  } else {
    lines = [
      `A ClassWallet payment matched invoice ${esc(inv.invoice_number)} (${esc(inv.student_name)}) and was applied automatically on an earlier run. This note did not go out then, so here it is (you may have had it already).`,
      `Fulfilment: ${esc(inv.fulfilment_status)}.`,
    ];
  }
  const sent = await emailFounderAlert(`ESA payment applied: ${inv.invoice_number} (${money(inv.total_cents)})`, lines);
  if (sent) await markNotified(prior.id);
  return { status: 200, body: { match_status: prior.match_status, applied: true, resumed: true, fulfilment } };
}

export async function intake(b: Record<string, unknown>): Promise<IntakeResult> {
  const msgId = String(b.gmail_msg_id ?? "").trim();
  if (!msgId) return { status: 400, body: { error: "gmail_msg_id required" } };
  const raw = String(b.body ?? "");
  const text = noticeText(raw);
  const subject = String(b.subject ?? "");

  const existing = await rest<PaymentRow[]>(
    `esa_payments?gmail_msg_id=eq.${encodeURIComponent(msgId)}&select=id,match_status,applied,founder_notified_at,invoice_id`,
  );
  const prior = existing[0] ?? null;
  const step = intakeResumeStep(prior);
  if (step === "done") return { status: 200, body: { duplicate: true, match_status: prior!.match_status, applied: prior!.applied } };
  if (step === "finish_applied") return await finishApplied(prior!);

  // "new" or "resume": match (again) against the invoices open right now.
  // include_test lets a founder test run a fake notice against TEST invoices end to end. Real notices
  // never see test invoices, and test invoices never create orders (esa-fulfil.ts).
  const testFilter = b.include_test === true ? "is_test=eq.true" : "is_test=eq.false";
  const open = await rest<OpenInvoice[]>(`esa_invoices?status=eq.issued&${testFilter}&select=id,invoice_number,student_name,parent_name,total_cents,state`);
  const m = matchPayment(raw, open);
  const matchFields = { amounts_cents: m.amountsCents, match_status: m.status, match_reason: m.reason, invoice_id: m.invoiceId };

  let paymentId: string;
  if (prior) {
    await rest(`esa_payments?id=eq.${prior.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(matchFields) });
    paymentId = prior.id;
  } else {
    const receivedAt = normaliseReceivedAt(b.received_at);
    const [payment] = await rest<{ id: string }[]>("esa_payments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        gmail_msg_id: msgId,
        received_at: receivedAt.iso,
        intake_note: receivedAt.note,
        from_addr: String(b.from ?? "").slice(0, 200),
        subject: subject.slice(0, 300),
        excerpt: text.slice(0, 2000),
        ...matchFields,
      }),
    });
    paymentId = payment.id;
  }
  const resumed = step === "resume" ? { resumed: true } : {};
  const notice = { subject, excerpt: text, status: m.status, reason: m.reason };

  if (m.status === "matched" && m.invoiceId && (await rpc<boolean>("esa_auto_confirm_ready", {}))) {
    const r = await applyPayment(m.invoiceId, "auto", paymentId);
    const inv = r.invoice;
    const label = `${inv?.invoice_number ?? m.invoiceId}${inv ? ` (${money(inv.total_cents)})` : ""}`;
    const sent = r.changed
      ? await emailFounderAlert(`ESA payment applied: ${label}`, [
        `A ClassWallet payment matched invoice ${esc(inv?.invoice_number ?? "")} (${esc(inv?.student_name ?? "")}) and was applied automatically.`,
        `Fulfilment: ${esc(r.fulfilment)}${r.note ? ` (${esc(r.note)})` : ""}.`,
      ])
      : await emailFounderAlert(`ESA payment NOT applied: ${label} was already ${inv?.status ?? "changed"}`, [
        `A ClassWallet payment matched invoice ${esc(inv?.invoice_number ?? "")} (${esc(inv?.student_name ?? "")}), but that invoice is already ${esc(inv?.status ?? "not open")}, so nothing new was applied.`,
        `If this looks like a second payment for the same invoice, check ClassWallet before doing anything.`,
      ]);
    if (sent) await markNotified(paymentId);
    return { status: 200, body: { match_status: m.status, applied: r.changed, fulfilment: r.fulfilment, ...resumed } };
  }

  if (m.candidateIds.length) {
    const candidates: { invoice: EsaInvoiceRow; token: string }[] = [];
    for (const id of m.candidateIds) {
      const inv = await getInvoice(id);
      if (!inv) continue;
      candidates.push({ invoice: inv, token: await confirmToken(paymentId, id) });
    }
    const sent = await emailFounderConfirm(notice, candidates);
    if (sent) await markNotified(paymentId);
    return { status: 200, body: { match_status: m.status, applied: false, awaiting_confirm: candidates.map((c) => c.invoice.invoice_number), ...resumed } };
  }

  const sent = await emailFounderAlert(`ESA payment notice did not match any invoice`, [
    `A ClassWallet or Odyssey email looked like a payment, but it does not match any open invoice (${esc(m.reason)}).`,
    `Subject: ${esc(subject)}`,
    `What it said: ${esc(text.slice(0, 700))}`,
    `If it is a real payment for an invoice made by hand, tell Claude which invoice it pays.`,
  ]);
  // Stamped, so the nightly re-send of this notice does not alert again (E1/E6); a failed alert is
  // left unstamped and goes out on the next run.
  if (sent) await markNotified(paymentId);
  return { status: 200, body: { match_status: m.status, applied: false, ...resumed } };
}
