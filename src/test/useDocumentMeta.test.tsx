/**
 * useDocumentMeta — the per-route <head> primitive.
 *
 * The invariant worth locking down is the new `robots` option: a route that
 * renders a not-found state at a 200 (the SPA cannot send a real 404) must be
 * able to mark itself noindex, and navigating away must put the shipped
 * default back so the next route is not accidentally deindexed.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

const robotsContent = () =>
  document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;

const BASE = {
  title: "Body Pattern Not Found — The Eden Institute",
  description: "We couldn't find that body pattern.",
  canonical: "https://edeninstitute.health/results/nope",
};

describe("useDocumentMeta", () => {
  afterEach(() => {
    document.querySelector('meta[name="robots"]')?.remove();
  });

  it("sets title, description and canonical", () => {
    const { unmount } = renderHook(() => useDocumentMeta(BASE));
    expect(document.title).toBe(BASE.title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      BASE.description,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      BASE.canonical,
    );
    unmount();
  });

  it("writes <meta name=robots> only when asked", () => {
    const { unmount } = renderHook(() => useDocumentMeta(BASE));
    expect(robotsContent()).toBeNull();
    unmount();

    const noindex = renderHook(() => useDocumentMeta({ ...BASE, robots: "noindex, follow" }));
    expect(robotsContent()).toBe("noindex, follow");
    noindex.unmount();
  });

  it("restores the shipped robots default on unmount", () => {
    // The test document ships no robots meta (index.html does), so "restore"
    // here means remove; with index.html loaded it means put "index, follow" back.
    const { unmount } = renderHook(() => useDocumentMeta({ ...BASE, robots: "noindex, follow" }));
    expect(robotsContent()).toBe("noindex, follow");
    unmount();
    expect(robotsContent()).toBeNull();
  });

  it("does not leave a noindex behind when the next route omits robots", () => {
    const first = renderHook(() => useDocumentMeta({ ...BASE, robots: "noindex, follow" }));
    first.unmount();
    const second = renderHook(() =>
      useDocumentMeta({ ...BASE, canonical: "https://edeninstitute.health/results/frozen-knot" }),
    );
    expect(robotsContent()).toBeNull();
    second.unmount();
  });
});
