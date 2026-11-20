// supabase/functions/_shared/wired-delivery-email.ts
//
// Fearfully & Wonderfully Wired, W7: the two purchase delivery emails (`em-blueprint`,
// `em-familymap`), word for word from Camila's approved transactional copy (answer 32, via
// WIRED_PDF_COPY.emails). Transactional: no list, no unsubscribe row, never held by the one-a-day
// guard. Sender "Camila at The Eden Institute", replies to hello@.
//
// Until the delete flow ships (W9) the footer's "Delete my quiz data" link has nowhere to go, so
// the footer line ends at the order sentence; the business name and mailing address row stays.

import { WIRED_PDF_COPY as COPY, type CopyItem } from "./wired-pdf-content.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";
import { tagEmailHtml } from "./email-utm.ts";

export type DeliveryKind = "blueprint" | "family_map";

const KEYS: Record<DeliveryKind, string> = {
  blueprint: "Blueprint delivery (`em-blueprint`)",
  family_map: "Family Map delivery (`em-familymap`)",
};
const SITE = "https://edeninstitute.health";
const ADDRESS = "Rooted in Faith Ventures LLC &middot; 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
// Footer text on the forest band: cream, about 9:1 contrast on #2C3E2D (the old #6B6560 was about 2:1;
// Camila flagged it 11/19). Same color the address row and the order line use.
const FOOTER_INK = "#E8E3DA";
// Mail apps auto-link a street address (bright blue, low contrast). A zero-width space after each
// digit run and inheriting colour in a span stops the detector without changing what she reads.
const ADDRESS_HTML = `<span style="color:${FOOTER_INK};text-decoration:none;">${ADDRESS.replace(/(\d+)/g, "$1&#8203;")}</span>`;

function items(kind: DeliveryKind): CopyItem[] {
  const b = COPY.emails[KEYS[kind]];
  if (!b) throw new Error(`wired delivery email copy missing: ${KEYS[kind]}`);
  return b;
}
const field = (it: CopyItem[], prefix: string) => {
  const f = it.find((i) => i.s.startsWith(prefix));
  if (!f) throw new Error(`wired delivery email: '${prefix}' missing`);
  return f.s.slice(prefix.length).trim();
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\[([^\]]+)\]/g, (m, k) => (k in v ? v[k] : m));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DeliveryEmail { subject: string; preview: string; html: string; text: string; buttonUrl: string }

/**
 * `firstName` null -> "Hi there," is NOT approved copy, so the greeting falls back to the plain
 * "Hi," the approved observer invite uses. `hasOwnAnswers` (Family Map) skips the
 * "one quick step" lines, per the approved note.
 */
export function buildDeliveryEmail(kind: DeliveryKind, o: { firstName: string | null; nickname?: string; hasOwnAnswers?: boolean }): DeliveryEmail {
  const it = items(kind);
  const v: Record<string, string> = { Nickname: o.nickname ?? "", "first name": o.firstName ?? "" };
  const subject = fill(field(it, "Subject:"), v);
  const preview = fill(field(it, "Preview:"), v);
  const btn = field(it, "Button:");
  const [btnLabel, btnTarget] = btn.split(" -> ");
  const query = btnTarget.slice(btnTarget.indexOf("?"));
  const buttonUrl = `${SITE}/wired/results${query}`;

  // Body = the lines between the greeting and the sign-off, in order; [button] marks the button.
  const start = it.findIndex((i) => i.s.startsWith("Hi "));
  const end = it.findIndex((i) => i.s === "Camila");
  let body = it.slice(start + 1, end).map((i) => i.s);
  if (kind === "family_map" && o.hasOwnAnswers) {
    body = body.filter((s) => !/^One quick step:/.test(s) && s !== "[button]" && !/^As soon as you finish/.test(s));
  }
  const greeting = o.firstName ? fill(it[start].s, v) : "Hi,";
  const footerLine = field(it, "Footer:").split(" Delete my quiz data")[0].trim();

  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text ?? "#3D3832"};">${esc(s)}</p>`;
  const button = `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${esc(fill(btnLabel, v))}</a></p>`;
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</span>` +
      p(greeting) +
      body.map((s) => (s === "[button]" ? button : p(fill(s, v)))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${FOOTER_INK};text-align:center;">${esc(footerLine)}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:${FOOTER_INK};text-align:center;padding-top:6px;">${ADDRESS_HTML}</td></tr>`,
    { shopCard: false },
  );
  const text = [greeting, ...body.map((s) => (s === "[button]" ? `${fill(btnLabel, v)}: ${buttonUrl}` : fill(s, v))), "Camila", "The Eden Institute", "", footerLine, ADDRESS.replace("&middot;", "·")].join("\n\n");
  return { subject, preview, html: tagEmailHtml(html, { medium: "nurture", campaign: "learner_quiz" }), text, buttonUrl };
}
