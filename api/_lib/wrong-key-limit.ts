// Per-connection limit on WRONG shared keys, for api/partner-sample.ts.
//
// Founder decision 2026-09-15: PARTNER_SAMPLE_KEY stays one shared key (links already
// sent must keep working), but a connection that sends WRONG_KEY_LIMIT wrong keys in
// WRONG_KEY_WINDOW_SECONDS is refused with 429 before its key is even checked.
// Correct keys never count.
//
// Same buckets as supabase/functions/_shared/rate-bucket.ts: public.checkout_rate_limits,
// keyed by the SHA-256 of an opaque string, so no IP is stored.
//   read   rpc rate_bucket_peek     (migration 20260915213000_rate_bucket_peek.sql)
//   write  rpc checkout_rate_bump   (increments)
//
// FAILS OPEN: any error, including the peek RPC not existing yet, returns null and the
// caller treats null as "not limited". A limiter outage must never lock partners out.

export const WRONG_KEY_LIMIT = 10;
export const WRONG_KEY_WINDOW_SECONDS = 15 * 60;

export interface LimiterEnv {
  supabaseUrl: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
}

/**
 * Best-effort client IP: cf-connecting-ip, else x-real-ip, else the left-most
 * x-forwarded-for entry. '' when none is present. Client-influenced headers: this is
 * abuse throttling, never authentication.
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  return (headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function bucketKey(ip: string): string {
  return `partner_sample_wrong_key:${ip}`;
}

async function rpc(env: LimiterEnv, fn: string, ip: string): Promise<number | null> {
  try {
    if (!env.supabaseUrl || !env.serviceKey || !ip) return null;
    const doFetch = env.fetchImpl ?? fetch;
    const res = await doFetch(`${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: env.serviceKey,
        Authorization: `Bearer ${env.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_ip_hash: await sha256Hex(bucketKey(ip)),
        p_window_seconds: WRONG_KEY_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const data = await res.json();
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

/** True only when the limiter positively reports the connection is at or over the limit. */
export async function isLockedOut(env: LimiterEnv, ip: string): Promise<boolean> {
  const count = await rpc(env, 'rate_bucket_peek', ip);
  return count !== null && count >= WRONG_KEY_LIMIT;
}

/** Count one wrong key for this connection. Never retried (the RPC increments). */
export async function recordWrongKey(env: LimiterEnv, ip: string): Promise<number | null> {
  return rpc(env, 'checkout_rate_bump', ip);
}
