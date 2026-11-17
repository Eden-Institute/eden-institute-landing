// Lane SEO funnel ideas, batch 5 (2026-11-16): the "before you go" box, the Starter
// pages' free Week 1 button, and the podcast short-link pages.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PODCAST_LINKS, showFor } from "../../web/lib/podcastLinks";
import { HOST_CLIPS, SHOWS } from "../../web/lib/hostClips";
import { freeWeekButtonHtml, freeWeekOfferHtml, FREE_WEEK_BUTTON_LABELS } from "../../web/lib/freeWeekOffer";
import { FREE_WEEK_MODAL } from "../../web/lib/freeWeekModal";
import { bookChapterOfferHtml } from "../../web/lib/bookChapterOffer";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
// Paths are relative to the repo root, where vitest runs (same as bookChapterOffer.test.ts).
const read = (p: string) => readFileSync(p, "utf8");

describe("podcast short links", () => {
  it("every slug is short, lowercase words and hyphens, and unique", () => {
    const slugs = PODCAST_LINKS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(s.length).toBeLessThanOrEqual(24);
    }
  });

  it("every slug has its two-line page file, and every such page has a slug", () => {
    for (const l of PODCAST_LINKS) {
      expect(read(`web/pages/${l.slug}.astro`), l.slug).toContain(`<PodcastWelcome slug="${l.slug}" noindex={true} />`);
    }
    const pages = readdirSync("web/pages").filter(
      (f) => f.endsWith(".astro") && read(`web/pages/${f}`).includes("<PodcastWelcome"),
    );
    expect(pages.sort()).toEqual(PODCAST_LINKS.map((l) => `${l.slug}.astro`).sort());
  });

  it("every show is a real SHOWS entry and every clip is a permitted clip from that same show", () => {
    for (const l of PODCAST_LINKS) {
      expect(SHOWS.some((s) => s.show === l.show), l.show).toBe(true);
      expect(showFor(l).episodeUrl).toMatch(/^https:\/\//);
      if (l.clip) {
        const c = HOST_CLIPS.find((x) => x.id === l.clip);
        expect(c, l.clip).toBeTruthy();
        expect(c!.show).toBe(l.show);
        expect(c!.permission).toBe(true);
      }
    }
  });

  it("the page is noindex and is not listed in the sitemap", () => {
    expect(read("web/components/PodcastWelcome.astro")).toMatch(/noindex=\{true\}/);
    const statics = read("web/lib/sitemapStaticPaths.ts");
    for (const l of PODCAST_LINKS) expect(statics.includes(`"/${l.slug}"`), l.slug).toBe(false);
  });

  it("podcast offers are named per placement", () => {
    const fw = parse(freeWeekOfferHtml("podcast"));
    expect(fw.querySelector("button[data-waitlist-source='sprouts_magnet']")?.getAttribute("data-waitlist-form-name")).toBe(
      "podcast_sprouts_week1",
    );
    const ch1 = parse(bookChapterOfferHtml("podcast")).querySelector("button")!;
    expect(ch1.getAttribute("data-waitlist-form-name")).toBe("podcast_bte_ch1");
    expect(ch1.getAttribute("data-cta")).toBe("podcast-bte-ch1");
  });
});

describe("freeWeekButtonHtml (Starter pages)", () => {
  it("one band's button with that band's pop-up wording and a custom label", () => {
    const b = parse(
      freeWeekButtonHtml("starter", "seedlings", { label: "Teach Week 1 free first", className: "inline w-auto" }),
    ).querySelector("button")!;
    expect(b.textContent).toBe("Teach Week 1 free first");
    expect(b.getAttribute("data-waitlist-source")).toBe(FREE_WEEK_MODAL.seedlings.source);
    expect(b.getAttribute("data-waitlist-title")).toBe(FREE_WEEK_MODAL.seedlings.title);
    expect(b.getAttribute("data-waitlist-form-name")).toBe("starter_seedlings_week1");
    expect(b.getAttribute("data-cta")).toBe("starter-seedlings-free");
    expect(b.getAttribute("class")).toBe("inline w-auto");
  });

  it("defaults to the offer's own label and look, so freeWeekOfferHtml is unchanged", () => {
    const b = parse(freeWeekButtonHtml("herb", "sprouts")).querySelector("button")!;
    expect(b.textContent).toBe(FREE_WEEK_BUTTON_LABELS.sprouts);
    expect(freeWeekOfferHtml("herb")).toContain(freeWeekButtonHtml("herb", "sprouts"));
  });

  it("both Starter pages carry their own band's button and mount the pop-up", () => {
    const sprouts = read("web/pages/starter.astro");
    expect(sprouts).toContain('freeWeekButtonHtml("starter", "sprouts"');
    expect(sprouts).toContain("<WaitlistController client:only");
    const seedlings = read("web/pages/starter/seedlings.astro");
    expect(seedlings).toContain('freeWeekButtonHtml("starter", "seedlings"');
    expect(seedlings).toContain("<WaitlistController client:only");
  });
});

describe("ExitOffer (before you go)", () => {
  const src = read("web/components/ExitOffer.astro");

  it("shows at most once per visitor, never early, never after a sign-up click", () => {
    expect(src).toContain('const KEY = "eden-exit-offer"');
    expect(src).toMatch(/QUIET_DAYS = 30/);
    expect(src).toMatch(/ARM_MS = 12000/);
    expect(src).toContain('t.closest("[data-waitlist-source]")');
  });

  it("is mounted on plant pages (Chapter 1) and on articles that mount the pop-up", () => {
    expect(read("web/pages/herbs/[slug].astro")).toContain('<ExitOffer offer="book" placement="herb_exit" />');
    expect(read("web/pages/learn/[slug].astro")).toMatch(
      /\(d\.freeWeekOffer \|\| d\.bookOffer\) && <ExitOffer offer=\{d\.bookOffer \? "book" : "free_week"\} placement="learn_exit" \/>/,
    );
  });

  it("has no em dashes", () => {
    expect(src.includes("\u2014")).toBe(false);
    expect(read("web/components/PodcastWelcome.astro").includes("\u2014")).toBe(false);
    expect(read("web/lib/podcastLinks.ts").includes("\u2014")).toBe(false);
  });
});
