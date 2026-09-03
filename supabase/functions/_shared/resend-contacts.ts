// supabase/functions/_shared/resend-contacts.ts
//
// Contact PROPERTIES on Resend. Phase 1 of the nurture roadmap (2026-09-03).
//
// WHY. Until this file existed Resend knew one thing about every contact: that it
// was in the "Eden Institute Waitlist" segment. No funnel, no band, no purchase
// state, no engagement. Every behaviour-based segment or automation needs those
// values ON THE CONTACT, so this is the one place that writes them.
//
// MODEL (Resend, since 2025-11-05). Contacts are GLOBAL, identified by email, and
// belong to zero or more Segments (the renamed Audiences). Properties are a flat
// string map on the contact. The legacy create path this codebase still uses,
// POST /audiences/{id}/contacts, keeps working; properties are written with the
// new endpoints:
//   PATCH https://api.resend.com/contacts/{id_or_email}   { properties: {...} }
//   POST  https://api.resend.com/contacts                  { email, first_name, properties, segments }
//   POST  https://api.resend.com/contact-properties        { key, type }
// A property MUST exist before a contact write mentions it, or Resend rejects the
// whole call ("If the properties don't exist ... the call fails"). Keys are
// alphanumeric + underscore, case sensitive, max 50 chars. Types are string or
// number only, so booleans travel as the strings 'true' / 'false'.
//
// WRITE SEMANTICS. A PATCH touches only the keys sent; keys omitted keep their
// value. That is what the distributed writers rely on (signup owns funnel/band,
// the Stripe webhook owns purchase_status/founding), and it is also why the
// nightly contact-properties-sync rewrites EVERY key from the Postgres view
// resend_contact_state_computed: Postgres is the source of truth, Resend is a
// projection of it, and the nightly pass repairs anything a point write missed.
//
// FAILURE POLICY. Nothing here throws. A property write is never allowed to fail
// a signup, a purchase, or a refund; the caller logs the result and the nightly
// sync converges the contact later.

const RESEND_CONTACTS_KEY =
  Deno.env.get('RESEND_CONTACTS_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_MASTER_AUDIENCE_ID =
  Deno.env.get('RESEND_MASTER_AUDIENCE_ID') ?? Deno.env.get('RESEND_AUDIENCE_ID') ?? '';
const API = 'https://api.resend.com';

export const CONTACT_PROPERTY_KEYS = [
  'funnel',
  'band',
  'purchase_status',
  'founding',
  'quiz_status',
  'engagement_tier',
] as const;

export type ContactPropertyKey = (typeof CONTACT_PROPERTY_KEYS)[number];
export type ContactProperties = Partial<Record<ContactPropertyKey, string>>;

// Documented value sets. The Postgres view resend_contact_state_computed is the
// authority for HOW each value is derived; this map is here so a reader of the
// Resend dashboard can decode what they see without opening a migration.
export const CONTACT_PROPERTY_VALUES: Record<ContactPropertyKey, readonly string[]> = {
  // waitlist_signups.entry_funnel, one value per contact. A contact on more than
  // one funnel resolves edens_table > quiz_funnel > whatever else.
  funnel: ['edens_table', 'quiz_funnel', 'course_tier2', 'practitioner_waitlist', 'community', 'app_beta'],
  // From magnet_email_queue.band (a both-band family has rows for both), with
  // waitlist_signups.source as the fallback. 'none' = not a homeschool lead.
  band: ['sprouts', 'seedlings', 'both', 'none'],
  // Live orders only (status not cancelled/refunded). preordered = a kit
  // preorder is live; purchased = a delivered digital product (Starter Unit,
  // Deep-Dive Guide) and no live preorder; none = nothing bought.
  purchase_status: ['none', 'purchased', 'preordered'],
  // Any live order line with is_founding = true.
  founding: ['true', 'false'],
  // completed = a quiz_completions row exists. Abandonment is NOT derivable
  // (quiz starts are cookieless cta_events with no email), so there is no
  // 'abandoned' value.
  quiz_status: ['completed', 'none'],
  // From email_events (opens + clicks, tracked since 2026-07-01):
  //   hot  = any open or click in the last 14 days
  //   warm = any open or click in the last 60 days
  //   new  = no events yet AND signed up within the last 60 days
  //   cold = nothing in 60 days (the win-back trigger)
  engagement_tier: ['hot', 'warm', 'new', 'cold'],
};

export interface PropertyWriteResult {
  ok: boolean;
  status: number;
  action: 'patched' | 'created' | 'skipped' | 'failed';
  error?: string;
}

function cleanProps(props: ContactProperties): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CONTACT_PROPERTY_KEYS) {
    const v = props[key];
    if (typeof v === 'string' && v.trim() !== '') out[key] = v.trim();
  }
  return out;
}

