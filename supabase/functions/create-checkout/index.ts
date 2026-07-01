// supabase/functions/create-checkout/index.ts
// Eden Apothecary — Stripe Checkout session creator
//
// Dispatches between THREE product classes:
//   1. Subscription products (Seed/Root/Practitioner monthly+yearly) —
//      mode="subscription", REQUIRES authenticated Supabase user (JWT in
//      Authorization header). The created Stripe Customer is tied to the
//      Supabase user_id so the stripe-webhook EF can reconcile
//      profiles.subscription_status.
//   2. One-off DIGITAL products (Deep-Dive Guide $4.99) —
//      mode="payment", auth OPTIONAL, no shipping. Anonymous quiz takers
//      can buy directly off /assessment.
//   3. One-off PHYSICAL products (Eden's Table homeschool curriculum:
//      sprouts_complete, seedlings_complete, two_band_bundle, nb_addon) —
//      mode="payment", auth OPTIONAL for non-restricted, REQUIRED for
//      bundle-restricted (nb_addon). Shipping address always collected;
//      shipping rates vary by lookup_key.
//
// Bundle-restricted gating: nb_addon ($39 Add-on Student Notebook) requires
// the calling user to be a Two-Band Bundle buyer. Enforced by:
//   - JWT auth required (so we know which user is asking)
//   - profiles.homeschool_bundle_buyer must be true
//   - Returns 403 with code BUNDLE_REQUIRED otherwise
// The flag is set by the stripe-webhook EF on successful bundle purchase.
//
// Deploy with verify_jwt=false because the function does its own auth
// dispatch — subscriptions + nb_addon check JWT inside, anonymous one-offs
// don't. Setting verify_jwt=true at the platform level would block
// anonymous one-off purchases (the original Phase 5 #4 silent-fail bug).

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

// One-off lookup_keys — mode="payment", auth optional unless bundle-restricted.
const ONE_OFF_LOOKUP_KEYS = new Set([
  "deep_dive_guide",
  "sprouts_complete",
  "seedlings_complete",
  "two_band_bundle",
  "nb_addon",
])

// Bundle-restricted lookup_keys — require JWT auth AND
// profiles.homeschool_bundle_buyer=true. Add-on Student Notebook is only
// available to households that purchased the Two-Band Family Bundle.
const BUNDLE_RESTRICTED_LOOKUP_KEYS = new Set([
  "nb_addon",
])

// Physical product lookup_keys — Stripe Checkout must collect shipping
// address and offer shipping_options. Free for bundle (already paid for
// it), zero-fee for nb_addon (ships inside the bundle box).
const PHYSICAL_LOOKUP_KEYS = new Set([
  "sprouts_complete",
  "seedlings_complete",
  "two_band_bundle",
  "nb_addon",
])

// Lookup_keys that ship at the customer's cost (paid shipping at checkout).
const PAID_SHIPPING_LOOKUP_KEYS = new Set([
  "sprouts_complete",
  "seedlings_complete",
])

// Lookup_keys that ship free (the bundle includes shipping; the add-on
// notebook ships inside the bundle box at zero incremental cost).
const FREE_SHIPPING_LOOKUP_KEYS = new Set([
  "two_band_bundle",
  "nb_addon",
])

// Lookup_keys explicitly blocked from purchase right now (Practitioner
// ships Phase 3, end 2027 per Locked Decision §0.8 #3).
const DISABLED_LOOKUP_KEYS = new Set([
  "practitioner_monthly",
  "practitioner_yearly",
])

// Explicit Stripe price-ID overrides by lookup_key. When set, this exact
// price is billed instead of resolving by Stripe lookup_key — so the
// Deep-Dive Guide always charges the intended $4.99 price regardless of which
// price currently carries the 'deep_dive_guide' lookup key.
const PRICE_ID_OVERRIDES: Record<string, string> = {
  deep_dive_guide: "price_1TiHqt2NWfYbCZT8ghDRlWiO",
}

