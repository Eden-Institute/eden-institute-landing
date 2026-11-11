// supabase/functions/_shared/print-file-check.ts
//
// Does a print-file URL still hand out a PDF? (Lane 2 deep audit area 3, L5, founder go
// 2026-11-11 "Yes, build + ship all 7".)
//
// Lulu downloads every interior and cover from its URL on every job (lulu_printables has no
// cached printable id in production), so a dead link is only discovered when a sale happens
// and Lulu fails it. That is how the Sprouts files sat deleted on Dropbox for ~6 weeks in
// 2026 (CLAUDE.md, 2026-11-04). This reads the first bytes of each file:
//   ok           200 or 206, and the body starts with "%PDF-"
//   bad          a definite wrong answer: any other HTTP status, or a body that is not a PDF
//                (a "File Deleted" page, a sign-in page, a virus-scan interstitial)
//   unreachable  no answer at all (network error, timeout). Says nothing about the file.
//
// Only the first chunk is ever read: a server that ignores the Range header and starts
// sending a 560 MB interior has its stream cancelled after the first chunk.

export type PrintFileState = 'ok' | 'bad' | 'unreachable';

export interface PrintFileCheck {
  url: string;
  state: PrintFileState;
  /** HTTP status when there was one. */
  status?: number;
  /** One plain line saying what was seen. */
  detail: string;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const PRINT_FILE_CHECK_TIMEOUT_MS = 20_000;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** Where a URL points, without its query string (Drive ids and signed tokens stay out of logs and emails). */
export function printFileHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(not a URL)';
  }
}

async function firstBytes(res: Response, n: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const out = new Uint8Array(n);
  let have = 0;
  try {
    while (have < n) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const take = Math.min(value.length, n - have);
      out.set(value.subarray(0, take), have);
      have += take;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out.subarray(0, have);
}

export async function checkPrintFileUrl(
  url: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<PrintFileCheck> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      redirect: 'follow',
      signal: AbortSignal.timeout(opts.timeoutMs ?? PRINT_FILE_CHECK_TIMEOUT_MS),
    });
  } catch (e) {
    return { url, state: 'unreachable', detail: `no answer (${e instanceof Error ? e.name : 'error'})` };
  }
  if (res.status !== 200 && res.status !== 206) {
    await res.body?.cancel().catch(() => {});
    return { url, state: 'bad', status: res.status, detail: `HTTP ${res.status}` };
  }
  let head: Uint8Array;
  try {
    head = await firstBytes(res, PDF_MAGIC.length);
  } catch (e) {
    return { url, state: 'unreachable', status: res.status, detail: `answer cut off (${e instanceof Error ? e.name : 'error'})` };
  }
  const isPdf = head.length === PDF_MAGIC.length && PDF_MAGIC.every((b, i) => head[i] === b);
  if (!isPdf) {
    const type = res.headers.get('content-type') ?? 'unknown type';
    return { url, state: 'bad', status: res.status, detail: `HTTP ${res.status} but not a PDF (${type})` };
  }
  return { url, state: 'ok', status: res.status, detail: `HTTP ${res.status}, PDF` };
}
