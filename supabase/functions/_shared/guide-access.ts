// supabase/functions/_shared/guide-access.ts
//
// Emailed, expiring access links for the Deep-Dive Guide (founder decision
// 2026-09-15). Replaces "remember the Stripe session id in localStorage forever":
// a buyer on a new device, a new browser or after clearing storage had no way back
// to the on-site guide. Now the /guide/<slug> page offers "Send me my guide link",
// and guide-access-link emails https://edeninstitute.health/guide/<slug>?access=<token>.
//
// TOKEN. Stateless HMAC, same construction as email-unsubscribe.ts and
// delay-consent-token.ts: b64url(payloadJson) + "." + b64url(HMAC-SHA256).
//   payload { v: 1, o: <orders.id>, s: <guide slug>, x: <expiry, unix seconds> }
// No email address in the token: it sits in a URL. The order id ties it to one real
// purchase, and the verifier re-checks that order (so a refund revokes the link).
//
// SIGNING KEY. GUIDE_ACCESS_SECRET when set, else SUPABASE_SERVICE_ROLE_KEY (the
// key the two sibling token modules already use). The message is prefixed with a
// purpose string, so a signature made here can never validate as an unsubscribe or
// delay-consent token, or the other way round. Setting or rotating
// GUIDE_ACCESS_SECRET later only invalidates links younger than 7 days, and a buyer
// can request a new one from the guide page.
//
// Pure logic lives here (tested in guide-access.test.ts); the function wires in the
// database, Resend and the guide registry.
//
// Copy rule: no em dashes.

import { escapeHtml } from './html-escape.ts';

export const GUIDE_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;
export const GUIDE_SITE_ORIGIN = 'https://edeninstitute.health';
const PURPOSE = 'eden-guide-access-v1:';

/** Link requests allowed per hour, per IP and per email address. */
export const GUIDE_LINK_PER_HOUR = 5;
export const GUIDE_LINK_WINDOW_SECONDS = 60 * 60;

export const GUIDE_LINK_SUBJECT = 'Your Deep-Dive Guide link';

/** The one response a link request gets, whether or not the email bought the guide. */
export const GENERIC_LINK_RESPONSE = { ok: true } as const;

// Founder-approved wording for public form rate limits (2026-09-15).
export const RATE_LIMIT_MESSAGE =
  'We have received several forms from you in the last few minutes. Please wait a few minutes and try again, or email us at hello@edeninstitute.health.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSecret(): string {
  const s = Deno.env.get('GUIDE_ACCESS_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('GUIDE_ACCESS_SECRET and SUPABASE_SERVICE_ROLE_KEY both missing; cannot sign guide access token');
  return s;
}

async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(PURPOSE + message)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export interface GuideAccessGrant {
  orderId: string;
  slug: string;
  /** unix seconds */
  expiresAt: number;
}

export async function signGuideAccessToken(
  input: { orderId: string; slug: string },
  now: number = nowSeconds(),
): Promise<string> {
  const json = JSON.stringify({ v: 1, o: input.orderId, s: input.slug, x: now + GUIDE_ACCESS_TTL_SECONDS });
  return `${b64urlEncode(new TextEncoder().encode(json))}.${b64urlEncode(await hmac(json))}`;
}

/** The grant, or null for a malformed, tampered, wrongly-signed or expired token. */
export async function verifyGuideAccessToken(
  token: unknown,
  now: number = nowSeconds(),
): Promise<GuideAccessGrant | null> {
  try {
    if (typeof token !== 'string' || token.length > 1024) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const json = new TextDecoder().decode(b64urlDecode(parts[0]));
    if (!equalBytes(b64urlDecode(parts[1]), await hmac(json))) return null;
    const p = JSON.parse(json);
    if (p?.v !== 1 || typeof p.o !== 'string' || !UUID_RE.test(p.o)) return null;
    if (typeof p.s !== 'string' || !SLUG_RE.test(p.s)) return null;
    if (typeof p.x !== 'number' || !Number.isFinite(p.x) || p.x <= now) return null;
    return { orderId: p.o, slug: p.s, expiresAt: p.x };
  } catch {
    return null;
  }
}

export function guideAccessUrl(slug: string, token: string): string {
  return `${GUIDE_SITE_ORIGIN}/guide/${encodeURIComponent(slug)}?access=${encodeURIComponent(token)}`;
}

