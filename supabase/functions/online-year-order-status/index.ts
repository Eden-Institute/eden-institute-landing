// supabase/functions/online-year-order-status/index.ts
// Eden's Table Online Year (punch #472): what /online-year/thank-you shows after paying.
//
// Input:  POST { session_id }  (the Stripe Checkout session id from the success redirect)
// Output: { state: "pending" } or { state: "ready", band, children: [{ name, ends_at }] }.
// DARK: 404 { error: "not_found" } until ONLINE_YEAR_ENABLED (or the x-online-year-preview header),
// exactly like create-checkout's Online Year branch.
//
// All the logic, and why the answer is safe to give an anonymous caller, is in
// ../_shared/online-year-status.ts (unit tested in CI). This file only wires the database:
// service role, read only, never a Stripe call.
//
// Deploy with verify_jwt=false (supabase/config.toml), the same as print-order-status: called
// anonymously from the Astro island.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ONLINE_YEAR_PREVIEW_HEADER } from '../_shared/online-year-gate.ts';
import {
  handleOnlineYearOrderStatus,
  type OnlineYearStatusLicense,
  type OnlineYearStatusOrder,
} from '../_shared/online-year-status.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type, ${ONLINE_YEAR_PREVIEW_HEADER}`,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Created on first use, so the dark 404 never touches the service role key.
const makeDb = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
let client: ReturnType<typeof makeDb> | null = null;
function db() {
  if (!client) client = makeDb();
  return client;
}

serve((req) =>
  handleOnlineYearOrderStatus(req, {
    cors: corsHeaders,
    findOrder: async (sessionId): Promise<OnlineYearStatusOrder | null> => {
      const { data, error } = await db()
        .from('orders')
        .select('id, lookup_key')
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle();
      if (error) throw new Error(`orders lookup failed: ${error.message}`);
      return data ? { id: String(data.id), lookup_key: data.lookup_key == null ? null : String(data.lookup_key) } : null;
    },
    listLicenses: async (orderId): Promise<OnlineYearStatusLicense[]> => {
      const { data, error } = await db()
        .from('online_year_licenses')
        .select('band, child_name, ends_at, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .order('child_name', { ascending: true });
      if (error) throw new Error(`online_year_licenses lookup failed: ${error.message}`);
      // deno-lint-ignore no-explicit-any
      return (data ?? []).map((r: any) => ({
        band: String(r.band),
        child_name: String(r.child_name),
        ends_at: String(r.ends_at),
        created_at: String(r.created_at),
      }));
    },
  })
);
