// supabase/functions/create-checkout/index.ts
// Eden Apothecary — Stripe Checkout session creator
//
// Dispatches between FOUR product classes:
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
//   4. FOUNDING PREORDERS (preorder system Phase 1: sprouts_kit,
//      sprouts_notebook) — mode="payment", anonymous, requested via
//      `preorder_sku` (NOT lookup_key, so it can never collide with the
//      legacy dispatch above). Dark-launch gated by PREORDERS_LIVE;
//      Stripe Tax enabled; founding-vs-retail price selected off the
//      500-kit founding gate; flat $12 shipping per order; sms_consent
//      captured from an explicit unchecked checkbox on /preorder and
//      stamped into session metadata.
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
//
// Stripe Tax: automatic_tax is enabled on every session below (all three
// product classes share one sessionParams object). Requires Stripe Tax to be
// configured on the account (origin address + tax registrations); confirmed
// done 2026-07-02. Without automatic_tax, Checkout Sessions created via the
// API never calculate tax even if the Dashboard "Use automatic tax" toggle is
// on — that toggle only covers Dashboard-created Invoices/Subscriptions/Quotes.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { FOUNDING_GATE_SKU, PREORDER_FLAT_SHIPPING_CENTS, PREORDER_PRODUCTS, SHIP_WINDOW, preorderProductBySku } from "../_shared/order-config.ts"
import { getFoundingGate } from "../_shared/order-db.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-preorder-admin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Subscription lookup_keys — mode="subscription", auth required.
const SUBSCRIPTION_LOOKUP_KEYS = new Set([
  "seed_monthly",
  "seed_yearly",
  "root_monthly",
  "root_yearly",
  // Practitioner Solo launched 2026-07-09 (Lock #89 seam opened). The old
  // un-suffixed practitioner_monthly/yearly keys are deprecated per the
  // sub-tier Lock and intentionally absent.
  "practitioner_solo_monthly",
  "practitioner_solo_yearly",
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
      promo_code: bodyPromoCode,
      // Meta attribution cookies, collected client-side ONLY after marketing
      // consent (see src/lib/fbAttribution.ts). Carried through Stripe metadata so
      // the server-side Purchase can identify the ad click that produced the sale.
      fbp: bodyFbp,
      fbc: bodyFbc,
    } = body

    // 1b. Founding-preorder branch (preorder system Phase 1). Distinct request
    //     shape: { items: [{sku, qty}], sms_consent, accepted_ship_window,
    //     accepted_founding_member, success_url?, cancel_url?, email? }.
    //     `preorder_sku` is the legacy single-item alias for `items`.
    //     Uses its own fields (never lookup_key) so it cannot collide with the
    //     legacy homeschool/guide/subscription dispatch below.
    if (Array.isArray(body.items) || (typeof body.preorder_sku === "string" && body.preorder_sku)) {
      return await handlePreorderCheckout(req, body)
    }

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

      // Self-heal stale ids (2026-07-09): some early profiles carry a
      // stripe_customer_id that no longer exists in this live account
      // (test-mode/legacy leftovers). Stripe rejects the whole session with
      // resource_missing ("No such customer"), which surfaced as the
      // founder's non-2xx toast on the Practitioner founding CTA. Verify the
      // stored customer; if missing or deleted, fall through to the create
      // path below, which also persists the fresh id back to profiles.
      if (stripeCustomerId) {
        try {
          const existing = await stripe.customers.retrieve(stripeCustomerId)
          // deno-lint-ignore no-explicit-any
          if ((existing as any)?.deleted) {
            throw new Error("customer is deleted")
          }
        } catch (err) {
          console.warn(
            `Stored stripe_customer_id ${stripeCustomerId} is unusable ` +
              `(${err instanceof Error ? err.message : String(err)}); creating a fresh Customer`,
          )
          stripeCustomerId = null
        }
      }

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
    // Length-clamped: Stripe caps a metadata value at 500 chars, and these are
    // attacker-influencable (they arrive in the request body).
    if (typeof bodyFbp === "string" && bodyFbp) metadata.fbp = bodyFbp.slice(0, 255)
    if (typeof bodyFbc === "string" && bodyFbc) metadata.fbc = bodyFbc.slice(0, 255)

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
      // Stripe Tax: calculates tax on every session (subscriptions, digital,
      // and physical alike). Requires Stripe Tax configured on the account
      // (origin address + registrations) — confirmed done 2026-07-02. Without
      // this, Checkout Sessions never calculate tax regardless of the
      // Dashboard "Use automatic tax" toggle, which only covers
      // Dashboard-created Invoices/Subscriptions/Quotes, not API sessions.
      automatic_tax: { enabled: true },
    }

    // Promo pre-application (2026-07-09): a ?promo=CODE on the pricing page
    // flows through here so partner links and the founder testing code land
    // with the discount already applied — no hunting for the promo field
    // (which mobile Checkout tucks behind the collapsed order summary).
    // Stripe forbids combining `discounts` with `allow_promotion_codes`, so
    // a resolved code REPLACES the manual field; an unknown/inactive code
    // falls back to the manual field rather than failing the checkout.
    if (typeof bodyPromoCode === "string" && bodyPromoCode.trim()) {
      try {
        const promoList = await stripe.promotionCodes.list({
          code: bodyPromoCode.trim(),
          active: true,
          limit: 1,
        })
        const promo = promoList.data[0]
        if (promo) {
          sessionParams.discounts = [{ promotion_code: promo.id }]
          delete sessionParams.allow_promotion_codes
        } else {
          console.warn(`promo_code '${bodyPromoCode}' not found/active; leaving manual field enabled`)
        }
      } catch (err) {
        console.warn(
          "promo_code lookup failed; leaving manual field enabled: " +
            (err instanceof Error ? err.message : String(err)),
        )
      }
    }

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId
      // Stripe Tax + a pre-created Customer: automatic_tax refuses to create
      // the session unless the Customer has an address or we tell Checkout to
      // save the billing address the payer enters. Surfaced 2026-07-09 by the
      // Practitioner-launch checkout verification; applies to every
      // subscription session with an existing Customer (Seed/Root too).
      sessionParams.customer_update = { address: "auto" }
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

