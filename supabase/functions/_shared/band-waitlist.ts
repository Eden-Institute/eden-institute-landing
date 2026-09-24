// Waitlists for the grade bands not yet on sale: Cultivators (6-8) and
// Practitioners (9-12). Founder decision 2026-09-24: email plus an OPTIONAL
// phone, with an unticked consent box for launch-alert texts.
//
// PURE module, no imports, on purpose: the waitlist form
// (src/components/landing/WaitlistModal.tsx) imports smsConsentText() from this
// very file, so the words a visitor ticks and the words stored as their consent
// record (band_waitlist.sms_consent_text) cannot drift apart.
//
// The consent wording is founder-approved 2026-09-24, together with the matching
// Terms §18 and Privacy §4 paragraphs. Change all three together or none.
// Voice rule: no em dashes.

export type WaitlistBand = 'cultivators' | 'practitioners';

export const WAITLIST_BANDS: Record<WaitlistBand, { name: string; grades: string }> = {
  cultivators: { name: 'Cultivators', grades: 'grades 6-8' },
  practitioners: { name: 'Practitioners', grades: 'grades 9-12' },
};

/** 'cultivators_waitlist' -> 'cultivators'; anything else -> null. */
export function bandFromSource(source: string | null | undefined): WaitlistBand | null {
  const m = /^(cultivators|practitioners)_waitlist$/.exec(source ?? '');
  return m ? (m[1] as WaitlistBand) : null;
}

/** The exact words beside the unticked box, and the consent record stored with the number. */
export function smsConsentText(band: WaitlistBand): string {
  return `Text me when ${WAITLIST_BANDS[band].name} opens: launch alerts from The Eden Institute, up to 3 messages. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. See our Terms and Privacy Policy.`;
}

/**
 * A US mobile number in E.164 (+1XXXXXXXXXX), or null if it is not one.
 * Accepts the ways people actually type it: (931) 555-0100, 931.555.0100,
 * 9315550100, 1-931-555-0100, +1 931 555 0100. The area code and exchange
 * cannot start with 0 or 1 (NANP).
 */
export function normalizeUsPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `+1${ten}`;
}

export interface BandWaitlistInput {
  email: string;
  band: WaitlistBand;
  firstName: string | null;
  phoneRaw: unknown;
  smsConsent: unknown;
  sourceUrl: string | null;
  now: Date;
}

export type BandWaitlistResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * The band_waitlist row to upsert, or the visitor-facing error.
 * - A blank phone is fine (the phone is optional) and is simply left out of the
 *   row, so a later signup without a phone never erases an earlier one.
 * - A phone that is present but not a US number is an error, not a silent drop.
 * - Consent only counts with a valid phone; ticking the box with no number is an error.
 * - Consent is recorded ONLY when true. An unticked resubmit leaves an earlier
 *   consent alone; withdrawing consent is by replying STOP, per the Terms.
 */
export function buildBandWaitlistRow(i: BandWaitlistInput): BandWaitlistResult {
  const phoneGiven = typeof i.phoneRaw === 'string' && i.phoneRaw.trim() !== '';
  const phone = phoneGiven ? normalizeUsPhone(i.phoneRaw) : null;
  if (phoneGiven && !phone) {
    return { ok: false, error: 'That phone number does not look like a US mobile number. Please check it, or leave it blank.' };
  }
  const consent = i.smsConsent === true;
  if (consent && !phone) {
    return { ok: false, error: 'Please add your mobile number for the texts, or untick the box.' };
  }
  const row: Record<string, unknown> = {
    email: i.email,
    band: i.band,
    updated_at: i.now.toISOString(),
  };
  if (i.firstName) row.first_name = i.firstName;
  if (i.sourceUrl) row.source_url = i.sourceUrl;
  if (phone) row.phone = phone;
  if (consent) {
    row.sms_consent = true;
    row.sms_consent_text = smsConsentText(i.band);
    row.sms_consent_at = i.now.toISOString();
  }
  return { ok: true, row };
}
