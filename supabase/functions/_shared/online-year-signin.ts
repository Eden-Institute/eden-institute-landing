// supabase/functions/_shared/online-year-signin.ts
//
// Eden's Table Online Year (punch #472), ticket OY4: sign-in. The pure half of the online-year-signin
// function; every database and email call is injected (deps), so the whole flow is unit tested in CI
// (online-year-signin.test.ts). online-year-signin/index.ts only wires Supabase and Resend.
//
// HOW IT WORKS (Camila's taps, 2026-11-23, plan "Decided (Nov 23)"): no passwords, no text messages.
//   1. request {email}: we email a 6-digit code that works for 10 minutes ("Email 5: The sign-in code").
//   2. verify {email, code}: a right code signs THIS device in. The device keeps a random token; we keep
//      only its SHA-256 (online_year_devices.token_hash).
//   3. A family may be signed in on 3 devices with one child, plus 1 more for each additional child
//      (2 children = 4, 3 = 5). Past the limit the reader shows the approved "4th device" line and, on
//      "Sign in here", the device used longest ago is signed out (reason 'limit').
//   4. session {token}: who is signed in on this device, and their licenses (the reader, OY5, builds on it).
//   5. signout {token}: signs this device out (reason 'user').
//
// WHAT AN ANONYMOUS CALLER CAN LEARN: nothing about who has a license. request answers the same
// { ok: true } whether or not the email has a license, whether or not a code went out and whether or not
// the per-email limit was hit; only the per-IP limit answers differently (429), and it says nothing about
// the address. verify answers the same CODE_INVALID for "no code", "wrong code" and "no license".
//
// WORDS: this file returns codes, not sentences. Every sentence a family sees comes from the approved copy
// (plan "Approved copy > Inside the reader" and "Email 5"); the reader (OY5) maps these codes to them.
//
// DARK: 404 { error: "not_found" } until ONLINE_YEAR_ENABLED (or the preview header), like the other
// Online Year endpoints (online-year-gate.ts).

import { onlineYearOpen } from './online-year-gate.ts';
import { timingSafeEqual } from './timing-safe-equal.ts';

export const CODE_TTL_MINUTES = 10;
/** Wrong guesses allowed on one code before it stops working (the table allows up to 10). */
export const MAX_CODE_ATTEMPTS = 5;
/** Codes one email address may be sent per hour. */
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
/** Code requests one IP may make per hour (throttling only; never used to grant anything). */
export const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
/** Code guesses one IP may make per hour, across every address. */
export const MAX_VERIFIES_PER_IP_PER_HOUR = 40;
/** Devices: 3 with one child, plus 1 for each additional child (her tap "3, plus 1 per sibling"). */
export const BASE_DEVICES = 3;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
const CODE_RE = /^\d{6}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export type SigninAction = 'request' | 'verify' | 'session' | 'signout' | 'pages';

// ── The reader (OY5) ──────────────────────────────────────────────────────────────────────────────────────
// Page images live in the PRIVATE bucket "online-year" (uploaded 2026-11-28 from the OY0 build), at
// reader/<band>/<book>/pNNN.webp. A signed-in family gets short-lived signed links, a few pages at a time,
// and only for a band where it holds a live (active, not ended) FIRST-CHILD license: the Teacher's Guide and
// storybook come with the $149 year (approved FAQ: a sibling's $29 adds that child's Notebook pages).
export type ReaderBand = 'sprouts' | 'seedlings';
export type ReaderBook = 'tg' | 'ra';
export const READER_BUCKET = 'online-year';
/** Page counts of the printed books (OY0 manifest; the files Lulu prints from). */
export const READER_PAGES: Record<ReaderBand, Record<ReaderBook, number>> = {
  sprouts: { tg: 240, ra: 112 },
  seedlings: { tg: 245, ra: 160 },
};
export const READER_LINK_SECONDS = 600;
export const MAX_PAGES_PER_CALL = 12;

export function readerPagePath(band: ReaderBand, book: ReaderBook, page: number): string {
  return `reader/${band}/${book}/p${String(page).padStart(3, '0')}.webp`;
}

