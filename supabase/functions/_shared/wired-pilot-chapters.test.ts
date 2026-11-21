// W12 pilot chapters: private storage, a fresh link per tap, a chapter-ready email to the PAGE (never the file).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { availableChapters, buildChapterEmail, CHAPTER_EMAIL, sendDueChapterEmails, signChapter } from "./wired-pilot-chapters.ts";

const DB = { url: "https://db.example", key: "k" };
const FAM = "11111111-1111-1111-1111-111111111111";
type Call = { url: string; method: string; body?: Record<string, unknown>; headers?: Record<string, string> };

function install(o: { files?: string[]; progress?: Record<string, unknown>[]; claim?: boolean; resendOk?: boolean } = {}): Call[] {
  const calls: Call[] = [];
  const files = o.files ?? ["chapter-1.pdf"];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input); const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string> });
    const j = (v: unknown, s = 200) => Promise.resolve(new Response(v === null ? null : JSON.stringify(v), { status: s }));
    if (url.includes("/storage/v1/object/sign/")) {
      const f = url.split("/").pop()!;
      return files.includes(f) ? j({ signedURL: `/object/sign/pilot-chapters/${f}?token=abc` }) : j({ statusCode: "404", error: "not_found" }, 400);
    }
    if (url.startsWith("https://api.resend.com")) return j(o.resendOk === false ? { message: "boom" } : { id: "re_1" }, o.resendOk === false ? 500 : 200);
    const p = url.split("/rest/v1/")[1] ?? "";
    if (p.startsWith("wired_families")) return j([{ email: "mom@example.com", first_name: "Sarah" }]);
    if (p.startsWith("wired_pilot_progress")) {
      if (method === "GET") return j(o.progress ?? [{ family_id: FAM, step3_at: "2027-03-01T00:00:00Z", step4_at: null }]);
      const b = JSON.parse(String(init.body)) as Record<string, unknown>;
      const isClaim = Object.values(b).some((v) => typeof v === "string");
      if (isClaim) return j(o.claim === false ? [] : [{ family_id: FAM }]);
      return j(null, 204);
    }
    return j([]);
  }) as typeof fetch;
  return calls;
}

Deno.test("signChapter: a fresh view link (no download=), null until the file is uploaded", async () => {
  install();
  const url = await signChapter(DB, 1);
  assertEquals(url, "https://db.example/storage/v1/object/sign/pilot-chapters/chapter-1.pdf?token=abc");
  assert(!url!.includes("download="));
  assertEquals(await signChapter(DB, 4), null);
});

Deno.test("availableChapters: only reached steps whose files exist", async () => {
  install({ progress: [{ family_id: FAM, step3_at: "x", step4_at: "y" }] });
  assertEquals(await availableChapters(DB, FAM), [1]);                  // chapter 4 not uploaded yet
  install({ files: ["chapter-1.pdf", "chapter-4.pdf"], progress: [{ family_id: FAM, step3_at: "x", step4_at: "y" }] });
  assertEquals(await availableChapters(DB, FAM), [1, 4]);
  install({ progress: [{ family_id: FAM, step3_at: null, step4_at: null }] });
  assertEquals(await availableChapters(DB, FAM), []);
  install({ progress: [] });
  assertEquals(await availableChapters(DB, FAM), []);
});

Deno.test("chapter email: links to her tester page with her token, never to the file", () => {
  const m = buildChapterEmail(1, "Sarah", "tok.sig");
  assertEquals(m.subject, CHAPTER_EMAIL[1].subject);
  assertStringIncludes(m.html, "Hi Sarah,");
  assertStringIncludes(m.html, 'href="https://edeninstitute.health/wired/pilot?t=tok.sig"');
  assert(!/storage\/v1|\.pdf/.test(m.html + m.text), "no file link");
  assertStringIncludes(m.text, "Read Chapter 1: https://edeninstitute.health/wired/pilot?t=tok.sig");
  assertStringIncludes(m.text, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
});

Deno.test("sender: waits for the file; then claims, sends once per family + chapter, releases on failure", async () => {
  const opts = { resendKey: "rk", from: "f", replyTo: "r", signToken: () => Promise.resolve("tok.sig") };
  let calls = install({ files: [] });
  let out = await sendDueChapterEmails(DB, opts);
  assertEquals(out.sent, 0);
  assert(!calls.some((c) => c.url.startsWith("https://api.resend.com")));
  calls = install();
  out = await sendDueChapterEmails(DB, opts);
  assertEquals(out.sent, 1);
  assertStringIncludes(calls[0].url, "step3_at=not.is.null&ch1_emailed_at=is.null");
  const send = calls.find((c) => c.url.startsWith("https://api.resend.com"))!;
  assertEquals(send.headers!["Idempotency-Key"], `wired-pilot-chapter-1:${FAM}`);
  assertEquals(send.body!.to, ["mom@example.com"]);
  calls = install({ claim: false });
  out = await sendDueChapterEmails(DB, opts);
  assertEquals(out.sent, 0);
  calls = install({ resendOk: false });
  out = await sendDueChapterEmails(DB, opts);
  assertEquals(out.failed, 1);
  assert(calls.some((c) => c.method === "PATCH" && JSON.stringify(c.body) === JSON.stringify({ ch1_emailed_at: null })), "claim released");
});

Deno.test("chapter copy: emails and page lines word for word from the approved section 6", async () => {
  const md = await Deno.readTextFile(new URL("../../../docs/wired-copy/Wired_Quiz_Pilot_Pieces.md", import.meta.url));
  const sec = md.slice(md.indexOf("## 6. Advance chapter delivery"));
  assert(sec.startsWith("## 6. Advance chapter delivery (APPROVED"), "approved section present");
  const ch4 = sec.slice(sec.indexOf("### Chapter 4 email"));
  const ch1 = sec.slice(sec.indexOf("### Chapter 1 email"), sec.indexOf("### Chapter 4 email"));
  for (const [n, part] of [[1, ch1], [4, ch4]] as const) {
    const c = CHAPTER_EMAIL[n];
    assertStringIncludes(part, `Subject: ${c.subject}`);
    for (const line of c.body) if (line !== "[button]") assertStringIncludes(part, line);
    assertStringIncludes(part, `Button: ${c.button}`);
  }
  const web = await Deno.readTextFile(new URL("../../../web/lib/wiredPilotCopy.ts", import.meta.url));
  for (const s of ["Heading: Your advance chapters", "Line: Thank you for testing the quiz.", "Read Chapter 1: The Mouth of the South", "Read Chapter 4: Judge a Fish"]) assertStringIncludes(sec, s);
  for (const s of ["Your advance chapters", "Thank you for testing the quiz. Here's your gift: early chapters of my upcoming book, Unschooled by Design.", "Read Chapter 1: The Mouth of the South", "Read Chapter 4: Judge a Fish"]) assertStringIncludes(web, s);
  assertStringIncludes(sec, "Line: Thank you for testing the quiz. Here's your gift: early chapters of my upcoming book, Unschooled by Design.");
});
