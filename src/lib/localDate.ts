/**
 * Calendar-date helpers that stay in the browser's LOCAL timezone.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight and
 * `toISOString().slice(0, 10)` prints the UTC date, so both drift a day
 * for US users in the evening; person_profiles.date_of_birth is a plain
 * Postgres date and must be treated as a local calendar day.
 */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses 'YYYY-MM-DD' as local midnight; returns null for anything else. */
export function parseISODateLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
