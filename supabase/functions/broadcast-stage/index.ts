// supabase/functions/broadcast-stage/index.ts
//
// Resend BROADCASTS for the homeschool list (founder decision 2026-10-14: list emails move
// from list-announce to Resend Broadcasts from Fri Oct 30, to use what the Marketing plan
// pays for: scheduling, per-Broadcast stats, and Resend's own unsubscribe handling).
//
// WHY THIS WAS SAFE ONLY FROM 2026-10-14: a Broadcast skips a contact only when Resend's
// own `unsubscribed` flag is set. Our opt-outs live in Postgres, so until PR #635 pushed
// every one of them to Resend (contact-properties-sync, mode sync_unsubscribes), a
// Broadcast would have mailed people who had left. Run scripts/resend_unsub_sync.py
// --apply before scheduling any Broadcast, then re-stage.
//
// WHO GETS IT is decided in Postgres, not in Resend: public.broadcast_audience(name)
// returns the exact set, with list-announce's rules (opt-outs, kit families, the 12-day
// new-family pause, the 90-day quiet pause). This function copies that set into a STATIC
// Resend segment and keeps it equal: `stage` adds the missing and removes anyone who has
// since left the audience (opted out, bought, ...). Every add is logged in
// public.broadcast_stage_members, so staging is resumable and never adds twice.
//
// Modes (POST JSON, service role only; verify_jwt pinned true in supabase/config.toml):
//   preview  { audience?, segment? }       counts per audience; with segment, what `stage` would do.
//   stage    { audience, segment, batch? } converge segment "Broadcast: ..." to the audience.
//                                          Repeat until remaining is 0.
//   create   { segment, name, subject, html, campaign, content }
//            create (or update, if a DRAFT of that name exists) a Broadcast. Sends nothing.
//   proof    { name, subject, html, campaign, content }
//            send the same email as a real Broadcast to the "Founder proof" segment, whose
//            only member is the founder address from app_settings (refuses otherwise).
//            Founder law 2026-10-14: every nurture email is read in her inbox first.
//   schedule { broadcast_id, audience, confirm_name, scheduled_at }
//            the ONLY call here that mails families. Refuses unless confirm_name is the
//            Broadcast's exact name, it is still a draft, its segment is a "Broadcast: "
//            segment that holds exactly the audience right now, and scheduled_at is 15
//            minutes to 31 days out. Cancel = delete the Broadcast before it goes (Resend
//            dashboard, or DELETE /broadcasts/{id}).
//
// Placeholders Resend fills per contact: {{{contact.first_name|there}}} and
// {{{RESEND_UNSUBSCRIBE_URL}}} (required; checked). Copy rule: no em dashes (checked).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { addContactToSegment, ensureSegments, removeContactFromSegment } from '../_shared/resend-contacts.ts';
import { tagEmailHtml } from '../_shared/email-utm.ts';
import { resolveFounderEmail } from '../_shared/founder-identity.ts';
import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import {
  BROADCAST_AUDIENCES,
  BROADCAST_SEGMENT_PREFIX,
  type BroadcastAudience,
  checkBroadcastHtml,
  checkScheduledAt,
  isBroadcastAudience,
  isBroadcastSegmentName,
  planStage,
  PROOF_SEGMENT,
  type StageLogRow,
  type StageStatus,
} from '../_shared/broadcast-stage-plan.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Segments, contacts and Broadcasts need a FULL-ACCESS key. RESEND_API_KEY is the send-only
// key (GET /contacts answered 401 with it, 2026-10-14); RESEND_CONTACTS_KEY is the full one,
// the same key _shared/resend-contacts.ts uses.
const RESEND_KEY = Deno.env.get('RESEND_CONTACTS_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_MASTER_AUDIENCE_ID =
  Deno.env.get('RESEND_MASTER_AUDIENCE_ID') ?? Deno.env.get('RESEND_AUDIENCE_ID') ?? '';
const API = 'https://api.resend.com';

const FROM = 'Camila at The Eden Institute <hello@edeninstitute.health>';
const REPLY_TO = 'hello@edeninstitute.health';
const PAGE = 1000; // PostgREST caps at 1000 rows per request
const DEFAULT_BATCH = 300;
const MAX_BATCH = 500;
const WRITE_SPACING_MS = 200; // same pace as contact-properties-sync
const TIME_BUDGET_MS = 100_000; // stop well inside the wall-clock limit; call again to continue

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

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Db = ReturnType<typeof admin>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resendHeaders(): HeadersInit {
  return { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' };
}

async function resend(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(`${API}${path}`, { ...init, headers: resendHeaders() });
  const body = await res.json().catch(() => null) as Record<string, unknown> | null;
  return { status: res.status, body };
}

interface AudienceRow {
  email: string;
  first_name: string | null;
  band: string;
}

/** The audience, paged (PostgREST caps an RPC result at 1000 rows), all at one as-of time. */
async function audienceRows(db: Db, audience: BroadcastAudience, asOf: string): Promise<AudienceRow[]> {
  const out: AudienceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .rpc('broadcast_audience', { p_audience: audience, p_as_of: asOf })
      .order('email', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`broadcast_audience(${audience}): ${error.message}`);
    const rows = (data ?? []) as AudienceRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function stageLog(db: Db, segment: string): Promise<StageLogRow[]> {
  const out: StageLogRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('broadcast_stage_members')
      .select('email, status')
      .eq('segment_name', segment)
      .order('email', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`broadcast_stage_members: ${error.message}`);
    const rows = (data ?? []) as StageLogRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function logStage(db: Db, segment: string, email: string, status: StageStatus, http: number, error?: string) {
  const { error: e } = await db.from('broadcast_stage_members').upsert(
    { segment_name: segment, email, status, http_status: http, error: error ?? null, staged_at: new Date().toISOString() },
    { onConflict: 'segment_name,email' },
  );
  if (e) console.error('broadcast_stage_members upsert failed', email, e.message);
}

async function forget(db: Db, segment: string, email: string) {
  const { error } = await db.from('broadcast_stage_members').delete().eq('segment_name', segment).eq('email', email);
  if (error) console.error('broadcast_stage_members delete failed', email, error.message);
}

/** Add one contact to a segment; a contact Resend does not have yet is created into it. */
async function addOne(email: string, firstName: string | null, segmentId: string): Promise<{ status: StageStatus; http: number; error?: string }> {
  let r = await addContactToSegment(email, segmentId);
  if (r.status === 429) {
    await sleep(2000);
    r = await addContactToSegment(email, segmentId);
  }
  if (r.ok) return { status: 'added', http: r.status };
  if (r.status !== 404) return { status: 'failed', http: r.status, error: r.error };

  const segments = [{ id: segmentId }];
  if (RESEND_MASTER_AUDIENCE_ID && RESEND_MASTER_AUDIENCE_ID !== segmentId) segments.push({ id: RESEND_MASTER_AUDIENCE_ID });
  const payload: Record<string, unknown> = { email, unsubscribed: false, segments };
  if (firstName && firstName.trim()) payload.first_name = firstName.trim();
  const c = await resend('/contacts', { method: 'POST', body: JSON.stringify(payload) });
  if (c.status >= 200 && c.status < 300) return { status: 'created', http: c.status };
  if (c.status === 409) {
    const again = await addContactToSegment(email, segmentId);
    if (again.ok) return { status: 'added', http: again.status };
    return { status: 'failed', http: again.status, error: again.error };
  }
  // 422 on a malformed address: Resend can never mail it, so it is settled as absent.
  if (c.status === 422) return { status: 'absent', http: c.status, error: JSON.stringify(c.body).slice(0, 200) };
  return { status: 'failed', http: c.status, error: JSON.stringify(c.body).slice(0, 200) };
}

async function segmentIdByName(name: string): Promise<string | null> {
  const { ids, failed } = await ensureSegments([name]);
  if (failed.length) throw new Error(`segment ${name}: ${JSON.stringify(failed)}`);
  return ids.get(name) ?? null;
}

/** name for an id, among this team's segments (read-only lookup). */
async function segmentNameById(id: string): Promise<string | null> {
  const { ids } = await ensureSegments([]);
  for (const [name, sid] of ids) if (sid === id) return name;
  return null;
}

async function findDraftByName(name: string): Promise<{ id: string; status: string } | null> {
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const r = await resend(`/broadcasts?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    if (r.status !== 200) throw new Error(`GET /broadcasts ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    const rows = (r.body?.data ?? []) as Array<{ id: string; name?: string; status?: string }>;
    const hit = rows.find((b) => b.name === name);
    if (hit) return { id: hit.id, status: String(hit.status ?? '') };
    if (!r.body?.has_more || rows.length === 0) break;
    after = rows[rows.length - 1].id;
  }
  return null;
}

interface ContentInput {
  name: string;
  subject: string;
  html: string;
}

function readContent(body: Record<string, unknown>): ContentInput | { error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!name || name.length > 120) return { error: 'name required (max 120 chars)' };
  if (!subject || subject.length > 300) return { error: 'subject required (max 300 chars)' };
  const problem = checkBroadcastHtml(body.html);
  if (problem) return { error: problem };
  const content = typeof body.content === 'string' && body.content.trim() ? body.content.trim() : 'broadcast';
  const campaign = typeof body.campaign === 'string' && body.campaign.trim() ? body.campaign.trim() : undefined;
  const html = tagEmailHtml(String(body.html), { medium: 'newsletter', content, campaign });
  return { name, subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!isServiceRoleRequest(req)) return serviceRoleRequired(corsHeaders);
  if (!RESEND_KEY) return json({ error: 'RESEND_CONTACTS_KEY / RESEND_API_KEY missing' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const mode = body.mode;
  const db = admin();
  const asOf = new Date().toISOString();

  try {
    if (mode === 'preview') {
      const names = isBroadcastAudience(body.audience) ? [body.audience] : [...BROADCAST_AUDIENCES];
      const counts: Record<string, number> = {};
      for (const n of names) counts[n] = (await audienceRows(db, n, asOf)).length;
      let plan = null;
      if (isBroadcastAudience(body.audience) && isBroadcastSegmentName(body.segment)) {
        const p = planStage((await audienceRows(db, body.audience, asOf)).map((r) => r.email), await stageLog(db, body.segment));
        plan = { to_add: p.toAdd.length, to_remove: p.toRemove.length, to_forget: p.toForget.length, settled: p.settled };
      }
      return json({ mode, as_of: asOf, counts, plan });
    }

    if (mode === 'stage') {
      if (!isBroadcastAudience(body.audience)) return json({ error: `audience must be one of ${BROADCAST_AUDIENCES.join(', ')}` }, 400);
      if (!isBroadcastSegmentName(body.segment)) return json({ error: `segment must be named "${BROADCAST_SEGMENT_PREFIX}..."` }, 400);
      const segment = body.segment;
      const batch = Math.max(1, Math.min(MAX_BATCH, Number(body.batch) || DEFAULT_BATCH));
      const rows = await audienceRows(db, body.audience, asOf);
      const names = new Map(rows.map((r) => [r.email, r.first_name]));
      const plan = planStage(rows.map((r) => r.email), await stageLog(db, segment));
      const segmentId = await segmentIdByName(segment);
      if (!segmentId) return json({ error: `could not create segment ${segment}` }, 502);

      const started = Date.now();
      const out = { added: 0, created: 0, absent: 0, failed: 0, removed: 0, forgotten: 0 };
      const failures: Array<{ email: string; http: number; error?: string }> = [];
      let budget = batch;

      for (const email of plan.toForget) {
        await forget(db, segment, email);
        out.forgotten++;
      }
      for (const email of plan.toRemove) {
        if (budget <= 0 || Date.now() - started > TIME_BUDGET_MS) break;
        budget--;
        const r = await removeContactFromSegment(email, segmentId);
        if (r.ok) {
          await forget(db, segment, email);
          out.removed++;
        } else {
          out.failed++;
          if (failures.length < 20) failures.push({ email, http: r.status, error: r.error });
        }
        await sleep(WRITE_SPACING_MS);
      }
      for (const email of plan.toAdd) {
        if (budget <= 0 || Date.now() - started > TIME_BUDGET_MS) break;
        budget--;
        const r = await addOne(email, names.get(email) ?? null, segmentId);
        await logStage(db, segment, email, r.status, r.http, r.error);
        out[r.status]++;
        if (r.status === 'failed' && failures.length < 20) failures.push({ email, http: r.http, error: r.error });
        await sleep(WRITE_SPACING_MS);
      }

      const after = planStage(rows.map((r) => r.email), await stageLog(db, segment));
      const result = {
        mode, audience: body.audience, segment, segment_id: segmentId, as_of: asOf,
        audience_size: rows.length, ...out,
        remaining: after.toAdd.length + after.toRemove.length,
        in_segment: after.settled,
        failures,
      };
      console.log('broadcast-stage stage', JSON.stringify({ ...result, failures: failures.length }));
      return json(result, out.failed ? 207 : 200);
    }

    if (mode === 'create') {
      if (!isBroadcastSegmentName(body.segment)) return json({ error: `segment must be named "${BROADCAST_SEGMENT_PREFIX}..."` }, 400);
      const c = readContent(body);
      if ('error' in c) return json({ error: c.error }, 400);
      const log = await stageLog(db, body.segment);
      if (!log.some((r) => r.status === 'added' || r.status === 'created')) {
        return json({ error: `segment ${body.segment} has not been staged; run stage first` }, 409);
      }
      const segmentId = await segmentIdByName(body.segment);
      if (!segmentId) return json({ error: `segment ${body.segment} not found` }, 502);
      const payload = { segment_id: segmentId, from: FROM, reply_to: REPLY_TO, subject: c.subject, html: c.html, name: c.name };

      const existing = await findDraftByName(c.name);
      if (existing && existing.status !== 'draft') {
        return json({ error: `a ${existing.status} Broadcast named "${c.name}" already exists`, id: existing.id }, 409);
      }
      const r = existing
        ? await resend(`/broadcasts/${existing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await resend('/broadcasts', { method: 'POST', body: JSON.stringify({ ...payload, send: false }) });
      if (r.status < 200 || r.status >= 300) return json({ error: 'Resend refused the Broadcast', status: r.status, body: r.body }, 502);
      return json({ mode, id: r.body?.id ?? existing?.id ?? null, action: existing ? 'updated' : 'created', name: c.name, segment: body.segment });
    }

    if (mode === 'proof') {
      const c = readContent(body);
      if ('error' in c) return json({ error: c.error }, 400);
      const { email: founder } = await resolveFounderEmail();
      const segmentId = await segmentIdByName(PROOF_SEGMENT);
      if (!segmentId) return json({ error: 'could not create the proof segment' }, 502);
      const add = await addOne(founder, null, segmentId);
      if (add.status === 'failed' || add.status === 'absent') return json({ error: 'could not add the founder to the proof segment', add }, 502);

      // The proof segment must hold the founder and nobody else, or nothing is sent.
      const members = await resend(`/contacts?segment_id=${encodeURIComponent(segmentId)}&limit=100`);
      const list = (members.body?.data ?? []) as Array<{ email?: string; unsubscribed?: boolean }>;
      const emails = list.map((m) => String(m.email ?? '').toLowerCase());
      if (members.status !== 200 || emails.length !== 1 || emails[0] !== founder) {
        return json({ error: 'proof segment is not exactly the founder; nothing sent', status: members.status, members: emails }, 409);
      }
      if (list[0].unsubscribed) {
        return json({ error: `${founder} is unsubscribed in Resend, so a Broadcast would skip it; nothing sent` }, 409);
      }
      const r = await resend('/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          segment_id: segmentId, from: FROM, reply_to: REPLY_TO, subject: c.subject, html: c.html,
          name: `PROOF ${c.name}`.slice(0, 120), send: true,
        }),
      });
      if (r.status < 200 || r.status >= 300) return json({ error: 'Resend refused the proof', status: r.status, body: r.body }, 502);
      return json({ mode, sent: true, id: r.body?.id ?? null, to: founder, subject: c.subject });
    }

    if (mode === 'schedule') {
      const id = typeof body.broadcast_id === 'string' ? body.broadcast_id.trim() : '';
      if (!id) return json({ error: 'broadcast_id required' }, 400);
      if (!isBroadcastAudience(body.audience)) return json({ error: 'audience required' }, 400);
      const when = checkScheduledAt(body.scheduled_at, Date.now());
      if ('error' in when) return json({ error: when.error }, 400);

      const b = await resend(`/broadcasts/${encodeURIComponent(id)}`);
      if (b.status !== 200 || !b.body) return json({ error: `GET /broadcasts/${id} ${b.status}` }, 502);
      const name = String(b.body.name ?? '');
      if (typeof body.confirm_name !== 'string' || body.confirm_name !== name) {
        return json({ error: 'confirm_name must be the Broadcast\'s exact name', name }, 400);
      }
      if (b.body.status !== 'draft') return json({ error: `Broadcast is ${b.body.status}, not a draft` }, 409);
      const segId = String(b.body.segment_id ?? b.body.audience_id ?? '');
      const segName = segId ? await segmentNameById(segId) : null;
      if (!isBroadcastSegmentName(segName)) return json({ error: 'Broadcast is not aimed at a "Broadcast: " segment', segment: segName }, 409);
      const plan = planStage((await audienceRows(db, body.audience, asOf)).map((r) => r.email), await stageLog(db, segName));
      if (plan.toAdd.length || plan.toRemove.length) {
        return json({ error: 'segment does not match the audience right now; run stage first', to_add: plan.toAdd.length, to_remove: plan.toRemove.length }, 409);
      }
      const s = await resend(`/broadcasts/${encodeURIComponent(id)}/send`, { method: 'POST', body: JSON.stringify({ scheduled_at: when.iso }) });
      if (s.status < 200 || s.status >= 300) return json({ error: 'Resend refused the schedule', status: s.status, body: s.body }, 502);
      console.log('broadcast-stage scheduled', id, name, segName, when.iso, plan.settled);
      return json({ mode, scheduled: true, id, name, segment: segName, scheduled_at: when.iso, recipients_settled: plan.settled });
    }

    return json({ error: 'mode must be preview, stage, create, proof or schedule' }, 400);
  } catch (e) {
    console.error('broadcast-stage error', e instanceof Error ? e.message : String(e));
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
