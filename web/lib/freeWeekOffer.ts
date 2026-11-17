// The free-week offer, placed where readers already are (2026-10-28, analytics and
// search developer prompt, tasks 17-18).
//
// WHY. The three /learn articles that bring the most search visitors had 31 landing
// sessions in October and 0 sign-ups, and the herb pages offered only a "Week 1 is
// free" text link. This puts the sign-up itself on the page: two buttons that open
// the same free-week pop-up as /freebies (WaitlistController + WaitlistModal, with
// FREE_WEEK_MODAL's wording), so a reader signs up without leaving the article, and
// GA reports each sign-up as email_submit with this placement's form_name.
//
// WHERE.
//   learn_mid    after the first section of every /learn article unless its
//                frontmatter says freeWeekOffer: false (remarkFreeWeekOffer,
//                astro.config.mjs; every article since 2026-11-16, was opt-in)
//   learn_end    at the foot of that article (web/pages/learn/[slug].astro)
//   herb         every /herbs/<slug> page, beside the curriculum-week link; the app
//                monograph renders the same offer (src/components/apothecary/FreeWeekOfferCard.tsx)
//   learn_exit   the "before you go" box on a /learn article (web/components/ExitOffer.astro)
//   podcast      a podcast show's short-link page, e.g. /roaming-mama (web/lib/podcastLinks.ts)
//   starter      "Teach Week 1 first" on /starter and /starter/seedlings (one band each,
//                freeWeekButtonHtml)
// form_name = `${placement}_${band}_week1`, e.g. learn_mid_sprouts_week1.
//
// The heading is the developer prompt's own wording; the line under it and the
// button labels are the site's existing free-week copy. Copy rule: no em dashes.

import { FREE_WEEK_MODAL } from "./freeWeekModal";

export type FreeWeekBand = "sprouts" | "seedlings";
export type FreeWeekPlacement = "learn_mid" | "learn_end" | "herb" | "learn_exit" | "podcast" | "starter";

export const FREE_WEEK_OFFER_HEADING = "Free: Week 1 of Eden's Table (Sprouts K-2 or Seedlings 3-5)";
export const FREE_WEEK_OFFER_LINE =
  "Five full lessons, in your inbox in a minute. Print it and teach it the same morning.";
export const FREE_WEEK_BUTTON_LABELS: Record<FreeWeekBand, string> = {
  sprouts: "Get Sprouts (K-2) Week 1 · Free",
  seedlings: "Get Seedlings (3-5) Week 1 · Free",
};
const BANDS: FreeWeekBand[] = ["sprouts", "seedlings"];

/** GA4 form_name for one button of one placement. */
export function freeWeekFormName(placement: FreeWeekPlacement, band: FreeWeekBand): string {
  return `${placement}_${band}_week1`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The offer as static HTML, for Astro pages and the markdown pipeline. Its buttons
 * carry the data-waitlist-* attributes WaitlistController reads, so the page must
 * mount <WaitlistController client:only="react" />. Without JavaScript the
 * /freebies link still works.
 */
/** The data-* attributes of one free-week button: the pop-up wording for that band,
 *  plus this placement's GA4 form_name and data-cta. */
function freeWeekButtonAttrs(placement: FreeWeekPlacement, band: FreeWeekBand): string[] {
  const m = FREE_WEEK_MODAL[band];
  return [
    `type="button"`,
    `data-cta="${placement.replace(/_/g, "-")}-${band}-free"`,
    `data-waitlist-source="${m.source}"`,
    `data-waitlist-form-name="${freeWeekFormName(placement, band)}"`,
    `data-waitlist-title="${esc(m.title)}"`,
    `data-waitlist-subtitle="${esc(m.subtitle)}"`,
    `data-waitlist-submit-label="${esc(m.submitLabel)}"`,
    `data-waitlist-success-message="${esc(m.successMessage)}"`,
    `data-waitlist-success-subtitle="${esc(m.successSubtitle)}"`,
    `data-waitlist-cta-href="/homeschool"`,
    `data-waitlist-cta-label="See the full year"`,
  ];
}

/**
 * One free-week button for one band, for pages that already know the band (the
 * Starter pages). `className`/`style` replace the default forest button look; the
 * label defaults to the offer's own button label.
 */
export function freeWeekButtonHtml(
  placement: FreeWeekPlacement,
  band: FreeWeekBand,
  opts: { label?: string; className?: string; style?: string } = {},
): string {
  const attrs = [
    ...freeWeekButtonAttrs(placement, band),
    `class="${esc(opts.className ?? "font-body text-sm font-semibold rounded-md px-5 py-3 min-h-[48px] w-full sm:w-auto")}"`,
    `style="${esc(opts.style ?? "background-color:hsl(var(--eden-forest));color:hsl(var(--eden-parchment))")}"`,
  ].join(" ");
  return `<button ${attrs}>${esc(opts.label ?? FREE_WEEK_BUTTON_LABELS[band])}</button>`;
}

export function freeWeekOfferHtml(placement: FreeWeekPlacement): string {
  const buttons = BANDS.map((band) => freeWeekButtonHtml(placement, band)).join("");
  return (
    `<aside class="free-week-offer rounded-lg p-6 border" aria-label="Free Week 1 of Eden's Table" ` +
    `style="background-color:hsl(var(--eden-cream));border-color:hsl(var(--eden-gold) / 0.35)">` +
    `<p class="font-serif text-xl font-bold mb-2" style="color:hsl(var(--eden-bark))">${esc(FREE_WEEK_OFFER_HEADING)}</p>` +
    `<p class="font-body text-sm text-muted-foreground leading-relaxed mb-4">${esc(FREE_WEEK_OFFER_LINE)}</p>` +
    `<div class="flex flex-col sm:flex-row gap-3">${buttons}</div>` +
    `<p class="font-body text-xs text-muted-foreground mt-3">Or see both on <a href="/freebies" class="underline" data-cta="${placement.replace(/_/g, "-")}-freebies">the free samples page</a>.</p>` +
    `</aside>`
  );
}

interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MdNode[];
}

/**
 * remark plugin: in every /learn article (unless its frontmatter sets
 * freeWeekOffer: false; opt-in until 2026-11-16), insert the offer right after the first section, i.e. just before the article's
 * second "## " heading. An article with fewer than two such headings gets none
 * here (it still gets the one at its foot).
 */
export function remarkFreeWeekOffer() {
  return (tree: MdNode, file: { data?: { astro?: { frontmatter?: Record<string, unknown> } } }) => {
    // Raw frontmatter, not the zod default, so mirror config.ts: on unless false.
    if (file.data?.astro?.frontmatter?.freeWeekOffer === false) return;
    const children = tree.children ?? [];
    const h2 = children.map((n, i) => (n.type === "heading" && n.depth === 2 ? i : -1)).filter((i) => i >= 0);
    if (h2.length < 2) return;
    children.splice(h2[1], 0, { type: "html", value: freeWeekOfferHtml("learn_mid") });
  };
}
