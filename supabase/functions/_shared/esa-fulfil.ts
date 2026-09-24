// ESA automation, parts 2-4: apply a payment to an invoice, fulfil it through the EXISTING pipelines,
// and send the emails around it. Used by esa-payment (service role) and esa-payment-confirm (the
// founder's one-tap page). Added 2026-09-15.
//
// Fulfilment reuses what /books and the Starter already run on, without Stripe:
//   printed set / extra notebook -> orders (status ready_to_fulfill, is_preorder FALSE, fulfillment lulu)
//                                   + order_items + lulu_jobs(pending), then a kick to lulu-submit.
//                                   Lulu holds every job 48 hours before printing (lulu-config.ts).
//                                   The order is inserted straight at ready_to_fulfill so the Stripe-worded
//                                   order_confirmation email is NOT sent; this file sends an ESA-worded one.
//                                   Shipped and delivered emails still come from lulu-webhook (no card wording).
//   9-week Starter (Alabama)      -> starter_deliveries(pending) with an unguessable key and NO order_id,
//                                   so the Starter email carries no Stripe receipt block; kick starter-fulfill.
//                                   No credit is minted (Laws L-29): issueStarterCredit lives only in stripe-webhook.
//                                   Sprouts (ET-SPR-K2-003) or Seedlings (ET-SDL-35-003, 2026-09-24): a
//                                   Seedlings row writes band 'seedlings', exactly as stripe-webhook does.
//   Seedlings printed set         -> the same order path with products sku seedlings_print_set (and, from
//   / extra notebook                 2026-09-24, seedlings_nb_print). Its Lulu band comes from
//                                   orders.lookup_key (printBandForOrder in lulu-config.ts).
//   every paid invoice            -> one payments ledger row (stripe_event_id 'esa:<invoice number>', idempotent).
//
// SAFETY: a TEST invoice (is_test) never creates an order, a Lulu job or a delivery. It is marked paid,
// its family email goes out with [TEST] in the subject, and fulfilment_status becomes 'manual'.

import { STATE_RULES, type EsaStateCode, money } from "./esa-invoice.ts";
import { esc } from "./html-escape.ts";
import type { StarterBand } from "./starter-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
export const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
export const FOUNDER = "hello@edeninstitute.health";
/** Lulu requires a phone on every shipment. When a family leaves it blank the business line is used. */
export const FALLBACK_PHONE = "(931) 575-5895";
const CONFIRM_URL = `${SUPABASE_URL}/functions/v1/esa-payment-confirm`;

// One invoice carries one product (one student, one choice), so a printed order never mixes bands.
const SKU_TO_PRODUCT: Record<string, { sku: string; label: string }> = {
  "ET-SPR-K2-004": { sku: "sprouts_print_set", label: "Sprouts Printed Curriculum Set" },
  "ET-SPR-K2-005": { sku: "sprouts_nb_print", label: "Sprouts Extra Student Notebook" },
  "ET-SDL-35-004": { sku: "seedlings_print_set", label: "Seedlings Printed Curriculum Set" },
  "ET-SDL-35-005": { sku: "seedlings_nb_print", label: "Seedlings Extra Student Notebook" },
};
/** ESA Starter SKU -> the starter_deliveries band it delivers. */
const STARTER_SKU_BAND: Record<string, StarterBand> = {
  "ET-SPR-K2-003": "sprouts",
  "ET-SDL-35-003": "seedlings",
};
export const ESA_STARTER_SKUS: readonly string[] = Object.keys(STARTER_SKU_BAND);

export interface EsaInvoiceRow {
  id: string;
  invoice_number: string;
  is_test: boolean;
  state: EsaStateCode;
  invoice_date: string;
  parent_name: string;
  student_name: string;
  family_email: string;
  ship_to: string | null;
  ship_address: { line1: string; line2: string; city: string; region: string; zip: string } | null;
  phone: string | null;
  items: { sku: string; qty: number; unit_cents: number; amount_cents: number }[];
  total_cents: number;
  fee_cents: number;
  status: string;
  paid_at: string | null;
  paid_via: string | null;
  payment_id: string | null;
  fulfilment_status: string;
  order_id: string | null;
  starter_delivery_id: string | null;
  created_at: string;
  reminder_sent_at: string | null;
  founder_alerted_at: string | null;
}

// ----------------------------------------------------------------------------- PostgREST
const H = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H(), ...(init.headers as Record<string, string> ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]}: ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  return rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

export async function getInvoice(id: string): Promise<EsaInvoiceRow | null> {
  const rows = await rest<EsaInvoiceRow[]>(`esa_invoices?id=eq.${id}&select=*`);
  return rows[0] ?? null;
}

