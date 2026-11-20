// supabase/functions/_shared/wired-email-drain.ts
//
// Fearfully & Wonderfully Wired, W8a: sends due wired_email_queue rows. W8a handles learner email 1
// only (kind 'drip', position 1: the results + the free PDF); the drip 2-10 and the July emails are
// W8b. Called by wired-pdf when no purchase PDF is waiting (purchases go first), at most
// EMAILS_PER_RUN rows a run.
//
// Each row: claim (compare-and-set on retry_count) -> skip if the shared opt-out / bounce /
// complaint rule blocks it (public.email_send_blocked, list 'learner', the same rule every Eden
// sender uses) or the child is locked or removed -> build the free PDF + email 1 -> send with a
// Resend Idempotency-Key per row -> mark sent. 5 tries, then failed_at and a founder email.

import { type Db, pg } from "./wired-submit-flow.ts";
import { loadBlueprintData, renderJob, type PdfJob } from "./wired-pdf-job.ts";
import { buildEmailOne } from "./wired-email-one.ts";
import { applyUnsub } from "./email-unsubscribe.ts";
import { signWiredToken } from "./wired-token.ts";
import { wiringName } from "./wired-pdf.ts";
import { notifyFounder } from "./lulu-fulfillment.ts";

export const EMAILS_PER_RUN = 3;
const MAX_TRIES = 5;

interface QueueRow {
  id: string; family_id: string | null; email: string; child_id: string | null; kind: string; position: number | null;
  retry_count: number; created_at: string;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

export interface EmailDrainOptions {
  resendKey: string;
  from: string;
  replyTo: string;
  emailId?: string;          // one row (Lane 2 checks)
  dryRun?: boolean;          // build everything, send nothing, put the row back
  testTo?: string;           // send the real email to this inbox only (founder test), put the row back
}

export async function drainEmailQueue(db: Db, o: EmailDrainOptions): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const one = o.emailId && /^[0-9a-f-]{36}$/i.test(o.emailId) ? `id=eq.${o.emailId}&` : "";
  const rows = await pg<QueueRow[]>(db,
    `wired_email_queue?${one}kind=eq.drip&position=eq.1&sent_at=is.null&failed_at=is.null&skipped_reason=is.null` +
    `&scheduled_for=lte.${encodeURIComponent(now)}&retry_count=lt.${MAX_TRIES}` +
    `&select=id,family_id,email,child_id,kind,position,retry_count,created_at&order=scheduled_for.asc&limit=${one ? 1 : EMAILS_PER_RUN}`);
  const out = { emails_found: rows?.length ?? 0, sent: 0, skipped: 0, failed: 0, details: [] as unknown[] };

  for (const row of rows ?? []) {
    // Claim: only one runner wins this try.
    const claimed = await pg<QueueRow[]>(db, `wired_email_queue?id=eq.${row.id}&retry_count=eq.${row.retry_count}&sent_at=is.null`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ retry_count: row.retry_count + 1 }),
    });
    if (!claimed?.length) continue;
    const putBack = () => pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ retry_count: row.retry_count }) });
    const skip = async (reason: string) => {
      await pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ skipped_reason: reason }) });
      out.skipped++; out.details.push({ id: row.id, skipped: reason });
    };
    try {
      if (!row.family_id || !row.child_id) { await skip("no_family_or_child"); continue; }
      const blocked = await pg<boolean>(db, "rpc/email_send_blocked", {
        method: "POST", body: JSON.stringify({ p_email: row.email, p_list: "learner", p_queued_at: row.created_at }),
      });
      if (blocked === true && !o.testTo) { await skip("suppressed"); continue; }
      const kid = (await pg<{ unlocked_via: string | null }[]>(db, `wired_children?id=eq.${row.child_id}&removed_at=is.null&select=unlocked_via&limit=1`))?.[0];
      if (!kid || kid.unlocked_via === null) { await skip("child_locked_or_removed"); continue; }

      const job: PdfJob = { id: row.id, family_id: row.family_id, child_id: row.child_id, order_id: null, buyer_id: null, kind: "free", quiz_year: 0, attempts: 0, status: "queued" };
      const loaded = await loadBlueprintData(db, job);
      const child = loaded.children[0];
      const pdf = await renderJob(job, loaded);
      if (pdf.bytes.length > 3 * 1024 * 1024) throw new Error(`free PDF is ${pdf.bytes.length} bytes, over the 3 MB budget`);
      const token = await signWiredToken({ familyId: row.family_id, purpose: "results" });
      const mail = buildEmailOne({ firstName: loaded.firstName, nickname: child.nickname, top3: child.top3.slice(0, 3).map(wiringName), resultsToken: token });
      if (o.dryRun) {
        await putBack();
        out.details.push({ id: row.id, dry_run: true, subject: mail.subject, bytes: pdf.bytes.length, pages: pdf.pages, filename: pdf.filename });
        continue;
      }
      const to = o.testTo || row.email;
      const { html, headers: unsubHeaders } = await applyUnsub(mail.html, to, "learner");
      const { html: text } = await applyUnsub(mail.text, to, "learner");
      if (!o.resendKey) throw new Error("RESEND_API_KEY is not set");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${o.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `wired-email-${o.testTo ? "test-" : ""}${row.id}` },
        body: JSON.stringify({
          from: o.from, reply_to: o.replyTo, to: [to], subject: mail.subject, html, text, headers: unsubHeaders,
          attachments: [{ filename: pdf.filename, content: b64(pdf.bytes) }],
          tags: [{ name: "category", value: "wired_email_1" }],
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      const sent = await res.json().catch(() => ({})) as { id?: string };
      if (o.testTo) {
        await putBack();
        out.details.push({ id: row.id, test_send: true, bytes: pdf.bytes.length });
        continue;
      }
      await pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_at: new Date().toISOString(), resend_id: sent.id ?? null }) });
      out.sent++; out.details.push({ id: row.id, sent: true });
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 400);
      const final = row.retry_count + 1 >= MAX_TRIES;
      console.error(`wired email ${row.id} try ${row.retry_count + 1} failed${final ? " (giving up)" : ""}: ${msg}`);
      out.failed++; out.details.push({ id: row.id, error: msg });
      if (o.dryRun || o.testTo) { await putBack(); continue; }
      if (final) {
        await pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ failed_at: new Date().toISOString() }) });
        await notifyFounder("Wired quiz results email did NOT go out", [
          "A family finished the Fearfully & Wonderfully Wired quiz, but their results email (with the free PDF) failed 5 times.",
          "", `Queue row: ${row.id}`, `Why: ${msg}`, "",
          "Their results are still on the results page. Ask Claude (Lane 2) to resend it.",
        ].join("\n"));
      }
    }
  }
  return out;
}
