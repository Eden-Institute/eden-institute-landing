// api/partner-sample.ts per-recipient keys and serve log (punch #244, 2026-11-03). Pins:
//   - the old shared key still serves, with no key lookup, logged as key_id null
//   - a per-recipient key is looked up by its SHA-256 (never the raw key) and serves,
//     logged with its row id
//   - a revoked or unknown key is 403 and counts toward the wrong-key limit
//   - an unreadable key table is 503 and is NOT counted as a wrong key (fails closed)
//   - a malformed key never reaches the database
//   - f=verify answers 204 for a live key without signing a file or logging a visit
//   - the serve log stores a keyed hash of the visitor's network, never the IP, and a
//     failing log never blocks the download
//   - IPv6 is cut to its /64 so one household is one visitor

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import handler from "../../api/partner-sample";
import { visitorHash, visitorNetwork } from "../../api/_lib/sample-keys";

const SHARED = "shared-partner-key-123";
const PERSONAL = "Abcdefghijklmnopqrstuvwxyz012345"; // 32 base64url chars, like an issued key
const SUPA = "https://stub.supabase.co";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let keyRows: Array<{ id: string; revoked_at: string | null }> | "error";
let serveLog: "ok" | "error";

function fakeFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method: init?.method ?? "GET", body });
    if (url.endsWith("/rest/v1/rpc/rate_bucket_peek")) return new Response("0", { status: 200 });
    if (url.endsWith("/rest/v1/rpc/checkout_rate_bump")) return new Response("1", { status: 200 });
    if (url.includes("/rest/v1/partner_sample_keys?")) {
      if (keyRows === "error") return new Response('{"code":"PGRST205"}', { status: 404 });
      return new Response(JSON.stringify(keyRows), { status: 200 });
    }
    if (url.endsWith("/rest/v1/partner_sample_serves")) {
      return serveLog === "ok" ? new Response(null, { status: 201 }) : new Response("boom", { status: 500 });
    }
    if (url.includes("/storage/v1/object/sign/")) {
      return new Response(JSON.stringify({ signedURL: "/object/sign/partner-assets/x.pdf?token=t" }), { status: 200 });
    }
    return new Response("unexpected", { status: 500 });
  });
}

function req(k: string, f = "sprouts-read-aloud", ip = "203.0.113.9") {
  return new Request(
    `https://edeninstitute.health/api/partner-sample?k=${encodeURIComponent(k)}&f=${f}`,
    { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } },
  );
}

const lookups = () => calls.filter((c) => c.url.includes("/rest/v1/partner_sample_keys?"));
const logs = () => calls.filter((c) => c.url.endsWith("/rest/v1/partner_sample_serves"));
const bumps = () => calls.filter((c) => c.url.endsWith("checkout_rate_bump"));
const signs = () => calls.filter((c) => c.url.includes("/storage/v1/object/sign/"));

