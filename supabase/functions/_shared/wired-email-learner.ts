// supabase/functions/_shared/wired-email-learner.ts
//
// Fearfully & Wonderfully Wired, W8b: learner emails 2-10 and the July check-ins, word for word from
// Camila's approved copy (spec answer 35; Wired_Quiz_Emails_Learner.md, APPROVED 2026-11-19 4:12 PM CT,
// generated into wired-learner-content.ts). Same shell, sender and footer as email 1 (wired-email-one.ts).
// Fill rules (answer 35):
//   em-2  pastes the approved longer write-up paragraphs ("What you might notice", "How to steward it")
//         for the top wiring.
//   em-4  shows a real Blueprint page (the Math page for the top wiring) as a hosted image; never AI.
//   em-5  names the 3 lowest wirings (lowest first) and the first approved "small taste" for the lowest.
//   em-6  swaps in the approved one-child first paragraph when the family has one child.
//   em-7  = the top match by her own ranking; the button goes to the curriculum's own link, with the
//         approved "Eden earns a commission" label beside it when that link is an affiliate link.
//   em-8  pastes the 3 approved "Ways to serve right now" and the approved prayer for the top wiring.
//   em-9  is never built until 3+ real, Camila-approved pilot quotes exist (the drain skips it).
//   em-10 drops the book-waitlist sentence until Lane 8 supplies a waitlist link.
//   July  one email per family, one button per child (approved PROPOSED note).
// Footer: the approved line, the business name and address, Unsubscribe and (since W9) Delete my quiz data.
// Leaves {{UNSUB_URL}} for applyUnsub (list `learner`).

import { WIRED_PDF_COPY as COPY, type CopyItem } from "./wired-pdf-content.ts";
import { WIRED_LEARNER_COPY } from "./wired-learner-content.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml } from "./email-utm.ts";

const SITE = "https://edeninstitute.health";
const ADDRESS = "Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const INK = BRAND.footerOnForest;

