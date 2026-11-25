// supabase/functions/_shared/online-year-status.ts
//
// Eden's Table Online Year (punch #472): what /online-year/thank-you asks after Stripe sends the
// buyer back. The pure half of online-year-order-status: input checks, the band from the order's
// lookup_key, and the shape of the answer. The I/O is injected (deps), so the whole handler is
// unit tested in CI (online-year-status.test.ts) with fakes; online-year-order-status/index.ts only
// wires the database.
//
// Input:  POST { session_id }  (the Stripe Checkout session id from ONLINE_YEAR_SUCCESS_URL)
// Output: { state: "pending" }  until stripe-webhook (OY3, online-year-webhook.ts) has recorded the
//                               order AND granted its licenses (the redirect usually beats the
//                               webhook by a second or two; the page polls), or
//         { state: "ready", band, children: [{ name, ends_at }] }  the order's licenses, in the
//                               order they were created (then by name, as online_year_grant_purchase
//                               lists them), whatever their status: a just-paid order is active.
//
// DARK: while the Online Year is not on sale, the same 404 { error: "not_found" } create-checkout
// gives (onlineYearOpen: ONLINE_YEAR_ENABLED, or the x-online-year-preview header).
//
// WHAT IS RETURNED AND WHY IT IS SAFE. The session id is the same unguessable bearer proof
// print-order-status accepts, and the same validation. The answer carries only the band, the
// children's first names or nicknames (which the buyer typed) and the end dates: no email, no
// order number, no money, no Stripe ids. Database only (service role), never a Stripe call.
//
// A session that belongs to some OTHER order (a printed set, a Starter Unit) answers "pending",
// exactly like a session nobody has recorded yet: this endpoint never says whether a session id
// exists outside the Online Year, and the page only ever sends the session Stripe returned from
// an Online Year checkout. An Online Year order whose band cannot be read (lookup_key
// "online_year_cart": paid but not grantable, which emails the founder) or that has no licenses
// yet also stays "pending", so the page keeps its "still being set up" words and the help line.

import { onlineYearOpen } from './online-year-gate.ts';
import { isOnlineYearBand, type OnlineYearBand } from './online-year-checkout.ts';

/** Same check as print-order-status: a Stripe Checkout session id, live or test. */
const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{20,}$/;

/** orders.lookup_key prefix for every Online Year sale (online-year-grant.ts onlineYearOrderKey). */
export const ONLINE_YEAR_ORDER_KEY_PREFIX = 'online_year_';

export function isCheckoutSessionId(v: unknown): v is string {
  return typeof v === 'string' && SESSION_ID_RE.test(v);
}

/** "online_year_sprouts" -> "sprouts"; anything else (including "online_year_cart") -> null. */
export function onlineYearBandFromLookupKey(lookupKey: unknown): OnlineYearBand | null {
  if (typeof lookupKey !== 'string' || !lookupKey.startsWith(ONLINE_YEAR_ORDER_KEY_PREFIX)) return null;
  const band = lookupKey.slice(ONLINE_YEAR_ORDER_KEY_PREFIX.length);
  return isOnlineYearBand(band) ? band : null;
}

export interface OnlineYearStatusOrder {
  id: string;
  lookup_key: string | null;
}

export interface OnlineYearStatusLicense {
  band: string;
  child_name: string;
  ends_at: string;
  created_at: string;
}

export interface OnlineYearStatusChild {
  name: string;
  ends_at: string;
}

export type OnlineYearOrderStatus =
  | { state: 'pending' }
  | { state: 'ready'; band: OnlineYearBand; children: OnlineYearStatusChild[] };

/**
 * The answer for one order (null = no order for that session yet). The band comes from the order's
 * lookup_key; a license in another band (never written by the grant) is left out rather than shown
 * under the wrong heading.
 */
export function shapeOnlineYearStatus(
  order: OnlineYearStatusOrder | null,
  licenses: OnlineYearStatusLicense[],
): OnlineYearOrderStatus {
  if (!order) return { state: 'pending' };
  const band = onlineYearBandFromLookupKey(order.lookup_key);
  if (!band) return { state: 'pending' };
  const children = licenses
    .filter((l) => l.band === band)
    .slice()
    .sort((a, b) => {
      const t = Date.parse(a.created_at) - Date.parse(b.created_at);
      if (t !== 0 && !Number.isNaN(t)) return t;
      return a.child_name < b.child_name ? -1 : a.child_name > b.child_name ? 1 : 0;
    })
    .map((l) => ({ name: l.child_name, ends_at: l.ends_at }));
  if (children.length === 0) return { state: 'pending' };
  return { state: 'ready', band, children };
}

export interface OnlineYearStatusDeps {
  /** The orders row for this Checkout session, or null. Throws on a read error. */
  findOrder: (sessionId: string) => Promise<OnlineYearStatusOrder | null>;
  /** Every online_year_licenses row of this order. Throws on a read error. */
  listLicenses: (orderId: string) => Promise<OnlineYearStatusLicense[]>;
  cors: Record<string, string>;
  env?: (k: string) => string | undefined;
  log?: (line: string) => void;
}

export async function handleOnlineYearOrderStatus(req: Request, deps: OnlineYearStatusDeps): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...deps.cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: deps.cors });
  // Dark until launch: the same answer as a path that does not exist (create-checkout's OY branch).
  if (!onlineYearOpen(req, deps.env)) return json({ error: 'not_found' }, 404);
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const sessionId = body && typeof body.session_id === 'string' ? body.session_id.trim() : '';
  if (!isCheckoutSessionId(sessionId)) return json({ error: 'Missing or malformed session_id' }, 400);

  try {
    const order = await deps.findOrder(sessionId);
    if (!order || !onlineYearBandFromLookupKey(order.lookup_key)) return json({ state: 'pending' });
    const licenses = await deps.listLicenses(order.id);
    return json(shapeOnlineYearStatus(order, licenses));
  } catch (err) {
    (deps.log ?? ((l: string) => console.error(l)))(
      `online-year-order-status: ${err instanceof Error ? err.message : String(err)}`,
    );
    return json({ error: 'Could not load the order right now.' }, 500);
  }
}
