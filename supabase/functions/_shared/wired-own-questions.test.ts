// 2026-11-21 (Lane 2, Camila's taps relayed by Lane NP):
//   item 7, "Use as written": the pilot wording on the pilot delivery emails (em-blueprint, em-familymap) and on
//           em-update for a tester's child; paid buyers' emails unchanged;
//   item 8, "Build it, as written": her own questions (adult-v1) from the results page and the complete Family Map
//           (her pages + the lines that need her answers), queued once and sent on the transactional rail;
//   PR #829 follow-up (16:27-16:29 CT): Q1 her private link on both delivery buttons (paid + pilot), Q2 the complete
//           map's own email (em-familymap-complete), Q3 the whole planning line for every mom.
// No network: a fake PostgREST + a fake Resend, like the other wired tests.
import { assert, assertEquals, assertStringIncludes, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCompleteMapEmail, buildDeliveryEmail } from "./wired-delivery-email.ts";
import { buildTxEmail, pilotFooterLine, pilotVersion, txCopy } from "./wired-email-tx.ts";
import { WIRED_PDF_COPY } from "./wired-pdf-content.ts";
import { isPilotJob } from "./wired-pdf-job.ts";
import { buildFamilyMapPdf, momPages, weekLineFor, youAndEachChildLines, type BlueprintData, type MomData } from "./wired-pdf.ts";
import { drainEmailQueue, FAMILY_MAP_UPDATE_WAIT_MINUTES } from "./wired-email-drain.ts";
import { adultBodyFromToken, familyMapOwnQuestions, processSubmission, queueFamilyMapUpdate, quizYearStart } from "./wired-submit-flow.ts";
import { parseSubmission } from "./wired-submit-core.ts";
import { signWiredToken } from "./wired-token.ts";
import { DOMAINS, quizYear } from "./wired-engine.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

Deno.env.set("WIRED_LINK_SECRET", "w".repeat(64));
Deno.env.set("UNSUB_SIGNING_SECRET", "u".repeat(64));

const SNAPSHOT = new URL("../../../docs/wired-copy/", import.meta.url);
const approved = (f: string) => Deno.readTextFileSync(new URL(f, SNAPSHOT)).replace(/\r\n/g, "\n");
const PILOT_BP = "Thank you for testing the quiz! Here is Lily's Learner Blueprint, your gift for finishing the first survey.";
const PILOT_FM = "Thank you for the second survey! Your Family Learning Map is attached, with a full Blueprint for each child.";
const PILOT_FOOT = "You're getting this because you're testing the Fearfully & Wonderfully Wired quiz.";
const PAID_FOOT = "You're getting this because of your Wired quiz order.";
const ADDRESS = "303 Holly Cir, Unit 3262, Clarksville, TN 37043";
const unesc = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&#8203;/g, "");

// ── Item 7: the pilot wording ────────────────────────────────────────────────

Deno.test("item 7: the pilot strings are read from the approved notes, word for word (and are in the approved file)", () => {
  const tx = approved("Wired_Quiz_Emails_Transactional.md");
  const bp = pilotVersion(WIRED_PDF_COPY.emails["Blueprint delivery (`em-blueprint`)"], "em-blueprint");
  assertEquals(bp.firstLine, "Thank you for testing the quiz! Here is [Nickname]'s Learner Blueprint, your gift for finishing the first survey.");
  assertEquals(bp.footerSentence, PILOT_FOOT);
  const fm = pilotVersion(WIRED_PDF_COPY.emails["Family Map delivery (`em-familymap`)"], "em-familymap");
  assertEquals(fm.firstLine, PILOT_FM);
  assertEquals(fm.footerSentence, PILOT_FOOT);
  const up = pilotVersion(txCopy("em-update"), "em-update");
  assertEquals(up.firstLine, null);
  assertEquals(up.footerSentence, PILOT_FOOT);
  for (const s of [bp.firstLine!, fm.firstLine!, PILOT_FOOT]) assertStringIncludes(tx, s);
  // The pilot footer line built from the paid one is exactly the approved em-blueprint pilot footer.
  assertStringIncludes(tx, `"${pilotFooterLine(`${PAID_FOOT} Delete my quiz data · [business name and mailing address]`, PILOT_FOOT)}"`);
});

