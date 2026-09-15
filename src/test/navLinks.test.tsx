// One header and footer link list for both rendering paths.
//
// src/lib/navLinks.ts is the only place the header links, the two header
// buttons and the footer policy links are written down. The SPA header and
// footer (this file) and the Astro header and footer
// (navLinksAstro.astro.test.ts) must render every entry, so the two can never
// drift apart again the way they did (the SPA header had no Freebies link and
// one button; the SPA footer had no Herb Profiles or ESA link).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { FOOTER_LINKS, NAV_BUTTONS, NAV_LINKS, type SiteLink } from "@/lib/navLinks";
import { ROUTES } from "@/lib/routes";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const root = join(__dirname, "..", "..");
const source = (p: string) => readFileSync(join(root, p), "utf8");

describe("src/lib/navLinks.ts", () => {
  it("holds the header links the Astro header carried on 2026-09-15", () => {
    expect(NAV_LINKS.map((l) => [l.label, l.href])).toEqual([
      ["Homeschool Curriculum", "/homeschool"],
      ["Freebies", "/freebies"],
      ["Adult Courses", "/courses"],
      ["Herb Reference App", "/apothecary"],
      ["Buy the Book", "https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20"],
      ["Contact", "/contact"],
    ]);
  });

  it("holds the two header buttons", () => {
    expect(NAV_BUTTONS.map((b) => [b.label, b.href, b.cta])).toEqual([
      ["Shop Quality Herbs", "/homeschool/herbs", undefined],
      ["Discover your Body Pattern", "/assessment", "nav-take-quiz"],
    ]);
  });

  it("holds the footer links", () => {
    expect(FOOTER_LINKS.map((l) => l.href)).toEqual([
      "/why-eden",
      "/herbs",
      "/terms",
      "/privacy",
      "/cookies",
      "/returns",
      "/contact",
      "/esa",
    ]);
  });

  it("marks only real SPA routes as router links", () => {
    const spaRoutes = new Set<unknown>(Object.values(ROUTES).filter((v) => typeof v === "string"));
    const all = [...NAV_LINKS, ...NAV_BUTTONS, ...FOOTER_LINKS];
    const marked = all.filter((l) => l.spaRoute);
    expect(marked.length).toBeGreaterThan(0);
    for (const link of all) {
      if (link.external) continue;
      expect(spaRoutes.has(link.href), `${link.href} spaRoute flag`).toBe(!!link.spaRoute);
    }
  });

  it("is imported by all four headers and footers, which carry no hand-typed list", () => {
    for (const file of [
      "src/components/landing/Navbar.tsx",
      "src/components/landing/Footer.tsx",
      "web/components/Navbar.astro",
      "web/components/Footer.astro",
    ]) {
      const src = source(file);
      expect(src, file).toMatch(/from "@\/lib\/navLinks"/);
      expect(src, file).not.toMatch(
        /href="\/(homeschool|freebies|courses|contact|terms|privacy|cookies|returns|esa|why-eden|herbs|assessment)"/,
      );
    }
  });
});

function expectLinks(container: HTMLElement, links: readonly SiteLink[]) {
  for (const link of links) {
    const anchors = within(container).getAllByRole("link", { name: link.label });
    expect(
      anchors.map((el) => el.getAttribute("href")),
      link.label,
    ).toContain(link.href);
  }
}

describe("SPA Navbar renders the shared list", () => {
  const renderNav = () =>
    render(
      <MemoryRouter initialEntries={["/assessment"]}>
        <Navbar />
      </MemoryRouter>,
    );

  it("renders every header link and both buttons on desktop", () => {
    const { container } = renderNav();
    expectLinks(container, NAV_LINKS);
    expectLinks(container, NAV_BUTTONS);
  });

  it("renders every header link and both buttons in the mobile menu", () => {
    const { container } = renderNav();
    const before = container.querySelectorAll("a").length;
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    const added = [...container.querySelectorAll("a")].slice(before);
    expect(added.map((a) => a.getAttribute("href"))).toEqual(
      [...NAV_LINKS, ...NAV_BUTTONS].map((l) => l.href),
    );
  });

  it("sends the logo to the static homepage and keeps the link attributes", () => {
    const { container } = renderNav();
    expect(within(container).getByRole("link", { name: /The Eden Institute/ }).getAttribute("href")).toBe("/");
    expect(within(container).getByRole("link", { name: "Buy the Book" }).getAttribute("target")).toBe("_blank");
    expect(
      within(container).getByRole("link", { name: "Discover your Body Pattern" }).getAttribute("data-cta"),
    ).toBe("nav-take-quiz");
  });
});

describe("SPA Footer renders the shared list", () => {
  it("renders every footer link", () => {
    const { container } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    expectLinks(container, FOOTER_LINKS);
    expect(
      within(container).getByRole("link", { name: "ESA & Scholarship Programs" }).getAttribute("data-cta"),
    ).toBe("footer-esa");
  });
});