/** The family's live first-child license in this band, if any (this is what opens the Teacher's Guide). */
export function readerLicense(licenses: SigninLicense[], band: string, now: Date): SigninLicense | null {
  return licenses.find((l) => l.band === band && l.kind === 'first_child' && l.status === 'active' && Date.parse(l.ends_at) > now.getTime()) ?? null;
}

export interface SigninLicense {
  id: string;
  band: string;
  child_name: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

export interface SigninParent {
  id: string;
  email: string;
  first_name: string | null;
  license_name: string | null;
}

export interface SigninCode {
  id: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used_at: string | null;
}

export interface SigninDevice {
  id: string;
  parent_id: string;
  last_seen_at: string;
  signed_out_at: string | null;
}

export interface SigninDeps {
  cors: Record<string, string>;
  now?: () => Date;
  env?: (k: string) => string | undefined;
  /** Requester IP (already extracted), '' when unknown. */
  ip: string;
  findParentByEmail(emailLower: string): Promise<SigninParent | null>;
  findParentById(id: string): Promise<SigninParent | null>;
  /** Every license the parent holds, any status. */
  listLicenses(parentId: string): Promise<SigninLicense[]>;
  /** Codes created for this email since `since` (ISO), newest first. */
  recentCodes(emailLower: string, since: string): Promise<SigninCode[]>;
  /** One hit on an hourly rate bucket (rate-bucket.ts); the post-increment count, or null (fail open). */
  bumpRate(key: string): Promise<number | null>;
  insertCode(row: { email_lower: string; code_hash: string; expires_at: string; requester_hash: string | null }): Promise<void>;
  /** Sets attempts = attempts + 1 on the code; returns the new count. */
  bumpCodeAttempts(codeId: string): Promise<number>;
  /** Marks the code used ONLY if it is still unused; true when this call used it. */
  useCode(codeId: string, at: string): Promise<boolean>;
  sendCodeEmail(to: string, firstName: string | null, code: string): Promise<boolean>;
  /** Live devices (signed_out_at null), oldest last_seen_at first. */
  liveDevices(parentId: string): Promise<SigninDevice[]>;
  insertDevice(row: { parent_id: string; token_hash: string; label: string | null }): Promise<void>;
  signOutDevice(deviceId: string, reason: 'limit' | 'user', at: string): Promise<void>;
  findDeviceByTokenHash(tokenHash: string): Promise<SigninDevice | null>;
  touchDevice(deviceId: string, at: string): Promise<void>;
  /** Signed links for these storage paths in READER_BUCKET, in the same order. */
  signUrls?(paths: string[], seconds: number): Promise<string[]>;
  /** Runs background work after the response (EdgeRuntime.waitUntil) or awaits it. */
  defer(work: Promise<unknown>): Promise<void>;
  /** Cryptographic randomness, injectable for tests. */
  randomBytes?: (n: number) => Uint8Array;
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The stored form of a code: bound to the address, so one hash never matches another family's code. */
export function codeHash(emailLower: string, code: string): Promise<string> {
  return sha256Hex(`oy-signin:v1:${emailLower}:${code}`);
}

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/** For PostgREST ilike as a case-insensitive EQUALS: escape the pattern characters ('_' is common in addresses). */
export const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

const defaultRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** A uniform 6-digit code (rejection sampling, so no digit pattern is likelier than another). */
export function newCode(random: (n: number) => Uint8Array = defaultRandom): string {
  for (;;) {
    const b = random(4);
    const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    if (n < 4_294_000_000) return String(n % 1_000_000).padStart(6, '0');
  }
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A device token: 32 random bytes, base64url (43 characters). */
export function newDeviceToken(random: (n: number) => Uint8Array = defaultRandom): string {
  return b64url(random(32));
}

/** Active, not yet ended licenses: the ones that earn devices. */
export function liveLicenses(licenses: SigninLicense[], now: Date): SigninLicense[] {
  return licenses.filter((l) => l.status === 'active' && Date.parse(l.ends_at) > now.getTime());
}

/** 3 devices with one child, plus 1 for each additional child; never fewer than 3. */
export function deviceLimit(licenses: SigninLicense[], now: Date): number {
  return Math.max(BASE_DEVICES, BASE_DEVICES - 1 + liveLicenses(licenses, now).length);
}

/** May this parent sign in at all? Any license that was not refunded or disputed (an ended year can still sign in). */
export function canSignIn(licenses: SigninLicense[]): boolean {
  return licenses.some((l) => l.status === 'active');
}

interface Result {
  status: number;
  body: Record<string, unknown>;
}

function respond(r: Result, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const NOT_FOUND: Result = { status: 404, body: { error: 'not_found' } };

/**
 * The per-IP limits count in clock-hour buckets (rate-bucket.ts -> checkout_rate_bump floors the epoch to the
 * window), so a limit lifts at the top of the next hour. retry_after_seconds lets the page say exactly when
 * (Camila 2026-11-28: "They need to know exactly how long to wait"; her tap: show the clock time).
 */
export function rateLimited(now: Date): Result {
  const s = Math.floor(now.getTime() / 1000);
  return { status: 429, body: { error: 'RATE_LIMITED', retry_after_seconds: 3600 - (s % 3600) } };
}
const CODE_INVALID: Result = { status: 400, body: { error: 'CODE_INVALID' } };
const SIGNED_OUT: Result = { status: 401, body: { error: 'SIGNED_OUT' } };

export async function handleRequest(email: string, deps: SigninDeps): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const requesterHash = deps.ip ? await sha256Hex(`oy-signin-ip:${deps.ip}`) : null;
  if (deps.ip) {
    const n = await deps.bumpRate(`oy_signin_request_ip:${deps.ip}`).catch(() => null);
    if (n !== null && n > MAX_REQUESTS_PER_IP_PER_HOUR) return rateLimited(now);
  }
  const work = (async () => {
    try {
      const recent = await deps.recentCodes(email, hourAgo);
      if (recent.length >= MAX_CODES_PER_EMAIL_PER_HOUR) {
        console.warn('online-year-signin: per-email hourly limit reached; no code sent');
        return;
      }
      const parent = await deps.findParentByEmail(email);
      if (!parent) {
        console.log('online-year-signin: no Online Year family for this address; no code sent');
        return;
      }
      if (!canSignIn(await deps.listLicenses(parent.id))) {
        console.log('online-year-signin: family has no active license; no code sent');
        return;
      }
      const code = newCode(deps.randomBytes);
      await deps.insertCode({
        email_lower: email,
        code_hash: await codeHash(email, code),
        expires_at: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
        requester_hash: requesterHash,
      });
      const sent = await deps.sendCodeEmail(parent.email, parent.first_name, code);
      console.log(`online-year-signin: code ${sent ? 'sent' : 'send FAILED'} (parent=${parent.id})`);
    } catch (err) {
      console.error('online-year-signin: request failed', err instanceof Error ? err.message : String(err));
    }
  })();
  await deps.defer(work);
  return { status: 200, body: { ok: true } };
}

export async function handleVerify(
  input: { email: string; code: string; confirm: boolean; label: string | null },
  deps: SigninDeps,
): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  if (deps.ip) {
    const n = await deps.bumpRate(`oy_signin_verify_ip:${deps.ip}`).catch(() => null);
    if (n !== null && n > MAX_VERIFIES_PER_IP_PER_HOUR) return rateLimited(now);
  }
  const codes = await deps.recentCodes(input.email, new Date(now.getTime() - CODE_TTL_MINUTES * 60_000).toISOString());
  // Only the newest code that is still open counts: asking for a new code retires the older ones.
  const open = codes.find((c) => !c.used_at && Date.parse(c.expires_at) > now.getTime());
  if (!open || codes[0]?.id !== open.id) return CODE_INVALID;
  if (open.attempts >= MAX_CODE_ATTEMPTS) return { status: 400, body: { error: 'TOO_MANY_ATTEMPTS' } };
  const want = await codeHash(input.email, input.code);
  if (!timingSafeEqual(want, open.code_hash)) {
    const n = await deps.bumpCodeAttempts(open.id);
    return n >= MAX_CODE_ATTEMPTS ? { status: 400, body: { error: 'TOO_MANY_ATTEMPTS' } } : CODE_INVALID;
  }
  const parent = await deps.findParentByEmail(input.email);
  if (!parent) return CODE_INVALID;
  const licenses = await deps.listLicenses(parent.id);
  if (!canSignIn(licenses)) return CODE_INVALID;

  const limit = deviceLimit(licenses, now);
  const live = await deps.liveDevices(parent.id);
  if (live.length >= limit && !input.confirm) {
    // The approved "4th device" screen: "You're signed in on [N] devices, your family's limit..."
    // The code is NOT used here, so "Sign in here" can send it again with confirm: true.
    return { status: 409, body: { error: 'AT_LIMIT', devices: live.length, limit } };
  }
  if (!(await deps.useCode(open.id, now.toISOString()))) return CODE_INVALID;

  const at = now.toISOString();
  // Oldest first: sign out enough to make room for this device.
  for (const d of live.slice(0, Math.max(0, live.length - limit + 1))) {
    await deps.signOutDevice(d.id, 'limit', at);
  }
  const token = newDeviceToken(deps.randomBytes);
  await deps.insertDevice({ parent_id: parent.id, token_hash: await sha256Hex(token), label: input.label });
  return { status: 200, body: { token, first_name: parent.first_name } };
}

export async function handleSession(token: string, deps: SigninDeps): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const device = await deps.findDeviceByTokenHash(await sha256Hex(token));
  if (!device || device.signed_out_at) return SIGNED_OUT;
  const parent = await deps.findParentById(device.parent_id);
  if (!parent) return SIGNED_OUT;
  const licenses = await deps.listLicenses(parent.id);
  if (!canSignIn(licenses)) return SIGNED_OUT;
  await deps.touchDevice(device.id, now.toISOString());
  return {
    status: 200,
    body: {
      parent: { first_name: parent.first_name, license_name: parent.license_name, email: parent.email },
      licenses: licenses
        .filter((l) => l.status === 'active')
        .map((l) => ({ id: l.id, band: l.band, child_name: l.child_name, kind: l.kind, starts_at: l.starts_at, ends_at: l.ends_at })),
      device_limit: deviceLimit(licenses, now),
    },
  };
}

/**
 * pages {token, band, book, from, to}: signed links for up to MAX_PAGES_PER_CALL pages of one book.
 * SIGNED_OUT when the device is not signed in; YEAR_ENDED when the family has had a first-child year in
 * this band that is over or closed (the reader shows the approved "Year ended" screen); NO_LICENSE when it
 * never had one in this band.
 */
export async function handlePages(
  input: { token: string; band: ReaderBand; book: ReaderBook; from: number; to: number },
  deps: SigninDeps,
): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const device = await deps.findDeviceByTokenHash(await sha256Hex(input.token));
  if (!device || device.signed_out_at) return SIGNED_OUT;
  const parent = await deps.findParentById(device.parent_id);
  if (!parent) return SIGNED_OUT;
  const licenses = await deps.listLicenses(parent.id);
  if (!canSignIn(licenses)) return SIGNED_OUT;
  if (!readerLicense(licenses, input.band, now)) {
    const had = licenses.some((l) => l.band === input.band && l.kind === 'first_child');
    return { status: 403, body: { error: had ? 'YEAR_ENDED' : 'NO_LICENSE' } };
  }
  const total = READER_PAGES[input.band][input.book];
  if (input.from < 1 || input.to > total || input.to < input.from || input.to - input.from + 1 > MAX_PAGES_PER_CALL) {
    return { status: 400, body: { error: 'BAD_REQUEST' } };
  }
  if (!deps.signUrls) throw new Error('signUrls not wired');
  const pages: number[] = [];
  for (let p = input.from; p <= input.to; p++) pages.push(p);
  const urls = await deps.signUrls(pages.map((p) => readerPagePath(input.band, input.book, p)), READER_LINK_SECONDS);
  await deps.touchDevice(device.id, now.toISOString());
  return { status: 200, body: { pages: pages.map((page, i) => ({ page, url: urls[i] })), total, expires_in: READER_LINK_SECONDS } };
}

