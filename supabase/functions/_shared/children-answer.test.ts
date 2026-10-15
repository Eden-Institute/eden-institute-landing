import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { childrenAnswerUrls, parseAnswer, signAnswerToken, verifyAnswerToken } from "./children-answer.ts"
import { signUnsubToken, verifyUnsubToken } from "./email-unsubscribe.ts"

Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-secret-for-children-answer")

Deno.test("a signed token verifies to its lowercased email and track", async () => {
  const t = await signAnswerToken("  Ann@Example.com ", "quiz")
  assertEquals(await verifyAnswerToken(t), { email: "ann@example.com", track: "quiz" })
})

Deno.test("a tampered, malformed or foreign token is refused", async () => {
  const t = await signAnswerToken("ann@example.com", "back_to_eden_ch1")
  const [p, s] = t.split(".")
  const other = btoa(JSON.stringify({ e: "eve@example.com", k: "quiz" })).replace(/=+$/, "")
  assertEquals(await verifyAnswerToken(`${other}.${s}`), null)
  assertEquals(await verifyAnswerToken(`${p}.${s}x`), null)
  assertEquals(await verifyAnswerToken("nope"), null)
  assertEquals(await verifyAnswerToken(42), null)
})

Deno.test("answer tokens and unsubscribe tokens never stand in for each other", async () => {
  const unsub = await signUnsubToken("ann@example.com", "constitution")
  assertEquals(await verifyAnswerToken(unsub), null)
  const answer = await signAnswerToken("ann@example.com", "quiz")
  assertEquals(await verifyUnsubToken(answer), null)
})

Deno.test("the links open the site page with the answer, never the function", async () => {
  const { yes, no } = await childrenAnswerUrls("ann@example.com", "quiz")
  assert(yes.startsWith("https://edeninstitute.health/answer?t=") && yes.endsWith("&a=yes"))
  assert(no.endsWith("&a=no"))
  const t = decodeURIComponent(new URL(yes).searchParams.get("t")!)
  assertEquals((await verifyAnswerToken(t))?.email, "ann@example.com")
})

Deno.test("only yes and no are answers", () => {
  assertEquals(parseAnswer("yes"), true)
  assertEquals(parseAnswer("no"), false)
  assertEquals(parseAnswer("YES"), null)
  assertEquals(parseAnswer(undefined), null)
})
