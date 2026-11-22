// W8b drain: emails 2-10 + July through a fake PostgREST + a fake Resend (no network).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { drainEmailQueue, EM4_IMAGE } from "./wired-email-drain.ts";
import { LEARNER_DRIP_POSITIONS, queueLearnerDrip } from "./wired-submit-flow.ts";
import { DOMAINS, quizYear } from "./wired-engine.ts";

Deno.env.set("WIRED_LINK_SECRET", "w".repeat(64));
Deno.env.set("UNSUB_SIGNING_SECRET", "u".repeat(64));

const FAM = "11111111-1111-4111-8111-111111111111";
const KID = "22222222-2222-4222-8222-222222222222";
const ROW = "33333333-3333-4333-8333-333333333333";
const scores = Object.fromEntries(DOMAINS.map((d, i) => [d, 90 - i * 8]));
const FA = { kids: "1", prep: "open_and_go", budget: "unsure", approach: "unsure", frustration: "time", esa: "no" };

interface World {
  row: Record<string, unknown>;
  unlocked_via?: string | null;
  blocked?: boolean;
  logOwner?: string | null;       // who holds today's nurture_send_log row
  resendStatus?: number;
  resendName?: string;
  curricula?: Record<string, unknown>[];
  prefs?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
  buyers?: Record<string, unknown>[];   // wired_buyers rows (em-6: the $28 upgrade)
  unlocks?: Record<string, unknown>[];  // wired_unlocks rows
  pilotStatus?: string;                 // her wired_pilot_applications status (2026-11-22 tester skips)
}
type Seen = { url: string; method: string; body?: unknown };

function install(w: World): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    seen.push({ url, method, body });
    const j = (v: unknown, s = 200) => Promise.resolve(new Response(v === null ? null : JSON.stringify(v), { status: s }));
    if (url.startsWith("https://api.resend.com")) return j(w.resendStatus === 409 ? { name: w.resendName ?? "invalid_idempotent_request", statusCode: 409 } : w.resendStatus && w.resendStatus >= 400 ? { message: "nope" } : { id: "re_1" }, w.resendStatus ?? 200);
    const path = url.split("/rest/v1/")[1] ?? "";
    if (path.startsWith("wired_email_queue?") && method === "GET") return j([w.row]);
    if (path.startsWith("wired_email_queue?") && method === "PATCH") return j(body?.retry_count !== undefined && !("scheduled_for" in body) ? [w.row] : null, body?.retry_count !== undefined && !("scheduled_for" in body) ? 200 : 204);
    if (path.startsWith("rpc/email_send_blocked")) return j(w.blocked === true);
    if (path.startsWith("nurture_send_log?on_conflict")) {
      if (w.logOwner && w.logOwner !== ROW) return j([], 201);
      w.logOwner = ROW; return j([{ id: "l" }], 201);
    }
    if (path.startsWith("nurture_send_log?email_lower")) return j(w.logOwner ? [{ queue_row_id: w.logOwner }] : []);
    if (path.startsWith("nurture_send_log?queue_row_id") && method === "DELETE") { w.logOwner = null; return j(null, 204); }
    // Real columns only (id, email, first_name, created_at): a select naming any other column is a 400, like PostgREST.
    if (path.startsWith("wired_families?")) {
      const sel = (path.match(/select=([^&]+)/)?.[1] ?? "").split(",");
      if (sel.some((c) => !["id", "email", "first_name", "created_at"].includes(c))) return j({ code: "42703", message: "column does not exist" }, 400);
      return j([{ id: FAM, email: "mom@example.com", first_name: "Sarah" }]);
    }
    if (path.startsWith("wired_children?id=eq.") && path.includes("select=unlocked_via")) return j([{ unlocked_via: w.unlocked_via === undefined ? "free" : w.unlocked_via }]);
    if (path.startsWith("wired_children?id=in.")) return j([{ id: KID, nickname: "Lily", grade: 3, created_at: "2026-11-01T00:00:00Z" }]);
    if (path.startsWith("wired_children?family_id=")) return j([{ id: KID, nickname: "Lily", grade: 3 }]);
    if (path.startsWith("wired_pilot_applications?")) return j(w.pilotStatus ? [{ status: w.pilotStatus }] : []);
    if (path.startsWith("wired_family_prefs?")) return j(w.prefs ?? []);
    if (path.startsWith("wired_buyers?")) return j(w.buyers ?? []);
    if (path.startsWith("wired_unlocks?")) return j(w.unlocks ?? []);
    if (path.startsWith("wired_family_results?")) return j([]);
    if (path.startsWith("wired_curricula?") && path.includes("mom_pros")) return j([{ mom_pros: ["Short, cheerful daily lessons."] }]);
    if (path.startsWith("wired_curricula?") && path.includes("affiliate_url")) return j((w.curricula ?? []).map((c) => ({ id: c.id, url: c.url, affiliate_url: c.affiliate_url ?? null, is_affiliate: c.is_affiliate ?? false, subjects: c.subjects, price_cents: c.price_cents, prep_load: c.prep_load })));
    if (path.startsWith("wired_curricula?")) return j(w.curricula ?? []);
    if (path.startsWith("wired_results?") && path.includes("select=quiz_year&")) return j(w.results ?? [{ quiz_year: 2025 }]);
    if (path.startsWith("wired_results?")) return j([{ quiz_year: 2026, blended_scores: scores, top3: DOMAINS.slice(0, 3), computed_at: "2026-11-18T00:00:00Z", renaissance: false }]);
    if (path.startsWith("wired_sessions?")) return j([{ family_answers: FA, completed_at: "2026-11-18T00:00:00Z", rater_role: "mom" }]);
    return j([]);
  }) as typeof fetch;
  return seen;
}

