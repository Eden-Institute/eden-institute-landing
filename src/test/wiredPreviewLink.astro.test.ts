// The preview-pass head script ships on /wired pages only (src/lib/wiredPreviewLink.ts).
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import reactRenderer from "@astrojs/react/server.js";
// Imported through a glob, as the other *.astro.test.ts files do (the app tsconfig has no .astro module types).
type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];
const layouts = import.meta.glob<{ default: RenderableComponent }>(["../../web/layouts/MarketingLayout.astro"], { eager: true });
const MarketingLayout = layouts["../../web/layouts/MarketingLayout.astro"].default;

const MARKER = "eden_wired_preview";

async function render(path: string, noThirdPartyTags = false): Promise<string> {
  const container = await AstroContainer.create();
  container.addServerRenderer({ name: "@astrojs/react", renderer: reactRenderer });
  container.addClientRenderer({ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" });
  return container.renderToString(MarketingLayout, {
    request: new Request(`https://edeninstitute.health${path}`),
    props: { title: "T", description: "D", canonical: `https://edeninstitute.health${path}`, noThirdPartyTags },
  });
}

describe("Wired preview link: head script placement", () => {
  it("is in the head of /wired and its private subpages", async () => {
    for (const [path, priv] of [["/wired", false], ["/wired/results", true], ["/wired/pilot", true]] as const) {
      const html = await render(path, priv);
      expect(html, path).toContain(MARKER);
      expect(html.indexOf(MARKER), path).toBeLessThan(html.indexOf("</head>"));
    }
  });
  it("runs before Google Tag Manager on /wired", async () => {
    const html = await render("/wired");
    const gtm = html.indexOf("googletagmanager.com");
    expect(gtm).toBeGreaterThan(-1);
    expect(html.indexOf(MARKER)).toBeLessThan(gtm);
  });
  it("is not on any other page", async () => {
    for (const path of ["/", "/books", "/curriculum-finder", "/wiredx"]) {
      expect(await render(path), path).not.toContain(MARKER);
    }
  });
});
