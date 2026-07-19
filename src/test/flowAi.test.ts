// AI drafting.
//
// The rule that matters most here is not a UI rule: the edge function may only
// assert what is in the product's `facts`, because that field is the whole
// guard against an unapproved claim reaching a paid ad. So these tests pin the
// brief that gets sent, not just the happy path.
//
// The founder's working model is the other thing under test. She writes and
// directs; the AI edits her words. Drafting is offered alongside the approved
// library rather than instead of it, and a model that is unavailable must
// degrade to that library rather than break the step.

import { describe, expect, it, vi } from "vitest";
import {
  bankDrafts, buildBrief, checkAi, diagnoseDraft, editDraft, explainAiError,
  generateDrafts,
} from "@/studio/flow-ai";
import type { FlowAnswers } from "@/studio/flow-graph";
import { PRODUCTS } from "@/studio/studio-banks";

const answers = (over: Partial<FlowAnswers> = {}): FlowAnswers => ({
  platforms: "both", adType: "portrait", product: "kit", objective: "sales",
  audience: "homeschool", angle: "children", direction: null,
  ...over,
});

describe("the brief sent to the model", () => {
  it("carries only the approved facts as claimable material", () => {
    const brief = buildBrief(answers());
    expect(brief.facts).toBe(PRODUCTS.kit.facts);
    expect(brief.facts).toMatch(/\$249/);
    // the price justification has to survive, or every kit ad reads thin
    expect(brief.facts).toMatch(/FULL CURRICULUM/);
  });

  it("names the angle and its art direction", () => {
    const brief = buildBrief(answers());
    expect(brief.angle).toBe("Teach Your Children");
    expect(brief.angleEssence).toBeTruthy();
  });

  it("strips the markup out of the audience note", () => {
    const brief = buildBrief(answers({ audience: "esa" }));
    expect(brief.audienceDesc).toMatch(/GATOR/);
    expect(brief.audienceDesc).not.toMatch(/<[^>]+>/);
  });

  it("sends the CTA the product and objective agree on", () => {
    expect(buildBrief(answers({ objective: "sales" })).cta).toBe("Shop Now");
    expect(buildBrief(answers({ objective: "leads" })).cta).toBe("Sign Up");
  });

  it("sends a UTM-tagged destination, so drafted links are attributable", () => {
    expect(buildBrief(answers()).url).toMatch(/utm_medium=paid_social/);
  });

  it("passes her own direction through, and an empty one as empty", () => {
    expect(buildBrief(answers({ direction: "  Lead with July 29  " })).direction)
      .toBe("Lead with July 29");
    expect(buildBrief(answers()).direction).toBe("");
  });
});

describe("generating drafts", () => {
  it("asks for generation and returns what came back", async () => {
    const invoke = vi.fn().mockResolvedValue({
      drafts: [{ primary: "One herb a week.", headline: "Eden's Table" }],
    });
    const { drafts } = await generateDrafts(invoke, answers());
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "generate", brief: expect.any(Object) }),
    );
    expect(drafts[0].primary).toBe("One herb a week.");
  });

  it("never shows more than three", async () => {
    const invoke = vi.fn().mockResolvedValue({
      drafts: Array.from({ length: 7 }, (_, i) => ({ primary: `draft ${i}` })),
    });
    expect((await generateDrafts(invoke, answers())).drafts).toHaveLength(3);
  });

  it("drops an empty draft rather than offering a blank card", async () => {
    const invoke = vi.fn().mockResolvedValue({
      drafts: [{ primary: "  " }, { primary: "real" }, { headline: "no primary" }],
    });
    const { drafts } = await generateDrafts(invoke, answers());
    expect(drafts.map((d) => d.primary)).toEqual(["real"]);
  });

  it("mentions partial model failures instead of hiding them", async () => {
    const invoke = vi.fn().mockResolvedValue({
      drafts: [{ primary: "one" }], errors: ["model b timed out"],
    });
    expect((await generateDrafts(invoke, answers())).note).toMatch(/1 model call failed/);
  });

  it("survives a response with no drafts key at all", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    expect((await generateDrafts(invoke, answers())).drafts).toEqual([]);
  });
});

describe("editing her words", () => {
  it("sends her draft, not a regenerated one", async () => {
    const invoke = vi.fn().mockResolvedValue({ drafts: [{ primary: "tighter" }] });
    await editDraft(invoke, answers(), "my own words", "sharpen", "keep it warm");
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      mode: "edit", action: "sharpen", draft: "my own words", note: "keep it warm",
    }));
  });

  it("keeps what changed, so a rewrite is reviewable", async () => {
    const invoke = vi.fn().mockResolvedValue({
      drafts: [{ primary: "tighter", changes: ["cut the throat-clear"], approach: "direct" }],
    });
    const out = await editDraft(invoke, answers(), "draft", "variations");
    expect(out[0].changes).toEqual(["cut the throat-clear"]);
    expect(out[0].approach).toBe("direct");
  });

  it("diagnoses without rewriting", async () => {
    const invoke = vi.fn().mockResolvedValue({
      verdict: "Solid, but the ask is buried.",
      issues: [{ severity: "policy", note: "avoid personal attributes" }],
      strengths: ["concrete opening"],
    });
    const d = await diagnoseDraft(invoke, answers(), "draft");
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ action: "diagnose" }));
    expect(d.issues).toHaveLength(1);
    expect(d.strengths).toEqual(["concrete opening"]);
  });

  it("returns empty lists rather than undefined when nothing comes back", async () => {
    const d = await diagnoseDraft(vi.fn().mockResolvedValue({}), answers(), "draft");
    expect(d.issues).toEqual([]);
    expect(d.strengths).toEqual([]);
  });
});

describe("when the model is unavailable", () => {
  it("says so rather than pretending, with no connection at all", async () => {
    const r = await checkAi(undefined);
    expect(r.ready).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("treats a configured-but-empty model list as not ready", async () => {
    const r = await checkAi(vi.fn().mockResolvedValue({ models: [] }));
    expect(r.ready).toBe(false);
  });

  it("reports ready when a model is there", async () => {
    const r = await checkAi(vi.fn().mockResolvedValue({ ready: true, models: ["claude"] }));
    expect(r.ready).toBe(true);
  });

  it("explains each failure in plain language, pointing at the library", () => {
    for (const code of ["not_configured", "rate_limited", "unauthorized", "timeout"]) {
      const text = explainAiError({ code });
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/undefined|\[object/);
    }
    expect(explainAiError({ code: "rate_limited" })).toMatch(/resets tomorrow/i);
    expect(explainAiError({ code: "not_configured" })).toMatch(/copy below still works/i);
  });

  it("falls back to something readable for an unknown failure", () => {
    expect(explainAiError(new Error("boom"))).toMatch(/Drafting failed/);
    expect(explainAiError({ status: 429 })).toMatch(/Too many requests/);
  });
});

describe("the approved library, which needs no model", () => {
  it("offers the real copy for a product and angle that has some", () => {
    const drafts = bankDrafts(answers({ product: "course", angle: "design" }));
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0]).toBe(PRODUCTS.course.primaries.design[0]);
  });

  it("still offers three drafts for a pairing the library never covered", () => {
    const drafts = bankDrafts(answers({ product: "quiz", angle: "steward" }));
    expect(drafts.length).toBeGreaterThan(0);
    for (const d of drafts) expect(d.trim().length).toBeGreaterThan(20);
  });
});