async function patchInvoice(id: string, fields: Record<string, unknown>): Promise<void> {
  await rest(`esa_invoices?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

// ----------------------------------------------------------------------------- email
export function wrap(bodyHtml: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#FAF6EE;font-family:Georgia,serif;color:#1E1E14">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E8D5A3">
<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6">
<p style="font-size:20px;font-weight:bold;color:#2B3A1E;margin:0 0 16px">Eden's Table</p>
${bodyHtml}
</td></tr></table>
<p style="font-family:Arial,sans-serif;font-size:11px;color:#5C4A28;margin:12px 0 0">${esc(footer)}</p>
</td></tr></table></body></html>`;
}

export const para = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;
const signature = `<p style="margin:0">Warmly,<br>Camila<br><span style="color:#5C4A28;font-size:14px">Eden's Table · Rooted in Faith Ventures LLC · (931) 575-5895</span></p>`;

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing, email skipped:", subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: FOUNDER, subject, html }),
    });
    if (!res.ok) console.error("esa email failed:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("esa email error:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const testTag = (inv: { is_test: boolean }) => (inv.is_test ? "[TEST] " : "");

/** Founder email asking for the one tap. One button per candidate invoice. */
export async function emailFounderConfirm(
  notice: { subject: string; excerpt: string; status: string; reason: string },
  candidates: { invoice: EsaInvoiceRow; token: string }[],
): Promise<boolean> {
  const first = candidates[0]?.invoice;
  const subject = candidates.length === 1 && first
    ? `${testTag(first)}Confirm ESA payment: ${first.invoice_number} (${money(first.total_cents)})`
    : `ESA payment needs you: ${candidates.length} possible invoices`;
  const rows = candidates
    .map(({ invoice: i, token }) =>
      `<div style="border:1px solid #E8D5A3;padding:12px 14px;margin:0 0 12px"><b>${esc(i.invoice_number)}</b> · ${esc(STATE_RULES[i.state].name)}<br>` +
      `${esc(i.student_name)} (parent ${esc(i.parent_name)}) · <b>${money(i.total_cents)}</b><br>` +
      `<a href="${CONFIRM_URL}?t=${token}" style="color:#2B3A1E;font-weight:bold">Review and confirm this one</a></div>`)
    .join("");
  const html = wrap(
    para(`A ClassWallet payment notice came in. ${notice.status === "matched" ? "It matches one invoice." : `It needs your eyes: ${esc(notice.reason)}.`}`) +
      para(`Tapping a link below opens a page that shows the invoice, with one Confirm paid button. Nothing is marked paid until you press it. Once it is, the order goes to print (or the Starter files go out) automatically.`) +
      rows +
      para(`<span style="font-size:13px;color:#5C4A28">Notice subject: ${esc(notice.subject)}<br>What it said: ${esc(notice.excerpt.slice(0, 600))}</span>`),
    "ESA payment automation. After 3 confirmed matches, matched payments apply on their own.",
  );
  return sendEmail(FOUNDER, subject, html);
}

export async function emailFounderAlert(subject: string, lines: string[]): Promise<boolean> {
  return sendEmail(FOUNDER, subject, wrap(lines.map(para).join(""), "ESA payment automation alert."));
}

/** Family: payment arrived, books are going to print. (Starter families get the Starter files email instead.) */
async function emailFamilyPaid(inv: EsaInvoiceRow): Promise<boolean> {
  const html = wrap(
    para(`Hi ${esc(firstName(inv.parent_name))},`) +
      para(`Good news! The payment for invoice <b>${esc(inv.invoice_number)}</b> (${esc(inv.student_name)}) arrived, and your Eden's Table books are headed to the printer.`) +
      para(`They are printed just for you, so plan on about two to three weeks to your door. I will email you tracking the day they ship.`) +
      para(`If anything needs to change, like the shipping address, reply to this email within the next two days, before printing starts.`) +
      signature,
    `Invoice ${inv.invoice_number}. You are receiving this because you ordered Eden's Table with a scholarship invoice.`,
  );
  return sendEmail(inv.family_email, `${testTag(inv)}Payment received: your Eden's Table books are going to print`, html);
}

/** Family: the one reminder, 14 days after an unpaid invoice. */
export async function emailFamilyReminder(inv: EsaInvoiceRow): Promise<boolean> {
  const html = wrap(
    para(`Hi ${esc(firstName(inv.parent_name))},`) +
      para(`Just a friendly note that your Eden's Table invoice <b>${esc(inv.invoice_number)}</b> for ${esc(inv.student_name)} (${money(inv.total_cents)}) is ready whenever you are.`) +
      para(esc(STATE_RULES[inv.state].nextStep)) +
      para(`If you have already submitted it, thank you! Reviews can take a couple of weeks, and there is nothing else you need to do. I will email you as soon as the payment arrives.`) +
      para(`Need a fresh copy of the invoice or a change to it? Just reply to this email.`) +
      signature,
    `Invoice ${inv.invoice_number}. This is the only reminder we send.`,
  );
  return sendEmail(inv.family_email, `${testTag(inv)}Your Eden's Table invoice ${inv.invoice_number} is ready when you are`, html);
}

// ----------------------------------------------------------------------------- apply + fulfil
function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function kick(fn: string, body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    if (!res.ok) console.warn(`kick ${fn} returned ${res.status} (the 10-minute cron drain will retry)`);
  } catch (e) {
    console.warn(`kick ${fn} failed (the 10-minute cron drain will retry):`, e instanceof Error ? e.message : String(e));
  }
}

