// supabase/functions/_shared/preorder-response-request.ts
//
// Request routing for the public `preorder-response` function (a buyer's answer to
// an FTC delay notice), kept pure so it can be tested without a database
// (preorder-response-request.test.ts).
//
// WHY THE PAGES LIVE ON edeninstitute.health AND NOT IN THE FUNCTION: Supabase serves
// a text/html function response as text/plain, so the confirmation pages this
// function used to build showed buyers raw HTML source. Verified 2026-09-15 with a
// harmless invalid-token GET: `Content-Type: text/plain` on both the supabase.co URL
// and the old edeninstitute.health rewrite. A redirect is honoured; HTML is not.
// Same fix as unsubscribe (_shared/unsubscribe-request.ts).
//
// WHY A GET NEVER RECORDS ANYTHING: each delay-notice email carries two signed
// links, one per answer. Corporate link scanners (Microsoft Defender Safe Links,
// Mimecast, Proofpoint) fetch every link in an inbound email, and the old function
// recorded the answer on a plain GET, first answer wins. A scanner could therefore
// record consent OR a cancellation the buyer never gave, whichever link it fetched
// first. Now:
//   GET / HEAD  the email link, or a scanner fetching it. Read-only: verifies the
//               token, looks the notice up, and 303s to the page on
//               edeninstitute.health with the state to show.
//   POST, form  the button on that page. Body carries `token` and `choice`.
//               Records the answer (first answer wins), then 303s to the result.
//
// The page URL carries only non-sensitive display values: the state, the choice the
// token already encodes, and whether the notice is opt-in (which picks the button
// wording the email used). No order number, name, email or date is put in a URL.
// The token itself is in the confirm URL, exactly as it already is in the email
// link; the page loads no third-party tags and sends no referrer.

import type { DelayResponse } from './delay-consent-token.ts';

export const PREORDER_RESPONSE_PAGE_URL = 'https://edeninstitute.health/preorder-response';

/** Every state the page renders. */
export type PreorderPageState =
  | 'confirm'
  | 'done-consented'
  | 'done-cancelled'
  | 'answered-consented'
  | 'answered-cancelled'
  | 'invalid'
  | 'not-found'
  | 'error';

export type PreorderRoute =
  | { kind: 'preflight' }
  | { kind: 'confirm'; token: string }
  | { kind: 'record'; token: string; choice: string }
  | { kind: 'method_not_allowed' };

export interface PreorderForm {
  token: string | null;
  choice: string | null;
}

/**
 * Decide what a request is. `form` is the parsed POST body (readPreorderForm), or
 * null when there was none or it could not be parsed.
 *
 * A POST records only with a form `token`. There is no query-string POST path: no
 * client has ever POSTed to this function (the emails only ever linked a GET), so a
 * POST without the page's form fields carries an empty token, which fails
 * verification and records nothing.
 */
export function routePreorderRequest(input: {
  method: string;
  queryToken: string | null;
  form: PreorderForm | null;
}): PreorderRoute {
  const method = input.method.toUpperCase();
  if (method === 'OPTIONS') return { kind: 'preflight' };
  if (method === 'GET' || method === 'HEAD') return { kind: 'confirm', token: input.queryToken ?? '' };
  if (method === 'POST') {
    return { kind: 'record', token: input.form?.token ?? '', choice: input.form?.choice ?? '' };
  }
  return { kind: 'method_not_allowed' };
}

/**
 * Parse a POST body as a form (urlencoded or multipart). Returns null for any other
 * content type or an unparseable body. Never throws.
 */
export async function readPreorderForm(req: Request): Promise<PreorderForm | null> {
  const type = (req.headers.get('content-type') ?? '').toLowerCase();
  if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) {
    return null;
  }
  try {
    const fd = await req.formData();
    const t = fd.get('token');
    const c = fd.get('choice');
    return {
      token: typeof t === 'string' && t ? t : null,
      choice: typeof c === 'string' && c ? c : null,
    };
  } catch {
    return null;
  }
}

/**
 * A POST records only when the choice the page's button showed is the choice the
 * signed token carries. The token decides what is recorded; this check makes sure
 * the buyer was shown that same answer on the button they pressed.
 */
export function choiceMatchesToken(choice: string, tokenResponse: DelayResponse): boolean {
  return choice === tokenResponse;
}

/** The notice row as the function reads it. */
export interface NoticeLookup {
  response: string | null;
  requires_opt_in: boolean;
}

/** What a GET shows: the page with the button, or a state that needs no button. */
export function stateForGet(notice: NoticeLookup | null): PreorderPageState {
  if (!notice) return 'not-found';
  if (notice.response) return answeredState(notice.response);
  return 'confirm';
}

/** Idempotent: the first answer wins, and the page says plainly which one it was. */
export function answeredState(response: string): 'answered-consented' | 'answered-cancelled' {
  return response === 'consented' ? 'answered-consented' : 'answered-cancelled';
}

export function doneState(response: DelayResponse): 'done-consented' | 'done-cancelled' {
  return response === 'consented' ? 'done-consented' : 'done-cancelled';
}

/** Where a GET with a valid token for an unanswered notice is sent. */
export function confirmPageUrl(token: string, choice: DelayResponse, requiresOptIn: boolean): string {
  const q = new URLSearchParams({
    state: 'confirm',
    choice,
    optin: requiresOptIn ? '1' : '0',
    token,
  });
  return `${PREORDER_RESPONSE_PAGE_URL}?${q.toString()}`;
}

/** Every other state. Carries no token. */
export function resultPageUrl(state: Exclude<PreorderPageState, 'confirm'>): string {
  return `${PREORDER_RESPONSE_PAGE_URL}?state=${state}`;
}
