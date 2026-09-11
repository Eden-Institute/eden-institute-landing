// supabase/functions/print-order-status/index.ts
// Eden's Table: what a buyer sees on /books/thank-you after paying.
//
// Input:  POST { session_id }  (the Stripe Checkout session id from success_url)
// Output: the buyer's own order, in the words the page needs, or { pending: true }
//         while the Stripe webhook has not written the row yet (the redirect
//         usually beats the webhook by a second or two; the page polls).
//
// WHAT IS RETURNED AND WHY IT IS SAFE. A Checkout session id is an unguessable
// 66-character token that only the payer's browser is given, and it is the
// same proof /starter/thank-you and verify-session already accept. The
// response carries nothing a stranger could use: no card, no phone, no street
// address, no Stripe ids. The ship-to line is name + city + state only, which
// is enough for the buyer to spot a wrong address and ask for a fix inside the
// cancellation window.
//
// Deploy with verify_jwt=false (supabase/config.toml): called anonymously from
// the Astro island.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { LULU_PRODUCTION_DELAY_MINUTES } from '../_shared/lulu-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    status,
  });
}

/** The buyer-facing stage. Mirrors the order state machine without exposing it. */
function stageFor(status: string, luluStatus: string | null): 'received' | 'printing' | 'shipped' | 'delivered' | 'cancelled' {
  if (status === 'cancelled' || status === 'refunded') return 'cancelled';
  if (status === 'delivered') return 'delivered';
  if (status === 'shipped') return 'shipped';
  if (status === 'in_production' && luluStatus === 'IN_PRODUCTION') return 'printing';
  return 'received';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  if (!/^cs_(live|test)_[A-Za-z0-9]{20,}$/.test(sessionId)) {
    return json({ error: 'Missing or malformed session_id' }, 400);
  }

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: o, error } = await db
      .from('orders')
      .select('id, order_number, status, fulfillment, product_label, amount_total_cents, tax_cents, currency, customer_email, shipping_name, shipping_address, created_at, lulu_status, shipping_carrier, tracking_number, tracking_url, shipped_at, delivered_at')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();
    if (error) throw new Error(`orders lookup failed: ${error.message}`);
    if (!o) return json({ pending: true });

    const { data: items } = await db
      .from('order_items')
      .select('quantity, product:products(name)')
      .eq('order_id', o.id);

    const created = new Date(o.created_at);
    const cancelUntil = new Date(created.getTime() + LULU_PRODUCTION_DELAY_MINUTES * 60_000);
    const addr = (o.shipping_address ?? {}) as { city?: string | null; state?: string | null };

    return json({
      pending: false,
      order_number: o.order_number,
      stage: stageFor(o.status, o.lulu_status),
      product_label: o.product_label,
      // deno-lint-ignore no-explicit-any
      items: (items ?? []).map((i: any) => ({ name: i.product?.name ?? o.product_label, quantity: i.quantity })),
      amount_total_cents: o.amount_total_cents,
      tax_cents: o.tax_cents,
      currency: o.currency ?? 'usd',
      email: o.customer_email,
      ship_to: { name: o.shipping_name, city: addr.city ?? null, state: addr.state ?? null },
      placed_at: o.created_at,
      cancel_until: cancelUntil.toISOString(),
      // Only present once Lulu has shipped.
      tracking: o.tracking_number || o.tracking_url
        ? { carrier: o.shipping_carrier, number: o.tracking_number, url: o.tracking_url, shipped_at: o.shipped_at }
        : null,
      delivered_at: o.delivered_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('print-order-status:', message);
    return json({ error: 'Could not load the order right now.' }, 500);
  }
});
