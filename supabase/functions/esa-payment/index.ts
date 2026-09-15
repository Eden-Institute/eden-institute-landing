// esa-payment: the server side of the ESA payment automation (parts 2 and 4). Added 2026-09-15.
// Service role ONLY (verify_jwt = true in config.toml, plus isServiceRoleRequest).
//
// POST { action: "intake", gmail_msg_id, from, subject, received_at, body }
//   From scripts/esa_payment_intake.py (reads Gmail on the founder's PC). Records the notice once
//   (unique gmail_msg_id), matches it (_shared/esa-payment-match.ts) against open invoices, then:
//     matched and esa_auto_confirm_ready()  -> applied automatically, founder gets an FYI
//     matched (before 3 confirmations) or amount_only -> founder gets a one-tap Confirm link
//     ambiguous / amount_mismatch           -> founder gets a Confirm link per candidate invoice
//     unmatched                             -> founder alert, nothing applied
// POST { action: "mark_paid", invoice_number }
//   Manual override (founder asked Claude, or a paid invoice with no notice). Applies + fulfils.
// POST { action: "daily" }
//   From the Vercel cron (api/cron/esa-daily.ts): the ONE family reminder at 14 days, and a founder
//   alert for any invoice still unpaid at 30 days.

import { isServiceRoleRequest } from "../_shared/require-service-role.ts";
import { matchPayment, noticeText, type OpenInvoice } from "../_shared/esa-payment-match.ts";
import { money } from "../_shared/esa-invoice.ts";
import {
  applyPayment,
  emailFamilyReminder,
  emailFounderAlert,
  emailFounderConfirm,
  type EsaInvoiceRow,
  getInvoice,
  rest,
  rpc,
} from "../_shared/esa-fulfil.ts";
import { esc } from "../_shared/html-escape.ts";
import { intakeFailureRow, normaliseReceivedAt, shouldAlertIntakeFailure } from "../_shared/esa-payment-intake.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function intake(b: Record<string, unknown>) {
  const msgId = String(b.gmail_msg_id ?? "").trim();
  if (!msgId) return json(400, { error: "gmail_msg_id required" });
  const raw = String(b.body ?? "");
  const text = noticeText(raw);

  const existing = await rest<{ id: string; match_status: string; applied: boolean }[]>(`esa_payments?gmail_msg_id=eq.${encodeURIComponent(msgId)}&select=id,match_status,applied`);
  if (existing.length) return json(200, { duplicate: true, match_status: existing[0].match_status, applied: existing[0].applied });

  // include_test lets a founder test run a fake notice against TEST invoices end to end. Real notices
  // never see test invoices, and test invoices never create orders (esa-fulfil.ts).
  const testFilter = b.include_test === true ? "is_test=eq.true" : "is_test=eq.false";
  const open = await rest<OpenInvoice[]>(`esa_invoices?status=eq.issued&${testFilter}&select=id,invoice_number,student_name,parent_name,total_cents,state`);
  const m = matchPayment(raw, open);

  const receivedAt = normaliseReceivedAt(b.received_at);
  const [payment] = await rest<{ id: string }[]>("esa_payments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      gmail_msg_id: msgId,
      received_at: receivedAt.iso,
      intake_note: receivedAt.note,
      from_addr: String(b.from ?? "").slice(0, 200),
      subject: String(b.subject ?? "").slice(0, 300),
      excerpt: text.slice(0, 2000),
      amounts_cents: m.amountsCents,
      match_status: m.status,
      match_reason: m.reason,
      invoice_id: m.invoiceId,
    }),
  });
  const notice = { subject: String(b.subject ?? ""), excerpt: text, status: m.status, reason: m.reason };

  if (m.status === "matched" && m.invoiceId && (await rpc<boolean>("esa_auto_confirm_ready", {}))) {
    const r = await applyPayment(m.invoiceId, "auto", payment.id);
    const inv = r.invoice;
    await emailFounderAlert(`ESA payment applied: ${inv?.invoice_number ?? m.invoiceId}${inv ? ` (${money(inv.total_cents)})` : ""}`, [
      `A ClassWallet payment matched invoice ${esc(inv?.invoice_number ?? "")} (${esc(inv?.student_name ?? "")}) and was applied automatically.`,
      `Fulfilment: ${esc(r.fulfilment)}${r.note ? ` (${esc(r.note)})` : ""}.`,
    ]);
    await rest(`esa_payments?id=eq.${payment.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ founder_notified_at: new Date().toISOString() }) });
    return json(200, { match_status: m.status, applied: r.changed, fulfilment: r.fulfilment });
  }

  if (m.candidateIds.length) {
    const candidates: { invoice: EsaInvoiceRow; token: string }[] = [];
    for (const id of m.candidateIds) {
      const inv = await getInvoice(id);
      if (!inv) continue;
      const [tok] = await rest<{ token: string }[]>("esa_payment_confirmations", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ payment_id: payment.id, invoice_id: id }),
      });
      candidates.push({ invoice: inv, token: tok.token });
    }
    const sent = await emailFounderConfirm(notice, candidates);
    if (sent) await rest(`esa_payments?id=eq.${payment.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ founder_notified_at: new Date().toISOString() }) });
    return json(200, { match_status: m.status, applied: false, awaiting_confirm: candidates.map((c) => c.invoice.invoice_number) });
  }

  await emailFounderAlert(`ESA payment notice did not match any invoice`, [
    `A ClassWallet or Odyssey email looked like a payment, but it does not match any open invoice (${esc(m.reason)}).`,
    `Subject: ${esc(String(b.subject ?? ""))}`,
    `What it said: ${esc(text.slice(0, 700))}`,
    `If it is a real payment for an invoice made by hand, tell Claude which invoice it pays.`,
  ]);
  return json(200, { match_status: m.status, applied: false });
}

