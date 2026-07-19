// Signed consent tokens for FTC delay notices.
//
// A delay notice must give the buyer a free, easy way to respond (435.2(b)(3): the
// mechanism is at the seller's expense). Buyers have no account and no session, so the
// response link carries a stateless HMAC token identifying (order, broadcast, choice).
//
// Same construction as _shared/email-unsubscribe.ts, deliberately: signed rather than
// stored, so there is no token table to leak and no lookup that could be enumerated.
// A token proves the bearer received that specific notice for that specific order.
//
// Signing key is SUPABASE_SERVICE_ROLE_KEY, server-only. Rotating it invalidates
// outstanding links, which for a legal notice matters more than it does for
// unsubscribe: DO NOT rotate the service key while a delay notice is outstanding
// without re-sending the notice.

export type DelayResponse = 'consented' | 'cancelled';

export function isDelayResponse(v: unknown): v is DelayResponse {
  return v === 'consented' || v === 'cancelled';
}

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
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — cannot sign delay-consent token');
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
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/** Constant-time compare, so a mismatched signature leaks nothing through timing. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface DelayTokenPayload {
  /** order id */
  o: string;
  /** broadcast id */
  b: string;
  /** the response this link records */
  r: DelayResponse;
}

export async function signDelayToken(payload: DelayTokenPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const p = b64urlEncode(new TextEncoder().encode(json));
  const sig = b64urlEncode(await hmac(json));
  return `${p}.${sig}`;
}

/** Returns the payload, or null for any malformed or unsigned token. */
export async function verifyDelayToken(token: string): Promise<DelayTokenPayload | null> {
  try {
    const [p, sig] = token.split('.');
    if (!p || !sig) return null;
    const json = new TextDecoder().decode(b64urlDecode(p));
    if (!equalBytes(b64urlDecode(sig), await hmac(json))) return null;
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.o !== 'string' || typeof parsed?.b !== 'string' ||
      !isDelayResponse(parsed?.r)
    ) return null;
    return parsed as DelayTokenPayload;
  } catch {
    return null;
  }
}
