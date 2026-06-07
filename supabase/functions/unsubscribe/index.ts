// ── unsubscribe ──
//
// Public, per-list, one-click unsubscribe endpoint (RFC 8058).
//
//   GET  /functions/v1/unsubscribe?token=...   → verify, record, show a small
//                                                 confirmation page (footer link)
//   POST /functions/v1/unsubscribe?token=...   → one-click (List-Unsubscribe-Post),
//                                                 verify, record, 200 (no body needed)
//
// The token is an HMAC over (email, list) — see _shared/email-unsubscribe.ts.
// A valid token writes one row to public.email_list_unsubscribes; senders skip
// anyone with a row for that list. Bounces/complaints/global unsubscribes are a
// separate, global path (resend-webhook) and are untouched here.
//
// verify_jwt = false (config.toml) — called from email clients / browsers with
// no Supabase session. Security comes from the signed token, not a JWT.

import {
  verifyUnsubToken,
  EMAIL_LISTS,
  type EmailList,
} from '../_shared/email-unsubscribe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function page(title: string, message: string, status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — The Eden Institute</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;">
<tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:#FFFFFF;border:1px solid #E8E3DA;">
<tr><td style="background-color:#2C3E2D;padding:32px 20px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:13px;font-weight:bold;letter-spacing:4px;color:#C5A44E;text-transform:uppercase;">THE EDEN INSTITUTE</span>
</td></tr>
<tr><td style="padding:40px 40px 44px;text-align:center;">
<h1 style="font-family:Georgia,serif;font-size:24px;color:#2C3E2D;margin:0 0 16px;">${title}</h1>
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#3D3832;margin:0 0 24px;">${message}</p>
<a href="https://edeninstitute.health" style="font-family:Georgia,serif;font-size:14px;color:#5C7A5C;text-decoration:underline;">Return to edeninstitute.health</a>
</td></tr>
<tr><td style="background-color:#2C3E2D;padding:18px 20px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:12px;color:#C5A44E;font-style:italic;">Back to Eden. Back to Truth.</span>
</td></tr>
</table></td></tr></table></body></html>`;
  return new Response(html, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function recordUnsubscribe(email: string, list: EmailList): Promise<boolean> {
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
    console.error('unsubscribe: insert failed', { status: res.status, body, email, list });
  }
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('unsubscribe: missing env');
    return page('Something went wrong', 'We could not process your request right now. Please try again later, or email hello@edeninstitute.health.', 500);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const isPost = req.method === 'POST';

  const parsed = await verifyUnsubToken(token);
  if (!parsed) {
    // One-click POST expects a 2xx; still return 200 so the mail client doesn't
    // surface a scary error, but log it. GET shows a gentle message.
    console.warn('unsubscribe: invalid or missing token', { method: req.method });
    if (isPost) return new Response(null, { status: 200, headers: corsHeaders });
    return page(
      'Link expired',
      'This unsubscribe link is invalid or has expired. You can unsubscribe from any more recent email, or email hello@edeninstitute.health and we will take care of it.',
      200,
    );
  }

  const ok = await recordUnsubscribe(parsed.email, parsed.list);
  const listLabel = EMAIL_LISTS[parsed.list];

  if (isPost) {
    // RFC 8058 one-click: a 200 is all the mail client needs.
    return new Response(null, { status: ok ? 200 : 500, headers: corsHeaders });
  }

  if (!ok) {
    return page('Something went wrong', 'We could not process your request right now. Please try again later, or email hello@edeninstitute.health.', 500);
  }

  return page(
    'You’re unsubscribed',
    `You’ve been removed from <strong>${listLabel}</strong>. You won’t receive any more of those. If this was a mistake, just email hello@edeninstitute.health and we’ll add you back.`,
    200,
  );
});
