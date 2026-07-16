// scripts/reconcile-preorders.ts
//
// Preorder reconciliation — Stripe is the source of truth for payment. Compares paid
// preorder Checkout Sessions in Stripe against the orders table in BOTH directions and
// reports anything that exists in one but not the other (covers a missed webhook), plus
// amount mismatches and orders stuck in 'paid' (a crash between recording and the
// preorder_hold transition). READ-ONLY: this script never writes anywhere.
//
// Run from the repo root (founder PC or anywhere with the secrets):
//   deno run --allow-net --allow-env scripts/reconcile-preorders.ts [--days 30]
//
// Required env vars:
//   STRIPE_SECRET_KEY           (sk_live_...)
//   SUPABASE_URL                (https://noeqztssupewjidpvhar.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY
//
// Exit codes: 0 = clean, 1 = discrepancies found, 2 = configuration/API error.

function required(name: string): string {
  const v = Deno.env.get(name)
  if (!v) {
    console.error(`Missing required env var ${name}`)
    Deno.exit(2)
  }
  return v
}

const STRIPE_KEY = required("STRIPE_SECRET_KEY")
const SUPABASE_URL = required("SUPABASE_URL").replace(/\/$/, "")
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY")

const daysIdx = Deno.args.indexOf("--days")
const days = daysIdx >= 0 ? Number(Deno.args[daysIdx + 1]) : 30
if (!Number.isFinite(days) || days <= 0) {
  console.error(`Invalid --days value`)
  Deno.exit(2)
}
const sinceUnix = Math.floor(Date.now() / 1000) - days * 86400

interface StripeSession {
  id: string
  status: string
  payment_status: string
  amount_total: number | null
  payment_intent: string | null
  created: number
  metadata?: Record<string, string>
  customer_details?: { email?: string | null } | null
}

async function listStripePreorderSessions(): Promise<StripeSession[]> {
  const out: StripeSession[] = []
  let startingAfter: string | null = null
  while (true) {
    const params = new URLSearchParams({ limit: "100" })
    params.set("created[gte]", String(sinceUnix))
    if (startingAfter) params.set("starting_after", startingAfter)
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    })
    if (!res.ok) {
      console.error(`Stripe API error ${res.status}: ${await res.text()}`)
      Deno.exit(2)
    }
    const json = await res.json()
    out.push(...(json.data as StripeSession[]))
    if (!json.has_more || json.data.length === 0) break
    startingAfter = json.data[json.data.length - 1].id
  }
  // Preorder sessions only: stamped with preorder_sku metadata by create-checkout,
  // completed and actually paid.
  return out.filter((s) =>
    s.metadata?.preorder_sku && s.status === "complete" && s.payment_status === "paid"
  )
}

interface OrderRow {
  id: string
  stripe_checkout_session_id: string
  stripe_payment_intent_id: string | null
  customer_email: string | null
  status: string
  amount_total_cents: number | null
  is_preorder: boolean
  created_at: string
}

async function listPreorders(): Promise<OrderRow[]> {
  // 1-day buffer behind the Stripe cutoff so boundary sessions still match.
  const sinceIso = new Date((sinceUnix - 86400) * 1000).toISOString()
  const url = `${SUPABASE_URL}/rest/v1/orders` +
    `?select=id,stripe_checkout_session_id,stripe_payment_intent_id,customer_email,status,amount_total_cents,is_preorder,created_at` +
    `&is_preorder=eq.true&created_at=gte.${encodeURIComponent(sinceIso)}&limit=10000`
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) {
    console.error(`Supabase REST error ${res.status}: ${await res.text()}`)
    Deno.exit(2)
  }
  return await res.json() as OrderRow[]
}

const [sessions, orders] = await Promise.all([listStripePreorderSessions(), listPreorders()])

const ordersBySession = new Map(orders.map((o) => [o.stripe_checkout_session_id, o]))
const sessionsById = new Map(sessions.map((s) => [s.id, s]))

const missingInDb = sessions.filter((s) => !ordersBySession.has(s.id))
const orphanOrders = orders.filter((o) => !sessionsById.has(o.stripe_checkout_session_id))
const amountMismatches = sessions
  .map((s) => ({ s, o: ordersBySession.get(s.id) }))
  .filter((x): x is { s: StripeSession; o: OrderRow } => !!x.o)
  .filter(({ s, o }) => s.amount_total != null && o.amount_total_cents != null && s.amount_total !== o.amount_total_cents)
const stuckPaid = orders.filter((o) => o.status === "paid")
const testSessions = sessions.filter((s) => s.metadata?.preorder_test === "true")

console.log(`\n── Preorder reconciliation · last ${days} days ──`)
console.log(`Stripe paid preorder sessions : ${sessions.length}${testSessions.length ? ` (${testSessions.length} admin-test)` : ""}`)
console.log(`Preorder rows in orders table : ${orders.length}\n`)

let issues = 0

if (missingInDb.length) {
  issues += missingInDb.length
  console.log(`❌ PAID IN STRIPE, MISSING IN DB (missed webhook — resend the event from the Stripe Dashboard):`)
  for (const s of missingInDb) {
    console.log(`   ${s.id}  ${s.metadata?.preorder_sku}  $${((s.amount_total ?? 0) / 100).toFixed(2)}  ${s.customer_details?.email ?? "(no email)"}  ${new Date(s.created * 1000).toISOString()}`)
  }
  console.log("")
}

if (orphanOrders.length) {
  issues += orphanOrders.length
  console.log(`❌ IN DB, NOT FOUND AMONG PAID STRIPE SESSIONS (verify in the Stripe Dashboard — could be outside the ${days}-day window, or a session that was never actually paid):`)
  for (const o of orphanOrders) {
    console.log(`   ${o.stripe_checkout_session_id}  status=${o.status}  ${o.customer_email ?? "(no email)"}  created=${o.created_at}`)
  }
  console.log("")
}

if (amountMismatches.length) {
  issues += amountMismatches.length
  console.log(`❌ AMOUNT MISMATCHES (Stripe vs orders.amount_total_cents):`)
  for (const { s, o } of amountMismatches) {
    console.log(`   ${s.id}  stripe=$${((s.amount_total ?? 0) / 100).toFixed(2)}  db=$${((o.amount_total_cents ?? 0) / 100).toFixed(2)}`)
  }
  console.log("")
}

if (stuckPaid.length) {
  issues += stuckPaid.length
  console.log(`⚠️  ORDERS STUCK IN 'paid' (recorded but never transitioned to preorder_hold — the confirmation likely never sent; replay the checkout.session.completed event from Stripe):`)
  for (const o of stuckPaid) {
    console.log(`   ${o.stripe_checkout_session_id}  ${o.customer_email ?? "(no email)"}  created=${o.created_at}`)
  }
  console.log("")
}

if (issues === 0) {
  console.log("✅ Clean. Every paid Stripe preorder session has a matching order row, amounts agree, and no order is stuck in 'paid'.")
  Deno.exit(0)
} else {
  console.log(`Found ${issues} discrepancy item(s).`)
  Deno.exit(1)
}
