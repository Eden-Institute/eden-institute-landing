// supabase/functions/_shared/easypost.ts
//
// Dependency-free EasyPost REST client for Deno Edge Functions (decision brief 1A,
// approved 2026-07-02). Plain fetch + Basic auth, same pattern as our Stripe/Resend/
// Twilio calls. EasyPost uses INCHES and OUNCES for parcels; callers convert.

const BASE = "https://api.easypost.com/v2"

function apiKey(): string {
  const k = Deno.env.get("EASYPOST_API_KEY")
  if (!k) throw new Error("EASYPOST_API_KEY missing")
  return k
}

// deno-lint-ignore no-explicit-any
async function ep(path: string, method = "GET", body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(apiKey() + ":")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = JSON.stringify(json?.error ?? json).slice(0, 500)
    throw new Error(`easypost ${res.status} ${path}: ${detail}`)
  }
  return json
}

export interface EpAddressInput {
  name?: string | null
  street1: string
  street2?: string | null
  city: string
  state: string
  zip: string
  country?: string
  phone?: string | null
  email?: string | null
}

export interface EpVerification {
  valid: boolean
  errors: string[]
  // deno-lint-ignore no-explicit-any
  address: any | null // the created EasyPost Address (normalized when valid)
}

/** CASS delivery verification. Never throws on an UNDELIVERABLE address; returns valid=false + reasons. */
export async function verifyAddress(addr: EpAddressInput): Promise<EpVerification> {
  const created = await ep("/addresses", "POST", {
    address: { ...addr, country: addr.country ?? "US" },
    verify: ["delivery"],
  })
  const v = created?.verifications?.delivery
  const valid = !!v?.success
  // deno-lint-ignore no-explicit-any
  const errors: string[] = (v?.errors ?? []).map((e: any) => String(e?.message ?? e?.code ?? e))
  return { valid, errors, address: created }
}

export interface EpParcel {
  length: number // inches
  width: number  // inches
  height: number // inches
  weight: number // ounces
}

// deno-lint-ignore no-explicit-any
export async function createShipment(to: any, from: any, parcel: EpParcel): Promise<any> {
  return await ep("/shipments", "POST", {
    shipment: { to_address: to, from_address: from, parcel },
  })
}

/** Cheapest rate across returned carriers. */
// deno-lint-ignore no-explicit-any
export function lowestRate(shipment: any): any | null {
  // deno-lint-ignore no-explicit-any
  const rates: any[] = shipment?.rates ?? []
  if (rates.length === 0) return null
  return rates.reduce((min, r) => (parseFloat(r.rate) < parseFloat(min.rate) ? r : min))
}

// deno-lint-ignore no-explicit-any
export async function buyShipment(shipmentId: string, rateId: string): Promise<any> {
  return await ep(`/shipments/${shipmentId}/buy`, "POST", { rate: { id: rateId } })
}

/** Void/refund a purchased label. */
// deno-lint-ignore no-explicit-any
export async function refundShipment(shipmentId: string): Promise<any> {
  return await ep(`/shipments/${shipmentId}/refund`, "POST")
}

/**
 * EasyPost webhook signature: X-Hmac-Signature = "hmac-sha256-hex=<digest>", HMAC-SHA256
 * of the raw body with the webhook secret set at endpoint creation. Constant-time compare.
 */
export async function verifyEasyPostSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false
  const expected = header.replace(/^hmac-sha256-hex=/, "").trim().toLowerCase()
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("")
  if (hex.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
