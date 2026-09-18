// The Astro header and footer render every entry of src/lib/navLinks.ts, in
// order. The SPA half is navLinks.test.tsx.

import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import { FOOTER_LINKS, NAV_BUTTONS, NAV_LINKS, NAV_PODCAST, type SiteLink } from "@/lib/navLinks";

type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];
// Imported through a glob, as privatePagesNoTags.astro.test.ts does, because the
// app tsconfig has no type declarations for .astro modules.
const components = import.meta.glob<{ default: RenderableComponent }>(
  ["../../web/components/Navbar.astro", "../../web/components/Footer.astro"],
  { eager: true },
);
const Navbar = components["../../web/components/Navbar.astro"].default;
const Footer = components["../../web/components/Footer.astro"].default;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;");

function hrefsInOrder(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

function expectInOrder(html: string, links: readonly SiteLink[]) {
  const hrefs = hrefsInOrder(html);
  let from = 0;
  for (const link of links) {
    const i = hrefs.indexOf(link.href, from);
    expect(i, `${link.href} at or after position ${from}`).toBeGreaterThanOrEqual(0);
    from = i + 1;
    expect(html).toContain(`>${escapeHtml(link.label)}</a>`);
  }
}

describe("Astro header and footer render the shared list", () => {
  let container: AstroContainer;
  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it("Navbar.astro renders every link, both buttons and the podcast link, desktop and mobile", async () => {
    const html = await container.renderToString(Navbar);
    const [desktop, mobile] = html.split('id="eden-nav-mobile"');
    expect(mobile).toBeTruthy();
    // Wide screens: row one carries the buttons, row two the links then the podcast.
    expectInOrder(desktop, [...NAV_BUTTONS, ...NAV_LINKS, NAV_PODCAST]);
    // Mobile menu: the links, the podcast, then the buttons.
    expectInOrder(mobile, [...NAV_LINKS, NAV_PODCAST, ...NAV_BUTTONS]);
    expect(html).toContain('data-cta="nav-take-quiz"');
    expect(html).toContain('data-cta="nav-podcast"');
  });

  it("Footer.astro renders every footer link", async () => {
    const html = await container.renderToString(Footer);
    expectInOrder(html, FOOTER_LINKS);
    expect(html).toContain('data-cta="footer-esa"');
  });
});
