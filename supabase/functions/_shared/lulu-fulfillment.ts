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
// The both-bands bundle (2026-09-26) is one order line whose product has two
// PARTS; it becomes six Lulu line items, each part's books from its own band.
//
// SHIPPING LEVEL (2026-09-26). LULU_SHIPPING_LEVEL for every job, as before,
// unless LULU_SHIPPING_LEVEL_FALLBACK is set: then the job's parcel is quoted
// first and, when Lulu does not offer the primary level for it (a co-op order
// of many notebooks is too heavy for MAIL), the fallback level is used.
//
// THE RECOVERY PATH. Anything that throws inside submitLuluJob puts the job back
// to 'failed' with last_error set and the drain retries it, up to
// LULU_JOB_MAX_ATTEMPTS. Nothing is lost, and nothing is submitted twice: the
// job row is claimed with a compare-and-set before any network call, and an
// order that already carries a lulu_print_job_id is never resubmitted.
//
// HARDENED 2026-11-11 (Lane 2 deep audit area 3, L1 L2 L3 L5 L6 L7; founder go
// "Yes, build + ship all 7"; L4 lives in notify-founder-digest):
//   L1  A claim whose reply was lost (a gateway 504 on a PATCH that DID commit) is
//       confirmed by re-reading the row's microsecond claim stamp, and a claim left
//       in_progress by a worker that died is released by the drain after
//       LULU_STALE_CLAIM_MINUTES (releaseStaleLuluClaims), so it can never sit
//       stuck where Resubmit could not reach it.
//   L2  Any try that might follow an earlier POST asks Lulu first whether a live job
//       already exists for this order (findLiveLuluJobs) and adopts it instead of
//       creating a second print. If Lulu cannot be asked, nothing is sent.
//   L3  A status event for a job that is NOT the order's current job (the dead
//       first jobs of ET-1043 / ET-1044) is ignored instead of applied.
//   L5  Every file URL is read before the POST; a definite bad answer stops the job.
//   L6  Printable ids are no longer cached automatically, so a stale cached file
//       can never be printed (a printable is locked to its package: the matte /
//       gloss lesson of 2026-11-04).
//   L7  Retries are spaced over about 21 hours (LULU_RETRY_DELAYS_MINUTES) instead
//       of every 10 minutes for 50, and the try that uses up the last one emails
//       the founder.
//
// A REFUND inside Lulu's production delay cancels the job (cancelLuluForRefund).
// After production starts Lulu will not cancel, and the founder is told in
// plain words that the books are still coming.

import { Db, getOrderById, getOrderByPaymentIntent, OrderRow } from './order-db.ts';
import { transition } from './order-flow.ts';
import { sendPrintCancelledEmail } from './order-messages.ts';
import { captureException } from './sentry.ts';
import { alertFounder } from './founder-alert.ts';
import { checkPrintFileUrl, PrintFileCheck, printFileHost } from './print-file-check.ts';
import {
  cancelPrintJob,
  createPrintJob,
  getPrintJob,
  getShippingOptionLevels,
  listPrintJobs,
  LuluAddress,
  LuluApiError,
  LuluCostLineItem,
  luluCostCents,
  LuluLineItemInput,
  LuluPrintJob,
  luluTrackingFromJob,
  stripeAddressToLulu,
} from './lulu.ts';
import {
  checkCartBands,
  LULU_PRODUCTION_DELAY_MINUTES,
  LuluProduct,
  luluBookByKey,
  luluBandsForSku,
  luluContactEmail,
  luluLineExternalId,
  luluProductBySku,
  luluProductParts,
  luluShippingLevel,
  luluShippingLevelFallback,
  LuluShippingLevel,
  normalizeLuluBand,
  pickShippingLevel,
  printableMapKey,
} from './lulu-config.ts';

/**
 * Give up automatic retries after this many tries, so a poison row cannot loop forever.
 * The try that uses up the last one emails the founder (L7). Was 5 tries, 10 minutes
 * apart, with no email (2026-11-11).
 */
export const LULU_JOB_MAX_ATTEMPTS = 8;

/**
 * Minutes the drain waits after failed try N (index N-1) before the next try (L7).
 * 10 + 20 + 40 + 80 + 160 + 320 + 640 = 1270 minutes: the eight tries span about 21
 * hours, so a Lulu outage overnight is ridden out instead of exhausting the retries in
 * 50 minutes. Lulu holds every job 48 hours before printing anyway.
 */
