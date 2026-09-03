// contact-properties-sync
//
// Projects the six Resend contact properties (funnel, band, purchase_status,
// founding, quiz_status, engagement_tier) from Postgres onto Resend contacts.
//
// Caller: Vercel cron at /api/cron/sync-contact-properties (daily, vercel.json),
// or a founder/Claude-driven POST with the service-role key.
// Auth: verify_jwt = true (config.toml) AND _shared/require-service-role.ts.
//
// Source of truth: public.resend_contact_state_computed (migration
// 20260903150000). Record of what Resend was told: public.resend_contact_state.
// A contact is PATCHed only when its computed state hash differs from the last
// one written, so the nightly run is a delta, not a full rewrite.
//
// Modes (JSON body):
//   { "mode": "preview" }                        counts per value + delta size, NO writes
//   { "mode": "ensure_properties" }              create the six property keys on Resend
//   { "mode": "sync",  "batch": 100 }            write up to `batch` changed contacts (max 120)
//   { "mode": "full",  "batch": 100 }            same, ignoring the stored hash (backfill)
//   { "mode": "sync",  "email": "a@b.c" }        force one contact, ignoring the hash
//
// Every write goes through _shared/resend-contacts.ts and never throws. The
// response carries `remaining`, so a driver can loop until it reads zero, the
// same shape list-announce uses.
//
// Rate: one PATCH every 200 ms plus the state upsert, about 0.6-0.8 s per row all
// in. The edge-function wall clock is 150 s (a first attempt at 300 rows died with
// WORKER_RESOURCE_LIMIT at 150 s on 2026-09-03), so batches are capped at 120 and
// default to 100; a driver loops on `remaining` for a backfill.

import { isServiceRoleRequest, serviceRoleRequired } from '../_shared/require-service-role.ts';
import {
  CONTACT_PROPERTY_KEYS,
  ensureContactProperties,
  setContactProperties,
  type ContactProperties,
} from '../_shared/resend-contacts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const DEFAULT_BATCH = 100;
const MAX_BATCH = 120;
const WRITE_SPACING_MS = 200;
const PAGE = 1000; // PostgREST caps at 1000 rows per request

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

// Page through a PostgREST resource with Range headers; PostgREST silently caps
// at 1000 rows, and the list is already past 1,500.
async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await rest(`${path}${path.includes('?') ? '&' : '?'}order=email.asc`, {
      headers: { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '<unreadable>');
      throw new Error(`PostgREST ${res.status} on ${path}: ${t.slice(0, 300)}`);
    }
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

interface ComputedRow {
  email: string;
  first_name: string | null;
  funnel: string | null;
  band: string;
  purchase_status: string;
  founding: string;
  quiz_status: string;
  engagement_tier: string;
}

interface StateRow {
  email: string;
  state_hash: string;
}

function propsOf(row: ComputedRow): ContactProperties {
  return {
    funnel: row.funnel ?? undefined,
    band: row.band,
    purchase_status: row.purchase_status,
    founding: row.founding,
    quiz_status: row.quiz_status,
    engagement_tier: row.engagement_tier,
  };
}

function hashOf(row: ComputedRow): string {
  return CONTACT_PROPERTY_KEYS.map((k) => (row as unknown as Record<string, unknown>)[k] ?? '').join('|');
}

function distribution(rows: ComputedRow[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const key of CONTACT_PROPERTY_KEYS) {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const v = String((r as unknown as Record<string, unknown>)[key] ?? 'null');
      counts[v] = (counts[v] ?? 0) + 1;
    }
    out[key] = counts;
  }
  return out;
}

async function upsertState(row: ComputedRow, hash: string, status: number, error: string | null): Promise<void> {
  const res = await rest('resend_contact_state?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify([{
      email: row.email,
      funnel: row.funnel,
      band: row.band,
      purchase_status: row.purchase_status,
      founding: row.founding,
      quiz_status: row.quiz_status,
      engagement_tier: row.engagement_tier,
      state_hash: hash,
      synced_at: new Date().toISOString(),
      last_status: status,
      last_error: error,
      updated_at: new Date().toISOString(),
    }]),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '<unreadable>');
    console.error('resend_contact_state upsert failed', res.status, t.slice(0, 300));
  } else {
    await res.body?.cancel();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!isServiceRoleRequest(req)) return serviceRoleRequired();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase env missing' });

  let body: { mode?: string; batch?: number; email?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const mode = body.mode ?? 'sync';
  const batch = Math.max(1, Math.min(MAX_BATCH, Number(body.batch) || DEFAULT_BATCH));
  const onlyEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;

  try {
    if (mode === 'ensure_properties') {
      const result = await ensureContactProperties();
      return json(result.failed.length ? 502 : 200, { mode, ...result });
    }

    const computedPath = onlyEmail
      ? `resend_contact_state_computed?email=eq.${encodeURIComponent(onlyEmail)}`
      : 'resend_contact_state_computed';
    const computed = await fetchAll<ComputedRow>(computedPath);

    if (mode === 'preview') {
      const state = await fetchAll<StateRow>('resend_contact_state?select=email,state_hash');
      const known = new Map(state.map((s) => [s.email, s.state_hash]));
      const delta = computed.filter((r) => known.get(r.email) !== hashOf(r)).length;
      return json(200, {
        mode,
        computed: computed.length,
        recorded: state.length,
        delta,
        distribution: distribution(computed),
      });
    }

    if (mode !== 'sync' && mode !== 'full') return json(400, { error: `unknown mode '${mode}'` });

    let due: ComputedRow[];
    if (mode === 'full' || onlyEmail) {
      due = computed;
    } else {
      const state = await fetchAll<StateRow>('resend_contact_state?select=email,state_hash');
      const known = new Map(state.map((s) => [s.email, s.state_hash]));
      due = computed.filter((r) => known.get(r.email) !== hashOf(r));
    }

    const slice = due.slice(0, batch);
    let ok = 0;
    let failed = 0;
    let created = 0;
    const failures: Array<{ email: string; status: number; error?: string }> = [];

    for (const row of slice) {
      const hash = hashOf(row);
      const result = await setContactProperties(row.email, propsOf(row), {
        firstName: row.first_name,
        createIfMissing: true,
      });
      if (result.ok) {
        ok++;
        if (result.action === 'created') created++;
        await upsertState(row, hash, result.status, null);
      } else {
        failed++;
        if (failures.length < 20) failures.push({ email: row.email, status: result.status, error: result.error });
        // A FAILED hash never equals a computed hash, so the row is retried next run.
        await upsertState(row, `FAILED:${new Date().toISOString()}`, result.status, result.error ?? null);
        // 429 = slow down for the rest of this run.
        if (result.status === 429) await new Promise((r) => setTimeout(r, 2000));
      }
      await new Promise((r) => setTimeout(r, WRITE_SPACING_MS));
    }

    const summary = {
      mode,
      computed: computed.length,
      due: due.length,
      processed: slice.length,
      ok,
      created,
      failed,
      remaining: Math.max(0, due.length - slice.length),
      failures,
    };
    console.log('contact-properties-sync', JSON.stringify(summary));
    return json(200, summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('contact-properties-sync failed:', message);
    return json(500, { error: message });
  }
});
