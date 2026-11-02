// The buyer's Google Analytics visitor, for the server-side purchase (2026-10-28).
//
// stripe-webhook reports every sale to GA4 through the Measurement Protocol
// (supabase/functions/_shared/ga4-mp.ts). To join a sale to the visit that made it,
// GA needs that visit's client id and session id, which live only in this browser's
// _ga cookies. They ride to create-checkout inside getCheckoutAttribution() as
// `attribution.ga`, with the cookie-banner choice, so a buyer who clicked Decline is
// never reported (founder 2026-10-28).
//
// Read straight from the cookies, synchronously, so nothing waits on gtag.js (which
// an ad blocker may have stopped; the server then reports the sale under an id of
// its own). Pure parsing below, pinned by src/test/gaVisitor.test.ts.

import { getMarketingConsent, GA_MEASUREMENT_ID, type ConsentChoice } from "@/lib/consent";

export interface GaVisitor {
  client_id?: string;
  session_id?: string;
  consent?: ConsentChoice;
}

/** "GA1.1.1234567890.1700000000" -> "1234567890.1700000000". */
export function parseGaClientId(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;
  const m = /^GA\d\.\d+\.(\d+\.\d+)$/.exec(cookieValue.trim());
  return m ? m[1] : null;
}

/**
 * The session id from the property's own cookie, in either format GA writes:
 *   GS1.1.1700000000.3.1.1700000500.0.0.0     (older: third field)
 *   GS2.1.s1700000000$o3$g1$t1700000500$j0    (2025 on: the "s" field)
 */
export function parseGaSessionId(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;
  const v = cookieValue.trim();
  const gs2 = /^GS2\.\d+\.s(\d{6,12})(?:\$|$)/.exec(v);
  if (gs2) return gs2[1];
  const gs1 = /^GS1\.\d+\.(\d{6,12})\./.exec(v);
  return gs1 ? gs1[1] : null;
}

function readCookie(name: string): string | null {
  try {
    const prefix = `${name}=`;
    for (const part of document.cookie.split(";")) {
      const c = part.trim();
      if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length));
    }
  } catch {
    // No cookie access: treated as no visitor.
  }
  return null;
}

/** The visitor for checkout. Every field is optional; never throws. */
export function readGaVisitor(): GaVisitor {
  try {
    const out: GaVisitor = {};
    const consent = getMarketingConsent();
    if (consent) out.consent = consent;
    const cid = parseGaClientId(readCookie("_ga"));
    if (cid) out.client_id = cid;
    const sid = parseGaSessionId(readCookie(`_ga_${GA_MEASUREMENT_ID.replace(/^G-/, "")}`));
    if (sid) out.session_id = sid;
    return out;
  } catch {
    return {};
  }
}
