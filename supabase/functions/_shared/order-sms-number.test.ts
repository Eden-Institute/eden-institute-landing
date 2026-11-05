import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { smsNumberFor } from "./order-messages.ts"
import { usMobileE164 } from "./order-sms.ts"
import type { OrderRow } from "./order-db.ts"

function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    order_number: "ET-1042",
    customer_email: "buyer@example.com",
    customer_phone: "+19315550100",
    shipping_name: "Jane Doe",
    product_label: "Sprouts Printed Curriculum Set",
    amount_total_cents: 26100,
    currency: "usd",
    sms_consent: true,
    status: "paid",
    is_preorder: false,
    ...over,
  }
}

Deno.test("usMobileE164 takes a US number however it is typed", () => {
  assertEquals(usMobileE164("(931) 555-0123"), "+19315550123")
  assertEquals(usMobileE164("931.555.0123"), "+19315550123")
  assertEquals(usMobileE164("+1 931 555 0123"), "+19315550123")
  assertEquals(usMobileE164("19315550123"), "+19315550123")
})

Deno.test("usMobileE164 refuses anything that is not 10 US digits", () => {
  assertEquals(usMobileE164(""), null)
  assertEquals(usMobileE164(null), null)
  assertEquals(usMobileE164(5550123), null)
  assertEquals(usMobileE164("555-0123"), null)
  assertEquals(usMobileE164("+44 20 7946 0958"), null)
  assertEquals(usMobileE164("131-555-0123"), null)
  assertEquals(usMobileE164("931-055-0123"), null)
})

Deno.test("order texts go to the number typed next to the consent box", () => {
  const o = order({ raw: { metadata: { sms_consent: "true", sms_phone: "+19315550123" } } })
  assertEquals(smsNumberFor(o), "+19315550123")
})

Deno.test("a session from before the number field texts the Stripe phone, as before", () => {
  assertEquals(smsNumberFor(order({ raw: { metadata: { sms_consent: "true" } } })), "+19315550100")
  assertEquals(smsNumberFor(order({ raw: undefined })), "+19315550100")
  assertEquals(smsNumberFor(order({ raw: { metadata: { sms_phone: "  " } } })), "+19315550100")
})

Deno.test("no typed number and no Stripe phone means no text", () => {
  assertEquals(smsNumberFor(order({ customer_phone: null, raw: { metadata: {} } })), null)
})