export const LULU_RETRY_DELAYS_MINUTES: readonly number[] = [10, 20, 40, 80, 160, 320, 640];

/**
 * A claim still in_progress after this long belongs to a worker that died or never
 * heard back (L1). An edge function cannot run anywhere near this long.
 */
export const LULU_STALE_CLAIM_MINUTES = 15;

export interface LuluJobRow {
  id: string;
  order_id: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'failed' | 'cancelled';
  attempts: number;
  last_error: string | null;
  print_job_id: number | null;
  submitted_at: string | null;
  created_at: string;
  /** The claim stamp while in_progress; the failure time once failed. */
  updated_at?: string | null;
}

export const LULU_JOB_COLUMNS = 'id, order_id, status, attempts, last_error, print_job_id, submitted_at, created_at, updated_at';

/**
 * Whether the drain should try this row now (L7). A pending row always; a failed row
 * once LULU_RETRY_DELAYS_MINUTES has passed since its last failure (updated_at). A
 * row whose time cannot be read is tried, so a bad timestamp never strands an order.
 */
export function luluRetryDue(row: Pick<LuluJobRow, 'status' | 'attempts' | 'updated_at'>, now: Date = new Date()): boolean {
  if (row.status === 'pending') return true;
  if (row.status !== 'failed') return false;
  if (row.attempts < 1) return true;
  const failedAt = Date.parse(String(row.updated_at ?? ''));
  if (Number.isNaN(failedAt)) return true;
  const delays = LULU_RETRY_DELAYS_MINUTES;
  const wait = delays[Math.min(row.attempts, delays.length) - 1] * 60_000;
  return now.getTime() >= failedAt + wait;
}

/** A claim stamp with microseconds, so two claims in the same millisecond never look alike (L1). */
export function luluClaimStamp(now: Date = new Date()): string {
  const micro = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return now.toISOString().replace('Z', `${micro}Z`);
}

/**
 * A timestamp as integer microseconds since the epoch; null when unreadable. Accepts
 * what we send ("...T14:22:33.123456Z") and what PostgREST returns
 * ("...T14:22:33.12345+00:00": Postgres drops trailing zeros).
 */
export function timestampMicros(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const m = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d(?::?\d\d)?)?$/.exec(String(ts).trim());
  if (!m) return null;
  let off = m[4] ?? 'Z';
  if (/^[+-]\d\d$/.test(off)) off += ':00';
  else if (/^[+-]\d{4}$/.test(off)) off = `${off.slice(0, 3)}:${off.slice(3)}`;
  const ms = Date.parse(`${m[1]}T${m[2]}${off}`);
  if (Number.isNaN(ms)) return null;
  return ms * 1000 + Number(`${m[3] ?? ''}000000`.slice(0, 6));
}

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
 * A book with a printable_id set by hand is referenced by that id; otherwise both
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
  const products: { it: OrderItemWithProduct; product: LuluProduct }[] = [];
  for (const it of items) {
    const p = it.product;
    if (!p) throw new Error('order line has no product row');
    const product = luluProductBySku(p.sku);
    if (!product || p.fulfillment !== 'lulu') {
      throw new Error(`'${p.sku}' is not a Lulu-fulfilled product`);
    }
    products.push({ it, product });
  }
  // One order prints one band (create-checkout refuses a mixed cart), except an
  // order led by the both-bands bundle. Anything else mixed that reaches here is
  // refused rather than printed half right.
  const bandCheck = checkCartBands(products.map((x) => x.product.sku));
  if (!bandCheck.ok) {
    const seen = [...new Set(products.flatMap((x) => luluBandsForSku(x.product.sku)))];
    throw new Error(`order mixes ${seen.join(' and ')} print products; refusing to build a print job`);
  }
  for (const { it, product } of products) {
    const qty = Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1;
    for (const part of luluProductParts(product)) out.push(...partLines(product.sku, part.band, part.books, qty, printables));
  }
  return out;
}

