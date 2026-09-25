// supabase/functions/book-download/index.ts
//
// Back to Eden PDF downloads (2026-09-25).
//
//   GET ?t=<download_token>          -> { title, filename, pages, url }  (from the email link)
//   GET ?s=<checkout_session_id>     -> the same, for the thank-you page right after paying
//   add &go=1                        -> 302 straight to the file instead of JSON
//
// PUBLIC (verify_jwt=false): the buyer arrives from an email or from Stripe with no
// Supabase session. The token (64 hex, CSPRNG) or the Checkout Session id (only
// ever shown to the payer) is the credential. The signed URL it returns lasts one
// hour; the token itself does not expire, for the reason starter-download gives: a
// reader re-downloading onto a new device months later is the normal case.
//
// Stops working when the order is refunded. Rate limited per credential so a
// leaked link cannot become a distribution endpoint.
//
// 409 NOT_READY: the session is paid but stripe-webhook has not written the row
// yet (it usually has within a couple of seconds). The page polls on that.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BOOK_BUCKET, bookDigitalBySku, isDownloadToken } from '../_shared/book-shop.ts';

const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Same header list as every other public function (see starter-download for the
// outage a shorter list caused).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const SIGNED_URL_SECONDS = 60 * 60;
const MAX_PER_HOUR = 30;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Per-credential hourly cap through the shared checkout_rate_bump counter. Fails open. */
async function withinRateLimit(credential: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`book_dl:${credential}`));
    const key = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await adminClient.rpc('checkout_rate_bump', { p_ip_hash: key, p_window_seconds: 3600 });
    if (error) {
      console.warn(`book-download rate check failed open: ${error.message}`);
      return true;
    }
    return typeof data === 'number' ? data <= MAX_PER_HOUR : true;
  } catch {
    return true;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json(405, { error: 'GET only' });

  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  const sessionId = url.searchParams.get('s');
  const go = url.searchParams.get('go') === '1';

  let column: 'download_token' | 'stripe_checkout_session_id';
  let credential: string;
  if (isDownloadToken(token)) {
    column = 'download_token';
    credential = token;
  } else if (typeof sessionId === 'string' && /^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    column = 'stripe_checkout_session_id';
    credential = sessionId;
  } else {
    return json(400, { error: 'This download link is not complete. Please use the button in your email.', code: 'BAD_LINK' });
  }

  if (!(await withinRateLimit(credential))) {
    return json(429, { error: 'Too many downloads in the last hour. Please try again a little later.', code: 'RATE_LIMITED' });
  }

  const { data: row, error } = await adminClient
    .from('book_downloads')
    .select('id, sku, order_id, stripe_checkout_session_id, download_count')
    .eq(column, credential)
    .maybeSingle();
  if (error) {
    console.error(`book-download lookup failed: ${error.message}`);
    return json(500, { error: 'Something went wrong on our side. Please try again in a minute.', code: 'SERVER' });
  }
  if (!row) {
    return column === 'stripe_checkout_session_id'
      ? json(409, { error: 'Your download is being prepared.', code: 'NOT_READY' })
      : json(404, { error: 'We could not find this download. Reply to your email and we will sort it out.', code: 'NOT_FOUND' });
  }

  // Refunded orders lose access.
  const { data: order } = await adminClient
    .from('orders')
    .select('status')
    .eq('stripe_checkout_session_id', row.stripe_checkout_session_id)
    .maybeSingle();
  if (order?.status === 'refunded' || order?.status === 'cancelled') {
    return json(410, { error: 'This order was refunded, so the download is no longer available.', code: 'REFUNDED' });
  }

  const book = bookDigitalBySku(row.sku);
  if (!book) {
    console.error(`book-download: row ${row.id} has unknown sku '${row.sku}'`);
    return json(500, { error: 'Something went wrong on our side. Please reply to your email.', code: 'SERVER' });
  }

  const { data: signed, error: signErr } = await adminClient.storage
    .from(BOOK_BUCKET)
    .createSignedUrl(book.path, SIGNED_URL_SECONDS, { download: book.filename });
  if (signErr || !signed?.signedUrl) {
    console.error(`book-download: could not sign ${book.path}: ${signErr?.message ?? 'no url'}`);
    return json(503, { error: 'Your file is not available right this minute. Please try again shortly, or reply to your email.', code: 'FILE_UNAVAILABLE' });
  }

  await adminClient.from('book_downloads').update({
    download_count: (row.download_count ?? 0) + 1,
    last_download_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);

  if (go) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: signed.signedUrl } });
  return json(200, { title: book.title, filename: book.filename, pages: book.pages, url: signed.signedUrl });
});
