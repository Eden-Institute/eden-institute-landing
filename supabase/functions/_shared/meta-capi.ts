// _shared/meta-capi.ts
//
// Server-side Meta Conversions API sender.
//
// Why this exists: until now the ONLY Meta event the site ever fired was `Lead`
// (browser Pixel + a server-side copy in resend-waitlist). No `Purchase` event
// has ever reached the pixel, which means ad-driven revenue is invisible in Ads
// Manager and no campaign can optimize for sales. This module is the shared
// sender; stripe-webhook uses it to report completed checkouts.
//
// Why server-side rather than a browser Pixel call on a success page:
// - Stripe redirects can be abandoned, and mobile email browsers sometimes render
//   the client-side success route blank (the same failure that forced the
//   sendGuidePdf fallback in stripe-webhook). A browser-only Purchase would
//   silently under-report.
// - Ad blockers and ITP suppress browser Pixel calls; CAPI is unaffected.
//
// Dedupe: event_id is the Stripe checkout session id. Stripe retries the webhook
// on failure, and Meta dedupes on (event_name, event_id), so a retry cannot
// double-count revenue. If a browser-side Purchase is ever added, fire it with
// the SAME session id and the two collapse into one event.
//
// This module never throws. A payment must never fail because Meta is unreachable.

const META_PIXEL_ID = "1535058498232762"
const META_CAPI_ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") ?? ""

/** SHA-256 hex, lowercased + trimmed, per Meta's user-data hashing requirement. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase())
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Report a completed purchase to Meta.
 *
 * No-ops when META_CAPI_ACCESS_TOKEN is unset, so the integration stays inert
 * until the token is configured — same defensive pattern as sendMetaCapiLead.
 * Returns true only when Meta accepted the event (useful for logging).
 */
export async function sendMetaCapiPurchase(opts: {
  /** Stripe checkout session id — doubles as the Meta dedupe key. */
  eventId: string
  /** Buyer email; hashed before it leaves this process. Null when Stripe has none. */
  email: string | null
  /** Minor units (Stripe amount_total). Converted to major units for Meta. */
  amountTotalCents: number | null
  /** ISO currency from Stripe, e.g. "usd". Defaults to USD. */
  currency: string | null
  /** Product identifier for reporting breakdowns, e.g. the Stripe lookup_key. */
  contentName?: string | null
  /**
   * Meta attribution cookies carried through Stripe metadata. `fbc` IS the ad
   * click — without it Meta frequently cannot connect this purchase to the ad
   * that caused it, so campaigns optimize blind and reported CAC is wrong.
   * Both are sent RAW (Meta requires them unhashed, unlike the PII below).
   */
  fbp?: string | null
  fbc?: string | null
  /**
   * Billing identity from Stripe's own checkout collection. Free match signal we
   * were already holding and discarding. All hashed before transmission.
   */
  billingName?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}): Promise<boolean> {
  if (!META_CAPI_ACCESS_TOKEN) return false
  try {
    // Meta rejects Purchase without a value. A zero/absent total means we cannot
    // report revenue meaningfully, so skip rather than send a misleading 0.
    if (opts.amountTotalCents == null || opts.amountTotalCents <= 0) {
      console.log(
        `Meta CAPI Purchase skipped: no positive amount_total (session=${opts.eventId})`,
      )
      return false
    }

    const userData: Record<string, unknown> = {}
    if (opts.email) userData.em = [await sha256Hex(opts.email)]

    // fbp / fbc are sent RAW — Meta matches them verbatim against the browser that
    // saw the ad. Hashing them would silently destroy the match.
    if (opts.fbp) userData.fbp = opts.fbp
    if (opts.fbc) userData.fbc = opts.fbc

    // Everything below is PII and MUST be hashed. Meta expects names lowercased
    // and postcodes/state as plain lowercase strings; sha256Hex already lowercases
    // and trims. Split the full name so first/last hash independently, which is
    // how Meta indexes them.
    const name = (opts.billingName ?? "").trim()
    if (name) {
      const parts = name.split(/\s+/)
      const first = parts[0]
      const last = parts.length > 1 ? parts[parts.length - 1] : ""
      if (first) userData.fn = [await sha256Hex(first)]
      if (last) userData.ln = [await sha256Hex(last)]
    }
    if (opts.city) userData.ct = [await sha256Hex(opts.city.replace(/\s+/g, ""))]
    if (opts.state) userData.st = [await sha256Hex(opts.state)]
    if (opts.postalCode) userData.zp = [await sha256Hex(opts.postalCode.split("-")[0])]
    if (opts.country) userData.country = [await sha256Hex(opts.country)]

    // Meta requires at least one user-data identifier. Stripe sessions without an
    // email cannot be matched to a person, so there is nothing to attribute.
    if (Object.keys(userData).length === 0) {
      console.log(`Meta CAPI Purchase skipped: no email to match (session=${opts.eventId})`)
      return false
    }

    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId,
          action_source: "website",
          event_source_url: "https://edeninstitute.health/homeschool",
          user_data: userData,
          custom_data: {
            value: opts.amountTotalCents / 100,
            currency: (opts.currency ?? "usd").toUpperCase(),
            ...(opts.contentName ? { content_name: opts.contentName } : {}),
          },
        },
      ],
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        },
      )
      if (!res.ok) {
        console.error("Meta CAPI Purchase failed", res.status, await res.text().catch(() => ""))
        return false
      }
      console.log(
        `Meta CAPI Purchase sent: value=${opts.amountTotalCents / 100} ` +
          `${(opts.currency ?? "usd").toUpperCase()} (session=${opts.eventId})`,
      )
      return true
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    // Never throw — a completed payment must not depend on Meta being reachable.
    console.error("Meta CAPI Purchase error", String(e))
    return false
  }
}

