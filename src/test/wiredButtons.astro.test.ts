// W11: the Wired quiz buttons + exit pop-up. Approved copy word for word; nothing renders while the quiz is dark.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { WIRED_B, WIRED_CARDS, WIRED_IS_PUBLIC, WIRED_POPUP, wiredHref } from "../../web/lib/wiredButtons";
import { NAV_LINKS, WIRED_NAV_LINK } from "../../src/lib/navLinks";
import { STATIC_PATHS } from "../../web/lib/sitemapStaticPaths";
// Imported through a glob, as the other *.astro.test.ts files do (the app tsconfig has no .astro module types).
type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];
const components = import.meta.glob<{ default: RenderableComponent }>(
  ["../../web/components/WiredCta.astro", "../../web/components/ExitOffer.astro"],
  { eager: true },
);
const WiredCta = components["../../web/components/WiredCta.astro"].default;
const ExitOffer = components["../../web/components/ExitOffer.astro"].default;


const approved = readFileSync(new URL("../../docs/wired-copy/Wired_Quiz_Buttons_and_Popup.md", import.meta.url), "utf8");

describe("Wired buttons: approved copy word for word (Wired_Quiz_Buttons_and_Popup.md, 2026-11-19 5:14 PM CT)", () => {
  it("every card's headline, text and button appear in the approved file", () => {
    for (const [placement, c] of Object.entries(WIRED_CARDS)) {
      if (c.headline) expect(approved, `${placement} headline`).toContain(c.headline);
      expect(approved, `${placement} text`).toContain(c.text);
      expect(approved, `${placement} button`).toContain(`Button: ${c.button}`);
    }
    expect(approved).toContain(`A: ${WIRED_NAV_LINK.label}`);
    expect(approved).toContain(`B: ${WIRED_B.header}`);
    expect(approved).toContain(`Headline B: ${WIRED_B.homeschoolHeadline}`);
    for (const v of ["A", "B"] as const) {
      const p = WIRED_POPUP[v];
      expect(approved).toContain(`Version ${v}. Headline: ${p.headline} / Text: ${p.text} / Buttons: ${p.yes} / ${p.no}`);
    }
  });
  it("internal links: /wired with the placement, never a UTM tag", () => {
    expect(wiredHref("blog_end")).toBe("/wired?p=blog_end");
    expect(WIRED_NAV_LINK.href).toBe("/wired?p=header");
    expect(JSON.stringify(WIRED_CARDS) + WIRED_NAV_LINK.href).not.toMatch(/utm_/);
  });
});

describe("dark until launch (WIRED_IS_PUBLIC = false)", () => {
  it("is false today", () => expect(WIRED_IS_PUBLIC).toBe(false));
  it("no header link, no sitemap entry", () => {
    expect(NAV_LINKS.some((l) => l.href.startsWith("/wired"))).toBe(false);
    expect(STATIC_PATHS).not.toContain("/wired");
  });
  it("cards render nothing, and the exit box carries no Wired pop-up", async () => {
    const container = await AstroContainer.create();
    for (const placement of Object.keys(WIRED_CARDS)) {
      const html = await container.renderToString(WiredCta, { props: { placement, state: "Arizona" } });
      expect(html, placement).not.toContain("/wired");
    }
    const exit = await container.renderToString(ExitOffer, { props: { offer: "free_week", placement: "learn_exit" } });
    expect(exit).not.toContain('id="wired-exit"');
    expect(exit).toContain('id="exit-offer"');
  });
});
