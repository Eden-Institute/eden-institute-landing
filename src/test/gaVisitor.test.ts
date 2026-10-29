// The GA visitor checkout carries to the server (2026-10-28).
import { afterEach, describe, expect, it } from "vitest";
import { parseGaClientId, parseGaSessionId, readGaVisitor } from "@/lib/gaVisitor";

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

describe("cookie parsing", () => {
  it("reads the client id from _ga", () => {
    expect(parseGaClientId("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(parseGaClientId("GA1.2.99.88")).toBe("99.88");
    expect(parseGaClientId("garbage")).toBeNull();
    expect(parseGaClientId(null)).toBeNull();
  });

  it("reads the session id from either property cookie format", () => {
    expect(parseGaSessionId("GS2.1.s1700000123$o3$g1$t1700000500$j0$l0$h0")).toBe("1700000123");
    expect(parseGaSessionId("GS1.1.1700000123.3.1.1700000500.0.0.0")).toBe("1700000123");
    expect(parseGaSessionId("GS2.1.x1700000123")).toBeNull();
    expect(parseGaSessionId("")).toBeNull();
  });
});

describe("readGaVisitor", () => {
  afterEach(() => {
    clearCookies();
    localStorage.clear();
  });

  it("returns the ids and the banner choice", () => {
    document.cookie = "_ga=GA1.1.1234567890.1700000000; path=/";
    document.cookie = "_ga_5DVHEZPKL0=GS2.1.s1700000123$o3$g1$t1700000500$j0$l0$h0; path=/";
    localStorage.setItem("eden-marketing-consent", "granted");
    expect(readGaVisitor()).toEqual({ client_id: "1234567890.1700000000", session_id: "1700000123", consent: "granted" });
  });

  it("carries Decline even with no cookies, so the server can skip the sale", () => {
    localStorage.setItem("eden-marketing-consent", "denied");
    expect(readGaVisitor()).toEqual({ consent: "denied" });
  });

  it("is empty for a first-time visitor with an ad blocker", () => {
    expect(readGaVisitor()).toEqual({});
  });
});
