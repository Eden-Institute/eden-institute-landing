// supabase/functions/_shared/wired-email-tx.ts
//
// Fearfully & Wonderfully Wired, W9: the must-send emails, word for word from Camila's approved copy
// (spec answer 32; Wired_Quiz_Emails_Transactional.md, APPROVED 2026-11-19 2:44 PM CT, generated into
// WIRED_PDF_COPY.emails):
//   em-obs-invite, em-obs-reminder  -> the person mom invited (never on any list; no unsubscribe row)
//   em-teen, em-update              -> mom (em-teen carries the learner unsubscribe, as its footer says)
//   em-delete-confirm, em-delete-done -> the address that asked
// Never held by the one-a-day guard. [Mom] = her first name, else "[Nickname]'s mom"; [Role] = the label
// she gave the observer, never a name or email (answer 32). Leaves {{UNSUB_URL}} for applyUnsub (em-teen).

import { WIRED_PDF_COPY as COPY, type CopyItem } from "./wired-pdf-content.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml } from "./email-utm.ts";

export type TxKey = "em-obs-invite" | "em-obs-reminder" | "em-teen" | "em-update" | "em-delete-confirm" | "em-delete-done";

export const SITE = "https://edeninstitute.health";
export const DELETE_PAGE = `${SITE}/wired/delete`;
const ADDRESS = "Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const INK = "#E8E3DA";
const UTM_CONTENT: Record<TxKey, string> = {
  "em-obs-invite": "observer_invite", "em-obs-reminder": "observer_reminder", "em-teen": "teen_answered",
  "em-update": "pdf_update", "em-delete-confirm": "delete_confirm", "em-delete-done": "delete_done",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (s: string, v: Record<string, string>) => s.replace(/\[([^\]\[]+)\]/g, (m, k) => (k in v ? v[k] : m));
// A street address auto-links in mail apps; a zero-width space after each digit run stops that.
const addressHtml = () => `<span style="color:${INK};text-decoration:none;">${esc(ADDRESS).replace(/(\d+)/g, "$1&#8203;")}</span>`;

export function txCopy(key: TxKey): CopyItem[] {
  const k = Object.keys(COPY.emails).find((h) => h.endsWith(`(\`${key}\`)`));
  if (!k) throw new Error(`wired email copy missing: ${key}`);
  return COPY.emails[k];
}
const field = (it: CopyItem[], prefix: string): string | null => {
  const f = it.find((i) => i.s.startsWith(prefix));
  return f ? f.s.slice(prefix.length).trim() : null;
};

export interface TxInput {
  firstName?: string | null;   // mom's first name
  nickname?: string;
  role?: string;               // observer label
  buttonUrl?: string;          // the private link (observer, results, delete confirm); the copy's UTM query is added
  pilot?: boolean;             // a pilot tester's family: the approved pilot footer (em-update only has one)
}
export interface TxEmail { subject: string; preview: string; html: string; text: string; buttonUrl: string | null; unsubscribe: boolean }

/** The footer, rendered from the approved line: one row per " · " part, the address placeholder filled,
 *  and "Unsubscribe from these emails" / "Delete my quiz data" turned into links wherever they appear. */
function footer(line: string): { html: string; text: string; unsubscribe: boolean } {
  const ADDR = /\[business name and mailing address[^\]]*\]/;
  const MARK = "@@ADDRESS@@";
  const UNSUB = "Unsubscribe from these emails";
  const DEL = "Delete my quiz data";
  const unsubscribe = line.includes(UNSUB);
  const rows = line.split(" · ").map((x) => x.trim()).filter(Boolean);
  const html = rows.map((part) => {
    let h = esc(part.replace(ADDR, MARK));
    h = h.replace(UNSUB, `<a href="{{UNSUB_URL}}" style="color:${INK};text-decoration:underline;">${UNSUB}</a>`);
    h = h.replace(DEL, `<a href="${DELETE_PAGE}" style="color:${INK};text-decoration:underline;">${DEL}</a>`);
    h = h.replace(MARK, addressHtml());
    return `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;padding-top:6px;">${h}</td></tr>`;
  }).join("\n");
  const text = rows.map((part) => part.replace(ADDR, ADDRESS).replace(UNSUB, `${UNSUB}: {{UNSUB_URL}}`).replace(DEL, `${DEL}: ${DELETE_PAGE}`)).join("\n");
  return { html, text, unsubscribe };
}

