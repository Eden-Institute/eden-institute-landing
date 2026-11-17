// web/lib/strayPunctuation.ts
//
// 2026-11-17 (Lane 2 deep audit area 11, T1; founder tap "Yes, build + ship"): a link pasted into a post as
// "edeninstitute.health/freebies:" picks up the colon (or a period, comma, closing bracket) as part of the address,
// and every such address answered "Page not found". Two families hit /freebies: from Facebook on 11/14 and 11/16.
// The 404 page now strips that trailing punctuation and forwards to the real page, keeping the query and the
// #section. Nothing on the site ends in punctuation, so a stripped path is never a different real page.

const TRAILING = /(?:[.,:;!)\]'"]|%3A|%2C|%3B|%21|%29|%5D|%22|%27)+$/i;

/** The path without trailing punctuation, or "" when there is nothing to strip (or nothing would be left). */
export function strayPunctuationTarget(pathname: string): string {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return "";
  const clean = pathname.replace(TRAILING, "");
  if (clean === pathname) return "";
  return clean === "" ? "/" : clean;
}
