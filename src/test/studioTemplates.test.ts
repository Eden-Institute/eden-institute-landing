// Starter templates.
//
// These silently stopped working when the flow replaced the five-screen
// wizard: they seeded `state` in the old core's blob shape, which the flow
// never reads, so choosing "Preorder announcement" prefilled nothing beyond
// the product and ad type. Nothing broke and nothing warned, which is what
// made it worth a test rather than a fix alone.

import { describe, expect, it } from "vitest";
import { STUDIO_TEMPLATES, templateById, templateState } from "@/studio/studio-templates";
import { isAnswered, isVisible, nodeById, FLOW } from "@/studio/flow-graph";
import { ANGLES, PRODUCTS, TEMPLATES } from "@/studio/studio-banks";

describe("starter templates", () => {
  it("seeds the shape the flow actually reads", () => {
    const seeded = templateState("preorder");
    expect(seeded?.flow).toBeDefined();
    expect(seeded?.flow.objective).toBe("sales");
    expect(seeded?.flow.angle).toBe("preorder");
  });

  it("seeds nothing at all when no template was chosen", () => {
    expect(templateState(undefined)).toBeUndefined();
    expect(templateState("no-such-template")).toBeUndefined();
  });

  it("actually answers questions, rather than leaving the flow blank", () => {
    for (const t of STUDIO_TEMPLATES) {
      const a = t.answers;
      const answered = FLOW.filter((n) => isVisible(n, a) && isAnswered(n, a));
      // a template that answers nothing is the bug this file exists for
      expect(answered.length, `${t.id} answers nothing`).toBeGreaterThan(4);
    }
  });

  it("only ever names real products, angles and treatments", () => {
    for (const t of STUDIO_TEMPLATES) {
      expect(PRODUCTS[t.answers.product as string], `${t.id} product`).toBeDefined();
      expect(ANGLES[t.answers.angle as string], `${t.id} angle`).toBeDefined();
      expect(TEMPLATES[t.answers.template as string], `${t.id} treatment`).toBeDefined();
    }
  });

  it("only offers an angle the chosen product actually sells", () => {
    for (const t of STUDIO_TEMPLATES) {
      const allowed = nodeById("angle")!.options!(t.answers).map((o) => o.id);
      expect(allowed, `${t.id}: ${t.answers.angle} is not sold by ${t.answers.product}`)
        .toContain(t.answers.angle);
    }
  });

  it("carries prompts to replace, never finished marketing claims", () => {
    // Shipping invented copy as a default is how an unreviewed claim reaches a
    // paid ad, so every seeded string has to read as scaffolding.
    for (const t of STUDIO_TEMPLATES) {
      const strings = [
        t.answers.overlay?.hook, t.answers.overlay?.sub, t.answers.caption,
      ].filter(Boolean) as string[];
      expect(strings.length).toBeGreaterThan(0);
      for (const text of strings) {
        expect(text, `${t.id}: "${text}" reads as finished copy`).toMatch(/\[/);
      }
    }
    // ...but the button is a real instruction, not a placeholder
    for (const t of STUDIO_TEMPLATES) {
      expect(t.answers.overlay?.cta).not.toMatch(/\[/);
    }
  });

  it("never seeds a price, date or claim of its own", () => {
    for (const t of STUDIO_TEMPLATES) {
      const all = JSON.stringify(t.answers);
      expect(all, `${t.id} names a price`).not.toMatch(/\$\d/);
      expect(all, `${t.id} names a date`).not.toMatch(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/);
    }
  });

  it("agrees with the facets it sets on the project row", () => {
    for (const t of STUDIO_TEMPLATES) {
      expect(t.answers.product, `${t.id} product mismatch`).toBe(t.product);
    }
  });

  it("still leaves the founder something to decide", () => {
    // A template that answered everything would skip her straight to export.
    for (const t of STUDIO_TEMPLATES) {
      const unanswered = FLOW.filter((n) => isVisible(n, t.answers) && !isAnswered(n, t.answers));
      expect(unanswered.length, `${t.id} leaves nothing to choose`).toBeGreaterThan(0);
    }
  });

  it("finds a template by id", () => {
    expect(templateById("testimonial")?.name).toBe("Testimonial");
    expect(templateById("nope")).toBeUndefined();
  });
});
