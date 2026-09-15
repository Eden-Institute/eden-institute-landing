// Run with: deno test supabase/functions/_shared/learnworlds-charge.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyLearnWorldsCharge } from "./learnworlds-charge.ts";

const base = { status: "succeeded", invoice: null, metadata: {}, description: "", application: null };

Deno.test("Connect application charge is a course sale", () => {
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_123" }).kind, "course_sale");
  assertEquals(classifyLearnWorldsCharge({ ...base, application: { id: "ca_123" } }).kind, "course_sale");
});

Deno.test("description match without an application is flagged for review, not counted", () => {
  for (const d of ["Back to Eden Foundations", "foundations course", "LearnWorlds purchase"]) {
    assertEquals(classifyLearnWorldsCharge({ ...base, description: d }).kind, "review");
  }
});

Deno.test("plain charge with no application and no course description is ignored", () => {
  assertEquals(classifyLearnWorldsCharge({ ...base, description: "Eden Sprouts Starter Unit" }).kind, "ignore");
});

Deno.test("our own checkouts, invoices and failed charges are ignored even with an application", () => {
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_1", metadata: { lookup_key: "deep_dive_guide" } }).kind, "ignore");
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_1", metadata: { preorder_sku: "sprouts_kit" } }).kind, "ignore");
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_1", invoice: "in_1" }).kind, "ignore");
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_1", status: "pending" }).kind, "ignore");
});

Deno.test("pinned application id: only that id counts, others go to review", () => {
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_lw" }, "ca_lw").kind, "course_sale");
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_other" }, "ca_lw").kind, "review");
  assertEquals(classifyLearnWorldsCharge({ ...base, application: "ca_other" }, "  ").kind, "course_sale");
});
