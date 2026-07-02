// supabase/functions/founder-fulfillment/index.ts
// Eden's Table — founder-only fulfillment actions (fulfillment Phase 2 / spec Phases 4+5)
//
// The action endpoint behind the /founder Orders queue. Auth: requires a Supabase user
// JWT AND the founder email (mirrors the is_founder() boundary the founder_* read RPCs
// use). Every state change flows through the shared transition engine, so edge
// validation and message idempotency are identical no matter which button fired it.
//
// Actions (POST JSON { action, sku?, order_id?, order_ids? }):
//   release_preorders  { sku }        preorder_hold -> ready_to_fulfill for a product
//   release_orders     { order_ids }  same, for a bulk-selected set of orders
//   validate_address   { order_id }   EasyPost delivery verification; flags the order
//   buy_label          { order_id }   validate -> single combined shipment -> lowest
//                                     rate -> capture label/tracking/cost -> label_created
//   void_label         { order_id }   EasyPost refund; back to ready_to_fulfill
//   mark_shipped       { order_id }   AFTER carrier pickup; fires tracking email/SMS
//   mark_delivered     { order_id }   manual override of the carrier webhook

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  buyLabelForOrder,
  markOrderDelivered,
  markOrderShipped,
  releaseOrders,
  releasePreordersForProduct,
  validateOrderAddress,
  voidOrderLabel,
} from "../_shared/order-fulfillment.ts"
import { captureException } from "../_shared/sentry.ts"

const FOUNDER_EMAIL = "hello@edeninstitute.health"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  // ── Founder auth gate ──
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401)
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: "Invalid or expired session" }, 401)
  if ((user.email ?? "").toLowerCase() !== FOUNDER_EMAIL) {
    return json({ error: "Founder access only" }, 403)
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = await req.json().catch(() => ({}))
  const action = String(body.action ?? "")

  try {
    switch (action) {
      case "release_preorders": {
        const sku = String(body.sku ?? "")
        if (!sku) return json({ error: "Missing sku" }, 400)
        const result = await releasePreordersForProduct(adminClient, sku)
        console.log(`release_preorders(${sku}) by founder:`, JSON.stringify(result))
        return json({ ok: true, ...result })
      }
      case "release_orders": {
        const ids: string[] = Array.isArray(body.order_ids) ? body.order_ids.map(String) : []
        if (ids.length === 0) return json({ error: "Missing order_ids" }, 400)
        const result = await releaseOrders(adminClient, ids)
        return json({ ok: true, ...result })
      }
      case "validate_address": {
        if (!body.order_id) return json({ error: "Missing order_id" }, 400)
        const result = await validateOrderAddress(adminClient, String(body.order_id))
        return json({ ok: true, ...result })
      }
      case "buy_label": {
        if (!body.order_id) return json({ error: "Missing order_id" }, 400)
        const result = await buyLabelForOrder(adminClient, String(body.order_id))
        return result.ok ? json(result) : json(result, 422)
      }
      case "void_label": {
        if (!body.order_id) return json({ error: "Missing order_id" }, 400)
        await voidOrderLabel(adminClient, String(body.order_id))
        return json({ ok: true })
      }
      case "mark_shipped": {
        if (!body.order_id) return json({ error: "Missing order_id" }, 400)
        await markOrderShipped(adminClient, String(body.order_id))
        return json({ ok: true })
      }
      case "mark_delivered": {
        if (!body.order_id) return json({ error: "Missing order_id" }, 400)
        await markOrderDelivered(adminClient, String(body.order_id))
        return json({ ok: true })
      }
      default:
        return json({ error: `Unknown action '${action}'` }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`founder-fulfillment ${action} failed:`, message)
    await captureException(err, { function: "founder-fulfillment", action, order_id: body.order_id ?? null })
    return json({ error: message }, 500)
  }
})
