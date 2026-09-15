// deno test supabase/functions/_shared/founder-identity.test.ts
//
// The founder gate: who counts as the founder (one DB setting, with logged
// fallbacks), and when a founder action needs a second factor. The no-lockout
// rule is the one that matters most: before an authenticator is enrolled, aal1
// must still be allowed.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decideFounderAccess,
  founderGate,
  hasVerifiedTotp,
  jwtAal,
  LEGACY_FOUNDER_EMAIL,
  lookupMfaFactorState,
  MFA_REQUIRED_MESSAGE,
  resetFounderEmailCache,
  resolveFounderEmail,
  withMfaNudge,
} from "./founder-identity.ts";

const FOUNDER = "founder@example.com";
const env = (vars: Record<string, string>) => ({ get: (k: string) => vars[k] });
const SERVICE_ENV = env({ SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service" });

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bearer(claims: Record<string, unknown>): string {
  return `Bearer ${b64url(JSON.stringify({ alg: "HS256" }))}.${b64url(JSON.stringify(claims))}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A fetch that answers the settings read and the factor lookup. */
function fakeFetch(opts: { settingEmail?: string | null; settingStatus?: number; factors?: unknown; factorStatus?: number; calls?: string[] }) {
  return (input: string): Promise<Response> => {
    opts.calls?.push(input);
    if (input.includes("/rest/v1/app_settings")) {
      if (opts.settingStatus && opts.settingStatus !== 200) return Promise.resolve(jsonResponse({ message: "nope" }, opts.settingStatus));
      return Promise.resolve(jsonResponse(opts.settingEmail == null ? [] : [{ founder_email: opts.settingEmail }]));
    }
    if (input.includes("/auth/v1/admin/users/")) {
      if (opts.factorStatus && opts.factorStatus !== 200) return Promise.resolve(jsonResponse({ msg: "down" }, opts.factorStatus));
      return Promise.resolve(jsonResponse(opts.factors ?? []));
    }
    return Promise.reject(new Error(`unexpected fetch ${input}`));
  };
}

// ── decideFounderAccess ───────────────────────────────────────────────────────

const base = { founderEmail: FOUNDER, requireMfa: true };

Deno.test("a non-founder is refused whatever their session level", () => {
  for (const aal of ["aal1", "aal2", null]) {
    const d = decideFounderAccess({ ...base, callerEmail: "someone@example.com", aal, factorState: "enrolled" });
    assertEquals(d.ok, false);
    if (!d.ok) assertEquals([d.status, d.body.code], [403, "FOUNDER_ONLY"]);
  }
  const empty = decideFounderAccess({ ...base, founderEmail: "", callerEmail: "", aal: "aal2", factorState: null });
  assertEquals(empty.ok, false);
});

Deno.test("the founder email matches case-insensitively and ignores spaces", () => {
  const d = decideFounderAccess({ ...base, callerEmail: "  Founder@Example.COM ", aal: "aal2", factorState: null });
  assertEquals(d, { ok: true, mfaEnrolled: true });
});

Deno.test("NOT enrolled + aal1: allowed as today, flagged mfa_enrolled false (no lockout)", () => {
  const d = decideFounderAccess({ ...base, callerEmail: FOUNDER, aal: "aal1", factorState: "not_enrolled" });
  assertEquals(d, { ok: true, mfaEnrolled: false });
});

Deno.test("enrolled + aal1: 403 MFA_REQUIRED with the founder-facing message", () => {
  const d = decideFounderAccess({ ...base, callerEmail: FOUNDER, aal: "aal1", factorState: "enrolled" });
  assertEquals(d, { ok: false, status: 403, body: { error: MFA_REQUIRED_MESSAGE, code: "MFA_REQUIRED" } });
  assertEquals(MFA_REQUIRED_MESSAGE, "Please confirm your authenticator code first.");
});

Deno.test("enrolled + aal2: allowed", () => {
  const d = decideFounderAccess({ ...base, callerEmail: FOUNDER, aal: "aal2", factorState: "enrolled" });
  assertEquals(d, { ok: true, mfaEnrolled: true });
});

Deno.test("aal1 and the factor lookup failed: fail closed with 503, not a silent pass", () => {
  const d = decideFounderAccess({ ...base, callerEmail: FOUNDER, aal: "aal1", factorState: "unknown" });
  assertEquals(d.ok, false);
  if (!d.ok) assertEquals([d.status, d.body.code], [503, "MFA_STATUS_UNAVAILABLE"]);
});

Deno.test("an action that needs no step-up never asks, even when enrolled at aal1", () => {
  const d = decideFounderAccess({ founderEmail: FOUNDER, requireMfa: false, callerEmail: FOUNDER, aal: "aal1", factorState: "enrolled" });
  assertEquals(d, { ok: true, mfaEnrolled: null });
});

// ── jwtAal / hasVerifiedTotp ──────────────────────────────────────────────────

Deno.test("jwtAal reads the claim and tolerates junk", () => {
  assertEquals(jwtAal(bearer({ aal: "aal2", email: FOUNDER })), "aal2");
  assertEquals(jwtAal(bearer({ aal: "aal1" })), "aal1");
  assertEquals(jwtAal(bearer({ email: FOUNDER })), null);
  assertEquals(jwtAal("Bearer not-a-jwt"), null);
  assertEquals(jwtAal("Bearer a.%%%.c"), null);
  assertEquals(jwtAal(null), null);
});

Deno.test("only a VERIFIED totp factor counts as enrolled", () => {
  assertEquals(hasVerifiedTotp([]), false);
  assertEquals(hasVerifiedTotp([{ factor_type: "totp", status: "unverified" }]), false);
  assertEquals(hasVerifiedTotp([{ factor_type: "phone", status: "verified" }]), false);
  assertEquals(hasVerifiedTotp([{ factor_type: "totp", status: "unverified" }, { factor_type: "totp", status: "verified" }]), true);
});

// ── resolveFounderEmail ───────────────────────────────────────────────────────

Deno.test("the founder email comes from app_settings when the row exists", async () => {
  resetFounderEmailCache();
  const r = await resolveFounderEmail({ env: SERVICE_ENV, fetch: fakeFetch({ settingEmail: "Founder@Example.com" }) });
  assertEquals(r, { email: FOUNDER, source: "setting" });
  resetFounderEmailCache();
});

Deno.test("a missing table or row falls back to FOUNDER_EMAIL, then the literal", async () => {
  resetFounderEmailCache();
  const withEnv = env({ SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", FOUNDER_EMAIL: "env@example.com" });
  assertEquals(await resolveFounderEmail({ env: withEnv, fetch: fakeFetch({ settingStatus: 404 }) }), { email: "env@example.com", source: "env" });
  assertEquals(await resolveFounderEmail({ env: SERVICE_ENV, fetch: fakeFetch({ settingEmail: null }) }), { email: LEGACY_FOUNDER_EMAIL, source: "literal" });
  assertEquals(await resolveFounderEmail({ env: env({}) }), { email: LEGACY_FOUNDER_EMAIL, source: "literal" });
});

Deno.test("a successful setting read is cached; a fallback is not", async () => {
  resetFounderEmailCache();
  const calls: string[] = [];
  const f = fakeFetch({ settingEmail: FOUNDER, calls });
  await resolveFounderEmail({ env: SERVICE_ENV, fetch: f, now: 1_000 });
  await resolveFounderEmail({ env: SERVICE_ENV, fetch: f, now: 2_000 });
  assertEquals(calls.length, 1);
  await resolveFounderEmail({ env: SERVICE_ENV, fetch: f, now: 1_000 + 61_000 });
  assertEquals(calls.length, 2);
  resetFounderEmailCache();
});

// ── lookupMfaFactorState ──────────────────────────────────────────────────────

Deno.test("factor lookup: array body, wrapped body, HTTP error, no env", async () => {
  assertEquals(await lookupMfaFactorState("u1", { env: SERVICE_ENV, fetch: fakeFetch({ factors: [] }) }), "not_enrolled");
  assertEquals(
    await lookupMfaFactorState("u1", { env: SERVICE_ENV, fetch: fakeFetch({ factors: [{ factor_type: "totp", status: "verified" }] }) }),
    "enrolled",
  );
  assertEquals(
    await lookupMfaFactorState("u1", { env: SERVICE_ENV, fetch: fakeFetch({ factors: { factors: [{ factor_type: "totp", status: "verified" }] } }) }),
    "enrolled",
  );
  assertEquals(await lookupMfaFactorState("u1", { env: SERVICE_ENV, fetch: fakeFetch({ factorStatus: 500 }) }), "unknown");
  assertEquals(await lookupMfaFactorState("u1", { env: SERVICE_ENV, fetch: fakeFetch({ factors: "weird" }) }), "unknown");
  assertEquals(await lookupMfaFactorState("u1", { env: env({}) }), "unknown");
});

// ── founderGate (wiring) ──────────────────────────────────────────────────────

const req = (claims: Record<string, unknown>) => new Request("https://x/fn", { method: "POST", headers: { Authorization: bearer(claims) } });

Deno.test("founderGate: aal2 skips the factor lookup entirely", async () => {
  resetFounderEmailCache();
  const calls: string[] = [];
  const d = await founderGate(req({ aal: "aal2" }), { id: "u1", email: FOUNDER }, {
    requireMfa: true, env: SERVICE_ENV, fetch: fakeFetch({ settingEmail: FOUNDER, calls }),
  });
  assertEquals(d, { ok: true, mfaEnrolled: true });
  assert(!calls.some((c) => c.includes("/factors")));
  resetFounderEmailCache();
});

Deno.test("founderGate: not enrolled at aal1 passes; enrolled at aal1 is MFA_REQUIRED", async () => {
  resetFounderEmailCache();
  const open = await founderGate(req({ aal: "aal1" }), { id: "u1", email: FOUNDER }, {
    requireMfa: true, env: SERVICE_ENV, fetch: fakeFetch({ settingEmail: FOUNDER, factors: [{ factor_type: "totp", status: "unverified" }] }),
  });
  assertEquals(open, { ok: true, mfaEnrolled: false });
  const closed = await founderGate(req({ aal: "aal1" }), { id: "u1", email: FOUNDER }, {
    requireMfa: true, env: SERVICE_ENV, fetch: fakeFetch({ settingEmail: FOUNDER, factors: [{ factor_type: "totp", status: "verified" }] }),
  });
  assertEquals(closed.ok, false);
  if (!closed.ok) assertEquals([closed.status, closed.body.code], [403, "MFA_REQUIRED"]);
  resetFounderEmailCache();
});

Deno.test("founderGate: a non-founder never triggers a factor lookup", async () => {
  resetFounderEmailCache();
  const calls: string[] = [];
  const d = await founderGate(req({ aal: "aal1" }), { id: "u2", email: "other@example.com" }, {
    requireMfa: true, env: SERVICE_ENV, fetch: fakeFetch({ settingEmail: FOUNDER, calls }),
  });
  assertEquals(d.ok, false);
  assert(!calls.some((c) => c.includes("/factors")));
  resetFounderEmailCache();
});

// ── withMfaNudge ──────────────────────────────────────────────────────────────

Deno.test("withMfaNudge adds mfa_enrolled false only when not enrolled, keeping status", async () => {
  const res = await withMfaNudge(jsonResponse({ sent: 3 }, 409), false);
  assertEquals(res.status, 409);
  assertEquals(await res.json(), { sent: 3, mfa_enrolled: false });
  const untouched = await withMfaNudge(jsonResponse({ sent: 3 }), true);
  assertEquals(await untouched.json(), { sent: 3 });
  const nullish = await withMfaNudge(jsonResponse({ sent: 3 }), null);
  assertEquals(await nullish.json(), { sent: 3 });
});
