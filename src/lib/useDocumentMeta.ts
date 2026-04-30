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
 * tracks the cleanup so navigating away restores the static homepage
 * defaults from index.html (no stale meta on the next route's first
 * paint).
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
}

const HOMEPAGE_TITLE =
  "The Eden Institute & Eden Apothecary — Biblical Clinical Herbalism";
const HOMEPAGE_DESCRIPTION =
  "Eden Apothecary is a clinical reasoning app for terrain-based herbalism — 100 monographs anchored to constitutional patterns, tissue states, and stewardship. Built by The Eden Institute. Take the free Pattern of Eden quiz to find your constitutional pattern.";
const HOMEPAGE_CANONICAL = "https://edeninstitute.health/";

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
  const { title, description, canonical, ogImage, ogType = "website" } = meta;

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

    return () => {
      // Restore homepage defaults so the next route's first paint isn't
      // stuck with stale per-route meta until its own useDocumentMeta
      // effect runs.
      document.title = HOMEPAGE_TITLE;
      setMetaName("description", HOMEPAGE_DESCRIPTION);
      setLink("canonical", HOMEPAGE_CANONICAL);
      setMetaProperty("og:url", HOMEPAGE_CANONICAL);
      setMetaProperty("og:type", "website");
    };
  }, [title, description, canonical, ogImage, ogType]);
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
