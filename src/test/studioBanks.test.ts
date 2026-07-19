// The option banks moved out of studio-core.ts. Nothing about them should have
// changed, so these tests pin the shape and the load-bearing content: the
// product facts (the only claims the AI may make), the per-product angle lists
// (which drive what the founder is offered), and the fact that the AI copy pack
// still merges in.

import { describe, expect, it } from "vitest";
import {
  ANGLES, AUDIENCES, FORMATS, OBJECTIVES, PRODUCTS, TEMPLATES,
} from "@/studio/studio-banks";

describe("studio option banks", () => {
  it("carries every campaign angle with its art direction", () => {
    const ids = Object.keys(ANGLES);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      expect(ANGLES[id].name, `${id} name`).toBeTruthy();
      expect(ANGLES[id].visual, `${id} visual`).toBeTruthy();
    }
    expect(ANGLES.children.name).toBe("Teach Your Children");
    expect(ANGLES.heritage.name).toBe("Heritage, Not Witchcraft");
  });

  it("carries every audience with its targeting note", () => {
    const ids = Object.keys(AUDIENCES);
    expect(ids).toHaveLength(6);
    for (const id of ids) expect(AUDIENCES[id].note, `${id} note`).toBeTruthy();
    expect(AUDIENCES.esa.note).toMatch(/GATOR/);
  });

  it("keeps the four objectives and four formats", () => {
    expect(Object.keys(OBJECTIVES).sort())
      .toEqual(["awareness", "leads", "sales", "traffic"]);
    expect(Object.keys(FORMATS).sort())
      .toEqual(["carousel", "feed", "portrait", "story"]);
    expect(FORMATS.story.spec).toMatch(/1080 × 1920/);
  });

  it("keeps all five products, each with facts and a CTA per objective", () => {
    const ids = Object.keys(PRODUCTS);
    expect(ids.sort())
      .toEqual(["apothecary", "course", "kit", "practitioner", "quiz"]);
    for (const id of ids) {
      const p = PRODUCTS[id];
      expect(p.name, `${id} name`).toBeTruthy();
      expect(p.facts, `${id} facts`).toBeTruthy();
      expect(p.angles.length, `${id} angles`).toBeGreaterThan(0);
      for (const objective of Object.keys(OBJECTIVES)) {
        expect(p.ctas[objective], `${id} cta for ${objective}`).toBeTruthy();
      }
    }
  });

  it("only offers angles that actually exist", () => {
    for (const [id, p] of Object.entries(PRODUCTS)) {
      for (const a of p.angles) {
        expect(ANGLES[a], `${id} references unknown angle "${a}"`).toBeDefined();
      }
    }
  });

  it("still states the kit's price and its full subject weave", () => {
    // This wording is the price justification and was lifted verbatim from the
    // published /homeschool page. Losing it makes every kit ad read like a
    // science supplement.
    expect(PRODUCTS.kit.facts).toMatch(/\$249/);
    expect(PRODUCTS.kit.facts).toMatch(/FULL CURRICULUM, not a science supplement/);
    expect(PRODUCTS.kit.facts).toMatch(/Latin/);
  });

  it("merges the AI copy pack into the products", () => {
    // The pack adds extra primaries per angle plus audience-tuned copy. If the
    // merge stopped running, the studio would silently lose most of its bank.
    expect(PRODUCTS.kit.audiencePrimaries).toBeDefined();
    expect(Object.keys(PRODUCTS.kit.audiencePrimaries!).length).toBeGreaterThan(0);
    expect(PRODUCTS.kit.primaries.children.length).toBeGreaterThan(1);
    expect(PRODUCTS.kit.headlines.length).toBeGreaterThan(5);
  });

  it("keeps the canvas sizes at true Meta dimensions", () => {
    // These live on FORMATS itself now; adDimensions() renders straight from
    // them, so a wrong value here is a wrongly sized exported ad.
    expect(FORMATS.feed).toMatchObject({ w: 1080, h: 1080 });
    expect(FORMATS.portrait).toMatchObject({ w: 1080, h: 1350 });
    expect(FORMATS.story).toMatchObject({ w: 1080, h: 1920 });
    expect(FORMATS.carousel).toMatchObject({ w: 1080, h: 1080 });
  });

  it("keeps the three creative templates", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(["forest", "label", "photo"]);
  });
});
