// supabase/functions/online-year-signin/index.ts
// Eden's Table Online Year (punch #472), ticket OY4: sign in with an emailed 6-digit code; device tokens;
// the family's device limit. POST { action: 'request' | 'verify' | 'session' | 'signout', ... }.
//
// All the logic, the words and why each answer is safe for an anonymous caller live in
// ../_shared/online-year-signin.ts (unit tested in CI). This file only wires the database (service role),
// the shared hourly rate buckets (rate-bucket.ts, fail open) and Resend.
// DARK: 404 until ONLINE_YEAR_ENABLED (or the x-online-year-preview header), like every Online Year endpoint.
// Deploy with verify_jwt=false (supabase/config.toml): called anonymously from the reader page.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ONLINE_YEAR_PREVIEW_HEADER } from '../_shared/online-year-gate.ts';
import { bumpRateBucket, clientIp } from '../_shared/rate-bucket.ts';
import { SELLER_ADDRESS, SELLER_LEGAL_NAME } from '../_shared/receipt.ts';
import {
  buildSigninCodeEmail,
  handleOnlineYearSignin,
  likeExact,
  SIGNIN_EMAIL_FROM,
  SIGNIN_EMAIL_REPLY_TO,
  type SigninCode,
  type SigninDevice,
  type SigninLicense,
  type SigninParent,
} from '../_shared/online-year-signin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type, ${ONLINE_YEAR_PREVIEW_HEADER}`,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

// Created on first use, so the dark 404 never touches the service role key.
const makeDb = () => createClient(SUPABASE_URL, SERVICE_KEY);
let client: ReturnType<typeof makeDb> | null = null;
function db() {
  if (!client) client = makeDb();
  return client;
}

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

const PARENT_COLS = 'id, email, first_name, license_name';
// deno-lint-ignore no-explicit-any
const asParent = (r: any): SigninParent | null =>
  r ? { id: String(r.id), email: String(r.email), first_name: r.first_name ?? null, license_name: r.license_name ?? null } : null;

async function sendCodeEmail(to: string, firstName: string | null, code: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('online-year-signin: RESEND_API_KEY missing; code not sent');
    return false;
  }
  const m = buildSigninCodeEmail(firstName, code, `${SELLER_LEGAL_NAME} · ${SELLER_ADDRESS}`);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: SIGNIN_EMAIL_FROM,
      reply_to: SIGNIN_EMAIL_REPLY_TO,
      to: [to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      tags: [{ name: 'category', value: 'online_year_signin_code' }],
    }),
  });
  if (!res.ok) console.error('online-year-signin: Resend failed', res.status, (await res.text().catch(() => '')).slice(0, 300));
  return res.ok;
}

async function defer(work: Promise<unknown>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') {
    rt.waitUntil(work);
    return;
  }
  await work;
}

serve((req) =>
  handleOnlineYearSignin(req, {
    cors: corsHeaders,
    ip: clientIp(req),
    bumpRate: (key) => bumpRateBucket({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, key, windowSeconds: 3600 }),
    findParentByEmail: async (emailLower) =>
      asParent(must(await db().from('online_year_parents').select(PARENT_COLS).ilike('email', likeExact(emailLower)).maybeSingle(), 'parent by email')),
    findParentById: async (id) =>
      asParent(must(await db().from('online_year_parents').select(PARENT_COLS).eq('id', id).maybeSingle(), 'parent by id')),
    listLicenses: async (parentId): Promise<SigninLicense[]> =>
      // deno-lint-ignore no-explicit-any
      (must(await db().from('online_year_licenses').select('id, band, child_name, kind, starts_at, ends_at, status').eq('parent_id', parentId).order('created_at'), 'licenses') as any[])
        .map((r) => ({ id: String(r.id), band: String(r.band), child_name: String(r.child_name), kind: String(r.kind), starts_at: String(r.starts_at), ends_at: String(r.ends_at), status: String(r.status) })),
    recentCodes: async (emailLower, since): Promise<SigninCode[]> =>
      // deno-lint-ignore no-explicit-any
      (must(await db().from('online_year_signin_codes').select('id, code_hash, expires_at, attempts, used_at').eq('email_lower', emailLower).gte('created_at', since).order('created_at', { ascending: false }), 'codes') as any[])
        .map((r) => ({ id: String(r.id), code_hash: String(r.code_hash), expires_at: String(r.expires_at), attempts: Number(r.attempts), used_at: r.used_at ?? null })),
    insertCode: async (row) => {
      must(await db().from('online_year_signin_codes').insert(row), 'insert code');
    },
    bumpCodeAttempts: async (codeId) => {
      // Read-then-write is fine here: the per-IP guess limit bounds a race, and the cap is enforced again on every read.
      const cur = must(await db().from('online_year_signin_codes').select('attempts').eq('id', codeId).single(), 'code attempts') as { attempts: number };
      const next = Math.min(10, Number(cur.attempts) + 1);
      must(await db().from('online_year_signin_codes').update({ attempts: next }).eq('id', codeId), 'bump attempts');
      return next;
    },
    useCode: async (codeId, at) => {
      const rows = must(await db().from('online_year_signin_codes').update({ used_at: at }).eq('id', codeId).is('used_at', null).select('id'), 'use code') as unknown[];
      return rows.length === 1;
    },
    sendCodeEmail,
    liveDevices: async (parentId): Promise<SigninDevice[]> =>
      // deno-lint-ignore no-explicit-any
      (must(await db().from('online_year_devices').select('id, parent_id, last_seen_at, signed_out_at').eq('parent_id', parentId).is('signed_out_at', null).order('last_seen_at', { ascending: true }), 'devices') as any[])
        .map((r) => ({ id: String(r.id), parent_id: String(r.parent_id), last_seen_at: String(r.last_seen_at), signed_out_at: r.signed_out_at ?? null })),
    insertDevice: async (row) => {
      must(await db().from('online_year_devices').insert(row), 'insert device');
    },
    signOutDevice: async (deviceId, reason, at) => {
      must(await db().from('online_year_devices').update({ signed_out_at: at, signed_out_reason: reason }).eq('id', deviceId).is('signed_out_at', null), 'sign out device');
    },
    findDeviceByTokenHash: async (tokenHash) => {
      const r = must(await db().from('online_year_devices').select('id, parent_id, last_seen_at, signed_out_at').eq('token_hash', tokenHash).maybeSingle(), 'device by token');
      // deno-lint-ignore no-explicit-any
      const d = r as any;
      return d ? { id: String(d.id), parent_id: String(d.parent_id), last_seen_at: String(d.last_seen_at), signed_out_at: d.signed_out_at ?? null } : null;
    },
    touchDevice: async (deviceId, at) => {
      must(await db().from('online_year_devices').update({ last_seen_at: at }).eq('id', deviceId), 'touch device');
    },
    defer,
  })
);
