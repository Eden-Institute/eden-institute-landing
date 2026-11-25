// supabase/functions/create-checkout/online-year-checkout.ts
//
// Eden's Table Online Year, OY2 (punch #472): the Online Year cart branch of create-checkout.
// Request (from /online-year/checkout, our page, BEFORE Stripe):
//   { lookup_key: "online_year_cart", band, email, country, child_names: [...], agree: true,
//     promo_code?, attribution... }
//
// Everything is checked before a Stripe session exists:
//   - the Online Year is on sale (ONLINE_YEAR_ENABLED, or the preview header while dark),
//   - the agreement box was ticked (Approved copy > Checkout fields: "Required box"),
//   - she lives in the U.S., Canada or Australia (her tap 2026-11-25: our page asks; Stripe
//     cannot restrict billing countries; OY3 flags a card from anywhere else for her),
//   - the child names are first names or nicknames, at most 10, no repeats,
//   - first child or sibling, from the family's live first-child license in that band
//     (planOnlineYearCart): a sibling year is never sold without a live $149 year,
//   - a Starter credit (promo_code) is real, unspent, hers, and its coupon covers the
//     Online Year (decidePrintPromoCredit; until the Online Year coupons exist it refuses
//     with the existing printed-set sentence). Any other code is not applied: no promo
//     field on this checkout.
// Stripe's email is locked to the one she typed (customer_email), because the licenses
// (OY3) and the sibling check above both key on it. Only first names ride in metadata.

import type Stripe from "https://esm.sh/stripe@14?target=denonext"
import { onlineYearOpen } from "../_shared/online-year-gate.ts"
import { isStripeSafeEmail } from "../_shared/contact-email.ts"
import { heardAboutStripeField } from "../_shared/heard-about.ts"
import { decidePrintPromoCredit } from "../_shared/starter-credit.ts"
import { escapeLikePattern } from "../_shared/like-escape.ts"
import {
  buildOnlineYearMetadata,
  isOnlineYearBand,
  ONLINE_YEAR_COUNTRIES,
  ONLINE_YEAR_PRICE_CENTS,
  ONLINE_YEAR_SUCCESS_URL,
  ONLINE_YEAR_UNDER_BUTTON,
  onlineYearCancelUrl,
  onlineYearProductDescription,
  onlineYearProductName,
  planOnlineYearCart,
  type OnlineYearBand,
  type OnlineYearKind,
} from "../_shared/online-year-checkout.ts"

// deno-lint-ignore no-explicit-any
type Db = any
// deno-lint-ignore no-explicit-any
type StripeLike = any

export interface OnlineYearCheckoutDeps {
  stripe: StripeLike
  db: Db
  cors: Record<string, string>
  createSession: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ id: string; url: string | null }>
  extraMetadata?: (body: Record<string, unknown>) => Record<string, string>
  env?: (k: string) => string | undefined
  now?: () => Date
  /** The create-checkout-e2e twin: test-mode prices built inline, the buyer forced to hello@. */
  e2e?: { buyerEmail: string; metadataKey: string }
}

/** The sku a Starter credit's coupon must cover for this band's first-child year (starter-config appliesToSkus). */
export function onlineYearCreditSku(band: OnlineYearBand): string {
  return `${band}_online_year`
}

const SOMETHING_WRONG = "Something went wrong. Please refresh the page and try again."

/** The family's live first-child license in this band: its child's name, or null. Throws on a read error (fail closed). */
export async function liveFirstChildName(db: Db, email: string, band: OnlineYearBand, now: Date): Promise<string | null> {
  const { data: parent, error: pErr } = await db
    .from("online_year_parents").select("id").ilike("email", escapeLikePattern(email)).maybeSingle()
  if (pErr) throw new Error(`online year checkout: parent read failed: ${pErr.message}`)
  if (!parent) return null
  const { data: lic, error: lErr } = await db
    .from("online_year_licenses").select("child_name, ends_at")
    .eq("parent_id", parent.id).eq("band", band).eq("kind", "first_child").eq("status", "active")
    .gt("ends_at", now.toISOString()).order("ends_at", { ascending: false }).limit(1)
  if (lErr) throw new Error(`online year checkout: license read failed: ${lErr.message}`)
  return lic && lic.length ? String(lic[0].child_name) : null
}

