import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEmailSubmit } from "@/lib/emailSubmit";

describe("trackEmailSubmit", () => {
  const gtag = vi.fn();
  beforeEach(() => {
    (window as unknown as { gtag: unknown }).gtag = gtag;
    localStorage.clear();
  });
  afterEach(() => gtag.mockReset());

  it("sends email_submit with form_name", () => {
    trackEmailSubmit("esa_invoice");
    expect(gtag).toHaveBeenCalledWith("event", "email_submit", {
      form_name: "esa_invoice",
      event_category: "conversion",
      event_label: "esa_invoice",
    });
  });

  it("sends nothing after Decline", () => {
    localStorage.setItem("eden-marketing-consent", "denied");
    trackEmailSubmit("sprouts_magnet");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("never throws without gtag", () => {
    delete (window as unknown as { gtag?: unknown }).gtag;
    expect(() => trackEmailSubmit("x")).not.toThrow();
  });
});