Deno.test("item 7: pilot Blueprint delivery = the pilot first line + pilot footer; everything else as the paid email", () => {
  const paid = buildDeliveryEmail("blueprint", { firstName: "Sarah", nickname: "Lily", resultsToken: "TOK" });
  const pilot = buildDeliveryEmail("blueprint", { firstName: "Sarah", nickname: "Lily", pilot: true, resultsToken: "TOK" });
  assertStringIncludes(unesc(pilot.html), PILOT_BP);
  assertStringIncludes(pilot.text, PILOT_BP);
  assert(!pilot.text.includes("Thank you! Lily's Learner Blueprint is attached."));
  assertStringIncludes(unesc(pilot.html), PILOT_FOOT);
  assert(!unesc(pilot.html).includes(PAID_FOOT) && !pilot.text.includes(PAID_FOOT));
  // The address row comes from the same constant the paid footer uses; the delete link stays.
  assertStringIncludes(unesc(pilot.html), ADDRESS);
  assertStringIncludes(pilot.text, `Rooted in Faith Ventures LLC · ${ADDRESS}`);
  assertStringIncludes(pilot.html, "https://edeninstitute.health/wired/delete");
  assertEquals(pilot.subject, paid.subject);
  assertEquals(pilot.buttonUrl, paid.buttonUrl);
  // Line by line, only the first line and the footer sentence differ.
  const a = paid.text.split("\n\n"), b = pilot.text.split("\n\n");
  assertEquals(a.length, b.length);
  const diff = a.map((s, k) => (s === b[k] ? null : [s, b[k]])).filter(Boolean);
  assertEquals(diff, [["Thank you! Lily's Learner Blueprint is attached.", PILOT_BP], [PAID_FOOT, PILOT_FOOT]]);
});

Deno.test("item 7: pilot Family Map delivery, with and without her own answers", () => {
  for (const hasOwnAnswers of [false, true]) {
    const paid = buildDeliveryEmail("family_map", { firstName: "Sarah", hasOwnAnswers, resultsToken: "TOK" });
    const pilot = buildDeliveryEmail("family_map", { firstName: "Sarah", hasOwnAnswers, pilot: true, resultsToken: "TOK" });
    const a = paid.text.split("\n\n"), b = pilot.text.split("\n\n");
    const diff = a.map((s, k) => (s === b[k] ? null : [s, b[k]])).filter(Boolean);
    assertEquals(diff, [["Thank you! Your Family Learning Map is attached, with a full Blueprint for each child.", PILOT_FM], [PAID_FOOT, PILOT_FOOT]], `hasOwnAnswers=${hasOwnAnswers}`);
    assertEquals(pilot.text.includes("One quick step:"), !hasOwnAnswers);
  }
});

Deno.test("item 7: paid delivery emails are unchanged (pilot false = no pilot flag) and carry no pilot wording", () => {
  for (const kind of ["blueprint", "family_map"] as const) {
    const o = { firstName: "Sarah", nickname: "Lily", hasOwnAnswers: false, resultsToken: "TOK" };
    assertEquals(buildDeliveryEmail(kind, { ...o, pilot: false }), buildDeliveryEmail(kind, o));
    const m = buildDeliveryEmail(kind, o);
    assertStringIncludes(m.text, PAID_FOOT);
    assert(!m.text.includes("testing") && !m.text.includes("survey"), kind);
  }
});

Deno.test("PR #829 Q1: both delivery buttons carry her private link (signed results token), paid and pilot, like em-update", async () => {
  const token = await signWiredToken({ familyId: "11111111-1111-4111-8111-111111111111", purpose: "results" });
  const link = (content: string) => `https://edeninstitute.health/wired/results?t=${encodeURIComponent(token)}&utm_source=email&utm_medium=email&utm_campaign=learner_quiz&utm_content=${content}`;
  for (const [kind, content, label] of [["blueprint", "blueprint_delivery", "Invite someone who knows Lily"], ["family_map", "family_map_delivery", "Answer my questions"]] as const) {
    for (const pilot of [false, true]) {
      const m = buildDeliveryEmail(kind, { firstName: "Sarah", nickname: "Lily", pilot, resultsToken: token });
      assertEquals(m.buttonUrl, link(content), `${kind} pilot=${pilot}`);
      assertStringIncludes(m.text, `${label}: ${link(content)}`);
      assertStringIncludes(m.html, `href="${link(content).replace(/&/g, "&amp;")}"`);
    }
    // A button with no private link is refused, so a tokenless link can never go out again.
    assertThrows(() => buildDeliveryEmail(kind, { firstName: "Sarah", nickname: "Lily" }), Error, "private link");
  }
  // The same shape em-update has always used: ?t=<token>&<the copy's tags>.
  const up = buildTxEmail("em-update", { firstName: "Sarah", nickname: "Lily", buttonUrl: `https://edeninstitute.health/wired/results?t=${encodeURIComponent(token)}` });
  assertEquals(up.buttonUrl, link("pdf_update"));
});

