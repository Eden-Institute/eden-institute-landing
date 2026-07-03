// ── founders-lock ──
// Sprouts preorder "founder's price + first access" capture.
//
// The CTA button in the announcement email links here with a signed token
// (HMAC over {email, name, source}, same key/scheme as the unsubscribe EF).
//   GET  ?t=<token>  -> branded form: email is known, they add name + phone +
//                       an SMS opt-in checkbox.
//   POST (token in body) -> upsert {email, first_name, phone, sms_consent,
//                       source} into public.founders_interest (table is created
//                       on first use via the injected SUPABASE_DB_URL), add the
//                       email to the "Sprouts Founders Interest" Resend audience,
//                       optionally send a Twilio confirmation text, and show a
//                       branded confirmation page.
//
// Admin routes (guarded by FOUNDERS_ADMIN_TOKEN) are for end-to-end testing:
//   ?admin=TOKEN&action=diag                         -> env + DB connectivity
//   ?admin=TOKEN&action=signlink&e=&n=&c=            -> the form URL
//   ?admin=TOKEN&action=testsend&to=&n=&c=           -> send Email #1 to one addr
//
// verify_jwt=false (public; the link is HMAC-signed). Voice rule: no em dashes.

import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { shopApothecaryCard } from '../_shared/shop-cta.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const DB_URL = Deno.env.get('SUPABASE_DB_URL') ?? '';
const ADMIN_TOKEN = Deno.env.get('FOUNDERS_ADMIN_TOKEN') ?? '';
const AUDIENCE_NAME = 'Sprouts Founders Interest';
const FROM = 'Camila at The Eden Institute <hello@edeninstitute.health>';
const SUBJECT = 'You spoke, we listened: the first two weeks of Sprouts just got better';

const B = { forest: '#2C3E2D', deep: '#1C3A2E', gold: '#C5A44E', sage: '#5C7A5C', text: '#3D3832', cream: '#F7F2E8', footer: '#CDBF9B' };
const LM = 'https://edeninstitute.health/lead-magnets';

// ── b64url + HMAC (mirrors _shared/email-unsubscribe.ts) ──
function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function secret(): string {
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!s) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return s;
}
async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}
async function sign(obj: Record<string, unknown>): Promise<string> {
  const payload = JSON.stringify(obj);
  return `${b64urlEncode(new TextEncoder().encode(payload))}.${b64urlEncode(await hmac(payload))}`;
}
async function verify(token: string): Promise<Record<string, unknown> | null> {
  try {
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const p = token.slice(0, dot), sig = token.slice(dot + 1);
    const payload = new TextDecoder().decode(b64urlDecode(p));
    const expected = b64urlEncode(await hmac(payload));
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0 ? JSON.parse(payload) : null;
  } catch { return null; }
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const formToken = (email: string, name: string, source: string) => sign({ e: email.trim().toLowerCase(), n: (name || '').trim(), c: source || 'sprouts_upgrade_email1' });
const unsubToken = (email: string) => sign({ e: email.trim().toLowerCase(), l: 'homeschool' });
const formUrl = (t: string) => `https://edeninstitute.health/sprouts-founders.html?t=${encodeURIComponent(t)}`;
const unsubUrl = (t: string) => `${SUPABASE_URL}/functions/v1/unsubscribe?token=${encodeURIComponent(t)}`;

// ── DB (direct connection via injected SUPABASE_DB_URL) ──
async function withDb<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: 'require', prepare: false, max: 1 });
  try { return await fn(sql); } finally { await sql.end({ timeout: 5 }); }
}
async function ensureTable(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS public.founders_interest (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    first_name text,
    phone text,
    sms_consent boolean NOT NULL DEFAULT false,
    source text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
}
async function upsertInterest(email: string, name: string, phone: string, consent: boolean, source: string): Promise<void> {
  await withDb(async (sql) => {
    await ensureTable(sql);
    await sql`INSERT INTO public.founders_interest (email, first_name, phone, sms_consent, source)
      VALUES (${email}, ${name || null}, ${phone || null}, ${consent}, ${source || null})
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, public.founders_interest.first_name),
        phone = COALESCE(EXCLUDED.phone, public.founders_interest.phone),
        sms_consent = EXCLUDED.sms_consent OR public.founders_interest.sms_consent,
        source = COALESCE(public.founders_interest.source, EXCLUDED.source),
        updated_at = now()`;
  });
}

// ── Resend audience ──
let cachedAudienceId: string | null = null;
async function ensureAudience(): Promise<string> {
  if (cachedAudienceId) return cachedAudienceId;
  const list = await fetch('https://api.resend.com/audiences', { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
  const data = await list.json().catch(() => ({}));
  const found = (data?.data ?? []).find((a: { name?: string; id?: string }) => a.name === AUDIENCE_NAME);
  if (found?.id) { cachedAudienceId = found.id; return found.id; }
  const created = await fetch('https://api.resend.com/audiences', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: AUDIENCE_NAME }) });
  const cd = await created.json();
  cachedAudienceId = cd.id;
  return cd.id;
}
async function addContact(email: string, name: string): Promise<void> {
  const id = await ensureAudience();
  await fetch(`https://api.resend.com/audiences/${id}/contacts`, { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, first_name: (name || '').trim(), unsubscribed: false }) });
}

