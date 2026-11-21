// supabase/functions/_shared/wired-pilot-chapters.ts
//
// Fearfully & Wonderfully Wired, W12: the pilot's advance chapters of Unschooled by Design (spec section 13;
// Camila's tap 2026-11-20 "Private Eden storage": private storage with expiring links, the way the Starter Unit
// PDFs are delivered, never public).
//   Chapter 1 unlocks at step 3 (Survey 3), Chapter 4 at step 4 (the 30-day retake + Survey 4).
//   Files live in the PRIVATE bucket `pilot-chapters` (chapter-1.pdf, chapter-4.pdf). A chapter counts as ready
//   only once its file is there, so Chapter 4 starts working the moment its file is uploaded; no code change.
//   Delivery is a PAGE, never a raw file link in an email (memory r_email_pdf_links_blank_screen): the tester
//   page shows a button per unlocked chapter, and each tap signs a fresh 1-hour view link (no download= param).
//   The chapter-ready email links to that page with her results token.
// Copy marked PROPOSED waits on Camila's taps (via Lane NP).

import { type Db, pg } from "./wired-submit-flow.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml, tagEmailText } from "./email-utm.ts";
import { SITE } from "./wired-email-tx.ts";

export const CHAPTER_BUCKET = "pilot-chapters";
export const CHAPTER_LINK_TTL_SECONDS = 3600;
export type ChapterNo = 1 | 4;
export const CHAPTERS: Record<ChapterNo, { path: string; step: "step3_at" | "step4_at"; emailed: "ch1_emailed_at" | "ch4_emailed_at" }> = {
  1: { path: "chapter-1.pdf", step: "step3_at", emailed: "ch1_emailed_at" },
  4: { path: "chapter-4.pdf", step: "step4_at", emailed: "ch4_emailed_at" },
};
const ADDRESS = "Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const INK = "#E8E3DA";

// PROPOSED (C1-C3, E1, E2 in NOTES 2026-11-20): the email side lives here; the page side in web/lib/wiredPilotCopy.ts.
export const CHAPTER_EMAIL: Record<ChapterNo, { subject: string; body: string[]; button: string }> = {
  1: {
    subject: "Your advance chapter of Unschooled by Design",
    body: [
      "Thank you for answering the third survey. Your gift is ready: Chapter 1 of my upcoming book, Unschooled by Design.",
      "[button]",
      "It opens on your tester page. One more chapter unlocks after your 30-day retake.",
    ],
    button: "Read Chapter 1",
  },
  4: {
    subject: "Your last gift: another chapter of Unschooled by Design",
    body: [
      "Thank you for finishing every step of the test. Your last gift is ready: Chapter 4 of Unschooled by Design.",
      "[button]",
    ],
    button: "Read Chapter 4",
  },
};

/** A fresh signed view link for a chapter, or null when its file is not uploaded yet. */
export async function signChapter(db: Db, n: ChapterNo, ttl = CHAPTER_LINK_TTL_SECONDS): Promise<string | null> {
  const res = await fetch(`${db.url}/storage/v1/object/sign/${CHAPTER_BUCKET}/${CHAPTERS[n].path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${db.key}`, apikey: db.key, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: ttl }),
  });
  if (res.status === 400 || res.status === 404) { await res.body?.cancel(); return null; }
  if (!res.ok) throw new Error(`signing ${CHAPTERS[n].path} failed: ${res.status}`);
  const { signedURL } = await res.json() as { signedURL: string };
  return `${db.url}/storage/v1${signedURL}`;
}

interface Progress { family_id: string; step3_at: string | null; step4_at: string | null; ch1_emailed_at?: string | null; ch4_emailed_at?: string | null }

