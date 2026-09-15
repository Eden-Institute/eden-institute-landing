/**
 * No imports on purpose: HerbCard is in the design-sync bundle, and anything
 * imported here is bundled with it.
 */

/** True only for absolute http(s) URLs. Rejects javascript:, data:, vbscript:, relative paths and non-strings, so a value from a writable column can be used as an href. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
