// Founding-partner sample downloads — signed-URL broker.
//
// WHY THIS EXISTS. The partner welcome email used to carry six Supabase signed
// URLs as buttons. Gmail rewrites every link in an API-created draft through
// `https://www.google.com/url?q=...` WITHOUT a `usg` signature, so the recipient
// lands on Google's "Redirect Notice" interstitial before each download. Proven
// twice on really-sent mail (Amy Fewell 2026-07-22; four partners 2026-08-12).
// Links the founder types herself in Gmail are NOT rewritten — verified on her
// 2026-08-12 reply to a podcast host, sent 11 minutes after the packages, whose
// hrefs came through clean in the same SENT-only copy.
//
// So the email now carries ONE short edeninstitute.health URL that the founder
// pastes herself, and this endpoint brokers the actual files. No interstitial,
// and partners see a domain they recognise instead of a supabase.co URL with a
// JWT in the query string, which is a well-known phishing fingerprint.
//
// The objects stay PRIVATE in the `partner-assets` bucket. They are never moved
// to public/lead-magnets — those URLs are public and guessable, which would
// contradict the "please keep this within your own family" line in the email.
//
// Required env (Vercel project settings):
//   SUPABASE_URL                e.g. https://noeqztssupewjidpvhar.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   full service-role JWT (signing requires it)
//   PARTNER_SAMPLE_KEY          the OLD shared secret, still in every link sent
//                               before 2026-11-03. Rotating it revokes all of those
//                               links at once; per-recipient keys are unaffected.
//
// PER-RECIPIENT KEYS, added 2026-11-03 (punch #244, founder approved). Every link
// issued from then on carries a key of its own, a row in public.partner_sample_keys
// minted by scripts/issue_sample_key.py (Biblical Herbalism folder). A leak is a
// one-row revoke (revoked_at) that nobody else feels. The shared key keeps working
// for the links already sent; retiring it is a later step only the founder decides.
// The lookup fails closed: if the table cannot be read, a non-shared key gets 503
// and is not counted as wrong. `f=verify` answers 204 for a live key without signing
// a file or logging a visit; the issuing script uses it to prove a new link works.
//
// SERVE LOG, added 2026-11-03 (punch #244 FIX 3). Every download writes a row to
// public.partner_sample_serves (which key, which file, a keyed hash of the
// visitor's network, never the IP). The daily founder digest counts distinct
// visitors per key per day and flags a link that has gone public, by name. The log
// fails open and never blocks a download. Nothing noticed the 2026-09-10 leak;
// the host told the founder.
//
// WRONG-KEY LIMIT, added 2026-09-15 (founder decision). The key stays one shared
// value, but a connection that sends 10 wrong keys in 15 minutes gets 429 before its
// key is checked (api/_lib/wrong-key-limit.ts). Correct keys never count. The limiter
// fails open, and needs migration 20260915213000_rate_bucket_peek.sql to enforce.
//
// PASTE-SAFE PATH FORM, added 2026-09-02. The founder can paste either
//   https://edeninstitute.health/partner-sample/<key>      (preferred)
//   https://edeninstitute.health/partner-sample?k=<key>    (still works)
// The path form exists because hand-pasting the query form silently DROPPED the
// `?k=` twice (StacyLyn Harris and Christina both got "This link is incomplete"
// and downloaded nothing). A path segment has nothing to lose. vercel.json
// 302s /partner-sample/:key -> /partner-sample?k=:key; it must be a REDIRECT and
// not a rewrite, because the page reads `k` from window.location.search on the
// client, and a rewrite leaves the browser URL on the path form with no query.
// It is deliberately NOT permanent: the key is rotatable, and a cached 301 for a
// revoked key would be unfixable in the recipient's browser.
//
// Why the founder still pastes at all, re-proven 2026-09-02: EVERY href in an
// API-created Gmail draft is rewritten through google.com/url. Tested a plain
// word anchor, a url-as-anchor-text, and target="_blank" + rel="noopener"; all
// three came back wrapped in the draft's stored HTML. No HTML shape escapes it,
// so do not go looking for one again.

import { safeEqual } from './_lib/safe-equal.js';
import { clientIp, isLockedOut, recordWrongKey, WRONG_KEY_WINDOW_SECONDS } from './_lib/wrong-key-limit.js';
import { lookupRecipientKey, recordServe, visitorHash } from './_lib/sample-keys.js';

/**
 * Button slug -> Storage object path. Grouped by band, reading order within each.
 *
 * THREE WEEKS OF EACH BAND since 2026-09-24 (founder decision): weeks 1-3 of
 * Sprouts (K-2) and weeks 1-3 of Seedlings (grades 3-5), so a partner can compare
 * the two. It replaces the six-week, Sprouts-only sample. The three card sets are
 * gone from the sample entirely, so the old slugs (field-cards, recipe-cards,
 * around-the-table-cards, and the unprefixed read-aloud / teachers-guide /
 * student-notebook) now 404. The page builds every href from its own list, so
 * only a hand-bookmarked /api URL could still carry an old slug.
 *
 * The files are cut page for page from the nine-week Starter masters; the build
 * script sits beside them in "Projects/Influencer and Partner Outreach/Partner
 * Sample 3+3 (2026-09-24)". The old `6wk` objects are not deleted by this change.
 */
