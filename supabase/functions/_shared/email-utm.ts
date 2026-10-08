// email-utm: tag every edeninstitute.health link in an outgoing email with UTM params.
//
// Founder rule 2026-10-08: every link to edeninstitute.health in a customer-facing email
// carries UTM tags, so year-end sales can be credited to the channel that sent them.
//
// Runs on the FINISHED string, right before it is handed to Resend, so it never has to
// reason about template placeholders: by then `${...}` has been interpolated and
// {{UNSUB_URL}} replaced. Rewrites are pure string surgery, never `new URL()`
// round-trips, so an existing query, its encoding and any `{CHECKOUT_SESSION_ID}` style
// literal are left exactly as they were.
//
// Added:   utm_source=email & utm_medium=<medium> & utm_content=<content> [& utm_campaign=<campaign>]
// Values are lowercased and URL-encoded. In HTML the separator this adds is `&amp;`;
// existing separators are never touched.
//
// Left alone (never tagged):
//   - any host other than edeninstitute.health / www.edeninstitute.health
//   - a URL that already carries ANY utm_ param (hand-tagged links keep their tags)
//   - file links: .pdf .png .jpg .jpeg .gif .webp .svg .ico
//   - account / legal / delivery paths: /unsubscribe, /preorder-response, /returns,
//     /privacy, /terms, /starter/downloads, /back-to-eden/download, any path containing
//     "thank-you", and /guide/ links carrying an access= token
//   - any URL carrying session_id= or a t= download token
//   - an unrendered `${` template (should never reach here; skipped rather than guessed)
// These add noise, not attribution: nobody is "acquired" by clicking their own download.

export type EmailTag = { medium: string; content: string; campaign?: string };

const HOST_RE = /^(https?:\/\/)(www\.)?edeninstitute\.health(?=[/?#]|$)/i;
const FILE_EXT_RE = /\.(pdf|png|jpe?g|gif|webp|svg|ico)$/i;
const EXCLUDED_PATH_PREFIXES = [
  '/unsubscribe',
  '/preorder-response',
  '/returns',
  '/privacy',
  '/terms',
  '/starter/downloads',
  '/back-to-eden/download',
];
const TOKEN_PARAMS = new Set(['session_id', 't']);

function utmQuery(tag: EmailTag, sep: string): string {
  const enc = (v: string) => encodeURIComponent(v.trim().toLowerCase());
  const parts = [
    `utm_source=email`,
    `utm_medium=${enc(tag.medium)}`,
    `utm_content=${enc(tag.content)}`,
  ];
  if (tag.campaign && tag.campaign.trim()) parts.push(`utm_campaign=${enc(tag.campaign)}`);
  return parts.join(sep);
}

/** Param names in a raw query string, whether it is separated by `&` or `&amp;`. */
function paramNames(query: string): string[] {
  return query
    .split(/&amp;|&/i)
    .filter((p) => p.length > 0)
    .map((p) => p.split('=')[0].toLowerCase());
}

/**
 * Tag one URL. `sep` is the separator to ADD: '&amp;' inside an HTML attribute,
 * '&' in plain text. Returns the URL unchanged when it is not ours or is excluded.
 */
export function tagEmailUrl(url: string, tag: EmailTag, sep: '&' | '&amp;' = '&'): string {
  const host = HOST_RE.exec(url);
  if (!host) return url;
  if (url.includes('${')) return url;

  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : url.slice(hashAt);

  const qAt = beforeHash.indexOf('?');
  const hostEnd = host[0].length;
  const path = (qAt === -1 ? beforeHash.slice(hostEnd) : beforeHash.slice(hostEnd, qAt)) || '';
  const query = qAt === -1 ? '' : beforeHash.slice(qAt + 1);

  const lowerPath = path.toLowerCase();
  if (FILE_EXT_RE.test(lowerPath)) return url;
  if (EXCLUDED_PATH_PREFIXES.some((p) => lowerPath.startsWith(p))) return url;
  if (lowerPath.includes('thank-you')) return url;

  const names = paramNames(query);
  if (names.some((n) => n.startsWith('utm_'))) return url;
  if (names.some((n) => TOKEN_PARAMS.has(n))) return url;
  if (lowerPath.startsWith('/guide/') && names.includes('access')) return url;

  // A bare origin gets its slash, so the result reads .../?utm_... rather than ...health?utm_...
  const base = path === '' && qAt === -1 ? `${beforeHash}/` : beforeHash;
  let joiner: string;
  if (qAt === -1) joiner = '?';
  else if (base.endsWith('?') || base.endsWith('&') || base.toLowerCase().endsWith('&amp;')) joiner = '';
  else joiner = sep;

  return `${base}${joiner}${utmQuery(tag, sep)}${fragment}`;
}

/** Rewrite every href="..." / href='...' in an HTML body. */
export function tagEmailHtml(html: string, tag: EmailTag): string {
  return html.replace(
    /(\bhref\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi,
    (_m, attr: string, dq: string | undefined, sq: string | undefined) =>
      dq !== undefined
        ? `${attr}"${tagEmailUrl(dq, tag, '&amp;')}"`
        : `${attr}'${tagEmailUrl(sq ?? '', tag, '&amp;')}'`,
  );
}

/** Rewrite every bare edeninstitute.health URL in a plain-text body. */
export function tagEmailText(text: string, tag: EmailTag): string {
  return text.replace(/https?:\/\/[^\s<>"']+/gi, (match: string) => {
    // Sentence punctuation after a URL is not part of it: "...health/books." or "(...)".
    const trail = /[.,;:!?)\]]+$/.exec(match);
    const url = trail ? match.slice(0, -trail[0].length) : match;
    return tagEmailUrl(url, tag, '&') + (trail ? trail[0] : '');
  });
}
