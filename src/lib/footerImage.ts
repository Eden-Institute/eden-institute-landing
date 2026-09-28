// The botanical photo behind the site footer, shared by the Astro footer
// (web/components/Footer.astro) and the SPA footer
// (src/components/landing/Footer.tsx).
//
// It sits at 6% opacity, far below the fold, yet it used to be the heaviest
// file on most pages: one 1920px request of about 1 MB, fetched eagerly while
// the hero was still loading. It now:
//   - loads lazily, so it no longer competes with the top of the page, and
//   - offers the same Unsplash photo, same crop and quality, at four widths, so
//     a phone takes a 640 or 960 px copy instead of the 1920 px one.
// FOOTER_BG_IMG is the exact URL the footer always used and remains the src
// fallback and the largest srcset candidate.
const FOOTER_BG_BASE = "https://images.unsplash.com/photo-1726996155615-e986ed87c9d4?auto=format&fit=crop";

const footerBgUrl = (w: number) => `${FOOTER_BG_BASE}&w=${w}&q=80`;

export const FOOTER_BG_IMG = footerBgUrl(1920);

export const FOOTER_BG_SRCSET = [640, 960, 1280, 1920].map((w) => `${footerBgUrl(w)} ${w}w`).join(", ");

export const FOOTER_BG_SIZES = "100vw";
