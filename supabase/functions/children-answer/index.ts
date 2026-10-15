// ── children-answer ──
//
// Records the day-2 "Do you have children at home?" tap from the quiz and Back to Eden
// Chapter 1 tracks (founder-approved 2026-10-15). Only a Yes gets the day-6 email.
//
//   POST JSON { t: <signed token>, a: 'yes' | 'no' }  → upsert public.children_at_home_answers
//   (from web/pages/answer.astro, in the reader's browser)
//
// Never writes on a GET: the email links open the site page, not this function, and link
// scanners that fetch the page do not run its script. The latest answer wins, so someone
// who taps No and then Yes is a Yes.
//
// verify_jwt = false (config.toml): called from a public page with no session. The signed
// token is the security (_shared/children-answer.ts). CORS is the site allowlist.

import { allowlistCorsHeaders } from '../_shared/cors-allowlist.ts';
import { parseAnswer, verifyAnswerToken } from '../_shared/children-answer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async (req: Request) => {
  const cors = allowlistCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { t?: unknown; a?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const answer = parseAnswer(body.a);
  const who = await verifyAnswerToken(body.t);
  if (answer === null || !who) return json({ ok: false, status: 'invalid' }, 400);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/children_at_home_answers?on_conflict=email`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify({
      email: who.email,
      has_children: answer,
      track: who.track,
      answered_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    console.error('children-answer: upsert failed', res.status, (await res.text().catch(() => '')).slice(0, 300));
    return json({ ok: false, status: 'error' }, 502);
  }
  return json({ ok: true, answer: answer ? 'yes' : 'no' });
});
