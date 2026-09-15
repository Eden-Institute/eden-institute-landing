// Run with: deno test supabase/functions/_shared/quiz-member-retake.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyMemberRetake, canonicalPatternSlug, memberRetakeUserId } from "./quiz-member-retake.ts";

Deno.test("anonymous submission (no caller) never gets a member id", () => {
  assertEquals(memberRetakeUserId(null, "member@example.com"), null);
});

Deno.test("signed-in caller submitting their own email is a member retake", () => {
  assertEquals(memberRetakeUserId({ id: "u1", email: "Member@Example.com" }, "  member@example.COM "), "u1");
});

Deno.test("signed-in caller submitting someone else's email is treated as anonymous", () => {
  assertEquals(memberRetakeUserId({ id: "u1", email: "me@example.com" }, "victim@example.com"), null);
});

Deno.test("caller without an email, or a missing submitted email, is anonymous", () => {
  assertEquals(memberRetakeUserId({ id: "u1", email: null }, "me@example.com"), null);
  assertEquals(memberRetakeUserId({ id: "u1", email: "me@example.com" }, undefined), null);
  assertEquals(memberRetakeUserId({ id: "", email: "me@example.com" }, "me@example.com"), null);
});

Deno.test("canonicalPatternSlug maps kebab slugs to the eden_patterns form", () => {
  assertEquals(canonicalPatternSlug("pressure-cooker"), "the_pressure_cooker");
  assertEquals(canonicalPatternSlug("the_frozen_knot"), "the_frozen_knot");
  assertEquals(canonicalPatternSlug("Still Water"), "the_still_water");
  assertEquals(canonicalPatternSlug("Hot / Damp / Tense"), null);
  assertEquals(canonicalPatternSlug(""), null);
  assertEquals(canonicalPatternSlug(42), null);
});

Deno.test("applyMemberRetake patches by user id only, never by email", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const fake = ((url: string, init?: RequestInit) => {
    calls.push({ url, body: String(init?.body ?? "") });
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as unknown as typeof fetch;
  const res = await applyMemberRetake({
    supabaseUrl: "https://x.supabase.co",
    serviceKey: "k",
    userId: "u-1",
    constitutionType: "open-flame",
    fetchImpl: fake,
  });
  assertEquals(res.ok, true);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].url, "https://x.supabase.co/rest/v1/profiles?user_id=eq.u-1");
  assertEquals(JSON.parse(calls[0].body), { constitution_type: "open-flame" });
  assertEquals(calls[1].url, "https://x.supabase.co/rest/v1/person_profiles?user_id=eq.u-1&is_self=is.true");
  assertEquals(JSON.parse(calls[1].body), { eden_constitution: "the_open_flame" });
  for (const c of calls) assertEquals(c.url.includes("email"), false);
});

Deno.test("applyMemberRetake reports failure without throwing", async () => {
  const fake = (() => Promise.resolve(new Response("no", { status: 500 }))) as unknown as typeof fetch;
  const res = await applyMemberRetake({
    supabaseUrl: "https://x.supabase.co",
    serviceKey: "k",
    userId: "u-1",
    constitutionType: "open-flame",
    fetchImpl: fake,
  });
  assertEquals(res.ok, false);
});
