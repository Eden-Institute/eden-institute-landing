// deno test --no-lock --allow-env --allow-net --allow-read supabase/functions/_shared/wired-pilot-pass.test.ts
//
// The testers-only pilot gate (founder tap via Lane NP, 2026-11-22). With the pilot switch on and the quiz dark, a
// public wired-* function opens ONLY for a selected tester (pilot pass, her family's link token, or a rater code from
// her family). Selection is read live. The preview pass and WIRED_ENABLED behave exactly as before. A fake PostgREST.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { PASS_HEADER, testerFromPass, wiredAccess, wiredTesterGate, WIRED_PASS_CORS } from "./wired-pilot-pass.ts";
import { signWiredToken } from "./wired-token.ts";
import { sha256Hex } from "./wired-raters.ts";
import { buildSelectionEmail, pilotButtonUrl } from "./wired-pilot-email.ts";
import { verifyWiredToken } from "./wired-token.ts";

Deno.env.set("WIRED_LINK_SECRET", "s".repeat(64));

const APP = "aaaaaaaa-1111-4111-8111-111111111111";
const FAM = "bbbbbbbb-2222-4222-8222-222222222222";
const PREVIEW = "p".repeat(32);
const CODE = "C".repeat(43);
const DB = { url: "https://db", key: "k" };

interface World { appStatus?: string; appEmail?: string; famEmail?: string; observerFamily?: string | null; teenFamily?: string | null; down?: boolean }
function install(w: World): string[] {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    seen.push(url);
    if (w.down) return new Response("boom", { status: 503 });
    const path = decodeURIComponent(url.split("/rest/v1/")[1] ?? "");
    const j = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
    if (path.startsWith("wired_pilot_applications?")) {
      if (!w.appStatus) return j([]);
      const email = (w.appEmail ?? "Tester@Example.com");
      if (path.includes("id=eq.") && !path.includes(`id=eq.${APP}`)) return j([]);
      if (path.includes("email=eq.") && !path.includes(`email=eq.${email.trim().toLowerCase()}`)) return j([]);
      return j([{ id: APP, email, status: w.appStatus }]);
    }
    if (path.startsWith("wired_families?")) return j(path.includes(`id=eq.${FAM}`) && w.famEmail ? [{ email: w.famEmail }] : []);
    if (path.startsWith("wired_observers?")) return j(w.observerFamily ? [{ family_id: w.observerFamily }] : []);
    if (path.startsWith("wired_teen_links?")) return j(w.teenFamily ? [{ wired_children: { family_id: w.teenFamily } }] : []);
    return j([]);
  }) as typeof fetch;
  return seen;
}

const envOf = (vars: Record<string, string | undefined>) => (k: string) =>
  k in vars ? vars[k] : ({ SUPABASE_URL: DB.url, SUPABASE_SERVICE_ROLE_KEY: DB.key, WIRED_PREVIEW_TOKEN: PREVIEW } as Record<string, string>)[k];
const ON = envOf({ WIRED_PILOT_OPEN: "true" });
const OFF = envOf({});
const req = (headers: Record<string, string> = {}, method = "POST") => new Request("https://x/functions/v1/wired-bank", { method, headers });
const pass = (p: string) => ({ [PASS_HEADER]: p });

Deno.test("switch OFF: a valid pilot pass opens nothing (the same dark 404 as before)", async () => {
  install({ appStatus: "selected" });
  const p = await signWiredToken({ familyId: APP, purpose: "pilot" });
  const a = await wiredAccess(req(pass(p)), OFF);
  assert(!a.ok);
  if (!a.ok) {
    assertEquals(a.response.status, 404);
    assertEquals(await a.response.json(), { error: "not_found" });
  }
});

Deno.test("WIRED_ENABLED and the preview pass still open, with no database read", async () => {
  const seen = install({});
  assertEquals((await wiredAccess(req(), envOf({ WIRED_ENABLED: "true" }))).ok, true);
  const a = await wiredAccess(req({ "x-wired-preview": PREVIEW }), ON);
  assert(a.ok && a.via === "open" && a.tester === null);
  assertEquals(seen.length, 0);
});

Deno.test("switch ON: the pilot pass opens for a SELECTED application only, read live", async () => {
  const p = await signWiredToken({ familyId: APP, purpose: "pilot" });
  install({ appStatus: "selected", appEmail: " Tester@Example.com " });
  const a = await wiredAccess(req(pass(p)), ON);
  assert(a.ok && a.via === "tester");
  if (a.ok && a.via === "tester") assertEquals(a.tester, { applicationId: APP, email: "tester@example.com", via: "pilot" });
  for (const status of ["applied", "declined"]) {
    install({ appStatus: status });
    const b = await wiredAccess(req(pass(p)), ON);
    assert(!b.ok, status);
    if (!b.ok) assertEquals(b.response.status, 404, status);
  }
  install({});
  assertEquals((await wiredTesterGate(req(pass(p)), ON))?.status, 404, "no application row");
});

