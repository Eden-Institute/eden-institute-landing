// supabase/functions/_shared/pgrst-retry.ts
//
// fetch() for calls that go through the Supabase API gateway (PostgREST,
// Storage). Repeats a request the gateway answered with 502/503/504, or that
// failed at the network layer, when repeating it cannot do anything twice.
//
// Why (investigated 2026-09-13): since at least 2026-09-11 the gateway has
// answered roughly one in five cron-minute REST calls with
// {"message":"Gateway Timeout"} after ~5 s, while the database sat idle and the
// same query ran in under 3 ms. A call made straight after the 504 succeeds.
// The damage was not the error line: nurture-emails sends an email and THEN
// PATCHes the row to 'sent', so a 504 on that PATCH left the row pending and the
// next run sent the same email again (one subscriber got constitution_5 five
// times on 2026-09-11).
//
// What is repeated:
//   GET, HEAD, PUT, PATCH, DELETE. PostgREST applies the same values again, so a
//   repeat that lands after a first attempt which DID commit changes nothing.
//   POST only when it is an upsert (Prefer: resolution=merge-duplicates or
//   ignore-duplicates).
// What is never repeated: a plain INSERT or an RPC POST, because a 504 does not
// prove the first attempt did not commit. Those return the 504 as before.
//
// Log lines carry the method, URL path and status only. Query strings are left
// out because they hold email addresses (email=eq.<address>).

export const RETRY_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/** Wait before retry 1 and retry 2. Two retries, then the last response is returned. */
export const RETRY_DELAYS_MS: readonly number[] = [500, 2000];

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function isRepeatSafe(method: string, prefer: string | null): boolean {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return true;
    case 'POST':
      return /resolution=(merge|ignore)-duplicates/i.test(prefer ?? '');
    default:
      return false;
  }
}

function pathOf(input: string | URL | Request): string {
  try {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(href).pathname;
  } catch {
    return '<unparseable url>';
  }
}

export interface RetryingFetchOptions {
  fetchImpl?: FetchLike;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

export function makeRetryingFetch(opts: RetryingFetchOptions = {}): FetchLike {
  const fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  return async (input, init) => {
    const isRequest = input instanceof Request;
    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));
    // A stream body can only be read once, so a request carrying one is sent once.
    const canRepeat = isRepeatSafe(method, headers.get('prefer')) &&
      !(init?.body instanceof ReadableStream);
    const path = pathOf(input);

    for (let attempt = 0;; attempt++) {
      const last = !canRepeat || attempt >= delays.length;
      try {
        const res = await fetchImpl(isRequest ? input.clone() : input, init);
        if (last || !RETRY_STATUSES.has(res.status)) return res;
        await res.body?.cancel();
        console.warn(
          `pgrst-retry: ${method} ${path} -> ${res.status}, retry ${attempt + 1}/${delays.length} in ${delays[attempt]} ms`,
        );
      } catch (err) {
        if (last || init?.signal?.aborted) throw err;
        const name = err instanceof Error ? err.name : 'Error';
        console.warn(
          `pgrst-retry: ${method} ${path} threw ${name}, retry ${attempt + 1}/${delays.length} in ${delays[attempt]} ms`,
        );
      }
      await sleep(delays[attempt]);
    }
  };
}

/** Drop-in for fetch() on gateway calls; also pass as createClient's global.fetch. */
export const pgrstFetch: FetchLike = makeRetryingFetch();
