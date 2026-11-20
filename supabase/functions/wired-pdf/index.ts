// wired-pdf: build and email Fearfully & Wonderfully Wired purchase PDFs (W7; spec 10, answers 3, 30-32).
//
// The durable queue is wired_pdf_jobs (written by stripe-webhook's wired_grant_purchase in the same
// transaction as the unlocks). ONE job per run, so a run stays far under the 256 MB / wall-clock
// limits: claim (compare-and-set) -> load the child(ren) -> render -> email with the PDF attached
// (Resend Idempotency-Key per job, so a retry never sends twice) -> mark sent.
// Callers: stripe-webhook (fire-and-forget right after a purchase, so "a few minutes" is honest)
// and the Vercel cron (api/cron/wired-pdf.ts, every 5 minutes) as the safety net.
// verify_jwt = true and service role only. Runs whether or not the quiz is public (it only ever
// finds jobs a real purchase wrote).

import { isServiceRoleRequest, serviceRoleRequired } from "../_shared/require-service-role.ts";
import { WIRED_CORS, wiredJson } from "../_shared/wired-gate.ts";
import { type Db, pg } from "../_shared/wired-submit-flow.ts";
import { loadBlueprintData, renderJob, type PdfJob } from "../_shared/wired-pdf-job.ts";
import { buildDeliveryEmail } from "../_shared/wired-delivery-email.ts";
import { notifyFounder } from "../_shared/lulu-fulfillment.ts";

const MAX_ATTEMPTS = 5;
const STUCK_MINUTES = 15;

function b64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: WIRED_CORS });
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(WIRED_CORS);
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const body = await req.json().catch(() => ({})) as { job_id?: string; dry_run?: boolean; test_founder?: boolean };

  // 1. Pick the oldest claimable job (queued, or stuck in 'building' for 15+ minutes).
  const stuck = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
  const filter = body.job_id && /^[0-9a-f-]{36}$/i.test(body.job_id) ? `id=eq.${body.job_id}&` : "";
  const found = await pg<PdfJob[]>(db,
    `wired_pdf_jobs?${filter}attempts=lt.${MAX_ATTEMPTS}&or=(status.eq.queued,and(status.eq.building,claimed_at.lt.${stuck}))` +
    `&select=id,family_id,child_id,order_id,buyer_id,kind,quiz_year,attempts,status&order=created_at.asc&limit=1`);
  const job = found?.[0];
  if (!job) return wiredJson(200, { claimed: 0 });

  // 2. Claim it: only one runner wins (attempts must still be what we read).
  const claimed = await pg<PdfJob[]>(db, `wired_pdf_jobs?id=eq.${job.id}&attempts=eq.${job.attempts}&status=eq.${job.status}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "building", attempts: job.attempts + 1, claimed_at: new Date().toISOString() }),
  });
  if (!claimed?.length) return wiredJson(200, { claimed: 0, raced: true });
  const attempt = job.attempts + 1;

  try {
    const loaded = await loadBlueprintData(db, job);
    const pdf = await renderJob(job, loaded);
    if (pdf.bytes.length > 3 * 1024 * 1024) throw new Error(`PDF is ${pdf.bytes.length} bytes, over the 3 MB budget`);
    const mail = buildDeliveryEmail(job.kind, { firstName: loaded.firstName, nickname: loaded.children[0]?.nickname, hasOwnAnswers: loaded.hasOwnAnswers });
    if (body.dry_run) {
      // Lane 2 check: build everything, send nothing, put the job back as it was.
      await pg(db, `wired_pdf_jobs?id=eq.${job.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: job.status, attempts: job.attempts, claimed_at: null }) });
      return wiredJson(200, { claimed: 1, dry_run: true, job: job.id, kind: job.kind, bytes: pdf.bytes.length, pages: pdf.pages, filename: pdf.filename, subject: mail.subject, children: loaded.children.length });
    }
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");
    // test_founder: the real email + PDF, sent ONLY to the founder (FOUNDER_EMAIL, as notifyFounder
    // uses), never to the buyer; the job is put back afterwards so nothing counts as delivered.
    const testFounder = body.test_founder === true && !!body.job_id;
    const to = testFounder ? (Deno.env.get("FOUNDER_EMAIL") ?? "") : loaded.email;
    if (!to) throw new Error("no recipient (FOUNDER_EMAIL unset for a test send)");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `wired-pdf-${testFounder ? "test-" : ""}${job.id}` },
      body: JSON.stringify({
        from: "Camila at The Eden Institute <hello@edeninstitute.health>",
        reply_to: "hello@edeninstitute.health",
        to: [to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: [{ filename: pdf.filename, content: b64(pdf.bytes) }],
        tags: [{ name: "category", value: "wired_delivery" }],
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    if (testFounder) {
      await pg(db, `wired_pdf_jobs?id=eq.${job.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: job.status, attempts: job.attempts, claimed_at: null }) });
      return wiredJson(200, { claimed: 1, test_founder: true, job: job.id, kind: job.kind, bytes: pdf.bytes.length, pages: pdf.pages });
    }
    await pg(db, `wired_pdf_jobs?id=eq.${job.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString(), last_error: null }) });
    console.log(`wired-pdf: sent ${job.kind} job ${job.id} (${pdf.bytes.length} bytes, ${pdf.pages} pages)`);
    return wiredJson(200, { claimed: 1, sent: true, job: job.id, kind: job.kind, bytes: pdf.bytes.length });
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const final = attempt >= MAX_ATTEMPTS;
    console.error(`wired-pdf: job ${job.id} attempt ${attempt} failed${final ? " (giving up)" : ""}: ${msg}`);
    await pg(db, `wired_pdf_jobs?id=eq.${job.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: final ? "failed" : "queued", last_error: msg }) });
    if (final) {
      await notifyFounder("Wired quiz PDF did NOT reach a buyer", [
        "A Fearfully & Wonderfully Wired purchase went through, but its PDF could not be built or emailed after 5 tries.",
        "", `Job: ${job.id} (${job.kind})`, `Why: ${msg}`, "",
        "The payment and the unlock are fine; the results page already shows the full results. Ask Claude (Lane 2) to resend the PDF.",
      ].join("\n"));
    }
    return wiredJson(500, { claimed: 1, sent: false, job: job.id, error: "build_or_send_failed" });
  }
});
