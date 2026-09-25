// api/partner-sample.ts wrong-key limit (founder decision 2026-09-15). Pins:
//   - 10 wrong keys in the window from one connection -> 429 WITHOUT checking the key
//     (even a correct key from that connection gets 429 while locked)
//   - a wrong key is counted; a correct key is never counted
//   - the client IP order is cf-connecting-ip, x-real-ip, left-most x-forwarded-for
//   - the limiter fails open

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/partner-sample";
import { bucketKey, clientIp, WRONG_KEY_LIMIT, WRONG_KEY_WINDOW_SECONDS } from "../../api/_lib/wrong-key-limit";

const KEY = "correct-partner-key-123";
const SUPA = "https://stub.supabase.co";

type Call = { url: string; body: unknown };
let calls: Call[];
let peekCount: number | "error" | "missing";

function fakeFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.endsWith("/rest/v1/rpc/rate_bucket_peek")) {
      if (peekCount === "error") throw new Error("network down");
      if (peekCount === "missing") return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(peekCount), { status: 200 });
    }
    if (url.endsWith("/rest/v1/rpc/checkout_rate_bump")) {
      return new Response("1", { status: 200 });
    }
    if (url.includes("/storage/v1/object/sign/")) {
      return new Response(JSON.stringify({ signedURL: "/object/sign/partner-assets/x.pdf?token=t" }), { status: 200 });
    }
    return new Response("unexpected", { status: 500 });
  });
}

function req(k: string, headers: Record<string, string> = { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) {
  return new Request(`https://edeninstitute.health/api/partner-sample?k=${encodeURIComponent(k)}&f=sprouts-read-aloud`, { headers });
}

const bumps = () => calls.filter((c) => c.url.endsWith("checkout_rate_bump"));

beforeEach(() => {
  calls = [];
  peekCount = 0;
  process.env.PARTNER_SAMPLE_KEY = KEY;
  process.env.SUPABASE_URL = SUPA;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  vi.stubGlobal("fetch", fakeFetch());
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("partner-sample wrong-key limit", () => {
  it("limit is 10 wrong keys per 15 minutes", () => {
    expect(WRONG_KEY_LIMIT).toBe(10);
    expect(WRONG_KEY_WINDOW_SECONDS).toBe(900);
  });

  it("a wrong key under the limit is 403 and counted once", async () => {
    peekCount = 9;
    const res = await handler(req("wrong"));
    expect(res.status).toBe(403);
    expect(bumps()).toHaveLength(1);
    const peek = calls.find((c) => c.url.endsWith("rate_bucket_peek"));
    expect(peek?.body).toMatchObject({ p_window_seconds: 900 });
    // The bucket key is hashed, never the raw IP.
    expect(JSON.stringify(peek?.body)).not.toContain("203.0.113.9");
  });

  it("a correct key is served and never counted", async () => {
    peekCount = 3;
    const res = await handler(req(KEY));
    expect(res.status).toBe(302);
    expect(bumps()).toHaveLength(0);
  });

  it("at the limit the connection gets 429 without the key being checked or counted", async () => {
    peekCount = 10;
    for (const k of ["wrong", KEY]) {
      calls = [];
      const res = await handler(req(k));
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("900");
      expect(bumps()).toHaveLength(0);
      expect(calls.some((c) => c.url.includes("/storage/"))).toBe(false);
    }
  });

  it("fails open when the peek RPC is missing or the network errors", async () => {
    for (const p of ["missing", "error"] as const) {
      peekCount = p;
      calls = [];
      expect((await handler(req(KEY))).status).toBe(302);
      calls = [];
      expect((await handler(req("wrong"))).status).toBe(403);
    }
  });

  it("with no client IP header nothing is limited or counted", async () => {
    peekCount = 50;
    const res = await handler(req("wrong", {}));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("client IP prefers cf-connecting-ip, then x-real-ip, then left-most x-forwarded-for", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers({ "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBe("");
    expect(bucketKey("3.3.3.3")).toBe("partner_sample_wrong_key:3.3.3.3");
  });
});

// Three weeks of each band (founder decision 2026-09-24). Pins the six slugs to
// their storage objects, and that the retired six-week slugs no longer resolve.
describe("partner-sample file map (3 weeks Sprouts + 3 weeks Seedlings)", () => {
  const withSlug = (f: string) =>
    new Request(`https://edeninstitute.health/api/partner-sample?k=${KEY}&f=${f}`, { headers: { "x-forwarded-for": "203.0.113.9" } });

  it("each band's three components sign their own 3wk object", async () => {
    peekCount = 0;
    for (const band of ["sprouts", "seedlings"]) {
      for (const piece of ["read-aloud", "teachers-guide", "student-notebook"]) {
        calls = [];
        const res = await handler(withSlug(`${band}-${piece}`));
        expect(res.status).toBe(302);
        const sign = calls.find((c) => c.url.includes("/storage/v1/object/sign/"));
        expect(sign?.url).toBe(`${SUPA}/storage/v1/object/sign/partner-assets/sample/edens-table-sample-${band}-3wk-${piece}.pdf`);
      }
    }
  });

  it("the six-week slugs, card sets included, are gone", async () => {
    peekCount = 0;
    for (const old of ["read-aloud", "teachers-guide", "student-notebook", "field-cards", "recipe-cards", "around-the-table-cards"]) {
      expect((await handler(withSlug(old))).status).toBe(404);
    }
  });
});
