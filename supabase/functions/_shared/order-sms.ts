// supabase/functions/_shared/order-sms.ts
//
// SMS sender, copied from founders-lock (the only existing Twilio caller) so the preorder
// flow can send without importing across functions. If A2P 10DLC is not yet live or the
// Twilio secrets are absent, sendSms sends nothing and returns null (a graceful skip).

/**
 * The mobile number typed next to the SMS consent box on the print buy box, as "+1" and
 * 10 digits, or null when it is not a US phone number. A2P 10DLC wants the phone field on
 * the same form as the consent checkbox, so this is the number the buyer agreed to have
 * texted. Mirror of web/lib/smsPhone.ts; keep the two in step.
 */
export function usMobileE164(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return null;
  // North American numbering: the area code and the exchange never start with 0 or 1.
  if (d[0] === '0' || d[0] === '1' || d[3] === '0' || d[3] === '1') return null;
  return `+1${d}`;
}

export function normalizePhone(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  if (s.length === 10) return `+1${s}`;
  if (s.length === 11 && s.startsWith('1')) return `+${s}`;
  return `+${s}`;
}

/**
 * Basic-auth pair for the Twilio REST API. Prefers the scoped API key, which can be
 * revoked on its own, over TWILIO_AUTH_TOKEN, which is the master credential for the
 * whole account. Either way the URL still carries the account SID. Returns an empty
 * password when neither credential is configured, which callers treat as "skip".
 */
export function twilioBasicAuth(accountSid: string | undefined): [string, string] {
  const keySid = Deno.env.get('TWILIO_API_KEY_SID');
  const keySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
  if (keySid && keySecret) return [keySid, keySecret];
  return [accountSid ?? '', Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''];
}

/** Returns the Twilio message SID on success, or null if skipped (unconfigured / no number). */
export async function sendSms(toPhoneRaw: string | null | undefined, body: string): Promise<string | null> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const from = Deno.env.get('TWILIO_FROM');
  const msvc = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  const to = normalizePhone(toPhoneRaw);
  const [user, pass] = twilioBasicAuth(sid);
  if (!sid || !pass || (!from && !msvc) || !to) return null; // not configured / no number -> skip

  const params = new URLSearchParams();
  params.set('To', to);
  if (msvc) params.set('MessagingServiceSid', msvc);
  else params.set('From', from!);
  params.set('Body', body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`);
  const json = await res.json().catch(() => ({}));
  return (json && typeof json.sid === 'string') ? json.sid : null;
}
