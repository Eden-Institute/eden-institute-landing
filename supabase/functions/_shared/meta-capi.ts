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
