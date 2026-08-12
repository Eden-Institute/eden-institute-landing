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
//   PARTNER_SAMPLE_KEY          shared secret embedded in the link the founder
//                               pastes. Rotate to revoke every outstanding link.

/** Button slug -> Storage object path. Order is the reading order of a week. */
const COMPONENTS: Record<string, string> = {
  'read-aloud': 'sample/edens-table-6wk-read-aloud.pdf',
  'teachers-guide': 'sample/edens-table-6wk-teachers-guide.pdf',
  'student-notebook': 'sample/edens-table-6wk-student-notebook.pdf',
  'field-cards': 'sample/edens-table-6wk-field-cards.pdf',
  'recipe-cards': 'sample/edens-table-6wk-recipe-cards.pdf',
  'around-the-table-cards': 'sample/edens-table-6wk-around-the-table-cards.pdf',
};

const BUCKET = 'partner-assets';
// Short by design. The URL is minted per click and consumed immediately, so it
// never needs to outlive the redirect. Contrast the old email buttons, which
// had to carry a 1-year TTL because the link sat in an inbox.
const SIGNED_URL_TTL_SECONDS = 300;

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Constant-time string compare, so a wrong key cannot be found by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return fail(405, 'GET only');

  const url = new URL(req.url);
  const key = url.searchParams.get('k') ?? '';
  const slug = url.searchParams.get('f') ?? '';

  const expectedKey = process.env.PARTNER_SAMPLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedKey || !supabaseUrl || !serviceRoleKey) {
    console.error('partner-sample: missing PARTNER_SAMPLE_KEY, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return fail(500, 'Server misconfigured');
  }

  if (!safeEqual(key, expectedKey)) {
    console.warn(`partner-sample: rejected key for slug=${slug || '(none)'}`);
    return fail(403, 'This link is not valid. Please check with hello@edeninstitute.health.');
  }

  const path = COMPONENTS[slug];
  if (!path) return fail(404, 'Unknown sample component');

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

  // The only download telemetry that exists for this rail. The Gmail send gives
  // none at all (no Resend tags, so nothing lands in public.email_events), so
  // these lines are how we learn whether partners actually open the files.
  console.log(`partner-sample: served ${slug}`);

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
