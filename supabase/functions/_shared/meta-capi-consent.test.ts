import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"

// The module reads META_CAPI_ACCESS_TOKEN at load, so set it before importing.
Deno.env.set("META_CAPI_ACCESS_TOKEN", "test-token-not-real")
const { hasMarketingConsent, sendMetaCapiPurchase, sendMetaCapiInitiateCheckout } = await import("./meta-capi.ts")

let calls = 0
globalThis.fetch = (async () => {
  calls++
  return new Response(JSON.stringify({ events_received: 1 }), { status: 200, headers: { "Content-Type": "application/json" } })
}) as typeof fetch

const purchase = {
  eventId: "cs_test_consent",
  email: "buyer@example.com",
  amountTotalCents: 26100,
  currency: "usd",
  billingName: "Jane Doe",
  city: "Clarksville",
  state: "TN",
  postalCode: "37043",
  country: "US",
}

Deno.test("consent signal: fbp or fbc present means the buyer tapped Accept", () => {
  assertEquals(hasMarketingConsent({}), false)
  assertEquals(hasMarketingConsent({ fbp: null, fbc: null }), false)
  assertEquals(hasMarketingConsent({ fbp: "  " }), false)
  assertEquals(hasMarketingConsent({ fbp: "fb.1.1730000000000.123" }), true)
  assertEquals(hasMarketingConsent({ fbc: "fb.1.1730000000000.abc" }), true)
})

Deno.test("Purchase is NOT sent to Meta for a buyer who did not accept", async () => {
  calls = 0
  assertEquals(await sendMetaCapiPurchase({ ...purchase }), false)
  assertEquals(calls, 0)
})

Deno.test("Purchase is sent to Meta for a buyer who accepted", async () => {
  calls = 0
  await sendMetaCapiPurchase({ ...purchase, fbp: "fb.1.1730000000000.123" })
  assertEquals(calls, 1)
})

Deno.test("InitiateCheckout with only an email (no Accept) is NOT sent", async () => {
  calls = 0
  assertEquals(await sendMetaCapiInitiateCheckout({ eventId: "cs_test_ic", email: "buyer@example.com" }), false)
  assertEquals(calls, 0)
})

Deno.test("InitiateCheckout is sent for a visitor who accepted", async () => {
  calls = 0
  await sendMetaCapiInitiateCheckout({ eventId: "cs_test_ic2", fbc: "fb.1.1730000000000.abc", valueCents: 26100 })
  assertEquals(calls, 1)
})
