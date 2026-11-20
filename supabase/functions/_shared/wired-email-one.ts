// supabase/functions/_shared/wired-email-one.ts
//
// Fearfully & Wonderfully Wired, W8a: learner email 1 ("Results + the free PDF", `em-1`), word for
// word from Camila's approved copy (answer 32, via WIRED_PDF_COPY.emails). It is on the `learner`
// list (own unsubscribe, {{UNSUB_URL}} filled by applyUnsub) and exempt from the one-a-day guard
// (answer 5: results she asked for). The button carries her private results link (?t=token; the
// results page moves it to her device and strips it from the address bar, answer 12).
// Since W9 (2026-11-20) the footer carries the approved "Delete my quiz data" link (/wired/delete) next to
// Unsubscribe. Before W9 it had nowhere to go, so
// the footer keeps the order sentence + Unsubscribe + the business name and address.

import { WIRED_PDF_COPY as COPY, type CopyItem } from "./wired-pdf-content.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml } from "./email-utm.ts";

const KEY = "Results + the free PDF (`em-1`)";
const SITE = "https://edeninstitute.health";
const ADDRESS = "Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const INK = BRAND.footerOnForest;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (s: string, v: Record<string, string>) => s.replace(/\[([^\]]+)\]/g, (m, k) => (k in v ? v[k] : m));

function items(): CopyItem[] {
  const b = COPY.emails[KEY];
  if (!b) throw new Error(`wired email 1 copy missing: ${KEY}`);
  return b;
}
const field = (it: CopyItem[], prefix: string) => {
  const f = it.find((i) => i.s.startsWith(prefix));
  if (!f) throw new Error(`wired email 1: '${prefix}' missing`);
  return f.s.slice(prefix.length).trim();
};

export interface EmailOne { subject: string; preview: string; html: string; text: string; buttonUrl: string }

/** `top3` = the child's top 3 wiring NAMES in order. Leaves {{UNSUB_URL}} for applyUnsub. */
export function buildEmailOne(o: { firstName: string | null; nickname: string; top3: string[]; resultsToken: string }): EmailOne {
  const it = items();
  const v: Record<string, string> = { Nickname: o.nickname, "first name": o.firstName ?? "", A: o.top3[0] ?? "", B: o.top3[1] ?? "", C: o.top3[2] ?? "" };
  const subject = fill(field(it, "Subject:"), v);
  const preview = fill(field(it, "Preview:"), v);
  const [btnLabel, btnTarget] = field(it, "Button:").split(" -> ");
  const utm = btnTarget.slice(btnTarget.indexOf("?") + 1);
  const buttonUrl = `${SITE}/wired/results?t=${encodeURIComponent(o.resultsToken)}&${utm}`;

  const start = it.findIndex((i) => i.s.startsWith("Hi "));
  const end = it.findIndex((i) => i.s === "Camila");
  const body = it.slice(start + 1, end).map((i) => i.s);
  // No first name: the approved observer invite's plain "Hi," (never invent a greeting).
  const greeting = o.firstName ? fill(it[start].s, v) : "Hi,";
  const footerLine = field(it, "Footer:").split(" Unsubscribe from these emails")[0].trim();

  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(s)}</p>`;
  const button = `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(fill(btnLabel, v))}</a></p>`;
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</span>` +
      p(greeting) +
      body.map((s) => (s === "[button]" ? button : p(fill(s, v)))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;">${esc(footerLine)}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;padding-top:6px;">${ADDRESS}</td></tr>
<tr><td style="text-align:center;padding-top:8px;"><a href="{{UNSUB_URL}}" style="font-family:Georgia,serif;font-size:12px;color:${INK};text-decoration:underline;">Unsubscribe from these emails</a> &middot; <a href="https://edeninstitute.health/wired/delete" style="font-family:Georgia,serif;font-size:12px;color:${INK};text-decoration:underline;">Delete my quiz data</a></td></tr>`,
    { shopCard: false },
  );
  const text = [
    greeting,
    ...body.map((s) => (s === "[button]" ? `${fill(btnLabel, v)}: ${buttonUrl}` : fill(s, v))),
    "Camila", "The Eden Institute", "",
    footerLine, ADDRESS.replace("&middot;", "·"), "Unsubscribe from these emails: {{UNSUB_URL}}", "Delete my quiz data: https://edeninstitute.health/wired/delete",
  ].join("\n\n");
  return { subject, preview, html: tagEmailHtml(html, { medium: "nurture", campaign: "learner_quiz", content: "email_1" }), text, buttonUrl };
}