/** The Lulu line items for one band's books of one order line. */
function partLines(
  sku: string,
  band: LuluProduct['band'],
  books: LuluProduct['books'],
  qty: number,
  printables: Map<string, LuluPrintableRow>,
): LuluLineItemInput[] {
  const out: LuluLineItemInput[] = [];
  for (const key of books) {
    const book = luluBookByKey(key, band);
    const row = printables.get(printableMapKey(band, key));
    // Sprouts error text is unchanged; other bands name the band.
    const label = band === 'sprouts' ? key : `${band}/${key}`;
    if (!book) throw new Error(`product '${sku}' names unknown book '${label}'`);
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
  return out;
}

/**
 * The package, page count and quantity of every book in an order, for a Lulu
 * shipping quote (which wants specs, not printable ids). Null when any book has
 * no package or page count, so the caller keeps the primary level.
 */
export function luluShippingProbeLines(
  items: OrderItemWithProduct[],
  printables: Map<string, LuluPrintableRow>,
): LuluCostLineItem[] | null {
  const out: LuluCostLineItem[] = [];
  for (const it of items) {
    const product = it.product ? luluProductBySku(it.product.sku) : undefined;
    if (!product) return null;
    const qty = Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1;
    for (const part of luluProductParts(product)) {
      for (const key of part.books) {
        const book = luluBookByKey(key, part.band);
        const row = printables.get(printableMapKey(part.band, key));
        const pkg = row?.pod_package_id ?? book?.podPackageId;
        const pages = row?.page_count ?? book?.pageCount;
        if (!pkg || !pages) return null;
        out.push({ pod_package_id: pkg, page_count: pages, quantity: qty });
      }
    }
  }
  return out;
}

/**
 * LULU_SHIPPING_LEVEL, or LULU_SHIPPING_LEVEL_FALLBACK when that is set and Lulu
 * does not offer the primary level for this parcel. With no fallback set this
 * makes no network call and returns the primary level, exactly as before. A
 * failed quote keeps the primary level (Lulu's own refusal is then the loud
 * failure, as it always was).
 */
async function chooseShippingLevel(
  items: OrderItemWithProduct[],
  printables: Map<string, LuluPrintableRow>,
  address: LuluAddress,
  externalId: string,
): Promise<LuluShippingLevel> {
  const primary = luluShippingLevel();
  const fallback = luluShippingLevelFallback();
  if (!fallback) return primary;
  let offered: string[] | null = null;
  try {
    const probe = luluShippingProbeLines(items, printables);
    if (probe) offered = await getShippingOptionLevels({ line_items: probe, shipping_address: address });
  } catch (err) {
    console.warn(`[${externalId}] shipping-options quote failed; keeping ${primary}: ${errMessage(err)}`);
  }
  const level = pickShippingLevel(primary, fallback, offered);
  if (level !== primary) console.log(`[${externalId}] ${primary} not offered for this parcel; shipping ${level}`);
  return level;
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

// L6 (2026-11-11): the automatic printable-id cache (cachePrintableIds) is gone.
// It filled lulu_printables.printable_id from Lulu's reply and never cleared it when
// a file URL, package or page count changed, so a later order could print an old
// file, or the wrong finish (a printable is locked to its package). The column was
// null on every row in production, so Lulu has always fetched the URLs; that is now
// the only path. A printable_id set BY HAND is still honoured (buildLuluLineItems
// and printableProblems agree on that), and whoever sets one owns keeping it current.

export interface SubmitResult {
  order_id: string;
  status: 'submitted' | 'failed' | 'skipped';
  detail?: string;
  print_job_id?: number;
}

/** Lulu print-job statuses after which that job will never print. */
export const LULU_DEAD_JOB_STATUSES = ['REJECTED', 'ERROR', 'CANCELED'] as const;

export function isDeadLuluStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return (LULU_DEAD_JOB_STATUSES as readonly string[]).includes(s);
}

/**
 * Detach a live order from a Lulu job that Lulu rejected, errored or cancelled, so the
 * founder's Resubmit can create a new job. Without this, submitLuluJob's "already at
 * Lulu" guard skips any order that still carries a job id (2026-11-05, ET-1043: job
 * 3140703 REJECTED, Resubmit did nothing).
 *
 * Only for orders still waiting on print (in_production / ready_to_fulfill). The order
 * goes back to ready_to_fulfill by a direct write, not transition(): there is no
 * in_production -> ready_to_fulfill edge, and no message is registered for either that
 * move or the following ready_to_fulfill -> in_production, so the buyer hears nothing.
 * The old job stays on record in lulu_events and in lulu_status_message.
 */
export async function releaseDeadLuluJob(db: Db, orderId: string): Promise<{ released: number | null }> {
  const order = await getOrderById(db, orderId);
  if (!order || !order.lulu_print_job_id || !isDeadLuluStatus(order.lulu_status)) return { released: null };
  if (order.status !== 'in_production' && order.status !== 'ready_to_fulfill') return { released: null };
  const old = order.lulu_print_job_id;
  // Guarded on the dead job id, so a webhook or submit that lands meanwhile is never clobbered.
  const { data, error } = await db.from('orders')
    .update({
      status: 'ready_to_fulfill',
      lulu_print_job_id: null,
      lulu_submitted_at: null,
      lulu_status: null,
      lulu_status_message: `previous Lulu job ${old} ${order.lulu_status}; resubmitted by founder`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('lulu_print_job_id', old)
    .select('id');
  if (error) throw new Error(`orders release failed: ${error.message}`);
  return { released: data && data.length ? old : null };
}

// ── Hardening helpers (2026-11-11) ───────────────────────────────────────────

/** The Lulu calls the hardening uses, injectable so tests never reach Lulu. */
export interface LuluLookupApi {
  getPrintJob: typeof getPrintJob;
  listPrintJobs: typeof listPrintJobs;
}

const LIVE_LULU_API: LuluLookupApi = { getPrintJob, listPrintJobs };

/**
 * Could an earlier try have POSTed this order to Lulu (L2)? True after any earlier try
 * (attempts > 0), when a job id was recorded on the row, or when the row carries a note
 * (Resubmit and the stale-claim release always leave one). Only a never-tried row is
 * certain to have no Lulu job, so only it skips the lookup.
 */
export function luluJobNeedsLookup(job: Pick<LuluJobRow, 'attempts' | 'print_job_id' | 'last_error'>): boolean {
  return job.attempts > 0 || job.print_job_id != null || (job.last_error ?? '') !== '';
}

/** ISO 8601 to the second with a Z: the most precise form Lulu's spec lists for created_after. */
function luluTimestamp(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

/**
 * Every LIVE Lulu job for this order (not REJECTED / ERROR / CANCELED), oldest first (L2).
 * Asks Lulu two ways: the job id an earlier try recorded on our row, if any, and a
 * search for the order's external_id, matched EXACTLY (Lulu's search is a broad text
 * match: ET-104 would also find ET-1043). Throws when Lulu cannot be asked or the answer
 * cannot be trusted; the caller then sends nothing, so an order can never print twice.
 */
export async function findLiveLuluJobs(
  order: Pick<OrderRow, 'created_at'>,
  externalId: string,
  knownJobId: number | null,
  api: LuluLookupApi = LIVE_LULU_API,
): Promise<LuluPrintJob[]> {
  const live = new Map<number, LuluPrintJob>();
  if (knownJobId != null) {
    const j = await api.getPrintJob(knownJobId);
    if (j && typeof j.id === 'number' && !isDeadLuluStatus(j.status?.name)) live.set(j.id, j);
  }
  const created = Date.parse(String(order.created_at ?? ''));
  // A day of slack before the order was created; any job for it was created after.
  const since = Number.isNaN(created) ? undefined : luluTimestamp(created - 86_400_000);
  const page = await api.listPrintJobs({ search: externalId, created_after: since, page_size: 100, exclude_line_items: true });
  if (!page || !Array.isArray(page.results)) throw new Error('Lulu print-job list came back without a results list');
  if (page.next) throw new Error(`Lulu print-job list for ${externalId} ran past one page; check Lulu by hand`);
  for (const j of page.results) {
    if (!j || typeof j.id !== 'number' || j.external_id !== externalId) continue;
    if (isDeadLuluStatus(j.status?.name)) continue;
    live.set(j.id, j);
  }
  return [...live.values()].sort((a, b) => a.id - b.id);
}

/** Record a Lulu job that already exists as this order's job, instead of creating another (L2). */
async function adoptLuluJob(db: Db, jobRowId: string, order: OrderRow, lj: LuluPrintJob): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    fulfillment: 'lulu',
    lulu_print_job_id: lj.id,
    lulu_status: lj.status?.name ?? 'CREATED',
    lulu_status_message: lj.status?.message ?? null,
    lulu_submitted_at: typeof lj.date_created === 'string' && lj.date_created ? lj.date_created : now,
  };
  const cost = luluCostCents(lj);
  if (cost != null) patch.lulu_cost_cents = cost;
  await setOrder(db, order.id, patch);
  await setJob(db, jobRowId, { status: 'submitted', print_job_id: lj.id, submitted_at: now, last_error: null });
  if (order.status === 'ready_to_fulfill') await transition(db, order.id, 'in_production');
}

/**
 * Read every file URL in the job before it goes to Lulu (L5). A definite bad answer
 * (an HTTP error, or something that is not a PDF) throws, so the job fails here with a
 * plain reason instead of failing later at Lulu. No answer at all is only logged: Lulu
 * fetches the files itself, and our own network blip must not hold up a paid order.
 */
export async function assertPrintFilesLookRight(
  lines: LuluLineItemInput[],
  ref: string,
  check: (url: string) => Promise<PrintFileCheck> = (url) => checkPrintFileUrl(url),
): Promise<void> {
  const targets: { label: string; url: string }[] = [];
  for (const l of lines) {
    const book = l.external_id ?? l.title ?? 'book';
    if (l.interior?.source_url) targets.push({ label: `${book} interior`, url: l.interior.source_url });
    if (l.cover?.source_url) targets.push({ label: `${book} cover`, url: l.cover.source_url });
  }
  const results = await Promise.all(targets.map(async (t) => ({ ...t, r: await check(t.url) })));
  for (const x of results.filter((x) => x.r.state === 'unreachable')) {
    console.warn(`[${ref}] print file ${x.label} did not answer the pre-check (${x.r.detail}); sending anyway, Lulu fetches it itself`);
  }
  const bad = results.filter((x) => x.r.state === 'bad');
  if (bad.length) {
    const list = bad.map((x) => `${x.label} (${printFileHost(x.url)}): ${x.r.detail}`).join('; ');
    throw new Error(`print file check failed, Lulu could not print this: ${list}. Fix the link in lulu_printables, then Resubmit`);
  }
}

/**
 * Email the founder that a print order used up every automatic try (L7). Best effort:
 * never throws. Names the order and the reason, never a credential.
 */
async function alertLuluExhausted(db: Db, orderId: string, lastError: string): Promise<boolean> {
  let ref = orderId;
  let buyer = '';
  try {
    const order = await getOrderById(db, orderId);
    if (order) {
      ref = order.order_number ?? order.id;
      buyer = order.customer_email ? ` (${order.customer_email})` : '';
    }
  } catch {
    // The outage that broke the submit may break this read too; the id still names the order.
  }
  const text =
    `Lulu print order ${ref}${buyer} was tried ${LULU_JOB_MAX_ATTEMPTS} times over about a day and was NOT sent to Lulu. ` +
    `Nothing is printing, and the buyer has paid.\n\n` +
    `Last error: ${lastError.slice(0, 600)}\n\n` +
    `What to do: fix the cause (usually a file link or a setting), then press Resubmit on the /founder Orders tab. ` +
    `If the error says Lulu could not be checked for an existing job, look the order up in your Lulu account first, ` +
    `so it is not printed twice. Or refund the order in Stripe.`;
  return alertFounder(`Lulu print order ${ref} NOT sent after ${LULU_JOB_MAX_ATTEMPTS} tries`, text, 'lulu-fulfillment');
}

/**
 * Release in_progress claims older than LULU_STALE_CLAIM_MINUTES (L1). Their worker died
 * mid-submit, or its claim reply was lost; before this they sat in_progress for good,
 * invisible to the drain and out of Resubmit's reach. Each goes back to 'failed' with a
 * note (so the next try asks Lulu for an existing job first, L2); one that was already on
 * its last try is closed and the founder is told. The release is guarded on status,
 * attempts and age, so a live claim is never touched and two drains never both act.
 */
export async function releaseStaleLuluClaims(db: Db, now: Date = new Date()): Promise<{ released: number; exhausted: number }> {
  const cutoff = new Date(now.getTime() - LULU_STALE_CLAIM_MINUTES * 60_000).toISOString();
  const { data, error } = await db.from('lulu_jobs').select(LULU_JOB_COLUMNS)
    .eq('status', 'in_progress').lt('updated_at', cutoff).limit(20);
  if (error) throw new Error(`stale claim scan failed: ${error.message}`);
  let released = 0;
  let exhausted = 0;
  for (const row of (data ?? []) as LuluJobRow[]) {
    const last = row.attempts >= LULU_JOB_MAX_ATTEMPTS;
    const note = `the submit stopped partway (claimed ${row.updated_at ?? 'at an unknown time'}); ` +
      `Lulu is asked for an existing job before any retry` + (last ? `. That was the last of ${LULU_JOB_MAX_ATTEMPTS} tries` : '');
    const { data: done, error: e2 } = await db.from('lulu_jobs')
      .update({ status: 'failed', last_error: note, updated_at: now.toISOString() })
      .eq('id', row.id).eq('status', 'in_progress').eq('attempts', row.attempts).lt('updated_at', cutoff)
      .select('id');
    if (e2) {
      console.error(`[lulu job ${row.id}] stale claim release failed: ${e2.message}`);
      continue;
    }
    if (!Array.isArray(done) || done.length === 0) continue;
    released++;
    console.warn(`[lulu job ${row.id}] released a stale in_progress claim (try ${row.attempts})`);
    if (last) {
      exhausted++;
      await alertLuluExhausted(db, row.order_id, note);
    }
  }
  return { released, exhausted };
}

/**
 * The claim PATCH came back empty. That is normal when another worker won, but it is
 * also what a gateway 504 looks like when our PATCH DID commit and pgrstFetch's repeat
 * then matched nothing (L1). Re-read the row: it is ours only if it is in_progress
 * with our attempt number and our exact microsecond stamp.
 */
async function claimLandedAnyway(db: Db, job: Readonly<LuluJobRow>, stamp: string): Promise<boolean> {
  try {
    const { data, error } = await db.from('lulu_jobs').select('status, attempts, updated_at').eq('id', job.id).maybeSingle();
    if (error || !data) return false;
    const row = data as { status: string; attempts: number; updated_at: string | null };
    const mine = timestampMicros(stamp);
    return row.status === 'in_progress' && row.attempts === job.attempts + 1 && mine != null && timestampMicros(row.updated_at) === mine;
  } catch {
    return false;
  }
}

/**
 * Submit one queued job to Lulu.
 *
 *   1. claim: compare-and-set pending/failed -> in_progress, attempts + 1.
 *      The loser of a kick/drain race sees zero rows and reports 'skipped'.
 *   2. guard: the order must be ready_to_fulfill and carry no Lulu job yet.
 *   3. build the payload from order_items × products × lulu_printables and
 *      the Stripe address.
 *      2b. (L2) a try that might follow an earlier POST asks Lulu for a live job
 *          for this order first, and adopts it instead of creating a second one.
 *   3. build the payload from order_items × products × lulu_printables and
 *      the Stripe address, and (L5) read every file URL.
 *   4. POST. On success record the job id, order -> in_production,
 *      job -> submitted.
 *   5. On any failure: job -> failed with the reason, for the drain to retry
 *      (spaced by LULU_RETRY_DELAYS_MINUTES); the last try emails the founder (L7).
 */
export async function submitLuluJob(db: Db, jobIn: LuluJobRow, api: LuluLookupApi = LIVE_LULU_API): Promise<SubmitResult> {
  // The row as it was read, before this try: every decision below uses this snapshot,
  // never a field the claim has since changed.
  const job: Readonly<LuluJobRow> = { ...jobIn };
  // 1. Claim. The stamp carries microseconds so a lost reply can be confirmed (L1).
  const stamp = luluClaimStamp();
  const { data: claimed, error: claimError } = await db.from('lulu_jobs')
    .update({ status: 'in_progress', attempts: job.attempts + 1, updated_at: stamp })
    .eq('id', job.id)
    .in('status', ['pending', 'failed'])
    .lt('attempts', LULU_JOB_MAX_ATTEMPTS)
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error(`lulu_jobs claim failed: ${claimError.message}`);
  if (!claimed) {
    if (!(await claimLandedAnyway(db, job, stamp))) {
      return { order_id: job.order_id, status: 'skipped', detail: 'not claimable (already running, submitted, or out of attempts)' };
    }
    console.warn(`[lulu job ${job.id}] claim reply was lost but the claim landed; carrying on (try ${job.attempts + 1})`);
  }

  const attempt = job.attempts + 1;
  /** Set once Lulu has created a job, so a failure after that keeps its id (L2). */
  let createdId: number | null = null;
  try {
    // 2. Guard.
    const order = await getOrderById(db, job.order_id);
    if (!order) throw new Error(`order ${job.order_id} not found`);
    if (order.status === 'cancelled' || order.status === 'refunded') {
      await setJob(db, job.id, { status: 'cancelled', last_error: `order is ${order.status}` });
      return { order_id: order.id, status: 'skipped', detail: `order is ${order.status}` };
    }
    if (order.lulu_print_job_id && isDeadLuluStatus(order.lulu_status)) {
      // Lulu rejected, errored or cancelled that job: it will never print. Keep the job
      // FAILED so /founder shows Resubmit. (2026-11-05: this path used to flip ET-1043's
      // rejected job back to 'submitted', which hid the rejection and blocked Resubmit.)
      await setJob(db, job.id, {
        status: 'failed',
        print_job_id: order.lulu_print_job_id,
        last_error: `Lulu job ${order.lulu_print_job_id} is ${order.lulu_status}: fix the cause, then Resubmit`,
      });
      return { order_id: order.id, status: 'skipped', detail: `Lulu job ${order.lulu_print_job_id} is ${order.lulu_status}`, print_job_id: order.lulu_print_job_id };
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
    const externalId = order.order_number ?? order.id;

    // 2b. (L2) Could an earlier try have reached Lulu? Then ask Lulu before sending again.
    if (luluJobNeedsLookup(job)) {
      let live: LuluPrintJob[];
      try {
        live = await findLiveLuluJobs(order, externalId, job.print_job_id, api);
      } catch (e) {
        throw new Error(
          `could not ask Lulu whether a print job already exists for ${externalId} (${errMessage(e).slice(0, 300)}); ` +
            `nothing was sent again, so it cannot print twice`,
        );
      }
      if (live.length > 0) {
        const keep = live[0];
        await adoptLuluJob(db, job.id, order, keep);
        console.log(`[${externalId}] Lulu already holds live job ${keep.id}; recorded it instead of creating another`);
        if (live.length > 1) {
          await notifyFounder(
            `Lulu holds ${live.length} live print jobs for order ${externalId}`,
            `Lulu holds ${live.length} live print jobs for order ${externalId} (${order.customer_email}): ` +
              `${live.map((j) => `${j.id} (${j.status?.name ?? '?'})`).join(', ')}.\n\n` +
              `The order now tracks job ${keep.id}. The others would print a second set and Lulu would charge for it. ` +
              `Cancel the extra job(s) in your Lulu account while they are still inside the production delay.`,
          );
        }
        return { order_id: order.id, status: 'submitted', detail: `adopted existing Lulu job ${keep.id}`, print_job_id: keep.id };
      }
    }

    // 3. Payload.
    const items = await loadItems(db, order.id);
    const printables = await loadPrintables(db);
    const lineItems = buildLuluLineItems(items, printables);
    const shippingAddress = stripeAddressToLulu(order);
    const shippingLevel = await chooseShippingLevel(items, printables, shippingAddress, externalId);
    // (L5) Every file must still answer as a PDF before Lulu is asked to print it.
    await assertPrintFilesLookRight(lineItems, externalId);

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
    createdId = created.id;

    // The id is written to the ORDER first, so a crash after this point can
    // never produce a second job for the same order (see the guard above).
    // If this write itself fails, the catch keeps the id on the job row and the
    // next try adopts the job instead of creating another (L2).
    await setOrder(db, order.id, {
      fulfillment: 'lulu',
      lulu_print_job_id: created.id,
      lulu_status: created.status?.name ?? 'CREATED',
      lulu_status_message: created.status?.message ?? null,
      lulu_submitted_at: new Date().toISOString(),
      lulu_cost_cents: luluCostCents(created),
    });
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
    console.error(`[lulu job ${job.id}] submit failed (attempt ${attempt} of ${LULU_JOB_MAX_ATTEMPTS}): ${message}`);
    const failure: Record<string, unknown> = { status: 'failed', last_error: message.slice(0, 2000) };
    // Lulu holds a job we could not record on the order: keep its id so the next try adopts it (L2).
    if (createdId != null) failure.print_job_id = createdId;
    await setJob(db, job.id, failure).catch((e) =>
      console.error(`[lulu job ${job.id}] could not record failure: ${errMessage(e)}`)
    );
    await captureException(err, { function: 'lulu-fulfillment', stage: 'submit', order_id: job.order_id, attempt });
    // (L7) The try that uses up the last one tells the founder. Only one worker can hold
    // the claim for this try, so this sends once per exhaustion.
    if (attempt >= LULU_JOB_MAX_ATTEMPTS) await alertLuluExhausted(db, job.order_id, message);
    return { order_id: job.order_id, status: 'failed', detail: message };
  }
}

// ── Status changes from Lulu ─────────────────────────────────────────────────

export interface ApplyResult {
  order_id: string | null;
  lulu_status: string;
  applied: string;
}

async function findOrderForJob(db: Db, job: LuluPrintJob): Promise<{ order: OrderRow; by: 'job_id' | 'external_id' } | null> {
  const byId = await db.from('orders').select('*').eq('lulu_print_job_id', job.id).maybeSingle();
  if (byId.data) return { order: byId.data as OrderRow, by: 'job_id' };
  const ext = typeof job.external_id === 'string' ? job.external_id : '';
  if (ext) {
    const byNumber = await db.from('orders').select('*').eq('order_number', ext).maybeSingle();
    if (byNumber.data) return { order: byNumber.data as OrderRow, by: 'external_id' };
  }
  return null;
}

/**
 * Why an event for Lulu job `jobId`, matched to `order` only by order number, must NOT
 * be applied to it; null when it may (L3). The order-number fallback exists for a job
 * whose id is not on the order yet (Lulu's first event can beat the submit's own write).
 * It must never let an OLD job speak for the order: ET-1043 and ET-1044 each have a dead
 * first job (3140703 REJECTED, 3140704 CANCELED) next to the live one, and a late event
 * from a dead job would mark the order rejected and invite a Resubmit that prints a
 * second set. Two cases:
 *   - the order already tracks a different job;
 *   - the order tracks none because THIS job was released for a Resubmit
 *     (releaseDeadLuluJob writes "previous Lulu job <id> ..." and the Resubmit has not
 *     landed yet).
 */
export function staleLuluJobReason(
  // Not Pick<OrderRow>: OrderRow does not declare lulu_status_message, and editing
  // order-db.ts would put every order function in this change's deploy set.
  order: { lulu_print_job_id?: number | null; lulu_status_message?: string | null },
  jobId: number,
): string | null {
  if (order.lulu_print_job_id != null && Number(order.lulu_print_job_id) !== Number(jobId)) {
    return `the order's current Lulu job is ${order.lulu_print_job_id}`;
  }
  if (order.lulu_print_job_id == null && String(order.lulu_status_message ?? '').startsWith(`previous Lulu job ${jobId} `)) {
    return `job ${jobId} was released from the order for a Resubmit`;
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
  const found = await findOrderForJob(db, job);
  if (!found) {
    console.warn(`lulu job ${job.id} (${job.external_id ?? 'no external id'}) matches no order; status ${name} ignored`);
    return { order_id: null, lulu_status: name, applied: 'no matching order' };
  }
  const { order } = found;
  const ref = order.order_number ?? order.id;

  // (L3) An event from a job that is not this order's job changes nothing on the order.
  const stale = found.by === 'external_id' ? staleLuluJobReason(order, job.id) : null;
  if (stale) {
    console.warn(`[${ref}] Lulu job ${job.id} -> ${name} ignored: ${stale}`);
    if (name === 'SHIPPED' || name === 'DELIVERED') {
      // An old job that SHIPPED means a second set was printed and Lulu will bill for it.
      await notifyFounder(
        `Lulu shipped an OLD print job for order ${ref}`,
        `Lulu says print job ${job.id} for order ${ref} (${order.customer_email}) is ${name}, but ${stale}.\n\n` +
          `So a second set of books may have been printed and shipped, and Lulu may charge for both. ` +
          `Nothing was changed on the order. Check both jobs in your Lulu account.`,
      );
    }
    return { order_id: order.id, lulu_status: name, applied: `ignored: ${stale}` };
  }

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
      // 2026-10-15 lifecycle plan: until now the buyer heard nothing. The order status is left
      // as it is on purpose, so Resubmit still works. Never throws.
      const buyerEmail = await sendPrintCancelledEmail(db, order);
      console.log(`[${ref}] print-cancelled email to buyer: ${buyerEmail}`);
      await notifyFounder(
        `Lulu cancelled order ${ref}`,
        `Lulu cancelled print job ${job.id} for order ${ref} (${order.customer_email}) on its side.\n\n` +
          `Lulu says: ${job.status?.message ?? '(no message)'}\n\n` +
          `The buyer has paid. Resubmit from the /founder Orders tab once the cause is fixed, or refund in Stripe.\n\n` +
          (buyerEmail === 'failed'
            ? `The email telling the buyer FAILED to send. Write to them yourself.`
            : `The buyer has been emailed that the print shop cancelled it and that a full refund is theirs if they ask.`),
      );
      return { order_id: order.id, lulu_status: name, applied: 'founder alerted' };
    }
    default: {
      // CREATED, UNPAID, PAYMENT_IN_PROGRESS, PRODUCTION_DELAYED, PRODUCTION_READY,
      // IN_PRODUCTION: informational. UNPAID for long means no card is on file at
      // Lulu; the 8 AM founder digest surfaces that (L4, notify-founder-digest:
      // 'lulu_printer'), not a per-event email.
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
