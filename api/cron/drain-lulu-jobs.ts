// Vercel Cron entry point that drains lulu_jobs via the lulu-submit Supabase
// Edge Function.
//
// THIS IS THE SAFETY NET, not the primary path. stripe-webhook kicks lulu-submit
// directly on purchase, so an order normally reaches Lulu within seconds. This
// tick exists for everything that can go wrong with that kick: the webhook could
// not reach the function, Lulu was down, a required setting (LULU_SHIPPING_LEVEL,
// a product's file URLs) was missing and has since been filled in.
//
// Every 10 minutes. Lulu holds each job for a 48-hour production delay anyway,
// so a few minutes of queue latency changes nothing for the buyer; the short
// interval is about surfacing a stuck queue quickly, not speed.
//
// Auth chain, identical to drain-starter-deliveries:
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here.
//   2. We call the EF with the service-role key. lulu-submit runs at
//      verify_jwt=true AND checks the role claim, so the anon key will not do.
//
// Required env (Vercel project settings):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

interface EFResponse {
  processed?: number;
  submitted?: number;
  failed?: number;
  /** Jobs that have burned every retry. Non-zero needs a human. */
  stuck?: number;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("drain-lulu-jobs: CRON_SECRET env var not set");
    return new Response(
      JSON.stringify({ error: "Server misconfigured: CRON_SECRET missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("drain-lulu-jobs: unauthorized invocation attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    console.error("drain-lulu-jobs: SUPABASE_URL (and VITE_SUPABASE_URL) missing");
    return new Response(
      JSON.stringify({ error: "Server misconfigured: SUPABASE_URL missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!serviceRoleKey) {
    console.error("drain-lulu-jobs: SUPABASE_SERVICE_ROLE_KEY missing");
    return new Response(
      JSON.stringify({ error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const efUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/lulu-submit`;
  const startedAt = Date.now();
  let efRes: Response;
  try {
    efRes = await fetch(efUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      // No order_id: this is the drain mode.
      body: JSON.stringify({ source: "vercel-cron", invoked_at: new Date().toISOString() }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("drain-lulu-jobs: EF fetch threw:", message);
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

  // "Nothing to do" and "cannot do anything" must not look the same. Stuck jobs
  // are logged at error level so they surface rather than blend in.
  if (typeof efBody === "object" && (efBody.stuck ?? 0) > 0) {
    console.error(
      `drain-lulu-jobs: ${efBody.stuck} Lulu job(s) have exhausted their retries and need a human. ` +
        `See lulu_jobs.last_error, then Resubmit from /founder.`,
    );
  }

  console.log(
    `drain-lulu-jobs: EF returned status=${efRes.status} in ${elapsedMs}ms`,
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