/** Brand chrome matches the guide PDF delivery email in stripe-webhook (sendGuidePdf). */
export function guideLinkEmailHtml(url: string): string {
  const href = escapeHtml(url);
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F5F0E8;font-family:Georgia,serif;color:#3D3832;">`
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E3DA;">`
    + `<tr><td style="background:#2C3E2D;padding:28px 20px;text-align:center;"><span style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C5A44E;">THE EDEN INSTITUTE</span></td></tr>`
    + `<tr><td style="padding:32px 36px;font-size:16px;line-height:1.6;">`
    + `<p style="margin:0 0 24px 0;">Here is your link to your Deep-Dive Guide. It works for 7 days, and you can request a new one any time from the guide page.</p>`
    + `<p style="margin:0 0 24px 0;text-align:center;"><a href="${href}" style="display:inline-block;background:#C5A44E;color:#2C3E2D;font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 28px;border-radius:4px;">Open my guide</a></p>`
    + `<p style="margin:24px 0 4px 0;">Grace and health,</p><p style="margin:0;font-weight:bold;">Camila</p><p style="margin:4px 0 0 0;font-size:14px;">The Eden Institute</p>`
    + `</td></tr></table></body></html>`;
}

// ── Request routing ──

export type GuideAccessRequest =
  | { mode: 'verify'; token: string }
  | { mode: 'request'; email: string; slug: string }
  | { mode: 'invalid' };

/** Classify a POST body. `knownSlug` says whether a slug names a real guide. */
export function parseGuideAccessBody(body: unknown, knownSlug: (slug: string) => boolean): GuideAccessRequest {
  if (!body || typeof body !== 'object') return { mode: 'invalid' };
  const b = body as Record<string, unknown>;
  if (typeof b.token === 'string' && b.token) return { mode: 'verify', token: b.token };
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { mode: 'invalid' };
  if (!SLUG_RE.test(slug) || !knownSlug(slug)) return { mode: 'invalid' };
  return { mode: 'request', email, slug };
}

export interface LinkRequestDeps {
  /** Post-increment count for a rate bucket, or null on failure (fail open). */
  bump: (key: string) => Promise<number | null>;
  /** Newest paid, unrefunded Deep-Dive Guide order id for this email and slug, or null. */
  findOrder: (email: string, slug: string) => Promise<string | null>;
  /** Send the link email. Returns whether Resend accepted it. */
  sendLink: (email: string, url: string) => Promise<boolean>;
  /** Run work after the response where the runtime allows it, so timing does not reveal a purchase. */
  defer: (work: Promise<unknown>) => Promise<void>;
}

export interface JsonResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Handle "email me my guide link". The response is GENERIC_LINK_RESPONSE whether
 * or not a purchase exists, and whether or not the per-email bucket is full, so the
 * endpoint cannot be used to learn who bought a guide. Only the per-IP limit (which
 * says nothing about the address) answers differently.
 */
export async function handleLinkRequest(
  req: { email: string; slug: string; ip: string },
  deps: LinkRequestDeps,
): Promise<JsonResult> {
  if (req.ip) {
    const n = await deps.bump(`guide_link_ip:${req.ip}`);
    if (n !== null && n > GUIDE_LINK_PER_HOUR) {
      return { status: 429, body: { error: RATE_LIMIT_MESSAGE, code: 'RATE_LIMITED' } };
    }
  }

  const work = (async () => {
    try {
      const n = await deps.bump(`guide_link_email:${req.email}`);
      if (n !== null && n > GUIDE_LINK_PER_HOUR) {
        console.warn('guide-access-link: per-email limit reached; nothing sent');
        return;
      }
      const orderId = await deps.findOrder(req.email, req.slug);
      if (!orderId) {
        console.log(`guide-access-link: no matching purchase (slug=${req.slug}); nothing sent`);
        return;
      }
      const token = await signGuideAccessToken({ orderId, slug: req.slug });
      const sent = await deps.sendLink(req.email, guideAccessUrl(req.slug, token));
      console.log(`guide-access-link: link ${sent ? 'sent' : 'send FAILED'} (order=${orderId}, slug=${req.slug})`);
    } catch (err) {
      console.error('guide-access-link: request failed', err instanceof Error ? err.message : String(err));
    }
  })();
  await deps.defer(work);

  return { status: 200, body: { ...GENERIC_LINK_RESPONSE } };
}

export interface VerifyDeps<G> {
  /** True when the order still exists, is a Deep-Dive Guide sale and is not refunded or cancelled. */
  orderStillValid: (orderId: string) => Promise<boolean>;
  getGuide: (slug: string) => G | null;
}

/** Handle { token }: the guide content for a valid, unexpired token on a live order. */
export async function handleVerify<G>(token: string, deps: VerifyDeps<G>): Promise<JsonResult> {
  const grant = await verifyGuideAccessToken(token);
  if (!grant) return { status: 200, body: { ok: false } };
  const guide = deps.getGuide(grant.slug);
  if (!guide) return { status: 200, body: { ok: false } };
  if (!(await deps.orderStillValid(grant.orderId))) return { status: 200, body: { ok: false } };
  return { status: 200, body: { ok: true, slug: grant.slug, expires_at: grant.expiresAt, guide } };
}
