// supabase/functions/_shared/wired-email-drain.ts
//
// Fearfully & Wonderfully Wired: sends due wired_email_queue rows. W8a: learner email 1 (kind 'drip',
// position 1: the results + the free PDF). W8b: learner emails 2-10 (kind 'drip', positions 2-10) and the
// July check-ins (kind 'july', position 1 = July 1, 2 = July 15), built by wired-email-learner.ts.
// Called by wired-pdf when no purchase PDF is waiting (purchases go first), at most EMAILS_PER_RUN rows a run.
//
// Emails 2-10 and July go through the one-a-day guard (_shared/send-day-guard.ts, answer 5): if the
// address already had an Eden nurture email today (Central), the row moves to 8 AM Central tomorrow.
// Email 1 is exempt (the results she just asked for). Skips: position 9 until 3+ approved pilot quotes
// exist; email 4 (the Blueprint offer) when that child already has a Blueprint or Family Map; email 7
// when no matched curriculum has a link; July for children already retested this quiz year.
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
import { lowest3, wiringName } from "./wired-pdf.ts";
import { buildJulyEmail, buildLearnerEmail, type ChildBits, type LearnerEmail } from "./wired-email-learner.ts";
import { claimSendDay, nextCentralMorning, releaseSendDay } from "./send-day-guard.ts";
import { quizYear } from "./wired-engine.ts";
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
  // A founder test send of one row may re-send an email that already went out (nothing is marked).
  const testOne = !!(o.testTo && one);
  const due = testOne ? "" : `sent_at=is.null&failed_at=is.null&skipped_reason=is.null&scheduled_for=lte.${encodeURIComponent(now)}&retry_count=lt.${MAX_TRIES}&`;
  const rows = await pg<QueueRow[]>(db,
    `wired_email_queue?${one}kind=in.(drip,july)&${due}` +
    `&select=id,family_id,email,child_id,kind,position,retry_count,created_at&order=scheduled_for.asc&limit=${one ? 1 : EMAILS_PER_RUN}`);
  const out = { emails_found: rows?.length ?? 0, sent: 0, skipped: 0, deferred: 0, failed: 0, details: [] as unknown[] };

  for (const row of rows ?? []) {
    // Claim: only one runner wins this try (a founder test of a sent row claims without the sent check).
    const claimed = await pg<QueueRow[]>(db, `wired_email_queue?id=eq.${row.id}&retry_count=eq.${row.retry_count}${testOne ? "" : "&sent_at=is.null"}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ retry_count: row.retry_count + 1 }),
    });
    if (!claimed?.length) continue;
    const putBack = () => pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ retry_count: row.retry_count }) });
    const skip = async (reason: string) => {
      await pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ skipped_reason: reason }) });
      out.skipped++; out.details.push({ id: row.id, skipped: reason });
    };
    if (!(row.kind === "drip" && row.position === 1)) {
      await sendLearner(db, o, row, out, putBack, skip, testOne);
      continue;
    }
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

// ── W8b: learner emails 2-10 + July ─────────────────────────────────────────

const SITE = "https://edeninstitute.health";
/** Her ranking codes in plain words, said back to her (em-7: "You told me what matters most to you right now: ..."). */
const PRIORITY_WORDS: Record<string, (nick: string) => string> = {
  wiring: (n) => `a great fit for how God wired ${n}`,
  budget: () => "staying within your budget",
  prep: () => "open-and-go, with little prep for you",
  siblings: () => "teaching several of your kids together",
};
/** Answer 35: email 9 waits for 3+ real, Camila-approved pilot quotes (and is not queued until then). */
export const PILOT_QUOTES_READY = false;
/** em-4: a REAL Blueprint Math page per top wiring (scripts/wired/render_em4_pages.ts), hosted on the site. Never AI. */
export const EM4_IMAGE = (wiring: string) => `${SITE}/email/wired/blueprint-math-${wiring}.png`;
const gradeWord = (g: number) => (g <= 0 ? "K" : String(g));

type Out = { sent: number; skipped: number; deferred: number; failed: number; details: unknown[] };

export async function buildLearner(db: Db, row: QueueRow, now: Date = new Date()): Promise<{ mail: LearnerEmail } | { skip: string }> {
  if (!row.family_id) return { skip: "no_family" };
  const fam = (await pg<{ first_name: string | null; deleted_at: string | null }[]>(db, `wired_families?id=eq.${row.family_id}&select=first_name,deleted_at&limit=1`))?.[0];
  if (!fam || fam.deleted_at) return { skip: "family_deleted" };
  const token = await signWiredToken({ familyId: row.family_id, purpose: "results" });

  if (row.kind === "july") {
    const kids = await pg<{ id: string; nickname: string; grade: number }[]>(db,
      `wired_children?family_id=eq.${row.family_id}&removed_at=is.null&unlocked_via=not.is.null&select=id,nickname,grade&order=created_at.asc`);
    const thisYear = quizYear(now);
    const children: ChildBits[] = [];
    for (const k of kids ?? []) {
      const last = (await pg<{ quiz_year: number }[]>(db, `wired_results?child_id=eq.${k.id}&select=quiz_year&order=quiz_year.desc&limit=1`))?.[0];
      if (!last || last.quiz_year >= thisYear) continue; // never quizzed, or already retested this quiz year
      const next = k.grade + (thisYear - last.quiz_year);
      if (next > 12) continue; // graduated
      // Follow-up (W4): /wired does not pre-fill the child from the link yet; she enters nickname + grade there,
      // and wired-submit matches the same child by nickname.
      children.push({ nickname: k.nickname, topId: "", nextGrade: gradeWord(next), retakeUrl: `${SITE}/wired` });
    }
    if (!children.length) return { skip: "no_child_due_retest" };
    const key = row.position === 2 ? "em-july15" : "em-july1";
    return { mail: buildJulyEmail(key, { firstName: fam.first_name, child: children[0], children, resultsToken: token }) };
  }

  const pos = row.position ?? 0;
  if (pos === 9 && !PILOT_QUOTES_READY) return { skip: "pilot_quotes_pending" };
  if (pos < 2 || pos > 10) return { skip: "unknown_position" };
  if (!row.child_id) return { skip: "no_child" };
  const kid = (await pg<{ unlocked_via: string | null }[]>(db, `wired_children?id=eq.${row.child_id}&removed_at=is.null&select=unlocked_via&limit=1`))?.[0];
  if (!kid || kid.unlocked_via === null) return { skip: "child_locked_or_removed" };
  if (pos === 4 && (kid.unlocked_via === "blueprint" || kid.unlocked_via === "family_map")) return { skip: "already_has_blueprint" };

  const job: PdfJob = { id: row.id, family_id: row.family_id, child_id: row.child_id, order_id: null, buyer_id: null, kind: "free", quiz_year: 0, attempts: 0, status: "queued" };
  const loaded = await loadBlueprintData(db, job);
  const child = loaded.children[0];
  const topId = child.top3[0];
  const key = `em-${pos}` as Parameters<typeof buildLearnerEmail>[0];
  const input: Parameters<typeof buildLearnerEmail>[1] = {
    firstName: loaded.firstName, resultsToken: token,
    child: { nickname: child.nickname, topId, lowest3: lowest3(child.scores) },
  };
  if (pos === 4) input.blueprintPageImageUrl = EM4_IMAGE(topId);
  if (pos === 6) {
    const mom = (await pg<{ family_answers: { kids?: string } | null }[]>(db,
      `wired_sessions?child_id=eq.${row.child_id}&rater_role=eq.mom&completed_at=not.is.null&select=family_answers&order=completed_at.desc&limit=1`))?.[0];
    input.kids = mom?.family_answers?.kids === "1" ? 1 : 2;
  }
  if (pos === 7) {
    // The top match by her own ranking (loadBlueprintData ranks with her saved priorities and filters).
    const m = child.matches[0];
    if (!m?.link) return { skip: "no_match_with_link" };
    const prefs = (await pg<{ priority_ranking: string[] | null }[]>(db, `wired_family_prefs?family_id=eq.${row.family_id}&select=priority_ranking&limit=1`))?.[0];
    const first = (prefs?.priority_ranking ?? [])[0] ?? "wiring";
    const cur = (await pg<{ mom_pros: string[] | null }[]>(db, `wired_curricula?name=eq.${encodeURIComponent(m.name)}&approved=eq.true&select=mom_pros&limit=1`))?.[0];
    input.match = {
      name: m.name, reason: m.because.join(" · "), line: cur?.mom_pros?.[0] ?? "", url: m.link, isAffiliate: m.isAffiliate,
      priority: (PRIORITY_WORDS[first] ?? PRIORITY_WORDS.wiring)(child.nickname),
    };
  }
  return { mail: buildLearnerEmail(key, input) };
}

async function sendLearner(
  db: Db, o: EmailDrainOptions, row: QueueRow, out: Out,
  putBack: () => Promise<unknown>, skip: (reason: string) => Promise<void>, testOne: boolean,
): Promise<void> {
  let claimed = false;
  try {
    const blocked = await pg<boolean>(db, "rpc/email_send_blocked", {
      method: "POST", body: JSON.stringify({ p_email: row.email, p_list: "learner", p_queued_at: row.created_at }),
    });
    if (blocked === true && !o.testTo) { await skip("suppressed"); return; }
    const built = await buildLearner(db, row);
    if ("skip" in built) {
      if (o.dryRun || o.testTo) { await putBack(); out.details.push({ id: row.id, would_skip: built.skip }); return; }
      await skip(built.skip); return;
    }
    const mail = built.mail;
    if (o.dryRun) {
      await putBack();
      out.details.push({ id: row.id, dry_run: true, kind: row.kind, position: row.position, subject: mail.subject });
      return;
    }
    // One Eden nurture email a day (answer 5). Founder test sends never claim the day.
    if (!o.testTo) {
      const c = await claimSendDay({ url: db.url, key: db.key }, row.email, "wired_email_queue", row.id);
      if (c === "taken") {
        await pg(db, `wired_email_queue?id=eq.${row.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ retry_count: row.retry_count, scheduled_for: nextCentralMorning(new Date()).toISOString() }),
        });
        out.deferred++; out.details.push({ id: row.id, deferred: "already_had_an_eden_email_today" });
        return;
      }
      claimed = c === "claimed";
    }
    const to = o.testTo || row.email;
    const { html, headers: unsubHeaders } = await applyUnsub(mail.html, to, "learner");
    const { html: text } = await applyUnsub(mail.text, to, "learner");
    if (!o.resendKey) throw new Error("RESEND_API_KEY is not set");
    const tag = row.kind === "july" ? `wired_july_${row.position === 2 ? 15 : 1}` : `wired_email_${row.position}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${o.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `wired-email-${o.testTo ? "test-" : ""}${row.id}` },
      body: JSON.stringify({ from: o.from, reply_to: o.replyTo, to: [to], subject: mail.subject, html, text, headers: unsubHeaders, tags: [{ name: "category", value: tag }] }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const sent = await res.json().catch(() => ({})) as { id?: string };
    if (o.testTo) { await putBack(); out.details.push({ id: row.id, test_send: true, subject: mail.subject }); return; }
    claimed = false; // it went out: today stays claimed
    await pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_at: new Date().toISOString(), resend_id: sent.id ?? null }) });
    out.sent++; out.details.push({ id: row.id, sent: true });
  } catch (err) {
    if (claimed) await releaseSendDay({ url: db.url, key: db.key }, row.id);
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 400);
    const final = row.retry_count + 1 >= MAX_TRIES;
    console.error(`wired email ${row.id} (${row.kind} ${row.position}) try ${row.retry_count + 1} failed${final ? " (giving up)" : ""}: ${msg}`);
    out.failed++; out.details.push({ id: row.id, error: msg });
    if (o.dryRun || o.testTo || testOne) { await putBack(); return; }
    if (final) {
      await pg(db, `wired_email_queue?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ failed_at: new Date().toISOString() }) });
      await notifyFounder("A Wired quiz follow-up email did NOT go out", [
        `A learner email (${row.kind} ${row.position}) failed 5 times and was given up.`, "",
        `Queue row: ${row.id}`, `Why: ${msg}`, "", "Nothing else is affected. Ask Claude (Lane 2) to look at it.",
      ].join("\n"));
    }
  }
}