beforeEach(() => {
  calls = [];
  keyRows = [];
  serveLog = "ok";
  process.env.PARTNER_SAMPLE_KEY = SHARED;
  process.env.SUPABASE_URL = SUPA;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  vi.stubGlobal("fetch", fakeFetch());
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("partner-sample per-recipient keys", () => {
  it("the shared key still serves without a key lookup, logged as the shared key", async () => {
    const res = await handler(req(SHARED));
    expect(res.status).toBe(302);
    expect(lookups()).toHaveLength(0);
    expect(logs()).toHaveLength(1);
    expect(logs()[0].body).toMatchObject({ key_id: null, slug: "sprouts-read-aloud" });
  });

  it("an active personal key is looked up by its hash and serves, logged with its row id", async () => {
    keyRows = [{ id: "row-1", revoked_at: null }];
    const res = await handler(req(PERSONAL));
    expect(res.status).toBe(302);
    expect(lookups()).toHaveLength(1);
    expect(lookups()[0].url).toContain(`key_sha256=eq.${sha(PERSONAL)}`);
    expect(lookups()[0].url).not.toContain(PERSONAL);
    expect(logs()[0].body).toMatchObject({ key_id: "row-1", slug: "sprouts-read-aloud" });
    expect(bumps()).toHaveLength(0);
  });

  it("a revoked key is refused and counted as a wrong key", async () => {
    keyRows = [{ id: "row-1", revoked_at: "2026-11-03T20:00:00Z" }];
    const res = await handler(req(PERSONAL));
    expect(res.status).toBe(403);
    expect(bumps()).toHaveLength(1);
    expect(signs()).toHaveLength(0);
    expect(logs()).toHaveLength(0);
  });

  it("an unknown key is refused and counted", async () => {
    keyRows = [];
    expect((await handler(req(PERSONAL))).status).toBe(403);
    expect(bumps()).toHaveLength(1);
    expect(logs()).toHaveLength(0);
  });

  it("an unreadable key table fails closed with 503 and is not counted as wrong", async () => {
    keyRows = "error";
    const res = await handler(req(PERSONAL));
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(bumps()).toHaveLength(0);
    expect(signs()).toHaveLength(0);
  });

  it("the shared key keeps working even when the key table is unreadable", async () => {
    keyRows = "error";
    expect((await handler(req(SHARED))).status).toBe(302);
  });

  it("a malformed key never reaches the database", async () => {
    for (const k of ["", "short", "has spaces in it but is long enough", "x".repeat(65)]) {
      calls = [];
      expect((await handler(req(k))).status).toBe(403);
      expect(lookups()).toHaveLength(0);
    }
  });

  it("f=verify is 204 for a live key, with no file signed and no visit logged", async () => {
    keyRows = [{ id: "row-1", revoked_at: null }];
    const res = await handler(req(PERSONAL, "verify"));
    expect(res.status).toBe(204);
    expect(signs()).toHaveLength(0);
    expect(logs()).toHaveLength(0);
    keyRows = [{ id: "row-1", revoked_at: "2026-11-03T20:00:00Z" }];
    expect((await handler(req(PERSONAL, "verify"))).status).toBe(403);
  });

  it("an unknown file is still 404 for a good key", async () => {
    keyRows = [{ id: "row-1", revoked_at: null }];
    expect((await handler(req(PERSONAL, "field-cards"))).status).toBe(404);
    expect(logs()).toHaveLength(0);
  });

  it("the serve log carries a keyed hash, never the IP, and a failing log never blocks the download", async () => {
    serveLog = "error";
    const res = await handler(req(SHARED));
    expect(res.status).toBe(302);
    const body = logs()[0].body as { visitor_hash: string };
    expect(JSON.stringify(body)).not.toContain("203.0.113.9");
    expect(body.visitor_hash).toBe(await visitorHash("203.0.113.9", "service-role"));
    expect(body.visitor_hash).not.toBe(sha("partner_sample_visitor::203.0.113.9"));
  });

  it("a thrown serve-log fetch never blocks the download either", async () => {
    const base = fakeFetch();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/rest/v1/partner_sample_serves")) throw new Error("network down");
      return base(input, init);
    }));
    expect((await handler(req(SHARED))).status).toBe(302);
  });
});

describe("visitor network", () => {
  it("keeps IPv4 whole and unwraps IPv4-mapped IPv6", () => {
    expect(visitorNetwork("203.0.113.9")).toBe("203.0.113.9");
    expect(visitorNetwork(" ::ffff:203.0.113.9 ")).toBe("203.0.113.9");
  });

  it("cuts IPv6 to its /64, however it is written", () => {
    const a = visitorNetwork("2600:1700:abcd:1234:aaaa:bbbb:cccc:dddd");
    expect(a).toBe("2600:1700:abcd:1234::/64");
    expect(visitorNetwork("2600:1700:ABCD:1234::1")).toBe(a);
    expect(visitorNetwork("2600:1700:abcd:1234:0:0:0:9%eth0")).toBe(a);
    expect(visitorNetwork("2600:1700:abcd:1235::1")).not.toBe(a);
    expect(visitorNetwork("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  it("two devices in one home are one visitor; two homes are two", async () => {
    const one = await visitorHash("2600:1700:abcd:1234::aaaa", "p");
    expect(await visitorHash("2600:1700:abcd:1234::bbbb", "p")).toBe(one);
    expect(await visitorHash("2600:1700:abcd:9999::aaaa", "p")).not.toBe(one);
  });
});