/** A filled line that now starts with a lower-case label ("a grandparent just shared...") gets a capital. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const DELETE_PART = " Delete my quiz data";

/**
 * The approved pilot wording for an email (Camila, 2026-11-21 ~8:58 AM CT, "Use as written"), read from that
 * email's own "Pilot version" note in the approved copy, word for word: `firstLine` (em-blueprint, em-familymap;
 * null when the note changes only the footer) and the footer sentence ("You're getting this because you're
 * testing the Fearfully & Wonderfully Wired quiz."). Throws when the email has no approved pilot version, so a
 * pilot send never falls back to wording nobody approved.
 */
export function pilotVersion(items: CopyItem[], name: string): { firstLine: string | null; footerSentence: string } {
  const note = items.find((i) => i.t === "li" && i.s.startsWith("Pilot version"));
  if (!note) throw new Error(`${name}: no approved pilot version`);
  const firstLine = note.s.match(/the first line is "([^"]+)"/)?.[1] ?? null;
  const footer = note.s.match(/the footer is "([^"]+)"/)?.[1] ?? note.s.match(/the pilot footer \("([^"]+)"\)/)?.[1];
  if (!footer) throw new Error(`${name}: the pilot footer is missing from its note`);
  return { firstLine, footerSentence: footer.split(DELETE_PART)[0].trim() };
}

/** The paid footer line with its first sentence swapped for the pilot sentence; the rest of the line is unchanged. */
export function pilotFooterLine(paidLine: string, pilotSentence: string): string {
  const at = paidLine.indexOf(DELETE_PART);
  if (at < 0) throw new Error(`pilot footer: the approved footer has no '${DELETE_PART.trim()}' part`);
  return pilotSentence + paidLine.slice(at);
}

export function buildTxEmail(key: TxKey, o: TxInput): TxEmail {
  const it = txCopy(key);
  const nick = o.nickname ?? "";
  const mom = o.firstName ? o.firstName : `${nick}'s mom`;
  const v: Record<string, string> = { Nickname: nick, Mom: mom, Role: o.role ?? "someone you invited", "first name": o.firstName ?? "" };
  const subject = cap(fill(field(it, "Subject:") ?? "", v));
  const preview = cap(fill(field(it, "Preview:") ?? "", v));
  const btnLine = field(it, "Button:");
  let buttonUrl: string | null = null;
  let btnLabel = "";
  if (btnLine) {
    const [label, target] = btnLine.split(" -> ");
    btnLabel = fill(label, v);
    const q = target.indexOf("?");
    if (!o.buttonUrl) throw new Error(`${key} needs its private link`);
    buttonUrl = `${o.buttonUrl}${q >= 0 ? `${o.buttonUrl.includes("?") ? "&" : "?"}${target.slice(q + 1)}` : ""}`;
  }
  const start = it.findIndex((i) => i.s.startsWith("Hi"));
  const end = it.findIndex((i) => i.s === "Camila");
  const greetingRaw = it[start].s;
  const greeting = greetingRaw.includes("[first name]") ? (o.firstName ? fill(greetingRaw, v) : "Hi,") : greetingRaw;
  const body = it.slice(start + 1, end).map((i) => i.s);
  for (const s of body) {
    if (s !== "[button]" && /\[[^\]]+\]/.test(fill(s, v))) throw new Error(`${key}: unfilled placeholder in "${s}"`);
  }
  const paidFooter = field(it, "Footer:") ?? "[business name and mailing address]";
  const footerLine = o.pilot ? pilotFooterLine(paidFooter, pilotVersion(it, key).footerSentence) : paidFooter;
  const foot = footer(fill(footerLine, { Mom: mom }));

  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(s)}</p>`;
  const button = buttonUrl
    ? `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(btnLabel)}</a></p>`
    : "";
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</span>` + p(greeting) +
      body.map((s) => (s === "[button]" ? button : p(cap(fill(s, v))))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    foot.html,
    { shopCard: false },
  );
  const text = [greeting, ...body.map((s) => (s === "[button]" ? `${btnLabel}: ${buttonUrl}` : cap(fill(s, v)))), "Camila", "The Eden Institute", "", foot.text].join("\n\n");
  return { subject, preview, html: tagEmailHtml(html, { medium: "nurture", campaign: "learner_quiz", content: UTM_CONTENT[key] }), text, buttonUrl, unsubscribe: foot.unsubscribe };
}
