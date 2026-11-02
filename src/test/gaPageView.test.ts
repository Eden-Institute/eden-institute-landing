// GA4 page_view waits for the route's real title (2026-10-28).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { announceDocumentMeta, resetAnnouncedForTests, sendPageViewWhenTitled } from "@/lib/gaPageView";

describe("sendPageViewWhenTitled", () => {
  let calls: unknown[][];
  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    resetAnnouncedForTests();
    (window as unknown as { gtag: unknown }).gtag = (...args: unknown[]) => calls.push(args);
    window.history.replaceState(null, "", "/apothecary/agrimony");
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("skips the placeholder and sends the herb's own title once", () => {
    sendPageViewWhenTitled("/apothecary/agrimony", "https://edeninstitute.health/apothecary");
    announceDocumentMeta("Herb Monograph | Eden Apothecary", true);
    expect(calls).toHaveLength(0);
    announceDocumentMeta("Agrimony (Agrimonia eupatoria): Traditional Uses & Safety | Eden Apothecary", false);
    announceDocumentMeta("Agrimony again", false);
    expect(calls).toEqual([["event", "page_view", {
      page_title: "Agrimony (Agrimonia eupatoria): Traditional Uses & Safety | Eden Apothecary",
      page_location: expect.stringMatching(/\/apothecary\/agrimony$/),
      page_referrer: "https://edeninstitute.health/apothecary",
    }]]);
    vi.advanceTimersByTime(5000);
    expect(calls).toHaveLength(1);
  });

  it("uses a settled title announced just before the tracker started", () => {
    announceDocumentMeta("Agrimony (Agrimonia eupatoria): Traditional Uses & Safety | Eden Apothecary", false);
    sendPageViewWhenTitled("/apothecary/agrimony", null);
    expect(calls).toHaveLength(1);
    expect((calls[0][2] as { page_title: string }).page_title).toMatch(/^Agrimony/);
  });

  it("ignores a title announced for a different page", () => {
    announceDocumentMeta("Pricing | Eden Apothecary", false);
    window.history.replaceState(null, "", "/apothecary/oat-straw");
    sendPageViewWhenTitled("/apothecary/oat-straw", null);
    expect(calls).toHaveLength(0);
  });

  it("falls back to the document title for a route that never announces", () => {
    document.title = "Set by hand";
    sendPageViewWhenTitled("/apothecary/agrimony", null);
    vi.advanceTimersByTime(2500);
    expect(calls).toHaveLength(1);
    expect((calls[0][2] as { page_title: string }).page_title).toBe("Set by hand");
    expect(calls[0][2]).not.toHaveProperty("page_referrer");
  });

  it("sends nothing for a route left before its title settled", () => {
    const cancel = sendPageViewWhenTitled("/apothecary/agrimony", null);
    announceDocumentMeta("Herb Monograph | Eden Apothecary", true);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(calls).toHaveLength(0);
  });
});