/** Any error inside intake: keep the raw notice and tell the founder (once per message per day, since
 *  the intake script re-sends a failed notice on every run). Never throws. */
async function recordIntakeFailure(b: Record<string, unknown>, e: unknown): Promise<{ recorded: boolean; alerted: boolean }> {
  const row = intakeFailureRow(b, e);
  let earlier: number | null = null;
  let recorded = false;
  let alerted = false;
  try {
    if (row.gmail_msg_id) {
      const since = new Date(Date.now() - 86400000).toISOString();
      const prior = await rest<{ id: string }[]>(
        `esa_payment_intake_failures?gmail_msg_id=eq.${encodeURIComponent(String(row.gmail_msg_id))}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      );
      earlier = prior.length;
    }
  } catch (le) {
    console.error("esa-payment: could not read earlier intake failures:", le instanceof Error ? le.message : String(le));
  }
  let failureId: string | null = null;
  try {
    const [saved] = await rest<{ id: string }[]>("esa_payment_intake_failures", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    failureId = saved?.id ?? null;
    recorded = true;
  } catch (re) {
    console.error("esa-payment: could not record the intake failure:", re instanceof Error ? re.message : String(re));
  }
  if (shouldAlertIntakeFailure(earlier)) {
    alerted = await emailFounderAlert("ESA payment notice could not be processed", [
      `A ClassWallet or Odyssey email reached payment intake, but processing it failed, so nothing was matched or applied.`,
      `Error: ${esc(String(row.error))}`,
      `Subject: ${esc(String(row.subject ?? ""))}`,
      `Gmail message: ${esc(String(row.gmail_msg_id ?? "(none)"))}. Received: ${esc(String(row.received_at_raw ?? "(none)"))}.`,
      recorded ? `The raw notice is saved in esa_payment_intake_failures. The intake script will try it again on its next run.` : `The notice could NOT be saved to the database either. Ask Claude to look at it.`,
    ]).catch(() => false);
    if (alerted && failureId) {
      await rest(`esa_payment_intake_failures?id=eq.${failureId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ founder_alerted_at: new Date().toISOString() }) }).catch(() => null);
    }
  }
  return { recorded, alerted };
}

async function markPaid(b: Record<string, unknown>) {
  const number = String(b.invoice_number ?? "").trim();
  const rows = await rest<{ id: string }[]>(`esa_invoices?invoice_number=eq.${encodeURIComponent(number)}&select=id`);
  if (!rows.length) return json(404, { error: `no invoice ${number}` });
  const r = await applyPayment(rows[0].id, "manual", null);
  return json(200, { invoice_number: number, changed: r.changed, status: r.invoice?.status, fulfilment: r.fulfilment, note: r.note });
}

async function daily() {
  const now = Date.now();
  const day = 86400000;
  const open = await rest<EsaInvoiceRow[]>("esa_invoices?status=eq.issued&select=*&order=created_at.asc");
  let reminded = 0;
  const stale: EsaInvoiceRow[] = [];
  for (const inv of open) {
    const age = now - Date.parse(inv.created_at);
    if (age >= 14 * day && !inv.reminder_sent_at && !inv.is_test) {
      if (await emailFamilyReminder(inv)) {
        await rest(`esa_invoices?id=eq.${inv.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }) });
        reminded++;
      }
    }
    if (age >= 30 * day && !inv.founder_alerted_at && !inv.is_test) stale.push(inv);
  }
  if (stale.length) {
    const sent = await emailFounderAlert(`${stale.length} ESA invoice${stale.length > 1 ? "s" : ""} unpaid after 30 days`, [
      `These invoices were issued more than 30 days ago and no payment has been recorded. Each family already got one reminder at 14 days. Nothing else is sent automatically.`,
      ...stale.map((i) => `${esc(i.invoice_number)}: ${esc(i.parent_name)} for ${esc(i.student_name)}, ${money(i.total_cents)}, ${esc(i.family_email)}`),
      `If one was paid and the notice was missed, tell Claude "mark ESA invoice <number> paid".`,
    ]);
    if (sent) {
      for (const i of stale) {
        await rest(`esa_invoices?id=eq.${i.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ founder_alerted_at: new Date().toISOString() }) });
      }
    }
  }
  return json(200, { open: open.length, reminded, founder_alerted: stale.length });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!isServiceRoleRequest(req)) return json(401, { error: "Unauthorized" });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (b.action) {
      case "intake":
        try {
          return await intake(b);
        } catch (e) {
          console.error("esa-payment intake failed:", e instanceof Error ? e.message : String(e));
          const r = await recordIntakeFailure(b, e);
          return json(500, { error: e instanceof Error ? e.message : String(e), ...r });
        }
      case "mark_paid": return await markPaid(b);
      case "daily": return await daily();
      default: return json(400, { error: "action must be intake, mark_paid or daily" });
    }
  } catch (e) {
    console.error("esa-payment failed:", e instanceof Error ? e.message : String(e));
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
