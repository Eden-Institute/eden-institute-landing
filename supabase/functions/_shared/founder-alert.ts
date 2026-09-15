// supabase/functions/_shared/founder-alert.ts
//
// Plain-text email to the founder, for functions that must not pull in the
// order/Lulu stack just to raise a flag. Same env names, sender and behaviour
// as notifyFounder in _shared/lulu-fulfillment.ts (which lulu-webhook keeps
// using); that one is left untouched so its importers do not go stale.
//
// Never throws. Returns true only when Resend accepted the email, so a caller
// that records "alerted" can leave the record unset and try again next run.

import { captureException } from './sentry.ts';

export async function alertFounder(subject: string, text: string, source: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
  const from = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';
  if (!resendKey) {
    console.error(`${source}: RESEND_API_KEY missing; could not send founder alert "${subject}"`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await res.body?.cancel();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${source}: founder alert "${subject}" failed: ${message}`);
    await captureException(err, { function: source, stage: 'founder-alert', subject });
    return false;
  }
}
