// supabase/functions/online-year-family/index.ts
// Eden's Table Online Year (punch #472), OY6 + OY7: print a child's Notebook week (name stamped), mark a week done,
// read progress. POST { action: 'print' | 'done' | 'progress', token, license_id?, week? }.
// Logic and safety: ../_shared/online-year-family.ts (unit tested in CI). This file wires the database (service
// role), the private online-year bucket and the existing Starter stamp (starter-pdf.ts stampFooter).
// DARK: 404 until ONLINE_YEAR_ENABLED (or the preview header). Deploy with verify_jwt=false (supabase/config.toml).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ONLINE_YEAR_PREVIEW_HEADER } from '../_shared/online-year-gate.ts';
import { handleOnlineYearFamily, READER_BUCKET } from '../_shared/online-year-family.ts';
import { stampFooter } from '../_shared/starter-pdf.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type, ${ONLINE_YEAR_PREVIEW_HEADER}`,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const makeDb = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
let client: ReturnType<typeof makeDb> | null = null;
function db() {
  if (!client) client = makeDb();
  return client;
}
function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}
const bucket = () => db().storage.from(READER_BUCKET);

serve((req) =>
  handleOnlineYearFamily(req, {
    cors: corsHeaders,
    findDeviceByTokenHash: async (tokenHash) => {
      // deno-lint-ignore no-explicit-any
      const d = must(await db().from('online_year_devices').select('id, parent_id, last_seen_at, signed_out_at').eq('token_hash', tokenHash).maybeSingle(), 'device') as any;
      return d ? { id: String(d.id), parent_id: String(d.parent_id), last_seen_at: String(d.last_seen_at), signed_out_at: d.signed_out_at ?? null } : null;
    },
    findParentById: async (id) => {
      // deno-lint-ignore no-explicit-any
      const r = must(await db().from('online_year_parents').select('id, email, first_name, license_name').eq('id', id).maybeSingle(), 'parent') as any;
      return r ? { id: String(r.id), email: String(r.email), first_name: r.first_name ?? null, license_name: r.license_name ?? null } : null;
    },
    listLicenses: async (parentId) =>
      // deno-lint-ignore no-explicit-any
      (must(await db().from('online_year_licenses').select('id, band, child_name, kind, starts_at, ends_at, status').eq('parent_id', parentId).order('created_at'), 'licenses') as any[])
        .map((r) => ({ id: String(r.id), band: String(r.band), child_name: String(r.child_name), kind: String(r.kind), starts_at: String(r.starts_at), ends_at: String(r.ends_at), status: String(r.status) })),
    touchDevice: async (deviceId, at) => {
      must(await db().from('online_year_devices').update({ last_seen_at: at }).eq('id', deviceId), 'touch device');
    },
    exists: async (path) => {
      const slash = path.lastIndexOf('/');
      const { data, error } = await bucket().list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
      if (error) throw new Error(`exists: ${error.message}`);
      return (data ?? []).some((o: { name: string }) => o.name === path.slice(slash + 1));
    },
    download: async (path) => {
      const { data, error } = await bucket().download(path);
      if (error || !data) throw new Error(`download ${path}: ${error?.message ?? 'no data'}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    upload: async (path, bytes) => {
      const { error } = await bucket().upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      if (error) throw new Error(`upload ${path}: ${error.message}`);
    },
    signUrl: async (path, seconds) => {
      const { data, error } = await bucket().createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) throw new Error(`sign ${path}: ${error?.message ?? 'no url'}`);
      return data.signedUrl;
    },
    stamp: async (master, opts) => (await stampFooter(master, opts)).bytes,
    listDone: async (licenseIds) =>
      // deno-lint-ignore no-explicit-any
      (must(await db().from('online_year_weeks_done').select('license_id, week, done_on').in('license_id', licenseIds), 'weeks done') as any[])
        .map((r) => ({ license_id: String(r.license_id), week: Number(r.week), done_on: String(r.done_on) })),
    markDone: async (licenseId, week, doneOn) => {
      // The first date a week was marked done is the one the portfolio keeps.
      must(await db().from('online_year_weeks_done').upsert({ license_id: licenseId, week, done_on: doneOn }, { onConflict: 'license_id,week', ignoreDuplicates: true }), 'mark done');
    },
  })
);
