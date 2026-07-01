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
// Why we check the `role` claim rather than string-matching the key value:
// a prior attempt (replay-quiz-completion-failures v2, PR #110) compared the
// inbound bearer against Deno.env SUPABASE_SERVICE_ROLE_KEY and 401'd every cron
// tick when the Vercel-side and Supabase-side key values drifted after a rotation.
// Both the old and new service-role keys carry role="service_role", so reading the
// claim is robust to that divergence. This is safe ONLY because the gateway
// validates the JWT signature first (verify_jwt=true) — so the claim cannot be
// forged. Callers of this guard MUST keep verify_jwt=true (locked in config.toml).

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
 * True only when the request carries a service-role JWT.
 * Assumes verify_jwt=true at the gateway (signature already validated).
 */
export function isServiceRoleRequest(req: Request): boolean {
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return decodeJwtRole(match[1].trim()) === "service_role";
}

/** Standard 401 response for a non-service-role caller. */
export function serviceRoleRequired(corsHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
