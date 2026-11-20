// W9: teen links, observers, the rater blend, the must-send emails, the observer cron (no network).
import { assert, assertEquals, assertRejects, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTxEmail } from "./wired-email-tx.ts";
import { isLinkCode, newLinkCode, observerCode, processRaterSubmission, resolveRaterLink, sha256Hex, type RaterContext } from "./wired-raters.ts";
import { queueObserverReminders, sweepObserverEmails } from "./wired-observer-cron.ts";

Deno.env.set("WIRED_LINK_SECRET", "w".repeat(64));
const DB = { url: "https://db", key: "k" };
type Seen = { url: string; method: string; body?: unknown };
function route(handler: (path: string, method: string, body: unknown) => unknown, status = (_p: string, _m: string) => 200): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    seen.push({ url, method, body });
    const path = url.split("/rest/v1/")[1] ?? "";
    const v = handler(path, method, body);
    return Promise.resolve(new Response(v === null || v === undefined ? null : JSON.stringify(v), { status: v === null || v === undefined ? 204 : status(path, method) }));
  }) as typeof fetch;
  return seen;
}

// ── emails ──
Deno.test("observer invite: approved words, '[Nickname]'s mom' without a first name, address, no unsubscribe, the private link with its tags", () => {
  const m = buildTxEmail("em-obs-invite", { firstName: null, nickname: "Lily", buttonUrl: "https://edeninstitute.health/wired/observer?c=abc" });
  assertEquals(m.subject, "Lily's mom would love your help with Lily");
  assertStringIncludes(m.text, "Lily's mom is homeschooling Lily");
  assertStringIncludes(m.text, "because Lily's mom invited you");
  assertStringIncludes(m.text, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
  assertEquals(m.unsubscribe, false);
  assert(!m.html.includes("{{UNSUB_URL}}"));
  assertStringIncludes(m.buttonUrl!, "/wired/observer?c=abc&utm_source=email&utm_medium=email&utm_campaign=learner_quiz&utm_content=observer_invite");
  assert(!/\[[A-Za-z ]+\]/.test(m.text), m.text);
});

Deno.test("teen-ready carries the learner unsubscribe + the delete link; update names the role with a capital", () => {
  const t = buildTxEmail("em-teen", { firstName: "Sarah", nickname: "Ben", buttonUrl: "https://edeninstitute.health/wired/results?t=x" });
  assertEquals(t.unsubscribe, true);
  assertStringIncludes(t.html, "{{UNSUB_URL}}");
  assertStringIncludes(t.html, "https://edeninstitute.health/wired/delete");
  const u = buildTxEmail("em-update", { firstName: "Sarah", nickname: "Ben", role: "a grandparent", buttonUrl: "https://edeninstitute.health/wired/results?t=x" });
  assertEquals(u.preview, "A grandparent shared how they see Ben.");
  assertStringIncludes(u.text, "A grandparent just shared how they see Ben.");
  assertEquals(u.unsubscribe, false);
});

Deno.test("delete confirm + done: approved subjects, the confirm link, address only", () => {
  const c = buildTxEmail("em-delete-confirm", { buttonUrl: "https://edeninstitute.health/wired/delete?c=tok" });
  assertEquals(c.subject, "Confirm: delete your Wired quiz data");
  assertStringIncludes(c.buttonUrl!, "/wired/delete?c=tok&utm_source=email");
  assertStringIncludes(c.text, "The link works for 24 hours.");
  const d = buildTxEmail("em-delete-done", {});
  assertEquals(d.subject, "Your Wired quiz data is deleted");
  assertEquals(d.buttonUrl, null);
});

// ── link codes ──
Deno.test("link codes: 43 URL-safe characters, observer code stable per id and secret, never without the secret", async () => {
  const a = newLinkCode();
  assert(isLinkCode(a) && a.length === 43, a);
  assert(newLinkCode() !== a);
  const id = "11111111-1111-4111-8111-111111111111";
  assertEquals(await observerCode(id), await observerCode(id));
  assert(await observerCode(id) !== await observerCode("22222222-2222-4222-8222-222222222222"));
  assert(isLinkCode(await observerCode(id)));
  await assertRejects(() => observerCode(id, "short"));
});

const child = (over: Record<string, unknown> = {}) => ({ id: "c1", family_id: "f1", nickname: "Ben", grade: 10, removed_at: null, wired_families: { first_name: "Sarah" }, ...over });
Deno.test("resolveRaterLink (teen): ok, used, expired, unknown, removed child", async () => {
  const code = newLinkCode();
  const hash = await sha256Hex(code);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  let row: Record<string, unknown> | null = { id: "t1", quiz_year: 2026, expires_at: future, used_at: null, wired_children: child() };
  const seen = route((p) => (p.startsWith("wired_teen_links") ? (row ? [row] : []) : []));
  const ok = await resolveRaterLink(DB, "teen", code) as RaterContext;
  assertEquals([ok.kind, ok.childId, ok.setKind, ok.momName, ok.quizYear], ["teen", "c1", "teen", "Sarah", 2026]);
  assertStringIncludes(seen[0].url, `token_hash=eq.${hash}`);
  row = { ...row!, used_at: "2026-11-20T00:00:00Z" };
  assertEquals(await resolveRaterLink(DB, "teen", code), { error: "used" });
  row = { ...row!, used_at: null, expires_at: "2020-01-01T00:00:00Z" };
  assertEquals(await resolveRaterLink(DB, "teen", code), { error: "expired" });
  row = { ...row!, expires_at: future, wired_children: child({ removed_at: "2026-11-01" }) };
  assertEquals(await resolveRaterLink(DB, "teen", code), { error: "removed" });
  row = null;
  assertEquals(await resolveRaterLink(DB, "teen", code), { error: "invalid_link" });
  assertEquals(await resolveRaterLink(DB, "teen", "not a code"), { error: "invalid_link" });
});

Deno.test("resolveRaterLink (observer): the band set by grade; answered this year = used; removed = removed", async () => {
  const code = newLinkCode();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  let row: Record<string, unknown> = { id: "o1", family_id: "f1", label: "Dad", email: "dad@x.com", token_expires_at: future, removed_at: null, quiz_year: 2026, last_completed_quiz_year: null, wired_children: child({ grade: 4 }) };
  route((p) => (p.startsWith("wired_observers") ? [row] : []));
  const ok = await resolveRaterLink(DB, "observer", code) as RaterContext;
  assertEquals([ok.setKind, ok.label, ok.linkId], ["g3_5", "Dad", "o1"]);
  row = { ...row, last_completed_quiz_year: 2026 };
  assertEquals(await resolveRaterLink(DB, "observer", code), { error: "used" });
  row = { ...row, last_completed_quiz_year: null, email: null };
  assertEquals(await resolveRaterLink(DB, "observer", code), { error: "removed" });
});

// ── the rater blend: mom 50%, the teen 50%, through the ONE writer ──
const bankFile = async (v: string) => JSON.parse(await Deno.readTextFile(new URL(`./wired-banks/${v}.json`, import.meta.url)));
function answersFor(bank: { scenarios: { id: string; options: { id: string }[] }[]; frequency: { id: string }[] }, pick: number, freq: number) {
  return {
    scenarios: Object.fromEntries(bank.scenarios.map((s) => [s.id, s.options[pick % s.options.length].id])),
    frequency: Object.fromEntries(bank.frequency.map((f) => [f.id, freq])),
  };
}

Deno.test("teen submission: blended at exactly 50% mom / 50% teen, written by wired_submit as rater_role teen, link marked used, mom's email queued", async () => {
  const g912 = await bankFile("g912-v1");
  const teen = await bankFile("teen-v1");
  const momAnswers = answersFor(g912, 0, 5);
  const teenAnswers = answersFor(teen, 1, 1);
  let rpcBody: Record<string, any> | null = null;
  const seen = route((p, m, b) => {
    if (p.startsWith("wired_question_banks?version=eq.g912-v1")) return [{ bank: g912 }];
    if (p.startsWith("wired_question_banks?version=eq.teen-v1")) return [{ bank: teen }];
    if (p.startsWith("wired_families?")) return [{ email: "Mom@X.com" }];
    if (p.startsWith("wired_sessions?")) return [{ id: "s-mom", rater_role: "mom", bank_version: "g912-v1", raw_answers: momAnswers, family_answers: { kids: "1", prep: "light", budget: "unsure", approach: "unsure", frustration: "time", esa: "no" } }];
    if (p.startsWith("wired_results?")) return [{ matches_snapshot: { ranking: ["prep", "wiring", "budget", "siblings"] } }];
    if (p.startsWith("wired_family_prefs?")) return [];
    if (p.startsWith("wired_curricula?")) return [];
    if (p.startsWith("rpc/wired_submit")) { rpcBody = (b as { p: Record<string, any> }).p; return { status: "ok", session_id: "s-teen" }; }
    if (m === "PATCH" || m === "POST") return null;
    return [];
  });
  const ctx: RaterContext = { kind: "teen", linkId: "t1", familyId: "f1", childId: "c1", nickname: "Ben", grade: 10, quizYear: 2026, setKind: "teen", momName: "Sarah", label: null };
  const out = await processRaterSubmission(DB, ctx, "teen-v1", teenAnswers, new Date("2026-11-20T20:00:00Z"));
  assertEquals(out, { status: "ok", sessionId: "s-teen" });
  const p = rpcBody!;
  assertEquals([p.rater_role, p.child_id, p.observer_id, p.email, p.quiz_year], ["teen", "c1", null, "Mom@X.com", 2026]);
  assertEquals(p.results.expected_session_ids, ["s-mom"]);
  assertEquals(p.results.weights, { "s-mom": 0.5, new: 0.5 });
  assertEquals(p.results.matches_snapshot.ranking[0], "prep");
  assert(seen.some((s) => s.method === "PATCH" && s.url.includes("wired_teen_links?id=eq.t1") && typeof (s.body as Record<string, unknown>).used_at === "string"));
  const q = seen.find((s) => s.method === "POST" && s.url.endsWith("/wired_email_queue"))!.body as Record<string, unknown>;
  assertEquals([q.kind, q.email, q.child_id], ["teen_ready", "mom@x.com", "c1"]);
});

Deno.test("a rater can't go first: no mom quiz this year -> no_mom_quiz, nothing written", async () => {
  const teen = await bankFile("teen-v1");
  const seen = route((p) => (p.startsWith("wired_question_banks") ? [{ bank: teen }] : p.startsWith("wired_families") ? [{ email: "m@x.com" }] : []));
  const ctx: RaterContext = { kind: "teen", linkId: "t1", familyId: "f1", childId: "c1", nickname: "Ben", grade: 10, quizYear: 2026, setKind: "teen", momName: null, label: null };
  assertEquals(await processRaterSubmission(DB, ctx, "teen-v1", answersFor(teen, 0, 3)), { status: "no_mom_quiz" });
  assert(!seen.some((s) => s.url.includes("rpc/wired_submit")));
});

Deno.test("wrong question set for the link is refused", async () => {
  const g35 = await bankFile("g35-v1");
  route((p) => (p.startsWith("wired_question_banks") ? [{ bank: g35 }] : []));
  const ctx: RaterContext = { kind: "teen", linkId: "t1", familyId: "f1", childId: "c1", nickname: "Ben", grade: 10, quizYear: 2026, setKind: "teen", momName: null, label: null };
  const out = await processRaterSubmission(DB, ctx, "g35-v1", answersFor(g35, 0, 3));
  assertEquals(out.status, "bad_request");
});

// ── observer cron ──
Deno.test("reminder: day 5, unanswered, once; answered or already reminded = nothing", async () => {
  const obs = [
    { id: "o1", family_id: "f", child_id: "c", email: "a@x.com", invited_at: "2026-11-10T00:00:00Z", quiz_year: 2026, last_completed_quiz_year: null, token_expires_at: "2026-12-10T00:00:00Z" },
    { id: "o2", family_id: "f", child_id: "c", email: "b@x.com", invited_at: "2026-11-10T00:00:00Z", quiz_year: 2026, last_completed_quiz_year: 2026, token_expires_at: "2026-12-10T00:00:00Z" },
    { id: "o3", family_id: "f", child_id: "c", email: "c@x.com", invited_at: "2026-11-10T00:00:00Z", quiz_year: 2026, last_completed_quiz_year: null, token_expires_at: "2026-12-10T00:00:00Z" },
  ];
  const seen = route((p, m) => {
    if (p.startsWith("wired_observers?")) return obs;
    if (p.startsWith("wired_email_queue?observer_id=eq.o3")) return [{ id: "r" }];
    if (m === "POST") return null;
    return [];
  });
  const out = await queueObserverReminders(DB, new Date("2026-11-20T13:00:00Z"));
  assertEquals(out, { due: 3, queued: 1, would_queue: 1, answered: 1, already: 1 });
  assertStringIncludes(seen[0].url, "invited_at=lte.2026-11-15T13");
  const posted = seen.filter((s) => s.method === "POST").map((s) => s.body as Record<string, unknown>);
  assertEquals(posted.map((b) => [b.observer_id, b.kind, b.email]), [["o1", "observer_reminder", "a@x.com"]]);
});

Deno.test("sweep: an observer email is deleted after 2 Julys with no retest of that child, kept otherwise", async () => {
  const seen = route((p, m) => {
    if (p.startsWith("wired_observers?email=not.is.null")) return [{ id: "old", child_id: "c-old" }, { id: "new", child_id: "c-new" }];
    if (p.startsWith("wired_results?child_id=eq.c-old")) return [{ quiz_year: 2024 }];
    if (p.startsWith("wired_results?child_id=eq.c-new")) return [{ quiz_year: 2025 }];
    if (m === "PATCH") return null;
    return [];
  });
  const out = await sweepObserverEmails(DB, new Date("2026-11-20T13:00:00Z"));
  assertEquals(out, { checked: 2, deleted: 1, would_delete: 1 });
  const wiped = seen.find((s) => s.method === "PATCH" && s.url.includes("wired_observers?id=eq.old"))!.body as Record<string, unknown>;
  assertEquals([wiped.email, wiped.token_hash], [null, null]);
  assert(!seen.some((s) => s.method === "PATCH" && s.url.includes("wired_observers?id=eq.new")));
});
