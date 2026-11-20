// supabase/functions/_shared/wired-pilot-email.ts
//
// Fearfully & Wonderfully Wired, W12: the two pilot selection emails, word for word from Camila's approved copy
// (Wired_Quiz_Pilot_Pieces.md section 5, APPROVED 2026-11-20 ~5:44 PM CT, "Use both as written"; snapshot in
// docs/wired-copy/Wired_Quiz_Pilot_Pieces.md):
//   selected -> "You're in! Testing Fearfully & Wonderfully Wired"   (button: Start the quiz -> /wired)
//   declined -> "Thank you for applying to test the Wired quiz"
// One email per application, ever. Sent by wired-pdf (every 5 minutes) once her choice has stood for
// UNDO_MINUTES, so a mis-tap on the founder page can be put back to "applied" before anything goes out.
// Never on any list: no unsubscribe row, and a declined applicant is never added anywhere (the application
// promises her answers are used only to choose the group and run the test). DARK: wired-pdf calls this only
// while WIRED_PILOT_OPEN is "true".

import { type Db, pg } from "./wired-submit-flow.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml, tagEmailText } from "./email-utm.ts";
import { SITE } from "./wired-email-tx.ts";

export const UNDO_MINUTES = 15;
export type SelectionKind = "selected" | "declined";
const ADDRESS = "Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const INK = "#E8E3DA";

interface Copy { subject: string; body: string[]; button?: { label: string; url: string } }
export const SELECTION_COPY: Record<SelectionKind, Copy> = {
  selected: {
    subject: "You're in! Testing Fearfully & Wonderfully Wired",
    body: [
      "You're in! Thank you for raising your hand to test Fearfully & Wonderfully Wired before it opens to everyone.",
      "Here's how the next month works: take the quiz, answer 4 short surveys (a few minutes each), and retake the quiz once after 30 days. Each step unlocks the next gift: your child's full results and the Learner Blueprint, then the Family Learning Map, then two advance chapters of my upcoming book, Unschooled by Design.",
      "[button]",
      "If anything is confusing or not working, just reply to this email. I read every one.",
    ],
    button: { label: "Start the quiz", url: `${SITE}/wired` },
  },
  declined: {
    subject: "Thank you for applying to test the Wired quiz",
    body: [
      "Thank you so much for applying to test Fearfully & Wonderfully Wired. So many families said yes that we couldn't fit everyone this round. We picked about 10 to 12 families for each grade group so every age is covered.",
      "You can still take the free quiz when it opens to everyone.",
      "Thank you for wanting to help. It means more than you know.",
    ],
  },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildSelectionEmail(kind: SelectionKind, firstName: string | null): { subject: string; html: string; text: string } {
  const c = SELECTION_COPY[kind];
  const name = firstName?.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(s)}</p>`;
  const button = c.button
    ? `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(c.button.url)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(c.button.label)}</a></p>`
    : "";
  const foot = `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;padding-top:6px;"><span style="color:${INK};text-decoration:none;">${esc(ADDRESS).replace(/(\d+)/g, "$1&#8203;")}</span></td></tr>`;
  const html = emailShell(
    p(greeting) + c.body.map((s) => (s === "[button]" ? button : p(s))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    foot,
    { shopCard: false },
  );
  const tag = { medium: "nurture" as const, campaign: "wired_pilot", content: kind === "selected" ? "pilot_selected" : "pilot_declined" };
  const text = [greeting, ...c.body.map((s) => (s === "[button]" ? `${c.button!.label}: ${c.button!.url}` : s)), "Camila", "The Eden Institute", "", ADDRESS].join("\n\n");
  return { subject: c.subject, html: tagEmailHtml(html, tag), text: tagEmailText(text, tag) };
}

interface Row { id: string; email: string; first_name: string | null; status: string; decided_at: string }

/** Sends the selection emails whose choice has stood for UNDO_MINUTES. Claim -> send (Idempotency-Key per
 *  application) -> mark; a failed send releases the claim so the next run tries again (the key makes that safe). */
export async function sendDuePilotSelectionEmails(db: Db, o: { resendKey: string; from: string; replyTo: string; now?: Date; dryRun?: boolean }): Promise<Record<string, unknown>> {
  const now = o.now ?? new Date();
  const cutoff = encodeURIComponent(new Date(now.getTime() - UNDO_MINUTES * 60_000).toISOString());
  const rows = (await pg<Row[]>(db,
    `wired_pilot_applications?status=in.(selected,declined)&selection_email_kind=is.null&decided_at=lte.${cutoff}&select=id,email,first_name,status,decided_at&order=decided_at.asc&limit=10`)) ?? [];
  const out = { due: rows.length, sent: 0, failed: 0, details: [] as unknown[] };
  for (const r of rows) {
    const kind = r.status as SelectionKind;
    if (o.dryRun) { out.details.push({ application: r.id, kind, dry_run: true }); continue; }
    // Claim: only while her choice still stands and no email has been claimed for this application.
    const claimed = await pg<Row[]>(db,
      `wired_pilot_applications?id=eq.${r.id}&status=eq.${kind}&selection_email_kind=is.null&decided_at=lte.${cutoff}`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ selection_email_kind: kind }),
      });
    if (!claimed?.length) continue;
    const release = () => pg(db, `wired_pilot_applications?id=eq.${r.id}&selection_email_at=is.null`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ selection_email_kind: null }),
    }).catch(() => {});
    try {
      if (!o.resendKey) throw new Error("RESEND_API_KEY is not set");
      const mail = buildSelectionEmail(kind, r.first_name);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${o.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `wired-pilot-selection:${r.id}` },
        body: JSON.stringify({ from: o.from, reply_to: o.replyTo, to: [r.email.trim()], subject: mail.subject, html: mail.html, text: mail.text, tags: [{ name: "category", value: `wired_pilot_${kind}` }] }),
      });
      const body = await res.json().catch(() => ({})) as { id?: string; message?: string };
      if (!res.ok) { await release(); out.failed++; out.details.push({ application: r.id, error: `${res.status} ${body.message ?? ""}`.trim() }); continue; }
      await pg(db, `wired_pilot_applications?id=eq.${r.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ selection_email_at: now.toISOString(), selection_email_id: body.id ?? null }),
      });
      out.sent++; out.details.push({ application: r.id, kind, sent: true });
    } catch (err) {
      await release();
      out.failed++; out.details.push({ application: r.id, error: (err instanceof Error ? err.message : String(err)).slice(0, 300) });
    }
  }
  return out;
}
