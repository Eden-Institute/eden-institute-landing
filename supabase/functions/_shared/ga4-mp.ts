// supabase/functions/_shared/ga4-mp.ts
//
// Every sale reaches Google Analytics from the SERVER (2026-10-28, founder decision).
//
// WHY. The browser used to send GA4's "purchase" from the thank-you pages
// (src/lib/ga4Purchase.ts, src/lib/ga4DigitalPurchase.ts). Between Sep 30 and Oct 27
// GA saw only the $4.99 Deep-Dive Guide: the $29 Back to Eden PDF buyer of Oct 21
// reached /back-to-eden/thank-you (page_views shows it) and the order row existed a
// second later, yet GA never got the sale (an ad blocker, a closed tab, or Decline).
// Subscription renewals and refunds never visit a page at all. stripe-webhook sees
// every one of them, so it reports them through the GA4 Measurement Protocol, and the
// browser no longer sends "purchase" (nothing is counted twice).
//
// THE PATH.
//   browser          getCheckoutAttribution() adds attribution.ga = { client_id,
//                    session_id, consent } from the _ga cookies and the cookie banner
//   create-checkout  checkoutAttributionMetadata() stamps ga_client_id, ga_session_id
//                    and ga_consent into the session metadata (subscription_data
//                    metadata for a subscription, so every renewal carries it too)
//   stripe-webhook   decideGa4() + buildPurchase()/buildRefund() + sendGa4(), then
//                    writes the outcome onto the payments row: ga4_status,
//                    ga4_transaction_id, ga4_sent_at
//
// RULES.
//   - value is the amount the payments row records (Stripe's amount_total for a
//     checkout, amount_paid for an invoice, the refunded amount for a refund), so GA4
//     "Purchase revenue" for a month equals sum(paid) - sum(refunded) over the
//     payments rows marked ga4_status = 'sent'. Tax and shipping ride along as their
//     own parameters for reference only.
//   - Never sent: a Stripe test-mode (E2E) event, an internal payment (is_internal,
//     the founder's own test purchases), or a buyer who clicked Decline on the cookie
//     banner (founder 2026-10-28: "Skip it, note the gap"). Each skip is written to
//     ga4_status, so the monthly check can explain every dollar GA does not show.
//   - transaction_id is never a Checkout Session id (a bearer credential for the
//     order page): checkoutRef() of it for a checkout, the same 32-hex reference the
//     browser always used (src/lib/pinterestTag.ts); the invoice id for a
//     subscription payment.
//   - Pure TypeScript apart from sendGa4's injected fetch, so vitest can import it.

export const GA4_MEASUREMENT_ID = "G-5DVHEZPKL0"
export const GA4_MP_ENDPOINT = "https://www.google-analytics.com/mp/collect"
export const GA4_MP_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect"

/** Same length the browser's checkoutRef uses (src/lib/pinterestTag.ts). */
export const CHECKOUT_REF_LENGTH = 32

/**
 * The one-way reference for a Checkout Session: the first 32 hex characters of
 * SHA-256(session id), exactly as the browser derives it. Null without crypto.subtle.
 */
export async function checkoutRef(sessionId: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!sessionId || !subtle) return null
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(sessionId))
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
    return hex.slice(0, CHECKOUT_REF_LENGTH)
  } catch {
    return null
  }
}

export type Ga4Consent = "granted" | "denied"

/** What the payments row records about GA4. Null on the row = not decided yet. */
export type Ga4Status =
  | "sent"
  | "failed"
  | "skipped_test"
  | "skipped_internal"
  | "skipped_declined"
  | "skipped_no_secret"
  | "skipped_unmatched"
  | "skipped_not_subscription"

export interface Ga4Visitor {
  clientId: string | null
  sessionId: string | null
  consent: Ga4Consent | null
}

export interface Ga4Item {
  item_id: string
  item_name: string
  price: number
  quantity: number
}

export interface Ga4Payload {
  client_id: string
  timestamp_micros?: string
  events: { name: string; params: Record<string, unknown> }[]
}

/** The _ga client id ("1234567890.1700000000"), as GA itself writes it. */
const CLIENT_ID_RE = /^\d{1,20}\.\d{1,20}$/
/** A GA4 session id is the session start in epoch seconds. */
const SESSION_ID_RE = /^\d{6,12}$/

/** Stripe metadata keys. All under 40 characters. */
export const GA_METADATA_KEYS = {
  clientId: "ga_client_id",
  sessionId: "ga_session_id",
  consent: "ga_consent",
} as const

/**
 * The browser's `attribution.ga` reduced to safe metadata entries. The request body
 * is attacker-influenced: only well-formed ids pass, and consent is one of two words.
 * Never throws; anything malformed is simply absent.
 */
export function gaVisitorToMetadata(raw: unknown): Record<string, string> {
  const meta: Record<string, string> = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return meta
  const src = raw as Record<string, unknown>
  try {
    const cid = typeof src.client_id === "string" ? src.client_id.trim() : ""
    if (CLIENT_ID_RE.test(cid)) meta[GA_METADATA_KEYS.clientId] = cid
    const sid = typeof src.session_id === "string" ? src.session_id.trim() : ""
    if (SESSION_ID_RE.test(sid)) meta[GA_METADATA_KEYS.sessionId] = sid
    if (src.consent === "granted" || src.consent === "denied") meta[GA_METADATA_KEYS.consent] = src.consent
  } catch {
    // Absent rather than guessed.
  }
  return meta
}

