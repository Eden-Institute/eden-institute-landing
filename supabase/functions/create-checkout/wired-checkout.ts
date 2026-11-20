// supabase/functions/create-checkout/wired-checkout.ts
//
// Fearfully & Wonderfully Wired, W6: the wired cart branch of create-checkout (spec 9.1-9.4,
// section 18 answers 1, 2, 15). Request:
//   { lookup_key: "wired_cart", token, product, child_ids?, email?, reminder_consent?, attribution... }
//
// Everything is verified BEFORE a Stripe session exists (answer 2):
//   - the quiz is open (WIRED_ENABLED, or the x-wired-preview header while dark),
//   - the results token is genuine and names the family,
//   - every child belongs to that family and is not removed,
//   - the later $28 upgrade has a same-quiz-year Blueprint behind it,
//   - she is not buying something she already owns this quiz year.
// Then a wired_pending_checkouts row is written and ONLY its id rides in Stripe metadata.
// Promo box OFF and a Stripe Customer for every purchase (answer 15). No cart recovery yet:
// the wired reminder (24 h, 50/50 holdout, answers 20-22 and 26) is its own ticket.

import type Stripe from "https://esm.sh/stripe@14?target=denonext"
import { wiredOpen } from "../_shared/wired-gate.ts"
import { verifyWiredToken } from "../_shared/wired-token.ts"
import { quizYear } from "../_shared/wired-engine.ts"
import {
  cleanChildIds,
  planWiredCart,
  WIRED_CANCEL_URL,
  WIRED_CART_KEY,
  WIRED_CHECKOUT_SUBMIT_MESSAGE,
  WIRED_PENDING_TTL_MS,
  WIRED_SUCCESS_URL,
  type WiredProduct,
} from "../_shared/wired-checkout.ts"
import { isStripeSafeEmail } from "../_shared/contact-email.ts"

// deno-lint-ignore no-explicit-any
type Db = any
// deno-lint-ignore no-explicit-any
type StripeLike = any

export interface WiredCheckoutDeps {
  stripe: StripeLike
  db: Db
  cors: Record<string, string>
  createSession: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ id: string; url: string | null }>
  extraMetadata?: (body: Record<string, unknown>) => Record<string, string>
  env?: (k: string) => string | undefined
  now?: () => Date
}

const FAMILY_MAP_PRODUCTS = ["family_map", "blueprint_upgrade", "family_map_upgrade"]

/** July 1, 00:00 America/Chicago (always CDT, UTC-5) of a quiz year. */
export function quizYearStartIso(year: number): string {
  return `${year}-07-01T05:00:00.000Z`
}

