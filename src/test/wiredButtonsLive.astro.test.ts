// W11 with the launch switch ON (vi.mock is hoisted above the imports): the cards, the ESA state fill, and the exit pop-up arbiter markup.
import { describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { NAV_LINKS } from "../../src/lib/navLinks";
import { STATIC_PATHS } from "../../web/lib/sitemapStaticPaths";
// Imported through a glob, as the other *.astro.test.ts files do (the app tsconfig has no .astro module types).
type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];
const components = import.meta.glob<{ default: RenderableComponent }>(
  ["../../web/components/WiredCta.astro", "../../web/components/ExitOffer.astro"],
  { eager: true },
);
const WiredCta = components["../../web/components/WiredCta.astro"].default;
const ExitOffer = components["../../web/components/ExitOffer.astro"].default;


vi.mock("../../supabase/functions/_shared/wired-launch", () => ({ WIRED_IS_PUBLIC: true }));

describe("Wired buttons once the quiz is public", () => {
  it("a card links to /wired?p=<placement> with the click beacon attributes and no UTM", async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(WiredCta, { props: { placement: "homeschool_inline" } });
    expect(html).toContain('href="/wired?p=homeschool_inline"');
    expect(html).toContain('data-cta="wired"');
    expect(html).toContain('data-cta-placement="homeschool_inline"');
    expect(html).toContain("How is your child wired?");
    expect(html).not.toMatch(/utm_/);
  });
  it("ESA: [State] is filled; without a state the card is not shown", async () => {
    const c = await AstroContainer.create();
    expect(await c.renderToString(WiredCta, { props: { placement: "esa_inline", state: "Arizona" } })).toContain("ESA-eligible in Arizona.");
    expect(await c.renderToString(WiredCta, { props: { placement: "esa_inline" } })).not.toContain("/wired");
  });
  it("the exit box gains the Wired pop-up (version A) beside the existing box, with its own shown beacon", async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(ExitOffer, { props: { offer: "free_week", placement: "learn_exit" } });
    expect(html).toContain('id="exit-offer"');
    expect(html).toContain('id="wired-exit"');
    expect(html).toContain("Before you go: how is your child wired?");
    expect(html).toContain('href="/wired?p=exit_popup"');
    expect(html).toContain('data-cta="exit-popup-wired-shown"');
  });
  it("the header link and the sitemap entry appear", async () => {
    expect(NAV_LINKS.some((l) => l.href === "/wired?p=header" && l.ctaPlacement === "header")).toBe(true);
    expect(STATIC_PATHS).toContain("/wired");
  });
});
