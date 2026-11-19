// The curriculum buy boxes' optional email + one-reminder box (CheckoutContact,
// Spring Buying Season Plan move 1, 2026-11-18). The body it adds to a
// create-checkout request: nothing unless a usable email was typed, and the
// reminder yes only together with that email.
import { describe, expect, it } from "vitest";
import { checkoutContactBody, cleanContactEmail, EMPTY_CHECKOUT_CONTACT } from "../../web/components/islands/CheckoutContact";

describe("cleanContactEmail", () => {
  it("keeps a usable email, trimmed", () => {
    expect(cleanContactEmail("  mom@example.com ")).toBe("mom@example.com");
  });
  it("drops blank, malformed and over-long input", () => {
    expect(cleanContactEmail("")).toBeNull();
    expect(cleanContactEmail(null)).toBeNull();
    expect(cleanContactEmail("mom@example")).toBeNull();
    expect(cleanContactEmail("mom example.com")).toBeNull();
    expect(cleanContactEmail(`${"x".repeat(250)}@b.co`)).toBeNull();
  });
  it("drops what Stripe refuses, so a typo can never fail the checkout (2026-11-19)", () => {
    for (const e of ["mom@example.com.", "mom@example.com,", "<mom@example.com>", "mom@example.com​", "mom@.example.com"]) {
      expect(cleanContactEmail(e)).toBeNull();
    }
    // and keeps the unusual-but-real ones Stripe takes
    for (const e of ["o'brien@example.com", "mom+eden@example.com", "jané@example.com"]) {
      expect(cleanContactEmail(e)).toBe(e);
    }
  });
});

describe("checkoutContactBody", () => {
  it("adds nothing by default (the box starts empty and unticked)", () => {
    expect(EMPTY_CHECKOUT_CONTACT).toEqual({ email: "", remind: false });
    expect(checkoutContactBody(EMPTY_CHECKOUT_CONTACT)).toEqual({});
  });
  it("sends the email, and the reminder yes only when ticked", () => {
    expect(checkoutContactBody({ email: "mom@example.com", remind: false })).toEqual({ email: "mom@example.com", reminder_consent: false });
    expect(checkoutContactBody({ email: "mom@example.com", remind: true })).toEqual({ email: "mom@example.com", reminder_consent: true });
  });
  it("a ticked box with no usable email sends nothing", () => {
    expect(checkoutContactBody({ email: "", remind: true })).toEqual({});
    expect(checkoutContactBody({ email: "nope", remind: true })).toEqual({});
  });
});
