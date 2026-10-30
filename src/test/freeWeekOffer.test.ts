// The free-week offer on the /learn articles and the herb pages (2026-10-28).
import { describe, expect, it } from "vitest";
import {
  FREE_WEEK_OFFER_HEADING,
  freeWeekFormName,
  freeWeekOfferHtml,
  remarkFreeWeekOffer,
} from "../../web/lib/freeWeekOffer";
import { FREE_WEEK_MODAL } from "../../web/lib/freeWeekModal";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("freeWeekOfferHtml", () => {
  it("carries the prompt's heading and one button per band, wired to the free-week pop-up", () => {
    const doc = parse(freeWeekOfferHtml("learn_mid"));
    expect(doc.querySelector("aside p")?.textContent).toBe(FREE_WEEK_OFFER_HEADING);
    const buttons = [...doc.querySelectorAll("button[data-waitlist-source]")];
    expect(buttons.map((b) => b.getAttribute("data-waitlist-source"))).toEqual(["sprouts_magnet", "seedlings_magnet"]);
    expect(buttons.map((b) => b.getAttribute("data-waitlist-form-name"))).toEqual([
      "learn_mid_sprouts_week1",
      "learn_mid_seedlings_week1",
    ]);
    // The pop-up's wording comes from FREE_WEEK_MODAL, read back intact through the escaping.
    expect(buttons[1].getAttribute("data-waitlist-subtitle")).toBe(FREE_WEEK_MODAL.seedlings.subtitle);
    expect(buttons[0].getAttribute("data-waitlist-title")).toBe(FREE_WEEK_MODAL.sprouts.title);
    // The post-signup button is a plain internal link (no UTM tags).
    expect(buttons[0].getAttribute("data-waitlist-cta-href")).toBe("/homeschool");
    expect(buttons.every((b) => b.getAttribute("type") === "button")).toBe(true);
  });

  it("names each placement's forms apart", () => {
    expect(freeWeekFormName("learn_end", "sprouts")).toBe("learn_end_sprouts_week1");
    expect(freeWeekFormName("herb", "seedlings")).toBe("herb_seedlings_week1");
    expect(parse(freeWeekOfferHtml("herb")).querySelector("button")?.getAttribute("data-waitlist-form-name")).toBe("herb_sprouts_week1");
  });

  it("keeps a /freebies link for a reader without JavaScript", () => {
    expect(parse(freeWeekOfferHtml("herb")).querySelector('a[href="/freebies"]')).not.toBeNull();
  });
});

describe("remarkFreeWeekOffer", () => {
  const h2 = (t: string) => ({ type: "heading", depth: 2, children: [{ type: "text", value: t }] });
  const p = (t: string) => ({ type: "paragraph", children: [{ type: "text", value: t }] });
  const run = (children: object[], freeWeekOffer: unknown) => {
    const tree = { type: "root", children: [...children] } as { type: string; children: { type: string; value?: string }[] };
    remarkFreeWeekOffer()(tree, { data: { astro: { frontmatter: { freeWeekOffer } } } });
    return tree.children;
  };

  it("puts the offer after the first section, before the second heading", () => {
    const out = run([p("intro"), h2("One"), p("a"), h2("Two"), p("b"), h2("Three")], true);
    expect(out.map((n) => n.type)).toEqual(["paragraph", "heading", "paragraph", "html", "heading", "paragraph", "heading"]);
    expect(out[3].value).toContain("learn_mid_sprouts_week1");
  });

  it("does nothing to an unflagged article", () => {
    const out = run([p("intro"), h2("One"), p("a"), h2("Two")], undefined);
    expect(out.some((n) => n.type === "html")).toBe(false);
  });

  it("does nothing to an article with one section", () => {
    const out = run([p("intro"), h2("One"), p("a")], true);
    expect(out.some((n) => n.type === "html")).toBe(false);
  });
});
