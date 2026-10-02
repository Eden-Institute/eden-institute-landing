// GA4 "email_submit", the key event for every email capture form (2026-10-02).
//
// One helper so every form sends the same shape:
//   gtag('event', 'email_submit', { form_name, event_category: 'conversion', event_label: form_name })
// form_name says which form it was (the waitlist source, 'constitution_assessment',
// 'esa_invoice', ...). event_category and event_label are kept so reports built
// on the original WaitlistModal event keep working.
//
// Call it only after the server has confirmed the signup, never on the click.
// Consent: nothing is sent after Decline (the layout's ga-disable switch would
// stop gtag anyway). Off the live site gtag.js is never loaded, so the call
// only lands in an unread dataLayer. The README "Analytics events" section
// lists every form_name.

import { getMarketingConsent } from "@/lib/consent";

export function trackEmailSubmit(formName: string): void {
  try {
    if (getMarketingConsent() === "denied") return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", "email_submit", { form_name: formName, event_category: "conversion", event_label: formName });
  } catch {
    // Analytics never break a form.
  }
}
