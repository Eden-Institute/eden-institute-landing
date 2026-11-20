// supabase/functions/_shared/wired-cart-reminder.ts
//
// Fearfully & Wonderfully Wired: the ONE cart reminder for an abandoned wired checkout (spec answers 15, 20-22, 26;
// copy Wired_Quiz_Cart_Reminder.md, APPROVED 2026-11-19 8:47 AM CT, word for word below).
//   - Same consent rule as the store (Stripe opt_in, or the site's one-reminder box when Stripe recorded no choice;
//     an opt_out always wins), same 30-day cooldown across store and wired carts, same suppression.
//   - 50/50 holdout from a hash of the Stripe session id, assigned when the session expires and recorded on the
//     checkout_recoveries row ("arm"), so Lane NP can measure whether the reminder lifts purchases.
//   - Sent about 24 hours after the checkout STARTED (Li, Luo, Lu & Moriguchi 2021, Journal of Marketing 85(4)), not
//     at the 3-hour expiry the store uses. Suppression, cooldown and "already bought" are checked again at send time.
//   - From Camila, one button (Stripe's own recovery link, valid 30 days), list 'cart' unsubscribe, no discount.

import { escapeHtml } from "./html-escape.ts";
import { BRAND, emailShell } from "./nurture-email-templates.ts";

export const WIRED_REMINDER_DELAY_MS = 24 * 3600 * 1000;
export const WIRED_SCHEDULED = "wired_scheduled";
export const WIRED_HOLDOUT = "wired_holdout";

/** "holdout" or "remind", 50/50, stable for a session id (first byte of its SHA-256: even = holdout). */
export async function holdoutArm(sessionId: string): Promise<"holdout" | "remind"> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId)));
  return d[0] % 2 === 0 ? "holdout" : "remind";
}

export type CartKind = "blueprint" | "family_map";
/** Which approved email a cart gets: the Blueprint one for a Blueprint alone, the Family Map one otherwise. */
export function cartKind(product: string): CartKind {
  return product === "blueprint" ? "blueprint" : "family_map";
}

const COPY: Record<CartKind, { subject: string; preview: string; button: string; body: string[] }> = {
  blueprint: {
    subject: "Your Learner Blueprint for [Nickname]",
    preview: "Your cart is saved. Here's what's inside before you decide.",
    button: "Finish [Nickname]'s Blueprint",
    body: [
      "You started [Nickname]'s Learner Blueprint and didn't get to finish. No pressure at all. Your cart is saved, and this link picks up right where you left off:",
      "[button]",
      "In case it helps you decide, here's what's inside:",
      "A subject-by-subject plan built around how God wired [Nickname], starting with their [Top wiring] side. A simple daily rhythm that fits your home. [Nickname]'s growing edges, and how to steward them instead of fixing them. Curriculum matches for each subject. And a page to help you pray for [Nickname].",
      "It's $19, one time. The PDF lands in your inbox a few minutes after you check out, ready to print. Because it's an instant download, all sales are final, so if you have any question first, just reply to this email. It comes straight to me.",
      "This link works for 30 days.",
    ],
  },
  family_map: {
    subject: "Your Family Learning Map",
    preview: "Your cart is saved. Here's what's inside before you decide.",
    button: "Finish my Family Map",
    body: [
      "You started your Family Learning Map and didn't get to finish. No pressure at all. Your cart is saved, and this link picks up right where you left off:",
      "[button]",
      "In case it helps you decide, here's what's inside:",
      "A full Learner Blueprint for each child it covers. Your own teaching wiring. How to teach your kids together, a weekly rhythm for the whole family, and how your children's wirings work with each other.",
      "It's $47 for up to 5 kids, plus $10 for each child after that. The PDFs land in your inbox a few minutes after you check out, ready to print. Because they're instant downloads, all sales are final, so if you have any question first, just reply to this email. It comes straight to me.",
      "This link works for 30 days.",
    ],
  },
};
const FOOTER = "You are receiving this because you started a checkout with us and said yes to emails. Prefer not to get checkout reminders?";
const ADDRESS = "Rooted in Faith Ventures LLC · 303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const INK = "#E8E3DA";

export function buildWiredCartEmail(kind: CartKind, o: { firstName: string | null; nickname: string | null; topWiring: string | null; recoveryUrl: string }): { subject: string; preview: string; html: string; text: string } {
  const c = COPY[kind];
  if (kind === "blueprint" && (!o.nickname || !o.topWiring)) throw new Error("the Blueprint reminder needs the child's nickname and top wiring");
  const v = (s: string) => s.replace(/\[Nickname\]/g, o.nickname ?? "").replace(/\[Top wiring\]/g, o.topWiring ?? "");
  const greeting = o.firstName ? `Hi ${o.firstName},` : "Hi,";
  const p = (s: string) => `<p style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};">${escapeHtml(s)}</p>`;
  const button = `<p style="margin:8px 0 24px 0;text-align:center;"><a href="${escapeHtml(o.recoveryUrl)}" style="display:inline-block;background:#2C3E2D;color:#FFFFFF;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px;">${escapeHtml(v(c.button))}</a></p>`;
  const html = emailShell(
    `<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(c.preview)}</span>` + p(greeting) +
      c.body.map((s) => (s === "[button]" ? button : p(v(s)))).join("") +
      `<p style="margin:24px 0 0 0;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Camila</p>` +
      `<p style="margin:4px 0 0 0;font-family:Georgia,serif;font-size:14px;">The Eden Institute</p>`,
    `<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;">${escapeHtml(FOOTER)} <a href="{{UNSUB_URL}}" style="color:${INK};text-decoration:underline;">Unsubscribe</a>.</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:12px;color:${INK};text-align:center;padding-top:6px;">${escapeHtml(ADDRESS).replace(/(\d+)/g, "$1&#8203;")}</td></tr>`,
    { shopCard: false },
  );
  const text = [greeting, ...c.body.map((s) => (s === "[button]" ? `${v(c.button)}: ${o.recoveryUrl}` : v(s))), "Camila", "The Eden Institute", "",
    `${FOOTER} Unsubscribe: {{UNSUB_URL}}`, ADDRESS].join("\n\n");
  return { subject: v(c.subject), preview: c.preview, html, text };
}
