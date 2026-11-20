// The Wired cart reminder: approved copy word for word, the 50/50 holdout, the send-time checks (no network).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildWiredCartEmail, cartKind, holdoutArm } from "./wired-cart-reminder.ts";
import { sendDueWiredCartReminders } from "./wired-cart-send.ts";
import { precheckExpiredSession } from "./checkout-recovery.ts";

const approved = await Deno.readTextFile(new URL("../../../docs/wired-copy/Wired_Quiz_Cart_Reminder.md", import.meta.url));

Deno.test("both emails are the approved copy, word for word", () => {
  for (const kind of ["blueprint", "family_map"] as const) {
    const m = buildWiredCartEmail(kind, { firstName: "Sarah", nickname: "[Nickname]", topWiring: "[Top wiring]", recoveryUrl: "https://checkout.stripe.com/r/x" });
    assertStringIncludes(approved, `Subject: ${m.subject}`);
    assertStringIncludes(approved, `Preview: ${m.preview}`);
    for (const line of m.text.split("\n\n").slice(1, -6)) {
      if (line.includes("https://checkout.stripe.com")) continue;
      assertStringIncludes(approved, line, kind);
    }
    assertStringIncludes(m.html, "{{UNSUB_URL}}");
    assertStringIncludes(m.text, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
    assert(!/utm_/.test(m.html), "the only link is Stripe's recovery link");
  }
  const b = buildWiredCartEmail("blueprint", { firstName: null, nickname: "Lily", topWiring: "Maker", recoveryUrl: "https://checkout.stripe.com/r/x" });
  assertEquals(b.subject, "Your Learner Blueprint for Lily");
  assertStringIncludes(b.text, "Hi,\n\nYou started Lily's Learner Blueprint");
  assertStringIncludes(b.text, "starting with their Maker side");
  assertEquals([cartKind("blueprint"), cartKind("blueprint_upgrade"), cartKind("family_map"), cartKind("family_map_upgrade")], ["blueprint", "family_map", "family_map", "family_map"]);
});

Deno.test("holdout: stable per session, about half and half", async () => {
  assertEquals(await holdoutArm("cs_test_1"), await holdoutArm("cs_test_1"));
  let holdout = 0;
  for (let i = 0; i < 400; i++) if ((await holdoutArm(`cs_live_${i}`)) === "holdout") holdout++;
  assert(holdout > 160 && holdout < 240, String(holdout));
});

Deno.test("precheck: the store branch still refuses a wired cart; the wired branch runs the same consent rules", () => {
  const s = { id: "cs_1", metadata: { lookup_key: "wired_cart", email: "m@x.com", reminder_consent: "true" }, consent: { promotions: null }, after_expiration: { recovery: { url: "https://checkout.stripe.com/r/x" } } };
  assertEquals(precheckExpiredSession(s).ok, false);
  assertEquals(precheckExpiredSession(s, { wired: true }).ok, true);
  assertEquals(precheckExpiredSession({ ...s, consent: { promotions: "opt_out" } }, { wired: true }).ok, false);
  assertEquals(precheckExpiredSession({ ...s, metadata: { lookup_key: "wired_cart", email: "m@x.com" } }, { wired: true }).ok, false);
});

function route(o: { bought?: boolean; recent?: boolean; product?: string }) {
  const seen: { url: string; method: string; body?: unknown }[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input); const method = init.method ?? "GET";
    seen.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const j = (v: unknown, st = 200) => Promise.resolve(new Response(v === null ? null : JSON.stringify(v), { status: st }));
    if (url.startsWith("https://api.resend.com")) return j({ id: "re_1" });
    const p = url.split("/rest/v1/")[1] ?? "";
    if (p.startsWith("checkout_recoveries?reason=eq.wired_scheduled&send_after")) return j([{ session_id: "cs_1", email: "Mom@X.com", recovery_url: "https://checkout.stripe.com/r/x", wired_pending_id: "11111111-1111-4111-8111-111111111111", send_after: "x", created_at: "2026-11-20T00:00:00Z" }]);
    if (method === "PATCH" && p.includes("reason=eq.wired_scheduled")) return j([{ session_id: "cs_1" }]);
    if (method === "PATCH") return j(null, 204);
    if (p.startsWith("wired_pending_checkouts")) return j([{ family_id: "f", product: o.product ?? "blueprint", child_ids: ["c"], created_at: "2026-11-19T00:00:00Z", paid_at: null }]);
    if (p.startsWith("orders")) return j(o.bought ? [{ id: 1 }] : []);
    if (p.startsWith("checkout_recoveries?email")) return j(o.recent ? [{ session_id: "cs_0" }] : []);
    if (p.startsWith("rpc/email_send_blocked")) return j(false);
    if (p.startsWith("wired_families")) return j([{ first_name: "Sarah" }]);
    if (p.startsWith("wired_children")) return j([{ nickname: "Lily" }]);
    if (p.startsWith("wired_results")) return j([{ top3: ["maker"] }]);
    return j([]);
  }) as typeof fetch;
  return seen;
}
const OPTS = { resendKey: "k", from: "Camila <hello@edeninstitute.health>", replyTo: "hello@edeninstitute.health" };

Deno.test("sender: re-checks at send time; bought or already reminded = skipped, never sent", async () => {
  for (const [o, reason] of [[{ bought: true }, "already_purchased"], [{ recent: true }, "recently_sent"]] as const) {
    const seen = route(o);
    const out = await sendDueWiredCartReminders({ url: "https://db", key: "k" }, OPTS) as Record<string, number>;
    assertEquals(out.sent, 0, reason);
    assert(!seen.some((s) => s.url.startsWith("https://api.resend.com")), reason);
    assert(seen.some((s) => s.method === "PATCH" && (s.body as Record<string, string>).reason === reason), reason);
  }
});

Deno.test("sender: sends the Blueprint email once, list 'cart' unsubscribe, marks sent", async () => {
  Deno.env.set("UNSUB_SIGNING_SECRET", "u".repeat(64));
  const seen = route({});
  const out = await sendDueWiredCartReminders({ url: "https://db", key: "k" }, OPTS) as Record<string, number>;
  assertEquals(out.sent, 1);
  const r = seen.find((s) => s.url.startsWith("https://api.resend.com"))!.body as Record<string, unknown>;
  assertEquals([r.subject, r.to], ["Your Learner Blueprint for Lily", ["mom@x.com"]]);
  assert(!String(r.html).includes("{{UNSUB_URL}}"));
  assert(seen.some((s) => s.method === "PATCH" && (s.body as Record<string, string>).status === "sent"));
});
