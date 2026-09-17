import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { E2E_MODE, e2eRequestAllowed, isE2eMetadata } from "./e2e-mode.ts"

// The production functions never set the flag, so every import outside the two
// *-e2e entry points must see E2E mode OFF.
Deno.test("E2E mode is off unless an e2e entry point set the flag", () => {
  assertEquals(E2E_MODE, false)
})

Deno.test("the E2E token never unlocks anything outside E2E mode", () => {
  Deno.env.set("E2E_TEST_TOKEN", "secret-token")
  const req = new Request("https://example.com", { method: "POST", headers: { "x-eden-e2e": "secret-token" } })
  assertEquals(e2eRequestAllowed(req), false)
  Deno.env.delete("E2E_TEST_TOKEN")
})

Deno.test("isE2eMetadata only accepts the exact string 'true'", () => {
  assertEquals(isE2eMetadata({ e2e_test: "true" }), true)
  assertEquals(isE2eMetadata({ e2e_test: "false" }), false)
  assertEquals(isE2eMetadata({}), false)
  assertEquals(isE2eMetadata(null), false)
})
