// The day-2 "Do you have children at home?" tap (founder-approved 2026-10-15, quiz and
// Back to Eden Chapter 1 tracks). Only a Yes gets the day-6 Eden's Table email.
//
// The email's Yes / No links go to https://edeninstitute.health/answer?t=<token>&a=yes|no.
// That page (web/pages/answer.astro) POSTs the token and answer to the children-answer
// edge function from the browser. Nothing is recorded on a GET: link scanners fetch every
// link in an email, and a GET that wrote would record both Yes and No for anyone whose mail
// is scanned (the unsubscribe link had exactly that bug until 2026-09-15).
//
// token = b64url(payloadJson) + '.' + b64url(HMAC-SHA256(key, 'children-answer:' + payloadJson))
// The 'children-answer:' prefix keeps these tokens apart from unsubscribe tokens, which are
// signed with the same key over a different payload shape.

export type LeadTrack = 'quiz' | 'back_to_eden_ch1';
const TRACKS: readonly LeadTrack[] = ['quiz', 'back_to_eden_ch1'];
const CONTEXT = 'children-answer:';
const ANSWER_PAGE = 'https://edeninstitute.health/answer';

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

function secret(): string {
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing: cannot sign or check a children-answer token');
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
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(CONTEXT + message)));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signAnswerToken(email: string, track: LeadTrack): Promise<string> {
  const payload = JSON.stringify({ e: email.trim().toLowerCase(), k: track });
  return `${b64urlEncode(new TextEncoder().encode(payload))}.${b64urlEncode(await hmac(payload))}`;
}

export async function verifyAnswerToken(token: unknown): Promise<{ email: string; track: LeadTrack } | null> {
  if (typeof token !== 'string' || token.length > 1000) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = new TextDecoder().decode(b64urlDecode(parts[0]));
    if (!sameBytes(b64urlDecode(parts[1]), await hmac(payload))) return null;
    const obj = JSON.parse(payload);
    if (typeof obj?.e !== 'string' || !obj.e.includes('@') || !TRACKS.includes(obj.k)) return null;
    return { email: obj.e, track: obj.k };
  } catch {
    return null;
  }
}

/** The two links for the day-2 email. */
export async function childrenAnswerUrls(email: string, track: LeadTrack): Promise<{ yes: string; no: string }> {
  const t = encodeURIComponent(await signAnswerToken(email, track));
  return { yes: `${ANSWER_PAGE}?t=${t}&a=yes`, no: `${ANSWER_PAGE}?t=${t}&a=no` };
}

export function parseAnswer(a: unknown): boolean | null {
  return a === 'yes' ? true : a === 'no' ? false : null;
}
