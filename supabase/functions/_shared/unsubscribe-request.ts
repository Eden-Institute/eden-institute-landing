// supabase/functions/_shared/unsubscribe-request.ts
//
// Request routing for the public `unsubscribe` function, kept pure so it can be
// tested without a database (unsubscribe-request.test.ts).
//
// WHY (founder decision 2026-09-15): the function used to record the unsubscribe
// on a plain GET. Corporate link scanners (Microsoft Defender Safe Links, Mimecast,
// Proofpoint) fetch every link in an inbound email, so they were unsubscribing
// people who never clicked anything. A GET now never writes.
//
// The three ways a request arrives:
//   GET / HEAD  footer link, or a scanner fetching it. Never writes. Redirects to
//               the confirm page on edeninstitute.health.
//   POST, form  the "Unsubscribe" button on that confirm page. Body carries
//               `token`. Writes, then redirects to the result page.
//   POST, other RFC 8058 one-click from Gmail / Apple Mail. The body is
//               `List-Unsubscribe=One-Click` and the token is in the query string
//               (the List-Unsubscribe header URL, see email-unsubscribe.ts). Writes
//               in one step and answers 2xx, which is all the mail client reads.
//
// WHY THE PAGES LIVE ON edeninstitute.health AND NOT IN THE FUNCTION: Supabase
// rewrites a text/html response to text/plain on the default functions domain,
// so an HTML page served from the function shows up as raw source. Verified
// 2026-09-15 with a harmless invalid-token GET: `Content-Type: text/plain` on
// both the supabase.co URL and the edeninstitute.health rewrite. A redirect is
// honoured; a form is not.

export const UNSUBSCRIBE_PAGE_URL = 'https://edeninstitute.health/unsubscribe';

export type UnsubResult = 'done' | 'invalid' | 'error';

export type UnsubRoute =
  | { kind: 'preflight' }
  | { kind: 'confirm'; token: string }
  | { kind: 'form_post'; token: string }
  | { kind: 'one_click'; token: string }
  | { kind: 'method_not_allowed' };

export interface UnsubForm {
  /** `token` field from the confirm page's form, or null when absent. */
  token: string | null;
  /** True when the body carries List-Unsubscribe=One-Click (RFC 8058). */
  oneClick: boolean;
}

/**
 * Decide what a request is. `form` is the parsed POST body (readUnsubForm), or
 * null when there was none or it could not be parsed.
 *
 * A POST is a browser form post only when it carries a `token` field and NOT the
 * one-click marker. Anything else that POSTs is treated as one-click, so a mail
 * client that sends an empty or unusual body still unsubscribes in one step.
 */
export function routeUnsubRequest(input: {
  method: string;
  queryToken: string | null;
  form: UnsubForm | null;
}): UnsubRoute {
  const method = input.method.toUpperCase();
  const queryToken = input.queryToken ?? '';
  if (method === 'OPTIONS') return { kind: 'preflight' };
  if (method === 'GET' || method === 'HEAD') return { kind: 'confirm', token: queryToken };
  if (method === 'POST') {
    const form = input.form;
    if (form && !form.oneClick && form.token) {
      return { kind: 'form_post', token: form.token };
    }
    return { kind: 'one_click', token: queryToken || form?.token || '' };
  }
  return { kind: 'method_not_allowed' };
}

/**
 * Parse a POST body as a form. Accepts application/x-www-form-urlencoded and
 * multipart/form-data, the two encodings RFC 8058 allows. Returns null for any
 * other content type or an unparseable body. Never throws.
 */
export async function readUnsubForm(req: Request): Promise<UnsubForm | null> {
  const type = (req.headers.get('content-type') ?? '').toLowerCase();
  if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) {
    return null;
  }
  try {
    const fd = await req.formData();
    const t = fd.get('token');
    const marker = fd.get('List-Unsubscribe');
    return {
      token: typeof t === 'string' && t ? t : null,
      oneClick: typeof marker === 'string' && marker.trim().toLowerCase() === 'one-click',
    };
  } catch {
    return null;
  }
}

/** Where a GET with a valid token is sent: the page with the Unsubscribe button. */
export function confirmPageUrl(token: string): string {
  return `${UNSUBSCRIBE_PAGE_URL}?token=${encodeURIComponent(token)}`;
}

/** Where a bad token (any method) or a finished form post is sent. */
export function resultPageUrl(result: UnsubResult): string {
  return `${UNSUBSCRIBE_PAGE_URL}?status=${result}`;
}
