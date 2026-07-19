/**
 * Sanitize a caller-supplied redirect target (e.g. ?return_to=) down to a
 * same-app relative path.
 *
 * React Router's navigate() cannot leave the origin today, but these values
 * also flow into emailRedirectTo query params and could later meet
 * window.location.assign — so the boundary is enforced where the value enters,
 * not left to how every consumer happens to use it. Accepts only paths with a
 * single leading slash ("/apothecary/pricing?checkout=seed"), rejecting
 * protocol-relative ("//evil.com"), backslash ("/\evil.com"), and absolute
 * URLs. Returns null when absent or unsafe; callers supply their own fallback.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