Deno.test("PR #829 Q1: the button URL is the ONLY difference from the paid emails before (origin/main 2bbce27)", () => {
  // Pinned from origin/main's builder: the old button pointed at /wired/results + tags, with no token.
  for (const [kind, content] of [["blueprint", "blueprint_delivery"], ["family_map", "family_map_delivery"]] as const) {
    const m = buildDeliveryEmail(kind, { firstName: "Sarah", nickname: "Lily", resultsToken: "TOK" });
    const old = `https://edeninstitute.health/wired/results?utm_source=email&utm_medium=email&utm_campaign=learner_quiz&utm_content=${content}`;
    assertEquals(m.buttonUrl, old.replace("?", "?t=TOK&"));
    assert(!m.text.replace(m.buttonUrl!, "").includes("t=TOK"));
  }
});

// ── PR #829 Q2: the complete Family Map's own email (em-familymap-complete) ──

const COMPLETE_FIRST = "Thank you for answering your own questions! Your complete Family Learning Map is attached, now with your own teaching-wiring pages.";
const REPLY = "Questions? Just reply to this email. It comes straight to me.";

Deno.test("PR #829 Q2: the complete-map email = its own approved subject, preview and lines, no button; footer by family", () => {
  const tx = approved("Wired_Quiz_Emails_Transactional.md");
  for (const s of ["Subject: Your complete Family Learning Map", "Preview: Your own pages are in. Here's the whole map.", COMPLETE_FIRST, REPLY]) assertStringIncludes(tx, s);
  for (const pilot of [false, true]) {
    const m = buildCompleteMapEmail({ firstName: "Sarah", pilot });
    assertEquals(m.subject, "Your complete Family Learning Map");
    assertEquals(m.preview, "Your own pages are in. Here's the whole map.");
    const foot = pilot ? PILOT_FOOT : PAID_FOOT;
    assertEquals(m.text.split("\n\n"), [
      "Hi Sarah,", COMPLETE_FIRST, REPLY, "Camila", "The Eden Institute", "", foot,
      `Rooted in Faith Ventures LLC · ${ADDRESS}`, "Delete my quiz data: https://edeninstitute.health/wired/delete",
    ]);
    // No button: the only link is the footer's Delete my quiz data.
    assertEquals([...m.html.matchAll(/<a href="([^"]+)"/g)].map((x) => x[1].split("?")[0]), ["https://edeninstitute.health/wired/delete"]);
    assert(!m.html.includes("Answer my questions") && !m.html.includes("One quick step"));
    assertStringIncludes(unesc(m.html), foot);
    assert(!unesc(m.html).includes(pilot ? PAID_FOOT : PILOT_FOOT));
    assertStringIncludes(m.html, "Your own pages are in."); // the hidden preview line
  }
  assertEquals(buildCompleteMapEmail({ firstName: null }).text.split("\n\n")[0], "Hi,");
});

Deno.test("item 7: em-update for a tester's family = the pilot footer; paid em-update unchanged; no pilot version for em-teen", () => {
  const o = { firstName: "Sarah", nickname: "Ben", role: "a grandparent", buttonUrl: "https://edeninstitute.health/wired/results?t=x" };
  const paid = buildTxEmail("em-update", o);
  const pilot = buildTxEmail("em-update", { ...o, pilot: true });
  assertEquals(buildTxEmail("em-update", { ...o, pilot: false }), paid);
  assertStringIncludes(paid.text, `${PAID_FOOT} Delete my quiz data: https://edeninstitute.health/wired/delete`);
  assertStringIncludes(pilot.text, `${PILOT_FOOT} Delete my quiz data: https://edeninstitute.health/wired/delete`);
  assertStringIncludes(pilot.text, `Rooted in Faith Ventures LLC · ${ADDRESS}`);
  assert(!pilot.text.includes(PAID_FOOT));
  assertEquals(pilot.text.replace(PILOT_FOOT, PAID_FOOT), paid.text);
  assertEquals(pilot.subject, paid.subject);
  assertEquals(pilot.unsubscribe, false);
  assertThrows(() => buildTxEmail("em-teen", { ...o, pilot: true }), Error, "no approved pilot version");
});

Deno.test("item 7: a pilot job = no order and no buyer (wired_pilot_grant); a paid job never reads as one", () => {
  assertEquals(isPilotJob({ order_id: null, buyer_id: null }), true);
  assertEquals(isPilotJob({ order_id: "o1", buyer_id: "b1" }), false);
  assertEquals(isPilotJob({ order_id: null, buyer_id: "b1" }), false); // a paid job whose order row went away
  assertEquals(isPilotJob({ order_id: "o1", buyer_id: null }), false);
});

// ── Item 8: her pages in the Family Map ──────────────────────────────────────

const scores = Object.fromEntries(DOMAINS.map((d, i) => [d, 90 - i * 8])) as Record<typeof DOMAINS[number], number>;
const kid = (nickname: string, top3: string[]): BlueprintData => ({
  nickname, grade: 3, scores, top3: top3 as BlueprintData["top3"], answeredOn: new Date("2026-11-18"), observerCount: 0, matches: [], comingSoonBand: null,
});
const side = (key: string, band: "left" | "balance" | "right", label: string) => ({ key, band, label });
const MOM: MomData = {
  top3: ["organizer", "storyteller", "cultivator"],
  teaching: [
    side("structure", "left", "leans toward a steady routine"),
    side("planning", "left", "leans toward planning ahead"),
    side("capacity", "right", "is running close to empty right now"),
    side("resistance", "balance", "a balance of both"),
  ],
};

Deno.test("item 8: her teaching-wiring page = the approved opening, her top-3 blocks and one line per side by band", () => {
  const p = momPages(MOM);
  const screens = approved("Wired_Quiz_Family_Map_And_Screens.md").replace(/\s+/g, " ");
  assertEquals(p.opening, ["You're wired too. Here's what you reach for, and how you like to teach. None of it is right or wrong: it's how God made you to lead your home school. Your top 3 wirings are below, then the four sides of your teaching style."]);
  assertEquals(p.wirings.map((w) => w.wiring), ["organizer", "storyteller", "cultivator"]);
  assertEquals(p.wirings[0].lines[0], "You bring order: a plan, a schedule, clear steps. Your kids know what to expect, and that helps them settle.");
  assertEquals(p.style.map((s) => s.title), ["Structure", "Planning", "Capacity", "Resistance"]);
  assertEquals(p.style[0].line, "You love a routine, and it gives your kids a sense of security. Build in a little wiggle room for the days that go sideways.");
  assertStringIncludes(p.style[2].line, "Your tank is running low right now.");
  assertEquals(p.style[3].line, "You flex when it helps and hold steady when it matters.");
  for (const s of [...p.opening, ...p.wirings.flatMap((w) => w.lines), ...p.style.map((x) => x.line)]) assertStringIncludes(screens, s);
});

Deno.test("item 8: 'You and each child' = one line per child, with 'an Organizer'; the 4-day line follows her capacity band", () => {
  const lines = youAndEachChildLines(MOM, [kid("Lily", ["maker", "designer", "seeker"]), kid("Ben", ["organizer", "maker", "seeker"])]);
  assertEquals(lines, [
    "You and each child: you're an Organizer; Lily is a Maker. When the two differ, offer Lily a way in that isn't your own favorite.",
    "You and each child: you're an Organizer; Ben is an Organizer. When the two differ, offer Ben a way in that isn't your own favorite.",
  ]);
  const energy = "If your energy is low right now, try a 4-day week and keep only the family morning and skills time on the lightest days.";
  assertEquals(weekLineFor(energy, MOM), energy);                       // low-capacity band adds the 4-day line
  const flow: MomData = { ...MOM, teaching: [side("planning", "right", "leans toward deciding in the moment"), side("capacity", "balance", "a balance of both")] };
  assertEquals(weekLineFor(energy, flow), null);
  assertEquals(weekLineFor(energy, { ...MOM, teaching: [side("capacity", "left", "has room to spare right now")] }), null);
  assertEquals(weekLineFor(energy, null), null);                       // needs her answers
});

Deno.test("PR #829 Q3: the planning line is the WHOLE approved line for every mom, whatever her planning result (or none yet)", () => {
  const WHOLE = "If you lean toward planning ahead, plan this week on the weekend. If you lean toward the moment, plan only Monday morning and let the rest follow.";
  const raw = WIRED_PDF_COPY.familyMap["Your family's week"].find((i) => i.t === "li" && i.s.startsWith("If you lean"))!.s;
  assertStringIncludes(raw, "Whole line, every mom");                  // the master carries Camila's tap as a note...
  for (const band of ["left", "balance", "right"] as const) {
    const mom: MomData = { ...MOM, teaching: [side("planning", band, band === "left" ? "leans toward planning ahead" : band === "right" ? "leans toward deciding in the moment" : "a balance of both")] };
    assertEquals(weekLineFor(raw, mom), WHOLE, band);                  // ...which never prints: both sentences, nothing else
  }
  assertEquals(weekLineFor(raw, null), WHOLE);                         // also in the first copy, before her answers
  assertStringIncludes(approved("Wired_Quiz_Family_Map_And_Screens.md"), WHOLE);
});

Deno.test("item 8: the Family Map with her answers adds her page and stays under budget; without them it is the first copy", async () => {
  const kids = [kid("Lily", ["maker", "designer", "seeker"]), kid("Ben", ["organizer", "maker", "seeker"])];
  const now = new Date("2026-11-21T12:00:00Z");
  const first = await buildFamilyMapPdf({ children: kids, now });
  const complete = await buildFamilyMapPdf({ children: kids, now, mom: MOM });
  const pages = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();
  assertEquals(await pages(complete), (await pages(first)) + 1);
  assertEquals(await pages(await buildFamilyMapPdf({ children: kids, now, mom: null })), await pages(first));
  assert(complete.length < 3 * 1024 * 1024);
});

// ── Item 8: queue once, the token path, the page's two fields ────────────────

const FAM = "11111111-1111-4111-8111-111111111111";
const KID = "22222222-2222-4222-8222-222222222222";
const KID2 = "44444444-4444-4444-8444-444444444444";
const ROW = "33333333-3333-4333-8333-333333333333";
const JOB = "55555555-5555-4555-8555-555555555555";
const SES = "66666666-6666-4666-8666-666666666666";
const OBS = "77777777-7777-4777-8777-777777777777";
const DB = { url: "https://db", key: "k" };
type Seen = { url: string; method: string; body?: unknown };
type Handler = (path: string, method: string, body: unknown) => unknown;

function route(handler: Handler): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    seen.push({ url, method, body });
    if (url.startsWith("https://api.resend.com")) return Promise.resolve(new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    const path = decodeURIComponent(url.split("/rest/v1/")[1] ?? "");
    const v = handler(path, method, body);
    return Promise.resolve(new Response(v === undefined || v === null ? null : JSON.stringify(v), { status: v === undefined || v === null ? 204 : 200 }));
  }) as typeof fetch;
  return seen;
}

