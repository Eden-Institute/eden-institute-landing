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
// A POST whose token names an email and a list but is signed by no key we hold
// (an old key, or tampering) is never honoured, but the founder gets one email per
// person, list and day so she can honor it by hand (2026-11-17, area 8 U2).
//
// verify_jwt = false (config.toml): called from email clients and browsers with no
// Supabase session. Security comes from the signed token, not a JWT.

import { checkUnsubToken, EMAIL_LISTS, type EmailList } from '../_shared/email-unsubscribe.ts';
import {
  badLinkAlert,
  badLinkAlertKey,
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

// 2026-11-17 (area 8 U2): tell the founder when a real-looking link fails its check on a
// POST, so a person who asked to leave is not silently ignored. Resend Idempotency-Key
// (badLinkAlertKey): one alert per person, list and UTC day. Never throws; the reply to
// the browser or mail client does not depend on it.
async function alertBadLink(email: string, list: EmailList, via: 'one_click' | 'form_post'): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
  const from = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';
  if (!resendKey) {
    console.error('unsubscribe: RESEND_API_KEY missing; could not send the bad-link alert');
    return;
  }
  try {
    const { subject, text } = badLinkAlert({ email, list, listName: EMAIL_LISTS[list], via });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': await badLinkAlertKey(email, list, Date.now()),
      },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    // 409 = this person's alert already went today (or is in flight): nothing to do.
    if (!res.ok && res.status !== 409) {
      console.error('unsubscribe: bad-link alert refused', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return;
    }
    await res.body?.cancel();
  } catch (e) {
    console.error('unsubscribe: bad-link alert failed', e instanceof Error ? e.message : String(e));
  }
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
      // unsubscribed_at is sent on purpose (2026-11-17, area 8 U3): merge-duplicates updates
      // only the columns sent, and the drips compare this time with when each email was
      // queued, so a family who left, came back and leaves AGAIN must get a fresh time.
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        list,
        source: 'one_click_unsubscribe',
        unsubscribed_at: new Date().toISOString(),
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
  const check = await checkUnsubToken(route.token);
  const parsed = check.ok ? { email: check.email, list: check.list } : null;

  if (route.kind === 'confirm') {
    if (!parsed) console.warn('unsubscribe: invalid or missing token', { method: req.method, reason: check.ok ? null : check.reason });
    return redirect(parsed ? confirmPageUrl(route.token) : resultPageUrl('invalid'));
  }

  if (!parsed) {
    const reason = check.ok ? null : check.reason;
    console.warn('unsubscribe: invalid or missing token', { method: req.method, kind: route.kind, reason });
    // A real-looking link that no key signs (2026-11-17, area 8 U2): the person asked
    // to leave and nothing is saved, so the founder hears about it. Never honoured
    // here: anyone could forge one.
    if (!check.ok && check.reason === 'bad_signature') {
      await alertBadLink(check.email, check.list, route.kind);
    }
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
