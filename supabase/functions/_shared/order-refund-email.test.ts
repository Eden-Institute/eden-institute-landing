import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { buildOrderEmail, buildRefundEmail } from "./order-messages.ts"
import type { OrderRow } from "./order-db.ts"

function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    order_number: "ET-1028",
    customer_email: "buyer@example.com",
    customer_phone: null,
    shipping_name: "Jane Doe",
    product_label: "Sprouts Printed Curriculum Set",
    amount_total_cents: 26100,
    currency: "usd",
    sms_consent: false,
    status: "refunded",
    is_preorder: false,
    ...over,
  }
}

Deno.test("refund email names the order, the amount and the buyer", () => {
  const { subject, html } = buildRefundEmail(order())
  assertEquals(subject, "Your refund is on its way (ET-1028)")
  assertStringIncludes(html, "Hi Jane,")
  assertStringIncludes(html, "<strong>$261.00</strong> is on its way back to you")
  assertStringIncludes(html, "<strong>ET-1028</strong> (Sprouts Printed Curriculum Set)")
  assertStringIncludes(html, "Klarna")
})

Deno.test("refund email is reachable through the template registry", () => {
  assertEquals(buildOrderEmail("refund_confirmation", order()).subject, "Your refund is on its way (ET-1028)")
})

Deno.test("digital orders with no shipping name use the billing first name", () => {
  const { html } = buildRefundEmail(order({ shipping_name: null, raw: { customer_details: { name: "Mary Smith" } } }))
  assertStringIncludes(html, "Hi Mary,")
})

Deno.test("buyer-typed text is escaped and no em dashes appear", () => {
  const { html } = buildRefundEmail(order({ shipping_name: "<b>x</b> y", product_label: "A & B" }))
  assert(!html.includes("<b>x</b>"))
  assertStringIncludes(html, "A &amp; B")
  assert(!html.includes("—"), "copy rule: no em dashes")
})

Deno.test("missing order number and amount still read cleanly", () => {
  const { subject, html } = buildRefundEmail(order({ order_number: null, amount_total_cents: null }))
  assertEquals(subject, "Your refund is on its way")
  assertStringIncludes(html, "Your money is on its way back to you for your Sprouts Printed Curriculum Set.")
})
