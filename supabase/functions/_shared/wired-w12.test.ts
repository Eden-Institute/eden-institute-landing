// W12: the pilot (no network).
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bandOfGrade, checkSurvey, nextStep, parseApplication, submitSurvey, umuxLite } from "./wired-pilot.ts";

const app = {
  email: " Mom@X.com ", first_name: "Sarah", state: "tn", years: "1_2", kids: "2", approach: "charlotte_mason", heard: "podcast",
  children: [{ nickname: "Lily", grade: 0 }, { nickname: "Ben", grade: 7 }], commitment: true,
};
Deno.test("application: the approved fields, bands from grades, no last names asked", () => {
  const r = parseApplication(app);
  assert(r.ok);
  if (r.ok) {
    assertEquals([r.value.email, r.value.state, r.value.bands], ["mom@x.com", "TN", ["K-2", "6-8"]]);
  }
  for (const [k, v] of [["commitment", false], ["state", "ZZ"], ["years", "forever"], ["children", []], ["heard", "tv"]] as const) {
    const bad = parseApplication({ ...app, [k]: v });
    assert(!bad.ok, k);
  }
  assertEquals([bandOfGrade(0), bandOfGrade(5), bandOfGrade(8), bandOfGrade(12)], ["K-2", "3-5", "6-8", "9-12"]);
});

Deno.test("UMUX-LITE: raw = ((a-1)+(b-1)) x 100/12, adjusted = 0.65 x raw + 22.9 (Lewis et al. 2013)", () => {
  assertEquals(umuxLite(7, 7), { raw: 100, adjusted: 87.9 });
  assertEquals(umuxLite(1, 1), { raw: 0, adjusted: 22.9 });
  assertEquals(umuxLite(4, 5), { raw: 58.3, adjusted: 60.8 });
});

Deno.test("survey checks: required answers only; never anything that depends on the feedback being positive", () => {
  assertEquals(checkSurvey("ux", { capabilities: 1, easy: 1 }), null); // the harshest answers still count
  assert(checkSurvey("ux", { capabilities: 8, easy: 1 }));
  assertEquals(checkSurvey("accuracy", { overall: "Not at all" }), null);
  assertEquals(checkSurvey("family_map", { recommend: "No" }), null);
  assertEquals(checkSurvey("retake", { big_change: "No", answered_differently: "No" }), null);
});

type P = Record<string, string | null> | null;
function route(progress: P, opts: { firstQuiz?: string; retakeDone?: boolean; grantFails?: boolean } = {}) {
  const seen: { url: string; method: string; body?: unknown; headers?: Record<string, string> }[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input); const method = init.method ?? "GET";
    seen.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string> });
    const p = url.split("/rest/v1/")[1] ?? "";
    if (opts.grantFails && p.startsWith("rpc/wired_pilot_grant")) {
      return Promise.resolve(new Response(JSON.stringify({ code: "23505", message: "duplicate key value violates unique constraint" }), { status: 409 }));
    }
    let v: unknown = [];
    if (method !== "GET") v = p.startsWith("rpc/") ? { status: "granted" } : null;
    else if (p.startsWith("wired_pilot_progress")) v = progress ? [{ family_id: "f", child_id: "c", step1_at: null, step2_at: null, step3_at: null, step4_at: null, ...progress }] : [];
    else if (p.startsWith("wired_sessions") && p.includes("is_pilot_retake=eq.true")) v = opts.retakeDone ? [{ id: "r" }] : [];
    else if (p.startsWith("wired_sessions")) v = opts.firstQuiz ? [{ id: "s1", completed_at: opts.firstQuiz }] : [];
    return Promise.resolve(new Response(v === null ? null : JSON.stringify(v), { status: v === null ? 201 : 200 }));
  }) as typeof fetch;
  return seen;
}
const DB = { url: "https://db", key: "k" };
const NOW = new Date("2026-12-20T15:00:00Z");

