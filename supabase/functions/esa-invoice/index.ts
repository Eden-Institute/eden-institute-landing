// esa-invoice: the public order form on /esa/<state> (Arizona, Arkansas, Alabama, New Hampshire).
// Added 2026-09-14. A family fills in the form, and this function:
//   1. validates the order against the per-state rules (_shared/esa-invoice.ts),
//   2. claims the form fill's idempotency key (esa_claim_invoice_request): a retry of the same fill
//      returns the invoices already issued, with no new number, upload or email,
//   3. issues one invoice number per student from the database counter TOGETHER with its row
//      (status "pending"), draws and stores each PDF, then marks the batch "issued"; a failure part
//      way voids the batch with the reason recorded, removes stored PDFs and alerts the founder
//      (_shared/esa-invoice-issue.ts),
//   4. returns the PDFs so the page can offer an instant download,
//   5. only after every row and PDF is in place, emails the family their invoice(s) with the
//      ClassWallet next step, and copies hello@.
//
// Nothing ships and nothing costs money until ClassWallet pays, so an abandoned or bogus
// invoice is harmless. Payment matching and fulfilment are later phases.
//
// verify_jwt is OFF (config.toml): anonymous families call it from a static page.
// Spam: a hidden honeypot field, the shared per-IP limiter, and a site-wide hourly cap
// (ESA_INVOICE_HOURLY_CAP). Both limiters fail open, by design. Retries of a known key skip them.
//
// Founder test orders: use hello+esatest@edeninstitute.health. They are rendered, stored and
// emailed like a real order but marked is_test, numbered ET-TEST-..., and never touch the
// state counters, so no real invoice number is burned. They share the per-IP limiter.

import {
  centralDate,
  forbiddenInFamilyText,
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
import { bumpRateBucket } from "../_shared/rate-bucket.ts";
import { emailFounderAlert } from "../_shared/esa-fulfil.ts";
import {
  type ClaimOutcome,
  hourlyCapKey,
  issueInvoices,
  overHourlyCap,
  parseIdempotencyKey,
  pdfPathForNumber,
  RATE_LIMITED_MESSAGE,
  submissionHash,
} from "../_shared/esa-invoice-issue.ts";
import { captureException } from "../_shared/sentry.ts";
import { esc } from "../_shared/html-escape.ts";

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

const GENERIC_ERROR =
  "Something went wrong making your invoice. Please try again, or email hello@edeninstitute.health and we will send it by hand.";

async function rpcRows<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return Array.isArray(data) ? (data as T[]) : data == null ? [] : [data as T];
}

async function restGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svcHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path.split("?")[0]}: ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

async function insertPending(row: Record<string, unknown>, testNumber: string | null) {
  // Number and row in one transaction: a number can never exist without its row.
  const [r] = await rpcRows<{ id: string; invoice_number: string }>("esa_insert_pending_invoice", { p_row: row, p_test_number: testNumber });
  if (!r?.id || !r.invoice_number) throw new Error("esa_insert_pending_invoice returned no row");
  return r;
}

async function setPdfPath(id: string, path: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/esa_invoices?id=eq.${id}`, {
    method: "PATCH",
    headers: svcHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ pdf_path: path, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`esa_invoices pdf_path: ${res.status} ${await res.text().catch(() => "")}`);
}

async function removeObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: svcHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`storage delete: ${res.status} ${await res.text().catch(() => "")}`);
}

async function download(path: string): Promise<Uint8Array> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { headers: svcHeaders() });
  if (!res.ok) throw new Error(`storage download ${path}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function upload(path: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: svcHeaders({ "Content-Type": "application/pdf", "x-upsert": "true" }),
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload ${path}: ${res.status} ${await res.text().catch(() => "")}`);
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
        `<tr><td style="padding:6px 12px 6px 0">${esc(i.number)}</td><td style="padding:6px 12px 6px 0">${esc(i.plan.studentName)}</td><td style="padding:6px 12px 6px 0">${esc(i.plan.items.map((it) => it.title.replace(/^(?:Sprouts K-2|Seedlings 3-5) (36-Week |9-Week )?/, "")).join(", "))}</td><td style="padding:6px 0;text-align:right;font-weight:bold">${money(i.plan.totalCents)}</td></tr>`,
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

interface StoredInvoice {
  invoice_number: string;
  student_name: string;
  total_cents: number;
  pdf_path: string | null;
  family_emailed_at: string | null;
}

/** A retry of a fill that already completed: the same invoices, re-read from storage. Nothing is
 *  numbered, uploaded or emailed. */
async function replay(submissionId: string, sub: { email: string; state: keyof typeof STATE_RULES }) {
  const rows = await restGet<StoredInvoice[]>(
    `esa_invoices?submission_id=eq.${submissionId}&status=not.in.(pending,void)&select=invoice_number,student_name,total_cents,pdf_path,family_emailed_at&order=created_at.asc,invoice_number.asc`,
  );
  if (!rows.length) throw new Error(`completed request ${submissionId} has no invoices`);
  const invoices = [];
  for (const r of rows) {
    const path = r.pdf_path ?? pdfPathForNumber(r.invoice_number);
    if (!path) throw new Error(`no PDF path for ${r.invoice_number}`);
    invoices.push({
      number: r.invoice_number,
      student: r.student_name,
      total: money(r.total_cents),
      filename: `Eden's Table invoice ${r.invoice_number}.pdf`,
      pdfBase64: b64(await download(path)),
    });
  }
  return json(200, {
    ok: true,
    replayed: true,
    emailed: rows.every((r) => !!r.family_emailed_at),
    email: sub.email,
    nextStep: STATE_RULES[sub.state].nextStep,
    invoices,
  });
}

