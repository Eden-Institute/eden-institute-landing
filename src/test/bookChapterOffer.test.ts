// Back to Eden's free Chapter 1 on the plant pages and articles (2026-11-16 funnel fix).
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BACK_TO_EDEN_CH1_ATTRS,
  BOOK_OFFER_BUTTON,
  BOOK_OFFER_HEADING,
  bookChapterOfferHtml,
  bookOfferCta,
  bookOfferFormName,
} from "../../web/lib/bookChapterOffer";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("bookChapterOfferHtml", () => {
  it("opens the same Chapter 1 pop-up as /back-to-eden, named per placement", () => {
    const doc = parse(bookChapterOfferHtml("herb"));
    expect(doc.querySelector("aside p")?.textContent).toBe(BOOK_OFFER_HEADING);
    const b = doc.querySelector("button[data-waitlist-source]")!;
    expect(b.textContent).toBe(BOOK_OFFER_BUTTON);
    expect(b.getAttribute("type")).toBe("button");
    expect(b.getAttribute("data-waitlist-source")).toBe("back_to_eden_ch1");
    expect(b.getAttribute("data-waitlist-form-name")).toBe("herb_bte_ch1");
    expect(b.getAttribute("data-cta")).toBe("herb-bte-ch1");
    // Every pop-up attribute survives the escaping intact (the subtitle has an ampersand).
    for (const [k, v] of Object.entries(BACK_TO_EDEN_CH1_ATTRS)) expect(b.getAttribute(k)).toBe(v);
  });

  it("keeps a plain link to the book page for a reader without JavaScript", () => {
    expect(parse(bookChapterOfferHtml("learn_end")).querySelector('a[href="/back-to-eden"]')?.getAttribute("data-cta")).toBe("learn-end-bte-ch1-page");
  });

  it("names forms and CTAs apart", () => {
    expect(bookOfferFormName("learn_end")).toBe("learn_end_bte_ch1");
    expect(bookOfferCta("monograph")).toBe("monograph-bte-ch1");
  });
});

describe("where the offer appears", () => {
  const herbPage = readFileSync("web/pages/herbs/[slug].astro", "utf8");

  it("puts both offers on the plant page above the safety section, once each", () => {
    const book = herbPage.indexOf('bookChapterOfferHtml("herb")');
    const week = herbPage.indexOf('freeWeekOfferHtml("herb")');
    const safety = herbPage.indexOf("<!-- Safety -->");
    expect(book).toBeGreaterThan(0);
    expect(book).toBeLessThan(week);
    expect(week).toBeLessThan(safety);
    expect(herbPage.split('freeWeekOfferHtml("herb")').length - 1).toBe(1);
  });

  it("tracks the plant page's bottom buttons", () => {
    for (const cta of ["herb-assessment", "herb-open-apothecary", "herb-homeschool-bottom", "herb-witchcraft-article"]) {
      expect(herbPage).toContain(`data-cta="${cta}"`);
    }
  });

  it("links to a witchcraft article that exists, is published and keeps its title", () => {
    const path = herbPage.match(/HERBALISM_WITCHCRAFT_PATH = "([^"]+)"/)![1];
    const title = herbPage.match(/HERBALISM_WITCHCRAFT_TITLE = "([^"]+)"/)![1];
    const file = `web/content${path}.md`;
    expect(existsSync(file)).toBe(true);
    const md = readFileSync(file, "utf8");
    expect(md).toMatch(/^draft: false$/m);
    expect(md).toContain(`title: "${title}"`);
  });

  it("offers the chapter on the three faith articles", () => {
    for (const slug of ["herbs-in-the-bible", "is-herbalism-biblical", "is-herbalism-witchcraft"]) {
      expect(readFileSync(`web/content/learn/${slug}.md`, "utf8")).toMatch(/^bookOffer: true$/m);
    }
  });
});
