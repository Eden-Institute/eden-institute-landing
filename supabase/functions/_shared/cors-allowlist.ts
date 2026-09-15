// supabase/functions/_shared/cors-allowlist.ts
//
// ── CORS allowlist (Lock #41 / audit Minor #9) ──
// Only echo Access-Control-Allow-Origin when the request Origin matches.
// Unknown origins: omit the header — browser blocks the response.
//
//   • https://edeninstitute.health           — production
//   • https://eden-institute-landing.vercel.app — canonical Vercel project URL
//   • https://eden-institute-landing-*.vercel.app — PR/preview deploys
//
// Capacitor wrap (post-launch per project_mobile_wrapping_roadmap.md) will
// add capacitor://localhost when the mobile shell ships — extend the regex
// at that time.
//
// Local `vite dev` on localhost is not on the list, so a function using this
// helper is CORS-blocked from a local dev server.

export const CORS_ORIGIN_RE =
  /^https:\/\/(edeninstitute\.health|eden-institute-landing(-[a-z0-9-]+)?\.vercel\.app)$/i;

export function allowlistCorsHeaders(req: Request, methods = "POST, OPTIONS"): Record<string, string> {
  const origin = req.headers.get("Origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods,
    Vary: "Origin",
  };
  if (origin && CORS_ORIGIN_RE.test(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}
