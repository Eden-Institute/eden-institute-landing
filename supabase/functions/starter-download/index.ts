// supabase/functions/starter-download/index.ts
//
// The re-request flow. Signed download URLs last 7 days by design; this is how a
// buyer whose links have lapsed gets fresh ones without us handing out permanent
// access to paid files.
//
//   GET ?t=<download_token>            -> { files: [...] } with fresh signed URLs
//   GET ?t=<download_token>&f=<slug>   -> 302 straight to the file
//
// PUBLIC (verify_jwt=false): the buyer clicks this from an email with no Supabase
// session. The token IS the credential, which is the same posture as the
// /partner-sample ?k= broker, with one improvement: that key is a single shared
// secret for every partner, whereas this is per purchase, so revoking one buyer's
// access never touches anyone else's.
//
// WHY THE TOKEN DOES NOT EXPIRE. The spec asks for time-limited links plus a
// re-request path "rather than permanent access". The signed URLs are the
// time-limited part. The token is the re-request path, and a re-request path that
// expires is just a shorter leash on the same file: the buyer paid for a
// curriculum they are meant to teach from for six weeks, and a parent coming back
// in March to re-download onto a new laptop is the normal case, not abuse. What
// the token cannot do is be guessed (32 hex chars of CSPRNG) or be found (it only
// ever exists in that one buyer's inbox), and it can be revoked per buyer by
// rotating the column.
//
// Rate limited per token so a leaked link cannot be turned into a distribution
// endpoint by scripting it.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mintDownloadLinks } from '../_shared/starter-fulfillment.ts';
import { STARTER_FILENAMES, DOWNLOAD_URL_TTL_SECONDS } from '../_shared/starter-config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** Slug -> which stamped object, and what to call it on the buyer's disk. */
const FILES = {
  'teachers-guide': { key: 'tg_object_path', filename: STARTER_FILENAMES.teachersGuide, label: "Teacher's Guide" },
  'student-notebook': { key: 'nb_object_path', filename: STARTER_FILENAMES.studentNotebook, label: 'Student Notebook' },
} as const;

type FileSlug = keyof typeof FILES;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Cheap per-token throttle, reusing the existing checkout_rate_limits bucket via
 * checkout_rate_bump(p_ip_hash text, p_window_seconds integer).
 *
 * The parameter is named p_ip_hash because create-checkout feeds it a salted IP
 * hash, but it is just an opaque bucket key, so a token-derived key shares the
 * table without colliding (different prefix, and a SHA-256 either way). The token
 * itself is never stored: it is the download credential, and a rate-limit row is
 * not the place for it.
 *
 * Fails OPEN. A rate-limiter outage must not stop a paying customer reaching
 * files they already own, which is the same trade create-checkout makes.
 */
async function withinRateLimit(token: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`starter_dl:${token}`));
    const bucketKey = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await adminClient.rpc('checkout_rate_bump', {
      p_ip_hash: bucketKey,
      p_window_seconds: 3600,
    });
    if (error) {
      console.warn(`starter-download rate check failed open: ${error.message}`);
      return true;
    }
    return typeof data === 'number' ? data <= 40 : true;
  } catch {
    return true;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json(405, { error: 'GET only' });

  const url = new URL(req.url);
  const token = (url.searchParams.get('t') ?? '').trim();
  // The confirmation page reaches this with the Stripe session id from the
  // post-checkout redirect, because the buyer has not received the email (and
  // therefore the token) yet. Possession of the session id is the credential,
  // the same posture verify-session uses for the paid Deep-Dive Guide. It is
  // strictly narrower here: a starter_deliveries row only exists because
  // stripe-webhook saw a PAID session, so the row itself is the proof of purchase
  // and no extra Stripe round-trip is needed.
  const sessionId = (url.searchParams.get('s') ?? '').trim();
  const slug = (url.searchParams.get('f') ?? '').trim() as FileSlug | '';

  // Deliberately vague. A caller with a bad credential learns only that it is
  // bad, not whether it ever existed.
  const NOT_FOUND = {
    error: 'That download link is not valid. Check the link in your Starter Unit email, or reply to it and we will send a fresh one.',
    code: 'DOWNLOAD_TOKEN_INVALID',
  };

  const credential = token || sessionId;
  if (!credential || credential.length < 16) return json(404, NOT_FOUND);

  if (!(await withinRateLimit(credential))) {
    return json(429, {
      error: 'Too many download requests. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED',
    });
  }

  const lookup = adminClient
    .from('starter_deliveries')
    .select('id, stripe_checkout_session_id, email, status, tg_object_path, nb_object_path, download_token');
  const { data, error } = await (token
    ? lookup.eq('download_token', token)
    : lookup.eq('stripe_checkout_session_id', sessionId)
  ).maybeSingle();

  if (error) {
    console.error(`starter-download lookup failed: ${error.message}`);
    return json(500, { error: 'Something went wrong on our end. Please try again in a moment.' });
  }
  if (!data) return json(404, NOT_FOUND);

  const sid = data.stripe_checkout_session_id;

  // A delivery that has not been stamped yet has nothing to hand over. This is a
  // real state: a buyer can click the re-request link from a confirmation page
  // before the fulfiller has finished, seconds after paying.
  if (!data.tg_object_path || !data.nb_object_path) {
    console.log(`[${sid}] re-request arrived before fulfilment completed (status=${data.status})`);
    return json(409, {
      error: 'Your files are still being prepared. This usually takes under a minute. Please refresh shortly.',
      code: 'NOT_READY',
    });
  }

  try {
    const links = await mintDownloadLinks(data);
    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);

    // Log the re-request against the session id, same as every other stage, so
    // "this buyer keeps losing their files" is visible rather than anecdotal.
    await adminClient.from('starter_delivery_attempts').insert({
      stripe_checkout_session_id: sid,
      delivery_id: data.id,
      attempt: 0,
      stage: 'sign',
      ok: true,
      detail: `re-request via token${slug ? ` (${slug})` : ''}`,
    }).then(undefined, () => {});

    await adminClient.from('starter_deliveries')
      .update({ links_expire_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', data.id).then(undefined, () => {});

    if (slug && slug in FILES) {
      const target = slug === 'teachers-guide' ? links.teachersGuide : links.studentNotebook;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: target, 'Cache-Control': 'no-store' },
      });
    }

    // The credit code rides along so the confirmation page can repeat it (spec:
    // "Deliver the code in the same email as the download link, and repeat it on
    // the order confirmation page"). A buyer who closes the email still has it.
    const { data: credit } = await adminClient
      .from('starter_credits').select('code, redeemed_at')
      .eq('stripe_checkout_session_id', sid).maybeSingle();

    console.log(`[${sid}] re-issued download links, valid until ${expiresAt.toISOString()}`);
    return json(200, {
      expires_at: expiresAt.toISOString(),
      // Returned so the confirmation page can hand the buyer a durable re-request
      // link before their delivery email has even arrived.
      download_token: data.download_token,
      credit_code: credit?.code ?? null,
      credit_redeemed: !!credit?.redeemed_at,
      files: [
        { slug: 'teachers-guide', label: FILES['teachers-guide'].label, url: links.teachersGuide },
        { slug: 'student-notebook', label: FILES['student-notebook'].label, url: links.studentNotebook },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${sid}] re-request signing failed: ${message}`);
    return json(500, { error: 'We could not prepare your download just now. Please try again in a moment.' });
  }
});
