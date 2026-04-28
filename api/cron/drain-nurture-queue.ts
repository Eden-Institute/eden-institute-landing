// PR #55 v3.33+ — Vercel Cron entry point that drains nurture_email_queue
// via the nurture-emails Supabase Edge Function. Runs every 15 min per
// vercel.json crons[0].schedule.
//
// Lock #48 implementation: this is the SCHEDULER side of the durable
// nurture pattern. The QUEUE PRODUCER side (resend-waitlist EF rewrite
// to INSERT INTO nurture_email_queue instead of using Resend
// `scheduled_at`) lands in PR #53.
//
// Auth chain:
//   1. Vercel Cron auto-injects `Authorization: Bearer ${CRON_SECRET}` on
//      cron-triggered requests. We verify that header matches the env var.
//      This prevents anyone hitting /api/cron/drain-nurture-queue from
//      arbitrary IPs from triggering the drain.
//   2. We then call the Supabase EF with the service-role key in its own
//      Authorization header. The EF has verify_jwt=false (it's an internal
//      cron worker) so the service-role key is not strictly required for
//      auth, but we send it anyway so the EF's supabase-js client picks
//      it up and runs queries with full RLS bypass.
//
// Required env vars (set in Vercel project settings):
//   CRON_SECRET                  random string, must match the value Vercel injects
//   SUPABASE_URL                 e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    full service-role JWT from Supabase
//
// Observability: returns the EF response JSON to Vercel function logs.
// Production logs visible at vercel.com/eden-b55b0b13/eden-institute-landing/logs.

interface EFResponse {
  success?: boolean;
  queue?: { processed: number; sent: number; failed: number };
  legacy_email5?: { sent: number; candidates: number };
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  // 1. Auth: verify CRON_SECRET
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("drain-nurture-queue: CRON_SECRET env var not set");
    return new Response(
      JSON.stringify({ error: "Server misconfigured — CRON_SECRET missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("drain-nurture-queue: unauthorized invocation attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Validate Supabase env
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("drain-nurture-queue: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return new Response(
      JSON.stringify({ error: "Server misconfigured — Supabase env vars missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Invoke the EF
  const efUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/nurture-emails`;
  const startedAt = Date.now();
  let efRes: Response;
  try {
    efRes = await fetch(efUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "vercel-cron", invoked_at: new Date().toISOString() }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("drain-nurture-queue: EF fetch threw:", message);
    return new Response(
      JSON.stringify({ error: `EF fetch failed: ${message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
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

  console.log(
    `drain-nurture-queue: EF returned status=${efRes.status} in ${elapsedMs}ms`,
    typeof efBody === "object" ? JSON.stringify(efBody) : efBody
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
    }
  );
}

// Vercel Edge Runtime config — keeps cold start small (no Node deps needed).
export const config = { runtime: "edge" };