export type LearnerKey = "em-2" | "em-3" | "em-4" | "em-5" | "em-6" | "em-7" | "em-8" | "em-9" | "em-10" | "em-july1" | "em-july15";
/** Queue positions (kind 'drip') for emails 2-10 and their send day after the quiz (answer 35). */
export const DRIP_DAYS: Record<number, number> = { 2: 2, 3: 4, 4: 7, 5: 10, 6: 13, 7: 16, 8: 20, 9: 25, 10: 30 };
export const UTM_CONTENT: Record<LearnerKey, string> = {
  "em-2": "email_2", "em-3": "email_3", "em-4": "email_4", "em-5": "email_5", "em-6": "email_6", "em-7": "email_7",
  "em-8": "email_8", "em-9": "email_9", "em-10": "email_10", "em-july1": "july_1", "em-july15": "july_15",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (s: string, v: Record<string, string>) => s.replace(/\[([^\]\[]+)\]/g, (m, k) => (k in v ? v[k] : m));
/** "a Storyteller" / "an Organizer": the approved "a [Wiring]" reads right for every wiring. */
const article = (s: string) => s.replace(/\ba ([AEIOU])/g, "an $1");

export function learnerCopy(key: LearnerKey): CopyItem[] {
  const k = Object.keys(WIRED_LEARNER_COPY).find((h) => h.endsWith(`(\`${key}\`)`));
  if (!k) throw new Error(`wired learner copy missing: ${key}`);
  return WIRED_LEARNER_COPY[k];
}
const field = (it: CopyItem[], prefix: string) => {
  const f = it.find((i) => i.s.startsWith(prefix));
  if (!f) throw new Error(`wired learner email: '${prefix}' missing`);
  return f.s.slice(prefix.length).trim();
};

const WIRING_TITLE: Record<string, string> = {};
for (const [id, w] of Object.entries(COPY.writeups)) WIRING_TITLE[id] = w.name;
const title = (id: string) => WIRING_TITLE[id] ?? id;

function longer(id: string, lead: string): string {
  const w = COPY.writeups[id];
  const p = w?.longer.find((l) => l.lead.startsWith(lead));
  if (!p) throw new Error(`wired write-up '${lead}' missing for ${id}`);
  return p.text;
}
function bp1(heading: string): CopyItem[] {
  const b = COPY.blueprint1[heading];
  if (!b) throw new Error(`Blueprint block missing: ${heading}`);
  return b;
}
/** The first approved small taste in "When <Wiring> is a growing edge". */
export function firstSmallTaste(id: string): string {
  const b = bp1(`When ${title(id)} is a growing edge`);
  const i = b.findIndex((x) => x.s.startsWith("Small tastes to try"));
  const li = b.slice(i + 1).find((x) => x.t === "li");
  if (!li) throw new Error(`no small taste for ${id}`);
  return li.s;
}
/** The 3 approved "Ways to serve right now" for a wiring. */
export function waysToServe(id: string): string[] {
  const b = bp1(title(id));
  const i = b.findIndex((x) => x.s.startsWith("Ways to serve right now"));
  const lis = b.slice(i + 1).filter((x) => x.t === "li").slice(0, 3).map((x) => x.s);
  if (lis.length !== 3) throw new Error(`ways to serve for ${id}: ${lis.length}`);
  return lis;
}
/** The approved prayer for a wiring (the block's first paragraph). */
export function prayerFor(id: string): string {
  const b = bp1(`For a ${title(id)}`);
  const p = b.find((x) => x.t === "p");
  if (!p) throw new Error(`no prayer for ${id}`);
  return p.s;
}

export interface LearnerEmail { subject: string; preview: string; html: string; text: string; buttonUrls: string[] }
export interface ChildBits { nickname: string; topId: string; lowest3?: string[]; nextGrade?: string; retakeUrl?: string }
export interface LearnerInput {
  firstName: string | null;
  child: ChildBits;
  resultsToken: string;
  kids?: number;                                  // em-6: 1 = the one-child paragraph
  blueprintPageImageUrl?: string;                 // em-4: the real Blueprint Math page for the top wiring
  match?: { name: string; reason: string; line: string; url: string; isAffiliate: boolean; priority: string }; // em-7
  bookWaitlistUrl?: string | null;                // em-10
  children?: ChildBits[];                         // July: every child of the family
}

type Block = { kind: "p"; s: string } | { kind: "list"; items: string[] } | { kind: "button"; label: string; url: string; note?: string } | { kind: "img"; src: string; alt: string };

function render(key: LearnerKey, o: LearnerInput, blocks: Block[], v: Record<string, string>): LearnerEmail {
  const it = learnerCopy(key);
  const subject = article(fill(field(it, "Subject:"), v));
  const preview = article(fill(field(it, "Preview:"), v));
  const footerLine = field(it, "Footer:").split(" Unsubscribe from these emails")[0].trim();
  const greeting = o.firstName ? `Hi ${o.firstName},` : "Hi,";
  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(s)}</p>`;
  const htmlBlocks = blocks.map((b) => {
    if (b.kind === "p") return p(b.s);
    if (b.kind === "list") return `<ul style="margin:0 0 16px 0;padding-left:22px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${b.items.map((x) => `<li style="margin:0 0 6px 0;">${esc(x)}</li>`).join("")}</ul>`;
    if (b.kind === "img") return `<p style="margin:0 0 16px 0;text-align:center;"><img src="${esc(b.src)}" alt="${esc(b.alt)}" width="420" style="max-width:100%;height:auto;border:1px solid #D9D3C7;"></p>`;
    return `<p style="margin:8px 0 ${b.note ? "6" : "24"}px 0;text-align:center;"><a href="${esc(b.url)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(b.label)}</a></p>` +
      (b.note ? `<p style="margin:0 0 24px 0;text-align:center;font-family:Georgia,serif;font-size:12px;color:${BRAND.text};">${esc(b.note)}</p>` : "");
  }).join("");
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</span>` + p(greeting) + htmlBlocks +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;">${esc(footerLine)}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;padding-top:6px;">${ADDRESS}</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:12px;color:${INK};text-decoration:underline;">Unsubscribe from these emails</a> &middot; <a href="https://edeninstitute.health/wired/delete" style="font-family:Georgia,serif;font-size:12px;color:${INK};text-decoration:underline;">Delete my quiz data</a></td></tr>`,
    { shopCard: false },
  );
  const text = [
    greeting,
    ...blocks.map((b) => b.kind === "p" ? b.s : b.kind === "list" ? b.items.map((x) => `- ${x}`).join("\n") : b.kind === "img" ? `(${b.alt})` : `${b.label}: ${b.url}${b.note ? ` (${b.note})` : ""}`),
    "Camila", "The Eden Institute", "",
    footerLine, ADDRESS.replace("&middot;", "·"), "Unsubscribe from these emails: {{UNSUB_URL}}", "Delete my quiz data: https://edeninstitute.health/wired/delete",
  ].join("\n\n");
  const buttonUrls = blocks.filter((b): b is Extract<Block, { kind: "button" }> => b.kind === "button").map((b) => b.url);
  // Eden links carry the learner tags; em-7's curriculum link is someone else's site (no Eden tags, answer 35).
  const tagged = key === "em-7" ? html : tagEmailHtml(html, { medium: "nurture", campaign: "learner_quiz", content: UTM_CONTENT[key] });
  return { subject, preview, html: tagged, text, buttonUrls };
}

