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
//   The intake itself lives in _shared/esa-intake.ts (moved 2026-11-13 so it can be tested). A notice
//   is finished once the founder is told about it; until then each run picks it up again (E1).
// POST { action: "mark_paid", invoice_number }
//   Manual override (founder asked Claude, or a paid invoice with no notice). Applies + fulfils.
// POST { action: "retry_fulfilment", invoice_number } (or invoice_id)
//   E2, 2026-11-13: re-runs fulfilment for a PAID invoice whose fulfilment failed or never started
//   ("retry ESA fulfilment for <invoice>" in the failure alerts). Reuses anything already created.
// POST { action: "daily" }
//   From the Vercel cron (api/cron/esa-daily.ts): the ONE family reminder at 14 days, and a founder
//   alert for any invoice still unpaid at 30 days.

import { isServiceRoleRequest } from "../_shared/require-service-role.ts";
import { money } from "../_shared/esa-invoice.ts";
import {
  applyPayment,
  emailFamilyReminder,
  emailFounderAlert,
  type EsaInvoiceRow,
  rest,
  retryFulfilment,
} from "../_shared/esa-fulfil.ts";
import { esc } from "../_shared/html-escape.ts";
import { intakeFailureRow, shouldAlertIntakeFailure } from "../_shared/esa-payment-intake.ts";
import { intake } from "../_shared/esa-intake.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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
      `A ClassWallet or Odyssey email reached payment intake, but processing it failed part-way, so it was not finished.`,
      `Error: ${esc(String(row.error))}`,
      `Subject: ${esc(String(row.subject ?? ""))}`,
      `Gmail message: ${esc(String(row.gmail_msg_id ?? "(none)"))}. Received: ${esc(String(row.received_at_raw ?? "(none)"))}.`,
      recorded ? `The raw notice is saved in esa_payment_intake_failures. The intake script sends it again on its next run (the 9 PM wrap), and intake picks up where it stopped.` : `The notice could NOT be saved to the database either. Ask Claude to look at it.`,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** E2: re-run fulfilment for a paid invoice whose fulfilment failed or never started. */
async function retryFulfil(b: Record<string, unknown>) {
  const number = String(b.invoice_number ?? "").trim();
  const id = String(b.invoice_id ?? "").trim();
  if (!number && !UUID.test(id)) return json(400, { error: "invoice_number or invoice_id required" });
  const rows = await rest<{ id: string; invoice_number: string }[]>(
    number ? `esa_invoices?invoice_number=eq.${encodeURIComponent(number)}&select=id,invoice_number` : `esa_invoices?id=eq.${id}&select=id,invoice_number`,
  );
  if (!rows.length) return json(404, { error: `no invoice ${number || id}` });
  const r = await retryFulfilment(rows[0].id);
  return json(200, { invoice_number: rows[0].invoice_number, changed: r.changed, status: r.invoice?.status, fulfilment: r.fulfilment, note: r.note });
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
          const r = await intake(b);
          return json(r.status, r.body);
        } catch (e) {
          console.error("esa-payment intake failed:", e instanceof Error ? e.message : String(e));
          const r = await recordIntakeFailure(b, e);
          return json(500, { error: e instanceof Error ? e.message : String(e), ...r });
        }
      case "mark_paid": return await markPaid(b);
      case "retry_fulfilment": return await retryFulfil(b);
      case "daily": return await daily();
      default: return json(400, { error: "action must be intake, mark_paid, retry_fulfilment or daily" });
    }
  } catch (e) {
    console.error("esa-payment failed:", e instanceof Error ? e.message : String(e));
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
