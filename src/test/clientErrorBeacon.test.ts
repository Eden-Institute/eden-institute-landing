/**
 * src/lib/clientErrorBeacon.ts: the browser error report (2026-11-17, Lane 2 area 16 E1).
 *
 * What must hold: only this site's own errors and real function failures are reported
 * (never another site's script, a browser extension, or an expected 400/409/422/429 refusal);
 * the page path goes without its query string; at most 5 reports leave a page and the same
 * error goes once; the report itself never passes through the wrapper; and the wrapped fetch
 * hands every response and every failure back to the caller unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetClientErrorBeaconForTests,
  functionNameFromUrl,
  installClientErrorBeacon,
  isFunctionFailure,
  rejectionReport,
  shouldReportError,
  stripToPath,
} from "@/lib/clientErrorBeacon";

const SB = "https://noeqztssupewjidpvhar.supabase.co";
const ORIGIN = window.location.origin;

describe("clientErrorBeacon helpers", () => {
  it("names only OUR edge functions", () => {
    expect(functionNameFromUrl(`${SB}/functions/v1/create-checkout`, SB)).toBe("create-checkout");
    expect(functionNameFromUrl(`${SB}/functions/v1/resend-waitlist?x=1`, SB)).toBe("resend-waitlist");
    expect(functionNameFromUrl(`${SB}/rest/v1/rpc/record_page_view`, SB)).toBeNull();
    expect(functionNameFromUrl("https://evil.example/functions/v1/create-checkout", SB)).toBeNull();
    expect(functionNameFromUrl(`${SB}/functions/v1/create-checkout`, "")).toBeNull();
  });

  it("keeps the path only: no host, no query string, no fragment", () => {
    expect(stripToPath("https://edeninstitute.health/_astro/Buy.abc.js?v=2#x")).toBe("/_astro/Buy.abc.js");
    expect(stripToPath("/partner-sample?k=SECRET")).toBe("/partner-sample");
    expect(stripToPath(null)).toBeNull();
  });

  it("reports this site's own script errors and nothing else", () => {
    expect(shouldReportError("TypeError: x is undefined", `${ORIGIN}/_astro/a.js`, ORIGIN)).toBe(true);
    expect(shouldReportError("TypeError: x", "https://connect.facebook.net/en_US/fbevents.js", ORIGIN)).toBe(false);
    expect(shouldReportError("TypeError: x", "chrome-extension://abc/content.js", ORIGIN)).toBe(false);
    expect(shouldReportError("Script error.", `${ORIGIN}/_astro/a.js`, ORIGIN)).toBe(false);
    expect(shouldReportError("ResizeObserver loop completed with undelivered notifications.", `${ORIGIN}/a.js`, ORIGIN)).toBe(false);
    expect(shouldReportError("TypeError: x", "", ORIGIN)).toBe(false);
  });

  it("reports an uncaught rejection only when its stack points at this site", () => {
    const ours = new TypeError("boom");
    ours.stack = `TypeError: boom\n    at buy (${ORIGIN}/_astro/Buy.abc.js:12:34)`;
    expect(rejectionReport(ours, ORIGIN)).toEqual({
      kind: "rejection",
      message: "TypeError: boom",
      source: `${ORIGIN}/_astro/Buy.abc.js`,
      line: 12,
      col: 34,
    });
    const theirs = new Error("pixel");
    theirs.stack = "Error: pixel\n    at f (https://connect.facebook.net/fbevents.js:1:1)";
    expect(rejectionReport(theirs, ORIGIN)).toBeNull();
    expect(rejectionReport("a string reason", ORIGIN)).toBeNull();
    const aborted = new DOMException("aborted", "AbortError");
    expect(rejectionReport(aborted, ORIGIN)).toBeNull();
  });

  it("counts 500 and up as a failure; the forms' expected refusals are not", () => {
    for (const s of [500, 502, 503, 504]) expect(isFunctionFailure(s)).toBe(true);
    for (const s of [200, 400, 401, 404, 409, 422, 429]) expect(isFunctionFailure(s)).toBe(false);
  });
});

describe("installClientErrorBeacon", () => {
  let native: ReturnType<typeof vi.fn>;
  const original = window.fetch;

  const reports = () =>
    native.mock.calls
      .filter(([url]) => String(url).endsWith("/rest/v1/rpc/record_client_error"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

  beforeEach(() => {
    __resetClientErrorBeaconForTests();
    native = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/functions/v1/create-checkout")) return new Response("{}", { status: 503 });
      if (url.includes("/functions/v1/resend-waitlist")) return new Response('{"error":"Please check your email"}', { status: 400 });
      if (url.includes("/functions/v1/starter-download")) throw new TypeError("Failed to fetch");
      return new Response("ok", { status: 200 });
    });
    window.fetch = native as unknown as typeof window.fetch;
    installClientErrorBeacon({ supabaseUrl: SB, key: "sb_publishable_test" });
  });

  afterEach(() => {
    window.fetch = original;
  });

  it("reports a function that answered 503 and hands the response back unchanged", async () => {
    const res = await window.fetch(`${SB}/functions/v1/create-checkout`, { method: "POST" });
    expect(res.status).toBe(503);
    const r = reports();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ p_kind: "function", p_fn: "create-checkout", p_status: 503, p_message: "create-checkout answered 503" });
    expect(r[0].p_path).toBe(window.location.pathname);
    const sent = native.mock.calls.find(([u]) => String(u).endsWith("record_client_error"))!;
    expect((sent[1] as RequestInit).credentials).toBe("omit");
    expect((sent[1] as RequestInit).keepalive).toBe(true);
  });

  it("does not report an expected refusal or anything that is not our function", async () => {
    const refused = await window.fetch(`${SB}/functions/v1/resend-waitlist`, { method: "POST" });
    expect(refused.status).toBe(400);
    await window.fetch("https://www.google-analytics.com/g/collect");
    await window.fetch(`${SB}/rest/v1/rpc/record_page_view`, { method: "POST" });
    expect(reports()).toHaveLength(0);
  });

  it("reports a function call that never connected, and still throws to the caller", async () => {
    await expect(window.fetch(`${SB}/functions/v1/starter-download`)).rejects.toThrow("Failed to fetch");
    expect(reports()[0]).toMatchObject({ p_kind: "function", p_fn: "starter-download", p_status: 0, p_message: "starter-download could not be reached" });
  });

  it("reports this site's script error with its file path but no query string", () => {
    window.dispatchEvent(new ErrorEvent("error", { message: "TypeError: qty is undefined", filename: `${ORIGIN}/_astro/Buy.abc.js?v=1`, lineno: 7, colno: 3 }));
    window.dispatchEvent(new ErrorEvent("error", { message: "TypeError: x", filename: "https://s.pinimg.com/ct/core.js" }));
    const r = reports();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ p_kind: "error", p_message: "TypeError: qty is undefined", p_source: "/_astro/Buy.abc.js", p_line: 7, p_col: 3 });
  });

  it("sends the same error once and at most 5 reports from a page", async () => {
    for (let i = 0; i < 3; i++) await window.fetch(`${SB}/functions/v1/create-checkout`, { method: "POST" });
    expect(reports()).toHaveLength(1);
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new ErrorEvent("error", { message: `TypeError: n${i}`, filename: `${ORIGIN}/_astro/a.js` }));
    }
    expect(reports()).toHaveLength(5);
  });

  it("installs once: a second call does not wrap fetch twice", async () => {
    installClientErrorBeacon({ supabaseUrl: SB, key: "sb_publishable_test" });
    await window.fetch(`${SB}/functions/v1/create-checkout`, { method: "POST" });
    expect(reports()).toHaveLength(1);
    expect(native.mock.calls.filter(([u]) => String(u).includes("create-checkout"))).toHaveLength(1);
  });
});
