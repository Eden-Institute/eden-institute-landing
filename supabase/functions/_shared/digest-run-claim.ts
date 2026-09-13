// supabase/functions/_shared/digest-run-claim.ts
//
// Claiming a founder-digest day in digest_runs (UNIQUE digest_date) so exactly
// one run sends it, while a day that FAILED, or was left PENDING by a run that
// died, can be taken over by a later run instead of blocking it for good.
//
// Why: until 2026-09-13 a 409 on the INSERT always meant "already ran". A
// gateway 504 on the lead RPC, then on the PATCH that should have marked the run
// failed, left 2026-09-12 at pending, so every re-run skipped. The digest went
// out only after the row was deleted by hand.
//
// Rules, for the row that already exists for the day:
//   sent / skipped_zero          -> skip, already_ran
//   pending, younger than STALE  -> skip, in_progress (another run is mid-send)
//   pending, older than STALE    -> take over (that run died)
//   failed                       -> take over
// A takeover is a conditional PATCH that only matches the row exactly as it was
// read, so two runs can never both own a day. When a response is lost (a 504 on
// a write that still committed), the row is re-read: it is ours only if it
// carries our own claim time in triggered_at.

export type SbFetch = (path: string, init?: RequestInit) => Promise<Response>;

/** A pending row older than this belongs to a run that died; an Edge Function run lasts minutes at most. */
export const STALE_PENDING_MS = 10 * 60 * 1000;

export type ClaimResult =
  | { kind: 'owned'; id: string; takeover: null | 'failed' | 'stale_pending' }
  | { kind: 'skip'; reason: 'already_ran' | 'in_progress' | 'claimed_elsewhere'; status: string | null }
  | { kind: 'error'; detail: string };

interface RunRow {
  id: string;
  status: string;
  triggered_at: string;
}

async function readRow(sbFetch: SbFetch, digestDate: string): Promise<RunRow | null> {
  const res = await sbFetch(`/rest/v1/digest_runs?digest_date=eq.${digestDate}&select=id,status,triggered_at`);
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] as RunRow : null;
}

const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);

export async function claimDigestRun(
  sbFetch: SbFetch,
  opts: { digestDate: string; windowStart: string; windowEnd: string; now?: Date },
): Promise<ClaimResult> {
  const now = opts.now ?? new Date();
  const claimAt = now.toISOString();

  const ins = await sbFetch('/rest/v1/digest_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      digest_date: opts.digestDate,
      window_start: opts.windowStart,
      window_end: opts.windowEnd,
      status: 'pending',
      triggered_at: claimAt,
    }),
  });
  if (ins.ok) {
    const rows = await ins.json().catch(() => null);
    const id = Array.isArray(rows) ? rows[0]?.id : rows?.id;
    if (typeof id === 'string') return { kind: 'owned', id, takeover: null };
  } else {
    await ins.body?.cancel();
  }

  // 409, or any response we cannot trust: look at what is actually stored.
  const row = await readRow(sbFetch, opts.digestDate);
  if (!row) return { kind: 'error', detail: `digest_runs insert returned ${ins.status} and no row could be read` };

  // Our own INSERT committed even though its response was lost.
  if (row.status === 'pending' && sameInstant(row.triggered_at, claimAt)) {
    return { kind: 'owned', id: row.id, takeover: null };
  }
  if (row.status === 'sent' || row.status === 'skipped_zero') {
    return { kind: 'skip', reason: 'already_ran', status: row.status };
  }

  let takeover: 'failed' | 'stale_pending';
  if (row.status === 'failed') {
    takeover = 'failed';
  } else if (row.status === 'pending' && now.getTime() - Date.parse(row.triggered_at) >= STALE_PENDING_MS) {
    takeover = 'stale_pending';
  } else {
    return { kind: 'skip', reason: 'in_progress', status: row.status };
  }

  const patch = await sbFetch(
    `/rest/v1/digest_runs?id=eq.${row.id}&status=eq.${row.status}` +
      `&triggered_at=eq.${encodeURIComponent(row.triggered_at)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'pending',
        triggered_at: claimAt,
        completed_at: null,
        captures_count: null,
        error_message: null,
      }),
    },
  );
  if (patch.ok) {
    const rows = await patch.json().catch(() => null);
    if (Array.isArray(rows) && rows.length === 1) return { kind: 'owned', id: row.id, takeover };
  } else {
    await patch.body?.cancel();
  }

  // Matched nothing, or the response was lost: ours only if it carries our claim time.
  const after = await readRow(sbFetch, opts.digestDate);
  if (after && after.status === 'pending' && sameInstant(after.triggered_at, claimAt)) {
    return { kind: 'owned', id: after.id, takeover };
  }
  return { kind: 'skip', reason: 'claimed_elsewhere', status: after?.status ?? null };
}

// ── Dates ──

/** Today's calendar date in Central time as YYYY-MM-DD, whatever the runtime's own timezone. */
export function centralToday(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isRealYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === s;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The capture window for a digest day. Bounded at a fixed -06:00 exactly as
 * every digest since May has been, so a re-sent day counts the same leads the
 * scheduled run would have.
 */
export function digestWindow(ymd: string): { windowStart: string; windowEnd: string } {
  return {
    windowStart: `${ymd}T00:00:00-06:00`,
    windowEnd: `${addDays(ymd, 1)}T00:00:00-06:00`,
  };
}
