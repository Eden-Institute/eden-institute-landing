// supabase/functions/_shared/online-year-family.ts
//
// Eden's Table Online Year (punch #472), tickets OY6 + OY7: what a signed-in family does in the reader.
//   print {token, license_id, week}   -> a link to that child's Notebook pages for that week, with the child's
//                                        name and the family's on every page (OY6). Stamped once per child and
//                                        week, then kept in the private bucket, so a reprint is instant.
//   done  {token, license_id, week}   -> "Mark Week [N] done for [Child]" (OY7): writes the dated log row.
//   progress {token}                  -> every live license's done weeks with their dates (the reader shows the
//                                        checkmarks; the browser builds the portfolio and certificate PDFs from
//                                        it plus web/lib/onlineYearContent.ts, so the book data never has to be
//                                        copied into an edge function).
// The pure half: every database, storage and stamping call is injected, so it is unit tested in CI
// (online-year-family.test.ts). online-year-family/index.ts wires Supabase and pdf-lib.
//
// A license may be printed or marked done only by a device signed in to the family that owns it, and only while
// it is active and not ended. Children never log in; mom does it per child.
// DARK: 404 until ONLINE_YEAR_ENABLED (or the preview header), like every Online Year endpoint.

import { onlineYearOpen } from './online-year-gate.ts';
import { canSignIn, READER_BUCKET, sha256Hex, type SigninDevice, type SigninLicense, type SigninParent } from './online-year-signin.ts';

export const PRINT_LINK_SECONDS = 600;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The full-year Notebook, cut per week by OY0: nb/<band>/WNN.pdf in the private bucket. */
export function notebookMasterPath(band: string, week: number): string {
  return `nb/${band}/W${String(week).padStart(2, '0')}.pdf`;
}
/** One child's stamped copy of one week, kept after the first print. */
export function notebookPrintPath(licenseId: string, week: number): string {
  return `prints/${licenseId}/W${String(week).padStart(2, '0')}.pdf`;
}

/**
 * The footer line on every Notebook page: the existing Starter stamp ("Licensed to [name] ([email]). [line]")
 * with the line naming the child, from the approved button "Print [Child]'s Notebook pages for this week" and the
 * approved "for use at home".
 */
export function notebookLicenseLine(child: string): string {
  return `${child}'s Notebook pages · for use at home`;
}

/** Today's date where the business is (Central), as YYYY-MM-DD: the date a week was marked done. */
export function centralDate(now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // en-CA formats as YYYY-MM-DD
}

export interface FamilyDeps {
  cors: Record<string, string>;
  now?: () => Date;
  env?: (k: string) => string | undefined;
  findDeviceByTokenHash(tokenHash: string): Promise<SigninDevice | null>;
  findParentById(id: string): Promise<SigninParent | null>;
  listLicenses(parentId: string): Promise<SigninLicense[]>;
  touchDevice(deviceId: string, at: string): Promise<void>;
  /** Storage, all in READER_BUCKET. exists() true when the object is there. */
  exists(path: string): Promise<boolean>;
  download(path: string): Promise<Uint8Array>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  signUrl(path: string, seconds: number): Promise<string>;
  /** stampFooter from starter-pdf.ts. */
  stamp(master: Uint8Array, opts: { purchaserName: string | null; email: string; licenseLine: string }): Promise<Uint8Array>;
  /** Weeks done for these licenses. */
  listDone(licenseIds: string[]): Promise<{ license_id: string; week: number; done_on: string }[]>;
  /** Insert (license, week, done_on); an existing row for that week keeps its first date. */
  markDone(licenseId: string, week: number, doneOn: string): Promise<void>;
}

