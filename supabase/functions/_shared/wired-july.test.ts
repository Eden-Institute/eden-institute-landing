import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { julyPositionFor, queueJuly } from "./wired-july.ts";

Deno.test("julyPositionFor: July 1 -> 1, July 15 -> 2, any other day -> none", () => {
  assertEquals(julyPositionFor("2027-07-01"), 1);
  assertEquals(julyPositionFor("2027-07-15"), 2);
  assertEquals(julyPositionFor("2027-07-02"), null);
  assertEquals(julyPositionFor("2026-11-20"), null);
});

Deno.test("queueJuly: one row per family from last quiz year, skipping removed children, deleted families and families already queued", async () => {
  const posted: Record<string, unknown>[][] = [];
  let resultsPath = "";
  globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    if ((init.method ?? "GET") === "POST") { posted.push(JSON.parse(String(init.body))); return Promise.resolve(new Response(null, { status: 201 })); }
    if (url.includes("/wired_results?")) {
      resultsPath = url;
      return Promise.resolve(new Response(JSON.stringify([
        { child_id: "c1", wired_children: { family_id: "f1", removed_at: null, wired_families: { email: "A@x.com", deleted_at: null } } },
        { child_id: "c2", wired_children: { family_id: "f1", removed_at: null, wired_families: { email: "A@x.com", deleted_at: null } } },
        { child_id: "c3", wired_children: { family_id: "f2", removed_at: "2027-01-01", wired_families: { email: "b@x.com", deleted_at: null } } },
        { child_id: "c4", wired_children: { family_id: "f3", removed_at: null, wired_families: { email: "c@x.com", deleted_at: "2027-02-01" } } },
        { child_id: "c5", wired_children: { family_id: "f4", removed_at: null, wired_families: { email: "d@x.com", deleted_at: null } } },
      ])));
    }
    if (url.includes("/wired_email_queue?")) return Promise.resolve(new Response(JSON.stringify([{ family_id: "f4" }])));
    return Promise.resolve(new Response("[]"));
  }) as typeof fetch;
  const out = await queueJuly({ url: "https://db", key: "k" }, new Date("2027-07-01T13:00:00Z"));
  assertEquals(out.queued, 1);
  assertEquals(resultsPath.includes("quiz_year=eq.2026"), true);
  assertEquals(posted[0], [{ family_id: "f1", email: "a@x.com", child_id: null, kind: "july", position: 1, scheduled_for: "2027-07-01T13:00:00.000Z" }]);
  const none = await queueJuly({ url: "https://db", key: "k" }, new Date("2027-07-02T13:00:00Z"));
  assertEquals(none.queued, 0);
});