Deno.test("ladder: Survey 1 needs her quiz; it gives the Blueprint in one RPC", async () => {
  route(null);
  assertEquals((await submitSurvey(DB, "f", "c", "ux", { capabilities: 5, easy: 6 }, () => undefined, NOW)).status, "not_yet");
  const seen = route(null, { firstQuiz: "2026-12-01T00:00:00Z" });
  const out = await submitSurvey(DB, "f", "c", "ux", { capabilities: 5, easy: 6 }, () => undefined, NOW);
  assertEquals(out, { status: "ok", step: 1, unlocked: "blueprint" });
  const grant = seen.find((s) => s.url.includes("rpc/wired_pilot_grant"))!.body as Record<string, unknown>;
  assertEquals([grant.p_product, grant.p_child, grant.p_quiz_year], ["pilot_blueprint", "c", 2026]);
  const survey = seen.find((s) => s.url.includes("/wired_surveys"))!.body as Record<string, unknown>;
  assertEquals((survey.answers as Record<string, unknown>).umux_lite, { raw: 75, adjusted: 71.7 });
});

// 2026-11-21 pilot Family Map fix (Lane 2b test pass 11/20, finding 1).
type Seen = { url: string; method: string; body?: unknown; headers?: Record<string, string> };
const at = (seen: Seen[], pred: (s: Seen) => boolean) => seen.findIndex(pred);
const isGrant = (s: Seen) => s.url.includes("rpc/wired_pilot_grant");
const isStamp = (step: string) => (s: Seen) =>
  s.method !== "GET" && s.url.includes("wired_pilot_progress") && !!s.body && step in (s.body as Record<string, unknown>);

Deno.test("pilot fix: each reward is granted BEFORE its step is stamped (Survey 1 and Survey 2)", async () => {
  let seen = route(null, { firstQuiz: "2026-12-01T00:00:00Z" });
  assertEquals((await submitSurvey(DB, "f", "c", "ux", { capabilities: 5, easy: 6 }, () => undefined, NOW)).status, "ok");
  assert(at(seen, isGrant) >= 0 && at(seen, isGrant) < at(seen, isStamp("step1_at")), "Blueprint grant must come before step1_at");
  seen = route({ step1_at: "2026-12-02T00:00:00Z" }, { firstQuiz: "2026-12-01T00:00:00Z" });
  assertEquals(await submitSurvey(DB, "f", "c", "accuracy", { overall: "Mostly" }, () => undefined, NOW), { status: "ok", step: 2, unlocked: "family_map" });
  const grant = seen[at(seen, isGrant)].body as Record<string, unknown>;
  assertEquals([grant.p_product, grant.p_family, grant.p_quiz_year], ["pilot_family_map", "f", 2026]);
  assert(at(seen, isGrant) < at(seen, isStamp("step2_at")), "Family Map grant must come before step2_at");
});

Deno.test("pilot fix: a failed Family Map grant leaves Survey 2 open (no step2_at), and the retry grants then stamps", async () => {
  let seen = route({ step1_at: "2026-12-02T00:00:00Z" }, { firstQuiz: "2026-12-01T00:00:00Z", grantFails: true });
  let threw = false;
  try { await submitSurvey(DB, "f", "c", "accuracy", { overall: "Mostly" }, () => undefined, NOW); } catch { threw = true; }
  assert(threw, "a failed grant must surface (wired-pilot answers could_not_save)");
  assertEquals(at(seen, isStamp("step2_at")), -1, "step2_at must NOT be stamped when the grant failed");
  // Her retry: progress still shows step 1 only, so Survey 2 runs again end to end.
  seen = route({ step1_at: "2026-12-02T00:00:00Z" }, { firstQuiz: "2026-12-01T00:00:00Z" });
  assertEquals((await submitSurvey(DB, "f", "c", "accuracy", { overall: "Mostly" }, () => undefined, NOW)).status, "ok");
  assert(at(seen, isGrant) >= 0 && at(seen, isGrant) < at(seen, isStamp("step2_at")));
});