Deno.test("item 8: queueFamilyMapUpdate adds ONE pdf_update row (no child, no observer) only for a Family Map family", async () => {
  const now = new Date("2026-11-21T15:00:00Z");
  const y = quizYear(now);
  for (const [hasMap, existing, want] of [[true, false, true], [false, false, false], [true, true, false]] as const) {
    const seen = route((p, m) => {
      if (p.startsWith("wired_pdf_jobs?")) return hasMap ? [{ id: JOB }] : [];
      if (p.startsWith("wired_email_queue?") && m === "GET") return existing ? [{ id: ROW }] : [];
      if (p === "wired_email_queue" && m === "POST") return null;
      return [];
    });
    assertEquals(await queueFamilyMapUpdate(DB, FAM, " Mom@Example.com ", now), want);
    const posts = seen.filter((s) => s.method === "POST");
    assertEquals(posts.length, want ? 1 : 0);
    if (want) {
      assertEquals(posts[0].body, { family_id: FAM, child_id: null, observer_id: null, email: "mom@example.com", kind: "pdf_update", scheduled_for: now.toISOString() });
      const jobRead = seen.find((s) => s.url.includes("wired_pdf_jobs?"))!.url;
      assertStringIncludes(jobRead, `family_id=eq.${FAM}&kind=eq.family_map&quiz_year=eq.${y}`);
      const dup = decodeURIComponent(seen.find((s) => s.url.includes("wired_email_queue?"))!.url);
      assertStringIncludes(dup, `kind=eq.pdf_update&child_id=is.null&observer_id=is.null&created_at=gte.${quizYearStart(y).toISOString()}`);
    }
  }
  assertEquals(quizYearStart(2026).toISOString(), "2026-07-01T05:00:00.000Z"); // July 1, midnight Central (CDT)
});

