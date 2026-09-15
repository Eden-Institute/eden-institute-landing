// ── unsubscribe ──
//
// Public, per-list unsubscribe endpoint, with RFC 8058 one-click.
//
//   GET/HEAD /functions/v1/unsubscribe?token=...  → NEVER writes. 303 to the
//            confirm page https://edeninstitute.health/unsubscribe?token=...
//            (or ?status=invalid for a bad token). Link scanners fetch footer
//            links, so a GET that wrote was unsubscribing people (fixed 2026-09-15).
//   POST     form body token=...  (the confirm page's "Unsubscribe" button)
//            → verify, record, 303 to ?status=done | invalid | error
//   POST     ?token=... body List-Unsubscribe=One-Click (Gmail / Apple Mail,
//            from the List-Unsubscribe-Post header) → verify, record, 200.
//
// Routing lives in _shared/unsubscribe-request.ts (tested there). The pages are on
// edeninstitute.health (web/pages/unsubscribe.astro) because Supabase serves a
// text/html function response as text/plain, so HTML from here shows as source.
//
// The token is an HMAC over (email, list), see _shared/email-unsubscribe.ts. A valid
// token writes one row to public.email_list_unsubscribes; senders skip anyone with a
// row for that list. Bounces/complaints/global unsubscribes are a separate, global
// path (resend-webhook) and are untouched here.
//
// verify_jwt = false (config.toml): called from email clients and browsers with no
// Supabase session. Security comes from the signed token, not a JWT.

import { verifyUnsubToken, type EmailList } from '../_shared/email-unsubscribe.ts';
import {
  confirmPageUrl,
  readUnsubForm,
  resultPageUrl,
  routeUnsubRequest,
} from '../_shared/unsubscribe-request.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
};

function redirect(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { ...corsHeaders, Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

async function recordUnsubscribe(email: string, list: EmailList): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/email_list_unsubscribes`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        list,
        source: 'one_click_unsubscribe',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>');
      console.error('unsubscribe: insert failed', { status: res.status, body, list });
    }
    return res.ok;
  } catch (err) {
    console.error('unsubscribe: insert threw', err instanceof Error ? err.message : String(err));
    return false;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const form = req.method.toUpperCase() === 'POST' ? await readUnsubForm(req) : null;
  const route = routeUnsubRequest({ method: req.method, queryToken: url.searchParams.get('token'), form });

  if (route.kind === 'preflight') return new Response(null, { headers: corsHeaders });
  if (route.kind === 'method_not_allowed') {
    return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: 'GET, HEAD, POST, OPTIONS' } });
  }

  // Verifying needs no env beyond the signing key, and a GET never writes.
  const parsed = await verifyUnsubToken(route.token);

  if (route.kind === 'confirm') {
    if (!parsed) console.warn('unsubscribe: invalid or missing token', { method: req.method });
    return redirect(parsed ? confirmPageUrl(route.token) : resultPageUrl('invalid'));
  }

  if (!parsed) {
    console.warn('unsubscribe: invalid or missing token', { method: req.method, kind: route.kind });
    // One-click expects a 2xx; a non-2xx makes some mail clients show an error.
    if (route.kind === 'one_click') return new Response(null, { status: 200, headers: corsHeaders });
    return redirect(resultPageUrl('invalid'));
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('unsubscribe: missing env');
    if (route.kind === 'one_click') return new Response(null, { status: 500, headers: corsHeaders });
    return redirect(resultPageUrl('error'));
  }

  const ok = await recordUnsubscribe(parsed.email, parsed.list);

  if (route.kind === 'one_click') {
    // RFC 8058 one-click: a 200 is all the mail client needs.
    return new Response(null, { status: ok ? 200 : 500, headers: corsHeaders });
  }
  return redirect(resultPageUrl(ok ? 'done' : 'error'));
});
