// _shared/require-service-role.ts
//
// Guard for "internal" Edge Functions that are only ever invoked server-to-server
// (Vercel crons, other EFs) with the SUPABASE_SERVICE_ROLE_KEY in Authorization.
//
// Why this exists: these functions run at verify_jwt=true, but the project's
// public anon key is ALSO a validly-signed JWT — so gateway JWT validation alone
// lets anyone holding the anon key (it ships in the client bundle) POST them,
// bypassing the Vercel CRON_SECRET.
//
// TWO accepted proofs of service role, because neither alone is sufficient:
//
//   1. A `role: "service_role"` claim in a JWT bearer.
//      Chosen over string-matching because a prior attempt
//      (replay-quiz-completion-failures v2, PR #110) compared the inbound bearer
//      against Deno.env SUPABASE_SERVICE_ROLE_KEY and 401'd every cron tick when
//      the Vercel-side and Supabase-side values drifted after a rotation. Legacy
//      service-role keys all carry the claim, so this survives rotation.
//
//   2. An exact match against Deno.env SUPABASE_SERVICE_ROLE_KEY.
//      Added 2026-07-18. Supabase's new-format API keys (`sb_secret_…`) are opaque
//      strings, NOT JWTs, so check 1 returns null for them and the guard rejected
//      a legitimate service-role caller. This silently broke `sendGuidePdf` in
//      stripe-webhook: paying Deep-Dive Guide customers stopped receiving the PDF
//      while the on-site copy still worked, so nothing surfaced until a purchase
//      was traced end to end. The crons kept working because Vercel sends its own
//      manually-set legacy JWT, while stripe-webhook uses the platform-injected
//      key — same variable name, different value.
//
// Check 1 is safe ONLY because the gateway validates the JWT signature first
// (verify_jwt=true), so the claim cannot be forged. Callers MUST keep
// verify_jwt=true (locked in config.toml). Note the gateway does NOT reject
// non-JWT bearers — it forwards them — which is why check 2 must do its own
// constant-time comparison rather than trusting anything upstream.

/** Constant-time string compare, so a wrong key cannot be discovered byte-by-byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(atob(b64));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * True only when the request proves service role, by EITHER a `role: "service_role"`
 * JWT claim OR an exact match against SUPABASE_SERVICE_ROLE_KEY. See the header
 * comment for why both are required.
 *
 * Assumes verify_jwt=true at the gateway (JWT signatures already validated).
 */
export function isServiceRoleRequest(req: Request): boolean {
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();

  // 1. Legacy service-role JWT (survives key rotation).
  if (decodeJwtRole(token) === "service_role") return true;

  // 2. New-format opaque key (`sb_secret_…`), which carries no claims.
  //    Guard the empty case explicitly: if the env var were ever unset, an empty
  //    string must NEVER authorize anyone.
  const envKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (envKey.length > 0 && timingSafeEqual(token, envKey)) return true;

  return false;
}

/** Standard 401 response for a non-service-role caller. */
export function serviceRoleRequired(corsHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
