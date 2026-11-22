// wired-submit: score and store one completed quiz (Fearfully & Wonderfully Wired, W3;
// spec sections 7.1, 7.2, 8 + section 18 answers 9 and 14). Public POST, DARK until
// WIRED_ENABLED. verify_jwt = false (config.toml).
//
// Flow: dark gate -> rate limits (60 per IP per hour, 10 per email per hour; fail open)
// -> parse + validate -> processSubmission (_shared/wired-submit-flow.ts: score, blend,
// match, ONE RPC write) -> a signed results token.
// If the database cannot be reached (5xx or network, after the RPC call itself): the full
// payload goes to wired_failures and the caller gets 502 {saved: true}; the replay cron
// (wired-replay-failures, every 30 min) finishes it. Email 1 + the free PDF land in W7/W8.
// 2026-11-21: her own questions (adult-v1) may come from her private results page as {set: 'adult', token}; the
// family's email is read from the token, and her first answers queue the complete Family Map once (when she has one).

import { bumpRateBucket, clientIp } from '../_shared/rate-bucket.ts';
import { parseSubmission } from '../_shared/wired-submit-core.ts';
import { adultBodyFromToken, type Db, processSubmission, WiredBadRequest, WiredUnavailable } from '../_shared/wired-submit-flow.ts';
import { signWiredToken } from '../_shared/wired-token.ts';
import { wiredGate, wiredJson } from '../_shared/wired-gate.ts';

const IP_PER_HOUR = 60;
const EMAIL_PER_HOUR = 10;

async function deadLetter(db: Db, body: unknown, email: string | null, status: number | null, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${db.url}/rest/v1/wired_failures`, {
      method: 'POST',
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email_lower: email, raw_payload: body ?? {}, postgrest_status: status, ef_error_message: message.slice(0, 500) }),
      signal: AbortSignal.timeout(15_000),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const gate = wiredGate(req);
  if (gate) return gate;
  if (req.method !== 'POST') return wiredJson(405, { error: 'method_not_allowed' });

  const db: Db = { url: Deno.env.get('SUPABASE_URL') ?? '', key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' };
  const pepper = Deno.env.get('WIRED_EMAIL_PEPPER') ?? '';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return wiredJson(400, { error: 'body must be JSON' });
  }
  // 2026-11-21: her own questions from her private results page ({set: 'adult', token}): the family's email comes
  // from the token's family, never from the page.
  try {
    const resolved = await adultBodyFromToken(db, body);
    if (resolved === null) return wiredJson(401, { error: 'invalid_or_expired_link' });
    body = resolved;
  } catch (err) {
    if (err instanceof WiredUnavailable) return wiredJson(502, { error: 'try_again' });
    console.error('wired-submit: cannot read the results token:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'server_misconfigured' });
  }
  const parsed = parseSubmission(body);
  if (!parsed.ok) return wiredJson(400, { error: 'invalid', details: parsed.errors });
  const sub = parsed.value;

  const ip = clientIp(req);
  const [ipCount, emailCount] = await Promise.all([
    ip ? bumpRateBucket({ supabaseUrl: db.url, serviceKey: db.key, key: `wired_submit:ip:${ip}`, windowSeconds: 3600 }) : Promise.resolve(null),
    bumpRateBucket({ supabaseUrl: db.url, serviceKey: db.key, key: `wired_submit:email:${sub.email}`, windowSeconds: 3600 }),
  ]);
  if ((ipCount ?? 0) > IP_PER_HOUR || (emailCount ?? 0) > EMAIL_PER_HOUR) {
    return wiredJson(429, { error: 'too_many', message: 'Too many quizzes from here in the last hour. Please try again a little later.' });
  }

  let outcome;
  try {
    try {
      outcome = await processSubmission(db, sub, { pepper });
    } catch (err) {
      if (!(err instanceof WiredUnavailable)) throw err;
      outcome = await processSubmission(db, sub, { pepper }); // retry once, like record-quiz-completion
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof WiredBadRequest) return wiredJson(400, { error: 'invalid', details: [message] });
    if (err instanceof WiredUnavailable) {
      const saved = await deadLetter(db, body, sub.email, null, message);
      console.error(`wired-submit: database unavailable, dead-lettered=${saved}: ${message}`);
      return wiredJson(502, { error: 'saved_for_later', saved, message: 'We saved your answers. Your results are on their way by email.' });
    }
    console.error('wired-submit: failed:', message);
    return wiredJson(500, { error: 'could_not_save' });
  }

  if (outcome.status === 'unknown_child') return wiredJson(404, { error: 'unknown_child' });
  let token: string;
  try {
    token = await signWiredToken({ familyId: outcome.family_id, purpose: 'results' });
  } catch (err) {
    console.error('wired-submit: cannot sign the results token:', err instanceof Error ? err.message : String(err));
    return wiredJson(500, { error: 'could_not_sign' });
  }
  if (outcome.status === 'already_completed') {
    return wiredJson(409, { status: 'already_completed', child_id: outcome.child_id ?? null, token });
  }
  // W8a: email 1 was queued (or, 2026-11-21, the complete Family Map after her own questions); nudge wired-pdf so it
  // goes out in seconds (the 5-minute cron is the backstop).
  if (outcome.unlocked || outcome.family_map_update) runInBackground(kickWiredPdf(db));
  return wiredJson(200, { status: 'ok', child_id: outcome.child_id ?? null, token, results: outcome.results ?? null });
});

function runInBackground(p: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(p);
  else void p;
}

/** Fire-and-forget nudge to wired-pdf (service role). Never throws. */
async function kickWiredPdf(db: Db): Promise<void> {
  try {
    const res = await fetch(`${db.url}/functions/v1/wired-pdf`, {
      method: 'POST', headers: { Authorization: `Bearer ${db.key}`, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!res.ok) console.warn(`wired-submit: wired-pdf kick returned ${res.status}; cron will pick it up`);
  } catch (err) {
    console.warn('wired-submit: wired-pdf kick failed; cron will pick it up:', err instanceof Error ? err.message : String(err));
  }
}
