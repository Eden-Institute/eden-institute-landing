import { useEffect } from "react";

/**
 * Per-route document meta — one-stop typed primitive for setting
 * <title>, <meta name="description">, <link rel="canonical">, and the
 * Open Graph / Twitter card pairs from inside a React component.
 *
 * Why this exists
 * ───────────────
 * The Vite SPA serves a single static index.html for every route. Without
 * per-route mutation, Google indexes /apothecary, /assessment,
 * /results/frozen-knot, etc. with the *same* title and description as
 * the homepage. That collapses search visibility (duplicate-title
 * penalty) and surfaces the wrong snippet in the SERP.
 *
 * Two pages (Results.tsx, WhyEden.tsx) already implemented this ad-hoc
 * via useEffect + manual DOM mutation. This hook consolidates that
 * pattern, adds canonical handling that was missing from both, and
 * tracks the cleanup so navigating away restores the defaults index.html
 * ships (read from the DOM once at startup; see DEFAULTS below) and removes
 * any tag index.html does not ship, such as the canonical and og:url (no
 * stale meta on the next route's first paint). index.html ships no
 * canonical or og:url, so a route without this hook gets none
 * (self-canonical by default) rather than pointing at the homepage.
 *
 * SSR is not in scope (Vite + React SPA; Google renders our JS). If a
 * future Next.js migration happens, swap this for next/head with no
 * caller-side changes — the call signature is intentionally a subset of
 * what next/head accepts.
 */
export interface DocumentMeta {
  /** <title>. Required. ~50–60 chars optimal for SERP display. */
  title: string;
  /** <meta name="description">. Required. ~150–160 chars optimal. */
  description: string;
  /** Canonical URL (absolute, with scheme + host). Required. */
  canonical: string;
  /** OG image URL (absolute). Optional — falls back to the index.html default. */
  ogImage?: string;
  /** OG type. Defaults to "website". Use "article" for /results, /guide pages. */
  ogType?: "website" | "article";
  /**
   * <meta name="robots">, e.g. "noindex, follow" for a route that renders a
   * not-found state at a 200 (the SPA cannot send a real 404). Omitted: the
   * index.html default ("index, follow") stays in place.
   */
  robots?: string;
}

const readMetaName = (n: string) =>
  document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? "";
const readMetaProp = (p: string) =>
  document.querySelector(`meta[property="${p}"]`)?.getAttribute("content") ?? "";

/**
 * The static index.html head, snapshotted when this module is first
 * evaluated. src/main.tsx imports this module before rendering so the
 * snapshot is taken before any route mutates <head>. An empty string means
 * index.html does not ship that tag, and cleanup removes it.
 */
const DEFAULTS =
  typeof document === "undefined"
    ? null
    : {
        title: document.title,
        description: readMetaName("description"),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        robots: readMetaName("robots"),
        ogTitle: readMetaProp("og:title"),
        ogDescription: readMetaProp("og:description"),
        ogUrl: readMetaProp("og:url"),
        ogImage: readMetaProp("og:image"),
        twitterTitle: readMetaName("twitter:title"),
        twitterDescription: readMetaName("twitter:description"),
        twitterImage: readMetaName("twitter:image"),
      };

/**
 * Set the per-route document meta. Call once at the top of any public
 * page component:
 *
 *   useDocumentMeta({
 *     title: "Why Eden Institute — Biblical Clinical Herbalism",
 *     description: "There is no other program like this one...",
 *     canonical: "https://edeninstitute.health/why-eden",
 *   });
 *
 * The hook re-runs only if the meta object's primitive fields change,
 * so it's safe to inline the object literal at the call site.
 */
export function useDocumentMeta(meta: DocumentMeta): void {
  const { title, description, canonical, ogImage, ogType = "website", robots } = meta;

  useEffect(() => {
    document.title = title;
    setMetaName("description", description);
    setLink("canonical", canonical);

    setMetaProperty("og:title", title);
    setMetaProperty("og:description", description);
    setMetaProperty("og:url", canonical);
    setMetaProperty("og:type", ogType);
    if (ogImage) {
      setMetaProperty("og:image", ogImage);
      setMetaName("twitter:image", ogImage);
    }

    setMetaName("twitter:title", title);
    setMetaName("twitter:description", description);
    setMetaName("twitter:card", "summary_large_image");
    if (robots) setMetaName("robots", robots);

    return () => {
      // Restore the index.html defaults so the next route's first paint isn't
      // stuck with stale per-route meta until its own useDocumentMeta
      // effect runs.
      if (!DEFAULTS) return;
      document.title = DEFAULTS.title;
      restoreMetaName("description", DEFAULTS.description);
      if (DEFAULTS.canonical) setLink("canonical", DEFAULTS.canonical);
      else removeLink("canonical");
      restoreMetaProperty("og:title", DEFAULTS.ogTitle);
      restoreMetaProperty("og:description", DEFAULTS.ogDescription);
      restoreMetaProperty("og:url", DEFAULTS.ogUrl);
      setMetaProperty("og:type", "website");
      restoreMetaName("twitter:title", DEFAULTS.twitterTitle);
      restoreMetaName("twitter:description", DEFAULTS.twitterDescription);
      restoreMetaName("robots", DEFAULTS.robots);
      // Images are only ever overridden when a caller passes ogImage; put the
      // shipped image back, and never remove it.
      if (DEFAULTS.ogImage) setMetaProperty("og:image", DEFAULTS.ogImage);
      if (DEFAULTS.twitterImage) setMetaName("twitter:image", DEFAULTS.twitterImage);
    };
  }, [title, description, canonical, ogImage, ogType, robots]);
}

// ─── DOM helpers ───────────────────────────────────────────────────

function setMetaName(name: string, content: string): void {
  let el = document.querySelector(
    `meta[name="${name}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaProperty(property: string, content: string): void {
  let el = document.querySelector(
    `meta[property="${property}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMetaProperty(property: string): void {
  document.querySelector(`meta[property="${property}"]`)?.remove();
}

function removeMetaName(name: string): void {
  document.querySelector(`meta[name="${name}"]`)?.remove();
}

/** Set the tag back to its index.html value, or remove it if index.html has none. */
function restoreMetaName(name: string, content: string): void {
  if (content) setMetaName(name, content);
  else removeMetaName(name);
}

function restoreMetaProperty(property: string, content: string): void {
  if (content) setMetaProperty(property, content);
  else removeMetaProperty(property);
}

function removeLink(rel: string): void {
  document.querySelector(`link[rel="${rel}"]`)?.remove();
}

function setLink(rel: string, href: string): void {
  let el = document.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
