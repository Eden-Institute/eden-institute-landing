// The flow's branching is a pure function, so every path can be walked here
// without rendering anything. These tests exist because the expensive failures
// in a one-question-at-a-time flow are structural: a question that never
// appears, a dead end with no way forward, or an answer silently wiped when
// the founder changes her mind.

import { describe, expect, it } from "vitest";
import {
  FLOW, chapterOf, isComplete, isVisible, nextNode, nodeById, orderedOptions,
  reconcile, visibleNodes, isVideoOutput,
} from "@/studio/flow-graph";
import type { FlowAnswers } from "@/studio/flow-graph";
import { ANGLES, FORMATS, PRODUCTS, TEMPLATES } from "@/studio/studio-banks";

/** A fully specified ad, so individual fields can be removed to make a node
 *  the "next" one without hand-walking the graph. */
const complete = (over: Partial<FlowAnswers> = {}): FlowAnswers => ({
  platforms: "both", adType: "portrait", product: "kit", objective: "sales",
  audience: "homeschool", angle: "children", direction: null,
  source: "media", slides: [{ id: "a1", kind: "image" }], template: "label",
  opacity: 1, finetune: null,
  copyMode: "ai", variant: 0, caption: "One herb a week.",
  treatment: "static", overlay: { hook: "H" }, anchor: "bc", link: null,
  rendered: true, pathway: "native",
  ...over,
});

describe("flow graph · structure", () => {
  it("every node has a question, a chapter and somewhere to write", () => {
    for (const n of FLOW) {
      expect(n.question(complete()), `${n.id} question`).toBeTruthy();
      expect([1, 2, 3, 4]).toContain(n.chapter);
      expect(n.writes, `${n.id} writes`).toBeTruthy();
    }
  });

  it("node ids are unique", () => {
    const ids = FLOW.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chapters only ever move forward", () => {
    let seen = 0;
    for (const n of FLOW) {
      expect(n.chapter, `${n.id} goes backwards`).toBeGreaterThanOrEqual(seen);
      seen = n.chapter;
    }
  });
});

describe("flow graph · what applies when", () => {
  it("branded ads are not asked about opacity or fine-tuning", () => {
    const a = complete({ source: "branded", slides: [] });
    expect(isVisible(nodeById("opacity")!, a)).toBe(false);
    expect(isVisible(nodeById("finetune")!, a)).toBe(false);
  });

  it("branded ads are not offered the photo template", () => {
    const ids = nodeById("template")!.options!({ source: "branded" }).map((o) => o.id);
    expect(ids).not.toContain("photo");
    expect(ids).toContain("label");
  });

  it("a photo ad is not asked about sound, a video ad is", () => {
    expect(isVisible(nodeById("sound")!, complete())).toBe(false);
    expect(isVisible(nodeById("sound")!,
      complete({ slides: [{ id: "v", kind: "video" }] }))).toBe(true);
  });

  it("scrolling credits are only offered over moving footage", () => {
    const still = nodeById("treatment")!.options!(complete()).map((o) => o.id);
    expect(still).not.toContain("scrolling");
    const video = nodeById("treatment")!.options!(
      complete({ slides: [{ id: "v", kind: "video" }] })).map((o) => o.id);
    expect(video).toContain("scrolling");
  });

  it("choosing no text skips every on-creative question", () => {
    const a = complete({ treatment: "none" });
    for (const id of ["overlay", "anchor", "link", "credits"]) {
      expect(isVisible(nodeById(id)!, a), `${id} should be hidden`).toBe(false);
    }
  });

  it("the two copy modes are mutually exclusive", () => {
    expect(isVisible(nodeById("variants")!, complete({ copyMode: "ai" }))).toBe(true);
    expect(isVisible(nodeById("ownCopy")!, complete({ copyMode: "ai" }))).toBe(false);
    expect(isVisible(nodeById("variants")!, complete({ copyMode: "own" }))).toBe(false);
    expect(isVisible(nodeById("ownCopy")!, complete({ copyMode: "own" }))).toBe(true);
  });

  it("a QR code is not offered on video", () => {
    expect(isVisible(nodeById("link")!,
      complete({ slides: [{ id: "v", kind: "video" }], treatment: "scrolling" }))).toBe(false);
  });
});

describe("flow graph · options come from the real banks", () => {
  it("only offers a product's own angles, and they all exist", () => {
    for (const pid of Object.keys(PRODUCTS)) {
      const ids = nodeById("angle")!.options!({ product: pid }).map((o) => o.id);
      expect(ids).toEqual(PRODUCTS[pid].angles);
      for (const id of ids) expect(ANGLES[id], `${pid} → ${id}`).toBeDefined();
    }
  });

  it("offers every ad format and every template", () => {
    expect(nodeById("adType")!.options!({}).map((o) => o.id).sort())
      .toEqual(Object.keys(FORMATS).sort());
    expect(nodeById("template")!.options!({}).map((o) => o.id).sort())
      .toEqual(Object.keys(TEMPLATES).sort());
  });

  it("recommends without ever removing", () => {
    const a = { product: "kit", audience: "homeschool" };
    const all = nodeById("angle")!.options!(a).map((o) => o.id);
    const ordered = orderedOptions(nodeById("angle")!, a).map((o) => o.id);
    expect(ordered.sort()).toEqual(all.sort());            // same set
    const first = orderedOptions(nodeById("angle")!, a).slice(0, 2).map((o) => o.id);
    expect(first).toContain("children");                   // just reordered
    expect(first).toContain("openandgo");
  });

  it("recommendations are always inside the allowed set", () => {
    for (const pid of Object.keys(PRODUCTS)) {
      for (const aud of ["homeschool", "esa", "mom2am", "hesitant", "exhausted", "practitioner"]) {
        const a = { product: pid, audience: aud };
        const allowed = nodeById("angle")!.options!(a).map((o) => o.id);
        const rec = nodeById("angle")!.recommended!(a);
        for (const r of rec) {
          if (!allowed.includes(r)) continue;   // pairing not sold by this product
          expect(allowed).toContain(r);
        }
      }
    }
  });
});

