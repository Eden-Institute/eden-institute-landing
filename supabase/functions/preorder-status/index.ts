// supabase/functions/preorder-status/index.ts
// Public read of the founding-500 window, powering the live counter and the
// post-sellout price flip on /preorder (PreorderBuyBox island).
//
// Response: { sold, cap, closed, sms_enabled }
//   sold   — net founding units claimed, CLAMPED to cap for display: the checkout
//            gate can overshoot by a few under simultaneous checkout, and
//            "502 of 500" must never render.
//   cap    — founding_qty_limit for the gate SKU (null = uncapped).
//   closed — the one-way latch: true once the cap was ever reached. The island
//            flips its display to retail pricing off this flag; billing truth
//            stays with create-checkout, which reads the same founding_gate RPC.
//   sms_enabled — whether to show the SMS consent checkbox at all. Driven by the
//            SMS_CONSENT_ENABLED secret so it flips with no redeploy, the same
//            pattern as PREORDERS_LIVE. Set it to "true" ONLY once A2P 10DLC
//            registration is approved and the Twilio line can actually send.
//            Until then the order flow still fires preorder_received_sms for any
//            consenting order, which fails and throws, and the buyer who asked to
//            be texted hears nothing. The island fails CLOSED on this field.
//
// The founding_units_sold / founding_gate RPCs stay service-role-only; this EF is
// the single public window onto them, and it exposes no order data. Calling
// founding_gate here also advances the latch: a page load after the 500th sale
// closes the window even before the next checkout attempt.
//
// Deploy with verify_jwt=false (supabase/config.toml): called from the Astro
// island via supabase.functions.invoke with the anon key, and must also answer
// plain GETs (no Supabase JWT).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { FOUNDING_GATE_SKU } from "../_shared/order-config.ts"
import { getFoundingGate } from "../_shared/order-db.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: gate, error: gateError } = await adminClient
      .from("products")
      .select("id")
      .eq("sku", FOUNDING_GATE_SKU)
      .maybeSingle()
    if (gateError || !gate?.id) {
      throw new Error(gateError?.message ?? `gate product '${FOUNDING_GATE_SKU}' not found`)
    }

    const status = await getFoundingGate(adminClient, gate.id)
    const sold = status.cap != null ? Math.min(status.sold, status.cap) : status.sold

    const smsEnabled = Deno.env.get("SMS_CONSENT_ENABLED") === "true"

    return new Response(
      JSON.stringify({ sold, cap: status.cap, closed: status.closed, sms_enabled: smsEnabled }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Brief CDN/browser cache: the counter may lag sales by up to a minute,
          // which is fine for a display number; billing never reads this endpoint.
          "Cache-Control": "public, max-age=30, s-maxage=30",
        },
        status: 200,
      },
    )
  } catch (err) {
    // 500 (not a fabricated payload): the island fails open to the founding
    // display, mirroring create-checkout's customer-favorable fail-open.
    const message = err instanceof Error ? err.message : String(err)
    console.error("preorder-status failed:", message)
    return new Response(
      JSON.stringify({ error: "status unavailable" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    )
  }
})
