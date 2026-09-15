// supabase/functions/lulu-admin/index.ts
// Eden's Table: founder-only actions for the Lulu print-on-demand rail.
//
// The action endpoint behind the Lulu controls on the /founder Orders tab, and
// the way the founder runs the one-time file validation before the first sale.
// Auth: a Supabase user JWT for the founder email (the same boundary the
// founder_* read RPCs enforce with is_founder()). The founder email comes from
// public.app_settings via _shared/founder-identity.ts. cancel also needs the
// founder's authenticator code once one is set up (aal2); before that it runs as
// before and the reply carries "mfa_enrolled": false.
//
// Actions (POST JSON { action, ... }):
//   resubmit          { order_id }   reset the job to pending and submit now
//   cancel            { order_id }   cancel at Lulu (only works inside the production delay)
//   refresh           { order_id }   pull the job from Lulu and apply its status
//   validate_files    { book }       start Lulu's interior + cover validation for one
//                                    printable ('tg' | 'nb' | 'ra')
//   validation_status { interior_id?, cover_id? }   poll those validations
//   cost_preview      { sku, qty, address, shipping_level? }  what Lulu would charge
//                                    for one order of the product (all its books)
//   subscribe_webhook { url }        register lulu-webhook with Lulu (one-time setup)
//   list_webhooks     {}

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  cancelLuluForOrder,
  loadPrintables,
  LULU_JOB_COLUMNS,
  LuluJobRow,
  refreshLuluOrder,
  submitLuluJob,
} from '../_shared/lulu-fulfillment.ts';
import {
  calculatePrintJobCost,
  getCoverValidation,
  getInteriorValidation,
  listWebhooks,
  subscribeWebhook,
  validateCover,
  validateInterior,
} from '../_shared/lulu.ts';
import { luluBookByKey, luluProductBySku, luluShippingLevel } from '../_shared/lulu-config.ts';
import { captureException } from '../_shared/sentry.ts';
import { founderGate, withMfaNudge } from '../_shared/founder-identity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── Founder auth gate ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Invalid or expired session' }, 401);
  const founder = await founderGate(req, user, { requireMfa: false });
  if (!founder.ok) return json({ error: 'Founder access only' }, 403);

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');

  try {
    switch (action) {
      case 'resubmit': {
        const orderId = String(body.order_id ?? '');
        if (!orderId) return json({ error: 'Missing order_id' }, 400);
        // Reset attempts so a job that burned its retries on a since-fixed cause
        // gets a fresh run. Insert the row if the order never got one.
        const { data: existing } = await adminClient.from('lulu_jobs').select('id').eq('order_id', orderId).maybeSingle();
        if (existing) {
          const { error } = await adminClient.from('lulu_jobs')
            .update({ status: 'pending', attempts: 0, last_error: null, updated_at: new Date().toISOString() })
            .eq('order_id', orderId).in('status', ['pending', 'failed', 'cancelled']);
          if (error) throw error;
        } else {
          const { error } = await adminClient.from('lulu_jobs').insert({ order_id: orderId, status: 'pending' });
          if (error) throw error;
        }
        const { data: job, error } = await adminClient.from('lulu_jobs').select(LULU_JOB_COLUMNS).eq('order_id', orderId).maybeSingle();
        if (error || !job) return json({ error: error?.message ?? 'job not found' }, 500);
        const result = await submitLuluJob(adminClient, job as LuluJobRow);
        console.log(`resubmit(${orderId}) by founder:`, JSON.stringify(result));
        return json(result, result.status === 'failed' ? 502 : 200);
      }

      case 'cancel': {
        const orderId = String(body.order_id ?? '');
        if (!orderId) return json({ error: 'Missing order_id' }, 400);
        // Cancelling stops a paid print: authenticator code required once one is set up.
        const gate = await founderGate(req, user, { requireMfa: true });
        if (!gate.ok) return json(gate.body, gate.status);
        const result = await cancelLuluForOrder(adminClient, orderId, 'cancelled by founder');
        console.log(`cancel(${orderId}) by founder:`, JSON.stringify(result));
        return withMfaNudge(json(result, result.outcome === 'error' ? 500 : 200), gate.mfaEnrolled);
      }

      case 'refresh': {
        const orderId = String(body.order_id ?? '');
        if (!orderId) return json({ error: 'Missing order_id' }, 400);
        const result = await refreshLuluOrder(adminClient, orderId);
        return json(result);
      }

      case 'validate_files': {
        const key = String(body.book ?? '');
        const book = luluBookByKey(key);
        if (!book) return json({ error: `'${key}' is not a Lulu book key (tg, nb, ra)` }, 400);
        const printables = await loadPrintables(adminClient);
        const row = printables.get(key);
        if (!row) return json({ error: `lulu_printables has no row for '${key}' (apply migration 20260911000100)` }, 404);
        const pkg = row.pod_package_id ?? book.podPackageId;
        const pages = row.page_count ?? book.pageCount;
        if (!row.interior_url || !row.cover_url) {
          return json({ error: `'${key}' needs interior_url and cover_url set in lulu_printables first` }, 400);
        }
        if (!pages) return json({ error: `'${key}' has no page count; set lulu_printables.page_count` }, 400);
        const interior = await validateInterior(row.interior_url, pkg);
        const cover = await validateCover(row.cover_url, pkg, pages);
        return json({ book: key, pod_package_id: pkg, page_count: pages, interior, cover });
      }

      case 'validation_status': {
        const out: Record<string, unknown> = {};
        if (body.interior_id) out.interior = await getInteriorValidation(String(body.interior_id));
        if (body.cover_id) out.cover = await getCoverValidation(String(body.cover_id));
        return json(out);
      }

      case 'cost_preview': {
        const sku = String(body.sku ?? '');
        const product = luluProductBySku(sku);
        if (!product) return json({ error: `'${sku}' is not a Lulu product` }, 400);
        const qty = Number.isInteger(body.qty) && body.qty > 0 ? body.qty : 1;
        const address = body.address;
        if (!address || typeof address !== 'object') {
          return json({ error: 'address {street1, city, state_code, postcode, country_code, phone_number} is required' }, 400);
        }
        const printables = await loadPrintables(adminClient);
        const lineItems: { pod_package_id: string; page_count: number; quantity: number }[] = [];
        for (const key of product.books) {
          const book = luluBookByKey(key)!;
          const row = printables.get(key);
          const pkg = row?.pod_package_id ?? book.podPackageId;
          const pages = row?.page_count ?? book.pageCount;
          if (!pages) return json({ error: `'${key}' has no page count yet` }, 400);
          lineItems.push({ pod_package_id: pkg, page_count: pages, quantity: qty });
        }
        const level = typeof body.shipping_level === 'string' && body.shipping_level ? body.shipping_level : luluShippingLevel();
        const calc = await calculatePrintJobCost({
          line_items: lineItems,
          shipping_address: address,
          shipping_option: level,
        });
        return json({ sku, qty, books: product.books, shipping_level: level, calculation: calc });
      }

      case 'subscribe_webhook': {
        // Only this project's own lulu-webhook may be registered, so a stolen founder
        // session cannot point Lulu's order events at an outside host.
        const url = String(body.url ?? '');
        const expected = `${(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')}/functions/v1/lulu-webhook`;
        if (url !== expected) return json({ error: `url must be ${expected}` }, 400);
        return json(await subscribeWebhook(url));
      }

      case 'list_webhooks':
        return json(await listWebhooks());

      default:
        return json({ error: `Unknown action '${action}'` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`lulu-admin ${action} failed:`, message);
    await captureException(err, { function: 'lulu-admin', action });
    return json({ error: message }, 500);
  }
});
