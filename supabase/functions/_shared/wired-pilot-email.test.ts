// Wired W12: the pilot selection emails (approved copy, 2026-11-20) and their 15-minute sender.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { buildSelectionEmail, SELECTION_COPY, sendDuePilotSelectionEmails, UNDO_MINUTES } from "./wired-pilot-email.ts";

const SNAPSHOT = new URL("../../../docs/wired-copy/Wired_Quiz_Pilot_Pieces.md", import.meta.url);

Deno.test("selection emails: every line word for word from the approved section 5", async () => {
  const md = await Deno.readTextFile(SNAPSHOT);
  const sec = md.slice(md.indexOf("## 5. Selection emails"));
  assertStringIncludes(sec, "APPROVED");
  for (const c of Object.values(SELECTION_COPY)) {
    assertStringIncludes(sec, `Subject: ${c.subject}`);
    for (const line of c.body) if (line !== "[button]") assertStringIncludes(sec, line);
    if (c.button) assertStringIncludes(sec, `Button: ${c.button.label}`);
  }
  // No "we'll email you when it opens" promise in the decline (the application keeps answers to the test only).
  assert(!SELECTION_COPY.declined.body.join(" ").includes("email you"));
});

Deno.test("selection emails: greeting, button with UTM, signature, address, no unsubscribe", () => {
  const yes = buildSelectionEmail("selected", "Sarah");
  assertEquals(yes.subject, "You're in! Testing Fearfully & Wonderfully Wired");
  assertStringIncludes(yes.html, "Hi Sarah,");
  assertStringIncludes(yes.html, "https://edeninstitute.health/wired?utm_source=email&amp;utm_medium=nurture&amp;utm_campaign=wired_pilot&amp;utm_content=pilot_selected");
  assertStringIncludes(yes.text, "Start the quiz: https://edeninstitute.health/wired?utm_source=email&utm_medium=nurture&utm_campaign=wired_pilot&utm_content=pilot_selected");
  assertStringIncludes(yes.text, "Camila\n\nThe Eden Institute");
  assertStringIncludes(yes.text, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
  assert(!/unsubscribe|UNSUB_URL/i.test(yes.html + yes.text));
  const no = buildSelectionEmail("declined", null);
  assertEquals(no.subject, "Thank you for applying to test the Wired quiz");
  assertStringIncludes(no.html, "Hi,");
  assert(!no.html.includes("/wired?"));
});

type Call = { url: string; method: string; body?: Record<string, unknown>; headers?: Record<string, string> };
function fake(rows: Record<string, unknown>[], opts: { claim?: boolean; resendOk?: boolean } = {}): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input); const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string> });
    if (url.startsWith("https://api.resend.com")) {
      return Promise.resolve(new Response(JSON.stringify(opts.resendOk === false ? { message: "boom" } : { id: "re_1" }), { status: opts.resendOk === false ? 500 : 200 }));
    }
    if (method === "GET") return Promise.resolve(new Response(JSON.stringify(rows), { status: 200 }));
    const claim = method === "PATCH" && (JSON.parse(String(init.body)) as Record<string, unknown>).selection_email_kind !== undefined
      && (JSON.parse(String(init.body)) as Record<string, unknown>).selection_email_kind !== null;
    if (claim) return Promise.resolve(new Response(JSON.stringify(opts.claim === false ? [] : rows.slice(0, 1)), { status: 200 }));
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;
  return calls;
}
const DB = { url: "https://db", key: "k" };
const NOW = new Date("2027-03-01T15:00:00Z");
const ROW = { id: "11111111-1111-1111-1111-111111111111", email: " sarah@example.com ", first_name: "Sarah", status: "selected", decided_at: "2027-03-01T14:30:00Z" };

Deno.test("sender: only choices older than 15 minutes, claimed, one Idempotency-Key per application, marked sent", async () => {
  const calls = fake([ROW]);
  const out = await sendDuePilotSelectionEmails(DB, { resendKey: "rk", from: "f", replyTo: "r", now: NOW });
  assertEquals(out.sent, 1);
  const list = calls[0].url;
  assertStringIncludes(list, "status=in.(selected,declined)");
  assertStringIncludes(list, "selection_email_kind=is.null");
  assertStringIncludes(list, `decided_at=lte.${encodeURIComponent(new Date(NOW.getTime() - UNDO_MINUTES * 60_000).toISOString())}`);
  const claim = calls[1];
  assertStringIncludes(claim.url, "status=eq.selected");
  assertEquals(claim.body, { selection_email_kind: "selected" });
  const send = calls.find((c) => c.url.startsWith("https://api.resend.com"))!;
  assertEquals(send.headers!["Idempotency-Key"], `wired-pilot-selection:${ROW.id}`);
  assertEquals(send.body!.to, ["sarah@example.com"]);
  assertEquals(send.body!.subject, SELECTION_COPY.selected.subject);
  const mark = calls[calls.length - 1];
  assertEquals(mark.body!.selection_email_id, "re_1");
  assertEquals(mark.body!.selection_email_at, NOW.toISOString());
});

Deno.test("sender: a lost claim (she changed it, or another run won) sends nothing", async () => {
  const calls = fake([ROW], { claim: false });
  const out = await sendDuePilotSelectionEmails(DB, { resendKey: "rk", from: "f", replyTo: "r", now: NOW });
  assertEquals(out.sent, 0);
  assert(!calls.some((c) => c.url.startsWith("https://api.resend.com")));
});

Deno.test("sender: a failed send releases the claim for the next run; dry run touches nothing", async () => {
  let calls = fake([ROW], { resendOk: false });
  let out = await sendDuePilotSelectionEmails(DB, { resendKey: "rk", from: "f", replyTo: "r", now: NOW });
  assertEquals(out.failed, 1);
  const release = calls[calls.length - 1];
  assertEquals(release.body, { selection_email_kind: null });
  assertStringIncludes(release.url, "selection_email_at=is.null");
  calls = fake([ROW]);
  out = await sendDuePilotSelectionEmails(DB, { resendKey: "rk", from: "f", replyTo: "r", now: NOW, dryRun: true });
  assertEquals(calls.length, 1);
  assertEquals(out.due, 1);
});
