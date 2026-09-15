// supabase/functions/_shared/founder-identity.ts
//
// Who the founder is, and whether a founder action needs a second factor.
//
// Founder decision 2026-09-15:
//   1. The founder identity lives in ONE database setting,
//      public.app_settings.founder_email (migration 20260916150000). is_founder()
//      reads the same row, so the SQL gate and these edge-function gates cannot
//      drift apart. If the setting cannot be read (the migration is not applied
//      yet, or a read fails) this falls back to the FOUNDER_EMAIL secret and then
//      to the historical literal, and logs that it did.
//   2. Authenticator-app two-factor for the dangerous founder actions (broadcast
//      send, Lulu cancel). The rule is enforced ONLY once the founder account has
//      a VERIFIED authenticator. Until then the action runs as it does today and
//      the response carries "mfa_enrolled": false so the dashboard can nudge. This
//      is the no-lockout guarantee: nobody is asked for a code they cannot produce.
//
// The decision itself (decideFounderAccess) is pure and unit-tested in
// founder-identity.test.ts. founderGate wires it to the real request.

/** The address every founder gate used before the setting existed. Last resort only. */
export const LEGACY_FOUNDER_EMAIL = "hello@edeninstitute.health";

export const MFA_REQUIRED_MESSAGE = "Please confirm your authenticator code first.";
export const MFA_UNAVAILABLE_MESSAGE =
  "We could not check your authenticator settings just now, so nothing was done. Please try again in a minute.";

export type FounderEmailSource = "setting" | "env" | "literal";
export type MfaFactorState = "enrolled" | "not_enrolled" | "unknown";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface EnvLike {
  get(key: string): string | undefined;
}

const denoEnv: EnvLike = { get: (k) => Deno.env.get(k) };

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// ── Founder email from the setting ────────────────────────────────────────────

const CACHE_MS = 60_000;
let cached: { email: string; at: number } | null = null;

/** Test hook: forget the cached founder email. */
export function resetFounderEmailCache(): void {
  cached = null;
}

/**
 * The founder email, read from public.app_settings with the service role.
 * A successful read is cached for a minute per isolate. Never throws.
 */