Deno.test("pilot fix: the survey save is retry-safe (unique per family + kind: ignore the duplicate, keep her first answers)", async () => {
  const seen = route({ step1_at: "2026-12-02T00:00:00Z" }, { firstQuiz: "2026-12-01T00:00:00Z" });
  await submitSurvey(DB, "f", "c", "accuracy", { overall: "Mostly" }, () => undefined, NOW);
  const save = seen.find((s) => s.url.includes("/wired_surveys"))!;
  assert(save.url.includes("on_conflict=family_id,kind"), save.url);
  assert(String(save.headers?.Prefer ?? "").includes("resolution=ignore-duplicates"), String(save.headers?.Prefer));
});

Deno.test("ladder: in order only; Survey 3 opens 12 days after Survey 2; the retake 30 days after her first quiz", async () => {
  route({ step1_at: "2026-12-02T00:00:00Z" });
  assertEquals((await submitSurvey(DB, "f", "c", "family_map", { recommend: "Yes" }, () => undefined, NOW)).status, "not_yet");
  route({ step1_at: "2026-12-02T00:00:00Z", step2_at: "2026-12-15T00:00:00Z" });
  const early = await submitSurvey(DB, "f", "c", "family_map", { recommend: "Yes" }, () => undefined, NOW);
  assertEquals(early.status, "not_yet");
  if (early.status === "not_yet") assertEquals(early.opens_at, "2026-12-27T00:00:00.000Z");
  route({ step1_at: "2026-12-02T00:00:00Z", step2_at: "2026-12-05T00:00:00Z" });
  const ok = await submitSurvey(DB, "f", "c", "family_map", { recommend: "No", badge: "Yes", badge_name: "The Smiths", quote: "Hard to follow.", quote_permission: "No" }, () => undefined, NOW);
  assertEquals(ok, { status: "ok", step: 3, unlocked: "chapter_1" }); // delivery: _shared/wired-pilot-chapters.ts (private storage)
  route({ step1_at: "x", step2_at: "x", step3_at: "2026-12-18T00:00:00Z" }, { firstQuiz: "2026-12-01T00:00:00Z" });
  const s = await nextStep(DB, "f", "c", NOW);
  assertEquals(s, { next: "retake", opens_at: "2026-12-31T00:00:00.000Z", retake_needed: true });
  route({ step1_at: "x", step2_at: "x", step3_at: "x" }, { firstQuiz: "2026-11-01T00:00:00Z", retakeDone: false });
  assertEquals((await submitSurvey(DB, "f", "c", "retake", { big_change: "No", answered_differently: "No" }, () => undefined, NOW)).status, "not_yet");
  route({ step1_at: "x", step2_at: "x", step3_at: "x" }, { firstQuiz: "2026-11-01T00:00:00Z", retakeDone: true });
  assertEquals(await submitSurvey(DB, "f", "c", "retake", { big_change: "No", answered_differently: "No" }, () => undefined, NOW),
    { status: "ok", step: 4, unlocked: "chapter_4" });
  route({ step1_at: "x", step2_at: "x", step3_at: "x", step4_at: "x" });
  assertEquals((await submitSurvey(DB, "f", "c", "ux", { capabilities: 5, easy: 5 }, () => undefined, NOW)).status, "already");
});

Deno.test("Founding Families name and the quote are kept only with her permission", async () => {
  const seen = route({ step1_at: "x", step2_at: "2026-12-01T00:00:00Z" });
  await submitSurvey(DB, "f", "c", "family_map", { recommend: "Yes", badge: "No thanks", badge_name: "Smiths", quote: "Loved it", quote_permission: "No" }, () => undefined, NOW);
  const patch = seen.find((s) => s.method === "PATCH" && s.url.includes("wired_pilot_progress"))!.body as Record<string, unknown>;
  assertEquals([patch.badge_permission, patch.badge_name, patch.quote_permission], [false, null, false]);
});
