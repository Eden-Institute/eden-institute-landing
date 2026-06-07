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
// Token signing key: SUPABASE_SERVICE_ROLE_KEY (server-only, never shipped to a
// browser). Rotating it invalidates outstanding unsubscribe links — acceptable;
// a recipient can still unsubscribe from any newer email.

export type EmailList = 'constitution' | 'homeschool';

// Human-readable list names shown on the confirmation page.
export const EMAIL_LISTS: Record<EmailList, string> = {
  constitution: 'your constitution emails',
  homeschool: 'the homeschool preview emails',
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

function getSecret(): string {
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — cannot sign unsubscribe token');
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
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

// token = b64url(payloadJson) + '.' + b64url(hmac(payloadJson))
export async function signUnsubToken(email: string, list: EmailList): Promise<string> {
  const payload = JSON.stringify({ e: email.trim().toLowerCase(), l: list });
  const p = b64urlEncode(new TextEncoder().encode(payload));
  const sig = b64urlEncode(await hmac(payload));
  return `${p}.${sig}`;
}

export async function verifyUnsubToken(
  token: string,
): Promise<{ email: string; list: EmailList } | null> {
  try {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const p = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const payload = new TextDecoder().decode(b64urlDecode(p));
    const expected = b64urlEncode(await hmac(payload));
    // length-checked constant-time-ish compare
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;
    const obj = JSON.parse(payload) as { e?: unknown; l?: unknown };
    if (typeof obj.e !== 'string' || !isEmailList(obj.l)) return null;
    return { email: obj.e, list: obj.l };
  } catch {
    return null;
  }
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
export async function applyUnsub(
  html: string,
  email: string,
  list: EmailList,
): Promise<{ html: string; headers: Record<string, string> }> {
  const url = await unsubUrl(email, list);
  return {
    html: html.split('{{UNSUB_URL}}').join(url),
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