export interface ApplyResult {
  changed: boolean;
  invoice: EsaInvoiceRow | null;
  fulfilment: string;
  note?: string;
}

/** Marks the invoice paid exactly once, then fulfils it. Safe to call twice: the second call changes nothing. */
export async function applyPayment(invoiceId: string, via: "founder_confirm" | "auto" | "manual", paymentId: string | null): Promise<ApplyResult> {
  const changed = await rpc<boolean>("esa_mark_invoice_paid", { p_invoice_id: invoiceId, p_via: via, p_payment_id: paymentId });
  return fulfilAfterMark(invoiceId, changed);
}

export type ConfirmOutcome = "applied" | "used" | "expired" | "not_found" | "not_issued";

/**
 * The founder's Confirm paid button. esa_confirm_payment_token() marks the invoice paid AND uses the
 * token in one database transaction, so an error before that point changes neither and the link
 * still works; only after it succeeds does fulfilment run. A fulfilment failure is handled like
 * applyPayment's (marked failed, founder alerted); the invoice stays paid.
 */
export async function confirmWithToken(token: string): Promise<{ outcome: ConfirmOutcome; result?: ApplyResult }> {
  const rows = await rpc<{ outcome: ConfirmOutcome; invoice_id: string | null; payment_id: string | null }[]>(
    "esa_confirm_payment_token",
    { p_token: token },
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error("esa_confirm_payment_token returned nothing");
  if (row.outcome !== "applied" || !row.invoice_id) return { outcome: row.outcome };
  return { outcome: "applied", result: await fulfilAfterMark(row.invoice_id, true) };
}

async function fulfilAfterMark(invoiceId: string, changed: boolean): Promise<ApplyResult> {
  const inv = await getInvoice(invoiceId);
  if (!inv) return { changed: false, invoice: null, fulfilment: "none", note: "invoice not found" };
  if (!changed) return { changed: false, invoice: inv, fulfilment: inv.fulfilment_status, note: `already ${inv.status}` };
  try {
    const f = await fulfil(inv);
    return { changed: true, invoice: await getInvoice(invoiceId), fulfilment: f };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patchInvoice(invoiceId, { fulfilment_status: "failed", fulfilment_note: msg.slice(0, 500) });
    await emailFounderAlert(`ESA fulfilment FAILED: ${inv.invoice_number}`, [
      `Invoice ${esc(inv.invoice_number)} (${esc(inv.student_name)}, ${money(inv.total_cents)}) is marked paid, but fulfilment failed and nothing was sent to print.`,
      `Error: ${esc(msg.slice(0, 400))}`,
      `Nothing retries this automatically. Tell Claude "retry ESA fulfilment for ${esc(inv.invoice_number)}".`,
    ]);
    return { changed: true, invoice: await getInvoice(invoiceId), fulfilment: "failed", note: msg };
  }
}

async function fulfil(inv: EsaInvoiceRow): Promise<string> {
  const printed = inv.items.filter((i) => SKU_TO_PRODUCT[i.sku]);
  const starterBand = inv.items.map((i) => STARTER_SKU_BAND[i.sku]).find(Boolean) ?? null;

  if (inv.is_test) {
    await patchInvoice(inv.id, { fulfilment_status: "manual", fulfilment_note: "test invoice: no order, Lulu job or delivery created", status: "fulfilled", fulfilled_at: new Date().toISOString() });
    if (printed.length) await emailFamilyPaid(inv);
    return "manual";
  }

  await recordLedger(inv);

  if (printed.length) {
    if (inv.order_id) return inv.fulfilment_status; // never create a second order
    const a = inv.ship_address;
    if (!a) throw new Error("no structured shipping address on the invoice");
    const products = await rest<{ id: string; sku: string; fulfillment: string }[]>(
      `products?sku=in.(${printed.map((i) => SKU_TO_PRODUCT[i.sku].sku).join(",")})&select=id,sku,fulfillment`,
    );
    const bySku = new Map(products.map((p) => [p.sku, p]));
    for (const i of printed) {
      const p = bySku.get(SKU_TO_PRODUCT[i.sku].sku);
      if (!p || p.fulfillment !== "lulu") throw new Error(`product ${SKU_TO_PRODUCT[i.sku].sku} missing or not a Lulu product`);
    }
    const [order] = await rest<{ id: string; order_number: string }[]>("orders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        stripe_checkout_session_id: `esa_${randomHex(24)}`,
        customer_email: inv.family_email,
        customer_phone: inv.phone || FALLBACK_PHONE,
        lookup_key: SKU_TO_PRODUCT[printed[0].sku].sku,
        product_label: printed.map((i) => SKU_TO_PRODUCT[i.sku].label).join(" + "),
        amount_total_cents: inv.total_cents,
        tax_cents: 0,
        currency: "usd",
        quantity: printed.reduce((t, i) => t + i.qty, 0),
        payment_status: "paid",
        shipping_name: inv.parent_name,
        shipping_address: { line1: a.line1, line2: a.line2 || null, city: a.city, state: a.region, postal_code: a.zip, country: "US" },
        status: "ready_to_fulfill",
        sms_consent: false,
        is_preorder: false,
        fulfillment: "lulu",
        // No student name here (founder 2026-09-15: children's names are stored on esa_invoices only).
        // The invoice number links back to it.
        raw: { source: "esa", invoice_number: inv.invoice_number, state: inv.state, paid_via: inv.paid_via, fee_cents: inv.fee_cents },
      }),
    });
    await rest("order_items", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(printed.map((i) => ({ order_id: order.id, product_id: bySku.get(SKU_TO_PRODUCT[i.sku].sku)!.id, quantity: i.qty, unit_price_cents: i.unit_cents }))),
    });
    await rest("lulu_jobs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: order.id, status: "pending" }) });
    await patchInvoice(inv.id, { order_id: order.id, fulfilment_status: "print_queued", status: "fulfilled", fulfilled_at: new Date().toISOString(), fulfilment_note: `order ${order.order_number}` });
    await kick("lulu-submit", { order_id: order.id });
    await emailFamilyPaid(inv);
    return "print_queued";
  }

  if (starterBand) {
    if (inv.starter_delivery_id) return inv.fulfilment_status;
    const isSprouts = starterBand === "sprouts";
    const sessionKey = `esa_${randomHex(32)}`; // starter-download accepts this as a credential: must be unguessable
    const [delivery] = await rest<{ id: string }[]>("starter_deliveries", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        stripe_checkout_session_id: sessionKey,
        order_id: null, // no Stripe receipt block in the Starter email
        email: inv.family_email,
        purchaser_name: inv.parent_name,
        status: "pending",
        download_token: randomHex(32),
        // Sprouts leaves `band` to the column default ('sprouts'), as stripe-webhook does; any other
        // band writes it, so a Seedlings family is never queued for Sprouts files.
        ...(isSprouts ? {} : { band: starterBand }),
      }),
    });
    // The kit relaunch list (L-29) is the Sprouts Starter's stand-in for its kit credit. Seedlings has
    // no credit of any kind (founder 2026-09-23), so it goes on no list.
    const note = isSprouts ? "starter delivery queued; kit relaunch list (L-29)" : `starter delivery queued (${starterBand}; no credit, no kit list)`;
    await patchInvoice(inv.id, { starter_delivery_id: delivery.id, fulfilment_status: "queued", status: "fulfilled", fulfilled_at: new Date().toISOString(), fulfilment_note: note });
    await kick("starter-fulfill", { session_id: sessionKey });
    return "queued";
  }
  throw new Error("invoice has no fulfilable items");
}

/** One payments-ledger row per paid invoice, so revenue reports see ESA income. Idempotent. */
async function recordLedger(inv: EsaInvoiceRow): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments?on_conflict=stripe_event_id`, {
    method: "POST",
    headers: H({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({
      stripe_event_id: `esa:${inv.invoice_number}`,
      kind: "one_off",
      status: "paid",
      amount_cents: inv.total_cents,
      currency: "usd",
      customer_email: inv.family_email,
      description: `ESA invoice ${inv.invoice_number} (${STATE_RULES[inv.state].name})`,
      lookup_key: inv.items.map((i) => i.sku).join(","),
      occurred_at: inv.paid_at ?? new Date().toISOString(),
      raw: { source: "esa", invoice_number: inv.invoice_number, fee_cents: inv.fee_cents, paid_via: inv.paid_via },
    }),
  });
  if (!res.ok) console.error("esa ledger insert failed (not blocking):", res.status, await res.text().catch(() => ""));
}
