// wired-cron: the Wired quiz's daily jobs (spec section 8; W8 today, W9 adds observer reminders and the
// observer deletion sweep). Vercel cron (api/cron/wired-cron.ts) once a day at 8 AM Central.
// verify_jwt = true and service role only (config.toml).
//
// W8: the yearly check-in (spec 7.5, answer 35). On July 1 (Central) it queues one 'july' position 1 row
// per family with a child whose latest results are from the quiz year that just ended; on July 15, one
// position 2 row per such family (the drain drops any child already retested and skips the family when
// none is left). One row per family per date, so a re-run the same day adds nothing. The drain
// (wired-pdf -> _shared/wired-email-drain.ts) sends them through the opt-out check and the one-a-day guard.
//
// Body (Lane 2 checks): { as_of?: ISO date-time, dry_run?: boolean }.

import { isServiceRoleRequest, serviceRoleRequired } from "../_shared/require-service-role.ts";
import { WIRED_CORS, wiredJson } from "../_shared/wired-gate.ts";
import { type Db } from "../_shared/wired-submit-flow.ts";
import { queueJuly } from "../_shared/wired-july.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: WIRED_CORS });
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(WIRED_CORS);
  const db: Db = { url: Deno.env.get("SUPABASE_URL") ?? "", key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" };
  const body = await req.json().catch(() => ({})) as { as_of?: string; dry_run?: boolean };
  const asOf = body.as_of && !Number.isNaN(Date.parse(body.as_of)) ? new Date(body.as_of) : new Date();
  try {
    const july = await queueJuly(db, asOf, body.dry_run === true);
    return wiredJson(200, { ok: true, as_of: asOf.toISOString(), july });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("wired-cron failed:", msg);
    return wiredJson(500, { ok: false, error: msg.slice(0, 300) });
  }
});