/** Stripe metadata -> the visitor, re-validated (metadata can be edited by hand). */
export function ga4VisitorFromMetadata(metadata: Record<string, unknown> | null | undefined): Ga4Visitor {
  const md = metadata && typeof metadata === "object" ? metadata : {}
  const cid = md[GA_METADATA_KEYS.clientId]
  const sid = md[GA_METADATA_KEYS.sessionId]
  const consent = md[GA_METADATA_KEYS.consent]
  return {
    clientId: typeof cid === "string" && CLIENT_ID_RE.test(cid) ? cid : null,
    sessionId: typeof sid === "string" && SESSION_ID_RE.test(sid) ? sid : null,
    consent: consent === "granted" || consent === "denied" ? consent : null,
  }
}

/**
 * Why a payment is NOT sent, or null to send it. Order matters only for the label:
 * a test event is a test before it is anything else.
 */
export function decideGa4(f: {
  livemode: boolean
  e2e: boolean
  isInternal: boolean
  consent: Ga4Consent | null
  hasSecret: boolean
}): Ga4Status | null {
  if (!f.livemode || f.e2e) return "skipped_test"
  if (f.isInternal) return "skipped_internal"
  if (f.consent === "denied") return "skipped_declined"
  if (!f.hasSecret) return "skipped_no_secret"
  return null
}

/**
 * A GA-shaped client id for a buyer whose browser gave none (an ad blocker stopped
 * gtag.js before it set _ga, or a no-JavaScript checkout). Derived from `seed` (the
 * transaction or subscription) so a Stripe retry produces the same id, and one
 * subscriber stays one GA user across renewals. FNV-1a, not a secret: nothing about
 * the buyer can be read back from it.
 */
export function fallbackClientId(seed: string, epochSeconds: number): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${1_000_000_000 + (h % 1_000_000_000)}.${Math.floor(epochSeconds)}`
}

/** Cents to a dollar amount as a plain number, e.g. 2900 -> 29. */
export function centsToValue(cents: number): number {
  return Math.round(cents) / 100
}

function base(clientId: string, epochSeconds: number | null): Pick<Ga4Payload, "client_id" | "timestamp_micros"> {
  // Measurement Protocol accepts events up to 72 hours old; a Stripe retry inside that
  // window keeps the real time of the sale. Older than that, GA would drop the event,
  // so the timestamp is left off and GA stamps it on arrival.
  const nowS = Date.now() / 1000
  const ts = epochSeconds && nowS - epochSeconds < 71 * 3600 ? epochSeconds : null
  return {
    client_id: clientId,
    ...(ts ? { timestamp_micros: String(Math.floor(ts) * 1_000_000) } : {}),
  }
}

/** GA4's standard "purchase". */
export function buildPurchase(p: {
  clientId: string
  sessionId: string | null
  transactionId: string
  valueCents: number
  currency: string | null | undefined
  taxCents?: number | null
  shippingCents?: number | null
  items: Ga4Item[]
  epochSeconds: number | null
}): Ga4Payload {
  return {
    ...base(p.clientId, p.epochSeconds),
    events: [{
      name: "purchase",
      params: {
        transaction_id: p.transactionId,
        value: centsToValue(Math.max(0, p.valueCents)),
        currency: (p.currency || "usd").toUpperCase(),
        tax: centsToValue(Math.max(0, p.taxCents ?? 0)),
        shipping: centsToValue(Math.max(0, p.shippingCents ?? 0)),
        items: p.items,
        // Joins the sale to the visit that made it, so it keeps that visit's source.
        ...(p.sessionId ? { session_id: p.sessionId, engagement_time_msec: 1 } : {}),
      },
    }],
  }
}

/** GA4's standard "refund", for the amount the payments refund row records. */
export function buildRefund(p: {
  clientId: string
  transactionId: string
  valueCents: number
  currency: string | null | undefined
  epochSeconds: number | null
}): Ga4Payload {
  return {
    ...base(p.clientId, p.epochSeconds),
    events: [{
      name: "refund",
      params: {
        transaction_id: p.transactionId,
        value: centsToValue(Math.max(0, p.valueCents)),
        currency: (p.currency || "usd").toUpperCase(),
      },
    }],
  }
}

/**
 * POST to the Measurement Protocol. True on a 2xx. GA answers 204 to anything it can
 * parse, so the payload shapes above are pinned by tests and checked against the
 * validation server (`debug`), which records nothing. Never throws.
 */
export async function sendGa4(
  payload: Ga4Payload,
  apiSecret: string,
  fetchImpl: typeof fetch = fetch,
  debug = false,
): Promise<{ ok: boolean; status: number; body?: unknown }> {
  try {
    const url = `${debug ? GA4_MP_DEBUG_ENDPOINT : GA4_MP_ENDPOINT}` +
      `?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${encodeURIComponent(apiSecret)}`
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = debug ? await res.json().catch(() => null) : undefined
    return { ok: res.ok, status: res.status, body }
  } catch {
    return { ok: false, status: 0 }
  }
}