export async function handleWiredCheckout(
  req: Request,
  body: Record<string, unknown>,
  deps: WiredCheckoutDeps,
): Promise<Response> {
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...deps.cors, "Content-Type": "application/json" } })
  const refuse = (status: number, code: string, error: string) => json(status, { error, code })

  // Dark until launch: exactly what the other wired functions answer.
  if (!wiredOpen(req, deps.env)) return json(404, { error: "not_found" })

  const grant = await verifyWiredToken(body.token, "results")
  if (!grant) return refuse(401, "WIRED_TOKEN_INVALID", "This results link has expired. Open the newest email from us and try again.")
  const familyId = grant.familyId

  const product = body.product as WiredProduct
  const requested = body.child_ids === undefined ? [] : cleanChildIds(body.child_ids)
  if (requested === null) return refuse(400, "WIRED_BAD_CHILDREN", "Something went wrong. Please refresh the page and try again.")

  const { data: family, error: famErr } = await deps.db
    .from("wired_families").select("id, email, first_name").eq("id", familyId).maybeSingle()
  if (famErr) throw new Error(`wired checkout: family read failed: ${famErr.message}`)
  if (!family) return refuse(404, "WIRED_FAMILY_GONE", "We couldn't find these results. Please take the quiz again.")

  const { data: kids, error: kidErr } = await deps.db
    .from("wired_children").select("id, nickname, unlocked_via, created_at")
    .eq("family_id", familyId).is("removed_at", null).order("created_at", { ascending: true })
  if (kidErr) throw new Error(`wired checkout: children read failed: ${kidErr.message}`)
  const familyKids: { id: string }[] = kids ?? []
  const own = new Set(familyKids.map((k) => k.id))

  // A Family Map with no children named covers every child on the results page.
  const childIds = requested.length === 0 && FAMILY_MAP_PRODUCTS.includes(product)
    ? familyKids.map((k) => k.id)
    : requested
  if (childIds.some((id) => !own.has(id))) {
    return refuse(403, "WIRED_NOT_YOUR_CHILD", "Something went wrong. Please refresh the page and try again.")
  }

  const year = quizYear(deps.now ? deps.now() : new Date())
  const yearStart = quizYearStartIso(year)

  const { data: buys, error: buyErr } = await deps.db
    .from("wired_buyers").select("product, refunded_at, disputed_at")
    .eq("family_id", familyId).eq("quiz_year", year)
  if (buyErr) throw new Error(`wired checkout: buyers read failed: ${buyErr.message}`)
  const live = (buys ?? []).filter((b: { refunded_at: string | null; disputed_at: string | null }) => !b.refunded_at && !b.disputed_at)
  const hasSameYearBlueprint = live.some((b: { product: string }) => b.product === "blueprint")
  const hasFamilyMap = live.some((b: { product: string }) => FAMILY_MAP_PRODUCTS.includes(b.product))

  const planned = planWiredCart({ product, childCount: childIds.length, hasSameYearBlueprint })
  if (!planned.ok) {
    const msg: Record<string, [number, string]> = {
      unknown_product: [400, "Something went wrong. Please refresh the page and try again."],
      no_children: [400, "Something went wrong. Please refresh the page and try again."],
      too_many_children: [400, "For a family this size, email hello@edeninstitute.health and we'll set it up for you."],
      blueprint_is_one_child: [400, "A Blueprint is for one child. Please refresh the page and try again."],
      upgrade_needs_blueprint: [409, "The $28 upgrade is for families who bought a Blueprint this school year."],
    }
    const [status, error] = msg[planned.error]
    return refuse(status, `WIRED_${planned.error.toUpperCase()}`, error)
  }
  const plan = planned.plan

  // Never sell what she already has this quiz year (all sales are final, so a double buy cannot be undone).
  if (hasFamilyMap) {
    return refuse(409, "WIRED_ALREADY_OWNED", "You already have the Family Map this school year. Check your email for it, or write to hello@edeninstitute.health.")
  }
  if (plan.unlockAs === "blueprint") {
    const { data: prior, error: priorErr } = await deps.db
      .from("wired_unlocks").select("id").eq("family_id", familyId).eq("child_id", childIds[0])
      .in("product", ["blueprint", "family_map"]).gte("granted_at", yearStart).limit(1)
    if (priorErr) throw new Error(`wired checkout: unlock read failed: ${priorErr.message}`)
    if ((prior ?? []).length > 0) {
      return refuse(409, "WIRED_ALREADY_OWNED", "You already have this Blueprint this school year. Check your email for it, or write to hello@edeninstitute.health.")
    }
  }

  // Resolve every price in one call; refuse rather than sell a partial cart.
  const keys = [...new Set(plan.lines.map((l) => l.lookup_key))]
  const prices = await deps.stripe.prices.list({ lookup_keys: keys, active: true, limit: 10 })
  const byKey = new Map<string, string>()
  for (const p of prices.data ?? []) if (p.lookup_key) byKey.set(p.lookup_key, p.id)
  const missing = keys.filter((k) => !byKey.has(k))
  if (missing.length) {
    console.error(`wired checkout: no active Stripe price for ${missing.join(", ")}; refusing`)
    return refuse(503, "WIRED_NOT_CONFIGURED", "Checkout isn't quite ready. Please try again shortly, or email hello@edeninstitute.health.")
  }

  const now = deps.now ? deps.now() : new Date()
  const { data: pending, error: pendErr } = await deps.db
    .from("wired_pending_checkouts")
    .insert({
      family_id: familyId,
      product: plan.product,
      child_ids: childIds,
      quiz_year: year,
      extra_children: plan.extraChildren,
      expires_at: new Date(now.getTime() + WIRED_PENDING_TTL_MS).toISOString(),
    })
    .select("id").single()
  if (pendErr || !pending) throw new Error(`wired checkout: pending insert failed: ${pendErr?.message ?? "no row"}`)

  const metadata: Record<string, string> = {
    lookup_key: WIRED_CART_KEY,
    wired_pending_id: pending.id,
    wired_product: plan.product,
    wired_extra_children: String(plan.extraChildren),
    ...(deps.extraMetadata ? deps.extraMetadata(body) : {}),
  }
  const email = typeof family.email === "string" && isStripeSafeEmail(family.email) ? family.email : null
  if (email) metadata.email = email

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: plan.lines.map((l) => ({ price: byKey.get(l.lookup_key)!, quantity: l.quantity })),
    success_url: WIRED_SUCCESS_URL,
    cancel_url: WIRED_CANCEL_URL,
    automatic_tax: { enabled: true },
    customer_creation: "always",
    custom_text: { submit: { message: WIRED_CHECKOUT_SUBMIT_MESSAGE } },
    metadata,
    payment_intent_data: { metadata },
  }
  if (email) params.customer_email = email

  const session = await deps.createSession(params)
  const { error: upErr } = await deps.db
    .from("wired_pending_checkouts").update({ stripe_session_id: session.id }).eq("id", pending.id)
  if (upErr) console.error(`wired checkout: could not store session ${session.id} on pending ${pending.id}: ${upErr.message}`)

  console.log(`wired checkout: ${plan.product} children=${childIds.length} extra=${plan.extraChildren} session=${session.id}`)
  return json(200, { url: session.url, session_id: session.id })
}