const ADULT_BANK = JSON.parse(Deno.readTextFileSync(new URL("./wired-banks/adult-v1.json", import.meta.url)));
const adultAnswers = () => ({
  scenarios: Object.fromEntries(ADULT_BANK.scenarios.map((s: { id: string }) => [s.id, `${s.id}-a`])),
  frequency: Object.fromEntries(ADULT_BANK.frequency.map((f: { id: string }) => [f.id, 3])),
  teaching: Object.fromEntries(ADULT_BANK.teaching_style.dimensions.flatMap((d: { items: { id: string }[] }) => d.items.map((i) => [i.id, 2]))),
});

Deno.test("item 8: her first adult-v1 answers queue the complete map once; a repeat (already_completed) queues nothing", async () => {
  for (const status of ["ok", "already_completed"]) {
    let rpcBody: Record<string, unknown> | null = null;
    const seen = route((p, m, body) => {
      if (p.startsWith("wired_question_banks?")) return [{ bank: ADULT_BANK }];
      if (p === "rpc/wired_submit") { rpcBody = (body as { p: Record<string, unknown> }).p; return { status, family_id: FAM, session_id: SES }; }
      if (p.startsWith("wired_pdf_jobs?")) return [{ id: JOB }];
      if (p.startsWith("wired_email_queue?") && m === "GET") return [];
      return null;
    });
    const parsed = parseSubmission({ email: "mom@example.com", set: "adult", bank_version: "adult-v1", answers: adultAnswers() });
    assert(parsed.ok);
    const out = await processSubmission(DB, parsed.value, { pepper: "p".repeat(40) });
    assertEquals(out.status, status);
    assertEquals((rpcBody as unknown as Record<string, unknown>)?.child, null);
    assertEquals(((rpcBody as unknown as Record<string, unknown>)?.teaching_style as unknown[]).length, 4);
    const queued = seen.filter((s) => s.method === "POST" && s.url.endsWith("/rest/v1/wired_email_queue"));
    assertEquals(queued.length, status === "ok" ? 1 : 0, status);
    if (status === "ok") assertEquals((out as { family_map_update?: boolean }).family_map_update, true);
  }
});

