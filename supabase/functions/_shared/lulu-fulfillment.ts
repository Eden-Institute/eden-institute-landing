// supabase/functions/_shared/lulu-fulfillment.ts
//
// The Lulu print-on-demand rail, between the orders table and Lulu's API.
//
//   paid order ──enqueueLuluJob──▶ lulu_jobs(pending)
//                                      │  lulu-submit (kick from the webhook, or the cron drain)
//                                      ▼
//                              submitLuluJob: builds the print job from
//                              order_items × products × lulu_printables, POSTs it,
//                              records the job id, order -> in_production
//                                      │  Lulu PRINT_JOB_STATUS_CHANGED webhook
//                                      ▼
//                              applyLuluPrintJob: SHIPPED -> shipped (+tracking, email/SMS),
//                              DELIVERED -> delivered, REJECTED/CANCELED -> founder alert
//
// ONE ORDER LINE, THREE PRINTABLES. The shop sells the three books as one set
// (founder decision 2026-09-10), so a single order_items row for
// sprouts_print_set becomes three Lulu line items, one per book in
// LULU_PRODUCTS[].books, each with the quantity of the set. The printables are
// those of the product's BAND (Sprouts or Seedlings, 2026-09-23), looked up by
// (band, book_key); a Seedlings order can never be sent a Sprouts file.
//
// THE RECOVERY PATH. Anything that throws inside submitLuluJob puts the job back
// to 'failed' with last_error set and the drain retries it, up to
// LULU_JOB_MAX_ATTEMPTS. Nothing is lost, and nothing is submitted twice: the
// job row is claimed with a compare-and-set before any network call, and an
// order that already carries a lulu_print_job_id is never resubmitted.
//
// A REFUND inside Lulu's production delay cancels the job (cancelLuluForRefund).
// After production starts Lulu will not cancel, and the founder is told in
// plain words that the books are still coming.

import { Db, getOrderById, getOrderByPaymentIntent, OrderRow } from './order-db.ts';
import { transition } from './order-flow.ts';
import { captureException } from './sentry.ts';
import {
  cancelPrintJob,
  createPrintJob,
  getPrintJob,
  LuluApiError,
  luluCostCents,
  LuluLineItemInput,
  LuluPrintJob,
  luluTrackingFromJob,
  stripeAddressToLulu,
} from './lulu.ts';
import {
  LULU_PRODUCTION_DELAY_MINUTES,
  LuluBand,
  luluBookByKey,
  luluContactEmail,
  luluLineExternalId,
  luluProductBySku,
  luluShippingLevel,
  normalizeLuluBand,
  parseLuluLineExternalId,
  printableMapKey,
} from './lulu-config.ts';

/** Give up automatic retries after this many, so a poison row cannot loop forever. */
export const LULU_JOB_MAX_ATTEMPTS = 5;

export interface LuluJobRow {
  id: string;
  order_id: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'failed' | 'cancelled';
  attempts: number;
  last_error: string | null;
  print_job_id: number | null;
  submitted_at: string | null;
  created_at: string;
}

export const LULU_JOB_COLUMNS = 'id, order_id, status, attempts, last_error, print_job_id, submitted_at, created_at';

