// supabase/functions/_shared/html-escape.ts
//
// The one shared HTML escaper for email and page HTML built in edge functions.
// Import from here rather than adding another private copy.

/** HTML-escape a value before putting it into an email body or a quoted attribute.
 *  null/undefined render as the empty string. */
export function escapeHtml(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

/** Minimal escaper for text and double-quoted attribute values. Escapes & < > "
 *  only (no single quote), exactly as the ESA functions always have, so their output
 *  stays byte-identical. Prefer escapeHtml for new code. */
export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Return the normalised URL only when it parses and is https; otherwise null.
 *  Use for third-party URLs placed into an href (blocks javascript: and data: links). */
export function safeHttpsUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