Deno.test("item 8: the results-page form {set:'adult', token} takes the email from the token's family; bad token = null", async () => {
  const token = await signWiredToken({ familyId: FAM, purpose: "results" });
  const seen = route((p) => (p.startsWith(`wired_families?id=eq.${FAM}&select=email`) ? [{ email: "mom@example.com" }] : []));
  const body = { set: "adult", token, bank_version: "adult-v1", answers: adultAnswers(), email: "someone-else@example.com", first_name: "X" };
  const out = await adultBodyFromToken(DB, body) as Record<string, unknown>;
  assertEquals(out.email, "mom@example.com");
  assert(!("token" in out) && !("first_name" in out));
  assertEquals(out.bank_version, "adult-v1");
  assertEquals(seen.length, 1);
  assert(parseSubmission(out).ok);
  assertEquals(await adultBodyFromToken(DB, { ...body, token: "nope" }), null);
  const child = { email: "a@b.co", child: { nickname: "Lily", grade: 2 } };
  assertEquals(await adultBodyFromToken(DB, child), child);                    // the quiz itself: unchanged
  const plain = { set: "adult", email: "a@b.co" };
  assertEquals(await adultBodyFromToken(DB, plain), plain);                    // the adult set by email: unchanged
  route(() => []);
  assertEquals(await adultBodyFromToken(DB, body), null);                      // the family is gone
});

Deno.test("item 8: wired-results' two fields, read for the token's family only and this quiz year", async () => {
  const now = new Date("2026-11-21T15:00:00Z");
  for (const [map, own] of [[true, false], [true, true], [false, false]] as const) {
    const seen = route((p) => (p.startsWith("wired_pdf_jobs?") ? (map ? [{ id: JOB }] : []) : p.startsWith("wired_family_results?") ? (own ? [{ family_id: FAM }] : []) : []));
    assertEquals(await familyMapOwnQuestions(DB, FAM, now), { has_family_map: map, own_questions_answered: own });
    for (const s of seen) assertStringIncludes(s.url, `family_id=eq.${FAM}`);
    assert(seen.every((s) => s.url.includes(`quiz_year=eq.${quizYear(now)}`)));
  }
  assertEquals(await familyMapOwnQuestions(DB, "not-a-uuid", now), { has_family_map: false, own_questions_answered: false });
});

// ── Item 8 + 7 through the drain: the complete Family Map, and em-update's footer ──

