// Marketing-consent storage for the cookie banner. Gates the Meta Pixel.
// First-party cookieless analytics (record_page_view) runs regardless — it
// stores no cookies and no PII, so it's not subject to this gate.

const KEY = "eden-marketing-consent";

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
