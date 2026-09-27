// supabase/functions/_shared/purchase-attribution.ts
//
// Where a BUYER came from: first-touch UTMs, the external referrer and the landing
// URL, carried from the browser through the Stripe Checkout Session into the order.
//
// WHY. Signups have carried first-touch attribution since src/lib/attribution.ts
// shipped, but purchases never did: every checkout caller sent only the consent-gated
// Meta cookies (fbp/fbc). So a Makers Market plant card, a pin or a podcast link could
// be tied to a signup and never to a sale. QR codes and pins now carry
// utm_source / utm_medium / utm_content, and those values must survive into the order.
//
// THE PATH.
//   browser    getCheckoutAttribution() (src/lib/attribution.ts), sent as
//              `attribution: {...}` in the create-checkout request body
//   create-checkout  sanitizeAttribution() -> attributionToMetadata(), merged into
//              the Checkout Session metadata as attr_utm_source, attr_referrer, ...
//   stripe-webhook   attributionColumnsFromMetadata(session.metadata), stamped onto
//              the orders row (and the payments ledger row) by a separate,
//              best-effort UPDATE
//
// RULES.
//   - The body is attacker-influenced. Only the seven known keys pass, only strings,
//     trimmed, control characters stripped, and length-capped far under Stripe's
//     metadata limits (key <= 40 chars, value <= 500 chars, <= 50 keys per object).
//     Seven keys are added at most, and every key name here is <= 17 chars.
//   - Missing, malformed or empty attribution is simply absent. It never fails a
//     checkout and never fails a webhook.
//   - Pure TypeScript, no Deno globals, so vitest can import it (src/test).

export const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "source_url",
] as const

export type AttributionField = (typeof ATTRIBUTION_FIELDS)[number]
export type PurchaseAttribution = Partial<Record<AttributionField, string>>

/** Prefix on both the Stripe metadata keys and the database columns. */
export const ATTR_PREFIX = "attr_"

export type AttributionColumn = `attr_${AttributionField}`
export type AttributionColumns = Partial<Record<AttributionColumn, string>>

/** UTMs are short labels; the browser already caps them at 200. URLs get 500,
 *  which is Stripe's per-value ceiling and the browser's own cap for them. */
const MAX_LEN: Record<AttributionField, number> = {
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  referrer: 500,
  source_url: 500,
}

// C0 controls and DEL. Newlines in a metadata value are legal in Stripe but have no
// business in a campaign label, and they make log lines and CSV exports lie.
// deno-lint-ignore no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const s = v.replace(CONTROL_CHARS, " ").trim().slice(0, max).trim()
  return s ? s : null
}

/**
 * Reduce an untrusted value (the request body's `attribution`) to the known fields.
 * Anything that is not a plain object yields {}. Never throws.
 */
export function sanitizeAttribution(raw: unknown): PurchaseAttribution {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const src = raw as Record<string, unknown>
  const out: PurchaseAttribution = {}
  for (const field of ATTRIBUTION_FIELDS) {
    let v: unknown
    try {
      v = src[field]
    } catch {
      continue
    }
    const c = clean(v, MAX_LEN[field])
    if (c) out[field] = c
  }
  return out
}

/** The Stripe metadata entries for a sanitized attribution (attr_utm_source, ...). */
export function attributionToMetadata(attr: PurchaseAttribution): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const field of ATTRIBUTION_FIELDS) {
    const v = attr[field]
    if (v) meta[`${ATTR_PREFIX}${field}`] = v
  }
  return meta
}

/**
 * Body -> metadata in one step, for create-checkout: sanitizes `body.attribution`
 * and returns only the attr_* entries to merge into the session metadata bag.
 */
export function checkoutAttributionMetadata(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {}
  let raw: unknown
  try {
    raw = (body as Record<string, unknown>).attribution
  } catch {
    return {}
  }
  return attributionToMetadata(sanitizeAttribution(raw))
}

/**
 * Stripe metadata -> the orders / payments column values, for stripe-webhook.
 * Re-sanitized on the way out (metadata can be edited by hand in the Stripe
 * Dashboard). Returns null when the session carries no attribution at all, which
 * is every session created before this shipped.
 */
export function attributionColumnsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AttributionColumns | null {
  if (!metadata || typeof metadata !== "object") return null
  const cols: AttributionColumns = {}
  for (const field of ATTRIBUTION_FIELDS) {
    const key = `${ATTR_PREFIX}${field}` as AttributionColumn
    const c = clean(metadata[key], MAX_LEN[field])
    if (c) cols[key] = c
  }
  return Object.keys(cols).length ? cols : null
}
