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
//   3. (Retired) One-off PHYSICAL Founders Edition products (sprouts_complete,
//      seedlings_complete, two_band_bundle, nb_addon). Off sale since
//      2026-09-12; still refused via DISABLED_LOOKUP_KEYS. Founders Edition
//      rails removed 2026-09-15 (bundle-restricted gate, physical shipping
//      options, /homeschool/welcome defaults); recoverable from git history.
//   4. FOUNDING PREORDERS (preorder system Phase 1: sprouts_kit,
//      sprouts_notebook) — mode="payment", anonymous, requested via
//      `preorder_sku` (NOT lookup_key, so it can never collide with the
//      legacy dispatch above). Dark-launch gated by PREORDERS_LIVE;
//      Stripe Tax enabled; founding-vs-retail price selected off the
//      500-kit founding gate; flat $12 shipping per order; sms_consent
//      captured from an explicit unchecked checkbox on /preorder and
//      stamped into session metadata.
//   5. PRINT SHOP (Lulu print-on-demand, 2026-09-10) — mode="payment",
//      anonymous, requested with `print_shop: true` + `items`. One sellable
//      product (the three-book set; founder decision: never sold separately),
//      retail price only (no founding gate, no disclaimer modal). Gated by
//      PRINT_SHOP_LIVE and refuses any product whose row is not fully
//      configured (PRINT_SHOP_NOT_CONFIGURED), so a half-set-up product can
//      never take money.
//
// Deploy with verify_jwt=false because the function does its own auth
// dispatch: subscriptions check JWT inside, anonymous one-offs
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
import { getFoundingGate, getStockGate } from "../_shared/order-db.ts"
import { enforceCheckoutRateLimit } from "../_shared/checkout-rate-limit.ts"
import { sendMetaCapiInitiateCheckout } from "../_shared/meta-capi.ts"
import {
  STARTER_BANDS,
  STARTER_LOOKUP_KEY,
  STARTER_LOOKUP_KEYS,
  STARTER_SOURCE_BUCKET,
  StarterBand,
  missingStarterEnv,
  missingStarterMasters,
  starterBandForLookupKey,
  starterPrepaymentProblems,
} from "../_shared/starter-config.ts"
import { curriculumInvoiceCreation } from "../_shared/receipt.ts"
import { evaluateRedemption, findCreditByCode } from "../_shared/starter-credit.ts"
import { LULU_PRODUCTION_DELAY_MINUTES, LULU_PRODUCTS, PRINT_SHOP_URL, luluProductBySku } from "../_shared/lulu-config.ts"
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts"
import { E2E_BUYER_EMAIL, E2E_HEADER, E2E_METADATA_KEY, E2E_MODE, e2eRequestAllowed, stripeSecretKey } from "../_shared/e2e-mode.ts"
// Print bands (Sprouts, Seedlings), 2026-09-23. A separate line from the
// lulu-config import above on purpose, to keep this change's hunks apart.
import { LuluBand, printableProblems } from "../_shared/lulu-config.ts"

/** Hours a buyer has to cancel a print order, for Stripe's checkout copy. */
const PRINT_CANCEL_HOURS = Math.round(LULU_PRODUCTION_DELAY_MINUTES / 60)

