// Signed link builder for the founders-price capture page
// (public/sprouts-founders.html -> POSTs to the founders-lock EF).
//
// WHY THIS EXISTS: sprouts-founders.html refuses to render a usable form without
// a signed `?t=` token. Its inline script does:
//     if (!payload || !payload.e) { showErr('This link is missing or invalid...');
//                                   btn.disabled = true; }
// Launch email 7 originally linked to the bare page URL with no token, so the
// Reserve button rendered permanently disabled for every recipient (found
// 2026-07-25, final count 1,382 families per launch_email_queue; the 1,149 in
// the original incident note was a mid-drain snapshot). This module makes the
// signed URL the only way to build that link.
//
// The token scheme MUST stay byte-identical to founders-lock/index.ts `sign()`,
// because that function verifies it:
//     token   = b64url(JSON.stringify(payload)) + '.' + b64url(HMAC-SHA256(json))
//     payload = { e, n, c }   <- key order is part of the signed string
//     key     = SUPABASE_SERVICE_ROLE_KEY (server-only, never shipped to a client)
// Same key/scheme as _shared/email-unsubscribe.ts.

const FOUNDERS_PAGE = 'https://edeninstitute.health/sprouts-founders.html';

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function secret(): string {
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — cannot sign founders token');
  return s;
}

async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/**
 * Signed token for the founders form. Payload key order {e, n, c} is load
 * bearing: the HMAC covers the exact JSON string founders-lock reconstructs.
 */
export async function signFoundersToken(
  email: string,
  name: string,
  source: string,
): Promise<string> {
  const payload = JSON.stringify({
    e: email.trim().toLowerCase(),
    n: (name || '').trim(),
    c: source || 'sprouts_upgrade_email1',
  });
  const sig = b64urlEncode(await hmac(payload));
  return `${b64urlEncode(new TextEncoder().encode(payload))}.${sig}`;
}

/**
 * Full founders-page URL carrying the signed token. Always use this to build the
 * link in an email; linking to FOUNDERS_PAGE directly ships a dead button.
 */
export async function foundersFormUrl(
  email: string,
  name: string,
  source: string,
): Promise<string> {
  const t = await signFoundersToken(email, name, source);
  return `${FOUNDERS_PAGE}?t=${encodeURIComponent(t)}`;
}
