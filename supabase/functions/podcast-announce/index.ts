// podcast-announce — email the Tales & Table Talk list (entry_funnel 'podcast').
//
// Punch #307. The podcast welcome email promises "You'll be the first to hear when the
// first episode goes live", and nothing else can reach this list: list-announce is hard
// filtered to entry_funnel 'edens_table' and founder-broadcast mails buyers only.
//
// A SEPARATE FUNCTION ON PURPOSE, not a funnel switch on list-announce. list-announce
// hard-codes one Eden campaign as its idempotency key and config.toml calls it the most
// dangerous function in the project by blast radius. Keeping the podcast rail apart
// means nothing done here can ever mail the Eden list, and vice versa.
//
// Modes (POST JSON { mode, ... }), identical in shape to list-announce:
//   preview → recipient count, sample addresses, and (when a campaign is loaded) the
//             rendered HTML for "Sarah". Sends nothing. Always run this first.
//   test    → send ONE copy to an explicit `to`. Not logged, repeatable while proofing.
//             With no campaign loaded it sends a clearly labelled internal rail check.
//   send    → send to the next `batch` recipients; REQUIRES `confirm_campaign` equal to
//             the campaign key preview returned (type-to-confirm). Loop until remaining
//             is 0. With no campaign loaded it answers 409 and sends nothing.
//
// LOADING A CAMPAIGN: set CAMPAIGN below to a PodcastCampaign (see
// _shared/podcast-email-templates.ts), merge, deploy, then preview, test, send. The copy
// lives in source on purpose, as in list-announce: it is reviewed in a PR, and a new key
// is the only thing that makes a new send. validatePodcastCampaign runs first; a
// campaign that fails it (em dash, non-https link, no named approval, bad key) cannot
// render, test or send.
//
// SUPPRESSION: see recipients.ts. Global bounces/complaints on ANY list, plus
// email_list_unsubscribes WHERE list = 'podcast', plus this campaign's send log.
//
// IDEMPOTENCY: founders_send_log (campaign, email) is claimed BEFORE each send, so a
// crash drops at most one email instead of re-mailing from the crash point. A transient
// failure (429 or 5xx) releases the claim so a later batch retries it. A permanent 4xx
// (for example a malformed address Resend rejects with 422) KEEPS the claim, so the same
// dead address is not retried in every batch (the known list-announce flaw).
//
// Gate: service role only, verify_jwt = true in config.toml. Nothing in a browser should
// ever be one request away from mailing a whole list.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyUnsub } from '../_shared/email-unsubscribe.ts';
import { isServiceRoleRequest } from '../_shared/require-service-role.ts';
import { checkCampaignConfirm } from '../_shared/send-confirm.ts';
import {
  buildPodcastBroadcastEmail,
  podcastShell,
  type PodcastCampaign,
  validatePodcastCampaign,
} from '../_shared/podcast-email-templates.ts';
import { normalizeEmail, selectPodcastRecipients, type Recipient, type SignupRow } from './recipients.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

// Same sender name as the podcast welcome email, so a subscriber sees one name.
const FROM = 'Tales & Table Talk <hello@edeninstitute.health>';
const REPLY_TO = 'hello@edeninstitute.health';

// No campaign is loaded. The first real one (episode 1 launch) needs the episode link
// and Camila's approved copy, and neither exists yet (2026-09-17). Until this is set,
// preview reports the list and test sends a rail check; send refuses.
// `as` (not a type annotation) so TypeScript keeps the union instead of narrowing the
// constant to `null`, which would make every CAMPAIGN.key below a type error.
const CAMPAIGN = null as PodcastCampaign | null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

// PostgREST caps every response at 1000 rows SILENTLY, so every read is paged. Getting
// this wrong does not error; it quietly mails a subset and reports success.
const PAGE = 500;

async function pagedEmails(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data ?? []) as Array<{ email: string | null }>;
    for (const r of rows) {
      const e = normalizeEmail(r.email);
      if (e) out.add(e);
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

async function recipients(db: ReturnType<typeof admin>, campaignKey: string | null): Promise<Recipient[]> {
  const podcastRows: SignupRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('waitlist_signups')
      .select('email, first_name, created_at')
      .eq('entry_funnel', 'podcast')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`waitlist_signups(podcast): ${error.message}`);
    const rows = (data ?? []) as SignupRow[];
    podcastRows.push(...rows);
    if (rows.length < PAGE) break;
  }

  const globallySuppressed = await pagedEmails(
    (f, t) =>
      db.from('waitlist_signups').select('email').not('unsubscribed_at', 'is', null)
        .order('email', { ascending: true }).range(f, t),
    'waitlist_signups(unsubscribed)',
  );
  const podcastOptOuts = await pagedEmails(
    (f, t) =>
      db.from('email_list_unsubscribes').select('email').eq('list', 'podcast')
        .order('email', { ascending: true }).range(f, t),
    'email_list_unsubscribes(podcast)',
  );
  const alreadySent = campaignKey
    ? await pagedEmails(
      (f, t) =>
        db.from('founders_send_log').select('email').eq('campaign', campaignKey)
          .order('email', { ascending: true }).range(f, t),
      'founders_send_log',
    )
    : new Set<string>();

  return selectPodcastRecipients({ podcastRows, globallySuppressed, podcastOptOuts, alreadySent });
}

