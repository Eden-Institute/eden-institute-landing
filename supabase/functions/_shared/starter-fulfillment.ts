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
//     and the cron drain retries it. Nothing is lost, nothing double-sends.
//   - The email is the LAST step and is guarded by sent_at, so a retry after a
//     successful send is a no-op rather than a second copy in the buyer's inbox.
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
  STARTER_BUCKET,
  STARTER_FILENAMES,
  STARTER_LICENSE_LINE,
  STARTER_MASTERS,
  STARTER_SOURCE_BUCKET,
} from './starter-config.ts';
import { renderStarterDeliveryEmail, StarterEmailModel } from './starter-email.ts';

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
const FROM = 'Camila at The Eden Institute <hello@edeninstitute.health>';
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
  download_token: string;
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

async function storageDownload(bucket: string, path: string): Promise<Uint8Array> {
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/${bucket}/${path}`, {
    headers: { Authorization: `Bearer ${serviceRoleKey()}`, apikey: serviceRoleKey() },
  });
  if (!res.ok) {
    throw new Error(`storage download ${bucket}/${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
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
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`storage upload ${bucket}/${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
}

/**
 * Mint a signed URL for one private object.
 *
 * `download` makes the browser save the file under a readable name instead of
 * opening a tab titled with a uuid.
 */
export async function signedUrl(path: string, filename: string, ttl = DOWNLOAD_URL_TTL_SECONDS): Promise<string> {
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
  return `${supabaseUrl()}/storage/v1${signedURL}&download=${encodeURIComponent(filename)}`;
}

/** Fresh links for an already-stamped delivery. Backs the re-request flow. */
export async function mintDownloadLinks(
  delivery: Pick<DeliveryRow, 'tg_object_path' | 'nb_object_path'>,
): Promise<{ teachersGuide: string; studentNotebook: string }> {
  if (!delivery.tg_object_path || !delivery.nb_object_path) {
    throw new Error('delivery has no stamped objects yet');
  }
  return {
    teachersGuide: await signedUrl(delivery.tg_object_path, STARTER_FILENAMES.teachersGuide),
    studentNotebook: await signedUrl(delivery.nb_object_path, STARTER_FILENAMES.studentNotebook),
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
    .in('status', ['pending', 'failed'])
    .select('id');
  const claimed = Array.isArray(claim.data) ? claim.data.length > 0 : !!claim.data;
  if (!claimed) {
    await logStage(db, delivery, attempt, 'claim', false, 'another worker holds this delivery');
    return { status: 'skipped', detail: 'claimed elsewhere' };
  }
  await logStage(db, delivery, attempt, 'claim', true);

  try {
    let tgPath = delivery.tg_object_path;
    let nbPath = delivery.nb_object_path;

    if (!tgPath || !nbPath) {
      const stampOpts = {
        purchaserName: delivery.purchaser_name,
        email: delivery.email,
        licenseLine: STARTER_LICENSE_LINE,
      };

      // Sequential on purpose. See the memory note in the file header.
      const t0 = performance.now();
      const tgMaster = await storageDownload(STARTER_SOURCE_BUCKET, STARTER_MASTERS.teachersGuide);
      const nbMaster = await storageDownload(STARTER_SOURCE_BUCKET, STARTER_MASTERS.studentNotebook);
      await logStage(db, delivery, attempt, 'fetch_master', true,
        `${tgMaster.length + nbMaster.length} bytes`, Math.round(performance.now() - t0));

      const t1 = performance.now();
      const tg = await stampFooter(tgMaster, stampOpts);
      const nb = await stampFooter(nbMaster, stampOpts);
      await logStage(db, delivery, attempt, 'stamp', true,
        `${tg.pagesStamped}+${nb.pagesStamped} pages`, Math.round(performance.now() - t1));

      const t2 = performance.now();
      tgPath = `personalised/${delivery.id}/teachers-guide.pdf`;
      nbPath = `personalised/${delivery.id}/student-notebook.pdf`;
      await storageUpload(STARTER_BUCKET, tgPath, tg.bytes);
      await storageUpload(STARTER_BUCKET, nbPath, nb.bytes);
      await logStage(db, delivery, attempt, 'upload', true, undefined, Math.round(performance.now() - t2));

      // Persist the paths BEFORE the email. If the send fails, the retry re-signs
      // rather than re-stamping.
      const { error } = await db.from('starter_deliveries')
        .update({ tg_object_path: tgPath, nb_object_path: nbPath, updated_at: new Date().toISOString() })
        .eq('id', delivery.id);
      if (error) throw new Error(`object path writeback failed: ${error.message}`);
    } else {
      await logStage(db, delivery, attempt, 'stamp', true, 'reused existing stamped objects');
    }

    const t3 = performance.now();
    const links = await mintDownloadLinks({ tg_object_path: tgPath, nb_object_path: nbPath });
    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000);
    await logStage(db, delivery, attempt, 'sign', true, `expires ${expiresAt.toISOString()}`,
      Math.round(performance.now() - t3));

    const model: StarterEmailModel = {
      firstName: (delivery.purchaser_name ?? '').trim().split(/\s+/)[0] || null,
      email: delivery.email,
      teachersGuideUrl: links.teachersGuide,
      studentNotebookUrl: links.studentNotebook,
      creditCode,
      downloadToken: delivery.download_token,
      linksExpireAt: expiresAt,
    };

    const t4 = performance.now();
    await sendDeliveryEmail(model, sid);
    await logStage(db, delivery, attempt, 'email', true, undefined, Math.round(performance.now() - t4));

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
      // The buyer HAS their email. Failing loudly here would make a retry send a
      // second copy, so this is logged and swallowed deliberately.
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
    return { status: 'failed', detail: message };
  }
}

async function sendDeliveryEmail(model: StarterEmailModel, sessionId: string): Promise<void> {
  const resendKey = requiredEnv('RESEND_API_KEY');
  const { subject, html, text } = renderStarterDeliveryEmail(model);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [model.email], subject, html, text }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const body = await res.json().catch(() => ({})) as { id?: string };
  console.log(`[${sessionId}] delivery email queued with Resend id=${body.id ?? '(none)'}`);
}
