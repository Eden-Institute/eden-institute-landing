// The one cookie banner (src/components/ConsentBanner.tsx), shown by the SPA
// (default export) and by the Astro SiteAnalytics island (ConsentBannerView).
// Pins the founder-approved wording and that the buttons keep their behaviour:
// Decline stores "denied" and switches Google Analytics off; Accept stores
// "granted", switches it back on and loads the Meta Pixel.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadMetaPixel = vi.fn();
const metaPageView = vi.fn();
vi.mock("@/lib/metaPixel", () => ({
  loadMetaPixel: () => loadMetaPixel(),
  metaPageView: () => metaPageView(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: () => Promise.resolve({ data: null, error: null }) },
}));

import ConsentBanner from "@/components/ConsentBanner";
import SiteAnalytics from "../../web/components/islands/SiteAnalytics";

const KEY = "eden-marketing-consent";
const TEXT =
  "We use a few cookies to understand traffic and measure our ads. Google Analytics and Pinterest are on unless you tap Decline. Our Meta ad pixel only turns on if you tap Accept. Our own cookie-free page counts stay on either way. See our Cookie Policy.";
const GA_OFF = "ga-disable-G-5DVHEZPKL0";

const win = () => window as unknown as Record<string, unknown>;

beforeEach(() => {
  localStorage.clear();
  loadMetaPixel.mockClear();
  metaPageView.mockClear();
  delete win()[GA_OFF];
});
afterEach(cleanup);

const bannerText = (region: HTMLElement) =>
  (region.querySelector("p")?.textContent ?? "").replace(/\s+/g, " ").trim();

describe("ConsentBanner (SPA mount)", () => {
  it("shows the approved wording with a Cookie Policy link to /cookies", () => {
    render(<ConsentBanner />);
    const region = screen.getByRole("region", { name: "Cookie consent" });
    expect(bannerText(region)).toBe(TEXT);
    expect(screen.getByRole("link", { name: "Cookie Policy" }).getAttribute("href")).toBe("/cookies");
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });

  it("stays hidden once a choice is stored", () => {
    localStorage.setItem(KEY, "denied");
    render(<ConsentBanner />);
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("Decline stores denied, turns Google Analytics off, loads no Meta Pixel, and hides", () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(localStorage.getItem(KEY)).toBe("denied");
    expect(win()[GA_OFF]).toBe(true);
    expect(loadMetaPixel).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("Accept stores granted, keeps Google Analytics on, loads the Meta Pixel, and hides", () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(localStorage.getItem(KEY)).toBe("granted");
    expect(win()[GA_OFF]).toBe(false);
    expect(loadMetaPixel).toHaveBeenCalledTimes(1);
    expect(metaPageView).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });
});

describe("SiteAnalytics (Astro) renders the same banner", () => {
  it("shows the identical wording and hides on Decline", async () => {
    render(<SiteAnalytics />);
    const region = await screen.findByRole("region", { name: "Cookie consent" });
    expect(bannerText(region)).toBe(TEXT);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(localStorage.getItem(KEY)).toBe("denied");
    expect(win()[GA_OFF]).toBe(true);
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });
});
