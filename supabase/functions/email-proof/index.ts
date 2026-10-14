// supabase/functions/email-proof/index.ts
//
// FOUNDER PROOF: send ONE draft email to the founder exactly as a family would receive it,
// so she can read it in her own inbox and approve it before anything is loaded, merged,
// deployed or scheduled (founder law 2026-10-14: every nurture email is approved this way).
//
// The recipient is ALWAYS the founder address from public.app_settings
// (_shared/founder-identity.ts). It is never taken from the request, so this function
// cannot mail anyone else, whatever a caller sends.
//
// POST JSON (service role only; verify_jwt pinned true in supabase/config.toml):
//   {
//     "subject": "Don't leave it in your inbox",
//     "html": "<!DOCTYPE html>...",          // rendered by the REAL template builders
//     "from": "camila" | "institute" | "ttt", // the sender line the real rail uses
//     "list": "homeschool",                    // which unsubscribe list the real email belongs to
//     "utm": { "medium": "nurture", "content": "magnet_nextmorning_sprouts", "campaign": "homeschool" }
//   }
//
// It applies the same two steps every real sender applies before Resend sees the email:
// applyUnsub (footer link + List-Unsubscribe headers) and tagEmailHtml (UTM tags). So the
// proof shows the real From line, subject, preview text, layout, links and footer.
// Proofs carry the Resend tag campaign=founder_proof so they never count as engagement.
// The unsubscribe link in a proof is real: clicking it opts the founder out of that list.

import { applyUnsub, isEmailList } from '../_shared/email-unsubscribe.ts';
import { tagEmailHtml } from '../_shared/email-utm.ts';
import { resolveFounderEmail } from '../_shared/founder-identity.ts';
import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const SENDERS: Record<string, string> = {
  camila: 'Camila at The Eden Institute <hello@edeninstitute.health>',
  institute: 'The Eden Institute <hello@edeninstitute.health>',
  ttt: 'Tales & Table Talk <hello@edeninstitute.health>',
};
const REPLY_TO = 'hello@edeninstitute.health';
const MAX_HTML_BYTES = 400_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tagValue(value: unknown): string | null {
  // Resend tag values: ASCII letters, numbers, underscores, dashes; at most 256 chars.
  if (typeof value !== 'string') return null;
  const v = value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
  return v || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);
  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY missing' }, 503);

  let body: {
    subject?: unknown;
    html?: unknown;
    from?: unknown;
    list?: unknown;
    utm?: { medium?: unknown; content?: unknown; campaign?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const from = typeof body.from === 'string' ? SENDERS[body.from] : undefined;
  if (!subject || subject.length > 300) return json({ error: 'subject required (max 300 chars)' }, 400);
  if (!html || new TextEncoder().encode(html).length > MAX_HTML_BYTES) {
    return json({ error: `html required (max ${MAX_HTML_BYTES} bytes)` }, 400);
  }
  if (!from) return json({ error: `from must be one of ${Object.keys(SENDERS).join(', ')}` }, 400);
  if (!isEmailList(body.list)) return json({ error: 'list must be a known email list' }, 400);
  const list = body.list;

  const medium = typeof body.utm?.medium === 'string' ? body.utm.medium : 'nurture';
  const content = typeof body.utm?.content === 'string' ? body.utm.content : list;
  const campaign = typeof body.utm?.campaign === 'string' ? body.utm.campaign : undefined;

  const { email: to } = await resolveFounderEmail();

  const { html: unsubHtml, headers } = await applyUnsub(html, to, list);
  const finalHtml = tagEmailHtml(unsubHtml, { medium, content, campaign });

  const tags = [{ name: 'campaign', value: 'founder_proof' }];
  const key = tagValue(content);
  if (key) tags.push({ name: 'email_key', value: key });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, reply_to: REPLY_TO, to: [to], subject, html: finalHtml, headers, tags }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('email-proof send failed', res.status, JSON.stringify(data));
    return json({ error: data?.message || `Resend HTTP ${res.status}` }, 502);
  }
  return json({ sent: true, id: data?.id ?? null, subject });
});
