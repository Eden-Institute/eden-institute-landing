// Deep-Dive Guide access on /guide/:slug (2026-09-15). Pins:
//   - the head script takes ONLY `access` out of the address bar, only on /guide/
//     paths, and keeps it for this page in a window global and sessionStorage
//   - index.html runs a verbatim copy as its SECOND script, before any tag
//   - the remembered checkout session expires after 90 days, and a legacy bare id is
//     upgraded rather than dropped

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUIDE_ACCESS_STORAGE_KEY,
  GUIDE_ACCESS_STRIP_JS,
  GUIDE_SESSION_TTL_MS,
  clearGuideAccessToken,
  guideSessionKey,
  readGuideAccessToken,
  readStoredGuideSession,
  saveGuideSession,
} from "@/lib/guideAccess";
import { CHECKOUT_SESSION_STRIP_JS } from "@/lib/checkoutSession";
import indexHtml from "../../index.html?raw";

type W = { __edenGuideAccess?: unknown };
const w = () => window as unknown as W;

function go(url: string) {
  window.history.replaceState(null, "", url);
}
function runStrip() {
  new Function(GUIDE_ACCESS_STRIP_JS)();
}
function here() {
  return window.location.pathname + window.location.search + window.location.hash;
}
const norm = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete w().__edenGuideAccess;
  go("/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("access token strip script", () => {
  it("removes only access, keeps other params and the hash, and keeps the token", () => {
    go("/guide/frozen-knot?utm_source=email&access=abc.def&x=1#top");
    runStrip();
    expect(here()).toBe("/guide/frozen-knot?utm_source=email&x=1#top");
    expect(w().__edenGuideAccess).toEqual({ token: "abc.def", path: "/guide/frozen-knot" });
    expect(JSON.parse(sessionStorage.getItem(GUIDE_ACCESS_STORAGE_KEY) as string)).toEqual({
      token: "abc.def",
      path: "/guide/frozen-knot",
    });
    expect(readGuideAccessToken()).toBe("abc.def");
  });

  it("does nothing off /guide/ paths", () => {
    go("/homeschool?access=abc.def");
    runStrip();
    expect(here()).toBe("/homeschool?access=abc.def");
    expect(w().__edenGuideAccess).toBeUndefined();
  });

  it("still strips when sessionStorage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    go("/guide/frozen-knot?access=abc.def");
    runStrip();
    expect(here()).toBe("/guide/frozen-knot");
    expect(readGuideAccessToken()).toBe("abc.def");
  });

  it("a reload on the same path still finds the token; another guide does not", () => {
    go("/guide/frozen-knot?access=abc.def");
    runStrip();
    delete w().__edenGuideAccess;
    expect(readGuideAccessToken()).toBe("abc.def");
    go("/guide/still-water");
    expect(readGuideAccessToken()).toBeNull();
  });

  it("clearGuideAccessToken forgets a failed token", () => {
    go("/guide/frozen-knot?access=abc.def");
    runStrip();
    clearGuideAccessToken();
    expect(readGuideAccessToken()).toBeNull();
  });

  it("index.html runs a verbatim copy as its second script, right after the session id strip", () => {
    const scripts = [...indexHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(norm(scripts[0])).toBe(norm(CHECKOUT_SESSION_STRIP_JS));
    expect(norm(scripts[1])).toBe(norm(GUIDE_ACCESS_STRIP_JS));
    const gtm = indexHtml.indexOf("googletagmanager.com");
    expect(indexHtml.indexOf("eden_guide_access")).toBeLessThan(gtm);
  });
});

describe("remembered checkout session", () => {
  const NOW = 1_800_000_000_000;

  it("round-trips within 90 days", () => {
    saveGuideSession("frozen-knot", "cs_live_1", NOW);
    expect(readStoredGuideSession("frozen-knot", NOW + GUIDE_SESSION_TTL_MS - 1)).toBe("cs_live_1");
  });

  it("expires after 90 days and is removed", () => {
    saveGuideSession("frozen-knot", "cs_live_1", NOW);
    expect(readStoredGuideSession("frozen-knot", NOW + GUIDE_SESSION_TTL_MS)).toBeNull();
    expect(localStorage.getItem(guideSessionKey("frozen-knot"))).toBeNull();
  });

  it("upgrades a legacy bare session id so old buyers are not locked out", () => {
    localStorage.setItem(guideSessionKey("frozen-knot"), "cs_live_legacy");
    expect(readStoredGuideSession("frozen-knot", NOW)).toBe("cs_live_legacy");
    expect(JSON.parse(localStorage.getItem(guideSessionKey("frozen-knot")) as string)).toEqual({
      sessionId: "cs_live_legacy",
      savedAt: NOW,
    });
    expect(readStoredGuideSession("frozen-knot", NOW + GUIDE_SESSION_TTL_MS)).toBeNull();
  });

  it("drops junk and survives blocked storage", () => {
    localStorage.setItem(guideSessionKey("frozen-knot"), "junk");
    expect(readStoredGuideSession("frozen-knot", NOW)).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredGuideSession("frozen-knot", NOW)).toBeNull();
  });
});