/** Internal-only check that the sender, footer and podcast unsubscribe link all work. */
function railCheckEmail(): { subject: string; html: string } {
  const para = (t: string) =>
    `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#2A231E;margin:0 0 18px 0;">${t}</p>`;
  return {
    subject: '[Internal test] Tales & Table Talk list sender check',
    html: podcastShell(
      [
        para('This is an internal check of the Tales and Table Talk list sender.'),
        para('It went only to this address. No subscriber received it. No campaign is loaded yet, so a real send is still switched off.'),
      ].join('\n'),
      'Internal test: podcast list sender check',
    ),
  };
}

/** One send. Returns null on success, or { status, message } on failure. */
async function sendOne(
  to: string,
  content: { subject: string; html: string },
): Promise<{ status: number; message: string } | null> {
  const { html, headers } = await applyUnsub(content.html, to, 'podcast');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: content.subject, html, headers }),
  });
  if (res.ok) return null;
  return { status: res.status, message: (await res.text()).slice(0, 200) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!isServiceRoleRequest(req)) return json({ error: 'forbidden' }, 403);
  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY missing' }, 503);

  let payload: { mode?: string; to?: string; batch?: number; confirm_campaign?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const mode = payload.mode ?? 'preview';
  const campaignErrors = CAMPAIGN ? validatePodcastCampaign(CAMPAIGN) : [];
  if (campaignErrors.length) {
    // A loaded but invalid campaign blocks every mode, preview included, so it is
    // impossible to proof or send copy that breaks the rules.
    return json({ mode, error: 'campaign failed validation', campaign_errors: campaignErrors }, 422);
  }
  const db = admin();

  try {
    if (mode === 'preview') {
      const list = await recipients(db, CAMPAIGN?.key ?? null);
      const rendered = CAMPAIGN ? buildPodcastBroadcastEmail('Sarah', CAMPAIGN) : null;
      return json({
        mode,
        campaign: CAMPAIGN?.key ?? null,
        campaign_loaded: !!CAMPAIGN,
        subject: CAMPAIGN?.subject ?? null,
        approved_by: CAMPAIGN?.approvedBy ?? null,
        remaining: list.length,
        sample_recipients: list.slice(0, 5).map((r) => r.email),
        html_bytes: rendered?.html.length ?? 0,
        html: rendered?.html ?? null,
      });
    }

    if (mode === 'test') {
      const to = (payload.to ?? '').trim();
      if (!to.includes('@')) return json({ error: 'test mode needs a valid `to`' }, 400);
      const content = CAMPAIGN ? buildPodcastBroadcastEmail('Camila', CAMPAIGN) : railCheckEmail();
      const err = await sendOne(to, content);
      return err
        ? json({ mode, to, ok: false, error: `${err.status} ${err.message}` }, 502)
        : json({ mode, to, ok: true, kind: CAMPAIGN ? 'campaign' : 'rail_check', subject: content.subject });
    }

    if (mode === 'send') {
      if (!CAMPAIGN) {
        return json({ mode, sent: 0, error: 'No campaign is loaded in podcast-announce. Nothing was sent.' }, 409);
      }
      // Type-to-confirm, checked before any recipient is read or claimed.
      const confirm = checkCampaignConfirm(payload.confirm_campaign, CAMPAIGN.key);
      if (!confirm.ok) return json({ mode, campaign: CAMPAIGN.key, sent: 0, error: confirm.error }, 400);

      const batch = Math.min(Math.max(payload.batch ?? 200, 1), 400);
      const list = await recipients(db, CAMPAIGN.key);
      const slice = list.slice(0, batch);

      let sent = 0;
      const failures: Array<{ email: string; error: string; retried_later: boolean }> = [];

      for (const r of slice) {
        // CLAIM FIRST. A 23505 means another batch already took this address.
        const { error: claimErr } = await db.from('founders_send_log').insert({ campaign: CAMPAIGN.key, email: r.email });
        if (claimErr) {
          if (claimErr.code === '23505') continue;
          failures.push({ email: r.email, error: `claim: ${claimErr.message}`, retried_later: true });
          continue;
        }

        const err = await sendOne(r.email, buildPodcastBroadcastEmail(r.first_name, CAMPAIGN));
        if (err) {
          const transient = err.status === 429 || err.status >= 500;
          if (transient) {
            // Release so a later batch retries. Safe: the send demonstrably failed.
            await db.from('founders_send_log').delete().eq('campaign', CAMPAIGN.key).eq('email', r.email);
            if (err.status === 429) await new Promise((res) => setTimeout(res, 1200));
          }
          failures.push({ email: r.email, error: `${err.status} ${err.message}`, retried_later: transient });
          continue;
        }
        sent++;
        // Roughly 8 per second, well under Resend's rate limit.
        await new Promise((res) => setTimeout(res, 120));
      }

      return json({
        mode,
        campaign: CAMPAIGN.key,
        sent,
        failed: failures.length,
        failures: failures.slice(0, 20),
        remaining: Math.max(list.length - slice.length, 0),
      });
    }

    return json({ error: `unknown mode: ${mode}` }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