function bodyLines(key: LearnerKey): string[] {
  const it = learnerCopy(key);
  const start = it.findIndex((i) => i.s.startsWith("Hi "));
  const end = it.findIndex((i) => i.s === "Camila");
  return it.slice(start + 1, end).map((i) => i.s);
}
function buttonSpec(key: LearnerKey): { label: string; utm: string; path: string } {
  const [label, target] = field(learnerCopy(key), "Button:").split(" -> ");
  const q = target.indexOf("?");
  return { label, utm: q >= 0 ? target.slice(q + 1) : "", path: target.split(" ")[0] };
}
const resultsUrl = (token: string, utm: string) => `${SITE}/wired/results?t=${encodeURIComponent(token)}${utm ? `&${utm}` : ""}`;

/** Build learner email 2-10 for one child (em-9 needs quotes: never built here, see the drain). */
export function buildLearnerEmail(key: Exclude<LearnerKey, "em-9" | "em-july1" | "em-july15">, o: LearnerInput): LearnerEmail {
  const c = o.child;
  const wiring = title(c.topId);
  const v: Record<string, string> = { Nickname: c.nickname, "first name": o.firstName ?? "", Wiring: wiring };
  const blocks: Block[] = [];
  for (const raw of bodyLines(key)) {
    if (raw === "[button]") {
      const btn = buttonSpec(key); // em-3 has no button
      if (key === "em-7") {
        if (!o.match) throw new Error("em-7 needs a match");
        blocks.push({ kind: "button", label: fill(btn.label, { ...v, Curriculum: o.match.name }), url: o.match.url, note: o.match.isAffiliate ? "Eden earns a commission" : undefined });
      } else if (key === "em-10") {
        blocks.push({ kind: "button", label: fill(btn.label, v), url: `${SITE}/wired${btn.utm ? `?${btn.utm}` : ""}` });
      } else {
        blocks.push({ kind: "button", label: fill(btn.label, v), url: resultsUrl(o.resultsToken, btn.utm) });
      }
      continue;
    }
    if (raw.startsWith("[The approved 'What you might notice'")) { blocks.push({ kind: "p", s: fill(longer(c.topId, "What you might notice"), v) }); continue; }
    if (raw.startsWith("[The approved 'How to steward it'")) { blocks.push({ kind: "p", s: fill(longer(c.topId, "How to steward it"), v) }); continue; }
    if (raw.startsWith("[A real page from the Blueprint")) {
      if (!o.blueprintPageImageUrl) throw new Error("em-4 needs the Blueprint page image");
      blocks.push({ kind: "img", src: o.blueprintPageImageUrl, alt: `A page from the Learner Blueprint: the Math page for ${article(`a ${wiring}`)}` });
      continue;
    }
    if (key === "em-5") {
      const low = c.lowest3 ?? [];
      if (low.length !== 3) throw new Error("em-5 needs the 3 lowest wirings");
      if (raw.includes("[X], [Y] and [Z]")) { blocks.push({ kind: "p", s: fill(raw, { ...v, X: title(low[0]), Y: title(low[1]), Z: title(low[2]) }) }); continue; }
      if (raw.startsWith("One small thing to try this week:")) { blocks.push({ kind: "p", s: `One small thing to try this week: ${fill(firstSmallTaste(low[0]), v)}` }); continue; }
    }
    if (key === "em-6" && raw.startsWith("If you're teaching more than one child") && o.kids === 1) {
      const note = learnerCopy("em-6").find((i) => i.s.startsWith("Note: Moms with one child get this first paragraph instead:"));
      const m = note?.s.match(/instead: "(.+)"/);
      if (!m) throw new Error("em-6 one-child paragraph missing");
      blocks.push({ kind: "p", s: fill(m[1], v) });
      continue;
    }
    if (key === "em-7") {
      if (!o.match) throw new Error("em-7 needs a match");
      if (raw.startsWith("You told me what matters most")) { blocks.push({ kind: "p", s: fill(raw, { ...v, "her top priority in plain words": o.match.priority }) }); continue; }
      if (raw.startsWith("[Curriculum name]")) { blocks.push({ kind: "p", s: `${o.match.name}: ${o.match.reason}. ${o.match.line}`.replace(/\.\./g, ".") }); continue; }
    }
    if (key === "em-8" && raw.startsWith("A few ways a [Wiring] can serve right now:")) {
      blocks.push({ kind: "p", s: article(fill("A few ways a [Wiring] can serve right now:", v)) });
      blocks.push({ kind: "list", items: waysToServe(c.topId).map((s) => fill(s, v)) });
      continue;
    }
    if (key === "em-8" && raw.startsWith("And a short prayer you can pray tonight:")) {
      blocks.push({ kind: "p", s: "And a short prayer you can pray tonight:" });
      blocks.push({ kind: "p", s: fill(prayerFor(c.topId), v) });
      continue;
    }
    if (key === "em-10" && raw.includes("[join the book waitlist]")) {
      if (!o.bookWaitlistUrl) continue; // answer 35: dropped until Lane 8 supplies the link
      blocks.push({ kind: "p", s: raw.replace(", [join the book waitlist].", `, join the book waitlist: ${o.bookWaitlistUrl}`) });
      continue;
    }
    const s = article(fill(raw, v));
    if (/\[[^\]]+\]/.test(s)) throw new Error(`${key}: unfilled placeholder in "${s}"`);
    blocks.push({ kind: "p", s });
  }
  return render(key, o, blocks, v);
}

