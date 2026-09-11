// Site → Foundations Course click logger + redirect.
//
// WHY THIS EXISTS. The Foundations Course ($97) sells on LearnWorlds, which
// runs its own Stripe and never talks to ours, so a click from this site to
// learn.edeninstitute.health has been completely invisible: no row anywhere,
// no way to tell whether the course CTAs on the courses page, the Results
// page, the Deep-Dive guide, the Tier 2 waitlist card or the homepage journey
// CTA do anything at all. Resend logs the EMAIL clicks (public.email_events)
// and course_sales will hold purchases once the LearnWorlds webhook is wired,
// but the middle of the funnel, the site itself, had nothing. This is the
// only way to count site → course clicks.
//
// Every site link to the course now points at /go/course?src=<page>
// (vercel.json rewrites that to this function). It writes one row to
// public.outbound_clicks and 302s to the course carrying UTM tags, so
// LearnWorlds' own analytics can attribute the visit too. The founder
// dashboard reads the rows through the founder_course_funnel RPC.
//
// THE LOG MUST NEVER BLOCK OR DELAY THE REDIRECT. A visitor who clicked
// "Enroll" must land on the course whether Supabase is up, slow or down. So:
//   - on the Edge runtime the insert is handed to context.waitUntil, which
//     keeps it running AFTER the 302 has been returned (zero added latency);
//   - if waitUntil is somehow absent, the insert is raced against a short
//     timeout so the worst case is a brief delay, never a hang;
//   - every failure path is caught and logged, never thrown.
// Missing env vars are logged and the redirect still happens; a broken counter
// is a dashboard problem, not a customer problem.
//
// Required env (Vercel project settings). Both are ALREADY SET for
// api/partner-sample.ts and the api/cron/* functions; nothing new to add:
//   SUPABASE_URL (or VITE_SUPABASE_URL)   e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY             outbound_clicks is RLS-walled, service role only

const COURSE_URL = 'https://learn.edeninstitute.health/course/back-to-eden1';

// `src` is the page/CTA that sent the visitor. Anything outside this shape is
// recorded as 'unknown' rather than stored: the value lands in a database and
// on the dashboard, so it is never written through unfiltered.
const SRC_RE = /^[a-z0-9_-]{1,40}$/;

// Upper bound on the fallback path only (no waitUntil). Long enough for a
// normal PostgREST insert, short enough that a stalled Supabase cannot make
// the click feel broken.
const LOG_TIMEOUT_MS = 1500;

/** Vercel Edge passes this as the second handler argument. Typed locally so
 *  the file has no dependency on @vercel/edge (not installed in this repo). */
interface EdgeContext {
  waitUntil?: (promise: Promise<unknown>) => void;
}

async function logClick(req: Request, url: URL, source: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl ? 'SUPABASE_URL or VITE_SUPABASE_URL' : null,
      !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean).join(', ');
    console.error(`go/course: missing env ${missing}; click not logged`);
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/outbound_clicks`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        target: 'course',
        source,
        referer: req.headers.get('referer'),
        path: `${url.pathname}${url.search}`,
        user_agent: req.headers.get('user-agent'),
      }),
      signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`go/course: insert failed ${res.status} for src=${source}`);
    }
  } catch (err) {
    console.error('go/course: insert threw:', err instanceof Error ? err.message : String(err));
  }
}

export default async function handler(req: Request, context?: EdgeContext): Promise<Response> {
  const url = new URL(req.url);
  const rawSrc = url.searchParams.get('src') ?? '';
  const source = SRC_RE.test(rawSrc) ? rawSrc : 'unknown';

  const pending = logClick(req, url, source);
  if (context && typeof context.waitUntil === 'function') {
    context.waitUntil(pending);
  } else {
    // No waitUntil: give the insert a bounded head start, then go regardless.
    // logClick never rejects (everything inside is caught), so this cannot throw.
    await Promise.race([pending, new Promise<void>((r) => setTimeout(r, LOG_TIMEOUT_MS))]);
  }

  const dest = new URL(COURSE_URL);
  dest.searchParams.set('utm_source', 'edeninstitute.health');
  dest.searchParams.set('utm_medium', 'site');
  dest.searchParams.set('utm_campaign', 'foundations');
  dest.searchParams.set('utm_content', source);

  // 302, never 301: a cached permanent redirect would skip this function and
  // the click would go uncounted for as long as the browser remembered it.
  return new Response(null, {
    status: 302,
    headers: {
      Location: dest.toString(),
      'Cache-Control': 'no-store',
    },
  });
}

export const config = { runtime: 'edge' };
