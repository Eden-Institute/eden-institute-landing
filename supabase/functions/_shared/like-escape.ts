/** Escape LIKE/ILIKE wildcards so a user-supplied string matches literally (case-insensitive via ilike). */
export function escapeLikePattern(s: string): string {
  return s.replace(/([\\%_])/g, "\\$1")
}