export async function handleOnlineYearCheckout(
  req: Request,
  body: Record<string, unknown>,
  deps: OnlineYearCheckoutDeps,
): Promise<Response> {
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...deps.cors, "Content-Type": "application/json" } })
  const refuse = (status: number, code: string, error: string) => json(status, { error, code })

  // Dark until launch: the same answer as a path that does not exist.
  if (!onlineYearOpen(req, deps.env)) return json(404, { error: "not_found" })

  const band = body.band
  if (!isOnlineYearBand(band)) return refuse(400, "OY_UNKNOWN_BAND", SOMETHING_WRONG)
  if (body.agree !== true) return refuse(400, "OY_AGREEMENT_REQUIRED", SOMETHING_WRONG)
  const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : ""
  if (!(ONLINE_YEAR_COUNTRIES as readonly string[]).includes(country)) {
    return refuse(400, "OY_COUNTRY", SOMETHING_WRONG)
  }

  const typed = typeof body.email === "string" ? body.email.trim() : ""
  const email = deps.e2e ? deps.e2e.buyerEmail : typed
  if (!email || !isStripeSafeEmail(email)) return refuse(400, "OY_EMAIL", SOMETHING_WRONG)

  const now = deps.now ? deps.now() : new Date()
  const liveFirst = await liveFirstChildName(deps.db, email, band, now)
  const planned = planOnlineYearCart({ band, childNames: body.child_names, liveFirstChildName: liveFirst })
  if (!planned.ok) {
    const error = planned.error === "too_many_children"
      ? "For a family this size, email hello@edeninstitute.health and we'll set it up for you."
      : SOMETHING_WRONG
    return refuse(400, `OY_${planned.error.toUpperCase()}`, error)
  }
  const plan = planned.plan
  const hasFirst = plan.children.some((c) => c.kind === "first_child")

  // Prices: live lookup keys, refused whole rather than sold partial. The E2E twin builds
  // test-mode prices inline (its Stripe key is sk_test_, where the live keys do not exist).
  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[]
  if (deps.e2e) {
    lineItems = plan.lines.map((l) => {
      const kind: OnlineYearKind = l.lookup_key.endsWith("_first_child") ? "first_child" : "sibling"
      return {
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: ONLINE_YEAR_PRICE_CENTS[kind],
          product_data: { name: `E2E TEST: ${onlineYearProductName(band, kind)}`, description: onlineYearProductDescription(band, kind) },
        },
      }
    })
  } else {
    const keys = plan.lines.map((l) => l.lookup_key)
    const prices = await deps.stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 })
    const byKey = new Map<string, string>()
    for (const p of prices.data ?? []) if (p.lookup_key) byKey.set(p.lookup_key, p.id)
    const missing = keys.filter((k) => !byKey.has(k))
    if (missing.length) {
      console.error(`online year checkout: no active Stripe price for ${missing.join(", ")}; refusing`)
      return refuse(503, "OY_NOT_CONFIGURED", "Checkout isn't quite ready. Please try again shortly, or email hello@edeninstitute.health.")
    }
    lineItems = plan.lines.map((l) => ({ price: byKey.get(l.lookup_key)!, quantity: l.quantity }))
  }

  const metadata: Record<string, string> = {
    ...buildOnlineYearMetadata(plan),
    oy_country: country,
    email,
    ...(deps.extraMetadata ? deps.extraMetadata(body) : {}),
  }
  if (deps.e2e) metadata[deps.e2e.metadataKey] = "true"

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    success_url: ONLINE_YEAR_SUCCESS_URL,
    cancel_url: onlineYearCancelUrl(band),
    customer_email: email,
    customer_creation: "always",
    billing_address_collection: "required",
    automatic_tax: { enabled: true },
    custom_fields: [heardAboutStripeField()],
    custom_text: { submit: { message: ONLINE_YEAR_UNDER_BUTTON } },
    metadata,
    payment_intent_data: { metadata },
  }

  // A Starter credit, only through promo_code (the Starter email's link), only off the first child.
  const rawCode = typeof body.promo_code === "string" ? body.promo_code.trim() : ""
  if (rawCode && !deps.e2e) {
    const decision = await decidePrintPromoCredit(deps.db, deps.stripe, {
      rawCode,
      email,
      skus: hasFirst ? [onlineYearCreditSku(band)] : [],
      offerSession: false,
    })
    if (decision.kind === "refuse") {
      console.warn(`online year checkout: starter credit refused: reason=${decision.code} credit_id=${decision.creditId}`)
      return refuse(400, decision.code, decision.message)
    }
    if (decision.kind === "apply") {
      params.discounts = [{ promotion_code: decision.promotionCodeId }]
      metadata.starter_credit_code = decision.code
      metadata.starter_credit_promo_id = decision.promotionCodeId
    } else if (decision.kind === "lookup_failed") {
      console.error(`online year checkout: starter credit lookup failed, not applied: ${decision.detail}`)
    }
    // not_a_credit / skip: nothing is applied; this checkout has no promo field.
  }

  const session = await deps.createSession(params)
  console.log(`online year checkout: band=${band} children=${plan.children.length} first=${hasFirst} session=${session.id}`)
  return json(200, { url: session.url, session_id: session.id })
}
