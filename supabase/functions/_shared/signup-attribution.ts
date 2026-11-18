// (2026-11-18, Lane 2 area 11 T3; Camila's tap "Yes, build + ship")
//
// Quiz sign-ups lost their landing page and UTMs: the quiz page sends getAttribution() (src/pages/Assessment.tsx),
// but resend-waitlist leaves the quiz_funnel waitlist_signups row to the quiz_completions trigger, which has no
// attribution columns. 8 of 8 quiz sign-ups in 30 days had no source_url. resend-waitlist now fills the row after
// the trigger has written it, first touch only (rows that have no landing page yet). Pure, so it is tested.

export interface SignupAttribution {
  source_url?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
}

const FIELDS: (keyof SignupAttribution)[] = ['source_url', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/** The PATCH body: only the fields that carry a value. Empty object = nothing to write. */
export function attributionPatch(a: SignupAttribution): Partial<Record<keyof SignupAttribution, string>> {
  const out: Partial<Record<keyof SignupAttribution, string>> = {};
  for (const f of FIELDS) {
    const v = a[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim();
  }
  return out;
}

/** PostgREST filter for the quiz row to fill: this email's row in this funnel that has no landing page yet. */
export function attributionFillFilter(email: string, funnel: string): string {
  return `email=eq.${encodeURIComponent(email)}&entry_funnel=eq.${encodeURIComponent(funnel)}&source_url=is.null`;
}
