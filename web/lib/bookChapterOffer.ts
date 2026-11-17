// Back to Eden's free Chapter 1, offered where adult readers already are (2026-11-16,
// Lane SEO funnel fix, Camila's go: "Yes, let's do all of it").
//
// WHY. In the 30 days to 2026-11-16 the plant pages (/herbs/<slug> and the app's
// /apothecary/<herb>) had 1,043 landing visitors and 0 email sign-ups, and the only
// offer on them was Week 1 of the K-5 curriculum. Search sends adults who are looking
// up one plant (damiana, wormwood, gotu kola), so they now get an offer made for
// grown-ups too: the free first chapter of Camila's book. The Chapter 1 email track
// asks "Do you have children at home?" on day 2 (children_at_home_answers), which is
// how a parent among them still reaches the curriculum.
//
// WHERE.
//   herb        every /herbs/<slug> page, high on the page, before the free week
//   learn_end   the foot of a /learn article whose frontmatter says bookOffer: true
//   monograph   the app monograph (src/components/apothecary/BookChapterOfferCard.tsx)
//   herb_exit   the "before you go" box on a /herbs/<slug> page (web/components/ExitOffer.astro)
//   learn_exit  the same box on a faith /learn article (bookOffer: true)
//   podcast     a podcast show's short-link page, e.g. /roaming-mama (web/lib/podcastLinks.ts)
// form_name = `${placement}_bte_ch1`, data-cta = `${placement}-bte-ch1`.
//
// COPY. Nothing here is new wording. The heading and button are the /back-to-eden
// page's own "Read Chapter 1 free"; the line is that page's meta description; the
// pop-up wording is BACK_TO_EDEN_CH1_ATTRS, moved here unchanged from
// web/pages/back-to-eden.astro so the two can never drift. No em dashes.

export type BookOfferPlacement = "herb" | "learn_end" | "monograph" | "herb_exit" | "learn_exit" | "podcast";

/** The pop-up wording, exactly as the /back-to-eden hero button has used it since
 *  2026-09-25. WaitlistController reads these attributes; the app card passes the
 *  same values to WaitlistModal as props. */
export const BACK_TO_EDEN_CH1_ATTRS = {
  "data-waitlist-source": "back_to_eden_ch1",
  "data-waitlist-title": "Read Chapter 1 free",
  "data-waitlist-subtitle":
    "Check your inbox. Chapter 1 of Back to Eden, The Life Force Has a Name, is on its way now, with the Reflect & Apply questions at the end.",
  "data-waitlist-cta-href": "https://edeninstitute.health/back-to-eden#editions",
  "data-waitlist-cta-label": "See the three editions",
  "data-waitlist-cta-blurb":
    "While you wait: the whole book comes as a paperback, a spiral Study & Journal Edition, or a Study Guide, in print or as a download.",
} as const;

export const BOOK_OFFER_HEADING = "Free: Chapter 1 of Back to Eden";
export const BOOK_OFFER_LINE =
  "The book behind everything The Eden Institute teaches. Learn the framework that makes every herb make sense: symptoms as signals, the five tenets, constitution, and reading the whole plant.";
export const BOOK_OFFER_BUTTON = "Read Chapter 1 free";

/** GA4 form_name for one placement. */
export function bookOfferFormName(placement: BookOfferPlacement): string {
  return `${placement}_bte_ch1`;
}

/** data-cta for one placement's button (and `${…}-page` for its book-page link). */
export function bookOfferCta(placement: BookOfferPlacement): string {
  return `${placement.replace(/_/g, "-")}-bte-ch1`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The offer as static HTML for Astro pages. Its button carries the data-waitlist-*
 * attributes WaitlistController reads, so the page must mount
 * <WaitlistController client:only="react" />. Without JavaScript the link to the
 * book page still works.
 */
export function bookChapterOfferHtml(placement: Exclude<BookOfferPlacement, "monograph">): string {
  const attrs = [
    `type="button"`,
    `data-cta="${bookOfferCta(placement)}"`,
    `data-waitlist-form-name="${bookOfferFormName(placement)}"`,
    ...Object.entries(BACK_TO_EDEN_CH1_ATTRS).map(([k, v]) => `${k}="${esc(v)}"`),
    `class="font-body text-sm font-semibold rounded-md px-5 py-3 min-h-[48px] w-full sm:w-auto"`,
    `style="background-color:hsl(var(--eden-forest));color:hsl(var(--eden-parchment))"`,
  ].join(" ");
  return (
    `<aside class="book-chapter-offer rounded-lg p-6 border" aria-label="Free Chapter 1 of Back to Eden" ` +
    `style="background-color:hsl(var(--eden-cream));border-color:hsl(var(--eden-gold) / 0.35)">` +
    `<p class="font-serif text-xl font-bold mb-2" style="color:hsl(var(--eden-bark))">${esc(BOOK_OFFER_HEADING)}</p>` +
    `<p class="font-body text-sm text-muted-foreground leading-relaxed mb-4">${esc(BOOK_OFFER_LINE)}</p>` +
    `<div class="flex flex-col sm:flex-row gap-3"><button ${attrs}>${esc(BOOK_OFFER_BUTTON)}</button></div>` +
    `<p class="font-body text-xs text-muted-foreground mt-3">Or see <a href="/back-to-eden" class="underline" data-cta="${bookOfferCta(placement)}-page">the book</a>.</p>` +
    `</aside>`
  );
}
