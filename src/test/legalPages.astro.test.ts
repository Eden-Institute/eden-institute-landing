// /terms, /privacy and /cookies are static Astro pages (founder decision
// 2026-09-15, "Make them static"). Until then they were React components that
// rendered only after JavaScript ran, so a crawler or a no-JS visitor got an
// empty SPA shell. This renders each page through the real layout, the way the
// build does, and pins that the policy text is in the server HTML: the title,
// canonical, dates and every section heading, with the SPA no longer owning
// the routes.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import reactRenderer from "@astrojs/react/server.js";
import { beforeAll, describe, expect, it } from "vitest";
import { FOOTER_LINKS } from "@/lib/navLinks";
import { ROUTES } from "@/lib/routes";

type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];
// Imported through a glob, as the other *.astro.test.ts files do, because the
// app tsconfig has no type declarations for .astro modules.
const pages = import.meta.glob<{ default: RenderableComponent }>(
  ["../../web/pages/terms.astro", "../../web/pages/privacy.astro", "../../web/pages/cookies.astro"],
  { eager: true },
);

const root = join(__dirname, "..", "..");

const CASES = [
  {
    file: "terms.astro",
    path: "/terms",
    title: "Terms and Conditions | The Eden Institute",
    h1: "Terms and Conditions",
    dates: "Effective Date: June 9, 2026 · Last Updated: September 24, 2026",
    headings: [
      "1. Agreement to Terms",
      "2. Definitions",
      "3. Eligibility",
      "4. Account Registration",
      "5. Course Enrollment and Access",
      "6. Pricing and Payment",
      "7. Refund Policy",
      "8. Intellectual Property",
      "9. Permitted Use",
      "10. User Conduct",
      "11. Health and Medical Disclaimer",
      "12. Third-Party Links",
      "13. Limitation of Liability",
      "14. Indemnification",
      "15. Modifications to Terms",
      "16. Termination",
      "17. Privacy",
      "18. Text Message (SMS) Program",
      "19. Governing Law",
      "20. Severability",
      "21. No Waiver",
      "22. Entire Agreement",
      "23. Contact",
    ],
    links: ["/returns", "/privacy", "/cookies", "mailto:hello@edeninstitute.health"],
  },
  {
    file: "privacy.astro",
    path: "/privacy",
    title: "Privacy Policy | The Eden Institute",
    h1: "Privacy Policy",
    dates: "Effective Date: June 9, 2026 · Last Updated: September 24, 2026",
    headings: [
      "1. Introduction",
      "2. Information We Collect",
      "3. How We Use Your Information",
      "4. Email and Text Message Communications",
      "5. How We Share Your Information",
      "6. Data Security",
      "7. Data Retention",
      "8. Your Rights",
      "9. Children&#39;s Privacy",
      "10. Third-Party Links",
      "11. Changes to This Policy",
      "12. Contact",
    ],
    links: ["/cookies", "mailto:hello@edeninstitute.health"],
  },
  {
    file: "cookies.astro",
    path: "/cookies",
    title: "Cookie Policy | The Eden Institute",
    h1: "Cookie Policy",
    dates: "Effective Date: June 9, 2026 · Last Updated: September 15, 2026",
    headings: [
      "1. What Are Cookies",
      "2. How We Use Cookies",
      "3. Your Cookie Choices",
      "4. Third-Party Cookies",
      "5. Changes to This Policy",
      "6. Contact",
    ],
    links: ["mailto:hello@edeninstitute.health"],
  },
];

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, "&");

describe("legal pages render their text server-side", () => {
  const html = new Map<string, string>();

  beforeAll(async () => {
    const container = await AstroContainer.create();
    container.addServerRenderer({ name: "@astrojs/react", renderer: reactRenderer });
    container.addClientRenderer({ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" });
    for (const c of CASES) {
      const mod = pages[`../../web/pages/${c.file}`];
      expect(mod, c.file).toBeTruthy();
      html.set(c.file, await container.renderToString(mod.default));
    }
  }, 60_000);

  for (const c of CASES) {
    describe(c.path, () => {
      it("carries the title, canonical and index robots tag the React page set", () => {
        const page = html.get(c.file) as string;
        expect(page).toContain(`<title>${c.title}</title>`);
        expect(page).toContain(`<link rel="canonical" href="https://edeninstitute.health${c.path}">`);
        expect(page).toContain('<meta name="robots" content="index, follow">');
      });

      it("renders the h1, the dates and every section heading, in order", () => {
        const page = html.get(c.file) as string;
        expect(page).toMatch(new RegExp(`<h1[^>]*>${c.h1}</h1>`));
        expect(page).toContain(c.dates);
        const h2s = [...page.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => decode(m[1]));
        expect(h2s).toEqual(c.headings.map(decode));
      });

      it("links out with plain anchors", () => {
        const page = html.get(c.file) as string;
        for (const href of c.links) expect(page, href).toContain(`href="${href}"`);
      });
    });
  }
});

describe("the SPA no longer owns the legal routes", () => {
  const appSource = readFileSync(join(root, "src", "App.tsx"), "utf8");

  it("has no SPA route or page component for them", () => {
    const spaPaths = Object.values(ROUTES).filter((v) => typeof v === "string");
    for (const path of ["/terms", "/privacy", "/cookies"]) {
      expect(spaPaths, path).not.toContain(path);
      expect(FOOTER_LINKS.find((l) => l.href === path)?.spaRoute, path).toBeFalsy();
    }
    expect(appSource).not.toMatch(/pages\/(Terms|Privacy|Cookies)/);
  });
});
