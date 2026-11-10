// supabase/functions/_shared/starter-fulfillment.ts
//
// Delivery for the Starter Unit: stamp, store, sign, send.
//
// EVERY STAGE IS LOGGED against the Stripe session id (spec: "Log every
// fulfillment attempt against the Stripe session ID so failures can be traced and
// manually re-sent"). starter_delivery_attempts gets one row per stage per
// attempt, with the stage NAMED, so "which step broke for this buyer" is an
// indexed lookup rather than a log search.
//
// THE RECOVERY PATH, which is the part that matters at 2am:
//   - Anything throws -> the delivery goes back to 'failed' with last_error set,
//     and the cron drain retries it, up to STARTER_MAX_ATTEMPTS. The attempt that
//     uses up the last try emails the founder at once (2026-11-10, D1), instead of
//     leaving it for the next morning's digest.
//   - The email is the LAST step and is guarded by sent_at, so a retry after a
//     recorded send is a no-op. A send whose "sent" write never landed (the write
//     failed, or the worker died in between) is caught by Resend's Idempotency-Key
//     instead (2026-11-10, D2; resend-idempotency.ts), so the retry does not put a
//     second copy in the buyer's inbox.
//   - A master PDF too big to stamp safely is refused by name before stamping
//     (2026-11-10, D3), rather than crashing the worker at the memory ceiling.
//   - Stamped PDFs are kept. A retry after a successful stamp re-signs the
//     existing objects instead of re-stamping 20MB, so retries get cheaper rather
//     than more expensive.
//
// WHY THE MASTERS ARE STAMPED SEQUENTIALLY. Measured 2026-08-26 on the real
// files: the Teacher's Guide is 54 pages / 12.74MB and stamps in 193ms, the
// Student Notebook 47 pages / 7.22MB in 104ms, peaking around 122MB RSS. Doing
// both at once would roughly double the peak against a 256MB ceiling to save
// 100ms, which is a bad trade.

import { Db } from './order-db.ts';
import { stampFooter } from './starter-pdf.ts';
import {
  DOWNLOAD_URL_TTL_SECONDS,
  STARTER_BANDS,
  STARTER_BUCKET,
  STARTER_LICENSE_LINE,
  STARTER_SOURCE_BUCKET,
  normalizeStarterBand,
} from './starter-config.ts';
import { renderStarterDeliveryEmail, StarterEmailModel } from './starter-email.ts';
import { Receipt, starterReceipt } from './receipt.ts';
import { tagEmailHtml, tagEmailText, type EmailTag } from './email-utm.ts';
import { FPEA_OFFER_ID, isFpeaGiftDeliveryKey } from './fpea-offer.ts';
import { STARTER_GIFT_ID, isStarterGiftDeliveryKey } from './starter-gift.ts';
import { alertFounder } from './founder-alert.ts';
import {
  IDEMPOTENCY_HEADER,
  classifyResendResponse,
  deliveryIdempotencyKey,
  type ResendOutcome,
} from './resend-idempotency.ts';

/**
 * Give up automatic retries after this many, so a poison row cannot loop forever.
 * Moved here from starter-fulfill/index.ts (2026-11-10) so the attempt that uses up
 * the last try can tell the founder itself.
 */
export const STARTER_MAX_ATTEMPTS = 5;

/**
 * Size guard for the master PDFs (2026-11-10, D3; the 2026-09-01 Canva lesson in
 * CLAUDE.md). pdf-lib holds the whole file while it stamps, and all three masters
 * and all three stamped copies are held together until upload, against a 256 MB
 * edge-function ceiling. The raw Canva exports on 9/1 were 41.67 / 42.42 / 21.58 MB
 * and would have run every purchase out of memory: no catch block runs on an OOM, so
 * the row just sat in_progress. Refusing by name turns that into a normal failure
 * with a clear reason, which the retry limit then reports to the founder.
 *
 * Live masters on 2026-11-10 (storage.objects, partner-assets/sample/): Sprouts
 * 13.08 + 11.81 + 2.65 MB = 27.54 MB; Seedlings 10.94 + 12.07 + 3.75 MB = 26.76 MB.
 * The limits leave room for an ordinary re-export and refuse a raw print-grade one.
 * Fix for a refusal: recompress the file (PyMuPDF rewrite_images, see CLAUDE.md) and
 * upload it again; never raise these to make a big file fit.
 */
