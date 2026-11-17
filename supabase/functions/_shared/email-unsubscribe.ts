// ── Per-list one-click unsubscribe (RFC 8058) ──
//
// Stateless HMAC token identifies (email, list). The public `unsubscribe`
// Edge Function verifies the token and writes one row to
// public.email_list_unsubscribes. Senders consult that table and skip anyone
// who has opted out of the relevant list.
//
// Scope discipline:
//   - Per-list VOLUNTARY opt-out lives here (email_list_unsubscribes).
//   - GLOBAL unsubscribes (Resend-level), hard bounces, and spam complaints
//     stay global and flow through resend-webhook -> waitlist_signups; the
//     cancel_queued_emails_on_unsubscribe trigger cancels all queued sends in
//     that case. The two layers compose; this file never touches the global one.
//
// Token signing key (2026-11-17, Lane 2 area 8 U2, founder tap "Yes, build + ship"):
// UNSUB_SIGNING_SECRET, a secret of its own, set to the value SUPABASE_SERVICE_ROLE_KEY
// had on that day, so every link already sent still verifies. New links are signed
// with it; a token verifies against it OR the current service-role key. Before this,
// links were signed with the service-role key alone, so rotating that key would have
// broken every unsubscribe link ever sent, and the inbox one-click button would have
// answered 200 with nothing saved. Both keys are server-only, never in a browser.
// With UNSUB_SIGNING_SECRET unset, everything falls back to the service-role key
// (the old behaviour), so deploy order does not matter.

import { confirmPageUrl } from './unsubscribe-request.ts';

// postpurchase (2026-09-03): the buyer track (buyer_email_queue). Kept apart from
// homeschool so a buyer can stop the insider-track emails without touching the
// homeschool previews, and vice versa. Order and shipping notices are
// transactional and carry no list at all.
// cart (2026-09-28): the one abandoned-checkout reminder stripe-webhook sends to a
// shopper who ticked Stripe's promotional-consent box (_shared/checkout-recovery.ts).
export type EmailList = 'constitution' | 'homeschool' | 'postpurchase' | 'podcast' | 'cart';

// Human-readable list names shown on the confirmation page.
export const EMAIL_LISTS: Record<EmailList, string> = {
  constitution: 'your constitution emails',
  homeschool: 'the homeschool preview emails',
  postpurchase: "the Eden's Table buyer updates",
  podcast: 'the Tales and Table Talk emails',
  cart: 'checkout reminder emails',
};

export function isEmailList(value: unknown): value is EmailList {
  return typeof value === 'string' && value in EMAIL_LISTS;
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

/** Signing keys in order: the first signs, any of them verifies. Never empty (throws). */
export function unsubSigningSecrets(): string[] {
  const out: string[] = [];
  for (const name of ['UNSUB_SIGNING_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const v = (Deno.env.get(name) ?? '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  if (!out.length) {
    throw new Error('UNSUB_SIGNING_SECRET and SUPABASE_SERVICE_ROLE_KEY both missing — cannot sign unsubscribe token');
  }
  return out;
}

async function hmac(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

// length-checked constant-time-ish compare
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// token = b64url(payloadJson) + '.' + b64url(hmac(payloadJson))
export async function signUnsubToken(email: string, list: EmailList): Promise<string> {
  const payload = JSON.stringify({ e: email.trim().toLowerCase(), l: list });
  const p = b64urlEncode(new TextEncoder().encode(payload));
  const sig = b64urlEncode(await hmac(payload, unsubSigningSecrets()[0]));
  return `${p}.${sig}`;
}

/**
 * ok: the signature matches one of the signing keys.
 * bad_signature: the token reads as a real unsubscribe link (an email and a known list)
 *   but no key signs it. That is a link signed with a key we no longer hold, or a
 *   tampered one, and it is the one case worth telling the founder about (the person
 *   asked to leave and nothing was saved). Never honoured: anyone could forge one.
 * malformed: anything else (empty, garbage, truncated by a mail client).
 */
export type UnsubTokenCheck =
  | { ok: true; email: string; list: EmailList }
  | { ok: false; reason: 'bad_signature'; email: string; list: EmailList }
  | { ok: false; reason: 'malformed' };

export async function checkUnsubToken(token: string): Promise<UnsubTokenCheck> {
  try {
    const dot = token.indexOf('.');
    if (dot <= 0) return { ok: false, reason: 'malformed' };
    const p = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const payload = new TextDecoder().decode(b64urlDecode(p));
    const obj = JSON.parse(payload) as { e?: unknown; l?: unknown };
    if (typeof obj.e !== 'string' || !isEmailList(obj.l)) {
      return { ok: false, reason: 'malformed' };
    }
    for (const secret of unsubSigningSecrets()) {
      if (sameString(sig, b64urlEncode(await hmac(payload, secret)))) {
        return { ok: true, email: obj.e, list: obj.l };
      }
    }
    return { ok: false, reason: 'bad_signature', email: obj.e, list: obj.l };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export async function verifyUnsubToken(
  token: string,
): Promise<{ email: string; list: EmailList } | null> {
  const c = await checkUnsubToken(token);
  return c.ok ? { email: c.email, list: c.list } : null;
}

function unsubEndpoint(): string {
  const base = Deno.env.get('SUPABASE_URL'); // https://<ref>.supabase.co
  return `${base}/functions/v1/unsubscribe`;
}

export async function unsubUrl(email: string, list: EmailList): Promise<string> {
  const token = await signUnsubToken(email, list);
  return `${unsubEndpoint()}?token=${encodeURIComponent(token)}`;
}

// The single helper senders call: swap the {{UNSUB_URL}} placeholder baked into
// every footer for the per-(email,list) tokenized link, and return the RFC 8058
// headers to spread into the Resend send. One token computation, reused.
//
// The footer link goes straight to the confirm page on edeninstitute.health (the
// function's GET only ever 303s there anyway), so no supabase.co link sits in the
// body; Resend's deliverability check flagged that domain (2026-10-14). The
// List-Unsubscribe header keeps the function URL: mail clients POST the one-click
// unsubscribe to it directly.
export async function applyUnsub(
  html: string,
  email: string,
  list: EmailList,
): Promise<{ html: string; headers: Record<string, string> }> {
  const token = await signUnsubToken(email, list);
  const oneClick = `${unsubEndpoint()}?token=${encodeURIComponent(token)}`;
  return {
    html: html.split('{{UNSUB_URL}}').join(confirmPageUrl(token)),
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
