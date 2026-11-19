// supabase/functions/_shared/contact-email.ts
//
// One email check for every address the site hands to Stripe as `customer_email`
// or a Customer's `email` (2026-11-19, Lane 2 QA of PR #756).
//
// Why: the old check, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, passed addresses Stripe refuses
// with 400 email_invalid, and a refused address fails the WHOLE checkout with the
// generic "We could not open checkout" line. Probed in Stripe TEST mode 2026-11-19
// (Checkout Sessions and Customers answered identically):
//   refused:  a trailing dot ("mom@example.com.", "..", "mom@example.co."), a
//             trailing comma, semicolon, ")" or "\", "<mom@example.com>", a
//             zero-width space, "@@", and a domain starting with a dot.
//   accepted: "mom@example..com", "mom.@example.com", ".mom@example.com",
//             "o'brien@...", "mom+eden@...", accented letters, a quoted local part,
//             "mom@example.c", "mom@exa_mple.com", "mom@example.com-".
// This check refuses every shape in the first list and accepts every shape in the
// second, so it never turns away an address Stripe would take (the print ship-to
// form REQUIRES an email, so a false refusal there would block a real order).
// It is a guard, not a full RFC validator: Stripe stays the real check.
//
// Pure (no Deno or browser APIs): the web islands import it too.

/** Characters never valid in an unquoted address, plus the invisible ones copy-paste brings along. */
const BAD = '\\s@<>()\\[\\]\\\\,;:\\u200b-\\u200d\\u2060\\ufeff';

/**
 * local@domain: the local part may hold a quote; the domain may not start with a dot
 * and must end in a non-empty label after its last dot (so no trailing dot).
 */
export const STRIPE_SAFE_EMAIL_RE = new RegExp(`^[^${BAD}]+@[^${BAD}".][^${BAD}"]*\\.[^${BAD}".]+$`);

/** Longest address we pass on (RFC 5321 path limit). */
export const MAX_CONTACT_EMAIL_LENGTH = 254;

/** True when Stripe will take this (already trimmed) address. */
export function isStripeSafeEmail(email: string): boolean {
  return email.length > 0 && email.length <= MAX_CONTACT_EMAIL_LENGTH && STRIPE_SAFE_EMAIL_RE.test(email);
}

/** A trimmed, Stripe-safe email, or null. */
export function cleanContactEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim();
  return isStripeSafeEmail(e) ? e : null;
}