export const STARTER_MASTER_MAX_BYTES = 18 * 1024 * 1024;
export const STARTER_MASTERS_TOTAL_MAX_BYTES = 36 * 1024 * 1024;

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MB`;

/** Null when the file is within the limits, otherwise the reason (with the path). */
export function masterSizeProblem(path: string, bytes: number, totalSoFar: number): string | null {
  if (bytes > STARTER_MASTER_MAX_BYTES) {
    return `${path} is ${mb(bytes)}, over the ${mb(STARTER_MASTER_MAX_BYTES)} per-file limit`;
  }
  if (totalSoFar + bytes > STARTER_MASTERS_TOTAL_MAX_BYTES) {
    return `the masters come to ${mb(totalSoFar + bytes)} with ${path}, over the ${mb(STARTER_MASTERS_TOTAL_MAX_BYTES)} limit for one delivery`;
  }
  return null;
}

/**
 * The founder email for a delivery that has used up its automatic tries (D1). Pure,
 * so the wording is tested. Names the row by its id, not its session key: an ESA
 * row's key is a download credential and does not belong in an email.
 */
export function starterExhaustedAlert(input: {
  deliveryId: string;
  email: string;
  band: string;
  attempts: number;
  lastError: string;
  workerDied?: boolean;
}): { subject: string; text: string } {
  const what = input.workerDied
    ? 'The delivery worker stopped partway through its last try without recording an error (most likely the memory or time limit).'
    : `The last try failed with: ${input.lastError.slice(0, 600)}`;
  return {
    subject: `Starter Unit NOT delivered after ${input.attempts} tries (${input.band})`,
    text: [
      'A Starter Unit buyer has not received their files, and the automatic retries have stopped.',
      '',
      `Buyer: ${input.email}`,
      `Band: ${input.band}`,
      `Tries: ${input.attempts}`,
      `Delivery row: ${input.deliveryId}`,
      '',
      what,
      '',
      'Their delivery email has not gone out. Nothing retries on its own from here.',
      `Once the cause is fixed, tell Claude "retry the Starter delivery ${input.deliveryId}". You can also send their files by hand.`,
    ].join('\n'),
  };
}

/**
 * An in_progress delivery older than this belongs to a worker that died (OOM at
 * the memory ceiling, wall-clock kill), because no catch block ran to mark it
 * failed. An Edge Function run lasts minutes at most; same rule as
 * digest-run-claim STALE_PENDING_MS, widened.
 */
export const STALE_IN_PROGRESS_MS = 15 * 60 * 1000;

export function staleInProgressCutoff(now = Date.now()): string {
  return new Date(now - STALE_IN_PROGRESS_MS).toISOString();
}

/**
 * Read a required env var at CALL time, not module-load time, and name it when
 * it is missing.
 *
 * Both halves matter. Reading at module load bakes in whatever was set when the
 * isolate booted, which makes the module untestable and papers over a missing
 * value with an empty string. And an empty base URL does not fail loudly: it
 * produces a RELATIVE fetch and the runtime reports `Invalid URL:
 * '/storage/v1/object/...'`, which points at the path and says nothing about the
 * variable that is actually missing. That exact shape of message cost three
 * diagnosis rounds on the partner-sample endpoint in August 2026, which is why
 * that file now names its missing variable too.
 */
function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set; cannot fulfil a starter delivery`);
  return v;
}

const supabaseUrl = () => requiredEnv('SUPABASE_URL');
const serviceRoleKey = () => requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
// orders.edeninstitute.health has Resend click tracking OFF, so the download links
// reach privacy inboxes (Proton, tracker blockers) unwrapped. Replies still go to hello@.
const FROM = 'Camila at The Eden Institute <hello@orders.edeninstitute.health>';
const REPLY_TO = 'hello@edeninstitute.health';

