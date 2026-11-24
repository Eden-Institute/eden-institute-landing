// /wired/pilot link card (2026-11-24, Camila's picks in Lane NP: the words ~10:50 "Use this one", the picture ~11:08
// "Use it"): the share card shows her picture at its real size, and every other page keeps the default card.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import reactRenderer from "@astrojs/react/server.js";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

type RenderableComponent = Parameters<AstroContainer["renderToString"]>[0];
const pages = import.meta.glob<{ default: unknown }>(["../../web/pages/wired/pilot.astro", "../../web/pages/privacy.astro"]);

let pilot = "";
let other = "";
beforeAll(async () => {
  const container = await AstroContainer.create();
  container.addServerRenderer({ name: "@astrojs/react", renderer: reactRenderer });
  container.addClientRenderer({ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" });
  const render = async (k: string) => container.renderToString((await pages[k]()).default as RenderableComponent);
  pilot = await render("../../web/pages/wired/pilot.astro");
  other = await render("../../web/pages/privacy.astro");
}, 60_000);

describe("/wired/pilot share card", () => {
  it("uses her picture for og and twitter, with its real size", () => {
    expect(pilot).toContain('<meta property="og:image" content="https://edeninstitute.health/og-wired-pilot.jpg"');
    expect(pilot).toContain('<meta name="twitter:image" content="https://edeninstitute.health/og-wired-pilot.jpg"');
    expect(pilot).toContain('<meta property="og:image:width" content="1200"');
    expect(pilot).toContain('<meta property="og:image:height" content="628"');
    expect(pilot).toContain("We're looking for 30 to 50 homeschool families to try our new quiz before it opens to everyone.");
  });

  it("the picture file is a 1200 x 628 JPEG in public/", () => {
    const b = readFileSync(new URL("../../public/og-wired-pilot.jpg", import.meta.url));
    expect(b[0]).toBe(0xff);
    expect(b[1]).toBe(0xd8);
    let i = 2;
    let size: [number, number] | null = null;
    while (i < b.length) {
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc2) { size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
      i += 2 + len;
    }
    expect(size).toEqual([1200, 628]);
  });

  it("a page without its own picture keeps the default card and its 1200 x 630 size", () => {
    expect(other).toContain('<meta property="og:image" content="https://edeninstitute.health/og-default-realpages.jpg"');
    expect(other).toContain('<meta property="og:image:height" content="630"');
    expect(other).not.toContain("og-wired-pilot.jpg");
  });
});