const DB = { url: "https://db", key: "k" };
const OPTS = { resendKey: "re_key", from: "Camila <hello@edeninstitute.health>", replyTo: "hello@edeninstitute.health" };
const row = (kind: string, position: number) => ({ id: ROW, family_id: FAM, email: "mom@example.com", child_id: kind === "july" ? null : KID, kind, position, retry_count: 0, created_at: "2026-11-18T00:00:00Z" });
const resendCall = (s: Seen[]) => s.find((x) => x.url.startsWith("https://api.resend.com"));
const patches = (s: Seen[]) => s.filter((x) => x.method === "PATCH").map((x) => x.body as Record<string, unknown>);

Deno.test("em-2 sends: claims today, no attachment, learner tags, marked sent", async () => {
  const w: World = { row: row("drip", 2) };
  const seen = install(w);
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out.sent, 1);
  const r = resendCall(seen)!.body as Record<string, unknown>;
  assertEquals(r.subject, "What a Storyteller looks like at home");
  assert(!("attachments" in r));
  assertStringIncludes(String(r.html), "utm_content=email_2");
  assert(!String(r.html).includes("{{UNSUB_URL}}"));
  assertEquals(w.logOwner, ROW);
  assert(patches(seen).some((p) => typeof p.sent_at === "string"));
});

Deno.test("one a day: another Eden email already went today -> held to 8 AM Central tomorrow, nothing sent", async () => {
  const w: World = { row: row("drip", 3), logOwner: "someone-else" };
  const seen = install(w);
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out.deferred, 1);
  assertEquals(out.sent, 0);
  assertEquals(resendCall(seen), undefined);
  const moved = patches(seen).find((p) => "scheduled_for" in p)!;
  assertEquals(moved.retry_count, 0); // the claim's +1 is given back
  assert(String(moved.scheduled_for).endsWith(":00:00.000Z"));
});

Deno.test("a failed send gives today back (the claim is released) and counts a failure", async () => {
  const w: World = { row: row("drip", 2), resendStatus: 500 };
  const seen = install(w);
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out.failed, 1);
  assertEquals(w.logOwner, null);
  assert(seen.some((x) => x.method === "DELETE" && x.url.includes("nurture_send_log")));
});

