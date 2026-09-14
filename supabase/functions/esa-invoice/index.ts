// esa-invoice: the public order form on /esa/<state> (Arizona, Arkansas, Alabama, New Hampshire).
// Added 2026-09-14. A family fills in the form, and this function:
//   1. validates the order against the per-state rules (_shared/esa-invoice.ts),
//   2. issues one invoice number per student from the database counter,
//   3. draws each invoice PDF (_shared/esa-invoice-pdf.ts) and stores it privately,
//   4. records each invoice in public.esa_invoices (status "issued"),
//   5. returns the PDFs so the page can offer an instant download,
//   6. emails the family their invoice(s) with the ClassWallet next step, and copies hello@.
//
// Nothing ships and nothing costs money until ClassWallet pays, so an abandoned or bogus
// invoice is harmless. Payment matching and fulfilment are later phases.
//
// verify_jwt is OFF (config.toml): anonymous families call it from a static page.
// Spam: a hidden honeypot field plus the shared per-IP limiter (fails open, by design).
//
// Founder test orders: use hello+esatest@edeninstitute.health. They are rendered, stored and
// emailed like a real order but marked is_test, numbered ET-TEST-..., and never touch the
// state counters, so no real invoice number is burned.

import {
  centralDate,
  money,
  parseSubmission,
  planInvoices,
  secondDate,
  STATE_RULES,
  TEST_EMAIL,
  type InvoicePlan,
} from "../_shared/esa-invoice.ts";
import { renderInvoicePdf } from "../_shared/esa-invoice-pdf.ts";
import { enforceCheckoutRateLimit } from "../_shared/checkout-rate-limit.ts";
import { captureException } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Camila at The Eden Institute <hello@edeninstitute.health>";
const FOUNDER = "hello@edeninstitute.health";
const BUCKET = "esa-invoices";
/** A real family submits once, maybe twice after a typo. */
const SUBMISSIONS_PER_WINDOW = 6;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const svcHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  ...extra,
});

/** The two-method slice of a supabase-js client the shared rate limiter needs. */
const db = {
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: svcHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(args ?? {}),
    });
    if (!res.ok) return { data: null, error: { message: `${res.status} ${await res.text().catch(() => "")}` } };
    return { data: await res.json(), error: null };
  },
};

async function nextNumber(state: string, year: number): Promise<string> {
  const { data, error } = await db.rpc("esa_next_invoice_number", { p_state: state, p_year: year });
  if (error || typeof data !== "string") throw new Error(`invoice number: ${error?.message ?? "no number"}`);
  return data;
}

async function upload(path: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: svcHeaders({ "Content-Type": "application/pdf", "x-upsert": "true" }),
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload ${path}: ${res.status} ${await res.text().catch(() => "")}`);
}

async function insertRows(rows: Record<string, unknown>[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/esa_invoices`, {
    method: "POST",
    headers: svcHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`esa_invoices insert: ${res.status} ${await res.text().catch(() => "")}`);
}

async function markEmailed(numbers: string[]): Promise<void> {
  const list = numbers.map((n) => `"${n}"`).join(",");
  await fetch(`${SUPABASE_URL}/rest/v1/esa_invoices?invoice_number=in.(${list})`, {
    method: "PATCH",
    headers: svcHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ family_emailed_at: new Date().toISOString() }),
  }).catch(() => {});
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

interface Issued {
  number: string;
  plan: InvoicePlan;
  pdf: Uint8Array;
}

function familyEmail(issued: Issued[], invoiceDate: string, isTest: boolean) {
  const plan0 = issued[0].plan;
  const rules = STATE_RULES[plan0.state];
  const first = plan0.parentName.split(" ")[0];
  const many = issued.length > 1;
  const subject = `${isTest ? "[TEST] " : ""}Your Eden's Table invoice${many ? "s" : ""} (${issued.map((i) => i.number).join(", ")})`;
  const rows = issued
    .map(
      (i) =>
        `<tr><td style="padding:6px 12px 6px 0">${esc(i.number)}</td><td style="padding:6px 12px 6px 0">${esc(i.plan.studentName)}</td><td style="padding:6px 12px 6px 0">${esc(i.plan.items.map((it) => it.title.replace(/^Sprouts K-2 (36-Week |9-Week )?/, "")).join(", "))}</td><td style="padding:6px 0;text-align:right;font-weight:bold">${money(i.plan.totalCents)}</td></tr>`,
    )
    .join("");
  const printed = issued.some((i) => i.plan.printed);
  const html = `<!doctype html><html><body style="margin:0;background:#FAF6EE;font-family:Georgia,serif;color:#1E1E14">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EE"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E8D5A3">
<tr><td style="padding:28px 32px">
<p style="font-size:20px;font-weight:bold;color:#2B3A1E;margin:0 0 16px">Eden's Table</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Hi ${esc(first)},</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Thank you for choosing Eden's Table. Your invoice${many ? "s are" : " is"} attached as ${many ? "PDFs, one for each student" : "a PDF"}.</p>
<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 18px;border-top:1px solid #E8D5A3;border-bottom:1px solid #E8D5A3">${rows}</table>
<p style="font-size:16px;font-weight:bold;color:#2B3A1E;margin:0 0 6px">Your next step</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${esc(rules.nextStep)}${many ? " Submit each invoice under that student's account." : ""}</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${printed ? "As soon as payment arrives, we order your books. They are printed to order, so plan on about two to three weeks from there." : "As soon as payment arrives, we email you the Starter Unit files."}</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">If anything on ${many ? "an invoice" : "the invoice"} needs to change, just reply to this email and I will fix it.</p>
<p style="font-size:16px;line-height:1.6;margin:0">Warmly,<br>Camila<br><span style="color:#5C4A28;font-size:14px">Eden's Table · Rooted in Faith Ventures LLC · (931) 575-5895</span></p>
</td></tr></table>
<p style="font-family:Arial,sans-serif;font-size:11px;color:#5C4A28;margin:12px 0 0">Invoice date ${esc(invoiceDate)}. You are receiving this because you requested an invoice at edeninstitute.health.</p>
</td></tr></table></body></html>`;
  return { subject, html };
}

