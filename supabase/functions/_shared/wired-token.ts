// supabase/functions/_shared/wired-token.ts
//
// Fearfully & Wonderfully Wired, W3: signed link tokens (spec section 8 "Tokens", rule 11).
// HMAC-SHA256 with WIRED_LINK_SECRET, stateless like _shared/guide-access.ts, carrying the
// family id, a purpose and an expiry. 🛑 It NEVER falls back to the service-role key (the
// trap guide-access.ts has and the unsubscribe links had, memory r_unsub_signing_secret):
// no secret = no token, and the caller answers 500.

export type WiredPurpose = 'results' | 'delete' | 'teen';

/** Lifetimes (spec section 8, PROPOSED with the spec): results 1 year, delete-confirm 24 h, teen link 60 days. */
export const WIRED_TOKEN_TTL_SECONDS: Record<WiredPurpose, number> = {
  results: 365 * 24 * 3600,
  delete: 24 * 3600,
  teen: 60 * 24 * 3600,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SECRET_LENGTH = 32;

export interface WiredGrant {
  familyId: string;
  purpose: WiredPurpose;
  childId?: string;
  expiresAt: number; // unix seconds
}

function secret(): string {
  const s = Deno.env.get('WIRED_LINK_SECRET') ?? '';
  if (s.length < MIN_SECRET_LENGTH) throw new Error('WIRED_LINK_SECRET is missing or too short; refusing to sign or verify wired tokens');
  return s;
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function mac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`wired:v1:${message}`)));
}
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function signWiredToken(
  input: { familyId: string; purpose: WiredPurpose; childId?: string },
  now: number = nowSeconds(),
): Promise<string> {
  if (!UUID_RE.test(input.familyId)) throw new Error('signWiredToken: familyId must be a uuid');
  if (input.childId !== undefined && !UUID_RE.test(input.childId)) throw new Error('signWiredToken: childId must be a uuid');
  const body: Record<string, unknown> = { v: 1, f: input.familyId, p: input.purpose, x: now + WIRED_TOKEN_TTL_SECONDS[input.purpose] };
  if (input.childId) body.c = input.childId;
  const json = JSON.stringify(body);
  return `${b64url(new TextEncoder().encode(json))}.${b64url(await mac(json))}`;
}

/** The grant, or null for a malformed, tampered, wrong-purpose or expired token. Throws only when the secret is missing. */
export async function verifyWiredToken(token: unknown, purpose: WiredPurpose, now: number = nowSeconds()): Promise<WiredGrant | null> {
  secret(); // a missing secret is a server fault (throw), never a quiet "invalid token"
  if (typeof token !== 'string' || token.length > 1024) return null;
  try {
    const [b, s, extra] = token.split('.');
    if (!b || !s || extra !== undefined) return null;
    const json = new TextDecoder().decode(unb64url(b));
    if (!same(unb64url(s), await mac(json))) return null;
    const p = JSON.parse(json);
    if (p?.v !== 1 || p.p !== purpose || typeof p.f !== 'string' || !UUID_RE.test(p.f)) return null;
    if (p.c !== undefined && (typeof p.c !== 'string' || !UUID_RE.test(p.c))) return null;
    if (typeof p.x !== 'number' || !Number.isFinite(p.x) || p.x <= now) return null;
    return { familyId: p.f, purpose: p.p, childId: p.c, expiresAt: p.x };
  } catch {
    return null;
  }
}