// stripeSecretKey() is STRIPE_SECRET_KEY here and the TEST key only inside create-checkout-e2e.
const stripe = new Stripe(stripeSecretKey(), {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": `authorization, x-client-info, apikey, content-type, x-preorder-admin, ${E2E_HEADER}`,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/** Service-role client. The blocks below build their own locals named `adminClient`;
 *  this is the shared constructor for code that just needs one briefly. */
const admin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

/**
 * Which of a band's Starter Unit master PDFs are NOT in the private source bucket.
 * Fails CLOSED: if the listing itself errors, every master is reported missing and
 * the sale is refused, because taking $39 for files that may not exist is the
 * worse outcome. Used for bands other than Sprouts (2026-09-23); the Sprouts
 * masters have been live since August and its path is left exactly as it was.
 */
async function starterMastersMissing(band: StarterBand): Promise<string[]> {
  const all = Object.values(STARTER_BANDS[band].masters)
  try {
    const folders = [...new Set(all.map((p) => p.slice(0, p.lastIndexOf("/"))))]
    const present: string[] = []
    for (const folder of folders) {
      const names = all.filter((p) => p.startsWith(folder + "/")).map((p) => p.slice(folder.length + 1))
      // Longest common prefix of the basenames, to keep the listing small.
      let search = names[0] ?? ""
      for (const n of names) while (search && !n.startsWith(search)) search = search.slice(0, -1)
      const { data, error } = await admin().storage.from(STARTER_SOURCE_BUCKET)
        .list(folder, { limit: 1000, search })
      if (error) throw new Error(error.message)
      for (const o of data ?? []) present.push(`${folder}/${o.name}`)
    }
    return missingStarterMasters(band, present)
  } catch (err) {
    console.error(
      `create-checkout: could not list ${band} starter masters; treating all as missing: ` +
        (err instanceof Error ? err.message : String(err)),
    )
    return all
  }
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

// One-off lookup_keys: mode="payment", auth optional.
const ONE_OFF_LOOKUP_KEYS = new Set([
  "deep_dive_guide",
  // Eden's Table Sprouts Starter Unit ($39 digital, weeks 1-6 of Sprouts).
  // Rides the ordinary one-off dispatch rather than getting its own branch: it is
  // a plain digital product, and the only thing special about it happens AFTER
  // payment (the kit credit), which is stripe-webhook's business, not this file's.
  // 2026-09-23: every band's Starter Unit (sprouts_starter_unit and
  // seedlings_starter_unit), from the registry in starter-config.ts.
  ...STARTER_LOOKUP_KEYS,
])

// Lookup_keys that must NOT show Stripe's "add promotion code" field.
//
// The Starter Unit is a funnel product priced to convert, not to discount, and
// more importantly Stripe refuses to create a session carrying both `discounts`
// and `allow_promotion_codes`. Keeping the field off here means the no-stacking
// guarantee is structural rather than something we have to police. The promo_code
// pre-application block below honours this set too, so a hand-built request cannot
// attach a discount to these keys.
// FOUNDER DECISION 2026-09-23: the Starter now SHOWS Stripe's "Add promotion code" box
// like every other product, so a buyer (and the founder testing) can type a code the
// ordinary way. She was told that any active coupon not restricted to specific products
// then also works on the Starter, and chose this anyway. The set stays so a product can
// be opted back out later without re-plumbing.
const NO_PROMO_LOOKUP_KEYS = new Set<string>([])

// Lookup_keys that need a real Stripe Customer created at checkout.
//
// The Starter Unit credit is a promotion code BOUND TO A CUSTOMER, which is what
// makes it non-transferable (Stripe rejects any other customer with
// promotion_code_customer_mismatch). No Customer at purchase time means no
// binding, so this is load-bearing, not a nicety.
// Sprouts only: the Seedlings Starter Unit carries no credit (founder decision
// 2026-09-23), so it has nothing to bind to a Customer.
const CUSTOMER_REQUIRED_LOOKUP_KEYS = new Set([
  STARTER_LOOKUP_KEY,
])

// Founders Edition rails removed 2026-09-15 (BUNDLE_RESTRICTED_LOOKUP_KEYS,
// PHYSICAL_LOOKUP_KEYS, PAID_SHIPPING_LOOKUP_KEYS, FREE_SHIPPING_LOOKUP_KEYS and
// STANDARD_SHIPPING_CENTS served only sprouts_complete, seedlings_complete,
// two_band_bundle and nb_addon); recoverable from git history.

// Lookup_keys explicitly blocked from purchase right now (Practitioner
// ships Phase 3, end 2027 per Locked Decision §0.8 #3).
const DISABLED_LOOKUP_KEYS = new Set([
  "practitioner_monthly",
  "practitioner_yearly",
  // Founders Edition products, retired 2026-09-12 (kit off sale, no date).
  // Kept here so they keep getting the 'not available' reply; their checkout
  // branches were removed 2026-09-15.
  "sprouts_complete",
  "seedlings_complete",
  "two_band_bundle",
  "nb_addon",
])

// Explicit Stripe price-ID overrides by lookup_key. When set, this exact
// price is billed instead of resolving by Stripe lookup_key — so the
// Deep-Dive Guide always charges the intended $4.99 price regardless of which
// price currently carries the 'deep_dive_guide' lookup key.
const PRICE_ID_OVERRIDES: Record<string, string> = {
  deep_dive_guide: "price_1TiHqt2NWfYbCZT8ghDRlWiO",
}

/** Stripe caps a metadata value at 500 chars; body-supplied values are attacker-influenced. */
function clampMeta(v: unknown, max = 255): string | null {
  return typeof v === "string" && v ? v.slice(0, max) : null
}

/** Dark-test bypass for the preorder and print-shop gates. */
function isPreorderAdminRequest(req: Request): boolean {
  const token = Deno.env.get("PREORDER_ADMIN_TOKEN")
  const given = req.headers.get("x-preorder-admin")
  return !!token && !!given && timingSafeEqual(given, token)
}

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

  // E2E twin (create-checkout-e2e): nothing without the token. See _shared/e2e-mode.ts.
  if (E2E_MODE && !e2eRequestAllowed(req)) {
    return jsonError("Not found", 404)
  }

  try {
    // 0. Rate limit before anything else. Every path below mints a real Stripe
    //    Checkout Session, so this is the card-testing guard. Fails open: see
    //    _shared/checkout-rate-limit.ts for why that trade is the right one here.
    const rl = await enforceCheckoutRateLimit(admin(), req)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many checkout attempts. Please wait a few minutes and try again.",
          code: "RATE_LIMITED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 },
      )
    }

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

    // 1a. Print shop (Lulu print-on-demand books). An EXPLICIT flag, checked
    //     BEFORE the preorder cart branch, which also keys on `items`.
    if (body.print_shop === true || body.print_shop === "true") {
      return await handlePrintCheckout(req, body)
    }
    if (E2E_MODE) {
      return jsonError("The E2E checkout serves the print shop only", 400)
    }

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

    if (!isSubscription && !isOneOff) {
      return jsonError(`Unknown lookup_key '${lookup_key}'`, 404)
    }

    // 2. Auth dispatch
    //    - Subscriptions: JWT required
    //    - One-offs: JWT optional (best-effort identity capture)
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
      // Optional best-effort identity capture for one-offs.
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
        console.error(`create-checkout: no active Stripe price for lookup_key '${lookup_key}'`)
        return jsonError(GENERIC_CHECKOUT_ERROR, 500)
      }
      price = prices.data[0]
    }
    const mode = isSubscription ? "subscription" : "payment"

    // 5. For subscriptions: get-or-create the Stripe Customer for this user.
    //    For one-offs: skip Customer creation unless we have a Supabase user
    //    (best-effort linking). One-offs can be anonymous.
    let stripeCustomerId: string | null = null
    let customerJustCreated = false
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
        console.error("create-checkout: profile lookup failed:", profileError.message)
        return jsonError(GENERIC_CHECKOUT_ERROR, 500)
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
        customerJustCreated = true

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

    // 5a. One live subscription per Customer. stripe-webhook records only the newest
    //     subscription id, so a second checkout would bill in parallel. A brand-new
    //     Customer cannot have one. incomplete / canceled / incomplete_expired do not
    //     block, so a failed SCA attempt never locks the buyer out.
    if (isSubscription && stripeCustomerId && !customerJustCreated) {
      const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "paused"])
      const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 20 })
      const existing = subs.data.find((s: Stripe.Subscription) => LIVE.has(s.status))
      if (existing) {
        console.log(`create-checkout: refusing a second subscription for ${stripeCustomerId}; ${existing.id} is ${existing.status}`)
        return new Response(
          JSON.stringify({
            // Wording approved by the founder 2026-09-15. Plan switching is on in the
            // Stripe customer portal, which Manage subscription opens.
            error: "You already have an Apothecary plan. To switch plans, go to your Account page and tap Manage subscription.",
            code: "SUBSCRIPTION_EXISTS",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        )
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
    const fbp = clampMeta(bodyFbp); if (fbp) metadata.fbp = fbp
    const fbc = clampMeta(bodyFbc); if (fbc) metadata.fbc = fbc

    // 7. Construct the Checkout Session.
    //    Defaults for success/cancel URLs depend on product class:
    //    - Subscriptions → /apothecary/welcome
    //    - Deep-Dive Guide one-off → /assessment (caller usually overrides
    //      with /guide/[slug])
    //    - Starter Unit → /starter/thank-you

    // Which band's Starter Unit, or null. Sprouts takes exactly the path it
    // always took; STARTER_LOOKUP_KEY in starter-config.ts is still the Sprouts key.
    const starterBand = starterBandForLookupKey(lookup_key)
    const isStarter = starterBand !== null

    // REFUSE TO SELL THE STARTER UNIT IF THE CREDIT CANNOT BE ISSUED.
    //
    // The $39 credit toward the kit is not a bonus, it is the product's entire
    // proposition and it is promised in the hero, the FAQ, the confirmation page
    // and the refund policy. Minting the code needs
    // STRIPE_STARTER_CREDIT_COUPON_ID, and that only gets consulted AFTER payment,
    // in the webhook. So without this guard a misconfigured deploy takes $39 and
    // then discovers it cannot deliver the thing it just sold, one buyer at a
    // time, with nothing visible on the storefront.
    //
    // Failing closed here costs a sale we could not honour anyway. It also makes
    // the misconfiguration obvious the moment anyone presses the button, instead
    // of at the first refund request.
    //
    // Per band since 2026-09-23. Sprouts checks only STRIPE_STARTER_CREDIT_COUPON_ID,
    // as before. Seedlings has no credit (founder decision 2026-09-23), so it needs
    // no coupon; it needs the band migration applied and all three master PDFs in
    // the bucket, or the buyer would pay and then receive a failed delivery.
    const starterNotConfigured = () => new Response(
      JSON.stringify({
        error: "The Starter Unit is not available right now. Please try again shortly, or email hello@edeninstitute.health.",
        code: "STARTER_NOT_CONFIGURED",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 },
    )
    if (starterBand) {
      const missingEnv = missingStarterEnv(starterBand)
      if (missingEnv.length) {
        console.error(
          `create-checkout: ${missingEnv.join(", ")} not set; refusing to sell the ` +
            `${starterBand} Starter Unit rather than take money for a credit we cannot issue`,
        )
        return starterNotConfigured()
      }
      if (starterBand !== "sprouts") {
        // Band migration applied. Checked HERE, before any Stripe session exists,
        // so a missing migration refuses the sale instead of failing after payment.
        const problems = await starterPrepaymentProblems(admin(), starterBand)
        if (problems.length) {
          console.error(
            `create-checkout: refusing to sell the ${starterBand} Starter Unit: ${problems.join("; ")}`,
          )
          return starterNotConfigured()
        }
        const missingMasters = await starterMastersMissing(starterBand)
        if (missingMasters.length) {
          console.error(
            `create-checkout: ${starterBand} Starter Unit master(s) not in ${STARTER_SOURCE_BUCKET}: ` +
              `${missingMasters.join(", ")}; refusing to sell files we cannot deliver`,
          )
          return starterNotConfigured()
        }
      }
    }

    const starterDefaultSuccess = starterBand
      ? STARTER_BANDS[starterBand].successUrl
      : "https://edeninstitute.health/starter/thank-you?session_id={CHECKOUT_SESSION_ID}"

    const defaultSuccessUrl = isSubscription
      ? "https://edeninstitute.health/apothecary/welcome?session_id={CHECKOUT_SESSION_ID}"
      : isStarter
        ? starterDefaultSuccess
        : "https://edeninstitute.health/assessment"
    const defaultCancelUrl = isSubscription
      ? "https://edeninstitute.health/apothecary/pricing"
      : starterBand
        ? STARTER_BANDS[starterBand].pageUrl
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
      allow_promotion_codes: !NO_PROMO_LOOKUP_KEYS.has(lookup_key),
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
    if (NO_PROMO_LOOKUP_KEYS.has(lookup_key)) {
      // FOUNDER TEST CODES (2026-09-23, founder request): the Starter still never shows
      // Stripe's promo field and never takes a public code, but a code named in the
      // STARTER_TEST_PROMO_CODES secret (comma separated, case-insensitive) may be
      // pre-applied through promo_code, so the founder can buy a real Starter for $1
      // and watch the whole stamp-and-deliver run. The allowlist lives in a secret,
      // not in this file, so nobody can find a working code by reading the repo.
      const testCodes = (Deno.env.get("STARTER_TEST_PROMO_CODES") ?? "")
        .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
      const wanted = typeof bodyPromoCode === "string" ? bodyPromoCode.trim().toUpperCase() : ""
      if (wanted && testCodes.includes(wanted)) {
        const promoList = await stripe.promotionCodes.list({ code: wanted, active: true, limit: 1 })
        const promo = promoList.data[0]
        if (!promo) {
          return new Response(JSON.stringify({ error: "That test code is not active.", code: "PROMO_NOT_ACTIVE" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        sessionParams.discounts = [{ promotion_code: promo.id }]
        delete sessionParams.allow_promotion_codes
      } else if (wanted) {
        console.warn(`promo_code ignored: '${lookup_key}' does not accept promotion codes`)
      }
    } else if (typeof bodyPromoCode === "string" && bodyPromoCode.trim()) {
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

    // For lookup_keys that need a Stripe Customer (the Starter Unit credit is
    // bound to one), ask Stripe to create one from the buyer's email.
    if (
      mode === "payment" && !stripeCustomerId &&
      CUSTOMER_REQUIRED_LOOKUP_KEYS.has(lookup_key)
    ) {
      sessionParams.customer_creation = "always"
    }

    if (mode === "subscription") {
      sessionParams.subscription_data = { metadata }
    } else {
      sessionParams.payment_intent_data = { metadata }
      // Also set on the session object so verify-session + stripe-webhook
      // can read session.metadata directly without expanding line_items.
      sessionParams.metadata = metadata
    }

    // Stripe invoicing for the Starter Unit (founder decision 2026-09-12,
    // scholarship states): a numbered, itemized invoice with "Homeschool
    // curriculum" on it, emailed by Stripe and downloadable as a PDF. Payment
    // mode only; Stripe refuses invoice_creation on a subscription session.
    // Validated in TEST mode against this exact session shape.
    if (starterBand && mode === "payment") {
      sessionParams.invoice_creation = curriculumInvoiceCreation("starter", starterBand)
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
    return jsonError(GENERIC_CHECKOUT_ERROR, 500)
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
  const isAdminTest = isPreorderAdminRequest(req)
  if (!live && !isAdminTest) {
    return new Response(
      JSON.stringify({ error: "Preorders are closed for now.", code: "PREORDERS_NOT_LIVE" }),
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
    console.error("create-checkout: preorder product lookup failed:", productError.message)
    return jsonError(GENERIC_CHECKOUT_ERROR, 500)
  }
  const productBySkuMap = new Map<string, any>((products ?? []).map((p: any) => [p.sku, p]))
  for (const line of cart) {
    const product = productBySkuMap.get(line.sku)
    if (!product || !product.active) {
      return jsonError(`'${line.sku}' is not available for preorder right now`, 403)
    }
  }

  // Stock ceiling. Until this existed, products.founding_qty_limit (500) was only a
  // PRICE switch: the 501st order succeeded at retail and so would the 5,000th, and the
  // only stop button was hand-editing products.active. Checked BEFORE session creation
  // so we never take money for a unit we cannot ship.
  //
  // Like the founding gate, this reads a committed count, so simultaneous sessions in
  // flight can still overshoot slightly under a launch spike. That is bounded and
  // acceptable for a print run with spare units; it would not be for a hard allocation.
  // A refund frees its unit again, deliberately (stock is reversible; the founding PRICE
  // window is not, and latches separately).
  for (const line of cart) {
    const product = productBySkuMap.get(line.sku)!
    try {
      const stock = await getStockGate(adminClient, product.id)
      if (stock.cap === null) continue           // uncapped product
      if (stock.remaining !== null && line.qty > stock.remaining) {
        return new Response(
          JSON.stringify({
            error: stock.remaining === 0
              ? `'${product.name ?? line.sku}' is sold out.`
              : `Only ${stock.remaining} left of '${product.name ?? line.sku}'.`,
            code: "OUT_OF_STOCK",
            sku: line.sku,
            remaining: stock.remaining,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        )
      }
    } catch (e) {
      // Fail CLOSED. Unlike the rate limiter and the founding-price gate, an unreadable
      // stock count must not sell an unknown quantity: overselling a physical print run
      // means refunding real customers, which is worse than a brief outage.
      console.error(`stock_gate read failed for ${line.sku}:`, e instanceof Error ? e.message : String(e))
      return jsonError("Could not confirm availability right now. Please try again in a moment.", 503)
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

  // ---- Starter Unit credit redemption -------------------------------------
  //
  // Optional `credit_code` on the request. Three things have to be true before a
  // discount is attached, and all three are checked HERE so the buyer gets a
  // sentence they can act on rather than a raw Stripe error:
  //
  //   1. The code exists, is unspent, is active, and belongs to this email.
  //      (evaluateRedemption, which is pure and unit-tested.)
  //   2. The cart actually contains the kit. Stripe would reject a coupon that
  //      matches nothing in the order, but its wording ("does not apply to
  //      anything in this order") reads like a broken code rather than a missing
  //      kit, and this is the single most likely honest mistake a buyer makes.
  //   3. We know who they are, because the promotion code is bound to a Stripe
  //      Customer and only that Customer may redeem it.
  //
  // Point 3 is why the session below switches from `customer_creation: "always"`
  // to an explicit `customer`. Creating a FRESH Customer here, which is what the
  // preorder path does by default, would hand Stripe a customer that is not the
  // one the code is bound to, and Stripe would refuse the buyer's own valid
  // credit with promotion_code_customer_mismatch. That failure would look exactly
  // like a bug in the credit rather than in the session setup.
  const rawCreditCode = typeof body.credit_code === "string" ? body.credit_code.trim() : ""
  let appliedCredit: { promotionCodeId: string; code: string; customerId: string } | null = null

  if (rawCreditCode) {
    const buyerEmail = typeof body.email === "string" ? body.email : ""
    if (!buyerEmail) {
      return new Response(
        JSON.stringify({
          error: "Please enter the email address you used for your Starter Unit so we can check your credit.",
          code: "CREDIT_EMAIL_REQUIRED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }

    if (!cart.some((c) => c.sku === FOUNDING_GATE_SKU)) {
      return new Response(
        JSON.stringify({
          error: "Your Starter Unit credit applies to the Sprouts Complete Kit. Add the kit to use it.",
          code: "CREDIT_KIT_REQUIRED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }

    const credit = await findCreditByCode(adminClient, rawCreditCode)
    const verdict = evaluateRedemption(credit, buyerEmail)
    if (!verdict.ok) {
      console.warn(
        `starter credit refused: reason=${verdict.code} credit_id=${credit?.id ?? "none"}`,
      )
      return new Response(
        JSON.stringify({ error: verdict.message, code: verdict.code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }
    appliedCredit = {
      promotionCodeId: verdict.credit.stripe_promotion_code_id,
      code: verdict.credit.code,
      customerId: verdict.credit.stripe_customer_id,
    }
  }

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
    metadata,
    payment_intent_data: { metadata },
  }
  // Afterpay's and Affirm's terms both PROHIBIT pre-orders (Stripe docs, checked
  // 2026-09-17), and both are enabled on the account's Default payment method
  // configuration for the print shop. A kit pre-order ships months out, so keep
  // them off this session only. Klarna does not list pre-orders as prohibited.
  // Not in the stripe@14.21 types; accepted by the API on 2024-12-18.acacia
  // (verified in test mode 2026-09-17).
  ;(sessionParams as Record<string, unknown>).excluded_payment_method_types = ["affirm", "afterpay_clearpay"]

  if (appliedCredit) {
    // Bind the session to the Customer the credit belongs to. This is both the
    // only way the discount can apply AND a second, Stripe-side enforcement of
    // the email lock: any other Customer is refused outright.
    sessionParams.customer = appliedCredit.customerId
    // Stripe Tax refuses a session with a pre-existing Customer unless it is told
    // it may save what the payer enters back onto that Customer.
    //
    // `shipping: "auto"` is NOT optional here and its absence is not a warning:
    // this branch is the only one that combines a pre-existing `customer` with
    // shipping_address_collection AND automatic_tax, and Stripe hard-refuses that
    // combination with
    //   "Automatic tax calculation uses fields saved on the Customer. To collect
    //    a shipping address with `automatic_tax` enabled, set
    //    customer_update[shipping] to 'auto'"
    // The first version set only address and name, which meant every attempt to
    // REDEEM a credit 500'd. Nothing else in the feature would have shown it:
    // issuing worked, the email worked, both refusal guards worked, and the one
    // path that was broken was the one the whole product exists for. Caught on a
    // real code before a customer reached it (2026-08-26).
    //
    // The subscription branch above sets only address because it collects no
    // shipping address at all.
    sessionParams.customer_update = { address: "auto", name: "auto", shipping: "auto" }
    sessionParams.discounts = [{ promotion_code: appliedCredit.promotionCodeId }]
    // NOT setting allow_promotion_codes is what makes the credit non-stackable:
    // Stripe rejects a session carrying both, and Checkout takes at most one
    // discount, so there is no second slot to stack into.
    // `metadata` is the same object sessionParams.metadata and
    // payment_intent_data.metadata both reference, so writing to it here lands on
    // both, and the webhook can attribute the redemption from either one.
    metadata.starter_credit_code = appliedCredit.code
    metadata.starter_credit_promo_id = appliedCredit.promotionCodeId
  } else {
    sessionParams.customer_creation = "always"

    // AFFILIATE PROMOTION CODES ON THE KIT.
    //
    // Until 2026-09-06 this branch set neither `allow_promotion_codes` nor any
    // `discounts`, and Stripe defaults the former to false. So the kit checkout
    // had NO promotion-code field at all, and this branch ignored a `promo_code`
    // in the body. Verified on a real live session that day: the page rendered
    // the kit at $249 plus $12 shipping with nowhere to enter a code.
    //
    // That made the affiliate programme unusable on the only product it pays
    // commission for. KAMI10 and RAISINGARROWS10 had been live since 2026-08-31
    // against a checkout that could not accept them.
    //
    // Two ways in now, mirroring the lookup_key branch above:
    //   ?promo=CODE on /preorder  -> pre-applied, no hunting for the field
    //   no promo in the URL       -> Stripe's own "Add promotion code" field
    //
    // Stripe refuses a session carrying both `discounts` and
    // `allow_promotion_codes`, and Checkout takes at most one discount, so these
    // are deliberately exclusive. The credit branch above is untouched: a Starter
    // credit still means no promo field, which is what keeps it non-stackable.
    const bodyPromoCode = typeof body.promo_code === "string" ? body.promo_code.trim() : ""
    let promoApplied = false
    if (bodyPromoCode) {
      try {
        const promoList = await stripe.promotionCodes.list({
          code: bodyPromoCode,
          active: true,
          limit: 1,
        })
        const promo = promoList.data[0]
        if (promo) {
          sessionParams.discounts = [{ promotion_code: promo.id }]
          promoApplied = true
          // Stripe stores only the promotion code ID on the order, so the human
          // string is recorded here too. Without it, attributing a referral means
          // resolving an opaque id against the Affiliates tab by hand.
          metadata.affiliate_promo_code = promo.code
          metadata.affiliate_promo_id = promo.id
        } else {
          console.warn(`promo_code '${bodyPromoCode}' not found/active; leaving the manual field enabled`)
        }
      } catch (err) {
        console.warn(
          "promo_code lookup failed; leaving the manual field enabled: " +
            (err instanceof Error ? err.message : String(err)),
        )
      }
    }
    // Fails OPEN to the manual field: a bad or expired affiliate code must never
    // leave a buyer unable to enter a good one.
    if (!promoApplied) sessionParams.allow_promotion_codes = true
  }

  if (typeof body.email === "string" && body.email) {
    // customer_email and customer are mutually exclusive in Stripe. When a credit
    // is applied the Customer already carries the email, so setting both would
    // 400 the whole checkout.
    if (!appliedCredit) sessionParams.customer_email = body.email
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  console.log(
    `preorder checkout: cart=${cart.map((c) => `${c.sku}x${c.qty}`).join("+")} founding=${isFounding} sms_consent=${smsConsent}` +
      `${isAdminTest ? " [ADMIN TEST]" : ""} session=${session.id}`,
  )

  // Tell Meta a checkout started. This is the signal a purchase-focused campaign
  // is actually trainable on: at $249 a campaign produces a handful of purchases
  // a week, far under the ~50 conversions per ad set per week Meta needs to learn,
  // whereas everyone who reaches Stripe fires this.
  //
  // Deliberately NOT awaited into the response path beyond its own 2.5s timeout,
  // and the sender never throws: a buyer must never fail to reach Stripe because
  // Meta is slow. Admin test sessions are excluded so internal checks cannot
  // pollute the optimization signal.
  //
  // event_id is the Stripe session id, the same id the later Purchase carries.
  // Meta dedupes on (event_name, event_id) and the names differ, so they do not
  // collide, but the pair stays joinable in reporting.
  if (!isAdminTest) {
    await sendMetaCapiInitiateCheckout({
      eventId: session.id,
      fbp: clampMeta(body.fbp),
      fbc: clampMeta(body.fbc),
      email: typeof body.email === "string" ? body.email : null,
      contentName: primarySku,
      numItems: cart.reduce((n, c) => n + c.qty, 0),
    })
  }

  return new Response(
    JSON.stringify({ url: session.url, session_id: session.id, is_founding: isFounding }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  )
}

// ---------- Print shop (Lulu print-on-demand) ----------
//
// Request: { print_shop: true, items: [{sku, qty}], sms_consent?, email?,
//            promo_code?, success_url?, cancel_url?, fbp?, fbc? }
//
// The printed Sprouts set (Teacher's Guide + Student Notebook + Read-Aloud, sold
// together only), and since 2026-09-23 the printed Seedlings set on the same
// rail, one band per order. Everything that decides money comes from the products table
// (Stripe Price id, shipping tier) and this branch REFUSES with
// PRINT_SHOP_NOT_CONFIGURED when any of it is missing, naming the SKU. That is
// deliberate: a guessed default here would be a real charge to a real card.
//
// Shipping: one parcel, one charge, the highest shipping_tier_cents in the cart
// (the blended formula approved for the July fulfilment design). Tax: automatic.
// deno-lint-ignore no-explicit-any
async function handlePrintCheckout(req: Request, body: Record<string, any>): Promise<Response> {
  const live = Deno.env.get("PRINT_SHOP_LIVE") === "true"
  // In E2E mode the token was already checked at the top of the handler.
  const isAdminTest = isPreorderAdminRequest(req) || E2E_MODE
  if (!live && !isAdminTest) {
    return new Response(
      JSON.stringify({ error: "The printed books are not on sale yet.", code: "PRINT_SHOP_NOT_LIVE" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
    )
  }

  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0 || rawItems.length > LULU_PRODUCTS.length) {
    return jsonError("Cart must contain between 1 line and one line per product", 400)
  }
  const seen = new Set<string>()
  const cart: { sku: string; qty: number }[] = []
  for (const raw of rawItems) {
    const sku = typeof (raw as any)?.sku === "string" ? (raw as any).sku : ""
    const qty = (raw as any)?.qty
    const product = luluProductBySku(sku)
    if (!product) return jsonError(`Unknown product '${sku}'`, 404)
    if (seen.has(sku)) return jsonError(`Duplicate cart line for '${sku}'; use qty instead`, 400)
    seen.add(sku)
    if (!Number.isInteger(qty) || qty < 1 || qty > product.maxQtyPerOrder) {
      return jsonError(`Quantity for '${sku}' must be a whole number between 1 and ${product.maxQtyPerOrder}`, 400)
    }
    cart.push({ sku, qty })
  }

  // ONE BAND PER ORDER (2026-09-23). The confirmation, shipped and delivered
  // messages name the band, and one Lulu job prints one band's files. A family
  // buying both years places two orders.
  const bands = new Set<LuluBand>(cart.map((c) => luluProductBySku(c.sku)!.band))
  if (bands.size > 1) {
    return new Response(
      JSON.stringify({ error: "The Sprouts and Seedlings sets check out separately. Please order one set, then the other.", code: "PRINT_MIXED_BANDS" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    )
  }
  const band: LuluBand = [...bands][0]

  const adminClient = admin()
  const { data: products, error: productError } = await adminClient
    .from("products")
    .select("id, sku, name, active, fulfillment, stripe_retail_price_id, shipping_tier_cents, retail_price_cents")
    .in("sku", cart.map((c) => c.sku))
  if (productError) {
    console.error("create-checkout: print shop product lookup failed:", productError.message)
    return jsonError(GENERIC_CHECKOUT_ERROR, 500)
  }
  const bySku = new Map<string, any>((products ?? []).map((p: any) => [p.sku, p]))

  for (const line of cart) {
    const p = bySku.get(line.sku)
    if (!p || !p.active) {
      return jsonError(`'${line.sku}' is not available right now`, 403)
    }
    const missing: string[] = []
    if (p.fulfillment !== "lulu") missing.push("fulfillment='lulu'")
    if (!p.stripe_retail_price_id) missing.push("stripe_retail_price_id")
    if (p.shipping_tier_cents == null) missing.push("shipping_tier_cents")
    if (missing.length) {
      // Loud on our side, gentle on the buyer's. A product row that is not finished
      // is an operations problem, never a customer-facing price.
      console.error(`print shop: '${line.sku}' is not configured (missing ${missing.join(", ")}); refusing checkout`)
      return new Response(
        JSON.stringify({ error: "The printed set is not quite ready to order. Please check back soon.", code: "PRINT_SHOP_NOT_CONFIGURED", sku: line.sku }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 },
      )
    }
  }

  // A band other than Sprouts must have every book it prints ready at Lulu (files
  // and page counts in lulu_printables) BEFORE the buyer is charged. Without this
  // the sale would go through and the print job would fail afterwards, or worse.
  // Fails closed: a lookup error refuses the sale too. Sprouts skips it on
  // purpose: its rows have been live since 2026-09-11 and its checkout path stays
  // exactly as it was.
  if (band !== "sprouts") {
    let problems: string[]
    try {
      const { data: rows, error } = await adminClient.from("lulu_printables").select("*").eq("band", band)
      if (error) throw new Error(error.message)
      problems = printableProblems(band, rows ?? [])
    } catch (err) {
      problems = [`lulu_printables lookup failed: ${err instanceof Error ? err.message : String(err)}`]
    }
    if (problems.length) {
      console.error(`print shop: ${band} printables not ready (${problems.join("; ")}); refusing checkout`)
      return new Response(
        JSON.stringify({ error: "The printed set is not quite ready to order. Please check back soon.", code: "PRINT_SHOP_NOT_CONFIGURED", sku: cart[0].sku }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 },
      )
    }
  }

  // The stored Price ids are LIVE-mode objects, which the E2E test key cannot use, so
  // the E2E twin charges the same amount as an inline test price. The webhook then
  // resolves the SKUs from print_cart metadata (its documented fallback).
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = E2E_MODE
    ? cart.map((line) => ({
      price_data: {
        currency: "usd",
        unit_amount: bySku.get(line.sku).retail_price_cents as number,
        tax_behavior: "exclusive" as const,
        product_data: { name: `E2E TEST: ${bySku.get(line.sku).name as string}` },
      },
      quantity: line.qty,
    }))
    : cart.map((line) => ({ price: bySku.get(line.sku).stripe_retail_price_id as string, quantity: line.qty }))
  const shippingCents = cart.reduce((n, line) => Math.max(n, bySku.get(line.sku).shipping_tier_cents as number), 0)
  const smsConsent = body.sms_consent === true || body.sms_consent === "true"

  // print_sku is the webhook's detection key; print_cart is the fallback record if
  // the webhook's line_items expansion fails. Far under Stripe's 500-char cap.
  const metadata: Record<string, string> = {
    print_sku: cart[0].sku,
    print_cart: JSON.stringify(cart),
    fulfillment: "lulu",
    sms_consent: String(smsConsent),
  }
  const fbp = clampMeta(body.fbp); if (fbp) metadata.fbp = fbp
  const fbc = clampMeta(body.fbc); if (fbc) metadata.fbc = fbc
  if (isAdminTest) metadata.print_test = "true"
  if (E2E_MODE) metadata[E2E_METADATA_KEY] = "true"
  // Sprouts metadata stays exactly as it was; other bands are stamped for the record.
  if (band !== "sprouts") metadata.print_band = band

  // Success lands on a real confirmation page, never back on the shop page: the
  // first live order (2026-09-11) returned to /books with a small notice inside
  // the buy box and the buyer could not tell whether it had worked.
  const successUrl = isSafeReturnUrl(body.success_url)
    ? body.success_url
    : band === "sprouts"
      ? `${PRINT_SHOP_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`
      : `${PRINT_SHOP_URL}/thank-you?band=${band}&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = isSafeReturnUrl(body.cancel_url)
    ? body.cancel_url
    : `${PRINT_SHOP_URL}?checkout=cancelled`

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: true },
    // US-only for now, the same as the kit preorder.
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: shippingCents, currency: "usd" },
        display_name: "Shipping",
        tax_behavior: "exclusive",
        tax_code: "txcd_92010001",
      },
    }],
    // Lulu's carriers REQUIRE a phone number on every shipment, so this is not
    // optional here the way it is a nicety elsewhere. It also powers the consented
    // shipped/delivered texts.
    phone_number_collection: { enabled: true },
    customer_creation: "always",
    // The words on Stripe's own screen. A buyer reads these next to the Pay
    // button and next to the address form, which is where the two facts that
    // matter most (printed to order, 48-hour change window) belong.
    custom_text: {
      submit: {
        message:
          `Printed to order for you and shipped within the United States, tracked. ` +
          `Printing begins ${PRINT_CANCEL_HOURS} hours after your order; until then you can cancel or correct your address for a full refund.`,
      },
      shipping_address: {
        message: "Your books ship from our print partner to this address. Please check the apartment or unit number.",
      },
    },
    metadata,
    payment_intent_data: { metadata },
    // Stripe invoicing (founder decision 2026-09-12, scholarship states): a
    // numbered, itemized invoice with "Homeschool curriculum" on it. Validated in
    // TEST mode with shipping, automatic tax, phone collection, customer creation,
    // custom text and promotion codes all present. See _shared/receipt.ts.
    invoice_creation: curriculumInvoiceCreation("print", band),
  }

  // Affiliate codes, same two ways in as the kit: ?promo=CODE pre-applied, else
  // Stripe's own field. Stripe refuses a session carrying both, so exclusive.
  const bodyPromoCode = typeof body.promo_code === "string" ? body.promo_code.trim() : ""
  let promoApplied = false
  if (bodyPromoCode) {
    try {
      const promoList = await stripe.promotionCodes.list({ code: bodyPromoCode, active: true, limit: 1 })
      const promo = promoList.data[0]
      if (promo) {
        sessionParams.discounts = [{ promotion_code: promo.id }]
        promoApplied = true
        metadata.affiliate_promo_code = promo.code
        metadata.affiliate_promo_id = promo.id
      }
    } catch (err) {
      console.warn("print shop promo_code lookup failed; leaving the manual field enabled: " + (err instanceof Error ? err.message : String(err)))
    }
  }
  if (!promoApplied) sessionParams.allow_promotion_codes = true

  if (typeof body.email === "string" && body.email) sessionParams.customer_email = body.email
  // E2E orders are always bought as hello@, which the dashboards file as internal.
  if (E2E_MODE) sessionParams.customer_email = E2E_BUYER_EMAIL

  const session = await stripe.checkout.sessions.create(sessionParams)
  console.log(
    `print shop checkout: cart=${cart.map((c) => `${c.sku}x${c.qty}`).join("+")} shipping=${shippingCents} sms_consent=${smsConsent}` +
      `${isAdminTest ? " [ADMIN TEST]" : ""} session=${session.id}`,
  )

  if (!isAdminTest) {
    await sendMetaCapiInitiateCheckout({
      eventId: session.id,
      fbp: fbp,
      fbc: fbc,
      email: typeof body.email === "string" ? body.email : null,
      contentName: cart[0].sku,
      numItems: cart.reduce((n, c) => n + c.qty, 0),
    })
  }

  return new Response(
    JSON.stringify({ url: session.url, session_id: session.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  )
}

// Internal failures (Stripe, PostgREST, missing prices) never echo their raw text to
// anonymous callers; the detail goes to the function log instead. This is the same
// line the Apothecary checkout buttons already show (friendlyEfError.ts).
const GENERIC_CHECKOUT_ERROR = "Could not start checkout. Please try again or contact hello@edeninstitute.health."

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  )
}