interface Result {
  status: number;
  body: Record<string, unknown>;
}
const json = (r: Result, cors: Record<string, string>) =>
  new Response(JSON.stringify(r.body), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
const SIGNED_OUT: Result = { status: 401, body: { error: 'SIGNED_OUT' } };
const BAD: Result = { status: 400, body: { error: 'BAD_REQUEST' } };

/** The signed-in family behind a device token, or a SIGNED_OUT result. */
async function family(token: string, deps: FamilyDeps, now: Date) {
  const device = await deps.findDeviceByTokenHash(await sha256Hex(token));
  if (!device || device.signed_out_at) return null;
  const parent = await deps.findParentById(device.parent_id);
  if (!parent) return null;
  const licenses = await deps.listLicenses(parent.id);
  if (!canSignIn(licenses)) return null;
  await deps.touchDevice(device.id, now.toISOString());
  return { parent, licenses };
}

/** The family's license by id, only while active and not ended. */
function liveLicense(licenses: SigninLicense[], id: string, now: Date): SigninLicense | null {
  return licenses.find((l) => l.id === id && l.status === 'active' && Date.parse(l.ends_at) > now.getTime()) ?? null;
}

export async function handlePrint(token: string, licenseId: string, week: number, deps: FamilyDeps): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const fam = await family(token, deps, now);
  if (!fam) return SIGNED_OUT;
  const lic = liveLicense(fam.licenses, licenseId, now);
  if (!lic) return { status: 403, body: { error: 'YEAR_ENDED' } };
  const out = notebookPrintPath(lic.id, week);
  if (!(await deps.exists(out))) {
    const master = await deps.download(notebookMasterPath(lic.band, week));
    const name = (fam.parent.license_name ?? '').trim() || (fam.parent.first_name ?? '').trim() || null;
    const stamped = await deps.stamp(master, { purchaserName: name, email: fam.parent.email, licenseLine: notebookLicenseLine(lic.child_name) });
    await deps.upload(out, stamped);
  }
  return { status: 200, body: { url: await deps.signUrl(out, PRINT_LINK_SECONDS), expires_in: PRINT_LINK_SECONDS } };
}

export async function handleDone(token: string, licenseId: string, week: number, deps: FamilyDeps): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const fam = await family(token, deps, now);
  if (!fam) return SIGNED_OUT;
  const lic = liveLicense(fam.licenses, licenseId, now);
  if (!lic) return { status: 403, body: { error: 'YEAR_ENDED' } };
  const doneOn = centralDate(now);
  await deps.markDone(lic.id, week, doneOn);
  return { status: 200, body: { license_id: lic.id, week, done_on: doneOn } };
}

/** Every license the family holds that is active (ended ones too: a finished year keeps its portfolio). */
export async function handleProgress(token: string, deps: FamilyDeps): Promise<Result> {
  const now = (deps.now ?? (() => new Date()))();
  const fam = await family(token, deps, now);
  if (!fam) return SIGNED_OUT;
  const mine = fam.licenses.filter((l) => l.status === 'active');
  const rows = mine.length ? await deps.listDone(mine.map((l) => l.id)) : [];
  return {
    status: 200,
    body: {
      licenses: mine.map((l) => ({
        id: l.id,
        band: l.band,
        child_name: l.child_name,
        kind: l.kind,
        starts_at: l.starts_at,
        ends_at: l.ends_at,
        done: rows.filter((r) => r.license_id === l.id).map((r) => ({ week: r.week, done_on: r.done_on })).sort((a, b) => a.week - b.week),
      })),
    },
  };
}

export async function handleOnlineYearFamily(req: Request, deps: FamilyDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.cors });
  if (!onlineYearOpen(req, deps.env)) return json({ status: 404, body: { error: 'not_found' } }, deps.cors);
  if (req.method !== 'POST') return json({ status: 405, body: { error: 'method_not_allowed' } }, deps.cors);
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json(BAD, deps.cors);
  }
  try {
    const token = typeof b?.token === 'string' ? b.token : '';
    if (!TOKEN_RE.test(token)) return json(SIGNED_OUT, deps.cors);
    if (b.action === 'progress') return json(await handleProgress(token, deps), deps.cors);
    const licenseId = typeof b.license_id === 'string' ? b.license_id : '';
    const week = Number(b.week);
    if (!UUID_RE.test(licenseId) || !Number.isInteger(week) || week < 1 || week > 36) return json(BAD, deps.cors);
    if (b.action === 'print') return json(await handlePrint(token, licenseId, week, deps), deps.cors);
    if (b.action === 'done') return json(await handleDone(token, licenseId, week, deps), deps.cors);
    return json(BAD, deps.cors);
  } catch (err) {
    console.error('online-year-family: failed', err instanceof Error ? err.message : String(err));
    return json({ status: 500, body: { error: 'SOMETHING_WRONG' } }, deps.cors);
  }
}

export { READER_BUCKET };
