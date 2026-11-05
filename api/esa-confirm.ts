// /esa/confirm: the founder's ESA "Confirm paid" page, served from edeninstitute.health.
// Added 2026-11-05 (punch #446).
//
// WHY THIS EXISTS. The payment email used to link straight to
// https://<project>.supabase.co/functions/v1/esa-payment-confirm. Supabase rewrites a
// text/html function response on that domain to `Content-Type: text/plain` and adds
// `Content-Security-Policy: default-src 'none'; sandbox`, so the founder saw the page's
// raw source and no button (2026-11-04 8:20 PM, the first real ESA payment). Verified
// 2026-11-05 with a harmless invalid-token GET: text/plain + that CSP. Same cause as the
// unsubscribe and preorder-response moves of 2026-09-15.
//
// WHAT IT DOES. vercel.json rewrites /esa/confirm to this route, and it relays the request,
// unchanged, to esa-payment-confirm, then hands back the page that function built with
// its OWN status and body, but with headers set here: text/html, no sandbox. Nothing
// about the confirm itself moved; the function still owns every check and the one
// transaction:
//   GET  ?t=<token>     shows the invoice and one Confirm paid button. Never writes, so a
//                       link scanner that fetches the email link cannot mark anything paid.
//   POST form t=<token> the button. The form has no action, so it posts back to this same
//                       address, and the function marks the invoice paid and fulfils it.
// Only GET and POST are relayed; anything else gets 405 here and never reaches the function.
//
// The single upstream URL is fixed in code, so this is not an open proxy. The function
// runs at verify_jwt = false (config.toml), so no key is sent from here.
//
// Timing: real Confirm POSTs took 3.8 s and 1.3 s (2026-11-04). The relay gives up after
// 20 s, inside the Edge runtime's 25 s first-byte limit, and says how to check safely.
//
// Env (Vercel): SUPABASE_URL or VITE_SUPABASE_URL. Falls back to the project URL that
// vercel.json already hardcodes for /go/deep-dive and /preorder-response.

const DEFAULT_SUPABASE_URL = 'https://noeqztssupewjidpvhar.supabase.co';
const FUNCTION_PATH = '/functions/v1/esa-payment-confirm';
export const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * The page is built by our own function and every value in it is escaped there
 * (_shared/html-escape.ts). It has inline styles, no scripts, no images, and one form
 * that posts back to this same address.
 */
export const PAGE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function notice(status: number, title: string, text: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title}</title></head>
<body style="margin:0;background:#FAF6EE;font-family:Georgia,serif;color:#1E1E14">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #E8D5A3;padding:28px 30px;line-height:1.6">
<p style="font-size:20px;font-weight:bold;color:#2B3A1E;margin:0 0 14px">Eden's Table · ESA payment</p><p>${text}</p></div></body></html>`;
  return new Response(html, { status, headers: PAGE_HEADERS });
}

export default async function handler(req: Request): Promise<Response> {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return notice(405, 'Not allowed', 'Not allowed.');
  }

  const base = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const t = new URL(req.url).searchParams.get('t');
  const upstreamUrl = `${base}${FUNCTION_PATH}${t ? `?t=${encodeURIComponent(t)}` : ''}`;

  // A plain AbortController + timer rather than AbortSignal.timeout(), which not every
  // runtime this file runs in (Vercel Edge, the jsdom test runner) is guaranteed to have.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: 'text/html', 'User-Agent': 'edeninstitute-esa-confirm' };
  const init: RequestInit = { method, headers, signal: abort.signal };
  if (method === 'POST') {
    headers['Content-Type'] = req.headers.get('content-type') ?? 'application/x-www-form-urlencoded';
    init.body = await req.text();
  }

  let upstream: Response;
  let body: string;
  try {
    upstream = await fetch(upstreamUrl, init);
    body = await upstream.text();
  } catch (e) {
    console.error('esa-confirm: could not reach esa-payment-confirm:', e instanceof Error ? e.message : String(e));
    return notice(
      502,
      'Could not reach the payment system',
      method === 'POST'
        ? 'We could not hear back from the payment system. Open the link in the email again: if the payment went through it will say Already done, and if not, the Confirm paid button will still be there.'
        : 'We could not reach the payment system just now. Please open the link in the email again in a minute.',
    );
  } finally {
    clearTimeout(timer);
  }

  return new Response(body, { status: upstream.status, headers: PAGE_HEADERS });
}

export const config = { runtime: 'edge' };
