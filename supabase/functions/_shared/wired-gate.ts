// supabase/functions/_shared/wired-gate.ts
//
// Fearfully & Wonderfully Wired ships DARK (spec section 18 answer 18): until Camila turns
// the quiz on (secret WIRED_ENABLED = "true"), every public wired-* function answers 404
// as if it did not exist, EXCEPT a request carrying header x-wired-preview equal to the
// WIRED_PREVIEW_TOKEN secret (Lane 2's end-to-end checks). Launch = set WIRED_ENABLED=true,
// no redeploy (the same switch pattern as PREORDERS_LIVE).

export const WIRED_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-wired-preview, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export function wiredJson(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...WIRED_CORS, 'Content-Type': 'application/json', ...extra } });
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let d = 0;
  for (let i = 0; i < ea.length; i++) d |= ea[i] ^ eb[i];
  return d === 0;
}

/** True when the quiz is live, or the request carries the preview token. */
export function wiredOpen(req: Request, env: (k: string) => string | undefined = (k) => Deno.env.get(k)): boolean {
  if (env('WIRED_ENABLED') === 'true') return true;
  const want = env('WIRED_PREVIEW_TOKEN') ?? '';
  const got = req.headers.get('x-wired-preview') ?? '';
  return want.length >= 24 && got.length > 0 && timingSafeEqual(got, want);
}

/** null = carry on; otherwise the response to return (CORS preflight, or the dark 404). */
export function wiredGate(req: Request, env?: (k: string) => string | undefined): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { headers: WIRED_CORS });
  if (!wiredOpen(req, env)) return wiredJson(404, { error: 'not_found' });
  return null;
}
