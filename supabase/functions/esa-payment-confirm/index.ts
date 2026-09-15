// esa-payment-confirm: the founder's one-tap "Confirm paid" page. Added 2026-09-15.
//
// verify_jwt = false (config.toml): it is opened from an email link. The credential is the single-use
// random token in esa_payment_confirmations (60-day expiry). The link (GET) only SHOWS the invoice and
// a button; marking paid needs the POST from that button, so an email security scanner that pre-fetches
// links can never mark an invoice paid.
//
// Once 3 payments the matcher called "matched" are confirmed here, esa-payment applies matched
// payments on its own (esa_auto_confirm_ready()).

import { money, STATE_RULES } from "../_shared/esa-invoice.ts";
import { confirmWithToken, emailFounderAlert, getInvoice, rest } from "../_shared/esa-fulfil.ts";
import { esc } from "../_shared/html-escape.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title></head>
<body style="margin:0;background:#FAF6EE;font-family:Georgia,serif;color:#1E1E14">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #E8D5A3;padding:28px 30px;line-height:1.6">
<p style="font-size:20px;font-weight:bold;color:#2B3A1E;margin:0 0 14px">Eden's Table · ESA payment</p>${body}</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" },
  });
}

interface TokenRow {
  token: string;
  invoice_id: string;
  payment_id: string | null;
  expires_at: string;
  used_at: string | null;
}

async function loadToken(t: string): Promise<TokenRow | null> {
  if (!UUID.test(t)) return null;
  const rows = await rest<TokenRow[]>(`esa_payment_confirmations?token=eq.${t}&select=*`);
  return rows[0] ?? null;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let t = url.searchParams.get("t") ?? "";
    if (req.method === "POST") {
      const form = await req.formData().catch(() => null);
      t = String(form?.get("t") ?? t);
    } else if (req.method !== "GET") {
      return page("Not allowed", "<p>Not allowed.</p>", 405);
    }
    const tok = await loadToken(t);
    if (!tok) return page("Link not valid", "<p>This confirmation link is not valid. Ask Claude to look up the payment.</p>", 404);
    const inv = await getInvoice(tok.invoice_id);
    if (!inv) return page("Invoice missing", "<p>The invoice for this link no longer exists.</p>", 404);

    const summary = `<p><b>${esc(inv.invoice_number)}</b> · ${esc(STATE_RULES[inv.state].name)}${inv.is_test ? " · <b>TEST</b>" : ""}<br>
Student: ${esc(inv.student_name)}<br>Parent: ${esc(inv.parent_name)} (${esc(inv.family_email)})<br>
Items: ${esc(inv.items.map((i) => `${i.sku} x${i.qty}`).join(", "))}<br>Total: <b>${money(inv.total_cents)}</b></p>`;

    if (inv.status !== "issued") {
      return page("Already done", `${summary}<p>This invoice is already <b>${esc(inv.status)}</b> (fulfilment: ${esc(inv.fulfilment_status)}). Nothing more to do.</p>`);
    }
    if (tok.used_at) return page("Link used", `${summary}<p>This link was already used.</p>`);
    if (Date.parse(tok.expires_at) < Date.now()) return page("Link expired", `${summary}<p>This link expired. Ask Claude to mark the invoice paid if the money arrived.</p>`, 410);

    if (req.method === "GET") {
      let noticeLine = "";
      if (tok.payment_id) {
        const p = await rest<{ subject: string; excerpt: string; match_reason: string }[]>(`esa_payments?id=eq.${tok.payment_id}&select=subject,excerpt,match_reason`);
        if (p[0]) noticeLine = `<p style="font-size:14px;color:#5C4A28">Why this invoice: ${esc(p[0].match_reason ?? "")}<br>Notice: ${esc((p[0].subject ?? "").slice(0, 160))}<br>${esc((p[0].excerpt ?? "").slice(0, 500))}</p>`;
      }
      const action = inv.items.some((i) => i.sku === "ET-SPR-K2-003") ? "the Starter Unit files are emailed to the family" : "the order is sent to Lulu to print (Lulu waits 48 hours before printing)";
      return page("Confirm payment", `${summary}${noticeLine}
<p>Press the button only if this payment really arrived for this invoice. Then ${action}, automatically.</p>
<form method="POST"><input type="hidden" name="t" value="${esc(tok.token)}">
<button type="submit" style="background:#2B3A1E;color:#F5EDD6;border:0;font:bold 16px Georgia,serif;padding:12px 26px;cursor:pointer">Confirm paid</button></form>`);
    }

    // POST: esa_confirm_payment_token marks the invoice paid and uses the token in ONE transaction
    // (row lock, so a double-click applies once). If it errors, neither happened and this link still
    // works. Fulfilment runs only after it succeeded.
    const c = await confirmWithToken(tok.token);
    if (c.outcome === "used") return page("Link used", `${summary}<p>This link was already used.</p>`);
    if (c.outcome === "expired") return page("Link expired", `${summary}<p>This link expired. Ask Claude to mark the invoice paid if the money arrived.</p>`, 410);
    if (c.outcome === "not_found") return page("Link not valid", "<p>This confirmation link is not valid. Ask Claude to look up the payment.</p>", 404);
    if (c.outcome === "not_issued" || !c.result) {
      const now = await getInvoice(inv.id).catch(() => null);
      return page("Already done", `${summary}<p>This invoice is already <b>${esc(now?.status ?? "paid")}</b>. Nothing more to do.</p>`);
    }
    const r = c.result;
    if (r.fulfilment === "failed") {
      return page("Paid, but fulfilment failed", `${summary}<p>Marked paid, but sending it on failed: ${esc(r.note ?? "")}. You have an email with the details.</p>`, 500);
    }
    return page("Confirmed", `${summary}<p><b>Confirmed.</b> ${r.changed ? `Fulfilment: ${esc(r.fulfilment)}.` : esc(r.note ?? "Nothing changed.")}</p>`);
  } catch (e) {
    console.error("esa-payment-confirm failed:", e instanceof Error ? e.message : String(e));
    if (req.method === "POST") {
      await emailFounderAlert("ESA Confirm paid button hit an error", [
        `Pressing Confirm paid raised an error: ${esc((e instanceof Error ? e.message : String(e)).slice(0, 400))}`,
        `If the invoice is still "issued", nothing was changed and the same link can be pressed again. Otherwise ask Claude to check the payment.`,
      ]).catch(() => false);
    }
    return page("Something went wrong", "<p>Something went wrong. Nothing was changed unless you see a confirmation. Ask Claude to check the payment.</p>", 500);
  }
});
