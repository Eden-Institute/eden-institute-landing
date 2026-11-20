// _shared/advent-email.ts
//
// "Plants of the Nativity" (Advent 2026, Lane SEO batch 5 b5_advent). The confirmation email
// resend-waitlist sends the moment someone signs up with source 'advent_2026'. Founder-approved
// by inbox proof 2026-11-16 ("Yes, approved as is"); advent-email.test.ts checks this renders
// byte for byte the HTML she approved (advent-email.approved.html, rendered with "Camila").
// Do NOT change a word without a new proof.
//
// The four Sunday emails are Resend Broadcasts to audience 'advent_2026' (public.broadcast_audience),
// rendered offline from the same approved drafts; they are not sent from this code.
//
// The helpers below are copied unchanged from list-announce (the template the proofs were
// rendered with), so the confirmation looks exactly like the proof. No em dashes.
import { launchWrapper } from "./launch-sequence-templates.ts";

const SITE = "https://edeninstitute.health";

const BRAND = {
  bgOuter: "#F5F0E8",
  forest: "#2C3E2D",
  text: "#3D3832",
  gold: "#C5A44E",
  sage: "#5C7A5C",
  footerText: "#6B6560",
};

function p(text: string, extra = ""): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:0 0 16px 0;${extra}">${text}</p>`;
}

function preheader(text: string): string {
  return `<div style="display:none;font-size:1px;color:${BRAND.bgOuter};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${text}</div>`;
}

// signoff: "In Him," for a personal letter (the founder's own sign-off, 2026-09-12),
// "Grace and health," to match the automated sequence emails.
function signature(signoff = "Grace and health,"): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${BRAND.text};margin:24px 0 4px 0;">${signoff}</p>
<p style="font-family:Georgia,serif;font-size:16px;color:${BRAND.text};font-weight:bold;margin:0;">Camila</p>
<p style="font-family:Georgia,serif;font-size:14px;color:${BRAND.text};margin:4px 0 0 0;">The Eden Institute</p>
<p style="font-family:Georgia,serif;font-size:14px;margin:4px 0 0 0;"><a href="${SITE}" style="color:${BRAND.sage};text-decoration:underline;">edeninstitute.health</a></p>`;
}

export const ADVENT_SOURCE = "advent_2026";
export const ADVENT_CONFIRM_SUBJECT = "You're in for Plants of the Nativity";

/**
 * Which Sunday a sign-up's first email is. Each Sunday Broadcast goes ONCE (7 PM Central = 01:00 UTC Monday) to the
 * families signed up by then, so a family who joins after a Sunday starts at the next one. Sign-ups up to the first
 * send keep the founder-approved wording byte for byte; later windows use the wording she approved by pick on the
 * Lane SEO review page 2026-11-20 ("Do it").
 */
export const ADVENT_WINDOWS: ReadonlyArray<{ until: string; preheader: string; first: string; closing: string }> = [
  { until: "2026-11-30T01:00:00Z", preheader: "Four Sundays, four plants from the Christmas story. The first one comes Nov 29.",
    first: "The first one comes Sunday, November 29, and it starts with one of the wise men's gifts, frankincense.", closing: "Four Sundays, then Christmas!" },
  { until: "2026-12-07T01:00:00Z", preheader: "Three Sundays, three plants from the Christmas story. Your first one comes Dec 6.",
    first: "Your first one comes Sunday, December 6, and it's myrrh, another of the wise men's gifts.", closing: "Three Sundays, then Christmas!" },
  { until: "2026-12-14T01:00:00Z", preheader: "Two Sundays, two plants from the Christmas story. Your first one comes Dec 13.",
    first: "Your first one comes Sunday, December 13, and it's the terebinth tree.", closing: "Two Sundays, then Christmas!" },
  { until: "2026-12-21T01:00:00Z", preheader: "One more Sunday, one more plant from the Christmas story. It comes Dec 20.",
    first: "Your first one comes Sunday, December 20, and it's saffron.", closing: "One more Sunday, then Christmas!" },
];

export function adventWindow(nowMs: number): (typeof ADVENT_WINDOWS)[number] {
  return ADVENT_WINDOWS.find((w) => nowMs < Date.parse(w.until)) ?? ADVENT_WINDOWS[ADVENT_WINDOWS.length - 1];
}

/** firstName must already be HTML-escaped (resend-waitlist passes firstNameHtml). nowMs defaults to the send moment. */
export function buildAdventConfirmEmail(firstName: string, nowMs: number = Date.now()): { subject: string; html: string } {
  const w = adventWindow(nowMs);
  const body =
    preheader(w.preheader) +
    p(`Hi ${firstName},`) +
    p("You're in! Thank you for signing up.") +
    p(`Every Sunday of Advent, I'll send you one short email about one plant from the Christmas story. ${w.first}`) +
    p("Each email has the Bible verses, where the plant grows, how people gathered it long ago, and one simple thing to do with your kids at the table that week.") +
    p(w.closing) +
    signature("In Him,");
  return { subject: ADVENT_CONFIRM_SUBJECT, html: launchWrapper(body) };
}
