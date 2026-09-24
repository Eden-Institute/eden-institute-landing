// At-signup email builders come from the canonical shared email library.
// resend-waitlist previously inlined a verbatim, collision-renamed copy of
// _shared/nurture-email-templates.ts; that duplicate has been removed so
// _shared is the single source of truth for these templates.
import { buildNurtureEmail1 } from '../_shared/nurture-email-templates.ts';
import { buildBandWaitlistEmail, buildHomeschoolEmail, buildSeedlingsMagnetEmail, buildSproutsMagnetEmail } from '../_shared/welcome-email-templates.ts';
import { bandFromSource, buildBandWaitlistRow } from '../_shared/band-waitlist.ts';
import { buildPodcastWelcomeEmail } from '../_shared/podcast-email-templates.ts';
import { applyUnsub, type EmailList } from '../_shared/email-unsubscribe.ts';
import { setContactProperties, type ContactProperties } from '../_shared/resend-contacts.ts';
import { escapeHtml } from '../_shared/html-escape.ts';
import { bumpRateBucket, clientIp } from '../_shared/rate-bucket.ts';
import { pgrstFetch } from '../_shared/pgrst-retry.ts';
import { sendMetaCapiLead } from '../_shared/meta-capi.ts';
import { getCallerUser } from '../_shared/caller-user.ts';
import { applyMemberRetake, memberRetakeUserId } from '../_shared/quiz-member-retake.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_CONTACTS_KEY = Deno.env.get('RESEND_CONTACTS_KEY');
// Master audience UUID — single destination for all contact writes post-Stage 2.
// Falls back to legacy RESEND_AUDIENCE_ID during rollout (same UUID today).
const RESEND_MASTER_AUDIENCE_ID =
  Deno.env.get('RESEND_MASTER_AUDIENCE_ID') ?? Deno.env.get('RESEND_AUDIENCE_ID');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// ── Entry funnel resolution ──
// Values come from the public.entry_funnel Postgres enum. The enum also still
// holds app_beta, course_tier2 and community (existing rows keep them); this
// function stopped accepting those retired funnels on 2026-09-15, so a request
// naming one now gets the same "could not resolve" 400 as any unknown funnel.
type EntryFunnel =
  | 'edens_table'
  | 'homeschool'
  | 'podcast'
  | 'quiz_funnel';

const VALID_FUNNELS = new Set<EntryFunnel>([
  'edens_table',
  'homeschool',
  'podcast',
  'quiz_funnel',
]);

// Legacy frontend sends audienceId; map to the entry_funnel taxonomy.
// Compatibility layer retained through Lane C Stage 3; drop once the
// frontend sends entry_funnel directly.
// The course_tier2 and app_beta audience ids were removed 2026-09-15 (retired funnels).
const LEGACY_AUDIENCE_TO_FUNNEL: Record<string, EntryFunnel> = {
  'a48cb66e-b2a9-461d-98a6-bb1b12f72693': 'edens_table',
};

const CONSTITUTION_SLUG_MAP: Record<string, { slug: string; name: string }> = {
  "Hot / Dry / Tense": { slug: "burning-bowstring", name: "The Burning Bowstring" },
  "Hot / Dry / Relaxed": { slug: "open-flame", name: "The Open Flame" },
  "Hot / Damp / Tense": { slug: "pressure-cooker", name: "The Pressure Cooker" },
  "Hot / Damp / Relaxed": { slug: "overflowing-cup", name: "The Overflowing Cup" },
  "Cold / Dry / Tense": { slug: "drawn-bowstring", name: "The Drawn Bowstring" },
  "Cold / Dry / Relaxed": { slug: "spent-candle", name: "The Spent Candle" },
  "Cold / Damp / Tense": { slug: "frozen-knot", name: "The Frozen Knot" },
  "Cold / Damp / Relaxed": { slug: "still-water", name: "The Still Water" },
};

// Name and slug come ONLY from the server-side map. The caller's own
// constitutionName/Nickname/Slug used to win here, which let any POST put
// arbitrary text into the Email 1 subject and body and into the stored queue rows.
function getSlugInfo(constitutionType: string): { slug: string; name: string } | null {
  return CONSTITUTION_SLUG_MAP[constitutionType] ?? null;
}

// ── Email builders ──

// The welcome builders (homeschool waitlist, Sprouts and Seedlings free week) and their
// chrome moved to _shared/welcome-email-templates.ts on 2026-09-15 so they share the
// look of the other emails. Wording unchanged; see that file.

