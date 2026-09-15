import { isHttpUrl } from "@/lib/safeUrl";

/**
 * Normalized href for a URL that came from external data (a Lulu webhook, the
 * outreach sheet mirror), or null unless it is an absolute http(s) URL. Keeps
 * javascript:/data: values out of <a href>.
 */
export function safeHttpHref(u: string | null | undefined): string | null {
  if (!isHttpUrl(u)) return null;
  return new URL(u).href;
}
