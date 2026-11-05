// api/esa-confirm.ts: the ESA "Confirm paid" page on edeninstitute.health (punch #446, 2026-11-05).
// Pins:
//   - GET relays ?t= to esa-payment-confirm and never writes (the function owns that rule; here it
//     is only ever a GET upstream)
//   - POST relays the form body and its content type, so the button reaches the function
//   - the page comes back as text/html with OUR headers: never Supabase's text/plain or its
//     `sandbox` CSP, which is what made the page show as source with no button
//   - the function's own status code is kept
//   - anything but GET / POST is refused here and never reaches the function
//   - an unreachable function gives a plain page that says how to check safely
//   - vercel.json routes /esa/confirm to this function

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import vercelJsonRaw from "../../vercel.json?raw";
import handler, { PAGE_HEADERS, UPSTREAM_TIMEOUT_MS } from "../../api/esa-confirm";
import { route, type VercelConfig } from "./vercelRouting";

const SUPA = "https://stub.supabase.co";
const TOKEN = "11111111-2222-4333-8444-555555555555";
const PAGE = '<!doctype html><html><body><form method="POST"><input type="hidden" name="t" value="x"><button>Confirm paid</button></form></body></html>';

type Call = { url: string; method: string; body: string | null; contentType: string | null };
let calls: Call[];
let reply: () => Response;

beforeEach(() => {
  calls = [];
  // What Supabase's gateway really sends for an HTML function page (verified 2026-11-05).
  reply = () =>
    new Response(PAGE, {
      status: 200,
      headers: { "Content-Type": "text/plain", "Content-Security-Policy": "default-src 'none'; sandbox" },
    });
  vi.stubEnv("SUPABASE_URL", SUPA);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body == null ? null : String(init.body),
        contentType: headers.get("content-type"),
      });
      return reply();
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("api/esa-confirm relay", () => {
  it("GET relays the token and serves the function's page as real HTML", async () => {
    const res = await handler(new Request(`https://edeninstitute.health/esa/confirm?t=${TOKEN}`));
    expect(calls).toEqual([
      { url: `${SUPA}/functions/v1/esa-payment-confirm?t=${TOKEN}`, method: "GET", body: null, contentType: null },
    ]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).not.toContain("sandbox");
    expect(csp).toContain("form-action 'self'");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await res.text()).toBe(PAGE);
  });

  it("POST relays the form body and content type, so the button reaches the function", async () => {
    const body = `t=${TOKEN}`;
    const res = await handler(
      new Request(`https://edeninstitute.health/esa/confirm?t=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      url: `${SUPA}/functions/v1/esa-payment-confirm?t=${TOKEN}`,
      method: "POST",
      body,
      contentType: "application/x-www-form-urlencoded",
    });
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("keeps the function's status code (an invalid link is still a 404)", async () => {
    reply = () => new Response("<p>This confirmation link is not valid.</p>", { status: 404, headers: { "Content-Type": "text/plain" } });
    const res = await handler(new Request("https://edeninstitute.health/esa/confirm?t=nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(calls[0].url).toBe(`${SUPA}/functions/v1/esa-payment-confirm?t=nope`);
  });

  it("sends no query at all when the link has no token", async () => {
    await handler(new Request("https://edeninstitute.health/esa/confirm"));
    expect(calls[0].url).toBe(`${SUPA}/functions/v1/esa-payment-confirm`);
  });

  for (const method of ["HEAD", "PUT", "DELETE", "PATCH"]) {
    it(`${method} is refused here and never reaches the function`, async () => {
      const res = await handler(new Request(`https://edeninstitute.health/esa/confirm?t=${TOKEN}`, { method }));
      expect(res.status).toBe(405);
      expect(calls).toHaveLength(0);
    });
  }

  it("an unreachable function: a plain page that says how to check, never a raw error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handler(
      new Request(`https://edeninstitute.health/esa/confirm?t=${TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `t=${TOKEN}`,
      }),
    );
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain("Already done");
  });

  it("gives up after the timeout, inside the Edge 25 s limit, with the same safe page", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = handler(new Request(`https://edeninstitute.health/esa/confirm?t=${TOKEN}`));
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS);
    const res = await pending;
    spy.mockRestore();
    vi.useRealTimers();
    expect(UPSTREAM_TIMEOUT_MS).toBeLessThan(25_000);
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("falls back to the project URL when no Supabase env is set", async () => {
    // stubEnv first, so afterEach's unstubAllEnvs puts back whatever was there. Then clear
    // them the way Vercel would leave them: absent (an empty string is still "set" for ??).
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    await handler(new Request(`https://edeninstitute.health/esa/confirm?t=${TOKEN}`));
    expect(calls[0].url).toBe(`https://noeqztssupewjidpvhar.supabase.co/functions/v1/esa-payment-confirm?t=${TOKEN}`);
  });

  it("never lets the page be framed or indexed", () => {
    expect(PAGE_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(PAGE_HEADERS["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(PAGE_HEADERS["X-Robots-Tag"]).toContain("noindex");
  });
});

describe("vercel.json routes /esa/confirm to the relay", () => {
  const config = JSON.parse(vercelJsonRaw) as VercelConfig;
  const noFiles = () => null;

  it("/esa/confirm?t=... -> /api/esa-confirm", () => {
    expect(route(config, `/esa/confirm?t=${TOKEN}`, noFiles)).toMatchObject({
      kind: "rewrite",
      destination: "/api/esa-confirm",
    });
  });

  it("no redirect claims the path first (a redirect would drop a POST body)", () => {
    for (const r of config.redirects ?? []) {
      expect(route({ redirects: [r] }, "/esa/confirm", noFiles).kind, r.source).not.toBe("redirect");
    }
  });
});
