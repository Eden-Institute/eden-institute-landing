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
// Added:   utm_source=email & utm_medium=<medium> & utm_campaign=<campaign> [& utm_content=<content>]
// HARD GATE (2026-10-28, the analytics developer prompt and the Naming rules tab):
//   - utm_medium is one of newsletter, nurture, welcome, signature. EmailMedium makes any
//     other value a type error, so no sender can ship one. Transactional mail (receipts,
//     delivery, guide access, cart reminder) is 'nurture': the relationship after a
//     purchase; each names itself in utm_campaign.
//   - utm_campaign is required: the issue or sequence, as a slug.
//   - Every value is written literally as a slug (lowercase, underscores, a-z 0-9), so
//     nothing needs URL-encoding and nothing can arrive scrambled from our side. (The
//     garbled mediums GA showed in October, "fvtabghef" and friends, decode letter for
//     letter to signature / newsletter / esa_outreach: something after delivery rewrote
//     them, including links from the Gmail signature that no code here ever touches.)
//   - Tags already on a link are never overwritten. A link missing some of the three is
//     given only the missing ones.
// In HTML the separator this adds is `&amp;`; existing separators are never touched.
//
// Left alone (never tagged):
//   - any host other than edeninstitute.health / www.edeninstitute.health
//   - a URL that already carries utm_source, utm_medium and utm_campaign (hand-tagged
//     links keep their tags; one missing some gets only the missing ones)
//   - file links: .pdf .png .jpg .jpeg .gif .webp .svg .ico
//   - account / legal / delivery paths: /unsubscribe, /preorder-response, /returns,
//     /privacy, /terms, /starter/downloads, /back-to-eden/download, any path containing
//     "thank-you", and /guide/ links carrying an access= token
//   - any URL carrying session_id= or a t= download token
//   - an unrendered `${` template (should never reach here; skipped rather than guessed)
// These add noise, not attribution: nobody is "acquired" by clicking their own download.

/** The only email mediums the Naming rules allow. */
export const EMAIL_MEDIUMS = ['newsletter', 'nurture', 'welcome', 'signature'] as const;
export type EmailMedium = (typeof EMAIL_MEDIUMS)[number];

export type EmailTag = {
  medium: EmailMedium;
  /** The issue or sequence name; written as a slug. Required by the hard gate. */
  campaign: string;
  /** Which email in the sequence (optional): utm_content. */
  content?: string;
};

/** A value as the Naming rules write it: lowercase, underscores, letters and digits only. */
export function utmSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** An untrusted value (a request body) as an approved medium, or null. */
export function asEmailMedium(value: unknown): EmailMedium | null {
  return typeof value === 'string' && (EMAIL_MEDIUMS as readonly string[]).includes(value)
    ? (value as EmailMedium)
    : null;
}

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

/** The tags a link should end up with, in the order they are written. */
function wantedTags(tag: EmailTag): [string, string][] {
  const out: [string, string][] = [
    ['utm_source', 'email'],
    ['utm_medium', tag.medium],
    ['utm_campaign', utmSlug(tag.campaign) || 'email'],
  ];
  const content = tag.content ? utmSlug(tag.content) : '';
  if (content) out.push(['utm_content', content]);
  return out;
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
  if (names.some((n) => TOKEN_PARAMS.has(n))) return url;
  if (lowerPath.startsWith('/guide/') && names.includes('access')) return url;
  // Never overwrite: only the tags the link does not already carry are added. A link
  // with any utm_ of its own was tagged by hand, so utm_content is not added to it.
  const handTagged = names.some((n) => n.startsWith('utm_'));
  const missing = wantedTags(tag).filter(([n]) => !names.includes(n) && !(handTagged && n === 'utm_content'));
  if (missing.length === 0) return url;

  // A bare origin gets its slash, so the result reads .../?utm_... rather than ...health?utm_...
  const base = path === '' && qAt === -1 ? `${beforeHash}/` : beforeHash;
  let joiner: string;
  if (qAt === -1) joiner = '?';
  else if (base.endsWith('?') || base.endsWith('&') || base.toLowerCase().endsWith('&amp;')) joiner = '';
  else joiner = sep;

  return `${base}${joiner}${missing.map(([n, v]) => `${n}=${v}`).join(sep)}${fragment}`;
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
