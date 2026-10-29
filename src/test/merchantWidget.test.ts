import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = { value: true };
vi.mock("@/lib/productionHost", () => ({ isProductionHost: () => live.value, thirdPartyTagsAllowed: () => live.value }));
// The merchant id comes from customerReviews.ts, which imports the Supabase client.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { setMarketingConsent } from "@/lib/consent";
import {
  MERCHANT_WIDGET_SCRIPT,
  merchantWidgetOptions,
  resetMerchantWidgetForTests,
  startMerchantWidget,
  startMerchantWidgetAfterAccept,
} from "@/lib/merchantWidget";

const widgetScripts = () => document.querySelectorAll(`script[src="${MERCHANT_WIDGET_SCRIPT}"]`);

describe("Google store badge", () => {
  beforeEach(() => {
    live.value = true;
    localStorage.clear();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    resetMerchantWidgetForTests();
  });
  afterEach(() => {
    delete (window as unknown as { merchantwidget?: unknown }).merchantwidget;
  });

  it("uses Google's defaults with no sticky bar, and lifts itself above one", () => {
    expect(merchantWidgetOptions(0)).toEqual({ merchant_id: 5861058138, position: "RIGHT_BOTTOM" });
    expect(merchantWidgetOptions(69.5)).toEqual({
      merchant_id: 5861058138,
      position: "RIGHT_BOTTOM",
      bottomMargin: 82,
      mobileBottomMargin: 82,
    });
    // Never lower than Google's own margins.
    expect(merchantWidgetOptions(10)).toMatchObject({ bottomMargin: 36, mobileBottomMargin: 46 });
  });

  it("loads nothing before a choice, after Decline, or off the live site", () => {
    startMerchantWidget();
    localStorage.setItem("eden-marketing-consent", "denied");
    startMerchantWidget();
    localStorage.setItem("eden-marketing-consent", "granted");
    live.value = false;
    startMerchantWidget();
    expect(widgetScripts().length).toBe(0);
  });

  it("loads once for a visitor who accepted, and starts with the merchant id", () => {
    localStorage.setItem("eden-marketing-consent", "granted");
    startMerchantWidget();
    startMerchantWidget();
    const scripts = widgetScripts();
    expect(scripts.length).toBe(1);
    const start = vi.fn();
    (window as unknown as { merchantwidget: unknown }).merchantwidget = { start };
    scripts[0].dispatchEvent(new Event("load"));
    expect(start).toHaveBeenCalledWith({ merchant_id: 5861058138, position: "RIGHT_BOTTOM" });
  });

  it("waits for the banner: loads the moment the visitor taps Accept, not on Decline", () => {
    const stop = startMerchantWidgetAfterAccept();
    expect(widgetScripts().length).toBe(0);
    setMarketingConsent("denied");
    expect(widgetScripts().length).toBe(0);
    setMarketingConsent("granted");
    expect(widgetScripts().length).toBe(1);
    stop();
  });

  it("stops listening after cleanup", () => {
    const stop = startMerchantWidgetAfterAccept();
    stop();
    setMarketingConsent("granted");
    expect(widgetScripts().length).toBe(0);
  });
});
