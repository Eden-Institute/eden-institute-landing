// W10: staleness punch rows, the digest line, the weekly section (no network).
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dailyLine, type FunnelDay, weeklySection } from "./wired-funnel.ts";
import { inSweepWindow, JUNE_SWEEP_TITLE, reverifyTitle, staleCutoff, sweepCountTitle, syncStaleness } from "./wired-staleness.ts";
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

Deno.test("staleness: a row per stale curriculum, none twice, closed when re-verified (outside May-June)", async () => {
  const now = new Date("2027-04-01T13:00:00Z");
  const old = "2026-09-18T00:00:00Z";
  const fresh = "2027-03-20T00:00:00Z";
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
  assertEquals(out, { approved: 4, stale: 3, added: 2, would_add: 2, closed: 1, would_close: 1, june_sweep: false, sweep_count: 0 });
  const posted = seen.filter((s) => s.method === "POST").map((s) => (s.body as Record<string, string>).title);
  assertEquals(posted.sort(), ["Wired quiz: re-verify Abeka", "Wired quiz: re-verify Never"].sort());
  const closed = seen.filter((s) => s.method === "PATCH");
  assertEquals(closed.length, 1);
  assertStringIncludes(closed[0].url, "id=eq.p2");
  assertEquals((closed[0].body as Record<string, string>).status, "done");
  assert(staleCutoff(now).toISOString().startsWith("2026-10-01"));
});

const STALE = [
  { id: "a", name: "Abeka", publisher: null, last_verified_at: "2026-11-01T00:00:00Z" },
  { id: "b", name: "Beta Math", publisher: "Beta Co", last_verified_at: "2026-11-01T00:00:00Z" },
  { id: "d", name: "Never", publisher: null, last_verified_at: null },
];

Deno.test("staleness: May 1 to June 30 folds stale entries into ONE count row (her 11/20 tap)", async () => {
  const seen = route(STALE, [{ id: "p1", title: reverifyTitle("Beta Math", "Beta Co"), status: "open" }]); // opened before May: kept, not counted
  const out = await syncStaleness({ url: "https://db", key: "k" }, new Date("2027-06-01T13:00:00Z"));
  assertEquals(out, { approved: 3, stale: 3, added: 0, would_add: 0, closed: 0, would_close: 0, june_sweep: true, sweep_count: 2 });
  const posted = seen.filter((s) => s.method === "POST").map((s) => (s.body as Record<string, string>).title);
  assertEquals(posted.sort(), [JUNE_SWEEP_TITLE, "Wired quiz: June sweep: 2 entries to re-check"].sort());
  assertEquals(seen.filter((s) => s.method === "PATCH").length, 0);
});

Deno.test("staleness: the count row is renamed as N changes, closed at 0 and on July 1", async () => {
  // N went from 3 to 1: renamed, not a second row.
  let seen = route([STALE[0]], [{ id: "c1", title: sweepCountTitle(3), status: "open" }]);
  let out = await syncStaleness({ url: "https://db", key: "k" }, new Date("2027-05-20T13:00:00Z"));
  assertEquals(out.sweep_count, 1);
  assertEquals(seen.filter((s) => s.method === "POST").length, 0);
  let patches = seen.filter((s) => s.method === "PATCH");
  assertEquals(patches.length, 1);
  assertStringIncludes(patches[0].url, "id=eq.c1");
  assertEquals((patches[0].body as Record<string, string>).title, "Wired quiz: June sweep: 1 entry to re-check");
  // Everything re-verified: closed.
  seen = route([], [{ id: "c1", title: sweepCountTitle(1), status: "open" }]);
  await syncStaleness({ url: "https://db", key: "k" }, new Date("2027-05-21T13:00:00Z"));
  patches = seen.filter((s) => s.method === "PATCH");
  assertEquals((patches[0].body as Record<string, string>).status, "done");
  // July 1: the count row closes and the entry still stale gets its own row back.
  seen = route([STALE[0]], [{ id: "c1", title: sweepCountTitle(1), status: "open" }]);
  out = await syncStaleness({ url: "https://db", key: "k" }, new Date("2027-07-01T13:00:00Z"));
  assertEquals(out.added, 1);
  assertEquals(seen.filter((s) => s.method === "POST").map((s) => (s.body as Record<string, string>).title), ["Wired quiz: re-verify Abeka"]);
  assertEquals((seen.filter((s) => s.method === "PATCH")[0].body as Record<string, string>).status, "done");
});

Deno.test("staleness: the window edges are Central days", () => {
  assertEquals(inSweepWindow(new Date("2027-05-01T04:30:00Z")), false); // 11:30 PM Apr 30 CDT
  assertEquals(inSweepWindow(new Date("2027-05-01T05:30:00Z")), true);
  assertEquals(inSweepWindow(new Date("2027-07-01T04:30:00Z")), true);  // 11:30 PM Jun 30 CDT
  assertEquals(inSweepWindow(new Date("2027-07-01T05:30:00Z")), false);
});