function founderEmail(issued: Issued[], isTest: boolean) {
  const p = issued[0].plan;
  const total = issued.reduce((t, i) => t + i.plan.totalCents, 0);
  const subject = `${isTest ? "[TEST] " : ""}ESA invoice issued: ${STATE_RULES[p.state].name}, ${issued.length} student${issued.length > 1 ? "s" : ""}, ${money(total)}`;
  const lines = issued
    .map((i) => `<li>${esc(i.number)}: ${esc(i.plan.studentName)}, ${esc(i.plan.items.map((it) => it.sku).join(", "))}, ${money(i.plan.totalCents)}</li>`)
    .join("");
  const html = `<p>An ESA invoice was issued from the /esa form. Nothing ships until ClassWallet pays.</p>
<p><b>${esc(p.parentName)}</b> &lt;${esc(p.email)}&gt;<br>Ship to: ${esc(p.shipTo).replace(/\n/g, ", ")}</p>
<ul>${lines}</ul><p>The PDFs are attached and stored in public.esa_invoices (status issued).</p>`;
  return { subject, html };
}

async function sendEmail(args: {
  to: string[];
  subject: string;
  html: string;
  attachments: { filename: string; content: string }[];
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing, skipping email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: args.to,
        reply_to: FOUNDER,
        subject: args.subject,
        html: args.html,
        attachments: args.attachments,
      }),
    });
    if (!res.ok) {
      console.error("esa-invoice email failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("esa-invoice email error:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Server configuration error" });

  const body = await req.json().catch(() => null);
  // Honeypot: a hidden field real families never see. Answer like a validation error.
  if (body && typeof body === "object" && typeof (body as Record<string, unknown>).company === "string" && (body as Record<string, string>).company.trim()) {
    return json(400, { error: "Please fill in the form." });
  }
  const parsed = parseSubmission(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const sub = parsed.value;
  const isTest = sub.email === TEST_EMAIL;

  if (!isTest) {
    const rate = await enforceCheckoutRateLimit(db, req, SUBMISSIONS_PER_WINDOW);
    if (!rate.allowed) {
      return json(429, { error: "Too many invoices from this connection. Please wait a few minutes, or email hello@edeninstitute.health." });
    }
  }

  try {
    const invoiceDate = centralDate();
    const year = Number(invoiceDate.slice(0, 4));
    const submissionId = crypto.randomUUID();
    const plans = planInvoices(sub);
    const issued: Issued[] = [];
    for (const [idx, plan] of plans.entries()) {
      const number = isTest
        ? `ET-TEST-${plan.state}-${Date.now().toString(36).toUpperCase()}${idx}`
        : await nextNumber(plan.state, year);
      const { bytes } = await renderInvoicePdf(plan, number, invoiceDate);
      await upload(`${plan.state}/${number}.pdf`, bytes);
      issued.push({ number, plan, pdf: bytes });
    }

    await insertRows(
      issued.map(({ number, plan }) => ({
        invoice_number: number,
        submission_id: submissionId,
        is_test: isTest,
        state: plan.state,
        invoice_date: invoiceDate,
        second_date: secondDate(plan, invoiceDate),
        parent_name: plan.parentName,
        student_name: plan.studentName,
        family_email: plan.email,
        ship_to: plan.shipTo,
        ship_address: plan.printed ? sub.address : null,
        phone: sub.phone || null,
        items: plan.items.map((i) => ({ sku: i.sku, qty: i.qty, unit_cents: i.unitCents, amount_cents: i.amountCents })),
        subtotal_cents: plan.subtotalCents,
        fee_cents: plan.feeCents,
        total_cents: plan.totalCents,
        pdf_path: `${plan.state}/${number}.pdf`,
      })),
    );

    const attachments = issued.map((i) => ({ filename: `Eden's Table invoice ${i.number}.pdf`, content: b64(i.pdf) }));
    const fam = familyEmail(issued, invoiceDate, isTest);
    const [sentFamily] = await Promise.all([
      sendEmail({ to: [sub.email], subject: fam.subject, html: fam.html, attachments }),
      (async () => {
        const f = founderEmail(issued, isTest);
        await sendEmail({ to: [FOUNDER], subject: f.subject, html: f.html, attachments });
      })(),
    ]);
    if (sentFamily) await markEmailed(issued.map((i) => i.number));

    return json(200, {
      ok: true,
      emailed: sentFamily,
      email: sub.email,
      nextStep: STATE_RULES[sub.state].nextStep,
      invoices: issued.map((i) => ({
        number: i.number,
        student: i.plan.studentName,
        total: money(i.plan.totalCents),
        filename: `Eden's Table invoice ${i.number}.pdf`,
        pdfBase64: b64(i.pdf),
      })),
    });
  } catch (e) {
    console.error("esa-invoice failed:", e instanceof Error ? e.message : String(e));
    await captureException(e, { function: "esa-invoice" });
    return json(500, {
      error: "Something went wrong making your invoice. Please try again, or email hello@edeninstitute.health and we will send it by hand.",
    });
  }
});
