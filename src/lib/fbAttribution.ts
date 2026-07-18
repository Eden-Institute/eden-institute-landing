// Facebook click/browser attribution identifiers, captured at checkout.
//
// Why this exists: the server-side Purchase we send from stripe-webhook carried
// ONLY a hashed email, which Meta scored 3.2/10 for match quality. A low score is
// not cosmetic — it means Meta frequently cannot tie the purchase back to the
// person who clicked the ad, so campaigns cannot optimize toward buyers and
// reported CAC is wrong. `fbc` in particular IS the ad click: without it, an
// ad-driven sale can look organic.
//
// Both values are first-party cookies the Meta Pixel sets in the browser:
//   _fbp  "browser id"  — set on first pixel load, identifies the browser
//   _fbc  "click id"    — set when the visitor arrives with an ?fbclid= param
//
// CONSENT: the Pixel is injected only after marketing consent (see metaPixel.ts
// and the Cookie Policy). These readers therefore return null unless consent was
// granted — including the fbclid fallback below, which would otherwise
// reconstruct an identifier for someone who declined tracking. Consent gating
// lives here rather than at each call site so a new checkout button cannot
// accidentally bypass it.

import { getMarketingConsent } from "./consent";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface FbAttribution {
  fbp?: string;
  fbc?: string;
}

/**
 * Collect _fbp / _fbc for the current visitor, or an empty object when marketing
 * consent has not been granted. Safe to spread straight into a checkout body.
 */
export function getFbAttribution(): FbAttribution {
  if (typeof window === "undefined") return {};
  if (getMarketingConsent() !== "granted") return {};

  const out: FbAttribution = {};

  const fbp = readCookie("_fbp");
  if (fbp) out.fbp = fbp;

  const fbc = readCookie("_fbc");
  if (fbc) {
    out.fbc = fbc;
  } else {
    // The Pixel normally writes _fbc itself, but it only does so on a page load
    // that carries ?fbclid=. A visitor who lands on an ad link and navigates to
    // checkout via client-side routing can lose it before the cookie is written,
    // which is exactly the ad-click path we most need to attribute. Rebuild it in
    // Meta's documented format: fb.<subdomainIndex>.<creationTime>.<fbclid>
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (fbclid) out.fbc = `fb.1.${Date.now()}.${fbclid}`;
  }

  return out;
}
