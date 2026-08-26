// Vercel Cron entry point that drains starter_deliveries via the starter-fulfill
// Supabase Edge Function.
//
// THIS IS THE SAFETY NET, not the primary path. stripe-webhook kicks
// starter-fulfill directly on purchase, so a buyer normally has their files
// within seconds. This tick exists for everything that can go wrong with that
// kick: the webhook could not reach the function, the isolate died mid-stamp,
// Resend was down, Storage 500'd.
//
// It is deliberately frequent (every 10 minutes). A buyer of a $39 instant
// download who is still waiting an hour later has effectively not received what
// they paid for, so the recovery window has to be short.
//
// Auth chain, identical to drain-nurture-queue:
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here
//      so the endpoint cannot be triggered from arbitrary IPs.
//   2. We call the EF with the service-role key. starter-fulfill runs at
//      verify_jwt=true AND checks the role claim, so the anon key will not do.
//
// Required env (Vercel project settings):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

interface EFResponse {
  processed?: number;
  sent?: number;
  failed?: number;
  /** Deliveries that have burned every retry. Non-zero needs a human. */
  stuck?: number;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("drain-starter-deliveries: CRON_SECRET env var not set");
    return new Response(
      JSON.stringify({ error: "Server misconfigured — CRON_SECRET missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("drain-starter-deliveries: unauthorized invocation attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Name the missing variable rather than listing all three. A combined message
  // cost three diagnosis rounds on the partner-sample endpoint in August.
  if (!supabaseUrl) {
    console.error("drain-starter-deliveries: SUPABASE_URL (and VITE_SUPABASE_URL) missing");
    return new Response(
      JSON.stringify({ error: "Server misconfigured — SUPABASE_URL missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!serviceRoleKey) {
    console.error("drain-starter-deliveries: SUPABASE_SERVICE_ROLE_KEY missing");
    return new Response(
      JSON.stringify({ error: "Server misconfigured — SUPABASE_SERVICE_ROLE_KEY missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const efUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/starter-fulfill`;
  const startedAt = Date.now();
  let efRes: Response;
  try {
    efRes = await fetch(efUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      // No session_id: this is the drain mode.
      body: JSON.stringify({ source: "vercel-cron", invoked_at: new Date().toISOString() }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("drain-starter-deliveries: EF fetch threw:", message);
    return new Response(
      JSON.stringify({ error: `EF fetch failed: ${message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const elapsedMs = Date.now() - startedAt;
  let efBody: EFResponse | string;
  const contentType = efRes.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      efBody = await efRes.json();
    } catch {
      efBody = await efRes.text();
    }
  } else {
    efBody = await efRes.text();
  }

  // A drain that reports "nothing to do" is indistinguishable from one that
  // CANNOT do anything, which is how two scheduled tasks sat dead for three weeks
  // in August 2026 while reporting success every Monday. Stuck deliveries are
  // therefore logged at error level so they surface rather than blend in.
  if (typeof efBody === "object" && (efBody.stuck ?? 0) > 0) {
    console.error(
      `drain-starter-deliveries: ${efBody.stuck} delivery/deliveries have exhausted their retries ` +
        `and need a human. Query starter_delivery_attempts by session id.`,
    );
  }

  console.log(
    `drain-starter-deliveries: EF returned status=${efRes.status} in ${elapsedMs}ms`,
    typeof efBody === "object" ? JSON.stringify(efBody) : efBody,
  );

  return new Response(
    JSON.stringify({
      cron_status: efRes.ok ? "ok" : "ef_error",
      ef_status: efRes.status,
      ef_elapsed_ms: elapsedMs,
      ef_body: efBody,
    }),
    {
      status: efRes.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export const config = { runtime: "edge" };
