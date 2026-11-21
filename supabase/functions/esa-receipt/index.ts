// esa-receipt: the reimbursement-ready receipt form on /esa/florida. Added 2026-11-20 (Lane 2c).
//
// A family who bought on our store sends { orderNumber, email, parentName, students }. This function:
//   1. throttles: per IP, per order number (so one order cannot be probed with many emails),
//      and a site-wide hourly cap. All three fail open, like every limiter here;
//   2. reads the order by number and checks the email on it, server-side. A wrong number and a
//      wrong email get the same 404, so nothing about any order leaks;
//   3. asks Stripe (live, every time) that the payment succeeded, equals the order total and has
//      nothing refunded or disputed, and reads the card brand and last 4 from the charge;
//   4. builds the itemized Receipt with the same receipt.ts functions the order emails use, and
//      refuses if it does not add up to the amount paid;
//   5. returns the one-page PDF as base64 for an instant download.
//
// It stores nothing, emails nothing and writes no rows (no new table). Order details never go in a
// URL or an analytics event: the page POSTs the form and builds the download in memory.
//
// verify_jwt is OFF (config.toml): anonymous families call it from a static page.
// E2E test orders (orders.raw.metadata.e2e_test) are checked against the Stripe TEST key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bumpRateBucket, clientIp } from '../_shared/rate-bucket.ts';
import { captureException } from '../_shared/sentry.ts';
import {
  BOOK_RECEIPT_NAMES,
  bookDigitalReceipt,
  loadOrderReceipt,
  receiptBalances,
  starterReceipt,
  type Receipt,
} from '../_shared/receipt.ts';
import { STARTER_LOOKUP_KEYS } from '../_shared/starter-config.ts';
import {
  emailMatches,
  isE2eOrder,
  longCentralDate,
  NOT_FOUND_MESSAGE,
  orderRefusal,
  parseReceiptRequest,
  paymentIntentId,
  paymentMethodLabel,
  receiptFilename,
  shipToLines,
  stripeRefusal,
  type ReceiptOrder,
  type StripePaymentFacts,
} from '../_shared/paid-receipt.ts';
import { renderPaidReceiptPdf } from '../_shared/paid-receipt-pdf.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Per IP per 10 minutes. A family needs one, maybe three after a typo. */
const PER_IP_LIMIT = 8;
const PER_IP_WINDOW = 600;
/** Per order number per hour, whatever the IP: blunts guessing the email for a known number. */
const PER_ORDER_LIMIT = 6;
const PER_ORDER_WINDOW = 3600;
/** Site-wide per hour. Far above real use; stops a flood from running up Stripe reads. */
const HOURLY_CAP = 120;

const GENERIC_ERROR =
  'Something went wrong making your receipt. Please try again in a minute, or write to hello@edeninstitute.health and we will send it by hand.';
const SLOW_DOWN = 'Too many tries. Please wait a few minutes and try again, or write to hello@edeninstitute.health.';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** True when this count is over the limit. A null count (limiter down) is allowed: fail open. */
const over = (count: number | null, limit: number) => count !== null && count > limit;

