// The one list of header and footer links for the whole site.
//
// Two headers and two footers render from this file: web/components/Navbar.astro
// and web/components/Footer.astro on the Astro marketing pages, and
// src/components/landing/Navbar.tsx and src/components/landing/Footer.tsx on the
// SPA routes (/assessment, /results/*, /apothecary/*). They
// used to carry their own hand-typed copies, and the SPA copies drifted: no
// Freebies link, one header button instead of two, and a footer missing Herb
// Profiles and the ESA link. A visitor crossing from a marketing page into the
// app watched the header change under them.
//
// Keep this module free of runtime imports so the Astro frontmatter, the SPA
// bundle and the tests can all read it without pulling anything else in.
//
// spaRoute: the path is a React Router route in src/App.tsx, so the SPA may use
// a router <Link>. Every other internal href is an Astro page (or "/", which
// Astro serves) and the SPA must reach it with a full page load (<a href>).

export interface SiteLink {
  label: string;
  href: string;
  /** Opens in a new tab (off-site). */
  external?: boolean;
  /** A React Router route in the SPA; safe for <Link>. */
  spaRoute?: boolean;
  /** data-cta value for the click beacon, when the link is a measured CTA. */
  cta?: string;
}

export interface SiteButton extends SiteLink {
  background: string;
  color: string;
}

/** Header text links, in display order. */
export const NAV_LINKS: readonly SiteLink[] = [
  { label: "Homeschool Curriculum", href: "/homeschool" },
  // Top of funnel. Sits next to the curriculum link because the freebies ARE Eden's Table
  // sample weeks, and because /homeschool has had no free entry point since #364.
  { label: "Freebies", href: "/freebies" },
  { label: "Adult Courses", href: "/courses" },
  { label: "Herb Reference App", href: "/apothecary", spaRoute: true },
  { label: "Buy the Book", href: "https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20", external: true },
  { label: "Contact", href: "/contact" },
];

/** Header buttons, in display order (desktop row and the end of the mobile menu). */
export const NAV_BUTTONS: readonly SiteButton[] = [
  { label: "Shop Quality Herbs", href: "/homeschool/herbs", background: "#2E3D32", color: "#FAF8F3" },
  {
    label: "Discover your Body Pattern",
    href: "/assessment",
    spaRoute: true,
    // The highest-frequency quiz entry, measured by the [data-cta] beacon (CRO Phase 4).
    cta: "nav-take-quiz",
    background: "#C5A44E",
    color: "#1C3A2E",
  },
];

/** The podcast link (founder, 2026-09-18: "Listen to the Podcast", at the top of the
    site). On wide screens it ends the second header row as a small button in the
    Tales & Table Talk colours (Espresso ground, Linen text, per
    TTT_Brand_Guide_v1_2026-09-13); in the mobile menu it follows the text links,
    before the two buttons. It goes to Camila's own page on this site, not the
    network show page, which talesandtabletalk.com will point to. */
export const NAV_PODCAST: SiteButton = {
  label: "Listen to the Podcast",
  href: "/tales-and-table-talk",
  cta: "nav-podcast",
  background: "#2A231E",
  color: "#F5EDD6",
};

/** Footer policy/utility links, in display order, separated by "|". */
export const FOOTER_LINKS: readonly SiteLink[] = [
  { label: "Why Eden", href: "/why-eden" },
  // Site-wide entry to the public monograph set, so /herbs (and through it every
  // profile) is reachable from anywhere a crawler lands.
  { label: "Herb Profiles", href: "/herbs" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Contact", href: "/contact" },
  // Site-wide entry to /esa. The ESA hub and state pages hide the shared nav and
  // footer on purpose (see web/pages/esa/[state].astro), so this link is how the
  // rest of the site reaches them. The homepage renders its own footer and
  // repeats this link there.
  { label: "ESA & Scholarship Programs", href: "/esa", cta: "footer-esa" },
];
