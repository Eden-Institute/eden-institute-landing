// supabase/functions/create-checkout/index.ts
// Eden Apothecary — Stripe Checkout session creator
//
// Dispatches between TWO product classes:
//   1. Subscription products (Seed/Root/Practitioner monthly+yearly) —
//      mode="subscription", REQUIRES authenticated Supabase user (JWT in
//      Authorization header). The created Stripe Customer is tied to the
//      Supabase user_id so the stripe-webhook EF can reconcile
//      profiles.subscription_status.
//   2. One-off products ($14 Constitutional Deep-Dive Guide) —
//      mode="payment", auth OPTIONAL. Anonymous quiz takers can buy the
//      guide directly off /assessment without signing up. Email is
//      captured into Stripe Checkout via customer_email so verify-session
//      can attribute the purchase to a quiz_completions row.
//
// Deploy with verify_jwt=false because the function does its own auth
// dispatch — subscriptions check JWT inside, one-offs allow anonymous.
// Setting verify_jwt=true at the platform level would block anonymous
// one-off purchases (the original Phase 5 #4 silent-fail bug).
//
// Phase 5 fix #4 / launch-blocker #58a: previous version returned 401
// for anonymous one-off attempts and 400 for missing lookup_key (logs
// confirmed 3× 400 + 1× 401 from Deep-Dive Guide CTA today). This
// version explicitly supports the anonymous one-off path and validates
// lookup_keys against an explicit allowlist.

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

// Subscription lookup_keys — mode="subscription", auth required.
const SUBSCRIPTION_LOOKUP_KEYS = new Set([
  "seed_monthly",
  "seed_yearly",
  "root_monthly",
  "root_yearly",
  "practitioner_monthly",
  "practitioner_yearly",
])

// One-off lookup_keys — mode="payment", auth optional (anonymous purchase OK).
const ONE_OFF_LOOKUP_KEYS = new Set([
  "deep_dive_guide",
])

// Lookup_keys explicitly blocked from purchase right now (Practitioner
// ships Phase 3, end 2027 per Locked Decision §0.8 #3).
const DISABLED_LOOKUP_KEYS = new Set([
  "practitioner_monthly",
  "practitioner_yearly",
])

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405)
  }

  try {
    // 1. Parse and validate the request body
    const body = await req.json().catch(() => ({}))
    const {
      lookup_key,
      success_url,
      cancel_url,
      constitution_type,
      constitution_nickname,
      email: bodyEmail,
    } = body

    if (!lookup_key || typeof lookup_key !== "string") {
      return jsonError("Missing or invalid 'lookup_key' in request body", 400)
    }

    if (DISABLED_LOOKUP_KEYS.has(lookup_key)) {
      return jsonError(`The '${lookup_key}' tier is not yet available`, 403)
    }

    const isSubscription = SUBSCRIPTION_LOOKUP_KEYS.has(lookup_key)
    const isOneOff = ONE_OFF_LOOKUP_KEYS.has(lookup_key)

    if (!isSubscription && !isOneOff) {
      return jsonError(`Unknown lookup_key '${lookup_key}'`, 404)
    }

    // 2. Auth dispatch — subscriptions require JWT, one-offs allow anonymous.
    const authHeader = req.headers.get("Authorization")
    let user: { id: string; email: string | null } | null = null

    if (isSubscription) {
      if (!authHeader) {
        return jsonError("Missing Authorization header", 401)
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser()
      if (authError || !authUser) {
        return jsonError("Invalid or expired session", 401)
      }
      user = { id: authUser.id, email: authUser.email ?? null }
    } else if (authHeader) {
      // One-off with optional auth header — best-effort capture of user
      // identity for downstream linking; never fail the call if invalid.
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        )
        const { data: { user: authUser } } = await userClient.auth.getUser()
        if (authUser) {
          user = { id: authUser.id, email: authUser.email ?? null }
        }
      } catch (e) {
        console.warn("Optional auth on one-off failed (proceeding anonymously):", e)
      }
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
    const mode = isSubscription ? "subscription" : "payment"

    // 4. For subscriptions: get-or-create the Stripe Customer for this user.
    //    For one-offs: skip Customer creation; rely on customer_email so the
    //    purchase isn't permanently bound to a Supabase account that may not exist.
    let stripeCustomerId: string | null = null
    if (isSubscription && user) {
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

      stripeCustomerId = profile?.stripe_customer_id ?? null

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
    }

    // 5. Build the metadata bag (mirrored to session.metadata for one-offs
    //    so verify-session can read constitution_type / email regardless of mode).
    const metadata: Record<string, string> = { lookup_key }
    if (typeof constitution_type === "string" && constitution_type) metadata.constitution_type = constitution_type
    if (typeof constitution_nickname === "string" && constitution_nickname) metadata.constitution_nickname = constitution_nickname
    if (user?.id) metadata.supabase_user_id = user.id
    if (typeof bodyEmail === "string" && bodyEmail) metadata.email = bodyEmail

    // 6. Construct the Checkout Session.
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: success_url || (isSubscription
        ? "https://edeninstitute.health/apothecary/welcome?session_id={CHECKOUT_SESSION_ID}"
        : "https://edeninstitute.health/assessment"), // fallback for one-off; callers should pass real /guide/[slug] URL
      cancel_url: cancel_url || (isSubscription
        ? "https://edeninstitute.health/apothecary/pricing"
        : "https://edeninstitute.health/assessment"),
      allow_promotion_codes: true,
    }

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId
    } else if (typeof bodyEmail === "string" && bodyEmail) {
      sessionParams.customer_email = bodyEmail
    }

    if (mode === "subscription") {
      sessionParams.subscription_data = { metadata }
    } else {
      sessionParams.payment_intent_data = { metadata }
      // Also set on the session object so verify-session.session.metadata works.
      sessionParams.metadata = metadata
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
