// Marketing-consent storage for the cookie banner. Gates the Meta Pixel.
// First-party cookieless analytics (record_page_view) runs regardless — it
// stores no cookies and no PII, so it's not subject to this gate.
//
// CONSENT MODEL (founder decision 2026-09-13): "run by default, Decline turns it
// off". Google Analytics and the Pinterest tag load on every page and run until
// the visitor clicks Decline. The Meta Pixel and the hashed email for Pinterest
// wait for Accept. applyTagConsent() below is what the banners call on a click;
// a visitor whose stored choice is "denied" is opted out again on every page
// load by the inline scripts in web/layouts/MarketingLayout.astro and
// index.html, which read KEY directly because they run before any bundle.

const KEY = "eden-marketing-consent";

/** GA4 measurement id. Same id as the gtag snippet in MarketingLayout.astro and index.html. */
export const GA_MEASUREMENT_ID = "G-5DVHEZPKL0";

export type ConsentChoice = "granted" | "denied";

export function getMarketingConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setMarketingConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* localStorage unavailable (private mode) — treat as no persisted consent */
  }
}

/**
 * Tell the default-on tags what the visitor just chose. Call it right after
 * setMarketingConsent on an Accept or Decline click.
 *
 * Google Analytics: window['ga-disable-<id>'] is Google's documented switch that
 * stops the Google tag from setting cookies or sending data, checked on every
 * send. Consent mode alone is not "off": with consent denied, Google tags still
 * send cookieless pings. The consent update is sent as well so Google's own
 * consent state matches the choice.
 *
 * Pinterest: pintrk('setconsent', false) stops events being sent and deletes the
 * tag's first-party cookies and storage; true turns sending back on. Its consent
 * state lives in memory only, which is why the layout repeats the false call on
 * every page load for a stored "denied".
 *
 * Both tags may be absent (SPA routes have no Pinterest tag, blockers remove
 * either); every call is guarded and nothing here ever throws.
 */
export function applyTagConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  const granted = choice === "granted";
  const w = window as unknown as Record<string, unknown>;
  const state = granted ? "granted" : "denied";
  try {
    // Set before the consent update so a Decline sends nothing further.
    w[`ga-disable-${GA_MEASUREMENT_ID}`] = !granted;
  } catch {
    /* ignore */
  }
  try {
    const gtag = w.gtag;
    if (typeof gtag === "function") {
      gtag("consent", "update", {
        analytics_storage: state,
        ad_storage: state,
        ad_user_data: state,
        ad_personalization: state,
      });
    }
  } catch {
    /* ignore */
  }
  try {
    const pintrk = w.pintrk;
    if (typeof pintrk === "function") pintrk("setconsent", granted);
  } catch {
    /* ignore */
  }
}
