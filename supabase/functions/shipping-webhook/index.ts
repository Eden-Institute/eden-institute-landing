// supabase/functions/shipping-webhook/index.ts
// Eden's Table — EasyPost carrier webhook (fulfillment Phase 2 / spec Phase 7)
//
// Consumes EasyPost Events (tracker.updated). Auth model mirrors stripe-webhook: no JWT
// (deploy with verify_jwt=false); instead every request must carry a valid HMAC-SHA256
// signature over the raw body (X-Hmac-Signature) computed with EASYPOST_WEBHOOK_SECRET,
// the secret registered by scripts/setup-easypost-webhook.ts.
//
// Idempotency mirrors the Stripe spine: shipping_events ledger (event-id gate, fail-open
// on ledger errors) -> validated state transition -> message_log guard. A replayed
// delivery event can never double-send the delivered SMS.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyEasyPostSignature } from "../_shared/easypost.ts"
import {
  claimShippingEvent,
  getOrderByTracking,
  markOrderDelivered,
  markShippingEventError,
  markShippingEventProcessed,
} from "../_shared/order-fulfillment.ts"
import { captureException } from "../_shared/sentry.ts"

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const secret = Deno.env.get("EASYPOST_WEBHOOK_SECRET")
  if (!secret) {
    console.error("EASYPOST_WEBHOOK_SECRET missing; refusing all webhook traffic")
    return new Response("Not configured", { status: 503 })
  }

  const rawBody = await req.text()
  const ok = await verifyEasyPostSignature(rawBody, req.headers.get("X-Hmac-Signature"), secret)
  if (!ok) {
    console.error("EasyPost webhook signature verification failed")
    return new Response("Invalid signature", { status: 400 })
  }

  // deno-lint-ignore no-explicit-any
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }
  const eventId: string = event?.id ?? ""
  const description: string = event?.description ?? ""
  if (!eventId) return new Response("Missing event id", { status: 400 })

  console.log(`easypost event: ${description} (id: ${eventId})`)

  // Event-level idempotency gate (fail-open like the Stripe one: a rare duplicate is
  // absorbed downstream by canTransition + message_log).
  try {
    const { proceed } = await claimShippingEvent(adminClient, { id: eventId, type: description, payload: event })
    if (!proceed) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      })
    }
  } catch (err) {
    console.error(`shipping_events claim failed for ${eventId}:`, err instanceof Error ? err.message : String(err))
  }

  try {
    if (description === "tracker.updated") {
      const tracker = event?.result ?? {}
      const trackingCode: string | null = tracker?.tracking_code ?? null
      const status: string | null = tracker?.status ?? null

      if (trackingCode && status === "delivered") {
        const order = await getOrderByTracking(adminClient, trackingCode)
        if (!order) {
          console.warn(`tracker.updated delivered: no order for tracking ${trackingCode}`)
        } else if (order.status === "shipped") {
          await markOrderDelivered(adminClient, order.id)
          console.log(`order ${order.id} -> delivered (tracking ${trackingCode})`)
        } else if (order.status === "delivered") {
          console.log(`order ${order.id} already delivered; no-op`)
        } else {
          // Carrier says delivered but the founder never confirmed pickup (order is not
          // in shipped). Do not force an invalid edge; surface for manual review.
          const msg = `Carrier reports delivered but order ${order.id} is '${order.status}' (tracking ${trackingCode}); review in /founder Orders`
          console.warn(msg)
          await captureException(new Error(msg), { function: "shipping-webhook", order_id: order.id, order_status: order.status })
        }
      } else {
        console.log(`tracker.updated ignored (status=${status ?? "n/a"}, tracking=${trackingCode ?? "n/a"})`)
      }
    } else {
      console.log(`Unhandled EasyPost event: ${description}`)
    }

    await markShippingEventProcessed(adminClient, eventId)
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }, status: 200,
    })
  } catch (err) {
    console.error(`Error processing ${description}:`, err)
    await markShippingEventError(adminClient, eventId, err instanceof Error ? err.message : String(err)).catch(() => {})
    await captureException(err, { function: "shipping-webhook", event_id: eventId, event_type: description })
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    })
  }
})