/** July 1 / July 15: one email per family, one button per child (answer 35). Subject names the first child. */
export function buildJulyEmail(key: "em-july1" | "em-july15", o: LearnerInput): LearnerEmail {
  const kids = o.children?.length ? o.children : [o.child];
  const first = kids[0];
  const names = kids.map((k) => k.nickname);
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const v: Record<string, string> = { Nickname: joined, "first name": o.firstName ?? "" };
  const btn = buttonSpec(key);
  const blocks: Block[] = [];
  for (const raw of bodyLines(key)) {
    if (raw === "[button]") {
      for (const k of kids) {
        if (!k.retakeUrl) throw new Error(`${key}: retake link missing for ${k.nickname}`);
        blocks.push({ kind: "button", label: fill(btn.label, { Nickname: k.nickname }), url: `${k.retakeUrl}${k.retakeUrl.includes("?") ? "&" : "?"}${btn.utm}` });
      }
      continue;
    }
    if (raw.includes("grade [n+1]")) {
      for (const k of kids) {
        if (!k.nextGrade) continue;
        blocks.push({ kind: "p", s: fill(raw.replace("[n+1]", k.nextGrade), { ...v, Nickname: k.nickname }) });
      }
      continue;
    }
    const s = fill(raw, v);
    if (/\[[^\]]+\]/.test(s)) throw new Error(`${key}: unfilled placeholder in "${s}"`);
    blocks.push({ kind: "p", s });
  }
  return render(key, { ...o, child: first }, blocks, { ...v, Nickname: kids.length === 1 ? first.nickname : joined });
}