// Standard US shipping rate for single-band homeschool boxes.
// $12 covers USPS Priority Mail in the 2-3lb weight class for the curriculum
// box dimensions. Override at scale by configuring real shipping rates in
// the Stripe Dashboard and switching to shipping_rate (id reference) instead
// of shipping_rate_data (inline) below.
const STANDARD_SHIPPING_CENTS = 1200

/**
 * Only accept caller-supplied success_url / cancel_url values on our production
 * origin, so a checkout session cannot redirect the payer to an attacker host.
 * The Stripe {CHECKOUT_SESSION_ID} placeholder in the query is fine — the URL
 * parser keeps the hostname intact.
 */
function isSafeReturnUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return false
    return (
      parsed.hostname === "edeninstitute.health" ||
      parsed.hostname === "www.edeninstitute.health"
    )
  } catch {
    return false
  }
}

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
    const isBundleRestricted = BUNDLE_RESTRICTED_LOOKUP_KEYS.has(lookup_key)
    const isPhysical = PHYSICAL_LOOKUP_KEYS.has(lookup_key)

    if (!isSubscription && !isOneOff) {
      return jsonError(`Unknown lookup_key '${lookup_key}'`, 404)
    }

    // 2. Auth dispatch
    //    - Subscriptions: JWT required
    //    - Bundle-restricted one-offs (nb_addon): JWT required + flag check
    //    - Other one-offs: JWT optional (best-effort identity capture)
    const authHeader = req.headers.get("Authorization")
    let user: { id: string; email: string | null } | null = null

    if (isSubscription || isBundleRestricted) {
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
      // Optional best-effort identity capture for digital + physical one-offs.
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

    // 3. Bundle-restricted gate: enforce homeschool_bundle_buyer flag for nb_addon.
    if (isBundleRestricted) {
      if (!user) {
        // Should be unreachable — auth dispatch above would have 401'd already —
        // but defensive.
        return jsonError("Authentication required for bundle add-on", 401)
      }
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      )
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("homeschool_bundle_buyer")
        .eq("user_id", user.id)
        .maybeSingle()

      if (profileError) {
        return jsonError(`Profile read failed: ${profileError.message}`, 500)
      }

      if (!profile?.homeschool_bundle_buyer) {
        return new Response(
          JSON.stringify({
            error:
              "This add-on is available only to Two-Band Family Bundle owners.",
            code: "BUNDLE_REQUIRED",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403,
          },
        )
      }
    }

    // 4. Resolve the Stripe price. Prefer an explicit price-ID override when
    //    configured (e.g. the Deep-Dive Guide $4.99 price); otherwise look up
    //    the active price by lookup_key.
    let price: Stripe.Price
    const overrideId = PRICE_ID_OVERRIDES[lookup_key]
    if (overrideId) {
      price = await stripe.prices.retrieve(overrideId)
    } else {
      const prices = await stripe.prices.list({
        lookup_keys: [lookup_key],
        active: true,
        limit: 1,
      })
      if (prices.data.length === 0) {
        return jsonError(`No active Stripe price found for lookup_key '${lookup_key}'`, 404)
      }
      price = prices.data[0]
    }
    const mode = isSubscription ? "subscription" : "payment"

    // 5. For subscriptions: get-or-create the Stripe Customer for this user.
    //    For one-offs: skip Customer creation unless we have a Supabase user
    //    (best-effort linking). Bundle buyers always link to the user we
    //    require above; non-restricted one-offs can be anonymous.
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

    // 6. Build the metadata bag (mirrored to session.metadata for one-offs
    //    so verify-session + stripe-webhook can read constitution_type /
    //    email / lookup_key regardless of mode).
    const metadata: Record<string, string> = { lookup_key }
    if (typeof constitution_type === "string" && constitution_type) metadata.constitution_type = constitution_type
    if (typeof constitution_nickname === "string" && constitution_nickname) metadata.constitution_nickname = constitution_nickname
    if (user?.id) metadata.supabase_user_id = user.id
    if (typeof bodyEmail === "string" && bodyEmail) metadata.email = bodyEmail

    // 7. Construct the Checkout Session.
    //    Defaults for success/cancel URLs depend on product class:
    //    - Subscriptions → /apothecary/welcome
    //    - Deep-Dive Guide one-off → /assessment (caller usually overrides
    //      with /guide/[slug])
    //    - Homeschool one-offs → /homeschool/welcome
    const homeschoolDefaultSuccess =
      "https://edeninstitute.health/homeschool/welcome?session_id={CHECKOUT_SESSION_ID}&lookup_key=" +
      encodeURIComponent(lookup_key)
    const homeschoolDefaultCancel = "https://edeninstitute.health/homeschool#pricing"

    const defaultSuccessUrl = isSubscription
      ? "https://edeninstitute.health/apothecary/welcome?session_id={CHECKOUT_SESSION_ID}"
      : isPhysical
        ? homeschoolDefaultSuccess
        : "https://edeninstitute.health/assessment"
    const defaultCancelUrl = isSubscription
      ? "https://edeninstitute.health/apothecary/pricing"
      : isPhysical
        ? homeschoolDefaultCancel
        : "https://edeninstitute.health/assessment"

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [{ price: price.id, quantity: 1 }],
      // Only honor caller-supplied redirect URLs on our own origin — otherwise
      // fall back to the safe default. An unvalidated success_url would let an
      // attacker mint an Eden-branded Checkout session that redirects the payer
      // to an arbitrary host after payment.
      success_url: isSafeReturnUrl(success_url) ? success_url : defaultSuccessUrl,
      cancel_url: isSafeReturnUrl(cancel_url) ? cancel_url : defaultCancelUrl,
      allow_promotion_codes: true,
    }

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId
    } else if (typeof bodyEmail === "string" && bodyEmail) {
      sessionParams.customer_email = bodyEmail
    }

    // For homeschool physical products without an explicit Stripe Customer,
    // ask Stripe to create one from the buyer's email. This gives us a
    // persistent Stripe Customer the webhook can link to the auto-provisioned
    // Supabase user, and means repeat purchases (e.g., adding the bundle
    // add-on later) can reuse the same Customer.
    if (mode === "payment" && isPhysical && !stripeCustomerId) {
      sessionParams.customer_creation = "always"
    }

    // Shipping address collection + shipping rate for physical products.
    if (isPhysical) {
      sessionParams.shipping_address_collection = {
        allowed_countries: ["US"],
      }

      const shippingRateData: Stripe.Checkout.SessionCreateParams.ShippingOption.ShippingRateData =
        FREE_SHIPPING_LOOKUP_KEYS.has(lookup_key)
          ? {
              type: "fixed_amount",
              fixed_amount: { amount: 0, currency: "usd" },
              display_name:
                lookup_key === "two_band_bundle"
                  ? "Free shipping (included with bundle)"
                  : "No additional shipping (ships with your bundle)",
              delivery_estimate: {
                minimum: { unit: "business_day", value: 5 },
                maximum: { unit: "business_day", value: 10 },
              },
            }
          : {
              type: "fixed_amount",
              fixed_amount: { amount: STANDARD_SHIPPING_CENTS, currency: "usd" },
              display_name: "Standard shipping (5-7 business days)",
              delivery_estimate: {
                minimum: { unit: "business_day", value: 5 },
                maximum: { unit: "business_day", value: 7 },
              },
            }

      sessionParams.shipping_options = [{ shipping_rate_data: shippingRateData }]
    }

    if (mode === "subscription") {
      sessionParams.subscription_data = { metadata }
    } else {
      sessionParams.payment_intent_data = { metadata }
      // Also set on the session object so verify-session + stripe-webhook
      // can read session.metadata directly without expanding line_items.
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