const COMPONENTS: Record<string, string> = {
  'sprouts-read-aloud': 'sample/edens-table-sample-sprouts-3wk-read-aloud.pdf',
  'sprouts-teachers-guide': 'sample/edens-table-sample-sprouts-3wk-teachers-guide.pdf',
  'sprouts-student-notebook': 'sample/edens-table-sample-sprouts-3wk-student-notebook.pdf',
  'seedlings-read-aloud': 'sample/edens-table-sample-seedlings-3wk-read-aloud.pdf',
  'seedlings-teachers-guide': 'sample/edens-table-sample-seedlings-3wk-teachers-guide.pdf',
  'seedlings-student-notebook': 'sample/edens-table-sample-seedlings-3wk-student-notebook.pdf',
};

const BUCKET = 'partner-assets';
// Short by design. The URL is minted per click and consumed immediately, so it
// never needs to outlive the redirect. Contrast the old email buttons, which
// had to carry a 1-year TTL because the link sat in an inbox.
const SIGNED_URL_TTL_SECONDS = 300;

function fail(status: number, message: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return fail(405, 'GET only');

  const url = new URL(req.url);
  const key = url.searchParams.get('k') ?? '';
  const slug = url.searchParams.get('f') ?? '';

  const expectedKey = process.env.PARTNER_SAMPLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Name the missing variable. The first version of this logged all three names
  // in one string, which cost three diagnosis rounds on 2026-08-13: the log
  // could not distinguish "PARTNER_SAMPLE_KEY saved empty" (what had actually
  // happened, and it is Sensitive so its value cannot be read back in the UI)
  // from a missing Supabase URL. A 500 here always means an absent env var; a
  // wrong key returns 403.
  const missing = [
    ['PARTNER_SAMPLE_KEY', expectedKey],
    ['SUPABASE_URL or VITE_SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
  ].filter(([, v]) => !v).map(([n]) => n);

  if (missing.length > 0) {
    console.error(`partner-sample: missing env ${missing.join(', ')}`);
    return fail(500, 'Server misconfigured');
  }

  // Refuse a connection over the wrong-key limit BEFORE looking at its key, so a
  // locked-out guesser cannot tell a right guess from a wrong one.
  const limiter = { supabaseUrl, serviceKey: serviceRoleKey };
  const ip = clientIp(req.headers);
  if (ip && (await isLockedOut(limiter, ip))) {
    console.warn('partner-sample: wrong-key limit reached, refusing without checking the key');
    return fail(
      429,
      'Too many attempts with an invalid link. Please wait 15 minutes and try again, or email hello@edeninstitute.health.',
      { 'Retry-After': String(WRONG_KEY_WINDOW_SECONDS) },
    );
  }

  // The shared key first (no database call), then the recipient's own key.
  let keyId: string | null = null;
  if (!safeEqual(key, expectedKey)) {
    const found = await lookupRecipientKey(limiter, key);
    if (found.status === 'error') {
      console.error('partner-sample: key lookup failed, refusing without counting the key as wrong');
      return fail(503, 'We could not check this link just now. Please try again in a minute.', { 'Retry-After': '60' });
    }
    if (found.status !== 'active') {
      if (ip) await recordWrongKey(limiter, ip);
      const which = found.status === 'revoked' ? `revoked key ${found.id}` : 'rejected key';
      console.warn(`partner-sample: ${which} for slug=${slug || '(none)'}`);
      return fail(403, 'This link is not valid. Please check with hello@edeninstitute.health.');
    }
    keyId = found.id;
  }

  if (slug === 'verify') {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }

  const path = COMPONENTS[slug];
  if (!path) return fail(404, 'Unknown sample component');

  // Logged alongside the signing call, so it costs the download no time.
  const [response] = await Promise.all([
    signAndRedirect(supabaseUrl, serviceRoleKey, path, slug, keyId),
    recordServe(limiter, { key_id: keyId, visitor_hash: await visitorHash(ip, serviceRoleKey), slug }),
  ]);
  return response;
}

async function signAndRedirect(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  slug: string,
  keyId: string | null,
): Promise<Response> {
  let signRes: Response;
  try {
    signRes = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
      },
    );
  } catch (err) {
    console.error('partner-sample: sign fetch threw:', err instanceof Error ? err.message : String(err));
    return fail(502, 'Could not prepare the download. Please try again.');
  }

  if (!signRes.ok) {
    console.error(`partner-sample: sign failed ${signRes.status} for ${path}`);
    return fail(502, 'Could not prepare the download. Please try again.');
  }

  const { signedURL } = (await signRes.json()) as { signedURL: string };

  // The Gmail send gives no telemetry at all (no Resend tags, so nothing lands in
  // public.email_events). This line and public.partner_sample_serves are how we
  // learn whether partners actually open the files, and whose link served them.
  console.log(`partner-sample: served ${slug} via ${keyId ? `key ${keyId}` : 'shared key'}`);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${supabaseUrl.replace(/\/$/, '')}/storage/v1${signedURL}`,
      'Cache-Control': 'no-store',
      // Belt and braces alongside robots.txt and the page's noindex.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const config = { runtime: 'edge' };