async function finishRequest(key: string, submissionId: string, ok: boolean, error: string | null): Promise<string[]> {
  const { data, error: rpcError } = await db.rpc("esa_finish_invoice_request", {
    p_key: key,
    p_submission_id: submissionId,
    p_ok: ok,
    p_error: error,
  });
  if (rpcError) throw new Error(`esa_finish_invoice_request: ${rpcError.message}`);
  return Array.isArray(data) ? (data as string[]) : [];
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
  // A page cached from before idempotency keys sends none: it gets a one-off key (no retry protection).
  const key = parseIdempotencyKey((body as Record<string, unknown>).idempotencyKey) ?? crypto.randomUUID();

  // A retry of a fill we already know is not a new request: it skips both limiters.
  let knownKey = false;
  try {
    knownKey = (await restGet<unknown[]>(`esa_invoice_requests?idempotency_key=eq.${key}&select=idempotency_key`)).length > 0;
  } catch (e) {
    console.warn("esa-invoice: request lookup failed, treating as new:", e instanceof Error ? e.message : String(e));
  }

  if (!knownKey) {
    // Test orders are throttled too: the test address is not a secret, and each one still
    // stores PDFs, inserts rows and sends two emails.
    const rate = await enforceCheckoutRateLimit(db, req, SUBMISSIONS_PER_WINDOW);
    if (!rate.allowed) {
      return json(429, { error: "Too many invoices from this connection. Please wait a few minutes, or email hello@edeninstitute.health." });
    }
    const hourCount = await bumpRateBucket({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, key: hourlyCapKey(), windowSeconds: 3600 });
    if (overHourlyCap(hourCount)) {
      console.warn(`esa-invoice: site-wide hourly cap reached (${hourCount})`);
      return json(429, { error: RATE_LIMITED_MESSAGE, code: "RATE_LIMITED" });
    }
  }

  try {
    const invoiceDate = centralDate();
    const plans = planInvoices(sub);
    // Before any invoice number is issued, so a rejected Alabama submission burns no number.
    const famHits = plans.flatMap((pl) => forbiddenInFamilyText(pl.state, `${pl.parentName} ${pl.studentName} ${pl.shipTo}`));
    if (famHits.length) throw new Error(`submission failed wording checks: ${famHits.join("; ")}`);

    const submissionId = crypto.randomUUID();
    const [claim] = await rpcRows<{ outcome: ClaimOutcome; submission_id: string | null; voided_numbers: string[] | null }>(
      "esa_claim_invoice_request",
      { p_key: key, p_hash: await submissionHash(sub), p_submission_id: submissionId },
    );
    if (!claim) throw new Error("esa_claim_invoice_request returned nothing");
    if (claim.outcome === "completed" && claim.submission_id) return await replay(claim.submission_id, sub);
    if (claim.outcome === "processing") {
      return json(409, { error: "Your invoice is still being made. Please wait a minute, then press the button again.", code: "IN_PROGRESS" });
    }
    if (claim.outcome === "mismatch") {
      return json(409, { error: "This form was already used for a different invoice. Please reload the page and fill it in again.", code: "KEY_REUSED" });
    }
    if (claim.outcome !== "claimed") return json(500, { error: GENERIC_ERROR });

    const stale = claim.voided_numbers ?? [];
    if (stale.length) {
      // An earlier attempt of this same fill stopped part way (timed out). Its numbers are recorded void.
      const paths = stale.map(pdfPathForNumber).filter((p): p is string => !!p);
      await removeObjects(paths).catch((e) => console.error("esa-invoice: stale PDF cleanup failed:", e instanceof Error ? e.message : String(e)));
      await emailFounderAlert(`${isTest ? "[TEST] " : ""}ESA invoice attempt stopped part way for ${sub.email}`, [
        `An earlier attempt at this family's invoice stopped before finishing. The family pressed the button again, so a new attempt is running now.`,
        `Invoice numbers from the stopped attempt, recorded as void in esa_invoices: ${esc(stale.join(", "))}.`,
      ]).catch(() => false);
    }

    const issued = await issueInvoices(
      {
        submissionId,
        sub,
        plans,
        isTest,
        invoiceDate,
        secondDate,
        testNumber: (plan, idx) => `ET-TEST-${plan.state}-${Date.now().toString(36).toUpperCase()}${idx}`,
      },
      {
        insertPending,
        render: async (plan, number, date) => (await renderInvoicePdf(plan, number, date)).bytes,
        upload,
        setPdfPath,
        finish: (ok, error) => finishRequest(key, submissionId, ok, error),
        removeObjects,
        alertFounder: emailFounderAlert,
      },
    );

    // Every row and PDF is in place: only now does any email go out.
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
    return json(500, { error: GENERIC_ERROR });
  }
});