// buildFoundationsEmail (Foundations Course waitlist) and buildAppBetaEmail (Apothecary
// beta, 'launch on July 7, 2026' with old prices) lived here until 2026-09-15, and
// buildCommunityEmail lived after buildHomeschoolEmail. Their funnels (course_tier2, app_beta, community) had no
// caller left on the site. Founder decision 2026-09-15: deleted, recoverable from git
// history.

// ── Phase 3.1 Day-1: source-branched email builders for edens_table funnel ──
// One welcome email per /homeschool CTA. Day-7 Week-2 send is Phase 3.1.2.

// The Founders Club welcome ("Preorders are open now ... $249") and its
// founding-window check lived here until 2026-09-12. Deleted with the
// print-first pivot; recover from git history (f0d7399) for phase two.

// The retired at-signup assessment email (constitutionProfiles + buildAssessmentEmail:
// per-Pattern intro/patterns/needs/herbs/Biblical anchor and the $4.99 guide CTA) lived
// here until 2026-09-15. It had no caller since Email 1 moved to _shared
// buildNurtureEmail1. Its copy differs from src/lib/constitution-data.ts; recover it
// from git history (last commit before this removal) if it is ever wanted.

// ── Send email helper ──

async function sendEmail(to: string, subject: string, html: string, list: EmailList): Promise<void> {
  const { html: finalHtml, headers: unsubHeaders } = await applyUnsub(html, to, list);
  const payload = {
    // The podcast list is its own brand; everything else stays The Eden Institute.
    from: list === 'podcast'
      ? 'Tales & Table Talk <hello@edeninstitute.health>'
      : 'The Eden Institute <hello@edeninstitute.health>',
    reply_to: 'hello@edeninstitute.health',
    to: [to],
    subject,
    html: finalHtml,
    headers: unsubHeaders,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Email send failed:', res.status, JSON.stringify(data));
  } else {
    console.log('Email sent successfully:', JSON.stringify(data));
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (
      !RESEND_API_KEY
      || !RESEND_CONTACTS_KEY
      || !RESEND_MASTER_AUDIENCE_ID
      || !SUPABASE_URL
      || !SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error('Missing env vars:', {
        hasSendKey: !!RESEND_API_KEY,
        hasContactsKey: !!RESEND_CONTACTS_KEY,
        hasMasterAudience: !!RESEND_MASTER_AUDIENCE_ID,
        hasSupabaseUrl: !!SUPABASE_URL,
        hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json(500, { error: 'Server configuration error' });
    }

    const body = await req.json();
    const {
      firstName,
      email,
      audienceId,
      source: sourceRaw,
      constitutionType,
      entry_funnel: providedFunnel,
      consents: consentsRaw,
      source_url: sourceUrlRaw,
      referrer: referrerRaw,
      utm_source: utmSourceRaw,
      utm_medium: utmMediumRaw,
      utm_campaign: utmCampaignRaw,
      utm_term: utmTermRaw,
      utm_content: utmContentRaw,
      fbEventId,
      marketingConsent,
      phone: phoneRaw,
      smsConsent,
    } = body;

    // Attribution fields go straight into waitlist_signups (plain text / jsonb
    // columns, no length checks), so they are bounded here. Oversized or
    // non-string values are truncated or dropped, never rejected, so a real
    // signup is not blocked by a long tracking URL.
    const source = str(sourceRaw, 100);
    const source_url = str(sourceUrlRaw, 2048);
    const referrer = str(referrerRaw, 2048);
    const utm_source = str(utmSourceRaw, 256);
    const utm_medium = str(utmMediumRaw, 256);
    const utm_campaign = str(utmCampaignRaw, 256);
    const utm_term = str(utmTermRaw, 256);
    const utm_content = str(utmContentRaw, 256);
    const consents: Record<string, unknown> =
      consentsRaw && typeof consentsRaw === 'object' && !Array.isArray(consentsRaw) &&
        JSON.stringify(consentsRaw).length <= 2000
        ? consentsRaw as Record<string, unknown>
        : {};

    if (!email || typeof email !== 'string' || email.length > 254) {
      return json(400, { error: 'Email is required' });
    }

    // v3.34: tolerate empty firstName for auto-submit logged-in path (Phase 5
    // fix #3 / launch-blocker #57). Logged-in user_metadata.first_name may be
    // null and profiles.display_name may not yet be populated. Default to a
    // personable fallback rather than 400-ing the request — nurture email
    // greetings render "Hi Friend," in this edge case, which is acceptable.
    // Markup characters are stripped at intake because the stored name is
    // re-rendered later by other templates (magnet day 7, list-announce, launch
    // sequence). Real names never contain them; apostrophes and ampersands stay.
    const firstNameRaw = typeof firstName === 'string' ? firstName.replace(/[<>"`]/g, '').trim().slice(0, 100) : '';
    const firstNameSafe = firstNameRaw || 'Friend';
    const firstNameHtml = escapeHtml(firstNameSafe);

    const normalizedEmail = String(email).trim().toLowerCase();

    // Reject clearly-undeliverable / mistyped domains (e.g. gmail.con,
    // gmail.co, live.con, passmail.ner) before creating a Resend contact
    // that can only hard-bounce. Mirrors client-side src/lib/emailTypos.ts.
    if (!hasDeliverableShape(normalizedEmail)) {
      return json(400, { error: 'That email address does not look complete. Please check it and try again.' });
    }

    const emailTypoSuggestion = detectEmailTypo(normalizedEmail);
    if (emailTypoSuggestion) {
      return json(400, { error: `That email address looks misspelled. Did you mean ${emailTypoSuggestion}?`, suggestion: emailTypoSuggestion });
    }

    // ── Band waitlists (Cultivators, Practitioners), 2026-09-24 ──
    // Validated up front so a mistyped phone is a clean 400 before anything is
    // written or sent. The row itself is written after the waitlist_signups step.
    const waitlistBand = bandFromSource(source);
    let bandRow: Record<string, unknown> | null = null;
    if (waitlistBand) {
      const built = buildBandWaitlistRow({
        email: normalizedEmail,
        band: waitlistBand,
        firstName: firstNameRaw || null,
        phoneRaw,
        smsConsent,
        sourceUrl: source_url,
        now: new Date(),
      });
      if (!built.ok) return json(400, { error: built.error });
      bandRow = built.row;
    }

    // Per-connection throttle. This endpoint is public (verify_jwt=false) and
    // sends email, so unthrottled it is an email bomb and a Resend quota drain.
    // Fails open (null) so a limiter outage never blocks lead capture.
    const ip = clientIp(req);
    if (ip) {
      const n = await bumpRateBucket({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        key: `waitlist_ip:${ip}`,
        windowSeconds: 600,
      });
      if (n !== null && n > 20) {
        // Wording approved by the founder 2026-09-15 (same line on all three public forms).
        return json(429, { error: 'We have received several forms from you in the last few minutes. Please wait a few minutes and try again, or email us at hello@edeninstitute.health.', code: 'RATE_LIMITED' });
      }
    }

    // ── Resolve entry_funnel ──
    // Precedence: explicit entry_funnel → constitution_assessment source →
    // legacy audienceId mapping → homeschool source keyword.
    let entry_funnel: EntryFunnel | null = null;
    if (providedFunnel && VALID_FUNNELS.has(providedFunnel as EntryFunnel)) {
      entry_funnel = providedFunnel as EntryFunnel;
    } else if (source === 'constitution_assessment') {
      entry_funnel = 'quiz_funnel';
    } else if (audienceId && LEGACY_AUDIENCE_TO_FUNNEL[audienceId]) {
      entry_funnel = LEGACY_AUDIENCE_TO_FUNNEL[audienceId];
    } else if (source === 'homeschool') {
      entry_funnel = 'homeschool';
    }

    if (!entry_funnel) {
      return json(400, {
        error: 'Could not resolve entry_funnel; provide entry_funnel or a known audienceId',
      });
    }

    // ── Step 1: Supabase-first waitlist_signups UPSERT (non-quiz paths) ──
    // For entry_funnel='quiz_funnel', the quiz_completions AFTER INSERT and
    // AFTER UPDATE triggers maintain the waitlist_signups row. Skip explicit
    // upsert here to keep the trigger as single owner of that row.
    let waitlistId: string | null = null;
    let existingResendContactId: string | null = null;
    if (entry_funnel !== 'quiz_funnel') {
      const upsertResult = await waitlistUpsert({
        email: normalizedEmail,
        first_name: firstNameSafe,
        entry_funnel,
        source: source ?? null,
        source_url: source_url ?? null,
        referrer: referrer ?? null,
        utm_source: utm_source ?? null,
        utm_medium: utm_medium ?? null,
        utm_campaign: utm_campaign ?? null,
        utm_term: utm_term ?? null,
        utm_content: utm_content ?? null,
        consents: consents ?? {},
      });
      if (upsertResult) {
        waitlistId = upsertResult.id;
        existingResendContactId = upsertResult.resend_contact_id;
      }
    }

    // ── Step 1b: band waitlist row ──
    // One row per (email, band), written on EVERY band-waitlist signup, including
    // people already in waitlist_signups (whose insert above is a no-op on
    // conflict, which is how this interest used to be lost). Non-fatal: the email
    // is already captured above, so a failure here is logged, not surfaced.
    if (bandRow) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/band_waitlist?on_conflict=email,band`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
            'Content-Type': 'application/json',
            // merge-duplicates updates only the columns sent, so a later signup
            // without a phone never erases an earlier phone or consent.
            'Prefer': 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(bandRow),
        });
        if (!r.ok) console.error('band_waitlist upsert failed', r.status, (await r.text()).slice(0, 300));
      } catch (e) {
        console.error('band_waitlist upsert error', String(e));
      }
    }

    // ── Step 2: Resend contact create in master audience ──
    // Idempotent at the Resend level (existing email in audience returns 409;
    // we handle that as success). Skipped if the Supabase row already has a
    // resend_contact_id from a prior sync.
    let resendContactId: string | null = existingResendContactId;
    let createdContactNow = false;
    if (!resendContactId) {
      try {
        const contactRes = await fetch(
          `https://api.resend.com/audiences/${RESEND_MASTER_AUDIENCE_ID}/contacts`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_CONTACTS_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: normalizedEmail,
              first_name: firstNameSafe,
              unsubscribed: false,
            }),
          }
        );
        if (contactRes.ok) {
          const contactData = await contactRes.json();
          resendContactId = contactData?.id ?? null;
          createdContactNow = true;
          console.log('Resend contact created:', resendContactId);
        } else if (contactRes.status === 409) {
          // Contact already exists in this audience. Not an error, just means
          // the signup came through a path where we don't yet know the prior
          // resend_contact_id. A follow-up GET can retrieve it; for now we
          // leave resend_contact_id null and let reconciliation fill it in.
          console.log('Resend contact already exists (409)');
        } else {
          const errText = await contactRes.text().catch(() => '');
          console.warn('Resend contact create failed:', contactRes.status, errText);
          // Non-fatal. The waitlist_signups row exists; the needs_sync partial
          // index lets a reconciliation worker pick it up on a later pass.
        }
      } catch (resendErr) {
        console.warn('Resend contact create exception:', String(resendErr));
      }
    }

    // ── Step 3: Mark waitlist_signups synced (non-quiz paths) ──
    if (waitlistId && resendContactId) {
      await waitlistMarkSyncedById(waitlistId, resendContactId).catch((e) =>
        console.warn('waitlist_signups sync update failed:', String(e))
      );
    }

    // ── Step 4: Quiz completion path (behavior preserved) ──
    // quiz_completions INSERT/UPDATE triggers (migrations 20260423232500 and
    // 20260423235500) maintain the waitlist_signups row for entry_funnel='quiz_funnel'.
    const slugInfo = source === 'constitution_assessment' && typeof constitutionType === 'string'
      ? getSlugInfo(constitutionType)
      : null;
    if (source === 'constitution_assessment' && constitutionType && !slugInfo) {
      // Same outcome as the balanced path, which sends no constitutionType.
      console.warn('constitution_assessment with unrecognised constitutionType; skipping drip');
    }
    if (slugInfo) {
      const name = slugInfo.name;
      const slug = slugInfo.slug;

      const checkRes = await pgrstFetch(
        `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email_1_sent_at&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      // A failed lookup must not fall into the first-time branch: that re-sends
      // Email 1 to a retaker and re-arms their already-sent drip rows.
      if (!checkRes.ok) {
        console.error('quiz_completions lookup failed', checkRes.status);
        return json(503, { error: 'Something went wrong. Please try again.' });
      }
      const existing = await checkRes.json();
      const alreadyNurtured =
        Array.isArray(existing) && existing.length > 0 && existing[0].email_1_sent_at;

      if (alreadyNurtured) {
        // Retake. Update constitution fields; the AFTER UPDATE trigger refreshes
        // waitlist_signups.metadata to the latest result while preserving entered_at.
        console.log('Existing nurture sequence — updating constitution info only');
        await pgrstFetch(
          `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              constitution_type: slug,
              constitution_name: name,
              constitution_nickname: name,
            }),
          }
        );
      } else {
        // First-time completion. Insert the row (AFTER INSERT trigger creates
        // the waitlist_signups row) and schedule the 4-email nurture drip.
        const now = new Date();
        const nowIso = now.toISOString();

        if (Array.isArray(existing) && existing.length > 0) {
          await pgrstFetch(
            `${SUPABASE_URL}/rest/v1/quiz_completions?email=eq.${encodeURIComponent(normalizedEmail)}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                constitution_type: slug,
                constitution_name: name,
                constitution_nickname: name,
                email_1_sent_at: nowIso,
                email_2_sent_at: nowIso,
                email_3_sent_at: nowIso,
                email_4_sent_at: nowIso,
              }),
            }
          );
        } else {
          const insRes = await fetch(`${SUPABASE_URL}/rest/v1/quiz_completions`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              email: normalizedEmail,
              first_name: firstNameSafe,
              constitution_type: slug,
              constitution_name: name,
              constitution_nickname: name,
              email_1_sent_at: nowIso,
              email_2_sent_at: nowIso,
              email_3_sent_at: nowIso,
              email_4_sent_at: nowIso,
            }),
          });
          if (!insRes.ok && insRes.status !== 409) console.error('quiz_completions insert failed', insRes.status);
        }
        console.log('Quiz completion recorded, scheduling nurture emails');

        // Producer side of Lock #48 (v3.34 Item A): Email 1 ships synchronously
        // via Resend (immediate user-facing signal). Emails 2-4 are enqueued
        // into public.nurture_email_queue; the cron-driven nurture-emails EF
        // (consumer) drains the queue and sends synchronously using the CURRENT
        // Sending API key. Replaces Resend `scheduled_at` which binds each
        // pre-scheduled send to the originating API key — see
        // feedback_resend_scheduled_at_brittle.md and the coliveira77 incident.
        const enqueueNurture = async () => {
          try {
            const sendHeaders = {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            };
            const from = 'Camila at The Eden Institute <hello@edeninstitute.health>';
            const replyTo = 'hello@edeninstitute.health';

            // Email 1: synchronous send. Tagged so the founder dashboard's
            // engagement view attributes opens/clicks to this first touch,
            // matching the campaign/email_key tags the nurture-emails EF sets
            // on Emails 2-7 (see public.email_events + resend-webhook).
            const e1 = buildNurtureEmail1(name, slug);
            const e1u = await applyUnsub(e1.html, normalizedEmail, 'constitution');
            const e1Res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: sendHeaders,
              body: JSON.stringify({
                from,
                reply_to: replyTo,
                to: [normalizedEmail],
                subject: e1.subject,
                html: e1u.html,
                headers: e1u.headers,
                tags: [
                  { name: 'campaign', value: 'constitution' },
                  { name: 'email_key', value: 'constitution_1' },
                ],
              }),
            });
            if (!e1Res.ok) console.error('Nurture Email 1 send failed', e1Res.status);
            else console.log('Nurture Email 1 sent');

            // Emails 2/3/4: UPSERT into nurture_email_queue
            const day2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
            const day4 = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
            const day6 = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();
            // 3-arc (post-drip): Deep Dive + class / app + book / homeschool + FB.
            // Positions 5/6/7 are free — E5 is tracked on quiz_completions, not
            // the queue. Scheduled day 11/14/17, after the day-8 E5.
            const day11 = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000).toISOString();
            const day14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
            const day17 = new Date(now.getTime() + 17 * 24 * 60 * 60 * 1000).toISOString();
            const queueRows = [
              { recipient_email: normalizedEmail, sequence_position: 2, constitution_pattern: name, scheduled_for: day2, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 3, constitution_pattern: name, scheduled_for: day4, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 4, constitution_pattern: name, scheduled_for: day6, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 5, constitution_pattern: name, scheduled_for: day11, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 6, constitution_pattern: name, scheduled_for: day14, status: 'pending' },
              { recipient_email: normalizedEmail, sequence_position: 7, constitution_pattern: name, scheduled_for: day17, status: 'pending' },
            ];
            const queueRes = await fetch(`${SUPABASE_URL}/rest/v1/nurture_email_queue`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal,resolution=merge-duplicates',
              },
              body: JSON.stringify(queueRows),
            });
            if (!queueRes.ok) {
              const errText = await queueRes.text().catch(() => '<unreadable>');
              console.error('nurture_email_queue UPSERT failed', { status: queueRes.status, body: errText });
            } else {
              console.log('Nurture Emails 2-4 enqueued (days 2/4/6)');
            }
          } catch (nurtureErr) {
            console.error('Nurture enqueue error:', String(nurtureErr));
          }
        };

        // Awaited: the isolate can be torn down once the response is returned,
        // and quiz_completions is already stamped email_1..4_sent_at, so a lost
        // send or enqueue would never be retried. enqueueNurture never throws.
        await enqueueNurture();
      }

      // Signed-in retake (founder decision 2026-09-15). The quiz_completions
      // trigger now only FILLS an empty Pattern on the matching account, so a
      // signed-out submission cannot overwrite a member. When the request
      // carries a valid user JWT for the same email, this is the member
      // retaking the quiz, and their own saved Pattern is updated by user id.
      // Never fatal to the signup.
      const memberUserId = memberRetakeUserId(await getCallerUser(req), normalizedEmail);
      if (memberUserId) {
        const retake = await applyMemberRetake({
          supabaseUrl: SUPABASE_URL,
          serviceKey: SUPABASE_SERVICE_ROLE_KEY,
          userId: memberUserId,
          constitutionType: slug,
        });
        console.log('Signed-in quiz retake applied to own account', { ok: retake.ok });
      }

      // Backfill resend_contact_id on the quiz_funnel waitlist_signups row
      // (which the trigger created/refreshed above).
      if (resendContactId) {
        await waitlistMarkSyncedByFunnel(normalizedEmail, 'quiz_funnel', resendContactId).catch((e) =>
          console.warn('quiz_funnel waitlist sync update failed:', String(e))
        );
      }
    }

    // ── Step 5: Welcome email dispatch (non-quiz paths) ──
    let emailContent: { subject: string; html: string } | null = null;
    if (entry_funnel === 'homeschool') {
      emailContent = buildHomeschoolEmail(firstNameHtml);
    } else if (entry_funnel === 'edens_table') {
      // Phase 3.1 Day-1: source-branched routing for /homeschool CTAs.
      //   'reserve'           → Founders Club welcome (no PDFs)
      //   'sprouts_magnet'    → Sprouts W1 (Lavender) with 6 PDF download buttons
      //   'seedlings_magnet'  → Seedlings W1 (Elderberry) with 6 PDF download buttons
      // Day-7 Week-2 send is Phase 3.1.2 (nurture_email_queue + Vercel cron sender);
      // The Day 0 email no longer promises a Week 2, so there is nothing for a
      // recipient to chase if this enqueue fails. Position 2 now carries the paid
      // Starter Unit offer (founder decision 2026-08-27, one free week per band).
      if (source === 'sprouts_magnet') {
        emailContent = buildSproutsMagnetEmail(firstNameHtml);
      } else if (source === 'seedlings_magnet') {
        emailContent = buildSeedlingsMagnetEmail(firstNameHtml);
      } else if (waitlistBand) {
        // 'cultivators_waitlist' / 'practitioners_waitlist' (2026-09-24). These used
        // to fall through to the generic homeschool welcome below.
        emailContent = buildBandWaitlistEmail(firstNameHtml, waitlistBand);
      } else {
        // 'reserve' used to route to the Founders Club welcome ("Preorders are
        // open now, the first 500 kits sell at $249"). Preorders closed on
        // 2026-09-12 (print-first pivot), so that email and its founding-window
        // check were deleted; the source now falls through here like any other.
        // Unknown source on edens_table funnel → legacy Homeschool welcome email
        // (the "Early Access" copy currently deployed; safest fallback for any
        // signups that hit this EF without a source we recognize).
        emailContent = buildHomeschoolEmail(firstNameHtml);
      }
    } else if (entry_funnel === 'podcast') {
      // Tales & Table Talk (edeninstitute.health/tales-and-table-talk, and
      // talesandtabletalk.com until its switch to the network). Its own list, so it never
      // picks up the edens_table launch trigger or list-announce broadcasts.
      emailContent = buildPodcastWelcomeEmail(firstNameHtml);
    }
    // quiz_funnel is handled by the nurture sequence above.

    // Per-recipient cap on the welcome send: a repeat POST for the same address
    // re-sends it, so without a cap anyone can flood one inbox. Signup itself
    // (row, Resend contact, 200) is unaffected. Fails open on a limiter error.
    let sendAllowed = true;
    if (emailContent) {
      const sendCount = await bumpRateBucket({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        key: `waitlist_send:${normalizedEmail}`,
        windowSeconds: 86400,
      });
      sendAllowed = sendCount === null || sendCount <= 3;
      if (!sendAllowed) console.warn('welcome send throttled (per-recipient cap)');
    }

    let welcomeSent = false;
    if (emailContent && sendAllowed) {
      try {
        // Non-quiz welcomes belong to the homeschool list (edens_table/homeschool
        // funnels), except the podcast welcome, which has its own list so a podcast
        // unsubscribe never touches Eden's Table mail and vice versa.
        const welcomeList: EmailList = entry_funnel === 'podcast' ? 'podcast' : 'homeschool';
        await sendEmail(normalizedEmail, emailContent.subject, emailContent.html, welcomeList);
        welcomeSent = true;
      } catch (emailErr) {
        console.error('Welcome email send error:', String(emailErr));
      }
    }

    // Enqueue the magnet Day-7 send into
    // public.magnet_email_queue (NOT nurture_email_queue, which is the quiz drip).
    // Drained by the nurture-emails cron. Non-fatal: a failure here never blocks signup.
    //
    // 2026-07-28: position 3 (Day-14 Facebook) is NO LONGER enqueued. A new lead
    // now gets free week 1 inline, free week 2 on day 7, and then the preorder
    // series from day 9 (enqueue_launch_sequence_on_signup, migration
    // 20260728233000). Positions 4-7 chain off 3 via MAGNET_CHAIN_NEXT in
    // nurture-emails, so dropping 3 ends the whole W3-W7 tail without touching
    // the chain map, and without stranding anyone already partway through it.
    if (welcomeSent && entry_funnel === 'edens_table' && (source === 'sprouts_magnet' || source === 'seedlings_magnet')) {
      try {
        const band = source === 'sprouts_magnet' ? 'sprouts' : 'seedlings';
        const nowMs = Date.now();
        const day7 = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
        const magnetRows = [
          { recipient_email: normalizedEmail, first_name: firstNameSafe, band, sequence_position: 2, scheduled_for: day7, status: 'pending' },
        ];
        // ignore-duplicates, not merge: merging would flip an already 'sent'
        // row back to pending with a new date and re-send the day-7 offer to a
        // repeat signup. The first schedule stands.
        const mqRes = await pgrstFetch(`${SUPABASE_URL}/rest/v1/magnet_email_queue?on_conflict=recipient_email,band,sequence_position`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal,resolution=ignore-duplicates',
          },
          body: JSON.stringify(magnetRows),
        });
        if (!mqRes.ok) {
          const t = await mqRes.text().catch(() => '<unreadable>');
          console.error('magnet_email_queue UPSERT failed', { status: mqRes.status, body: t });
        } else {
          console.log(`Magnet day-7 Starter offer enqueued (${band})`);
        }
      } catch (mqErr) {
        console.error('Magnet enqueue error:', String(mqErr));
      }
    }

    // ── Resend contact properties (nurture roadmap Phase 1, 2026-09-03) ──
    // Point write of what THIS signup tells us: funnel, band, quiz_status. The
    // nightly contact-properties-sync recomputes every key from Postgres
    // (view resend_contact_state_computed), so a miss here is repaired later
    // and is never fatal to the signup. funnel is written only when this
    // request created the contact or the funnel is edens_table, so a later
    // quiz signup cannot demote a homeschool lead's funnel value.
    try {
      const props: ContactProperties = {};
      if (createdContactNow || entry_funnel === 'edens_table') props.funnel = entry_funnel;
      if (entry_funnel === 'edens_table' && (source === 'sprouts_magnet' || source === 'seedlings_magnet')) {
        const band = source === 'sprouts_magnet' ? 'sprouts' : 'seedlings';
        const otherBand = band === 'sprouts' ? 'seedlings' : 'sprouts';
        // A both-band family has magnet rows for both bands; the row for THIS
        // band was just enqueued above, so only the other band is checked.
        const otherRes = await fetch(
          `${SUPABASE_URL}/rest/v1/magnet_email_queue?recipient_email=eq.${encodeURIComponent(normalizedEmail)}&band=eq.${otherBand}&select=id&limit=1`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          },
        );
        const otherRows = otherRes.ok ? await otherRes.json().catch(() => []) : [];
        props.band = Array.isArray(otherRows) && otherRows.length > 0 ? 'both' : band;
      }
      if (source === 'constitution_assessment') props.quiz_status = 'completed';
      const propWrite = await setContactProperties(normalizedEmail, props, {
        firstName: firstNameSafe,
        createIfMissing: false,
      });
      if (!propWrite.ok) {
        console.warn('Resend contact properties write failed:', propWrite.status, propWrite.error);
      }
    } catch (propErr) {
      console.warn('Resend contact properties exception:', String(propErr));
    }

    // ── Meta Conversions API (server-side Lead) ──
    // Dormant until META_CAPI_ACCESS_TOKEN is set as an EF secret. Deduped
    // against the client Pixel Lead via the shared fbEventId. Wrapped so a Meta
    // outage can never fail a signup.
    // Consent-gated to stay symmetric with the client Pixel (Lock #81): the
    // browser Pixel only fires on cookie-banner Accept, so the server Lead must
    // too. The frontend sends marketingConsent=true only when the visitor
    // granted marketing consent; absent/false means no server-side tracking.
    if (marketingConsent === true) {
      await sendMetaCapiLead({
        email: normalizedEmail,
        eventId: typeof fbEventId === 'string' ? fbEventId : undefined,
        sourceUrl: source_url ?? null,
        headers: req.headers,
      });
    }

    return json(200, {
      success: true,
      waitlist_id: waitlistId,
      entry_funnel,
      resend_contact_id: resendContactId,
      welcome_email_sent: welcomeSent,
      message: "You're on the list. Check your inbox.",
    });
  } catch (err) {
    const unhandledMessage = err instanceof Error ? err.message : String(err);
    const unhandledStack = err instanceof Error ? err.stack : undefined;
    console.error('Unhandled error:', unhandledMessage, unhandledStack);
    // The raw message stays in the log; anonymous callers get the generic line.
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
});

// ── Helpers ──

// Detect a definitely-undeliverable / mistyped email domain. Returns a suggested
// correction, or null if the domain looks fine. Conservative: only flags
// guaranteed-bad domains (dead TLDs, single-domain providers on the wrong TLD)
// so it never hard-blocks an unusual-but-valid address. Mirrors src/lib/emailTypos.ts.
// Structural deliverability check, run BEFORE detectEmailTypo.
//
// detectEmailTypo deliberately returns null when the domain has no dot, and the
// caller read that as "address is fine". That hole let six undeliverable
// addresses into the July 2026 launch sequence, each failing on all six sends:
// four with no dot in the domain (gmail, hotmail), one with a mangled TLD run
// together (hotmailcom, gmailc), and one whose local part ended in a dot.
// A domain with no dot cannot receive mail, so it is rejected outright.
// Mirrors hasDeliverableShape in src/lib/emailTypos.ts.
function hasDeliverableShape(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!/^[^\s@]+$/.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[^\s@.]+(\.[^\s@.]+)+$/.test(domain)) return false;
  return domain.slice(domain.lastIndexOf('.') + 1).length >= 2;
}

function detectEmailTypo(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes('.') || domain.endsWith('.')) return null;
  const parts = domain.split('.');
  const ccSld = new Set(['com.au', 'co.uk', 'co.nz', 'com.br', 'co.za', 'com.mx', 'co.in', 'com.sg']);
  let tld: string;
  let sld: string;
  if (parts.length >= 3 && ccSld.has(parts.slice(-2).join('.'))) {
    tld = parts.slice(-2).join('.');
    sld = parts[parts.length - 3];
  } else {
    tld = parts[parts.length - 1];
    sld = parts[parts.length - 2];
  }
  const providerCanonical: Record<string, string> = { gmail: 'gmail.com', googlemail: 'googlemail.com', icloud: 'icloud.com', aol: 'aol.com' };
  if (providerCanonical[sld] && domain !== providerCanonical[sld]) return `${local}@${providerCanonical[sld]}`;
  const badTld: Record<string, string> = { con: 'com', cm: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', coom: 'com', comm: 'com', comn: 'com', cim: 'com', clm: 'com', ner: 'net', nett: 'net', ogr: 'org', orgg: 'org' };
  if (badTld[tld]) return `${local}@${sld}.${badTld[tld]}`;
  return null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Insert a waitlist_signups row; on (email, entry_funnel) conflict return
// the existing row. Returns null on unexpected failure.
async function waitlistUpsert(row: {
  email: string;
  first_name: string;
  entry_funnel: EntryFunnel;
  source: string | null;
  source_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  consents: Record<string, unknown>;
}): Promise<{ id: string; resend_contact_id: string | null } | null> {
  const insertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist_signups?select=id,resend_contact_id`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(row),
    }
  );

  if (insertRes.ok) {
    const data = await insertRes.json();
    if (Array.isArray(data) && data.length > 0) {
      return { id: data[0].id, resend_contact_id: data[0].resend_contact_id ?? null };
    }
  }

  // Unique violation (409) → row exists → fetch and return it.
  if (insertRes.status === 409) {
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/waitlist_signups?email=eq.${encodeURIComponent(row.email)}&entry_funnel=eq.${row.entry_funnel}&select=id,resend_contact_id&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    );
    if (fetchRes.ok) {
      const existing = await fetchRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        return { id: existing[0].id, resend_contact_id: existing[0].resend_contact_id ?? null };
      }
    }
  }

  const errText = await insertRes.text().catch(() => '');
  console.error('waitlist_signups upsert failed:', insertRes.status, errText);
  return null;
}

async function waitlistMarkSyncedById(id: string, resendContactId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist_signups?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        resend_contact_id: resendContactId,
        resend_synced_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PATCH by id failed: ${res.status} ${txt}`);
  }
}

async function waitlistMarkSyncedByFunnel(
  email: string,
  funnel: EntryFunnel,
  resendContactId: string,
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/waitlist_signups?email=eq.${encodeURIComponent(email)}&entry_funnel=eq.${funnel}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        resend_contact_id: resendContactId,
        resend_synced_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PATCH by funnel failed: ${res.status} ${txt}`);
  }
}
