// supabase/functions/_shared/lulu.ts
//
// Dependency-free client for the Lulu Print API, in the same plain-fetch style
// as our Stripe, Resend and EasyPost calls.
//
// Contract (api.lulu.com/docs, read 2026-09-10):
//   - Auth is OAuth2 client credentials against Lulu's Keycloak realm; the
//     access token lasts about an hour and is cached per isolate.
//   - A print job = line items (each a printable: interior + cover source URLs
//     plus a pod_package_id, OR a printable_id from an earlier job) + a shipping
//     address with a phone number + a shipping level + a contact email.
//   - Status webhooks are signed: HMAC-SHA256 over the raw body, keyed with the
//     account's API SECRET (the client secret), sent in Lulu-HMAC-SHA256. Lulu
//     does not document the digest encoding, so both hex and base64 are
//     accepted; verification is constant-time either way.
//
// Nothing here touches the database. lulu-fulfillment.ts owns that.

import { luluApiBase } from './lulu-config.ts';

// ── Errors ───────────────────────────────────────────────────────────────────

export class LuluApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, path: string, detail: string) {
    super(`lulu ${status} ${path}: ${detail}`);
    this.name = 'LuluApiError';
    this.status = status;
    this.detail = detail;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

function credentials(): { key: string; secret: string } {
  // Trimmed: the Supabase secrets form is a multi-line textarea, and a pasted
  // value can carry a trailing newline that turns a valid pair into
  // "invalid_client" at Lulu's token endpoint.
  const key = (Deno.env.get('LULU_CLIENT_KEY') ?? '').trim();
  const secret = (Deno.env.get('LULU_CLIENT_SECRET') ?? '').trim();
  if (!key) throw new Error('LULU_CLIENT_KEY missing');
  if (!secret) throw new Error('LULU_CLIENT_SECRET missing');
  return { key, secret };
}

/** Client-credentials token, cached until a minute before it expires. */
export async function getLuluToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const { key, secret } = credentials();
  const res = await fetch(`${luluApiBase()}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${key}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || typeof json?.access_token !== 'string') {
    throw new LuluApiError(res.status, '/auth/token', JSON.stringify(json).slice(0, 300));
  }
  const ttlSeconds = typeof json.expires_in === 'number' ? json.expires_in : 300;
  tokenCache = { token: json.access_token, expiresAt: Date.now() + Math.max(ttlSeconds - 60, 30) * 1000 };
  return tokenCache.token;
}

/** Drop the cached token (tests, or after a 401). */
export function resetLuluTokenCache(): void {
  tokenCache = null;
}

// deno-lint-ignore no-explicit-any
async function lulu(path: string, method = 'GET', body?: unknown): Promise<any> {
  const token = await getLuluToken();
  const res = await fetch(`${luluApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    if (res.status === 401) resetLuluTokenCache();
    throw new LuluApiError(res.status, path, JSON.stringify(json).slice(0, 800));
  }
  return json;
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface LuluAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number: string;
  email: string;
  is_business?: boolean;
}

export interface LuluSourceFile {
  source_url: string;
  source_md5_sum?: string;
}

export interface LuluLineItemInput {
  title: string;
  quantity: number;
  /** Our reference for the line: the SKU, so the response can be mapped back. */
  external_id?: string;
  /** Either printable_id (a previously validated printable) ... */
  printable_id?: string;
  /** ... or the files plus the package id. */
  pod_package_id?: string;
  interior?: LuluSourceFile;
  cover?: LuluSourceFile;
}

export interface LuluPrintJobInput {
  contact_email: string;
  external_id: string;
  line_items: LuluLineItemInput[];
  production_delay: number;
  shipping_address: LuluAddress;
  shipping_level: string;
}

export interface LuluLineItemStatus {
  name?: string;
  line_item_id?: number;
  messages?: {
    tracking_id?: string;
    tracking_urls?: string[];
    carrier_name?: string;
    [k: string]: unknown;
  };
}

export interface LuluStatus {
  name: string;
  message?: string;
  changed?: string;
  line_item_statuses?: LuluLineItemStatus[];
  print_job_id?: number;
}

export interface LuluCosts {
  currency?: string;
  total_cost_excl_tax?: string | null;
  total_cost_incl_tax?: string | null;
  total_tax?: string | null;
  // deno-lint-ignore no-explicit-any
  [k: string]: any;
}

export interface LuluPrintJob {
  id: number;
  external_id?: string | null;
  status: LuluStatus;
  costs?: LuluCosts | null;
  // deno-lint-ignore no-explicit-any
  line_items?: any[];
  estimated_shipping_dates?: Record<string, string> | null;
  production_due_time?: string | null;
  date_created?: string;
  date_modified?: string;
  // deno-lint-ignore no-explicit-any
  [k: string]: any;
}

// ── Print jobs ───────────────────────────────────────────────────────────────

export function createPrintJob(input: LuluPrintJobInput): Promise<LuluPrintJob> {
  return lulu('/print-jobs/', 'POST', input);
}

export function getPrintJob(id: number | string): Promise<LuluPrintJob> {
  return lulu(`/print-jobs/${id}/`);
}

export function getPrintJobStatus(id: number | string): Promise<LuluStatus> {
  return lulu(`/print-jobs/${id}/status/`);
}

/**
 * Cancel a job. Lulu accepts this only while the job has not entered
 * production (the production_delay window); afterwards it returns an error and
 * the job ships regardless. Callers must treat a failure here as "the book is
 * coming", never as a no-op.
 */
export function cancelPrintJob(id: number | string): Promise<LuluStatus> {
  return lulu(`/print-jobs/${id}/status/`, 'PUT', { name: 'CANCELED' });
}

export interface LuluCostLineItem {
  pod_package_id: string;
  page_count: number;
  quantity: number;
}

/** Print + shipping + tax for a hypothetical job. Used for previews, never for billing the buyer. */
export function calculatePrintJobCost(input: {
  line_items: LuluCostLineItem[];
  shipping_address: Omit<LuluAddress, 'name' | 'email'> & { name?: string; email?: string };
  shipping_option: string;
  // deno-lint-ignore no-explicit-any
}): Promise<any> {
  return lulu('/print-job-cost-calculations/', 'POST', input);
}

// ── File validation (run once per book, before the first order) ─────────────

// deno-lint-ignore no-explicit-any
export function validateInterior(sourceUrl: string, podPackageId?: string): Promise<any> {
  return lulu('/validate-interior/', 'POST', podPackageId
    ? { source_url: sourceUrl, pod_package_id: podPackageId }
    : { source_url: sourceUrl });
}

// deno-lint-ignore no-explicit-any
export function getInteriorValidation(id: number | string): Promise<any> {
  return lulu(`/validate-interior/${id}/`);
}

// deno-lint-ignore no-explicit-any
export function validateCover(sourceUrl: string, podPackageId: string, pageCount: number): Promise<any> {
  return lulu('/validate-cover/', 'POST', {
    source_url: sourceUrl,
    pod_package_id: podPackageId,
    interior_page_count: pageCount,
  });
}

// deno-lint-ignore no-explicit-any
export function getCoverValidation(id: number | string): Promise<any> {
  return lulu(`/validate-cover/${id}/`);
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export function subscribeWebhook(url: string): Promise<any> {
  return lulu('/webhooks/', 'POST', { topics: ['PRINT_JOB_STATUS_CHANGED'], url });
}

// deno-lint-ignore no-explicit-any
export function listWebhooks(): Promise<any> {
  return lulu('/webhooks/');
}

// deno-lint-ignore no-explicit-any
export function updateWebhook(id: string, patch: { url?: string; is_active?: boolean }): Promise<any> {
  return lulu(`/webhooks/${id}/`, 'PATCH', patch);
}

// ── Address mapping ──────────────────────────────────────────────────────────

/** The address shape Stripe Checkout stores on orders.shipping_address. */
export interface StripeAddressLike {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

// Lulu's documented pattern for phone_number.
const LULU_PHONE_RE = /^\+?[\d\s\-.\/()]{8,20}$/;

/**
 * Build Lulu's shipping address from what Stripe collected. Throws naming the
 * missing field, because a job with a bad address is either rejected by Lulu
 * (recoverable) or delivered to the wrong place (not), and the founder needs
 * to know which field to chase.
 *
 * Phone is REQUIRED by Lulu's carriers. Stripe collects it in E.164 form
 * (+19315755895) on every checkout that enables phone_number_collection, which
 * the print checkout does.
 */
export function stripeAddressToLulu(order: {
  shipping_name?: string | null;
  shipping_address?: StripeAddressLike | null;
  customer_phone?: string | null;
  customer_email?: string | null;
}): LuluAddress {
  const a = order.shipping_address ?? null;
  const missing: string[] = [];
  const name = (order.shipping_name ?? '').trim();
  const street1 = (a?.line1 ?? '').trim();
  const city = (a?.city ?? '').trim();
  const postcode = (a?.postal_code ?? '').trim();
  const country = (a?.country ?? '').trim().toUpperCase();
  const phone = (order.customer_phone ?? '').trim();
  const email = (order.customer_email ?? '').trim();
  if (!name) missing.push('shipping_name');
  if (!street1) missing.push('shipping_address.line1');
  if (!city) missing.push('shipping_address.city');
  if (!postcode) missing.push('shipping_address.postal_code');
  if (!country) missing.push('shipping_address.country');
  if (!phone) missing.push('customer_phone');
  if (!email) missing.push('customer_email');
  if (missing.length) {
    throw new Error(`order is missing fields Lulu requires: ${missing.join(', ')}`);
  }
  if (!LULU_PHONE_RE.test(phone)) {
    throw new Error(`customer_phone '${phone}' does not match Lulu's phone pattern`);
  }
  const out: LuluAddress = {
    name,
    street1,
    city,
    postcode,
    country_code: country,
    phone_number: phone,
    email,
  };
  const street2 = (a?.line2 ?? '').trim();
  if (street2) out.street2 = street2;
  const state = (a?.state ?? '').trim().toUpperCase();
  if (state) out.state_code = state;
  return out;
}

// ── Signature verification ───────────────────────────────────────────────────

const enc = new TextEncoder();

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Constant-time string equality (same length required). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify Lulu's webhook signature. `header` is the Lulu-HMAC-SHA256 value,
 * `rawBody` the request body exactly as received (never re-serialised JSON).
 * Accepts hex or base64 digests, since Lulu documents neither.
 */
export async function verifyLuluSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false;
  const given = header.trim();
  const mac = await hmacSha256(secret, rawBody);
  const hex = toHex(mac);
  const b64 = toBase64(mac);
  return timingSafeEqual(given.toLowerCase(), hex) || timingSafeEqual(given, b64);
}

// ── Status helpers ───────────────────────────────────────────────────────────

export interface LuluTracking {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

/**
 * Pull tracking out of a print job. The SHIPPED status carries it under
 * status.line_item_statuses[].messages; the line items themselves also carry
 * tracking_id / tracking_urls once shipped. First non-empty wins.
 */
export function luluTrackingFromJob(job: LuluPrintJob): LuluTracking | null {
  const fromStatus = job.status?.line_item_statuses ?? [];
  for (const li of fromStatus) {
    const m = li.messages ?? {};
    const id = typeof m.tracking_id === 'string' ? m.tracking_id : null;
    const url = Array.isArray(m.tracking_urls) && typeof m.tracking_urls[0] === 'string' ? m.tracking_urls[0] : null;
    const carrier = typeof m.carrier_name === 'string' ? m.carrier_name : null;
    if (id || url) return { carrier, trackingNumber: id, trackingUrl: url };
  }
  for (const li of job.line_items ?? []) {
    const id = typeof li?.tracking_id === 'string' ? li.tracking_id : null;
    const url = Array.isArray(li?.tracking_urls) && typeof li.tracking_urls[0] === 'string' ? li.tracking_urls[0] : null;
    if (id || url) return { carrier: null, trackingNumber: id, trackingUrl: url };
  }
  return null;
}

/** Lulu's total_cost_incl_tax is a decimal string ("86.45"); return cents or null. */
export function luluCostCents(job: LuluPrintJob): number | null {
  const raw = job.costs?.total_cost_incl_tax;
  if (typeof raw !== 'string' || !raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
