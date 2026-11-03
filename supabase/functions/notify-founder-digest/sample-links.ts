// supabase/functions/notify-founder-digest/sample-links.ts
//
// Partner sample leak check (punch #244 FIX 3, founder approved 2026-11-03).
//
// WHY. On 2026-09-10 a podcast host put her partner sample link in her show notes.
// Nothing noticed; the host told the founder. A link that has gone public has one
// fingerprint: a single key suddenly serving many different households in a day.
// api/partner-sample.ts logs every download to public.partner_sample_serves with a
// keyed hash of the visitor's network (an IPv6 address cut to its /64, so one
// household is one visitor). This file counts distinct visitors per key for the
// digest day; system-health.ts turns any key over its limit into a red line, which
// also flips the digest subject to "System check needs you".
//
// The limits are judgement, not measurement (there was no per-key data before
// 2026-11-03). One family typically shows up as one to three networks (home wifi,
// a phone on cellular, a second device). The shared key is held by about 67 people,
// so a normal day on it can legitimately see several. Raise either limit here if it
// cries wolf.

/** Distinct visitors in one day at which a per-recipient link is flagged. */
export const RECIPIENT_VISITOR_LIMIT = 5;
/** Distinct visitors in one day at which the old shared link is flagged. */
export const SHARED_VISITOR_LIMIT = 10;

/** One partner_sample_serves row, with its key's holder embedded by PostgREST. */
export interface SampleServeRow {
  key_id: string | null;
  visitor_hash: string;
  partner_sample_keys?: { email: string; name: string | null; revoked_at?: string | null } | null;
}

export interface SampleLinkSpike {
  /** null = the shared PARTNER_SAMPLE_KEY. */
  keyId: string | null;
  name: string | null;
  email: string | null;
  visitors: number;
  downloads: number;
  revoked: boolean;
}

/** Keys over their limit for the day, busiest first. */
export function findSampleLinkSpikes(rows: SampleServeRow[]): SampleLinkSpike[] {
  const byKey = new Map<string, { row: SampleServeRow; visitors: Set<string>; downloads: number }>();
  for (const r of rows) {
    const k = r.key_id ?? 'shared';
    const entry = byKey.get(k) ?? { row: r, visitors: new Set<string>(), downloads: 0 };
    entry.visitors.add(r.visitor_hash);
    entry.downloads += 1;
    byKey.set(k, entry);
  }
  const spikes: SampleLinkSpike[] = [];
  for (const { row, visitors, downloads } of byKey.values()) {
    const shared = row.key_id === null;
    if (visitors.size < (shared ? SHARED_VISITOR_LIMIT : RECIPIENT_VISITOR_LIMIT)) continue;
    spikes.push({
      keyId: row.key_id,
      name: row.partner_sample_keys?.name ?? null,
      email: row.partner_sample_keys?.email ?? null,
      visitors: visitors.size,
      downloads,
      revoked: !!row.partner_sample_keys?.revoked_at,
    });
  }
  return spikes.sort((a, b) => b.visitors - a.visitors);
}

/** One plain sentence per flagged link, for the System health block. */
export function describeSpike(s: SampleLinkSpike, digestDate: string): string {
  const seen = `was opened from ${s.visitors} different places on ${digestDate} (${s.downloads} downloads)`;
  if (s.keyId === null) {
    return `The shared partner sample link (in every package sent before November 3) ${seen}. It may have been posted publicly. Turning it off cuts off everyone who has it, so ask Claude before doing anything.`;
  }
  const who = s.name ? `${s.name}'s` : 'A';
  const email = s.email ? ` (${s.email})` : '';
  if (s.revoked) {
    return `${who} partner sample link${email} ${seen} and has since been turned off.`;
  }
  return `${who} partner sample link${email} ${seen}. One family usually shows up as one to three, so it may have been posted publicly. Ask Claude to turn off that one link (key ${s.keyId}); nobody else is affected.`;
}
