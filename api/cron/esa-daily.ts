// Vercel Cron entry point for the ESA invoice daily pass (reminders + unpaid alerts).
// Added 2026-09-15. Once a day it calls esa-payment { action: "daily" }, which:
//   - sends the ONE family reminder for an invoice unpaid after 14 days (founder 2026-09-14),
//   - emails the founder about any invoice still unpaid after 30 days (once per invoice).
//
// Auth chain, identical to drain-lulu-jobs:
//   1. Vercel Cron injects `Authorization: Bearer ${CRON_SECRET}`; verified here.
//   2. We call the EF with the service-role key; esa-payment runs at verify_jwt=true and checks the role.
//
// Required env (Vercel project settings): CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("esa-daily: CRON_SECRET env var not set");
    return new Response(JSON.stringify({ error: "Server misconfigured: CRON_SECRET missing" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${cronSecret}`) {
    console.warn("esa-daily: unauthorized invocation attempt");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("esa-daily: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return new Response(JSON.stringify({ error: "Server misconfigured: Supabase env missing" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  try {
    const efRes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/esa-payment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "daily", source: "vercel-cron", invoked_at: new Date().toISOString() }),
    });
    const body = await efRes.text();
    if (!efRes.ok) console.error("esa-daily: esa-payment returned", efRes.status, body.slice(0, 300));
    return new Response(body, { status: efRes.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("esa-daily: fetch to esa-payment failed", message);
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
}