const FA = { kids: "2", prep: "open_and_go", budget: "unsure", approach: "unsure", frustration: "time", esa: "no" };
interface MapWorld {
  job?: Record<string, unknown> | null;
  own?: { quiz_year: number; computed_at: string } | null;
  unlockedVia?: string;
  rowKind?: "family_map_update" | "em_update";
}
function drainWorld(w: MapWorld): Seen[] {
  const row = w.rowKind === "em_update"
    ? { id: ROW, family_id: FAM, email: "mom@example.com", child_id: KID, observer_id: OBS, kind: "pdf_update", position: null, retry_count: 0, created_at: "2026-11-21T15:00:00Z" }
    : { id: ROW, family_id: FAM, email: "mom@example.com", child_id: null, observer_id: null, kind: "pdf_update", position: null, retry_count: 0, created_at: "2026-11-21T15:00:00Z" };
  return route((p, m, body) => {
    if (p.startsWith("wired_email_queue?") && m === "GET") return [row];
    if (p.startsWith("wired_email_queue?") && m === "PATCH") {
      const b = body as Record<string, unknown>;
      return b.retry_count !== undefined && !("scheduled_for" in b) ? [row] : null;
    }
    if (p.startsWith("rpc/email_send_blocked")) return false;
    if (p.startsWith("wired_families?")) return [{ id: FAM, email: "mom@example.com", first_name: "Sarah" }];
    if (p.startsWith("wired_pdf_jobs?")) return w.job ? [w.job] : [];
    if (p.startsWith("wired_family_results?") && p.includes("select=quiz_year,computed_at")) return w.own ? [w.own] : [];
    if (p.startsWith("wired_family_results?")) {
      return w.own ? [{ adult_scores: scores, session_id: SES, teaching_style: MOM.teaching }] : [];
    }
    if (p.startsWith("wired_sessions?id=eq.")) return [{ top3: MOM.top3 }];
    if (p.startsWith("wired_buyers?")) return [{ email: "mom@example.com" }];
    if (p.startsWith("wired_unlocks?")) return [{ child_id: KID }, { child_id: KID2 }];
    if (p.startsWith("wired_children?id=eq.")) return [{ nickname: "Lily", unlocked_via: w.unlockedVia ?? "family_map" }];
    if (p.startsWith("wired_children?id=in.")) {
      return [{ id: KID, nickname: "Lily", grade: 2, created_at: "2026-11-01T00:00:00Z" }, { id: KID2, nickname: "Ben", grade: 5, created_at: "2026-11-02T00:00:00Z" }]
        .filter((k) => p.includes(k.id));
    }
    if (p.startsWith("wired_observers?")) return [{ id: OBS, label: "Grandparent" }];
    if (p.startsWith("wired_results?")) return [{ quiz_year: 2026, blended_scores: scores, top3: DOMAINS.slice(0, 3), computed_at: "2026-11-18T00:00:00Z", renaissance: false, matches_snapshot: null }];
    if (p.startsWith("wired_sessions?")) return [{ family_answers: FA, completed_at: "2026-11-18T00:00:00Z", rater_role: "mom", observer_id: null, scores, top3: DOMAINS.slice(0, 3) }];
    return [];
  });
}
const OPTS = { resendKey: "re_key", from: "Camila <hello@edeninstitute.health>", replyTo: "hello@edeninstitute.health" };
const resendBody = (s: Seen[]) => s.find((x) => x.url.startsWith("https://api.resend.com"))?.body as Record<string, unknown> | undefined;
const patches = (s: Seen[]) => s.filter((x) => x.method === "PATCH" && x.url.includes("wired_email_queue")).map((x) => x.body as Record<string, unknown>);
const job = (over: Record<string, unknown>) => ({
  id: JOB, family_id: FAM, child_id: null, order_id: "o1", buyer_id: "b1", kind: "family_map", quiz_year: 2026, attempts: 1,
  status: "sent", claimed_at: "2026-11-20T10:00:00Z", ...over,
});
const OWN = { quiz_year: 2026, computed_at: "2026-11-21T15:00:00Z" };