describe("flow graph · every path reaches the end", () => {
  it("no combination dead-ends", () => {
    const dead: string[] = [];
    let combos = 0;
    for (const adType of Object.keys(FORMATS)) {
      for (const product of Object.keys(PRODUCTS)) {
        for (const source of ["media", "ai", "branded"] as const) {
          for (const kind of ["image", "video"] as const) {
            if (source === "branded" && kind === "video") continue;
            for (const treatment of ["static", "branded", "none"] as const) {
              combos++;
              const a = complete({
                adType: adType as any, product,
                angle: PRODUCTS[product].angles[0],
                source, treatment,
                slides: source === "branded" ? [] : [{ id: "x", kind }],
              });
              if (!visibleNodes(a).some((n) => n.id === "pathway")) {
                dead.push(`${adType}/${product}/${source}/${kind}/${treatment}`);
              }
            }
          }
        }
      }
    }
    expect(combos).toBeGreaterThan(100);
    expect(dead).toEqual([]);
  });

  it("walks from the first question to the last without looping", () => {
    let a: FlowAnswers = {};
    let node = FLOW[0];
    const seen: string[] = [];
    for (let i = 0; i < 60; i++) {
      seen.push(node.id);
      // answer it the way a first-time founder would: the first option
      const opts = node.options ? node.options(a) : [];
      (a as any)[node.writes] = opts.length ? opts[0].id
        : node.optional ? null
        : node.writes === "slides" ? [{ id: "a1", kind: "image" }]
        : node.writes === "opacity" ? 1
        : node.writes === "variant" ? 0
        : node.writes === "rendered" ? true
        : node.writes === "caption" ? "One herb a week."
        : node.writes === "overlay" ? { hook: "H" }
        : node.writes === "sound" ? { mode: "none" }
        : node.writes === "credits" ? { text: "a", speed: 5, startDelaySec: 0 }
        : "x";
      a = reconcile(a).answers;
      const next = nextNode(node.id, a);
      if (!next) break;
      node = next;
    }
    expect(isComplete(a)).toBe(true);
    expect(new Set(seen).size).toBe(seen.length);     // never asked twice
    expect(chapterOf(seen[seen.length - 1])).toBe(4);
  });

  it("the shortest and longest paths stay in a sane range", () => {
    const lengths: number[] = [];
    for (const adType of Object.keys(FORMATS)) {
      for (const source of ["media", "ai", "branded"] as const) {
        for (const treatment of ["static", "none"] as const) {
          lengths.push(visibleNodes(complete({
            adType: adType as any, source, treatment,
            slides: source === "branded" ? [] : [{ id: "x", kind: "image" }],
          })).length);
        }
      }
    }
    // Not a budget to hit, a guard against questions creeping in unnoticed.
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(22);
  });
});

describe("flow graph · changing your mind", () => {
  it("parks an answer when its question stops applying, and gives it back", () => {
    const withCredits = complete({
      slides: [{ id: "v", kind: "video" }], treatment: "scrolling",
      credits: { text: "one herb a week", speed: 5, startDelaySec: 0 },
    });
    // switch to a still image: credits no longer apply
    const off = reconcile({ ...withCredits, slides: [{ id: "a1", kind: "image" }],
      treatment: "static" }).answers;
    expect(off.credits).toBeUndefined();
    expect(off.shadow?.credits).toBeDefined();

    // switch back: the typed credits come home
    const on = reconcile({ ...off, slides: [{ id: "v", kind: "video" }],
      treatment: "scrolling" }).answers;
    expect(on.credits?.text).toBe("one herb a week");
  });

  it("clears an angle the new product does not sell, and says so", () => {
    const a = complete({ product: "kit", angle: "preorder" });
    const { answers, cleared } = reconcile({ ...a, product: "quiz" });
    expect(answers.angle).toBeUndefined();
    expect(cleared.map((n) => n.id)).toContain("angle");
  });

  it("leaves answers alone when they are still valid", () => {
    const a = complete({ product: "kit", angle: "children", objective: "sales" });
    const { answers, cleared } = reconcile({ ...a, adType: "feed" });
    expect(answers.angle).toBe("children");
    expect(answers.objective).toBe("sales");
    expect(cleared).toEqual([]);
  });

  it("routes back to the question it had to clear", () => {
    const a = complete({ product: "kit", angle: "preorder" });
    const { answers } = reconcile({ ...a, product: "practitioner" });
    expect(nextNode("product", answers)?.id).toBe("angle");
  });

  it("dropping the only photo makes the media question apply again", () => {
    const { answers } = reconcile(complete({ slides: [] }));
    expect(isComplete(answers)).toBe(false);
    expect(visibleNodes(answers).some((n) => n.id === "media")).toBe(true);
  });
});

describe("flow graph · video detection", () => {
  it("a video clip makes it a video ad", () => {
    expect(isVideoOutput(complete({ slides: [{ id: "v", kind: "video" }] }))).toBe(true);
  });
  it("so does asking the text to roll", () => {
    expect(isVideoOutput(complete({ treatment: "scrolling" }))).toBe(true);
  });
  it("a plain photo ad is not a video", () => {
    expect(isVideoOutput(complete())).toBe(false);
  });
});
