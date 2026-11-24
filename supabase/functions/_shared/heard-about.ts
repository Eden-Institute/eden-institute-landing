// supabase/functions/_shared/heard-about.ts
//
// "How did you hear about us?" (2026-11-24). Gina (Ultimate Homeschool Podcast Network) asked for it so podcast
// listeners who arrive later as direct or Google traffic still get counted; Camila's tap "Yes, add it" (via Lane 0)
// and "Use these" for the words below (Lane 2). One optional answer, asked in two places:
//   - the free-week sign-up form (src/components/landing/WaitlistModal.tsx -> resend-waitlist ->
//     waitlist_signups.heard_about);
//   - every checkout (create-checkout adds a Stripe dropdown; stripe-webhook stores the pick on orders.heard_about).
// Nobody has to answer. An earlier answer is never overwritten.
//
// Plain TypeScript with no Deno or browser APIs: the edge functions and the site both import this file, so the
// choices can never differ between the form and checkout. The database CHECK constraints list the same values
// (migration *_heard_about.sql; src/test/heardAbout.test.ts keeps them equal).
//
// Values are what Stripe allows for a dropdown option: letters and digits only, at most 100 characters.

export const HEARD_ABOUT_QUESTION = 'How did you hear about us?';

/** Stripe custom field key (letters and digits only). */
export const HEARD_ABOUT_STRIPE_KEY = 'heardabout';

export const HEARD_ABOUT_OPTIONS = [
  { value: 'talesandtabletalk', label: 'Tales & Table Talk podcast' },
  { value: 'uhpn', label: 'Ultimate Homeschool Podcast Network' },
  { value: 'anotherpodcast', label: 'Another podcast' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'search', label: 'Google or another search' },
  { value: 'friendfamily', label: 'A friend or family member' },
  { value: 'other', label: 'Other' },
] as const;

export type HeardAbout = typeof HEARD_ABOUT_OPTIONS[number]['value'];

const VALUES: ReadonlySet<string> = new Set(HEARD_ABOUT_OPTIONS.map((o) => o.value));

/** A known answer, or null (blank, unknown or not a string): never throws, never rejects a sign-up or a sale. */
export function cleanHeardAbout(v: unknown): HeardAbout | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return VALUES.has(s) ? (s as HeardAbout) : null;
}

/** The Stripe Checkout custom field: an optional dropdown (create-checkout adds it to every session). */
export function heardAboutStripeField() {
  return {
    key: HEARD_ABOUT_STRIPE_KEY,
    label: { type: 'custom' as const, custom: HEARD_ABOUT_QUESTION },
    type: 'dropdown' as const,
    optional: true,
    dropdown: { options: HEARD_ABOUT_OPTIONS.map((o) => ({ label: o.label, value: o.value })) },
  };
}

/** The buyer's pick from a completed Checkout Session, or null if they skipped it or it is not there. */
export function heardAboutFromSession(session: { custom_fields?: unknown } | null | undefined): HeardAbout | null {
  const fields = session?.custom_fields;
  if (!Array.isArray(fields)) return null;
  for (const f of fields) {
    if (f && typeof f === 'object' && (f as { key?: unknown }).key === HEARD_ABOUT_STRIPE_KEY) {
      return cleanHeardAbout((f as { dropdown?: { value?: unknown } }).dropdown?.value);
    }
  }
  return null;
}
