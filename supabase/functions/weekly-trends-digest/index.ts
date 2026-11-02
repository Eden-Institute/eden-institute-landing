// weekly-trends-digest Edge Function
//
// Sends a weekly trends briefing to hello@edeninstitute.health every Friday.
// Unlike the daily digest (raw captures), this one TRANSLATES the data into
// week-over-week trends: what's growing, what's stalling, anomalies, and one
// recommended focus.
//
// Flow:
//   1. Triggered by Vercel cron Friday 14:00 UTC (08:00 America/Chicago CST).
//      Cron route at api/cron/weekly-trends-digest.ts calls this EF with
//      SUPABASE_SERVICE_ROLE_KEY in the Authorization header.
//   2. Claims the day in weekly_trends_runs (UNIQUE run_date, CT) via
//      _shared/digest-run-claim.ts. A sent week exits skipped="already_ran"; a
//      week left failed, or pending by a run that died, is taken over. The retry
//      pass (api/cron/weekly-trends-digest-retry.ts, Friday 14:37 UTC) relies on
//      this to finish a Friday the 14:00 run could not.
//   3. Calls weekly_trends_snapshot() RPC — this-week vs last-week aggregates
//      (leads by funnel/source, traffic, new visitors on sign-up pages, quiz),
//      testers/bots/unsubs excluded.
//   4. Computes deltas + a plain-language narrative (_shared/weekly-trends-report.ts,
//      pure and tested) and emails it via Resend.
//   5. UPDATEs the run row to status='sent' or 'failed'.
//
// Aggregate-only — no PII leaves the DB, and it never depends on any local
// tooling. Pure server-side, runs forever on the EF's service-role key.
//
// Env vars (Supabase EF secrets — all already set for notify-founder-digest):
//   RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   FOUNDER_EMAIL (default hello@), FROM_EMAIL (default The Eden Institute <hello@>).
//
// Public-callable: no (verify_jwt=true default; cron passes service_role JWT).

import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import { claimRun, WEEKLY_TRENDS_RUNS } from '../_shared/digest-run-claim.ts';
import { pgrstFetch } from '../_shared/pgrst-retry.ts';
import { buildEmail, ctDateString, type Snapshot } from '../_shared/weekly-trends-report.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// pgrstFetch repeats a gateway 504 on reads and PATCHes; the claim INSERT is
// sent once (a 504 there is resolved by re-reading the row, see the claim).
async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };
  return pgrstFetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal cron worker: only the service role (via the Vercel cron) may invoke.
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);

  let runId: string | null = null;
  try {
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('weekly-trends-digest: missing env vars', {
        hasResend: !!RESEND_API_KEY, hasSbUrl: !!SUPABASE_URL, hasSbKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json(500, { error: 'Server configuration error' });
    }

    const nowUtc = new Date();
    const runDate = ctDateString(nowUtc);

    // ── Claim the week ──
    // One run sends each Friday. A week left failed, or pending by a run that
    // died, is taken over (see _shared/digest-run-claim.ts).
    const claim = await claimRun((p, i) => sbFetch(p, i), WEEKLY_TRENDS_RUNS, { date: runDate, now: nowUtc });
    if (claim.kind === 'skip') {
      console.log(`weekly-trends-digest: ${runDate} ${claim.reason} (row status ${claim.status}), skipping`);
      return json(200, { skipped: claim.reason, status: claim.status, run_date: runDate });
    }
    if (claim.kind === 'error') {
      console.error('weekly-trends-digest: could not claim weekly_trends_runs row', claim.detail);
      return json(500, { error: 'Failed to claim weekly_trends_runs row', detail: claim.detail });
    }
    if (claim.takeover) {
      console.log(`weekly-trends-digest: took over ${runDate} (previous run ${claim.takeover})`);
    }
    runId = claim.id;

    // ── Snapshot RPC ──
    const rpcRes = await sbFetch('/rest/v1/rpc/weekly_trends_snapshot', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!rpcRes.ok) {
      const errText = await rpcRes.text().catch(() => '');
      console.error('weekly-trends-digest: RPC failed', rpcRes.status, errText);
      await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: `RPC failed: ${errText.slice(0, 500)}`, completed_at: new Date().toISOString() }),
      });
      return json(500, { error: 'RPC fetch failed' });
    }
    const snapshot: Snapshot = await rpcRes.json();

    // ── Build + send (always send — the weekly rhythm is the point) ──
    const { subject, html, text } = buildEmail(snapshot, runDate);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: FOUNDER_EMAIL, subject, html, text }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('weekly-trends-digest: Resend send failed', resendRes.status, errText);
      await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', leads_this_week: snapshot.leads.this, error_message: `Resend ${resendRes.status}: ${errText.slice(0, 500)}`, completed_at: new Date().toISOString() }),
      });
      return json(502, { error: 'Resend send failed', detail: errText });
    }

    const resendData = await resendRes.json().catch(() => ({}));
    console.log(`weekly-trends-digest: sent ${runDate}`, JSON.stringify({ resendId: resendData?.id, leads: snapshot.leads.this }));

    await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sent', leads_this_week: snapshot.leads.this, completed_at: new Date().toISOString() }),
    });

    return json(200, { sent: true, run_date: runDate, leads_this_week: snapshot.leads.this, resend_id: resendData?.id ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('weekly-trends-digest: unhandled error', msg, err);
    // Mark the claimed run failed so the retry pass takes it over at once rather
    // than waiting for the pending row to go stale.
    if (runId) {
      await sbFetch(`/rest/v1/weekly_trends_runs?id=eq.${runId}&status=eq.pending`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_message: `Unhandled: ${msg.slice(0, 500)}`, completed_at: new Date().toISOString() }),
      }).then((r) => r.body?.cancel(), () => {});
    }
    return json(500, { error: 'Unhandled exception', detail: msg });
  }
});
