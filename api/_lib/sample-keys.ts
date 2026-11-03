// Per-recipient partner sample keys, for api/partner-sample.ts (punch #244, 2026-11-03).
//
// Every link used to carry the one shared PARTNER_SAMPLE_KEY, so a single leak meant
// rotating it for everyone (2026-09-10: 67 holders, 36 apology emails). Links issued
// from 2026-11-03 carry a key of their own, a row in public.partner_sample_keys
// (migration 20261103210000_partner_sample_keys.sql). The table holds only the
// SHA-256 of the key; scripts/issue_sample_key.py in the Biblical Herbalism folder
// mints the key, stores its hash and prints the link.
//
// Every download is also logged to public.partner_sample_serves with a keyed hash of
// the visitor's network, so the daily founder digest can flag a key that is suddenly
// serving many households (the fingerprint of a link that has gone public) and name
// whose it is.
//
// The key lookup FAILS CLOSED (an unreadable table cannot authorize anyone, so the
// caller answers 503). The serve log FAILS OPEN: a logging problem never blocks a
// download.

import { sha256Hex } from './wrong-key-limit.js';

export interface SampleKeyEnv {
  supabaseUrl: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
}

export type KeyLookup =
  | { status: 'active'; id: string }
  | { status: 'revoked'; id: string }
  | { status: 'unknown' }
  | { status: 'error' };

/** Issued keys are 32 base64url characters (24 random bytes). Anything far off that
 *  shape cannot be one, so it is refused without a database call. */
const KEY_SHAPE = /^[A-Za-z0-9_-]{20,64}$/;

function headers(env: SampleKeyEnv, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, ...extra };
}

/** Look up a per-recipient key by its hash. 'error' means the answer is unknown. */
export async function lookupRecipientKey(env: SampleKeyEnv, key: string): Promise<KeyLookup> {
  if (!KEY_SHAPE.test(key)) return { status: 'unknown' };
  try {
    const doFetch = env.fetchImpl ?? fetch;
    const res = await doFetch(
      `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/partner_sample_keys?key_sha256=eq.${await sha256Hex(key)}&select=id,revoked_at&limit=1`,
      { headers: headers(env) },
    );
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { status: 'error' };
    }
    const rows = (await res.json()) as Array<{ id: string; revoked_at: string | null }>;
    if (!Array.isArray(rows) || rows.length === 0) return { status: 'unknown' };
    return rows[0].revoked_at ? { status: 'revoked', id: rows[0].id } : { status: 'active', id: rows[0].id };
  } catch {
    return { status: 'error' };
  }
}

/**
 * The part of an address that stands for one household. IPv4 is kept whole. IPv6 is
 * cut to its /64: a home network keeps its prefix while each device's address inside
 * it rotates, so the whole address would count one family many times over.
 */
export function visitorNetwork(ip: string): string {
  const s = ip.trim().toLowerCase().split('%')[0];
  if (!s.includes(':')) return s;
  const mapped = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  let groups: string[];
  const gap = s.indexOf('::');
  if (gap === -1) {
    groups = s.split(':');
  } else {
    const head = s.slice(0, gap) ? s.slice(0, gap).split(':') : [];
    const tail = s.slice(gap + 2) ? s.slice(gap + 2).split(':') : [];
    groups = [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail];
  }
  const prefix = groups.slice(0, 4).map((g) => parseInt(g || '0', 16));
  if (prefix.length < 4 || prefix.some((n) => !Number.isFinite(n))) return s;
  return `${prefix.map((n) => n.toString(16)).join(':')}::/64`;
}

/** Keyed hash of the visitor's network. The pepper keeps the 4-billion IPv4 space from
 *  being reversed by brute force; the digest only needs the hashes to be stable. */
export async function visitorHash(ip: string, pepper: string): Promise<string> {
  return sha256Hex(`partner_sample_visitor:${pepper}:${visitorNetwork(ip)}`);
}

export interface ServeRow {
  /** null = the shared PARTNER_SAMPLE_KEY. */
  key_id: string | null;
  visitor_hash: string;
  slug: string;
}

/** Log one download. Never throws and never blocks the download. */
export async function recordServe(env: SampleKeyEnv, row: ServeRow): Promise<void> {
  try {
    const doFetch = env.fetchImpl ?? fetch;
    const res = await doFetch(`${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/partner_sample_serves`, {
      method: 'POST',
      headers: headers(env, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) console.error(`partner-sample: serve log failed ${res.status}`);
    await res.body?.cancel().catch(() => {});
  } catch (err) {
    console.error('partner-sample: serve log threw:', err instanceof Error ? err.message : String(err));
  }
}
