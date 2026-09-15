import { FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { FORM_ERROR_FALLBACK, visitorFacingError } from "@/lib/edgeFunctionError";

const httpError = (status: number, body: string) =>
  new FunctionsHttpError(new Response(body, { status, headers: { "Content-Type": "application/json" } }));

describe("visitorFacingError", () => {
  it("shows the authored message on a 429 rate limit", async () => {
    const msg = "We have received several forms from you in the last few minutes.";
    expect(await visitorFacingError(httpError(429, JSON.stringify({ error: msg })), FORM_ERROR_FALLBACK)).toBe(msg);
  });

  it("shows the typo hint on a 400", async () => {
    const msg = "That email address looks misspelled. Did you mean jane@gmail.com?";
    expect(
      await visitorFacingError(httpError(400, JSON.stringify({ error: msg, suggestion: "jane@gmail.com" })), FORM_ERROR_FALLBACK),
    ).toBe(msg);
  });

  it("never shows a server error body", async () => {
    expect(
      await visitorFacingError(httpError(500, JSON.stringify({ error: "Server configuration error" })), FORM_ERROR_FALLBACK),
    ).toBe(FORM_ERROR_FALLBACK);
  });

  it("never shows the supabase-js 'non-2xx' sentence", async () => {
    const out = await visitorFacingError(httpError(429, "not json"), FORM_ERROR_FALLBACK);
    expect(out).toBe(FORM_ERROR_FALLBACK);
    expect(out).not.toContain("non-2xx");
  });

  it("keeps a plain Error message and falls back for anything else", async () => {
    expect(await visitorFacingError(new Error("Payment not verified"), FORM_ERROR_FALLBACK)).toBe("Payment not verified");
    expect(await visitorFacingError("boom", FORM_ERROR_FALLBACK)).toBe(FORM_ERROR_FALLBACK);
  });
});
