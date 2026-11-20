// W10: staleness punch rows, the digest line, the weekly section (no network).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dailyLine, type FunnelDay, weeklySection } from "./wired-funnel.ts";
import { JUNE_SWEEP_TITLE, reverifyTitle, staleCutoff, syncStaleness } from "./wired-staleness.ts";
import { evaluateSystemHealth, type SystemHealthInput } from "../notify-founder-digest/system-health.ts";
import { buildEmail } from "./weekly-trends-report.ts";

const day = (o: Partial<FunnelDay> = {}): FunnelDay => ({
  day: "2026-11-19", clicks: 0, starts: 0, completions: 0, completions_k2: 0, completions_g3_5: 0, completions_g6_8: 0, completions_g9_12: 0,
  new_learner_emails: 0, blueprints: 0, family_maps: 0, ...o,
});

Deno.test("digest line: counts only, left out on an all-zero day (the dark quiz adds nothing)", () => {
  assertEquals(dailyLine(day()), null);
  assertEquals(dailyLine(null), null);
  const l = dailyLine(day({ clicks: 12, starts: 5, completions: 3, new_learner_emails: 3, blueprints: 1 }))!;
  assertEquals(l.text, "Wired quiz yesterday: 12 button clicks · 5 starts · 3 completions · 3 new learner emails · 1 Blueprint · 0 Family Maps");
  assertStringIncludes(l.html, "Wired quiz yesterday");
});

Deno.test("weekly section: this vs last week, by button, by band, rates vs the body-pattern benchmark", () => {
  assertEquals(weeklySection([day()], [day()], []), null);
  const s = weeklySection(
    [day({ clicks: 40, starts: 20, completions: 10, completions_g3_5: 6, completions_k2: 4, blueprints: 1 })],
    [day({ clicks: 10, completions: 2 })],
    [{ placement: "header", clicks: 25 }, { placement: "exit_popup", clicks: 15 }],
  )!;
  assertStringIncludes(s.text, "Button clicks: 40 (was 10)");
  assertStringIncludes(s.text, "By button: site header 25, exit pop-up 15");
  assertStringIncludes(s.text, "K-2 4, 3-5 6, 6-8 0, 9-12 0");
  assertStringIncludes(s.text, "Clicks to completions 25%; completions to purchases 10%");
  assertStringIncludes(s.text, "3.8%");
});

Deno.test("the weekly email still has the focus box the Wired section is placed above", () => {
  const snap = { leads: { this: 1, last: 1 }, traffic_views: { this: 1, last: 1 }, traffic_visitors: { this: 1, last: 1 }, quiz: { this: 0, last: 0 } } as never;
  let html = "";
  try { html = buildEmail(snap, "2026-11-20").html; } catch { /* a thinner snapshot than real: fall back to the source */ }
  const src = html || Deno.readTextFileSync(new URL("./weekly-trends-report.ts", import.meta.url));
  assertStringIncludes(src, '<div style="background:#1C3A2E;padding:18px 20px;margin-bottom:8px;">');
});

const base: SystemHealthInput = {
  recapStatus: "sent", lastTrendsSent: "2026-11-14", digestFailed30d: 0, failedByQueue: {}, oldestFailed: null, stuckByQueue: {},
  stripeProblems: 0, luluProblems: 0, starterProblems: 0, ga4ByStatus: {}, ga4SecretSet: true, sampleLinkSpikes: [],
};
Deno.test("system health: ONE count-only line for stale curricula (ok at 0, problem above 0)", () => {
  const find = (n: number | null | undefined) => evaluateSystemHealth({ ...base, wiredStale: n } as SystemHealthInput, "2026-11-19", "2026-11-20").find((c) => c.key === "wired_stale");
  assertEquals(find(0), { key: "wired_stale", ok: true, detail: "Wired quiz curricula: none past 6 months." });
  assertEquals(find(3), { key: "wired_stale", ok: false, detail: "3 curricula past 6 months." });
  assertEquals(find(1)?.detail, "1 curriculum past 6 months.");
  assertEquals(find(null)?.ok, null);
  assertEquals(evaluateSystemHealth(base, "2026-11-19", "2026-11-20").some((c) => c.key === "wired_stale"), false);
});

type Seen = { url: string; method: string; body?: unknown };
function route(cur: unknown[], punch: unknown[]): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input); const method = init.method ?? "GET";
    seen.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const p = url.split("/rest/v1/")[1];
    const v = method !== "GET" ? null : p.startsWith("wired_curricula") ? cur : p.startsWith("founder_punch_list") ? punch : [];
    return Promise.resolve(new Response(v === null ? null : JSON.stringify(v), { status: v === null ? 201 : 200 }));
  }) as typeof fetch;
  return seen;
}

Deno.test("staleness: a row per stale curriculum, none twice, closed when re-verified, June 1 sweep row", async () => {
  const now = new Date("2027-06-01T13:00:00Z");
  const old = "2026-11-18T00:00:00Z";
  const fresh = "2027-05-20T00:00:00Z";
  const seen = route(
    [
      { id: "a", name: "Abeka", publisher: null, last_verified_at: old },
      { id: "b", name: "Beta Math", publisher: "Beta Co", last_verified_at: old },
      { id: "c", name: "Cedar", publisher: "C", last_verified_at: fresh },
      { id: "d", name: "Never", publisher: null, last_verified_at: null },
    ],
    [
      { id: "p1", title: reverifyTitle("Beta Math", "Beta Co"), status: "open" },     // already there: not added again
      { id: "p2", title: reverifyTitle("Cedar", "C"), status: "deferred" },             // re-verified: closed
      { id: "p3", title: "Wired quiz: something else", status: "open" },                // not ours: untouched
    ],
  );
  const out = await syncStaleness({ url: "https://db", key: "k" }, now);
  assertEquals(out, { approved: 4, stale: 3, added: 2, would_add: 2, closed: 1, would_close: 1, june_sweep: true });
  const posted = seen.filter((s) => s.method === "POST").map((s) => (s.body as Record<string, string>).title);
  assertEquals(posted.sort(), [JUNE_SWEEP_TITLE, "Wired quiz: re-verify Abeka", "Wired quiz: re-verify Never"].sort());
  const closed = seen.filter((s) => s.method === "PATCH");
  assertEquals(closed.length, 1);
  assertStringIncludes(closed[0].url, "id=eq.p2");
  assertEquals((closed[0].body as Record<string, string>).status, "done");
  assert(staleCutoff(now).toISOString().startsWith("2026-12-01"));
});
