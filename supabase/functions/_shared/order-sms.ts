// supabase/functions/_shared/order-sms.ts
//
// SMS sender, copied from founders-lock (the only existing Twilio caller) so the preorder
// flow can send without importing across functions. If A2P 10DLC is not yet live or the
// Twilio secrets are absent, sendSms sends nothing and returns null (a graceful skip).

export function normalizePhone(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  if (s.length === 10) return `+1${s}`;
  if (s.length === 11 && s.startsWith('1')) return `+${s}`;
  return `+${s}`;
}

/** Returns the Twilio message SID on success, or null if skipped (unconfigured / no number). */
export async function sendSms(toPhoneRaw: string | null | undefined, body: string): Promise<string | null> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const tok = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM');
  const msvc = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  const to = normalizePhone(toPhoneRaw);
  if (!sid || !tok || (!from && !msvc) || !to) return null; // not configured / no number -> skip

  const params = new URLSearchParams();
  params.set('To', to);
  if (msvc) params.set('MessagingServiceSid', msvc);
  else params.set('From', from!);
  params.set('Body', body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${tok}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`);
  const json = await res.json().catch(() => ({}));
  return (json && typeof json.sid === 'string') ? json.sid : null;
}
