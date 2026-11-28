// src/lib/affiliateClick.ts
//
// Affiliate click tracking (marketing audit 2026-11-27, tracking fix 6; Camila's "Build affiliate tracking now").
//
// Until now an affiliate click was only counted when its link happened to carry a data-cta, and even then the row
// said which button was clicked, never which program or product. The AFF lane could not be measured, so the lean
// plan paused it until this shipped.
//
// What this does: any click on an outbound link to a known affiliate host, or on any link marked rel="sponsored",
// sends ONE extra cta_events row through the existing cookieless record_cta_click RPC:
//   cta       = "aff-<program>"  (aff-mrh, aff-amazon, aff-hst, aff-christianbook, aff-cj, aff-awin, aff-other)
//   placement = the item         (the Mountain Rose short code or deep-link slug, the Amazon ASIN, the last path part)
//   path      = the page it was clicked on (the RPC strips query strings)
// The link itself is NOT rewritten and there is no redirect through our site, so the commission credit (the
// affiliate tag, short link or transaction id) is exactly what it was, and no program's link rules are touched.
// A link that also has a data-cta still sends its own data-cta row, unchanged, so older reports keep counting.

const PROGRAMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|\.)aspr\.app$/, "mrh"],
  [/(^|\.)mountainroseherbs\.com$/, "mrh"],
  [/(^|\.)amazon\.(com|ca|co\.uk|com\.au)$/, "amazon"],
  [/(^|\.)amzn\.to$/, "amazon"],
  [/(^|\.)homesciencetools\.com$/, "hst"],
  [/(^|\.)christianbook\.com$/, "christianbook"],
  [/(^|\.)botanicalinterests\.com$/, "botanical-interests"],
  [/(^|\.)awin1\.com$/, "awin"],
  [/(^|\.)(anrdoezrs\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|dpbolvw\.net)$/, "cj"],
];

/** record_cta_click keeps 50 characters of placement. */
const MAX_PLACEMENT = 50;

const lastSegment = (pathname: string): string => {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};

function itemFor(program: string, url: URL): string {
  if (program === "mrh" && /aspr\.app$/.test(url.hostname)) {
    // A deep link (bulk code + ?url=<product page>) names the product in its target; a plain short link names it
    // by its own code.
    const deep = url.searchParams.get("url");
    if (deep) {
      try {
        const slug = lastSegment(new URL(deep).pathname);
        if (slug) return slug;
      } catch {
        /* fall through to the code */
      }
    }
    return lastSegment(url.pathname);
  }
  if (program === "amazon") {
    const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asin) return asin[1].toUpperCase();
    return lastSegment(url.pathname);
  }
  if (program === "other") return url.hostname.replace(/^www\./, "");
  return lastSegment(url.pathname) || url.hostname.replace(/^www\./, "");
}

/**
 * The cta_events row for a click on this link, or null when it is not an affiliate or sponsored outbound link.
 * `pageHref` is the page the link sits on (relative hrefs resolve against it; same-site links are never counted).
 */
export function affiliateClick(
  href: string | null | undefined,
  rel: string | null | undefined,
  pageHref: string,
): { cta: string; placement: string } | null {
  if (!href) return null;
  let url: URL;
  let page: URL;
  try {
    page = new URL(pageHref);
    url = new URL(href, page);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host === page.hostname.toLowerCase() || host.endsWith("edeninstitute.health")) return null;
  const sponsored = /(^|\s)sponsored(\s|$)/i.test(rel ?? "");
  const match = PROGRAMS.find(([re]) => re.test(host));
  const program = match ? match[1] : sponsored ? "other" : null;
  if (!program) return null;
  const item = itemFor(program, url).slice(0, MAX_PLACEMENT);
  return { cta: `aff-${program}`, placement: item || program };
}
