// "Plants of the Nativity": four opt-in Sunday emails through Advent 2026 (Lane SEO batch 5,
// b5_advent; emails founder-approved by inbox proof 2026-11-16, "Yes, approved as is").
//
// The sign-up opens the shared WaitlistModal with source 'advent_2026'. resend-waitlist then
// (1) records the opt-in in public.seasonal_optins and (2) sends the approved "You're in" note
// (_shared/advent-email.ts). The four Sundays (Nov 29, Dec 6, 13, 20, 7 PM CT) are Resend
// Broadcasts to audience 'advent_2026'. Like every list sign-up, they also join the Friday list.
//
// WHERE: every /herbs/<slug> page (above the bottom band), the foot of every /learn article that
// mounts the pop-up, and /advent (the page the Friday emails link to). The box hides itself from
// ADVENT_HIDE_FROM (web/components/AdventOffer.astro), when the last Sunday email goes out.
// Heading, line and button are the founder-reviewed box copy. No em dashes.

export type AdventPlacement = "herb" | "learn_end" | "advent_page";

export const ADVENT_SOURCE = "advent_2026";
export const ADVENT_HEADING = "Plants of the Nativity, four Advent Sundays";
export const ADVENT_LINE =
  "Four short Sunday emails through Advent, each one teaching a plant from the Christmas story. We start with frankincense on Nov 29.";
export const ADVENT_BUTTON = "Count me in";
/** The last Sunday email goes at this moment; the sign-up hides itself from then on. */
export const ADVENT_HIDE_FROM = "2026-12-20T19:00:00-06:00";

/** The pop-up wording WaitlistController reads. */
export const ADVENT_ATTRS = {
  "data-waitlist-source": ADVENT_SOURCE,
  "data-waitlist-title": "Plants of the Nativity",
  "data-waitlist-subtitle": ADVENT_LINE,
  "data-waitlist-submit-label": ADVENT_BUTTON,
  "data-waitlist-success-message": "You're in!",
  "data-waitlist-success-subtitle":
    "Check your inbox for a short note from Camila. The first plant comes Sunday, November 29.",
} as const;

export function adventFormName(placement: AdventPlacement): string {
  return `${placement}_advent`;
}

export function adventCta(placement: AdventPlacement): string {
  return `${placement.replace(/_/g, "-")}-advent`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The box as static HTML. The page must mount <WaitlistController client:only="react" />. */
export function adventOfferHtml(placement: AdventPlacement): string {
  const attrs = [
    `type="button"`,
    `data-cta="${adventCta(placement)}"`,
    `data-waitlist-form-name="${adventFormName(placement)}"`,
    ...Object.entries(ADVENT_ATTRS).map(([k, v]) => `${k}="${esc(v)}"`),
    `class="font-body text-sm font-semibold rounded-md px-5 py-3 min-h-[48px] w-full sm:w-auto"`,
    `style="background-color:hsl(var(--eden-forest));color:hsl(var(--eden-parchment))"`,
  ].join(" ");
  return (
    `<aside class="advent-offer rounded-lg p-6 border" data-advent-until="${ADVENT_HIDE_FROM}" aria-label="Plants of the Nativity, Advent emails" ` +
    `style="background-color:hsl(var(--eden-cream));border-color:hsl(var(--eden-gold) / 0.35)">` +
    `<p class="font-serif text-xl font-bold mb-2" style="color:hsl(var(--eden-bark))">${esc(ADVENT_HEADING)}</p>` +
    `<p class="font-body text-sm text-muted-foreground leading-relaxed mb-4">${esc(ADVENT_LINE)}</p>` +
    `<button ${attrs}>${esc(ADVENT_BUTTON)}</button>` +
    `</aside>`
  );
}
