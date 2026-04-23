// supabase/functions/create-checkout/index.ts
// Eden Apothecary — Stripe Checkout session creator
// Handles subscription mode (seed/root/practitioner) and one-time payment mode (curriculum bundles, future)
// Auth: requires logged-in Supabase user (JWT in Authorization header)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Lookup keys that should create a SUBSCRIPTION (recurring billing)
const SUBSCRIPTION_LOOKUP_KEYS = new Set([
  "seed_monthly",
  "seed_yearly",
  "root_monthly",
  "root_yearly",
  "practitioner_monthly",
  "practitioner_yearly",
])

// Lookup keys explicitly blocked from purchase right now (Practitioner ships Phase 3, end 2027)
const DISABLED_LOOKUP_KEYS = new Set([
  "practitioner_monthly",
  "practitioner_yearly",
])

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405)
  }

  try {
    // 1. Authenticate via JWT
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonError("Missing Authorization header", 401)
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return jsonError("Invalid or expired session", 401)
    }

    // 2. Parse and validate the request body
    const body = await req.json().catch(() => ({}))
    const { lookup_key, success_url, cancel_url } = body

    if (!lookup_key || typeof lookup_key !== "string") {
      return jsonError("Missing or invalid 'lookup_key' in request body", 400)
    }

    if (DISABLED_LOOKUP_KEYS.has(lookup_key)) {
      return jsonError(`The '${lookup_key}' tier is not yet available`, 403)
    }

    // 3. Look up the active Stripe price by lookup_key
    const prices = await stripe.prices.list({
      lookup_keys: [lookup_key],
      active: true,
      limit: 1,
    })

    if (prices.data.length === 0) {
      return jsonError(`No active Stripe price found for lookup_key '${lookup_key}'`, 404)
    }

    const price = prices.data[0]
    const mode = SUBSCRIPTION_LOOKUP_KEYS.has(lookup_key) ? "subscription" : "payment"

    // 4. Get-or-create the Stripe Customer for this user (admin client bypasses RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (profileError) {
      return jsonError(`Profile lookup failed: ${profileError.message}`, 500)
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      stripeCustomerId = customer.id

      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("user_id", user.id)

      if (updateError) {
        console.error("Failed to persist stripe_customer_id:", updateError)
        // Continue anyway — the Stripe Customer is created and the webhook can reconcile.
      }
    }

    // 5. Create the Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      customer: stripeCustomerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: success_url || "https://edeninstitute.health/apothecary/welcome?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancel_url || "https://edeninstitute.health/apothecary/pricing",
      allow_promotion_codes: true,
    }

    if (mode === "subscription") {
      sessionParams.subscription_data = {
        metadata: {
          supabase_user_id: user.id,
          lookup_key,
        },
      }
    } else {
      sessionParams.payment_intent_data = {
        metadata: {
          supabase_user_id: user.id,
          lookup_key,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (err) {
    console.error("create-checkout error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return jsonError(message, 500)
  }
})

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  )
}