Deno.test("skips: suppressed, em-9 until pilot quotes, em-4 once she owns a Blueprint, a removed child", async () => {
  for (const [w, reason] of [
    [{ row: row("drip", 5), blocked: true }, "suppressed"],
    [{ row: row("drip", 9) }, "pilot_quotes_pending"],
    [{ row: row("drip", 4), unlocked_via: "blueprint" }, "already_has_blueprint"],
    [{ row: row("drip", 4), unlocked_via: "family_map" }, "already_has_blueprint"],
    [{ row: row("drip", 6), unlocked_via: null }, "child_locked_or_removed"],
  ] as [World, string][]) {
    const seen = install(w);
    const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
    assertEquals(out.skipped, 1, reason);
    assertEquals(resendCall(seen), undefined, reason);
    assert(patches(seen).some((p) => p.skipped_reason === reason), reason);
    assertEquals(w.logOwner ?? null, null, `${reason}: a skipped email never takes the day`);
  }
});

Deno.test("em-4 shows the real Blueprint Math page for the top wiring", async () => {
  const seen = install({ row: row("drip", 4) });
  await drainEmailQueue(DB, OPTS);
  assertStringIncludes(String((resendCall(seen)!.body as Record<string, unknown>).html), EM4_IMAGE("storyteller"));
});

Deno.test("em-6: a one-child family gets the one-child paragraph", async () => {
  const seen = install({ row: row("drip", 6) });
  await drainEmailQueue(DB, OPTS);
  const html = String((resendCall(seen)!.body as Record<string, unknown>).html);
  assert(!html.includes("If you&#39;re teaching more than one child") && !html.includes("If you're teaching more than one child"));
});

Deno.test("em-6: a Blueprint bought this quiz year (no Family Map) swaps in the $28 line; otherwise the $47 sentence", async () => {
  const ORDER = "44444444-4444-4444-8444-444444444444";
  const bp = { product: "blueprint", order_id: ORDER, refunded_at: null, disputed_at: null, purchased_at: "2026-11-19T00:00:00Z" };
  const seen = install({ row: row("drip", 6), buyers: [bp], unlocks: [{ order_id: ORDER, child_id: KID }] });
  await drainEmailQueue(DB, OPTS);
  const text = String((resendCall(seen)!.body as Record<string, unknown>).text);
  assertStringIncludes(text, "You already have Lily's Blueprint, so the Family Map is $28 for you this school year.");
  assert(!text.includes("$47"));
  assert(seen.some((x) => x.url.includes(`wired_buyers?family_id=eq.${FAM}&quiz_year=eq.${quizYear(new Date())}&`)), "this quiz year only");

  for (const w of [
    { row: row("drip", 6) },                                                                                      // no Blueprint
    { row: row("drip", 6), buyers: [{ ...bp, refunded_at: "2026-11-20T00:00:00Z" }], unlocks: [{ order_id: ORDER, child_id: KID }] }, // refunded
    { row: row("drip", 6), buyers: [bp, { ...bp, product: "family_map", order_id: ROW }], unlocks: [{ order_id: ORDER, child_id: KID }] }, // owns the Family Map
  ] as World[]) {
    const s2 = install(w);
    await drainEmailQueue(DB, OPTS);
    const t = String((resendCall(s2)!.body as Record<string, unknown>).text);
    assertStringIncludes(t, "It's $47 for up to 5 kids.");
    assert(!t.includes("$28"));
  }
});

Deno.test("em-7 with no matched curriculum is skipped, never sent half-filled", async () => {
  const seen = install({ row: row("drip", 7), curricula: [] });
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out.skipped, 1);
  assertEquals(resendCall(seen), undefined);
});

Deno.test("July 1: one email per family, grade + 1; July 15 skips a family that already retested", async () => {
  const seen = install({ row: row("july", 1) });
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out.sent, 1);
  const r = resendCall(seen)!.body as Record<string, unknown>;
  assertStringIncludes(String(r.html), "utm_content=july_1");
  // Her retake link: the private /wired/retake page with a signed 'retake' token for that child, no child data.
  const href = String(r.html).match(/href="(https:\/\/edeninstitute\.health\/wired\/retake\?r=[^"]+)"/)?.[1];
  assert(href, "retake link");
  const tok = decodeURIComponent(href!.replace(/&amp;/g, "&").split("?r=")[1].split("&")[0]);
  const { verifyWiredToken } = await import("./wired-token.ts");
  const grant = await verifyWiredToken(tok, "retake");
  assertEquals(grant?.familyId, FAM);
  assert(grant?.childId, "child in the token");
  assert(!/Lily|nickname|grade=/i.test(href!), "no child data in the URL");
  const now = new Date();
  const thisYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const seen2 = install({ row: row("july", 2), results: [{ quiz_year: thisYear }] });
  const out2 = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out2.skipped, 1);
  assertEquals(resendCall(seen2), undefined);
});

