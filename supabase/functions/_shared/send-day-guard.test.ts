import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { centralDay, centralMorning, claimSendDay, nextCentralMorning, releaseSendDay } from "./send-day-guard.ts";

Deno.test("centralDay: the Central calendar day, not the UTC one", () => {
  assertEquals(centralDay(new Date("2026-11-21T05:30:00Z")), "2026-11-20"); // 11:30 PM CST
  assertEquals(centralDay(new Date("2026-11-21T06:30:00Z")), "2026-11-21"); // 12:30 AM CST
  assertEquals(centralDay(new Date("2026-07-02T04:59:00Z")), "2026-07-01"); // 11:59 PM CDT
});

Deno.test("nextCentralMorning: 8 AM Central the next day, DST-correct both ways", () => {
  assertEquals(nextCentralMorning(new Date("2026-11-20T20:00:00Z")).toISOString(), "2026-11-21T14:00:00.000Z"); // CST
  assertEquals(nextCentralMorning(new Date("2026-07-01T15:00:00Z")).toISOString(), "2026-07-02T13:00:00.000Z"); // CDT
  // 11:30 PM Central on Nov 20 -> Nov 21 at 8, not Nov 22
  assertEquals(nextCentralMorning(new Date("2026-11-21T05:30:00Z")).toISOString(), "2026-11-21T14:00:00.000Z");
  // across the spring-forward night (Mar 8 2026)
  assertEquals(nextCentralMorning(new Date("2026-03-07T20:00:00Z")).toISOString(), "2026-03-08T13:00:00.000Z");
  assertEquals(centralMorning(new Date("2026-11-20T20:00:00Z"), 30).toISOString(), "2026-12-20T14:00:00.000Z");
});

type Call = { url: string; method: string; body?: string };
function fakeFetch(answers: ((c: Call) => Response)[]): { f: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const f = ((url: string, init: RequestInit = {}) => {
    const c = { url: String(url), method: init.method ?? "GET", body: init.body as string | undefined };
    calls.push(c);
    return Promise.resolve(answers[i++](c));
  }) as unknown as typeof fetch;
  return { f, calls };
}
const json = (v: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(v), { status });
const NOW = new Date("2026-11-20T20:00:00Z");

Deno.test("claimSendDay: the insert wins -> claimed (one row, Central day, lower-cased email)", async () => {
  const { f, calls } = fakeFetch([() => json([{ id: "x" }], 201)]);
  assertEquals(await claimSendDay({ url: "u", key: "k", fetchImpl: f }, " Mom@Example.com ", "magnet_email_queue", "row-1", NOW), "claimed");
  assertEquals(JSON.parse(calls[0].body!), [{ email_lower: "mom@example.com", sent_on: "2026-11-20", source: "magnet_email_queue", queue_row_id: "row-1" }]);
  assertEquals(calls[0].url, "u/rest/v1/nurture_send_log?on_conflict=email_lower,sent_on");
});

Deno.test("claimSendDay: another row already has today -> taken; the same row retrying -> claimed", async () => {
  let r = fakeFetch([() => json([], 201), () => json([{ queue_row_id: "other" }])]);
  assertEquals(await claimSendDay({ url: "u", key: "k", fetchImpl: r.f }, "a@b.c", "wired_email_queue", "row-1", NOW), "taken");
  r = fakeFetch([() => json([], 201), () => json([{ queue_row_id: "row-1" }])]);
  assertEquals(await claimSendDay({ url: "u", key: "k", fetchImpl: r.f }, "a@b.c", "wired_email_queue", "row-1", NOW), "claimed");
});

Deno.test("claimSendDay fails OPEN: a database error answers 'error' (the caller sends)", async () => {
  let r = fakeFetch([() => json({ message: "boom" }, 500)]);
  assertEquals(await claimSendDay({ url: "u", key: "k", fetchImpl: r.f }, "a@b.c", "s", "row-1", NOW), "error");
  r = fakeFetch([() => { throw new Error("network"); }]);
  assertEquals(await claimSendDay({ url: "u", key: "k", fetchImpl: r.f }, "a@b.c", "s", "row-1", NOW), "error");
});

Deno.test("releaseSendDay deletes only that row's claim for today and never throws", async () => {
  const r = fakeFetch([() => json(null, 204)]);
  await releaseSendDay({ url: "u", key: "k", fetchImpl: r.f }, "row-1", NOW);
  assertEquals(r.calls[0].method, "DELETE");
  assertEquals(r.calls[0].url, "u/rest/v1/nurture_send_log?queue_row_id=eq.row-1&sent_on=eq.2026-11-20");
  const bad = fakeFetch([() => { throw new Error("x"); }]);
  await releaseSendDay({ url: "u", key: "k", fetchImpl: bad.f }, "row-1", NOW);
});