// ── Compliant blast sender for Email #1 (skips global unsubscribes + homeschool opt-outs, idempotent via send-log) ──
const CAMPAIGN = 'sprouts_upgrade_email1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ensureSendLog(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS public.founders_send_log (campaign text NOT NULL, email text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (campaign, email))`;
}
async function sendOne(email: string, name: string): Promise<boolean> {
  const html = announcementHtml(name, formUrl(await formToken(email, name, CAMPAIGN)), unsubUrl(await unsubToken(email)));
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [email], subject: SUBJECT, html }) });
  return r.ok;
}

// ── Twilio confirmation text (gated on secrets + consent) ──
function normalizePhone(raw: string): string {
  const d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return d ? `+${d}` : '';
}
async function sendSms(toPhone: string, body: string): Promise<{ skipped?: boolean; status?: number }> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const tok = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM');
  const msvc = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!sid || !tok || (!from && !msvc) || !toPhone) return { skipped: true };
  const params = new URLSearchParams();
  params.set('To', toPhone);
  if (msvc) params.set('MessagingServiceSid', msvc); else params.set('From', from!);
  params.set('Body', body);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${sid}:${tok}`), 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  return { status: r.status };
}

// ── Email #1 (locked copy: gratitude + read-aloud + updated downloads + first-access CTA) ──
const W1: [string, string][] = [
  ['Read-Aloud: Meet the Family', `${LM}/hs-sprouts-w1-ra-lavender.pdf`], ["Teacher's Guide", `${LM}/hs-sprouts-w1-tg-lavender.pdf`], ['Student Notebook', `${LM}/hs-sprouts-w1-nb-lavender.pdf`], ['Around the Table Cards', `${LM}/hs-sprouts-w1-att-lavender.pdf`], ['Field Cards', `${LM}/hs-sprouts-w1-fc-lavender.pdf`], ['Recipe Cards', `${LM}/hs-sprouts-w1-rc-lavender.pdf`],
];
const W2: [string, string][] = [
  ['Read-Aloud: Story 1', `${LM}/hs-sprouts-story-1.pdf`], ["Teacher's Guide", `${LM}/hs-sprouts-w2-tg-chamomile.pdf`], ['Student Notebook', `${LM}/hs-sprouts-w2-nb-chamomile.pdf`], ['Around the Table Cards', `${LM}/hs-sprouts-w2-att-chamomile.pdf`], ['Field Cards', `${LM}/hs-sprouts-w2-fc-chamomile.pdf`], ['Recipe Cards', `${LM}/hs-sprouts-w2-rc-chamomile.pdf`],
];
function dlGroup(title: string, items: [string, string][]): string {
  const rows = items.map(([l, h]) => `<tr><td style="padding:4px 0;font-family:Georgia,serif;font-size:14px;">&#9826;&nbsp; <a href="${h}" style="color:${B.sage};text-decoration:underline;">${l}</a></td></tr>`).join('');
  return `<p style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:${B.deep};margin:14px 0 4px;">${title}</p><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`;
}
const para = (t: string) => `<p style="font-family:Georgia,serif;font-size:15px;line-height:1.75;color:${B.text};margin:0 0 14px;">${t}</p>`;
function bigButton(label: string, href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td align="center"><a href="${href}" target="_blank" style="display:inline-block;background:${B.gold};color:${B.forest};font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;padding:15px 32px;border-radius:8px;">${label}</a></td></tr></table>`;
}
function announcementHtml(firstName: string, formLink: string, unsub: string): string {
  const name = firstName || 'friend';
  return `<!doctype html><html><body style="margin:0;background:#EFE9DA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE9DA;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${B.cream};border-radius:10px;overflow:hidden;">
<tr><td style="background:${B.forest};padding:24px;text-align:center;"><div style="color:${B.gold};font-family:Georgia,serif;font-size:20px;letter-spacing:2px;">THE EDEN INSTITUTE</div><div style="color:${B.footer};font-family:Georgia,serif;font-size:11px;letter-spacing:1.5px;margin-top:5px;">BIBLICAL HERBALISM</div></td></tr>
<tr><td style="padding:28px 30px;">
  <p style="font-family:Georgia,serif;font-size:17px;color:${B.deep};margin:0 0 18px;">Hi ${name},</p>
  ${para('Thank you for stepping into this work with us. So much of what shaped Sprouts came from mamas like you who actually used it at your own tables and told us honestly what was working and what could be better. You spoke, we listened, and because of you we went back and refined the first two weeks of the program.')}
  ${para('The change I am most glad to share is this. A read-aloud story now opens the week, matched to that week&rsquo;s herb. Week 1 begins with &ldquo;Meet the Family,&rdquo; which introduces the Eden family (Vov&oacute; and PopPop on their Tennessee homestead, Levi and Ruthie raising big-hearted Manny, watchful Evie, and fiery little Gracie, plus Bear the goofy dog). It is woven around Lavender&rsquo;s themes of calm and rest, so the week has a heart and a story your children remember before a single lesson begins. Week 2 carries the story forward into the Chamomile week.')}
  ${para('Your refreshed Week 1 and Week 2 materials are ready to download below, all six pieces for each week, including the new read-aloud:')}
  ${dlGroup('Week 1 &middot; Lavender', W1)}
  ${dlGroup('Week 2 &middot; Chamomile', W2)}
  <div style="border-top:1px solid #E0D7C2;margin:22px 0 6px;"></div>
  ${para('Preorders for a limited run of 500 kits open soon, and this list hears first. Add your name and phone number and we will email and text you the moment preorders open, before we announce it anywhere else, and hold your founding price of $249 for the complete 36-week kit. Once preorders reach 500 kits, the founding price rises to $349.')}
  ${bigButton("Reserve my $249 price + first access", formLink)}
  <p style="font-family:Georgia,serif;font-size:13px;color:#8A8470;text-align:center;margin:0;">We post on Facebook too, but our list always hears first. <a href="https://www.facebook.com/TheEdenInstituteBiblicalHerbalism" style="color:${B.sage};">Follow along.</a></p>
  <p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${B.text};margin:22px 0 2px;">Grace and health,</p>
  <p style="font-family:Georgia,serif;font-size:15px;font-weight:bold;color:${B.deep};margin:0;">Camila</p>
  <p style="font-family:Georgia,serif;font-size:13px;color:${B.text};margin:3px 0 0;">The Eden Institute</p>
  <p style="font-family:Georgia,serif;font-size:13px;margin:3px 0 0;"><a href="https://edeninstitute.health" style="color:${B.sage};">edeninstitute.health</a></p>
  ${shopApothecaryCard()}
</td></tr>
<tr><td style="background:${B.forest};padding:16px 22px;text-align:center;"><div style="color:${B.footer};font-family:Georgia,serif;font-size:11px;line-height:1.6;">The Eden Institute &middot; Rooted in Faith Ventures LLC<br><a href="${unsub}" style="color:${B.gold};text-decoration:underline;">Unsubscribe from these homeschool emails</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

// ── form + confirmation pages ──
function shell(inner: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Eden Institute</title></head><body style="margin:0;background:#EFE9DA;font-family:Georgia,serif;">
<table role="presentation" width="100%" style="padding:36px 16px;"><tr><td align="center">
<table role="presentation" width="540" style="width:540px;max-width:540px;background:${B.cream};border-radius:12px;overflow:hidden;">
<tr><td style="background:${B.forest};padding:24px;text-align:center;"><div style="color:${B.gold};font-size:20px;letter-spacing:2px;">THE EDEN INSTITUTE</div></td></tr>
<tr><td style="padding:32px 30px;">${inner}</td></tr></table></td></tr></table></body></html>`;
}
function formPage(email: string, name: string, token: string, err = ''): string {
  return shell(`
<h1 style="font-size:23px;color:${B.deep};margin:0 0 10px;">Reserve your $249 founder's price</h1>
<p style="font-size:15px;line-height:1.7;color:${B.text};margin:0 0 18px;">You will be first to know when preorders open, by email and text, before we announce it anywhere else. Add your details to lock it in.</p>
${err ? `<p style="font-size:14px;color:#993C1D;margin:0 0 14px;">${err}</p>` : ''}
<form method="POST" action="${SUPABASE_URL}/functions/v1/founders-lock">
  <input type="hidden" name="t" value="${token}">
  <label style="display:block;font-size:13px;color:${B.text};margin:0 0 4px;">Email</label>
  <input type="email" value="${email}" disabled style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #D9CFB8;border-radius:8px;background:#EEE7D6;color:#6b665a;font-size:15px;margin:0 0 14px;">
  <label style="display:block;font-size:13px;color:${B.text};margin:0 0 4px;">Your name</label>
  <input type="text" name="name" value="${name}" required placeholder="First name" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #D9CFB8;border-radius:8px;font-size:15px;margin:0 0 14px;">
  <label style="display:block;font-size:13px;color:${B.text};margin:0 0 4px;">Mobile number (for preorder alerts)</label>
  <input type="tel" name="phone" required placeholder="(555) 123-4567" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #D9CFB8;border-radius:8px;font-size:15px;margin:0 0 14px;">
  <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:${B.text};margin:0 0 18px;line-height:1.5;">
    <input type="checkbox" name="sms_consent" value="yes" checked style="margin-top:3px;">
    <span>Yes, text me Sprouts preorder and founding-price alerts at this number. Message and data rates may apply; reply STOP to opt out anytime.</span>
  </label>
  <button type="submit" style="width:100%;background:${B.gold};color:${B.forest};font-family:Georgia,serif;font-size:16px;font-weight:bold;border:none;padding:15px;border-radius:8px;cursor:pointer;">Lock in my $249 founder's price</button>
</form>`);
}
function confirmationPage(name: string): string {
  const n = name || 'friend';
  return shell(`
<div style="text-align:center;">
<div style="font-size:40px;color:${B.gold};">&#9826;</div>
<h1 style="font-size:24px;color:${B.deep};margin:8px 0 12px;">You&rsquo;re locked in, ${n}.</h1>
<p style="font-size:16px;line-height:1.7;color:${B.text};margin:0 0 14px;">Your founding price of <strong>$249</strong> for the complete 36-week Sprouts kit is reserved, and you are on the first-access list. When preorders open, you will hear from us by email and text before we announce it anywhere else.</p>
<a href="https://www.facebook.com/TheEdenInstituteBiblicalHerbalism" style="display:inline-block;background:${B.gold};color:${B.forest};font-size:15px;font-weight:bold;text-decoration:none;padding:13px 28px;border-radius:8px;">Follow along on Facebook</a>
<p style="font-size:15px;color:${B.text};margin:24px 0 0;">Grace and health,<br><strong>Camila</strong></p>
</div>`);
}

// ── helpers ──
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const jsonRes = (s: number, o: unknown) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const htmlRes = (s: number, b: string) => new Response(b, { status: s, headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);

  // Admin (e2e) routes. The admin token is read from the x-admin-token header
  // (not the query string, which leaks into access logs / browser history /
  // Referer) and compared in constant time. Invoke with, e.g.:
  //   curl -H "x-admin-token: $TOKEN" ".../founders-lock?action=diag"
  const admin = req.headers.get('x-admin-token');
  if (admin) {
    if (!ADMIN_TOKEN || !timingSafeEqual(admin, ADMIN_TOKEN)) return jsonRes(401, { error: 'unauthorized' });
    const action = url.searchParams.get('action');
    const e = url.searchParams.get('e') ?? url.searchParams.get('to') ?? '';
    const n = url.searchParams.get('n') ?? 'friend';
    const c = url.searchParams.get('c') ?? 'sprouts_upgrade_email1';
    if (action === 'diag') {
      let dbOk = false, dbErr = '';
      try { await withDb(async (sql) => { await ensureTable(sql); await sql`SELECT 1`; }); dbOk = true; } catch (err) { dbErr = String(err); }
      return jsonRes(200, { hasDbUrl: !!DB_URL, hasResend: !!RESEND_API_KEY, hasTwilio: !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN')), dbOk, dbErr });
    }
    if (action === 'signlink') return jsonRes(200, { url: formUrl(await formToken(e, n, c)) });
    if (action === 'testsend') {
      if (!e) return jsonRes(400, { error: 'missing to' });
      const html = announcementHtml(n, formUrl(await formToken(e, n, c)), unsubUrl(await unsubToken(e)));
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to: [e], subject: SUBJECT, html }) });
      return jsonRes(r.status, await r.json().catch(() => ({})));
    }
    if (action === 'dryrun') {
      const src = url.searchParams.get('source') ?? 'sprouts_magnet';
      const out = await withDb(async (sql) => {
        await ensureSendLog(sql);
        const bySource = await sql`SELECT source, count(*)::int AS n FROM public.waitlist_signups WHERE entry_funnel='edens_table' AND unsubscribed_at IS NULL GROUP BY source ORDER BY n DESC`;
        const sendable = await sql`SELECT count(*)::int AS n FROM public.waitlist_signups w WHERE entry_funnel='edens_table' AND source=${src} AND unsubscribed_at IS NULL AND lower(email) NOT IN (SELECT lower(email) FROM public.email_list_unsubscribes WHERE list='homeschool') AND lower(email) NOT IN (SELECT lower(email) FROM public.founders_send_log WHERE campaign=${CAMPAIGN})`;
        return { source: src, bySourceLiveNonUnsub: bySource, sendableNow: sendable[0]?.n ?? 0 };
      });
      return jsonRes(200, out);
    }
    if (action === 'send') {
      if (url.searchParams.get('confirm') !== 'SEND') return jsonRes(400, { error: 'append &confirm=SEND to actually send' });
      const src = url.searchParams.get('source') ?? 'sprouts_magnet';
      const batch = Math.min(Number(url.searchParams.get('batch') ?? '50'), 200);
      const out = await withDb(async (sql) => {
        await ensureSendLog(sql);
        const rows = await sql`SELECT email, first_name FROM public.waitlist_signups w WHERE entry_funnel='edens_table' AND source=${src} AND unsubscribed_at IS NULL AND lower(email) NOT IN (SELECT lower(email) FROM public.email_list_unsubscribes WHERE list='homeschool') AND lower(email) NOT IN (SELECT lower(email) FROM public.founders_send_log WHERE campaign=${CAMPAIGN}) ORDER BY created_at ASC LIMIT ${batch}`;
        let sent = 0, failed = 0;
        for (const row of rows as unknown as { email: string; first_name: string | null }[]) {
          const ok = await sendOne(row.email, row.first_name ?? '');
          if (ok) { await sql`INSERT INTO public.founders_send_log (campaign, email) VALUES (${CAMPAIGN}, ${row.email}) ON CONFLICT DO NOTHING`; sent++; } else failed++;
          await sleep(150);
        }
        const rem = await sql`SELECT count(*)::int AS n FROM public.waitlist_signups w WHERE entry_funnel='edens_table' AND source=${src} AND unsubscribed_at IS NULL AND lower(email) NOT IN (SELECT lower(email) FROM public.email_list_unsubscribes WHERE list='homeschool') AND lower(email) NOT IN (SELECT lower(email) FROM public.founders_send_log WHERE campaign=${CAMPAIGN})`;
        return { sent, failed, remaining: rem[0]?.n ?? 0 };
      });
      return jsonRes(200, out);
    }
    return jsonRes(400, { error: 'unknown action' });
  }

  // POST: form submission from the hosted page (JSON), with a form-encoded fallback.
  if (req.method === 'POST') {
    let token = '', name = '', phoneRaw = '', consent = false;
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      token = String(body.t ?? '');
      name = String(body.name ?? '').trim();
      phoneRaw = String(body.phone ?? '');
      consent = body.sms_consent === true || body.sms_consent === 'yes';
    } else {
      const form = await req.formData().catch(() => null);
      token = String(form?.get('t') ?? '');
      name = String(form?.get('name') ?? '').trim();
      phoneRaw = String(form?.get('phone') ?? '');
      consent = String(form?.get('sms_consent') ?? '') === 'yes';
    }
    const v = token ? await verify(token) : null;
    if (!v || typeof v.e !== 'string') return jsonRes(400, { ok: false, error: 'invalid_token' });
    const phone = normalizePhone(phoneRaw);
    if (!name || !phone) return jsonRes(400, { ok: false, error: 'missing_fields' });
    try {
      await upsertInterest(v.e as string, name, phone, consent, (v.c as string) ?? 'sprouts_upgrade_email1');
      await addContact(v.e as string, name);
      if (consent && phone) {
        await sendSms(phone, "You're on the Sprouts founder's list. We'll text you the moment preorders open, before anyone else. Grace and health, Camila at The Eden Institute. Reply STOP to opt out.").catch(() => {});
      }
    } catch (err) {
      console.error('founders-lock submit failed:', String(err));
      return jsonRes(500, { ok: false, error: 'save_failed' });
    }
    return jsonRes(200, { ok: true, name });
  }

  // GET: redirect to the hosted form page. (The Supabase functions domain forces
  // text/plain + nosniff, so the interactive form is served from edeninstitute.health.)
  const t = url.searchParams.get('t');
  const dest = t
    ? `https://edeninstitute.health/sprouts-founders.html?t=${encodeURIComponent(t)}`
    : 'https://edeninstitute.health/sprouts-founders.html';
  return new Response(null, { status: 302, headers: { ...CORS, Location: dest } });
});