// ---------- Founding-preorder checkout (preorder system Phase 1) ----------
//
// Dark launch: while the PREORDERS_LIVE secret is not "true", public requests get a
// 403 PREORDERS_NOT_LIVE and no session is ever created. A request carrying the
// PREORDER_ADMIN_TOKEN secret in x-preorder-admin bypasses the gate so the exact
// production path can be end-to-end tested before launch. Launch flip = set
// PREORDERS_LIVE=true (no redeploy needed).
//
// Pricing: the founding cohort is a single window that ends when the gate SKU
// (sprouts_kit) has sold its founding allocation (500). Both products ride that
// cohort. Count-based selection can overshoot by a few under simultaneous checkout
// (accepted for a "first ~500" founding cohort; see docs/preorder-system-phase-1.md).
//
// Shipping: flat PREORDER_FLAT_SHIPPING_CENTS per order (founder decision 2026-07-02).
// No delivery estimate on the rate: the ship window is TBD, so we must not promise
// transit days. Stripe Tax taxes the shipping via its tax_code where states require.
//
// Tax: automatic_tax on. Requires Stripe Tax configured in the Dashboard (origin
// address, registrations, product tax codes) BEFORE launch or session creation 400s.
// deno-lint-ignore no-explicit-any
async function handlePreorderCheckout(req: Request, body: Record<string, any>): Promise<Response> {
  // Dark-launch gate.
  const live = Deno.env.get("PREORDERS_LIVE") === "true"
  const adminToken = Deno.env.get("PREORDER_ADMIN_TOKEN")
  const isAdminTest = !!adminToken && req.headers.get("x-preorder-admin") === adminToken
  if (!live && !isAdminTest) {
    return new Response(
      JSON.stringify({ error: "Preorder has not opened yet.", code: "PREORDERS_NOT_LIVE" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
    )
  }

  // Disclaimer enforcement. The storefront modal gates checkout behind two mandatory
  // checkboxes; a React checkbox is a courtesy, not a control, so the EF is the gate.
  // No preorder session exists without both acceptances.
  const acceptedShipWindow = body.accepted_ship_window === true || body.accepted_ship_window === "true"
  const acceptedFoundingMember = body.accepted_founding_member === true || body.accepted_founding_member === "true"
  if (!acceptedShipWindow || !acceptedFoundingMember) {
    return new Response(
      JSON.stringify({
        error: "Please confirm both preorder acknowledgements before checkout.",
        code: "DISCLAIMER_REQUIRED",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    )
  }

  // Cart normalization: `items` array, or legacy single `preorder_sku` mapped to qty 1.
  const rawItems: unknown[] = Array.isArray(body.items)
    ? body.items
    : [{ sku: body.preorder_sku, qty: 1 }]
  if (rawItems.length === 0 || rawItems.length > PREORDER_PRODUCTS.length) {
    return jsonError("Cart must contain between 1 line and one line per product", 400)
  }

  const seenSkus = new Set<string>()
  const cart: { sku: string; qty: number }[] = []
  for (const raw of rawItems) {
    const sku = typeof (raw as any)?.sku === "string" ? (raw as any).sku : ""
    const qty = (raw as any)?.qty
    const configProduct = preorderProductBySku(sku)
    if (!configProduct) {
      return jsonError(`Unknown preorder sku '${sku}'`, 404)
    }
    if (seenSkus.has(sku)) {
      return jsonError(`Duplicate cart line for '${sku}'; use qty instead`, 400)
    }
    seenSkus.add(sku)
    if (!Number.isInteger(qty) || qty < 1 || qty > configProduct.maxQtyPerOrder) {
      return jsonError(
        `Quantity for '${sku}' must be a whole number between 1 and ${configProduct.maxQtyPerOrder}`,
        400,
      )
    }
    cart.push({ sku, qty })
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const { data: products, error: productError } = await adminClient
    .from("products")
    .select("id, sku, name, active, founding_qty_limit, stripe_founding_price_id, stripe_retail_price_id")
    .in("sku", cart.map((c) => c.sku))
  if (productError) {
    return jsonError(`Product lookup failed: ${productError.message}`, 500)
  }
  const productBySkuMap = new Map<string, any>((products ?? []).map((p: any) => [p.sku, p]))
  for (const line of cart) {
    const product = productBySkuMap.get(line.sku)
    if (!product || !product.active) {
      return jsonError(`'${line.sku}' is not available for preorder right now`, 403)
    }
  }

  // Founding gate: ONE founding-vs-retail decision per session, off the gate SKU's
  // sold allocation (notebooks ride the kit gate; founder rule "notebook retail after
  // 500 kits"). Applied to every line's price selection below. The founding_gate RPC
  // is latch-aware (migration 20260717170000): the first time the cap is reached it
  // stamps products.founding_closed_at, and from then on the window stays closed even
  // if a refund drops the net count back under the cap. One-way latch: the scarcity
  // claim in the launch emails ("$249 is gone for good") is a promise.
  let gateId: string | null = productBySkuMap.get(FOUNDING_GATE_SKU)?.id ?? null
  if (!gateId) {
    const { data: gate, error: gateError } = await adminClient
      .from("products")
      .select("id")
      .eq("sku", FOUNDING_GATE_SKU)
      .maybeSingle()
    if (gateError) {
      // Fail-open like the gate read below (founding price, customer-favorable), but
      // never silently: a persistent failure here would hold founding pricing forever.
      console.error(`founding-gate product lookup failed: ${gateError.message}`)
    }
    if (gate) gateId = gate.id
  }

  let isFounding = true
  if (gateId) {
    try {
      const gate = await getFoundingGate(adminClient, gateId)
      isFounding = !gate.closed
    } catch (e) {
      // Customer-favorable fail-open: if the gate read fails, sell at founding
      // price rather than blocking checkout. Logged so it can't silently persist.
      console.error("founding-gate read failed; defaulting to founding price:", e instanceof Error ? e.message : String(e))
    }
  }

  const lineItems = cart.map((line) => {
    const product = productBySkuMap.get(line.sku)!
    const configProduct = preorderProductBySku(line.sku)!
    const priceId = isFounding
      ? (product.stripe_founding_price_id ?? configProduct.foundingPriceId)
      : (product.stripe_retail_price_id ?? configProduct.retailPriceId)
    return { price: priceId as string, quantity: line.qty }
  })

  // SMS consent comes from an explicit, default-UNCHECKED checkbox on the
  // storefront. Absence of the field means no consent.
  const smsConsent = body.sms_consent === true || body.sms_consent === "true"

  // Which wording the storefront's second checkbox showed: the founding-member line
  // (window open) or the post-sellout supporter line. The acceptance BOOLEAN stays the
  // gate either way; this records the shown variant in session metadata (preserved on
  // the order's raw session JSON) so the acceptance evidence matches the actual copy.
  const memberAckVariant = body.member_ack_variant === "preorder_supporter"
    ? "preorder_supporter"
    : "founding_member"

  // preorder_sku stays the webhook's Branch-0 detection key (kit first if present);
  // preorder_cart is the fallback record if the webhook's line_items expansion fails.
  // Values stay far under Stripe's 500-char metadata cap (max one line per product).
  const primarySku = cart.find((c) => c.sku === FOUNDING_GATE_SKU)?.sku ?? cart[0].sku
  const metadata: Record<string, string> = {
    preorder_sku: primarySku,
    preorder_cart: JSON.stringify(cart.map((c) => ({ sku: c.sku, qty: c.qty }))),
    is_founding: String(isFounding),
    sms_consent: String(smsConsent),
    accepted_ship_window: "true",
    accepted_founding_member: "true",
    member_ack_variant: memberAckVariant,
    accepted_ship_window_text: SHIP_WINDOW,
    disclaimer_accepted_at: new Date().toISOString(),
  }
  if (isAdminTest) metadata.preorder_test = "true"

  // Same origin allowlist as the legacy branch: a checkout session must never
  // redirect the payer to an attacker-supplied host.
  const successUrl = isSafeReturnUrl(body.success_url)
    ? body.success_url
    : "https://edeninstitute.health/preorder?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  const cancelUrl = isSafeReturnUrl(body.cancel_url)
    ? body.cancel_url
    : "https://edeninstitute.health/preorder?checkout=cancelled"

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: true },
    shipping_address_collection: { allowed_countries: ["US"] },
    // Flat shipping per order. tax_behavior exclusive + the shipping tax_code let
    // Stripe Tax tax the shipping charge in states that require it.
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: PREORDER_FLAT_SHIPPING_CENTS, currency: "usd" },
        display_name: "Flat shipping",
        tax_behavior: "exclusive",
        tax_code: "txcd_92010001",
      },
    }],
    // Phone powers the consented preorder SMS. Collected by Stripe so we never
    // hold a number the buyer didn't give at checkout.
    phone_number_collection: { enabled: true },
    customer_creation: "always",
    metadata,
    payment_intent_data: { metadata },
  }
  if (typeof body.email === "string" && body.email) {
    sessionParams.customer_email = body.email
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  console.log(
    `preorder checkout: cart=${cart.map((c) => `${c.sku}x${c.qty}`).join("+")} founding=${isFounding} sms_consent=${smsConsent}` +
      `${isAdminTest ? " [ADMIN TEST]" : ""} session=${session.id}`,
  )

  return new Response(
    JSON.stringify({ url: session.url, session_id: session.id, is_founding: isFounding }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  )
}

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  )
}