export async function handleSignout(token: string, deps: SigninDeps): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const device = await deps.findDeviceByTokenHash(await sha256Hex(token));
  if (device && !device.signed_out_at) await deps.signOutDevice(device.id, 'user', now.toISOString());
  return { status: 200, body: { ok: true } };
}

/** The whole endpoint: POST { action, ... }. */
export async function handleOnlineYearSignin(req: Request, deps: SigninDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.cors });
  if (!onlineYearOpen(req, deps.env)) return respond(NOT_FOUND, deps.cors);
  if (req.method !== 'POST') return respond({ status: 405, body: { error: 'method_not_allowed' } }, deps.cors);
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return respond({ status: 400, body: { error: 'BAD_REQUEST' } }, deps.cors);
  }
  try {
    const action = b?.action;
    if (action === 'request') {
      const email = normalizeEmail(b.email);
      if (!email) return respond({ status: 400, body: { error: 'EMAIL_INVALID' } }, deps.cors);
      return respond(await handleRequest(email, deps), deps.cors);
    }
    if (action === 'verify') {
      const email = normalizeEmail(b.email);
      const code = typeof b.code === 'string' ? b.code.replace(/\s+/g, '') : '';
      if (!email || !CODE_RE.test(code)) return respond(CODE_INVALID, deps.cors);
      const label = typeof b.label === 'string' && b.label.trim() ? b.label.trim().slice(0, 80) : null;
      return respond(await handleVerify({ email, code, confirm: b.confirm === true, label }, deps), deps.cors);
    }
    if (action === 'pages') {
      const token = typeof b.token === 'string' ? b.token : '';
      if (!TOKEN_RE.test(token)) return respond(SIGNED_OUT, deps.cors);
      const band = b.band, book = b.book, from = Number(b.from), to = Number(b.to);
      if ((band !== 'sprouts' && band !== 'seedlings') || (book !== 'tg' && book !== 'ra') || !Number.isInteger(from) || !Number.isInteger(to)) {
        return respond({ status: 400, body: { error: 'BAD_REQUEST' } }, deps.cors);
      }
      return respond(await handlePages({ token, band, book, from, to }, deps), deps.cors);
    }
    if (action === 'session' || action === 'signout') {
      const token = typeof b.token === 'string' ? b.token : '';
      if (!TOKEN_RE.test(token)) return respond(SIGNED_OUT, deps.cors);
      return respond(action === 'session' ? await handleSession(token, deps) : await handleSignout(token, deps), deps.cors);
    }
    return respond({ status: 400, body: { error: 'BAD_REQUEST' } }, deps.cors);
  } catch (err) {
    console.error('online-year-signin: failed', err instanceof Error ? err.message : String(err));
    return respond({ status: 500, body: { error: 'SOMETHING_WRONG' } }, deps.cors);
  }
}

