// The site's Google Fonts stylesheet, one URL for every page.
//
// Loaded by a <link rel="stylesheet"> in the <head> (web/layouts/MarketingLayout.astro
// for the Astro pages, and a verbatim copy in index.html for the SPA shell),
// never by an @import inside src/index.css. An @import is only discovered after
// the site's own CSS has downloaded, so the two stylesheets were fetched one
// after the other before anything could paint. As a <link> they download in
// parallel. src/test/fontStylesheet.test.ts fails if index.html drifts from
// this value or an @import comes back.
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Caveat:wght@400;500;600;700&family=Cinzel:wght@400;700&display=swap";