export async function resolveFounderEmail(
  opts: { fetch?: FetchLike; env?: EnvLike; now?: number } = {},
): Promise<{ email: string; source: FounderEmailSource }> {
  const now = opts.now ?? Date.now();
  if (cached && now - cached.at < CACHE_MS) return { email: cached.email, source: "setting" };
  const env = opts.env ?? denoEnv;
  const doFetch = opts.fetch ?? fetch;
  const url = env.get("SUPABASE_URL");
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY");
  let reason = "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set";
  if (url && key) {
    try {
      const res = await doFetch(`${url.replace(/\/$/, "")}/rest/v1/app_settings?id=eq.true&select=founder_email`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
      if (res.ok) {
        const rows = (await res.json()) as Array<{ founder_email?: string | null }>;
        const email = normalizeEmail(rows?.[0]?.founder_email);
        if (email) {
          cached = { email, at: now };
          return { email, source: "setting" };
        }
        reason = "app_settings has no founder_email row";
      } else {
        reason = `app_settings read returned HTTP ${res.status}`;
        await res.body?.cancel();
      }
    } catch (e) {
      reason = `app_settings read failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const fromEnv = normalizeEmail(env.get("FOUNDER_EMAIL"));
  const email = fromEnv || LEGACY_FOUNDER_EMAIL;
  const source: FounderEmailSource = fromEnv ? "env" : "literal";
  console.warn(`founder-identity: using the ${source} founder email because ${reason}`);
  return { email, source };
}

/** True when the signed-in email is the founder's (per the setting). */
export async function isFounderEmail(
  email: string | null | undefined,
  opts: { fetch?: FetchLike; env?: EnvLike } = {},
): Promise<boolean> {
  const caller = normalizeEmail(email);
  if (!caller) return false;
  const { email: founder } = await resolveFounderEmail(opts);
  return caller === founder;
}

// ── JWT assurance level ───────────────────────────────────────────────────────

/**
 * The aal claim of a bearer token, or null. The token's signature is checked
 * elsewhere (the gateway with verify_jwt, and auth.getUser() before founderGate);
 * this only reads the claim from that same token.
 */
export function jwtAal(authorization: string | null | undefined): string | null {
  const token = (authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    return typeof payload?.aal === "string" ? payload.aal : null;
  } catch {
    return null;
  }
}

// ── Verified authenticator lookup ─────────────────────────────────────────────

interface FactorLike {
  factor_type?: string;
  status?: string;
}

export function hasVerifiedTotp(factors: FactorLike[] | null | undefined): boolean {
  return (factors ?? []).some((f) => f?.factor_type === "totp" && f?.status === "verified");
}

/**
 * Whether the user has a verified authenticator, read from auth.mfa_factors through
 * the Auth admin API with the service role. "unknown" when the lookup fails.
 */
export async function lookupMfaFactorState(
  userId: string,
  opts: { fetch?: FetchLike; env?: EnvLike } = {},
): Promise<MfaFactorState> {
  const env = opts.env ?? denoEnv;
  const doFetch = opts.fetch ?? fetch;
  const url = env.get("SUPABASE_URL");
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return "unknown";
  try {
    const res = await doFetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}/factors`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`founder-identity: factor lookup returned HTTP ${res.status}`);
      await res.body?.cancel();
      return "unknown";
    }
    const body = await res.json();
    const factors = Array.isArray(body) ? body : Array.isArray(body?.factors) ? body.factors : null;
    if (!factors) {
      console.error("founder-identity: factor lookup returned an unexpected shape");
      return "unknown";
    }
    return hasVerifiedTotp(factors) ? "enrolled" : "not_enrolled";
  } catch (e) {
    console.error(`founder-identity: factor lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    return "unknown";
  }
}

// ── The decision ──────────────────────────────────────────────────────────────

export type FounderDecision =
  | { ok: true; mfaEnrolled: boolean | null }
  | { ok: false; status: 403 | 503; body: { error: string; code: string } };

/**
 * Pure decision for a founder-only request.
 *
 *   not the founder                     -> 403 FOUNDER_ONLY
 *   founder, action needs no step-up    -> allowed (mfaEnrolled null: not looked up)
 *   founder, session already aal2       -> allowed
 *   founder, aal1, no verified factor   -> allowed, mfaEnrolled false (no lockout)
 *   founder, aal1, verified factor      -> 403 MFA_REQUIRED
 *   founder, aal1, lookup failed        -> 503 MFA_STATUS_UNAVAILABLE (fail closed:
 *                                          quietly skipping the check would switch
 *                                          two-factor off without anyone noticing)
 */
export function decideFounderAccess(input: {
  callerEmail: string | null | undefined;
  founderEmail: string;
  requireMfa: boolean;
  aal: string | null;
  factorState: MfaFactorState | null;
}): FounderDecision {
  const caller = normalizeEmail(input.callerEmail);
  if (!caller || caller !== normalizeEmail(input.founderEmail)) {
    return { ok: false, status: 403, body: { error: "Founder access only", code: "FOUNDER_ONLY" } };
  }
  if (!input.requireMfa) return { ok: true, mfaEnrolled: null };
  if (input.aal === "aal2") return { ok: true, mfaEnrolled: true };
  if (input.factorState === "not_enrolled") return { ok: true, mfaEnrolled: false };
  if (input.factorState === "enrolled") {
    return { ok: false, status: 403, body: { error: MFA_REQUIRED_MESSAGE, code: "MFA_REQUIRED" } };
  }
  return { ok: false, status: 503, body: { error: MFA_UNAVAILABLE_MESSAGE, code: "MFA_STATUS_UNAVAILABLE" } };
}

// ── Wiring ────────────────────────────────────────────────────────────────────

export interface GateUser {
  id: string;
  email?: string | null;
}

/**
 * Full founder gate for a request whose user was already resolved by
 * auth.getUser() (so the token is known valid). Reads the founder email and, only
 * when requireMfa and the session is not aal2, the authenticator state.
 */
export async function founderGate(
  req: Request,
  user: GateUser,
  opts: { requireMfa: boolean; fetch?: FetchLike; env?: EnvLike },
): Promise<FounderDecision> {
  const { email: founderEmail } = await resolveFounderEmail(opts);
  const aal = jwtAal(req.headers.get("Authorization"));
  const isFounder = !!normalizeEmail(user.email) && normalizeEmail(user.email) === founderEmail;
  const factorState = isFounder && opts.requireMfa && aal !== "aal2"
    ? await lookupMfaFactorState(user.id, opts)
    : null;
  return decideFounderAccess({ callerEmail: user.email, founderEmail, requireMfa: opts.requireMfa, aal, factorState });
}

/** Adds "mfa_enrolled": false to a JSON object response, so the dashboard can nudge. */
export async function withMfaNudge(res: Response, mfaEnrolled: boolean | null): Promise<Response> {
  if (mfaEnrolled !== false) return res;
  if (!(res.headers.get("Content-Type") ?? "").includes("application/json")) return res;
  try {
    const body = await res.clone().json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return res;
    return new Response(JSON.stringify({ ...body, mfa_enrolled: false }), { status: res.status, headers: res.headers });
  } catch {
    return res;
  }
}
