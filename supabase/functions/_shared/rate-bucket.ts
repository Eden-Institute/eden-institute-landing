// supabase/functions/_shared/rate-bucket.ts
//
// Opaque-key rate buckets for public endpoints, on the same table and RPC as the
// create-checkout limiter (public.checkout_rate_bump). The parameter is named
// p_ip_hash, but it is just a bucket key: callers pass any string, it is SHA-256
// hashed here, and the raw value (an IP, an email address) is never stored.
//
// FAILS OPEN: any error returns null and callers must treat null as "allowed", so a
// limiter outage never blocks lead capture.

/**
 * Best-effort client IP: cf-connecting-ip, else x-real-ip, else the left-most
 * x-forwarded-for entry. Returns '' when none is present.
 *
 * These headers are client-influenced. This is abuse throttling, not
 * authentication: never use the result to grant anything.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Count one hit against `key` in the current window and return the post-increment
 * count, or null on any failure (fail open).
 *
 * Plain fetch on purpose, not a retrying wrapper: this RPC increments, so a retried
 * POST would double-count.
 */
export async function bumpRateBucket(opts: {
  supabaseUrl: string;
  serviceKey: string;
  key: string;
  windowSeconds: number;
}): Promise<number | null> {
  try {
    if (!opts.supabaseUrl || !opts.serviceKey) return null;
    const hash = await sha256Hex(opts.key);
    const res = await fetch(`${opts.supabaseUrl}/rest/v1/rpc/checkout_rate_bump`, {
      method: 'POST',
      headers: {
        apikey: opts.serviceKey,
        Authorization: `Bearer ${opts.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip_hash: hash, p_window_seconds: opts.windowSeconds }),
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
