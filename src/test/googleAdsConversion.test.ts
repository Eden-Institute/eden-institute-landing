// Google Ads Purchase conversion (2026-10-15). Pinned: the exact send_to from the
// Ads UI, value/currency/transaction_id passed through unchanged, the email goes
// only to gtag('set', 'user_data') and only when it is a real address, and both
// inline head copies configure the same Ads id, skipped after Decline.

import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import layout from "../../web/layouts/MarketingLayout.astro?raw";
import {
  GOOGLE_ADS_ID,
  GOOGLE_ADS_PURCHASE_SEND_TO,
  normalizeEmail,
  sendGoogleAdsPurchase,
} from "@/lib/googleAdsConversion";

const P = { transaction_id: "ref123", value: 249, currency: "USD" };

describe("normalizeEmail", () => {
  it("trims and lowercases a real address", () => {
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });
  it("rejects anything that is not an address", () => {
    for (const v of [null, undefined, "", "   ", "not-an-email", "a@b", "a b@c.com"]) {
      expect(normalizeEmail(v as string | null | undefined), String(v)).toBeNull();
    }
  });
});

describe("sendGoogleAdsPurchase", () => {
  it("sets user_data, then sends the conversion to the Purchase action", () => {
    const calls: unknown[][] = [];
    sendGoogleAdsPurchase((...a: unknown[]) => calls.push(a), P, "Buyer@Example.com");
    expect(calls).toEqual([
      ["set", "user_data", { email: "buyer@example.com" }],
      ["event", "conversion", { send_to: "AW-18494002476/L_oFCOO-gZ4dEKyq0PJE", value: 249, currency: "USD", transaction_id: "ref123" }],
    ]);
    expect(GOOGLE_ADS_PURCHASE_SEND_TO.startsWith(`${GOOGLE_ADS_ID}/`)).toBe(true);
  });

  it("sends the conversion without user_data when there is no usable email", () => {
    const calls: unknown[][] = [];
    sendGoogleAdsPurchase((...a: unknown[]) => calls.push(a), P, null);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe("conversion");
  });

  it("never throws, even when gtag does", () => {
    expect(() => sendGoogleAdsPurchase(() => { throw new Error("blocked"); }, P, "a@b.co")).not.toThrow();
  });
});

describe("inline head copies", () => {
  for (const [name, src] of [["index.html", indexHtml], ["MarketingLayout.astro", layout]] as const) {
    it(`${name} configures ${GOOGLE_ADS_ID} after GA4, skipped after Decline`, () => {
      expect(src).toContain(`if (edenAdsOn) gtag('config', '${GOOGLE_ADS_ID}');`);
      expect(src).toContain("edenAdsOn = localStorage.getItem('eden-marketing-consent') !== 'denied';");
      expect(src.indexOf("gtag('config', 'G-5DVHEZPKL0');")).toBeLessThan(src.indexOf(`gtag('config', '${GOOGLE_ADS_ID}')`));
    });
  }
});