Deno.test("switch ON: her family's link tokens count as the pass (results, retake, teen, delete), by the family's email", async () => {
  for (const purpose of ["results", "retake", "teen", "delete"] as const) {
    const t = await signWiredToken({ familyId: FAM, purpose });
    const seen = install({ appStatus: "selected", famEmail: "tester@example.com" });
    const a = await wiredAccess(req(pass(t)), ON);
    assert(a.ok && a.via === "tester", purpose);
    if (a.ok && a.via === "tester") assertEquals(a.tester.via, "family");
    assert(seen.some((u) => u.includes("wired_pilot_applications?email=eq.tester%40example.com")), purpose);
    install({ appStatus: "applied", famEmail: "tester@example.com" });
    assert(!(await wiredAccess(req(pass(t)), ON)).ok, `${purpose}: not picked`);
  }
});

Deno.test("switch ON: a rater code from her family opens (used or not); another family's does not", async () => {
  const hash = await sha256Hex(CODE);
  const seen = install({ appStatus: "selected", famEmail: "tester@example.com", observerFamily: FAM });
  assert((await wiredAccess(req(pass(`rater:observer:${CODE}`)), ON)).ok);
  assert(seen.some((u) => u.includes(`token_hash=eq.${hash}`)));
  install({ appStatus: "selected", famEmail: "tester@example.com", teenFamily: FAM });
  assert((await wiredAccess(req(pass(`rater:teen:${CODE}`)), ON)).ok);
  install({ appStatus: "selected", famEmail: "tester@example.com", observerFamily: null });
  assert(!(await wiredAccess(req(pass(`rater:observer:${CODE}`)), ON)).ok);
  install({ appStatus: "selected" });
  assert(!(await wiredAccess(req(pass("rater:observer:short")), ON)).ok, "not a link code");
});

Deno.test("switch ON: no header, junk, tampered, wrong secret or expired -> 404", async () => {
  install({ appStatus: "selected", famEmail: "tester@example.com" });
  const p = await signWiredToken({ familyId: APP, purpose: "pilot" });
  const tampered = p.slice(0, -2) + (p.endsWith("A") ? "BB" : "AA");
  const expired = await signWiredToken({ familyId: APP, purpose: "pilot" }, Math.floor(Date.now() / 1000) - 200 * 86400);
  for (const h of [{}, pass("nope"), pass(tampered), pass(expired), pass("x".repeat(2000))]) {
    assertEquals((await wiredTesterGate(req(h), ON))?.status, 404);
  }
});

Deno.test("a missing link secret or an unreachable database is a 500, never a quiet pass", async () => {
  install({ appStatus: "selected" });
  const p = await signWiredToken({ familyId: APP, purpose: "pilot" });
  install({ down: true });
  assertEquals((await wiredTesterGate(req(pass(p)), ON))?.status, 500);
  const old = Deno.env.get("WIRED_LINK_SECRET")!;
  Deno.env.delete("WIRED_LINK_SECRET");
  try {
    install({ appStatus: "selected" });
    assertEquals((await wiredTesterGate(req(pass(p)), ON))?.status, 500);
  } finally {
    Deno.env.set("WIRED_LINK_SECRET", old);
  }
});

Deno.test("CORS preflight allows the x-wired-pass header", async () => {
  const r = await wiredTesterGate(req({}, "OPTIONS"), OFF);
  assertEquals(r?.status, 200);
  assertStringIncludes(r!.headers.get("Access-Control-Allow-Headers")!, PASS_HEADER);
  assertStringIncludes(WIRED_PASS_CORS["Access-Control-Allow-Headers"], "x-wired-preview");
});

Deno.test("testerFromPass ignores non-strings and empty values", async () => {
  install({ appStatus: "selected" });
  assertEquals(await testerFromPass(DB, null), null);
  assertEquals(await testerFromPass(DB, ""), null);
});

Deno.test("You're in: the button carries her pilot pass after the #, UTM before it; words unchanged; decline has no pass", async () => {
  const url = await pilotButtonUrl(APP);
  assert(url.startsWith("https://edeninstitute.health/wired#pilot="));
  const mail = buildSelectionEmail("selected", "Sarah", url);
  const m = mail.text.match(/Start the quiz: (\S+)/);
  assert(m);
  const sent = m![1];
  assert(sent.startsWith("https://edeninstitute.health/wired?utm_source=email&utm_medium=nurture&utm_campaign=wired_pilot&utm_content=pilot_selected#pilot="), sent);
  const token = sent.split("#pilot=")[1];
  const grant = await verifyWiredToken(token, "pilot");
  assertEquals(grant?.familyId, APP);
  assertStringIncludes(mail.html, `utm_content=pilot_selected#pilot=${token}`);
  // The same words as the approved email (only the link changed).
  const plain = buildSelectionEmail("selected", "Sarah");
  assertEquals(mail.subject, plain.subject);
  assertEquals(mail.text.replace(/#pilot=\S+/, ""), plain.text);
  const no = buildSelectionEmail("declined", "Sarah", url);
  assert(!no.html.includes("#pilot=") && !no.text.includes("#pilot="));
});
