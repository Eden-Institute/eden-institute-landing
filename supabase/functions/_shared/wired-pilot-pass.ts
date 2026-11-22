// supabase/functions/_shared/wired-pilot-pass.ts
//
// The testers-only pilot gate (founder tap via Lane NP, 2026-11-22: "Testers-only pilot"). The quiz stays DARK
// (WIRED_ENABLED off). With the pilot switch on (secret WIRED_PILOT_OPEN = "true"), a public wired-* function also
// opens for a SELECTED tester, proven by the request header x-wired-pass:
//   - a 'pilot' token (wired-token.ts; f = the application id), carried by the "You're in" email's button
//     (/wired#pilot=<token>, saved on her device by the head script, src/lib/wiredPreviewLink.ts);
//   - a family link token (results / retake / teen / delete; f = the family id), so every later email works on
//     any device: em-1 results, the pilot PDFs, surveys, chapters, em-update;
//   - "rater:teen:<code>" / "rater:observer:<code>", the private link of someone she invited (their family).
// "Selected" is read live from wired_pilot_applications (status = 'selected') every time, so an Undo or a later
// change closes the door at once. Buying is NOT opened: create-checkout keeps the plain wiredOpen gate.
//
// wired-gate.ts is deliberately untouched (create-checkout imports it). This module answers the CORS preflight
// itself, with x-wired-pass added to the allowed headers.

import { type Db, pg } from "./wired-submit-flow.ts";
import { verifyWiredToken, type WiredPurpose } from "./wired-token.ts";
import { isLinkCode, sha256Hex } from "./wired-raters.ts";
import { WIRED_CORS, wiredJson, wiredOpen } from "./wired-gate.ts";

export const PASS_HEADER = "x-wired-pass";

export const WIRED_PASS_CORS: Record<string, string> = {
  ...WIRED_CORS,
  "Access-Control-Allow-Headers": `${WIRED_CORS["Access-Control-Allow-Headers"]}, ${PASS_HEADER}`,
};

type Env = (k: string) => string | undefined;
const denoEnv: Env = (k) => Deno.env.get(k);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAMILY_PURPOSES: WiredPurpose[] = ["results", "retake", "teen", "delete"];

/** A selected tester: the application's id and email (the address her "You're in" went to). */
export interface Tester {
  applicationId: string;
  email: string;
  via: "pilot" | "family" | "rater";
}

export function pilotSwitchOn(env: Env = denoEnv): boolean {
  return env("WIRED_PILOT_OPEN") === "true";
}

function envDb(env: Env): Db {
  return { url: env("SUPABASE_URL") ?? "", key: env("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
}

async function selectedById(db: Db, id: string): Promise<{ id: string; email: string } | null> {
  if (!UUID_RE.test(id)) return null;
  const a = (await pg<{ id: string; email: string; status: string }[]>(db,
    `wired_pilot_applications?id=eq.${id}&select=id,email,status&limit=1`))?.[0];
  return a?.status === "selected" ? { id: a.id, email: a.email.trim().toLowerCase() } : null;
}

async function selectedByEmail(db: Db, email: string): Promise<{ id: string; email: string } | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const a = (await pg<{ id: string; email: string; status: string }[]>(db,
    `wired_pilot_applications?email=eq.${encodeURIComponent(e)}&select=id,email,status&limit=1`))?.[0];
  return a?.status === "selected" ? { id: a.id, email: a.email.trim().toLowerCase() } : null;
}

async function familyEmail(db: Db, familyId: string): Promise<string | null> {
  if (!UUID_RE.test(familyId)) return null;
  return (await pg<{ email: string }[]>(db, `wired_families?id=eq.${familyId}&select=email&limit=1`))?.[0]?.email ?? null;
}

/** The family behind a teen / observer link code, used or not (wired-rater itself answers used / expired). */
async function raterFamily(db: Db, kind: string, code: string): Promise<string | null> {
  if (!isLinkCode(code)) return null;
  const hash = await sha256Hex(code);
  if (kind === "observer") {
    return (await pg<{ family_id: string }[]>(db, `wired_observers?token_hash=eq.${hash}&select=family_id&limit=1`))?.[0]?.family_id ?? null;
  }
  if (kind === "teen") {
    return (await pg<{ wired_children: { family_id: string } | null }[]>(db,
      `wired_teen_links?token_hash=eq.${hash}&select=wired_children!inner(family_id)&limit=1`))?.[0]?.wired_children?.family_id ?? null;
  }
  return null;
}

/**
 * The selected tester a pass proves, or null. Throws only when WIRED_LINK_SECRET is missing (a server fault,
 * like verifyWiredToken) or the database cannot be read.
 */
export async function testerFromPass(db: Db, pass: string | null | undefined): Promise<Tester | null> {
  if (typeof pass !== "string" || !pass || pass.length > 1024) return null;
  const rater = /^rater:(teen|observer):(.+)$/.exec(pass);
  if (rater) {
    const fam = await raterFamily(db, rater[1], rater[2]);
    const email = fam ? await familyEmail(db, fam) : null;
    const app = email ? await selectedByEmail(db, email) : null;
    return app ? { applicationId: app.id, email: app.email, via: "rater" } : null;
  }
  const pilot = await verifyWiredToken(pass, "pilot");
  if (pilot) {
    const app = await selectedById(db, pilot.familyId);
    return app ? { applicationId: app.id, email: app.email, via: "pilot" } : null;
  }
  for (const purpose of FAMILY_PURPOSES) {
    const grant = await verifyWiredToken(pass, purpose);
    if (!grant) continue;
    const email = await familyEmail(db, grant.familyId);
    const app = email ? await selectedByEmail(db, email) : null;
    return app ? { applicationId: app.id, email: app.email, via: "family" } : null;
  }
  return null;
}

export type WiredAccess =
  | { ok: true; tester: null; via: "open" }
  | { ok: true; tester: Tester; via: "tester" }
  | { ok: false; response: Response };

/**
 * The front door of every public wired-* function: the CORS preflight, then open when the quiz is live or the
 * request has the preview pass (wired-gate.ts, unchanged), else open for a selected tester while the pilot switch
 * is on, else the same dark 404 as before.
 */
export async function wiredAccess(req: Request, env: Env = denoEnv, db: Db = envDb(env)): Promise<WiredAccess> {
  if (req.method === "OPTIONS") return { ok: false, response: new Response(null, { headers: WIRED_PASS_CORS }) };
  if (wiredOpen(req, env)) return { ok: true, tester: null, via: "open" };
  if (pilotSwitchOn(env)) {
    let tester: Tester | null;
    try {
      tester = await testerFromPass(db, req.headers.get(PASS_HEADER));
    } catch (err) {
      console.error("wired-pilot-pass:", err instanceof Error ? err.message : String(err));
      return { ok: false, response: wiredJson(500, { error: "server_misconfigured" }) };
    }
    if (tester) return { ok: true, tester, via: "tester" };
  }
  return { ok: false, response: wiredJson(404, { error: "not_found" }) };
}

/** wiredGate's drop-in: null = carry on, otherwise the response to return. */
export async function wiredTesterGate(req: Request, env?: Env): Promise<Response | null> {
  const a = await wiredAccess(req, env);
  return a.ok ? null : a.response;
}