async function readBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<unreadable>';
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${RESEND_CONTACTS_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Write one or more properties onto the contact identified by `email`.
 *
 * PATCH first. If Resend has no such contact and `createIfMissing` is true, the
 * contact is created (into the master segment when one is configured) with the
 * same properties. Never throws.
 */
export async function setContactProperties(
  email: string,
  props: ContactProperties,
  opts: { firstName?: string | null; createIfMissing?: boolean } = {},
): Promise<PropertyWriteResult> {
  const normalized = email.trim().toLowerCase();
  const properties = cleanProps(props);
  if (!normalized || Object.keys(properties).length === 0) {
    return { ok: true, status: 0, action: 'skipped' };
  }
  if (!RESEND_CONTACTS_KEY) {
    return { ok: false, status: 0, action: 'failed', error: 'RESEND_CONTACTS_KEY / RESEND_API_KEY missing' };
  }

  try {
    const patch = await fetch(`${API}/contacts/${encodeURIComponent(normalized)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ properties }),
    });
    if (patch.ok) {
      await patch.body?.cancel();
      return { ok: true, status: patch.status, action: 'patched' };
    }
    const patchBody = await readBody(patch);
    if (patch.status !== 404 || opts.createIfMissing === false) {
      return { ok: false, status: patch.status, action: 'failed', error: patchBody };
    }

    // Unknown to Resend: create it, properties included.
    const createPayload: Record<string, unknown> = {
      email: normalized,
      unsubscribed: false,
      properties,
    };
    const firstName = (opts.firstName ?? '').trim();
    if (firstName) createPayload.first_name = firstName;
    // Resend wants segment references as objects, not bare ids: a bare string 422s
    // with "Invalid input: expected object, received string" (seen 2026-09-03).
    if (RESEND_MASTER_AUDIENCE_ID) createPayload.segments = [{ id: RESEND_MASTER_AUDIENCE_ID }];

    const create = await fetch(`${API}/contacts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(createPayload),
    });
    if (create.ok) {
      await create.body?.cancel();
      return { ok: true, status: create.status, action: 'created' };
    }
    const createBody = await readBody(create);
    if (create.status === 409) {
      // Raced with another writer: it exists now, so the PATCH will land.
      const retry = await fetch(`${API}/contacts/${encodeURIComponent(normalized)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ properties }),
      });
      if (retry.ok) {
        await retry.body?.cancel();
        return { ok: true, status: retry.status, action: 'patched' };
      }
      return { ok: false, status: retry.status, action: 'failed', error: await readBody(retry) };
    }
    return { ok: false, status: create.status, action: 'failed', error: createBody };
  } catch (err) {
    return { ok: false, status: 0, action: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/** Read one contact back from Resend (GET /contacts/{email}); for verification, never throws. */
export async function getContact(email: string): Promise<{ status: number; contact: unknown }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !RESEND_CONTACTS_KEY) return { status: 0, contact: null };
  try {
    const res = await fetch(`${API}/contacts/${encodeURIComponent(normalized)}`, { headers: authHeaders() });
    const body = await res.json().catch(() => null);
    return { status: res.status, contact: body };
  } catch (err) {
    return { status: 0, contact: err instanceof Error ? err.message : String(err) };
  }
}

// ── Segments ────────────────────────────────────────────────────────────────
// Resend Segments are STATIC membership groups (verified in the dashboard
// 2026-09-03: "Create segment" asks for a name only and a new segment is empty;
// the Segments API takes a name only). There is no filter builder, so the
// "segments built from properties" the roadmap asks for are maintained by code:
// contact-properties-sync derives the wanted set from the same computed row and
// calls POST / DELETE /contacts/{email}/segments/{segmentId} for the difference.
// Segment names below are the ones a human sees in the dashboard.

export interface SegmentRule {
  name: string;
  test: (p: ContactProperties) => boolean;
}

export const SEGMENT_RULES: readonly SegmentRule[] = [
  { name: 'Sprouts families', test: (p) => p.band === 'sprouts' || p.band === 'both' },
  { name: 'Seedlings families', test: (p) => p.band === 'seedlings' || p.band === 'both' },
  { name: 'Buyers', test: (p) => p.purchase_status === 'purchased' || p.purchase_status === 'preordered' },
  {
    name: 'Starter buyers, no preorder',
    test: (p) => p.purchase_status === 'purchased' && p.funnel === 'edens_table',
  },
  { name: 'Cold contacts', test: (p) => p.engagement_tier === 'cold' },
  { name: 'Quiz completed', test: (p) => p.quiz_status === 'completed' },
];

/** Sorted list of segment names a contact with these properties belongs in. */
export function desiredSegments(props: ContactProperties): string[] {
  return SEGMENT_RULES.filter((r) => r.test(props)).map((r) => r.name).sort();
}

/** name -> id for every segment on the team (paginated). Throws on a non-2xx. */
export async function listSegments(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const url = `${API}/segments?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`GET /segments ${res.status}: ${await readBody(res)}`);
    const data = await res.json() as { data?: Array<{ id?: string; name?: string }>; has_more?: boolean };
    const rows = data.data ?? [];
    for (const s of rows) if (s.id && s.name) out.set(s.name, s.id);
    if (!data.has_more || rows.length === 0) break;
    after = String(rows[rows.length - 1].id);
  }
  return out;
}

/** Make sure every named segment exists; returns name -> id. Never throws. */
export async function ensureSegments(
  names: readonly string[],
): Promise<{ ids: Map<string, string>; created: string[]; failed: { name: string; status: number; body: string }[] }> {
  const created: string[] = [];
  const failed: { name: string; status: number; body: string }[] = [];
  let ids = new Map<string, string>();
  try {
    ids = await listSegments();
  } catch (err) {
    failed.push({ name: '*list*', status: 0, body: err instanceof Error ? err.message : String(err) });
    return { ids, created, failed };
  }
  for (const name of names) {
    if (ids.has(name)) continue;
    try {
      const res = await fetch(`${API}/segments`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => null) as { id?: string } | null;
      if (res.ok && body?.id) {
        ids.set(name, body.id);
        created.push(name);
      } else {
        failed.push({ name, status: res.status, body: JSON.stringify(body).slice(0, 200) });
      }
    } catch (err) {
      failed.push({ name, status: 0, body: err instanceof Error ? err.message : String(err) });
    }
  }
  return { ids, created, failed };
}

/** POST /contacts/{email}/segments/{id}. Already a member counts as ok. Never throws. */
export async function addContactToSegment(email: string, segmentId: string): Promise<PropertyWriteResult> {
  try {
    const res = await fetch(
      `${API}/contacts/${encodeURIComponent(email.trim().toLowerCase())}/segments/${segmentId}`,
      { method: 'POST', headers: authHeaders() },
    );
    if (res.ok || res.status === 409) {
      await res.body?.cancel();
      return { ok: true, status: res.status, action: 'patched' };
    }
    return { ok: false, status: res.status, action: 'failed', error: await readBody(res) };
  } catch (err) {
    return { ok: false, status: 0, action: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

/** DELETE /contacts/{email}/segments/{id}. Not a member (404) counts as ok. Never throws. */
export async function removeContactFromSegment(email: string, segmentId: string): Promise<PropertyWriteResult> {
  try {
    const res = await fetch(
      `${API}/contacts/${encodeURIComponent(email.trim().toLowerCase())}/segments/${segmentId}`,
      { method: 'DELETE', headers: authHeaders() },
    );
    if (res.ok || res.status === 404) {
      await res.body?.cancel();
      return { ok: true, status: res.status, action: 'patched' };
    }
    return { ok: false, status: res.status, action: 'failed', error: await readBody(res) };
  } catch (err) {
    return { ok: false, status: 0, action: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

export interface EnsurePropertiesResult {
  created: string[];
  existing: string[];
  failed: { key: string; status: number; body: string }[];
}

/**
 * Make sure every key in CONTACT_PROPERTY_KEYS exists on the Resend team as a
 * string property. Idempotent: a key that already exists is reported under
 * `existing`. Run once per deploy that adds a key (contact-properties-sync has a
 * mode for it), or from the dashboard by hand; either way the writes above
 * fail closed until this has succeeded.
 */
export async function ensureContactProperties(): Promise<EnsurePropertiesResult> {
  const out: EnsurePropertiesResult = { created: [], existing: [], failed: [] };
  if (!RESEND_CONTACTS_KEY) {
    for (const key of CONTACT_PROPERTY_KEYS) out.failed.push({ key, status: 0, body: 'RESEND_CONTACTS_KEY missing' });
    return out;
  }

  // Prefer a list so we do not lean on the exact conflict status of a blind create.
  let known = new Set<string>();
  try {
    const list = await fetch(`${API}/contact-properties`, { headers: authHeaders() });
    if (list.ok) {
      const data = await list.json().catch(() => null) as { data?: Array<{ key?: string }> } | null;
      known = new Set((data?.data ?? []).map((p) => String(p.key ?? '')).filter(Boolean));
    } else {
      await list.body?.cancel();
    }
  } catch {
    // fall through to blind creates
  }

  for (const key of CONTACT_PROPERTY_KEYS) {
    if (known.has(key)) {
      out.existing.push(key);
      continue;
    }
    try {
      const res = await fetch(`${API}/contact-properties`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ key, type: 'string' }),
      });
      if (res.ok) {
        await res.body?.cancel();
        out.created.push(key);
        continue;
      }
      const body = await readBody(res);
      if (res.status === 409 || /exist/i.test(body)) out.existing.push(key);
      else out.failed.push({ key, status: res.status, body });
    } catch (err) {
      out.failed.push({ key, status: 0, body: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