Deno.test("founder test send: real email to the test inbox, no day claimed, row put back", async () => {
  const w: World = { row: row("drip", 8) };
  const seen = install(w);
  const out = await drainEmailQueue(DB, { ...OPTS, emailId: ROW, testTo: "hello@edeninstitute.health" }) as Record<string, number>;
  assertEquals(out.sent, 0);
  const r = resendCall(seen)!.body as Record<string, unknown>;
  assertEquals(r.to, ["hello@edeninstitute.health"]);
  assertEquals(w.logOwner ?? null, null);
  assert(!patches(seen).some((p) => "sent_at" in p));
});

Deno.test("queueLearnerDrip: positions 2-8 and 10 (never 9), 8 AM Central on days 2..30, once per family", async () => {
  let existing: unknown[] = [];
  const posted: Record<string, unknown>[][] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    if ((init.method ?? "GET") === "POST") { posted.push(JSON.parse(String(init.body))); return Promise.resolve(new Response(null, { status: 201 })); }
    return Promise.resolve(new Response(JSON.stringify(existing)));
  }) as typeof fetch;
  const n = await queueLearnerDrip(DB, FAM, KID, " Mom@Example.com", new Date("2026-11-20T20:00:00Z"));
  assertEquals(n, 8);
  assertEquals(posted[0].map((r) => r.position), [...LEARNER_DRIP_POSITIONS]);
  assert(!posted[0].some((r) => r.position === 9));
  assertEquals(posted[0][0].scheduled_for, "2026-11-22T14:00:00.000Z");
  assertEquals(posted[0][7].scheduled_for, "2026-12-20T14:00:00.000Z");
  assertEquals(posted[0][0].email, "mom@example.com");
  existing = [{ id: "x" }];
  assertEquals(await queueLearnerDrip(DB, FAM, KID, "mom@example.com"), 0);
});

Deno.test("Resend already took this row's key (409 invalid_idempotent_request): marked sent, never a failure; concurrent: put back", async () => {
  const w: World = { row: row("drip", 2), resendStatus: 409 };
  const seen = install(w);
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals([out.sent, out.failed], [1, 0]);
  assert(patches(seen).some((p) => typeof p.sent_at === "string"));
  assertEquals(w.logOwner, ROW); // the day stays claimed: the email did go out
  const w2: World = { row: row("drip", 2), resendStatus: 409, resendName: "concurrent_idempotent_requests" };
  const seen2 = install(w2);
  const out2 = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals([out2.sent, out2.failed], [0, 0]);
  assert(!patches(seen2).some((p) => "sent_at" in p));
});

Deno.test("pilot testers (Camila 2026-11-22, 'Skip the 3 sales emails'): em-4, em-6, em-10 never send; content emails do", async () => {
  for (const pos of [4, 6, 10]) {
    const w: World = { row: row("drip", pos), pilotStatus: "selected" };
    const seen = install(w);
    const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
    assertEquals(out.skipped, 1, `em-${pos}`);
    assertEquals(resendCall(seen), undefined, `em-${pos}`);
    assert(patches(seen).some((p) => p.skipped_reason === "pilot_tester_no_sales"), `em-${pos}`);
    assert(seen.some((x) => x.url.includes("wired_pilot_applications?email=eq.mom%40example.com")), `em-${pos}: looked up by the family's email`);
  }
  // A content email still goes to a tester.
  const seen5 = install({ row: row("drip", 5), pilotStatus: "selected" });
  const out5 = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out5.sent, 1);
  assert(resendCall(seen5));
  // An applicant who was not picked (or anyone else) still gets em-4.
  for (const status of ["applied", "declined", undefined]) {
    const seen = install({ row: row("drip", 4), pilotStatus: status });
    const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
    assertEquals(out.sent, 1, String(status));
    assert(!patches(seen).some((p) => p.skipped_reason === "pilot_tester_no_sales"), String(status));
  }
});