Deno.test("drain: the complete Family Map (paid): her pages attached, its own approved email (em-familymap-complete), transactional, sent", async () => {
  const seen = drainWorld({ job: job({}), own: OWN });
  const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
  assertEquals(out.sent, 1);
  const r = resendBody(seen)!;
  assertEquals(r.subject, "Your complete Family Learning Map");
  assertEquals(r.to, ["mom@example.com"]);
  assertEquals(r.text, buildCompleteMapEmail({ firstName: "Sarah", pilot: false }).text);
  assertStringIncludes(String(r.text), COMPLETE_FIRST);
  assert(!String(r.text).includes("One quick step:") && !String(r.text).includes("Answer my questions"));
  assertStringIncludes(String(r.text), PAID_FOOT);
  assertEquals((r.attachments as { filename: string }[])[0].filename, "Family-Learning-Map.pdf");
  assertEquals(r.tags, [{ name: "category", value: "wired_family_map_update" }]);
  assert(!("headers" in r), "no list unsubscribe: transactional");
  // The paid order's own children, and her answers for her pages.
  assert(seen.some((s) => decodeURIComponent(s.url).includes("wired_unlocks?order_id=eq.o1&product=eq.family_map")));
  assert(seen.some((s) => s.url.includes(`wired_sessions?id=eq.${SES}`)));
  // Never the one-a-day guard.
  assert(!seen.some((s) => s.url.includes("nurture_send_log")));
  assert(patches(seen).some((p) => typeof p.sent_at === "string"));
  // Her page is in the attached PDF: one page more than the copy without her answers.
  const pdf = await PDFDocument.load(Uint8Array.from(atob((r.attachments as { content: string }[])[0].content), (c) => c.charCodeAt(0)));
  assert(pdf.getPageCount() > 4);
});

Deno.test("drain: the complete Family Map for a pilot family carries the pilot wording", async () => {
  const seen = drainWorld({ job: job({ order_id: null, buyer_id: null }), own: OWN });
  await drainEmailQueue(DB, OPTS);
  const r = resendBody(seen)!;
  // The same approved lines as a paid family (PR #829 Q2), with the pilot footer.
  assertEquals(r.subject, "Your complete Family Learning Map");
  assertEquals(r.text, buildCompleteMapEmail({ firstName: "Sarah", pilot: true }).text);
  assertStringIncludes(String(r.text), COMPLETE_FIRST);
  assertStringIncludes(String(r.text), PILOT_FOOT);
  assert(!String(r.text).includes(PILOT_FM) && !String(r.text).includes(PAID_FOOT));
  assert(seen.some((s) => decodeURIComponent(s.url).includes(`wired_unlocks?family_id=eq.${FAM}&product=eq.pilot_family_map`)));
});

Deno.test("drain: the complete Family Map waits while the first one is still being built; skips when it already had her pages", async () => {
  for (const status of ["queued", "building"]) {
    const seen = drainWorld({ job: job({ status, claimed_at: null }), own: OWN });
    const before = Date.now();
    const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
    assertEquals(out.deferred, 1, status);
    assertEquals(resendBody(seen), undefined);
    const moved = patches(seen).find((p) => "scheduled_for" in p)!;
    assertEquals(moved.retry_count, 0);
    assert(Date.parse(String(moved.scheduled_for)) >= before + (FAMILY_MAP_UPDATE_WAIT_MINUTES * 60_000) - 1000);
  }
  for (const [w, reason] of [
    [{ job: job({ claimed_at: "2026-11-21T16:00:00Z" }), own: OWN }, "family_map_had_her_pages"],
    [{ job: null, own: OWN }, "no_family_map"],
    [{ job: job({}), own: null }, "no_own_answers"],
  ] as [MapWorld, string][]) {
    const seen = drainWorld(w);
    const out = await drainEmailQueue(DB, OPTS) as Record<string, number>;
    assertEquals(out.skipped, 1, reason);
    assertEquals(resendBody(seen), undefined, reason);
    assert(patches(seen).some((p) => p.skipped_reason === reason), reason);
  }
});

Deno.test("drain: em-update footer = pilot for a tester's child, the order footer for a paid child", async () => {
  const pilot = drainWorld({ rowKind: "em_update", unlockedVia: "pilot" });
  await drainEmailQueue(DB, OPTS);
  const p = resendBody(pilot)!;
  assertEquals(p.subject, "Lily's updated Blueprint");
  assertStringIncludes(String(p.text), `${PILOT_FOOT} Delete my quiz data`);
  const paid = drainWorld({ rowKind: "em_update", unlockedVia: "blueprint" });
  await drainEmailQueue(DB, OPTS);
  const q = resendBody(paid)!;
  assertStringIncludes(String(q.text), `${PAID_FOOT} Delete my quiz data`);
  assert(!String(q.text).includes(PILOT_FOOT));
  assertEquals(q.tags, [{ name: "category", value: "wired_pdf_update" }]);
});
