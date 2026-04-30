import { useEffect } from "react";

/**
 * Inject a JSON-LD structured-data block into <head> for the lifetime of
 * the calling component / current set of inputs.
 *
 * Why this is a hook (not a JSX <script> tag):
 *   React renders <script type="application/ld+json"> as a body-level
 *   element in JSX. Google's parser does pick it up there, but the
 *   schema.org + Google guidelines explicitly recommend head placement.
 *   This hook appends the script to document.head with a stable
 *   data-route-jsonld attribute so the cleanup can remove the right
 *   element on unmount or when the inputs change.
 *
 * Multiple JSON-LD blocks per route:
 *   Pass a unique `key` per call inside the same component. e.g.
 *   useStructuredData("article", articleJsonLd) and
 *   useStructuredData("breadcrumbs", breadcrumbsJsonLd) coexist without
 *   stomping each other — Results.tsx does exactly this.
 *
 * Pass `null` for jsonLd to skip injection entirely (route is in an
 * error state, slug is invalid, etc.).
 */
export function useStructuredData(
  key: string,
  jsonLd: Record<string, unknown> | null,
): void {
  // Stable serialization so the dep array doesn't churn on every render
  // for object literals declared inline at the call site.
  const serialized = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    if (!serialized) return;

    const selector = `script[type="application/ld+json"][data-route-jsonld="${key}"]`;
    let el = document.head.querySelector<HTMLScriptElement>(selector);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-route-jsonld", key);
      document.head.appendChild(el);
    }
    el.textContent = serialized;

    return () => {
      const stillThere = document.head.querySelector(selector);
      if (stillThere) stillThere.remove();
    };
  }, [key, serialized]);
}