/** Reads the PaymentIntent and its latest charge from Stripe. Throws on any Stripe error. */
async function stripeFacts(pi: string, testKey: boolean): Promise<StripePaymentFacts> {
  const key = testKey ? Deno.env.get('STRIPE_TEST_SECRET_KEY') : Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error(`stripe key missing (${testKey ? 'test' : 'live'})`);
  if (testKey && !key.startsWith('sk_test_')) throw new Error('STRIPE_TEST_SECRET_KEY is not a test key');
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(pi)}?expand[]=latest_charge`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`stripe payment_intents ${res.status}: ${body?.error?.type ?? 'no body'}`);
  const charge = body.latest_charge && typeof body.latest_charge === 'object' ? body.latest_charge : null;
  return {
    intentStatus: String(body.status ?? ''),
    amountReceived: Number(body.amount_received ?? 0),
    chargePaid: charge?.paid === true && charge?.status === 'succeeded',
    chargeRefunded: charge?.refunded === true,
    amountRefunded: Number(charge?.amount_refunded ?? 0),
    disputed: charge?.disputed === true,
    methodDetails: charge?.payment_method_details ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: GENERIC_ERROR });

  const body = await req.json().catch(() => null);
  // Honeypot: a hidden field real families never see.
  if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).company === 'string' && (body as Record<string, string>).company.trim()) {
    return json(400, { error: 'Please fill in the form.' });
  }
  const parsed = parseReceiptRequest(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const sub = parsed.value;

  // Throttle before any lookup. Each bucket key is SHA-256 hashed by bumpRateBucket; nothing raw is stored.
  const bump = (key: string, windowSeconds: number) =>
    bumpRateBucket({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, key, windowSeconds });
  const ip = clientIp(req);
  const [ipCount, orderCount, hourCount] = await Promise.all([
    ip ? bump(`esa-receipt:ip:${ip}`, PER_IP_WINDOW) : Promise.resolve(null),
    bump(`esa-receipt:order:${sub.orderNumber}`, PER_ORDER_WINDOW),
    bump(`esa-receipt:hour:${new Date().toISOString().slice(0, 13)}`, 3600),
  ]);
  if (over(ipCount, PER_IP_LIMIT) || over(orderCount, PER_ORDER_LIMIT)) return json(429, { error: SLOW_DOWN, code: 'RATE_LIMITED' });
  if (over(hourCount, HOURLY_CAP)) {
    console.warn(`esa-receipt: site-wide hourly cap reached (${hourCount})`);
    return json(429, { error: SLOW_DOWN, code: 'RATE_LIMITED' });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: order, error } = await db
      .from('orders')
      .select('id, order_number, customer_email, status, amount_total_cents, tax_cents, created_at, raw, shipping_name, shipping_address, lookup_key, stripe_payment_intent_id')
      .eq('order_number', sub.orderNumber)
      .maybeSingle();
    if (error) throw new Error(`orders read: ${error.message}`);
    // Same answer for "no such order" and "wrong email".
    if (!order || !emailMatches(sub.email, order.customer_email)) return json(404, { error: NOT_FOUND_MESSAGE, code: 'NOT_FOUND' });

    const o = order as ReceiptOrder & Record<string, unknown>;
    const refused = orderRefusal(o);
    if (refused) return json(422, { error: refused.message, code: refused.code });

    const facts = await stripeFacts(paymentIntentId(o)!, isE2eOrder(o));
    const notPaid = stripeRefusal(o, facts);
    if (notPaid) return json(422, { error: notPaid.message, code: notPaid.code });
    const paidWith = paymentMethodLabel(facts.methodDetails);
    if (!paidWith) throw new Error(`no usable payment method on ${sub.orderNumber} (${facts.methodDetails?.type ?? 'none'})`);

    // The same receipt the order emails print.
    const lookupKey = typeof o.lookup_key === 'string' ? o.lookup_key : '';
    let receipt: Receipt | null = await loadOrderReceipt(db, o as never);
    if (!receipt && STARTER_LOOKUP_KEYS.includes(lookupKey)) receipt = starterReceipt(o, lookupKey);
    if (!receipt && BOOK_RECEIPT_NAMES[lookupKey] && lookupKey.endsWith('_digital')) receipt = bookDigitalReceipt(o, lookupKey);
    if (!receipt) {
      return json(422, { error: 'This kind of order needs a receipt made by hand. Please write to hello@edeninstitute.health and we will send it.', code: 'UNSUPPORTED' });
    }
    if (!receiptBalances(receipt)) throw new Error(`receipt for ${sub.orderNumber} does not add up to the amount paid`);

    const { bytes } = await renderPaidReceiptPdf({
      receipt: { ...receipt, paidWith },
      paidWith,
      parentName: sub.parentName,
      students: sub.students,
      shipTo: shipToLines(o.shipping_name as string | null, o.shipping_address),
      issuedOn: longCentralDate(new Date()),
    });
    return json(200, {
      ok: true,
      orderNumber: sub.orderNumber,
      filename: receiptFilename(sub.orderNumber),
      pdfBase64: b64(bytes),
    });
  } catch (e) {
    console.error('esa-receipt failed:', e instanceof Error ? e.message : String(e));
    await captureException(e, { function: 'esa-receipt' });
    return json(500, { error: GENERIC_ERROR });
  }
});