/** The chapters this family has unlocked (step reached) whose files are uploaded. */
export async function availableChapters(db: Db, familyId: string): Promise<ChapterNo[]> {
  const p = (await pg<Progress[]>(db, `wired_pilot_progress?family_id=eq.${familyId}&select=family_id,step3_at,step4_at&limit=1`))?.[0];
  if (!p) return [];
  const out: ChapterNo[] = [];
  for (const n of [1, 4] as ChapterNo[]) {
    if (p[CHAPTERS[n].step] && (await signChapter(db, n, 60))) out.push(n);
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildChapterEmail(n: ChapterNo, firstName: string | null, resultsToken: string): { subject: string; html: string; text: string } {
  const c = CHAPTER_EMAIL[n];
  const page = `${SITE}/wired/pilot?t=${resultsToken}`;
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";
  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(s)}</p>`;
  const button = `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(page)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(c.button)}</a></p>`;
  const foot = `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;padding-top:6px;"><span style="color:${INK};text-decoration:none;">${esc(ADDRESS).replace(/(\d+)/g, "$1&#8203;")}</span></td></tr>`;
  const html = emailShell(
    p(greeting) + c.body.map((s) => (s === "[button]" ? button : p(s))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    foot,
    { shopCard: false },
  );
  // The page link carries her results token (t=), which the UTM tagger leaves alone (TOKEN_PARAMS).
  const tag = { medium: "nurture" as const, campaign: "wired_pilot", content: `chapter_${n}` };
  const text = [greeting, ...c.body.map((s) => (s === "[button]" ? `${c.button}: ${page}` : s)), "Camila", "The Eden Institute", "", ADDRESS].join("\n\n");
  return { subject: c.subject, html: tagEmailHtml(html, tag), text: tagEmailText(text, tag) };
}

/** Chapter-ready emails for testers who reached the step, once per chapter, only once its file is uploaded.
 *  Claim (emailed_at set) -> send (Idempotency-Key per family + chapter) -> on failure the claim is released. */
export async function sendDueChapterEmails(
  db: Db,
  o: { resendKey: string; from: string; replyTo: string; signToken: (familyId: string) => Promise<string>; now?: Date; dryRun?: boolean },
): Promise<Record<string, unknown>> {
  const now = o.now ?? new Date();
  const out = { sent: 0, failed: 0, details: [] as unknown[] };
  for (const n of [1, 4] as ChapterNo[]) {
    const ch = CHAPTERS[n];
    const rows = (await pg<Progress[]>(db, `wired_pilot_progress?${ch.step}=not.is.null&${ch.emailed}=is.null&select=family_id&limit=10`)) ?? [];
    if (!rows.length) continue;
    if (!(await signChapter(db, n, 60))) { out.details.push({ chapter: n, waiting_for_file: rows.length }); continue; }
    for (const r of rows) {
      if (o.dryRun) { out.details.push({ chapter: n, family: r.family_id, dry_run: true }); continue; }
      const claimed = await pg<Progress[]>(db, `wired_pilot_progress?family_id=eq.${r.family_id}&${ch.emailed}=is.null`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ [ch.emailed]: now.toISOString() }),
      });
      if (!claimed?.length) continue;
      const release = () => pg(db, `wired_pilot_progress?family_id=eq.${r.family_id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ [ch.emailed]: null }),
      }).catch(() => {});
      try {
        const fam = (await pg<{ email: string; first_name: string | null }[]>(db, `wired_families?id=eq.${r.family_id}&select=email,first_name&limit=1`))?.[0];
        if (!fam) { out.details.push({ chapter: n, family: r.family_id, skipped: "family_gone" }); continue; }
        if (!o.resendKey) throw new Error("RESEND_API_KEY is not set");
        const mail = buildChapterEmail(n, fam.first_name, await o.signToken(r.family_id));
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${o.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `wired-pilot-chapter-${n}:${r.family_id}` },
          body: JSON.stringify({ from: o.from, reply_to: o.replyTo, to: [fam.email.trim()], subject: mail.subject, html: mail.html, text: mail.text, tags: [{ name: "category", value: `wired_pilot_chapter_${n}` }] }),
        });
        if (!res.ok) { await res.body?.cancel(); await release(); out.failed++; out.details.push({ chapter: n, family: r.family_id, error: res.status }); continue; }
        await res.body?.cancel();
        out.sent++; out.details.push({ chapter: n, family: r.family_id, sent: true });
      } catch (err) {
        await release();
        out.failed++; out.details.push({ chapter: n, family: r.family_id, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
      }
    }
  }
  return out;
}
