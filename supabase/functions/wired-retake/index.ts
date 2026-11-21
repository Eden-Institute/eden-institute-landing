// wired-retake: resolves a July yearly-retest link (Fearfully & Wonderfully Wired, spec 7.5) to what the quiz
// fills in: the child's nickname, the assumed grade (mom confirms or fixes it) and her email.
// Public POST { r }, DARK until WIRED_ENABLED. verify_jwt = false (config.toml).
// The link (wired-token purpose 'retake', signed with WIRED_LINK_SECRET) carries only ids; this answers only for
// the child it was signed for. _shared/wired-retake.ts has the rules.

import { wiredGate, wiredJson } from "../_shared/wired-gate.ts";
import { verifyWiredToken } from "../_shared/wired-token.ts";
import { retakeContext } from "../_shared/wired-retake.ts";
import { type Db } from "../_shared/wired-submit-flow.ts";

Deno.serve(async (req) => {
  const gate = wiredGate(req);
  if (gate) return gate;
  if (req.method !== "POST") return wiredJson(405, { error: "method_not_allowed" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: "body must be JSON" });
  }
  let grant;
  try {
    grant = await verifyWiredToken(body?.r, "retake");
  } catch (err) {
    console.error("wired-retake: token secret problem:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "server_misconfigured" });
  }
  if (!grant) return wiredJson(401, { error: "invalid_or_expired_link" });
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
  try {
    const ctx = await retakeContext(db, grant);
    return wiredJson(ctx.status === "ok" ? 200 : ctx.status === "unknown" ? 404 : 409, ctx);
  } catch (err) {
    console.error("wired-retake:", err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: "server_error" });
  }
});