// ── The sign-in code email (approved "Email 5: The sign-in code", 2026-11-23) ─────────────────────────────

export const SIGNIN_EMAIL_FROM = 'Camila at The Eden Institute <hello@orders.edeninstitute.health>';
export const SIGNIN_EMAIL_REPLY_TO = 'hello@edeninstitute.health';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Word for word from the approved card (no buttons or links). The approved greeting is "Hi [first name],";
 * a parent row without a first name gets "Hi," (the card has no fallback line; flagged for her in the PR).
 */
export function buildSigninCodeEmail(firstName: string | null, code: string, footerAddress: string): { subject: string; text: string; html: string } {
  const name = (firstName ?? '').trim();
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const lines = [
    greeting,
    `Here's your code to sign in to your Online Year: ${code}`,
    "It works for the next 10 minutes. If you didn't ask for it, you can ignore this email; nobody can get in without it.",
    'Camila',
    'The Eden Institute',
  ];
  const footer = `You're getting this because someone asked to sign in to your Online Year. ${footerAddress}`;
  const p = (t: string) => `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;margin:0 0 14px 0;">${t}</p>`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:16px;background-color:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;">It works for the next 10 minutes.</div>
<div style="max-width:560px;">
${p(esc(greeting))}
${p(`Here's your code to sign in to your Online Year: <strong style="font-size:20px;letter-spacing:2px;">${esc(code)}</strong>`)}
${p(esc(lines[2]))}
${p(`${esc(lines[3])}<br>${esc(lines[4])}`)}
<div style="border-top:1px solid #eeeeee;margin:28px 0 12px 0;"></div>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#888888;margin:0;">${esc(footer)}</p>
</div>
</body></html>`;
  return { subject: `Your Eden sign-in code: ${code}`, text: `${lines.join('\n\n')}\n\n--\n${footer}`, html };
}