/**
 * Report a started checkout to Meta.
 *
 * WHY THIS EXISTS. Purchase is the event we actually care about, but at a $249
 * price point a campaign generates a handful of purchases a week, and Meta needs
 * roughly 50 conversions per ad set per week to learn who a buyer is. Optimizing
 * for Purchase with that little data is asking the algorithm to model something
 * it has almost never seen. InitiateCheckout sits one step earlier: far higher
 * intent than a Lead, far more volume than a Purchase. It is the signal a
 * purchase-focused campaign can actually be trained on.
 *
 * Server-side for the same reasons Purchase is: ad blockers and ITP suppress
 * browser Pixel calls, and this fires at the moment the Stripe session is
 * created, which cannot be lost to an abandoned redirect.
 *
 * Dedupe: event_id is the Stripe checkout session id, the SAME id the later
 * Purchase carries. Meta dedupes on (event_name, event_id), and the names differ,
 * so the two never collide. It does mean a checkout and its resulting purchase
 * are joinable by session id in reporting.
 *
 * UNLIKE Purchase, value is optional here. Meta requires a value for Purchase and
 * rejects the event without one; InitiateCheckout has no such rule. We send a
 * value only when the caller knows one, rather than inventing a number.
 *
 * Never throws. A buyer must never fail to reach Stripe because Meta is slow.
 */
export async function sendMetaCapiInitiateCheckout(opts: {
  /** Stripe checkout session id, doubles as the Meta dedupe key. */
  eventId: string
  /**
   * Meta attribution cookies, collected client-side only after marketing consent.
   * Sent RAW: Meta matches them verbatim against the browser that saw the ad, and
   * hashing them would silently destroy the match. Without at least one of these
   * (or an email) the event cannot be attributed and is skipped.
   */
  fbp?: string | null
  fbc?: string | null
  /** Buyer email if the caller already holds one. Hashed before transmission. */
  email?: string | null
  /** Minor units. Optional: omitted rather than guessed when unknown. */
  valueCents?: number | null
  currency?: string | null
  /** Product identifier for reporting breakdowns, e.g. the primary SKU. */
  contentName?: string | null
  /** Total units in the cart. */
  numItems?: number | null
}): Promise<boolean> {
  if (!META_CAPI_ACCESS_TOKEN) return false
  try {
    const userData: Record<string, unknown> = {}
    if (opts.email) userData.em = [await sha256Hex(opts.email)]
    if (opts.fbp) userData.fbp = opts.fbp
    if (opts.fbc) userData.fbc = opts.fbc

    // Meta requires at least one identifier. At checkout-start we usually have no
    // email yet (Stripe collects it on the next screen), so in practice this is
    // fbp/fbc. A visitor with neither declined marketing cookies or blocked the
    // pixel, and could not have been attributed to an ad anyway.
    if (Object.keys(userData).length === 0) {
      console.log(
        `Meta CAPI InitiateCheckout skipped: no fbp/fbc/email to match (session=${opts.eventId})`,
      )
      return false
    }

    const customData: Record<string, unknown> = {}
    if (opts.valueCents != null && opts.valueCents > 0) {
      customData.value = opts.valueCents / 100
      customData.currency = (opts.currency ?? "usd").toUpperCase()
    }
    if (opts.contentName) customData.content_name = opts.contentName
    if (opts.numItems != null && opts.numItems > 0) customData.num_items = opts.numItems

    const payload = {
      data: [
        {
          event_name: "InitiateCheckout",
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId,
          action_source: "website",
          event_source_url: "https://edeninstitute.health/preorder",
          user_data: userData,
          custom_data: customData,
        },
      ],
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        },
      )
      if (!res.ok) {
        console.error(
          "Meta CAPI InitiateCheckout failed",
          res.status,
          await res.text().catch(() => ""),
        )
        return false
      }
      console.log(`Meta CAPI InitiateCheckout sent (session=${opts.eventId})`)
      return true
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    console.error("Meta CAPI InitiateCheckout error", String(e))
    return false
  }
}