export interface DeliveryRow {
  id: string;
  stripe_checkout_session_id: string;
  order_id: string | null;
  email: string;
  purchaser_name: string | null;
  status: string;
  attempts: number;
  sent_at: string | null;
  tg_object_path: string | null;
  nb_object_path: string | null;
  ra_object_path: string | null;
  download_token: string;
  /**
   * 'sprouts' | 'seedlings' (2026-09-23). Null or absent on rows written before
   * the band column existed, which are all Sprouts (normalizeStarterBand). Every
   * band-specific thing below, masters, filenames, email and receipt, keys off it.
   */
  band?: string | null;
}

type Stage = 'claim' | 'fetch_master' | 'stamp' | 'upload' | 'sign' | 'email' | 'complete';

/** Append one stage row. Never throws: a logging failure must not fail a delivery. */
async function logStage(
  db: Db,
  delivery: DeliveryRow,
  attempt: number,
  stage: Stage,
  ok: boolean,
  detail?: string,
  durationMs?: number,
): Promise<void> {
  try {
    await db.from('starter_delivery_attempts').insert({
      stripe_checkout_session_id: delivery.stripe_checkout_session_id,
      delivery_id: delivery.id,
      attempt,
      stage,
      ok,
      detail: detail ? String(detail).slice(0, 2000) : null,
      duration_ms: durationMs ?? null,
    });
  } catch (err) {
    console.error(
      `[${delivery.stripe_checkout_session_id}] attempt log write failed (${stage}):`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Thrown for a master over the size guard, so the caller can name it as such. */
class MasterTooLargeError extends Error {}

/**
 * Download one object. With `maxBytes`, a declared Content-Length over it is refused
 * before the body is read (D3), so an oversized master never even lands in memory.
 */
async function storageDownload(bucket: string, path: string, maxBytes?: number): Promise<Uint8Array> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${bucket}/${path}`, {
    headers: { Authorization: `Bearer ${serviceRoleKey()}`, apikey: serviceRoleKey() },
  });
  if (!res.ok) {
    throw new Error(`storage download ${bucket}/${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const declared = Number(res.headers.get('content-length'));
  if (maxBytes && Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel();
    throw new MasterTooLargeError(`${path} is ${mb(declared)}, over the ${mb(maxBytes)} per-file limit`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function storageUpload(bucket: string, path: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey()}`,
      apikey: serviceRoleKey(),
      'Content-Type': 'application/pdf',
      // Upsert so a retry overwrites its own half-finished object rather than
      // 409ing forever on a path that already exists.
      'x-upsert': 'true',
    },
    // Type-only cast, no runtime change. Newer TypeScript (Deno 2.9 in CI) types a
    // plain Uint8Array as Uint8Array<ArrayBufferLike>, which its fetch typings no
    // longer accept as a body (TS2769), although every runtime does. This line was the
    // "deno check fails when several entrypoints are checked together" quirk in the
    // Lane 2 tracker (2026-11-09); it surfaced in CI once a test imported this module.
    // Copying to a fresh ArrayBuffer to satisfy the type would double ~13 MB per file.
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`storage upload ${bucket}/${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
}

/**
 * Two URLs for the same signed object, because one link cannot serve both jobs.
 *
 * `save` carries Supabase's `download` parameter, which sets
 * `Content-Disposition: attachment` so the file lands on disk under a readable
 * name instead of a uuid. That is the right behaviour on a desktop browser and
 * the WRONG behaviour inside a mail app.
 *
 * `view` omits it, so the response is served inline and a browser with a PDF
 * viewer simply renders it.
 *
 * WHY THIS SPLIT EXISTS. On 2026-09-05 a buyer wrote in to say her download
 * links were "just blank". They were not: her exact link resolved 302 -> 200 and
 * returned a valid 13 MB PDF when fetched, and the file itself was checked page
 * by page with zero blank pages. What failed was the last inch. Her mail app
 * opened the link in its own embedded browser, which has no PDF viewer and no
 * way to accept an attachment, so it opened a tab and showed her white space.
 * Forcing the attachment made it unrecoverable rather than merely awkward.
 *
 * So links that a buyer might tap from inside an email default to `view`, and
 * `save` is offered as the deliberate second action on a real web page.
 */
export interface DownloadPair {
  view: string;
  save: string;
}

/**
 * Mint a signed URL pair for one private object. Signs ONCE; the two forms
 * differ only by the trailing `download` parameter.
 */
export async function signedUrl(
  path: string,
  filename: string,
  ttl = DOWNLOAD_URL_TTL_SECONDS,
): Promise<DownloadPair> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${STARTER_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey()}`,
      apikey: serviceRoleKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: ttl }),
  });
  if (!res.ok) {
    throw new Error(`signing ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const { signedURL } = await res.json() as { signedURL: string };
  const view = `${supabaseUrl()}/storage/v1${signedURL}`;
  return { view, save: `${view}&download=${encodeURIComponent(filename)}` };
}

/**
 * Fresh links for an already-stamped delivery. Backs the re-request flow.
 * The saved filenames follow the delivery's band, so a Seedlings buyer's files
 * never land on disk named "Sprouts".
 */
export async function mintDownloadLinks(
  delivery: Pick<DeliveryRow, 'tg_object_path' | 'nb_object_path' | 'ra_object_path' | 'band'>,
): Promise<{ teachersGuide: DownloadPair; studentNotebook: DownloadPair; readAloud: DownloadPair }> {
  if (!delivery.tg_object_path || !delivery.nb_object_path || !delivery.ra_object_path) {
    throw new Error('delivery has no stamped objects yet');
  }
  const names = STARTER_BANDS[normalizeStarterBand(delivery.band)].filenames;
  return {
    teachersGuide: await signedUrl(delivery.tg_object_path, names.teachersGuide),
    studentNotebook: await signedUrl(delivery.nb_object_path, names.studentNotebook),
    readAloud: await signedUrl(delivery.ra_object_path, names.readAloud),
  };
}

export interface FulfilResult {
  status: 'sent' | 'skipped' | 'failed';
  detail?: string;
}

/**
 * Run one delivery end to end.
 *
 * Claiming is a compare-and-set on status, so two concurrent drains (a cron tick
 * racing the webhook's own fire-and-forget kick) cannot both send. The loser sees
 * zero rows updated and returns 'skipped'.
 *
 * A row stuck in 'in_progress' past STALE_IN_PROGRESS_MS is also claimable: its
 * worker died without reaching the catch block. The winning UPDATE sets
 * updated_at to now, so a concurrent takeover re-evaluates the WHERE and matches
 * nothing. A kill between the send and the sent_at writeback used to re-send the
 * delivery email on takeover; since 2026-11-10 (D2) the takeover sends under the same
 * Idempotency-Key, so Resend returns the first send instead (within its 24 hours,
 * far longer than the 15-minute stale window).
 */
export async function fulfilStarterDelivery(
  db: Db,
  delivery: DeliveryRow,
  creditCode: string | null,
): Promise<FulfilResult> {
  const sid = delivery.stripe_checkout_session_id;
  const attempt = (delivery.attempts ?? 0) + 1;

  if (delivery.sent_at) {
    console.log(`[${sid}] already delivered at ${delivery.sent_at}; skipping`);
    return { status: 'skipped', detail: 'already sent' };
  }

  const claim = await db.from('starter_deliveries')
    .update({ status: 'in_progress', attempts: attempt, updated_at: new Date().toISOString() })
    .eq('id', delivery.id)
    // The timestamp is quoted: '.' and ':' are reserved in PostgREST or-syntax.
    .or(`status.in.(pending,failed),and(status.eq.in_progress,updated_at.lt."${staleInProgressCutoff()}")`)
    .select('id');
  const claimed = Array.isArray(claim.data) ? claim.data.length > 0 : !!claim.data;
  if (!claimed) {
    await logStage(db, delivery, attempt, 'claim', false, 'another worker holds this delivery');
    return { status: 'skipped', detail: 'claimed elsewhere' };
  }
  await logStage(db, delivery, attempt, 'claim', true);

  try {
    // Throws on an unrecognised band, which lands in the catch below and marks
    // the delivery failed. Stamping a guessed band would email the wrong
    // curriculum with this buyer's name on every page.
    const band = normalizeStarterBand(delivery.band);
    const cfg = STARTER_BANDS[band];

    // Each file is stamped INDEPENDENTLY when its path is missing, rather than
    // all-or-nothing. Two reasons:
    //   1. A delivery that was fulfilled before the Read-Aloud was added has two
    //      paths and a null third. Per-file stamping heals it on the next pass
    //      instead of needing a data migration or a forced re-stamp of 20MB.
    //   2. A partial upload failure only redoes the file that failed.
    const stampOpts = {
      purchaserName: delivery.purchaser_name,
      email: delivery.email,
      licenseLine: STARTER_LICENSE_LINE,
    };

    const plan = [
      { key: 'tg_object_path', master: cfg.masters.teachersGuide, out: 'teachers-guide.pdf', have: delivery.tg_object_path },
      { key: 'nb_object_path', master: cfg.masters.studentNotebook, out: 'student-notebook.pdf', have: delivery.nb_object_path },
      { key: 'ra_object_path', master: cfg.masters.readAloud, out: 'read-aloud.pdf', have: delivery.ra_object_path },
    ] as const;

    const paths: Record<string, string> = {};
    const missing = plan.filter((f) => !f.have);
    for (const f of plan) if (f.have) paths[f.key] = f.have;

    if (missing.length) {
      // Sequential on purpose. Measured on the real masters: 54 pages / 12.74MB in
      // 193ms and 47 / 7.22MB in 104ms, peaking around 122MB RSS. Doing all three
      // at once would roughly triple the peak against a 256MB ceiling to save a
      // few hundred milliseconds of a request that is dominated by I/O anyway.
      let bytes = 0, pages: number[] = [];
      const t0 = performance.now();
      const loaded: Array<{ key: string; out: string; data: Uint8Array }> = [];
      for (const f of missing) {
        let data: Uint8Array;
        try {
          data = await storageDownload(STARTER_SOURCE_BUCKET, f.master, STARTER_MASTER_MAX_BYTES);
        } catch (err) {
          const why = err instanceof Error ? err.message : String(err);
          await logStage(db, delivery, attempt, 'fetch_master', false, `${band} master ${f.master}: ${why}`);
          if (err instanceof MasterTooLargeError) {
            throw new Error(`STARTER MASTER TOO LARGE TO STAMP (${band}): ${why}. Recompress it and upload it again.`);
          }
          // Named loudly: a missing master is an upload that has not happened
          // (the Seedlings masters were not in the bucket when this shipped), and
          // "storage download failed: 400" alone sends the diagnosis elsewhere.
          throw new Error(
            `STARTER MASTER MISSING OR UNREADABLE (${band}): ${STARTER_SOURCE_BUCKET}/${f.master}. ${why}`,
          );
        }
        // D3: checked again on the real byte count (a response may not declare its
        // length) and on the running total, BEFORE anything is stamped.
        const tooBig = masterSizeProblem(f.master, data.length, bytes);
        if (tooBig) {
          await logStage(db, delivery, attempt, 'fetch_master', false, `${band}: ${tooBig}`);
          throw new Error(`STARTER MASTER TOO LARGE TO STAMP (${band}): ${tooBig}. Recompress it and upload it again.`);
        }
        bytes += data.length;
        loaded.push({ key: f.key, out: f.out, data });
      }
      await logStage(db, delivery, attempt, 'fetch_master', true,
        `${missing.length} file(s), ${bytes} bytes`, Math.round(performance.now() - t0));

      const t1 = performance.now();
      const stamped: Array<{ key: string; out: string; data: Uint8Array }> = [];
      for (const f of loaded) {
        const r = await stampFooter(f.data, stampOpts);
        pages.push(r.pagesStamped);
        stamped.push({ key: f.key, out: f.out, data: r.bytes });
      }
      await logStage(db, delivery, attempt, 'stamp', true,
        `${pages.join('+')} pages`, Math.round(performance.now() - t1));

      const t2 = performance.now();
      for (const f of stamped) {
        const path = `personalised/${delivery.id}/${f.out}`;
        await storageUpload(STARTER_BUCKET, path, f.data);
        paths[f.key] = path;
      }
      await logStage(db, delivery, attempt, 'upload', true,
        `${stamped.length} file(s)`, Math.round(performance.now() - t2));

      // Persist BEFORE the email. If the send fails, the retry re-signs rather
      // than re-stamping.
      const { error } = await db.from('starter_deliveries')
        .update({ ...paths, updated_at: new Date().toISOString() })
        .eq('id', delivery.id);
      if (error) throw new Error(`object path writeback failed: ${error.message}`);
    } else {
      await logStage(db, delivery, attempt, 'stamp', true, 'reused all three stamped objects');
    }

    // Signed here as a reachability check, not to be pasted into the email: if
    // any of the three objects cannot be signed, the buyer should not be told
    // their files are ready. The result is deliberately discarded.
    const t3 = performance.now();
    await mintDownloadLinks({
      tg_object_path: paths.tg_object_path,
      nb_object_path: paths.nb_object_path,
      ra_object_path: paths.ra_object_path,
      band,
    });
    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);
    await logStage(db, delivery, attempt, 'sign', true, `expires ${expiresAt.toISOString()}`,
      Math.round(performance.now() - t3));

    // The email carries the DURABLE token link, not these signed URLs.
    //
    // Signing still happens above and is still logged as its own stage, because
    // it is the last cheap proof that all three objects exist and are reachable
    // before a buyer is told their files are ready. What changed on 2026-09-05
    // is only where the buyer is sent: at a page that can explain itself, rather
    // than at three raw PDFs that some mail apps render as a white screen.
    // Itemized receipt (2026-09-12, scholarship states). Read from the order row
    // the webhook wrote. Best effort BY DESIGN: a missing order must never hold
    // back a buyer's files, so a miss is logged and the email goes without it.
    let receipt: Receipt | null = null;
    // FPEA 2027 gift (fpea-offer.ts): the Starter came free with a printed set. Its
    // order_id is the PRINT order, whose receipt is in the order confirmation, so
    // no receipt here (a Starter receipt built from it would show the set's total).
    // Founder gift (starter-gift.ts): nothing was bought, so there is no order at all.
    const giftId = isFpeaGiftDeliveryKey(sid) ? FPEA_OFFER_ID : isStarterGiftDeliveryKey(sid) ? STARTER_GIFT_ID : null;
    const gift = giftId !== null;
    if (delivery.order_id && !gift) {
      try {
        const { data: orderRow } = await db.from('orders')
          .select('order_number, created_at, amount_total_cents, tax_cents, raw')
          .eq('id', delivery.order_id)
          .maybeSingle();
        if (orderRow) receipt = starterReceipt(orderRow, cfg.lookupKey);
      } catch (e) {
        console.error(`[${sid}] receipt load threw; sending without it:`, String(e));
      }
    }
    if (!receipt && !gift) console.error(`[${sid}] NO itemized receipt on this delivery (order_id=${delivery.order_id ?? 'null'})`);

    const model: StarterEmailModel = {
      firstName: (delivery.purchaser_name ?? '').trim().split(/\s+/)[0] || null,
      email: delivery.email,
      creditCode,
      downloadToken: delivery.download_token,
      receipt,
      band,
      ...(giftId ? { gift: giftId } : {}),
    };

    // D2: the Idempotency-Key generation is the number of DEFINITE Resend refusals
    // already logged for this delivery (stage 'email', ok false). It changes only
    // after a recorded refusal, so a retry after an unclear outcome (the "sent" write
    // failed, the worker died, a concurrent 409) reuses the key and Resend returns the
    // first send instead of mailing a second copy. resend-idempotency.ts says why.
    const { count: refusals, error: refusalsErr } = await db.from('starter_delivery_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_id', delivery.id)
      .eq('stage', 'email')
      .eq('ok', false);
    if (refusalsErr) throw new Error(`could not read earlier email attempts: ${refusalsErr.message}`);
    const idempotencyKey = deliveryIdempotencyKey('starter-delivery', delivery.id, refusals ?? 0);

    const t4 = performance.now();
    const sendResult = await sendDeliveryEmail(model, sid, idempotencyKey);
    if (sendResult.outcome === 'refused') {
      await logStage(db, delivery, attempt, 'email', false, sendResult.detail, Math.round(performance.now() - t4));
      throw new Error(`Resend send failed: ${sendResult.detail}`);
    }
    if (sendResult.outcome === 'in_flight') {
      // Not logged as a refusal, so the next try keeps this key.
      throw new Error('Resend is still sending this delivery from another worker; the next try checks again');
    }
    await logStage(db, delivery, attempt, 'email', true,
      sendResult.outcome === 'already_sent' ? 'already accepted under this idempotency key' : undefined,
      Math.round(performance.now() - t4));

    const { error: doneErr } = await db.from('starter_deliveries')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        links_expire_at: expiresAt.toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.id);
    if (doneErr) {
      // The buyer HAS their email. Logged and swallowed: there is nothing useful to
      // retry here. The row stays in_progress with sent_at null, so the drain will
      // re-claim it after STALE_IN_PROGRESS_MS and run the send again; that second
      // send reuses the same Idempotency-Key (no refusal was logged), so Resend
      // returns the first send and the buyer gets one copy. (Before 2026-11-10 this
      // comment said swallowing alone prevented the second copy; it did not.)
      console.error(`[${sid}] delivered but status writeback failed: ${doneErr.message}`);
    }
    await logStage(db, delivery, attempt, 'complete', true);
    console.log(`[${sid}] starter unit delivered to ${delivery.email} (attempt ${attempt})`);
    return { status: 'sent' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${sid}] starter fulfilment failed on attempt ${attempt}: ${message}`);
    await logStage(db, delivery, attempt, 'complete', false, message);
    await db.from('starter_deliveries')
      .update({ status: 'failed', last_error: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq('id', delivery.id);
    // D1 (2026-11-10): the try that uses up the automatic retries tells the founder
    // now, not at the next 8 AM digest. A manual re-kick past the limit that fails
    // again alerts again, which is right: someone is waiting on it.
    if (attempt >= STARTER_MAX_ATTEMPTS) {
      let bandName = String(delivery.band ?? 'sprouts');
      try { bandName = normalizeStarterBand(delivery.band); } catch { /* keep the raw value */ }
      const alert = starterExhaustedAlert({
        deliveryId: delivery.id,
        email: delivery.email,
        band: bandName,
        attempts: attempt,
        lastError: message,
      });
      await alertFounder(alert.subject, alert.text, 'starter-fulfill');
    }
    return { status: 'failed', detail: message };
  }
}

/**
 * Send the delivery email under an Idempotency-Key (D2). Never throws for a Resend
 * answer: the caller decides what each outcome means. A network failure still throws
 * (an unclear outcome, so the caller logs no refusal and the key is reused).
 */
async function sendDeliveryEmail(
  model: StarterEmailModel,
  sessionId: string,
  idempotencyKey: string,
): Promise<{ outcome: ResendOutcome; detail?: string }> {
  const resendKey = requiredEnv('RESEND_API_KEY');
  const rendered = renderStarterDeliveryEmail(model);
  // UTM tags on every edeninstitute.health link (founder rule 2026-10-08, email-utm.ts).
  // The /starter/downloads?t= link is excluded by the helper.
  const utm: EmailTag = { medium: 'nurture', campaign: 'starter_delivery', content: 'starter_delivery' };
  const subject = rendered.subject;
  const html = tagEmailHtml(rendered.html, utm);
  const text = tagEmailText(rendered.text, utm);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      [IDEMPOTENCY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [model.email], subject, html, text }),
  });
  const bodyText = await res.text().catch(() => '');
  const outcome = classifyResendResponse(res.status, bodyText);
  if (outcome === 'sent') {
    let id = '(none)';
    try { id = (JSON.parse(bodyText) as { id?: string }).id ?? id; } catch { /* keep (none) */ }
    console.log(`[${sessionId}] delivery email queued with Resend id=${id}`);
  } else if (outcome === 'already_sent') {
    console.log(`[${sessionId}] delivery email was already accepted under ${idempotencyKey}; not sent again`);
  }
  return outcome === 'sent' ? { outcome } : { outcome, detail: `${res.status} ${bodyText.slice(0, 500)}` };
}