/** A lulu_printables row. */
export interface LuluPrintableRow {
  /** 'sprouts' | 'seedlings'. Absent before migration 20260923200000, meaning Sprouts. */
  band?: string | null;
  book_key: string;
  title: string | null;
  pod_package_id: string | null;
  page_count: number | null;
  interior_url: string | null;
  cover_url: string | null;
  printable_id: string | null;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── Enqueue ──────────────────────────────────────────────────────────────────

/**
 * Queue an order for submission. Idempotent on UNIQUE(order_id): a Stripe
 * webhook retry that reaches this again queues nothing new.
 */
export async function enqueueLuluJob(db: Db, orderId: string): Promise<{ queued: boolean }> {
  const { error } = await db.from('lulu_jobs').insert({ order_id: orderId, status: 'pending' });
  if (!error) return { queued: true };
  // deno-lint-ignore no-explicit-any
  if ((error as any).code === '23505') return { queued: false };
  throw new Error(`lulu_jobs insert failed: ${error.message}`);
}

// ── Submit ───────────────────────────────────────────────────────────────────

export interface OrderItemWithProduct {
  quantity: number;
  product: { sku: string; name: string | null; fulfillment: string | null } | null;
}

async function loadItems(db: Db, orderId: string): Promise<OrderItemWithProduct[]> {
  const { data, error } = await db.from('order_items')
    .select('quantity, product:products(sku, name, fulfillment)')
    .eq('order_id', orderId);
  if (error) throw new Error(`order_items lookup failed: ${error.message}`);
  return (data ?? []) as OrderItemWithProduct[];
}

/**
 * Every lulu_printables row, keyed by printableMapKey(band, book_key). '*' rather
 * than a column list so the `band` column is read once migration 20260923200000
 * has run and nothing breaks before it has (a row with no band is Sprouts).
 */
export async function loadPrintables(db: Db): Promise<Map<string, LuluPrintableRow>> {
  const { data, error } = await db.from('lulu_printables').select('*');
  if (error) throw new Error(`lulu_printables lookup failed: ${error.message}`);
  return new Map<string, LuluPrintableRow>(
    ((data ?? []) as LuluPrintableRow[]).map((r) => [printableMapKey(normalizeLuluBand(r.band), r.book_key), r]),
  );
}

/**
 * Lulu line items for an order: one per (order line × book in the product).
 * A book with a cached printable_id is referenced by that id; otherwise both
 * source URLs and the package id are required, and a book missing any of them
 * is a configuration error named by book key (it will fail every attempt until
 * the founder fills the row, which is the correct behaviour: it cannot be
 * guessed).
 */
export function buildLuluLineItems(
  items: OrderItemWithProduct[],
  printables: Map<string, LuluPrintableRow>,
): LuluLineItemInput[] {
  if (items.length === 0) throw new Error('order has no line items');
  const out: LuluLineItemInput[] = [];
  // One order prints one band (create-checkout refuses a mixed cart). A mixed
  // order reaching here is refused rather than printed half right.
  let orderBand: LuluBand | null = null;
  for (const it of items) {
    const p = it.product;
    if (!p) throw new Error('order line has no product row');
    const product = luluProductBySku(p.sku);
    if (!product || p.fulfillment !== 'lulu') {
      throw new Error(`'${p.sku}' is not a Lulu-fulfilled product`);
    }
    const band = product.band;
    if (orderBand && orderBand !== band) {
      throw new Error(`order mixes ${orderBand} and ${band} print products; refusing to build a print job`);
    }
    orderBand = band;
    const qty = Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1;
    for (const key of product.books) {
      const book = luluBookByKey(key, band);
      const row = printables.get(printableMapKey(band, key));
      // Sprouts error text is unchanged; other bands name the band.
      const label = band === 'sprouts' ? key : `${band}/${key}`;
      if (!book) throw new Error(`product '${p.sku}' names unknown book '${label}'`);
      if (!row) throw new Error(`lulu_printables has no row for '${label}'`);
      const line: LuluLineItemInput = { title: row.title ?? book.title, quantity: qty, external_id: luluLineExternalId(band, key) };
      if (row.printable_id) {
        line.printable_id = row.printable_id;
      } else {
        const pkg = row.pod_package_id ?? book.podPackageId;
        const pages = row.page_count ?? book.pageCount;
        const missing: string[] = [];
        if (!pkg) missing.push('pod_package_id');
        if (!pages) missing.push('page_count');
        if (!row.interior_url) missing.push('interior_url');
        if (!row.cover_url) missing.push('cover_url');
        if (missing.length) {
          throw new Error(`book '${label}' has no printable_id and is missing ${missing.join(', ')} in lulu_printables`);
        }
        line.pod_package_id = pkg!;
        line.interior = { source_url: row.interior_url! };
        line.cover = { source_url: row.cover_url! };
      }
      out.push(line);
    }
  }
  return out;
}

async function setJob(db: Db, jobId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('lulu_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(`lulu_jobs update failed: ${error.message}`);
}

async function setOrder(db: Db, orderId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(`orders update failed: ${error.message}`);
}

/**
 * Cache the printable ids Lulu returned so later orders skip the file transfer.
 * Matched by the line's external_id (luluLineExternalId: the bare book key for
 * Sprouts, 'seedlings-tg' for Seedlings). Only fills an EMPTY cache; a row that
 * already has one is left alone.
 *
 * ALWAYS filtered by band. Without it, a Sprouts 'tg' id would also land on the
 * Seedlings 'tg' row (both empty), and every later Seedlings order would print
 * the Sprouts Teacher's Guide. Before migration 20260923200000 the band column
 * does not exist, the write fails, and the failure is only a warning: the cache
 * is an optimisation, and the next job sends the files again.
 */
async function cachePrintableIds(db: Db, job: LuluPrintJob): Promise<void> {
  for (const li of job.line_items ?? []) {
    const ext = typeof li?.external_id === 'string' ? parseLuluLineExternalId(li.external_id) : null;
    const pid = typeof li?.printable_id === 'string' ? li.printable_id : null;
    if (!ext || !pid) continue;
    const { error } = await db.from('lulu_printables')
      .update({ printable_id: pid, updated_at: new Date().toISOString() })
      .eq('band', ext.band)
      .eq('book_key', ext.key)
      .is('printable_id', null);
    if (error) console.warn(`printable id cache write failed for ${ext.band}/${ext.key}: ${error.message}`);
  }
}

export interface SubmitResult {
  order_id: string;
  status: 'submitted' | 'failed' | 'skipped';
  detail?: string;
  print_job_id?: number;
}

/**
 * Submit one queued job to Lulu.
 *
 *   1. claim: compare-and-set pending/failed -> in_progress, attempts + 1.
 *      The loser of a kick/drain race sees zero rows and reports 'skipped'.
 *   2. guard: the order must be ready_to_fulfill and carry no Lulu job yet.
 *   3. build the payload from order_items × products × lulu_printables and
 *      the Stripe address.
 *   4. POST. On success record the job id, cache printable ids, order ->
 *      in_production, job -> submitted.
 *   5. On any failure: job -> failed with the reason, for the drain to retry.
 */
export async function submitLuluJob(db: Db, job: LuluJobRow): Promise<SubmitResult> {
  // 1. Claim.
  const { data: claimed, error: claimError } = await db.from('lulu_jobs')
    .update({ status: 'in_progress', attempts: job.attempts + 1, updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .in('status', ['pending', 'failed'])
    .lt('attempts', LULU_JOB_MAX_ATTEMPTS)
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`lulu_jobs claim failed: ${claimError.message}`);
  if (!claimed) return { order_id: job.order_id, status: 'skipped', detail: 'not claimable (already running, submitted, or out of attempts)' };

  try {
    // 2. Guard.
    const order = await getOrderById(db, job.order_id);
    if (!order) throw new Error(`order ${job.order_id} not found`);
    if (order.status === 'cancelled' || order.status === 'refunded') {
      await setJob(db, job.id, { status: 'cancelled', last_error: `order is ${order.status}` });
      return { order_id: order.id, status: 'skipped', detail: `order is ${order.status}` };
    }
    if (order.lulu_print_job_id) {
      // Already at Lulu (a previous attempt got the id written, then died).
      await setJob(db, job.id, { status: 'submitted', print_job_id: order.lulu_print_job_id, last_error: null });
      if (order.status === 'ready_to_fulfill') await transition(db, order.id, 'in_production');
      return { order_id: order.id, status: 'skipped', detail: `already submitted as Lulu job ${order.lulu_print_job_id}`, print_job_id: order.lulu_print_job_id };
    }
    if (order.status !== 'ready_to_fulfill') {
      throw new Error(`order ${order.order_number ?? order.id} is ${order.status}, not ready_to_fulfill`);
    }

    // 3. Payload.
    const items = await loadItems(db, order.id);
    const printables = await loadPrintables(db);
    const lineItems = buildLuluLineItems(items, printables);
    const shippingAddress = stripeAddressToLulu(order);
    const shippingLevel = luluShippingLevel();
    const externalId = order.order_number ?? order.id;

    // 4. POST.
    const created = await createPrintJob({
      contact_email: luluContactEmail(),
      external_id: externalId,
      line_items: lineItems,
      production_delay: LULU_PRODUCTION_DELAY_MINUTES,
      shipping_address: shippingAddress,
      shipping_level: shippingLevel,
    });
    if (typeof created?.id !== 'number') {
      throw new Error(`Lulu returned no job id: ${JSON.stringify(created).slice(0, 300)}`);
    }

    // The id is written to the ORDER first, so a crash after this point can
    // never produce a second job for the same order (see the guard above).
    await setOrder(db, order.id, {
      fulfillment: 'lulu',
      lulu_print_job_id: created.id,
      lulu_status: created.status?.name ?? 'CREATED',
      lulu_status_message: created.status?.message ?? null,
      lulu_submitted_at: new Date().toISOString(),
      lulu_cost_cents: luluCostCents(created),
    });
    await cachePrintableIds(db, created);
    await setJob(db, job.id, {
      status: 'submitted',
      print_job_id: created.id,
      submitted_at: new Date().toISOString(),
      last_error: null,
    });
    await transition(db, order.id, 'in_production');

    console.log(`[${externalId}] submitted to Lulu as job ${created.id} (${lineItems.length} line(s), ${shippingLevel})`);
    return { order_id: order.id, status: 'submitted', print_job_id: created.id };
  } catch (err) {
    const message = err instanceof LuluApiError ? `${err.message}` : errMessage(err);
    console.error(`[lulu job ${job.id}] submit failed (attempt ${job.attempts + 1}): ${message}`);
    await setJob(db, job.id, { status: 'failed', last_error: message.slice(0, 2000) }).catch((e) =>
      console.error(`[lulu job ${job.id}] could not record failure: ${errMessage(e)}`)
    );
    await captureException(err, { function: 'lulu-fulfillment', stage: 'submit', order_id: job.order_id, attempt: job.attempts + 1 });
    return { order_id: job.order_id, status: 'failed', detail: message };
  }
}

// ── Status changes from Lulu ─────────────────────────────────────────────────

export interface ApplyResult {
  order_id: string | null;
  lulu_status: string;
  applied: string;
}

async function findOrderForJob(db: Db, job: LuluPrintJob): Promise<OrderRow | null> {
  const byId = await db.from('orders').select('*').eq('lulu_print_job_id', job.id).maybeSingle();
  if (byId.data) return byId.data as OrderRow;
  const ext = typeof job.external_id === 'string' ? job.external_id : '';
  if (ext) {
    const byNumber = await db.from('orders').select('*').eq('order_number', ext).maybeSingle();
    if (byNumber.data) return byNumber.data as OrderRow;
  }
  return null;
}

/**
 * Apply a Lulu print job's current state to our order. Used by the webhook and
 * by the founder's "refresh" action, so both paths agree by construction.
 * Idempotent: transitions are guarded by the state machine and messages by
 * message_log, so replaying the same SHIPPED payload sends nothing twice.
 */
export async function applyLuluPrintJob(db: Db, job: LuluPrintJob): Promise<ApplyResult> {
  const name = String(job.status?.name ?? '').toUpperCase();
  const order = await findOrderForJob(db, job);
  if (!order) {
    console.warn(`lulu job ${job.id} (${job.external_id ?? 'no external id'}) matches no order; status ${name} ignored`);
    return { order_id: null, lulu_status: name, applied: 'no matching order' };
  }
  const ref = order.order_number ?? order.id;

  const patch: Record<string, unknown> = {
    lulu_status: name,
    lulu_status_message: job.status?.message ?? null,
  };
  // Never null out a cost we already know because a later payload omits it.
  const cost = luluCostCents(job);
  if (cost != null) patch.lulu_cost_cents = cost;
  if (!order.lulu_print_job_id) patch.lulu_print_job_id = job.id;

  switch (name) {
    case 'SHIPPED': {
      const t = luluTrackingFromJob(job);
      if (t) {
        patch.shipping_carrier = t.carrier ?? order.shipping_carrier ?? null;
        patch.tracking_number = t.trackingNumber ?? order.tracking_number ?? null;
        patch.tracking_url = t.trackingUrl ?? order.tracking_url ?? null;
      }
      if (!order.shipped_at) patch.shipped_at = job.status?.changed ?? new Date().toISOString();
      await setOrder(db, order.id, patch);
      // ready_to_fulfill -> shipped is not an edge; a job that shipped without our
      // in_production record (webhook arrived before the submit path finished its
      // writes) is walked through it so the shipped message still fires.
      if (order.status === 'ready_to_fulfill') await transition(db, order.id, 'in_production');
      await transition(db, order.id, 'shipped');
      return { order_id: order.id, lulu_status: name, applied: 'shipped' };
    }
    case 'DELIVERED': {
      if (!order.delivered_at) patch.delivered_at = job.status?.changed ?? new Date().toISOString();
      await setOrder(db, order.id, patch);
      if (order.status === 'ready_to_fulfill') await transition(db, order.id, 'in_production');
      if (order.status === 'ready_to_fulfill' || order.status === 'in_production') await transition(db, order.id, 'shipped');
      await transition(db, order.id, 'delivered');
      return { order_id: order.id, lulu_status: name, applied: 'delivered' };
    }
    case 'REJECTED':
    case 'ERROR': {
      await setOrder(db, order.id, patch);
      await db.from('lulu_jobs').update({ status: 'failed', last_error: `Lulu ${name}: ${job.status?.message ?? ''}`.slice(0, 2000), updated_at: new Date().toISOString() }).eq('order_id', order.id);
      const text =
        `Lulu ${name} print job ${job.id} for order ${ref} (${order.customer_email}).\n\n` +
        `Lulu says: ${job.status?.message ?? '(no message)'}\n\n` +
        `The buyer has paid and nothing is being printed. Fix the cause (usually a file Lulu could not use), ` +
        `then use Resubmit on the /founder Orders tab, or refund the order in Stripe.`;
      await notifyFounder(`Lulu ${name}: order ${ref} needs you`, text);
      await captureException(new Error(`Lulu ${name} for order ${ref}`), { function: 'lulu-fulfillment', stage: 'status', order_id: order.id, lulu_job: job.id });
      return { order_id: order.id, lulu_status: name, applied: 'founder alerted' };
    }
    case 'CANCELED': {
      await setOrder(db, order.id, patch);
      const { data: jobRow } = await db.from('lulu_jobs').select('status').eq('order_id', order.id).maybeSingle();
      if (jobRow?.status === 'cancelled') {
        // We cancelled it (refund path). Nothing to say.
        return { order_id: order.id, lulu_status: name, applied: 'cancelled by us' };
      }
      await db.from('lulu_jobs').update({ status: 'cancelled', last_error: `Lulu cancelled: ${job.status?.message ?? ''}`.slice(0, 2000), updated_at: new Date().toISOString() }).eq('order_id', order.id);
      await notifyFounder(
        `Lulu cancelled order ${ref}`,
        `Lulu cancelled print job ${job.id} for order ${ref} (${order.customer_email}) on its side.\n\n` +
          `Lulu says: ${job.status?.message ?? '(no message)'}\n\n` +
          `The buyer has paid. Resubmit from the /founder Orders tab once the cause is fixed, or refund in Stripe.`,
      );
      return { order_id: order.id, lulu_status: name, applied: 'founder alerted' };
    }
    default: {
      // CREATED, UNPAID, PAYMENT_IN_PROGRESS, PRODUCTION_DELAYED, PRODUCTION_READY,
      // IN_PRODUCTION: informational. UNPAID for long means no card is on file at
      // Lulu; the founder digest is the place to surface that, not a per-event email.
      await setOrder(db, order.id, patch);
      return { order_id: order.id, lulu_status: name, applied: 'status recorded' };
    }
  }
}

/** Founder "Refresh" action: pull the job from Lulu and apply it. */
export async function refreshLuluOrder(db: Db, orderId: string): Promise<ApplyResult> {
  const order = await getOrderById(db, orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (!order.lulu_print_job_id) throw new Error(`order ${order.order_number ?? orderId} has no Lulu job`);
  const job = await getPrintJob(order.lulu_print_job_id);
  return applyLuluPrintJob(db, job);
}

// ── Refunds and cancellation ─────────────────────────────────────────────────

export interface CancelResult {
  order_id: string | null;
  outcome: 'cancelled' | 'too_late' | 'no_job' | 'no_order' | 'error';
  detail?: string;
}

/**
 * Try to stop the print when an order is refunded or cancelled. NEVER throws:
 * the refund has already happened in Stripe, so this must not block the
 * webhook. Three outcomes the founder needs to be able to tell apart:
 *   cancelled  Lulu accepted the cancel; nothing prints.
 *   too_late   Lulu refused (production started). The books WILL ship. The
 *              founder is emailed so they can decide what to tell the buyer.
 *   no_job     Nothing had been submitted yet; the queued job is cancelled locally.
 */
export async function cancelLuluForOrder(db: Db, orderId: string, reason: string): Promise<CancelResult> {
  try {
    const order = await getOrderById(db, orderId);
    if (!order) return { order_id: null, outcome: 'no_order' };
    const ref = order.order_number ?? order.id;
    if (!order.lulu_print_job_id) {
      await db.from('lulu_jobs').update({ status: 'cancelled', last_error: reason, updated_at: new Date().toISOString() })
        .eq('order_id', order.id).in('status', ['pending', 'failed', 'in_progress']);
      return { order_id: order.id, outcome: 'no_job' };
    }
    if (order.status === 'shipped' || order.status === 'delivered') {
      return { order_id: order.id, outcome: 'too_late', detail: `order already ${order.status}` };
    }
    try {
      // Mark ours first so the CANCELED webhook that follows reads as "by us".
      await db.from('lulu_jobs').update({ status: 'cancelled', last_error: reason, updated_at: new Date().toISOString() }).eq('order_id', order.id);
      const status = await cancelPrintJob(order.lulu_print_job_id);
      await setOrder(db, order.id, { lulu_status: status?.name ?? 'CANCELED', lulu_status_message: status?.message ?? reason });
      console.log(`[${ref}] Lulu job ${order.lulu_print_job_id} cancelled (${reason})`);
      return { order_id: order.id, outcome: 'cancelled' };
    } catch (err) {
      const detail = errMessage(err);
      // Put the job row back the way it was: Lulu still holds a live job.
      await db.from('lulu_jobs').update({ status: 'submitted', last_error: `cancel refused: ${detail}`.slice(0, 2000), updated_at: new Date().toISOString() }).eq('order_id', order.id);
      await notifyFounder(
        `Refund on ${ref}, but Lulu could not cancel the print`,
        `Order ${ref} (${order.customer_email}) was ${reason}, but Lulu refused to cancel print job ${order.lulu_print_job_id}: ` +
          `${detail}\n\nThat almost always means production has started, so the books will still ship to the buyer ` +
          `and Lulu will still charge us for them. Decide whether to tell the buyer to keep them.`,
      );
      return { order_id: order.id, outcome: 'too_late', detail };
    }
  } catch (err) {
    const detail = errMessage(err);
    console.error(`cancelLuluForOrder(${orderId}) failed: ${detail}`);
    await captureException(err, { function: 'lulu-fulfillment', stage: 'cancel', order_id: orderId });
    return { order_id: orderId, outcome: 'error', detail };
  }
}

/** Refund path (stripe-webhook charge.refunded): locate by payment intent. */
export async function cancelLuluForRefund(db: Db, paymentIntentId: string): Promise<CancelResult> {
  const order = await getOrderByPaymentIntent(db, paymentIntentId);
  if (!order) return { order_id: null, outcome: 'no_order' };
  if (order.fulfillment !== 'lulu' && !order.lulu_print_job_id) return { order_id: order.id, outcome: 'no_job' };
  return cancelLuluForOrder(db, order.id, 'refunded in Stripe');
}

// ── Founder alerts ───────────────────────────────────────────────────────────

/**
 * Plain-text email to the founder. Same env names as founding-milestones.ts.
 * Never throws; a failed alert is logged and captured, because the caller is
 * usually already handling a worse problem.
 */
export async function notifyFounder(subject: string, text: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('FOUNDER_EMAIL') ?? 'hello@edeninstitute.health';
  const from = Deno.env.get('FROM_EMAIL') ?? 'The Eden Institute <hello@edeninstitute.health>';
  if (!resendKey) {
    console.error(`notifyFounder: RESEND_API_KEY missing; could not send "${subject}"`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } catch (err) {
    console.error(`notifyFounder failed for "${subject}": ${errMessage(err)}`);
    await captureException(err, { function: 'lulu-fulfillment', stage: 'notifyFounder', subject });
  }
}
