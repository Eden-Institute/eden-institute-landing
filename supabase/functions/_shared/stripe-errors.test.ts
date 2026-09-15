import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isStripeResourceMissing } from "./stripe-errors.ts";

Deno.test("isStripeResourceMissing: the shape production actually throws (minified type)", () => {
  // Logged by verify-session on 2026-09-15 for an unknown session id.
  const err = Object.assign(new Error("No such checkout.session: cs_live_x"), {
    type: "Ie",
    raw: { code: "resource_missing", type: "invalid_request_error" },
  });
  assertEquals(isStripeResourceMissing(err), true);
});

Deno.test("isStripeResourceMissing: top-level code or a 404 status also count", () => {
  assertEquals(isStripeResourceMissing({ code: "resource_missing" }), true);
  assertEquals(isStripeResourceMissing({ statusCode: 404 }), true);
});

Deno.test("isStripeResourceMissing: other failures do not", () => {
  assertEquals(isStripeResourceMissing(new Error("network down")), false);
  assertEquals(isStripeResourceMissing({ code: "api_key_expired", statusCode: 401 }), false);
  assertEquals(isStripeResourceMissing({ raw: { code: "rate_limit" }, statusCode: 429 }), false);
  assertEquals(isStripeResourceMissing(null), false);
  assertEquals(isStripeResourceMissing("resource_missing"), false);
});
