/**
 * Street-address check for HEAVY print orders (founder decision 2026-09-26):
 * a parcel that ships by ground (FedEx home delivery) cannot go to a PO box or an
 * APO / FPO / DPO address. supabase/functions/_shared/ship-address.ts is used by
 * the buy boxes, create-checkout (before payment) and the stripe-webhook backstop.
 */
import { describe, it, expect } from "vitest";
import {
  checkShipTo,
  isGroundUndeliverable,
  isMilitaryAddress,
  isPoBoxLine,
  shippingDetailsFromMetadata,
  shipToMetadata,
} from "../../supabase/functions/_shared/ship-address";

const good = { name: "Ada Lovelace", email: "ada@example.com", line1: "12 Maple St", city: "Clarksville", state: "TN", postal_code: "37043" };
const EM_DASH = "—";

describe("isPoBoxLine", () => {
  it.each([
    "PO Box 123", "P.O. Box 123", "P. O. Box 9", "po box 5", "POBox 77", "P O Box 12", "PO Drawer 4",
    "Post Office Box 88", "post office drawer 2", "POB 12", "P.O. #123", "PO 123", "Box 44", "box #9",
    "Caller Box 3", "Lock Box 10", "Postal Box 2", "P.O.B. 5",
  ])("blocks %s", (line) => expect(isPoBoxLine(line)).toBe(true));

  it.each([
    "12 Maple St", "303 Holly Cir", "Unit 3262", "PMB 204", "123 Main St PMB 12", "1 Boxwood Ln",
    "88 Poplar Ave", "5 Post Rd", "Apt 4B", "Suite 200", "12 Pond View Dr", "44 Polo Club Rd", "", "   ",
  ])("allows %s", (line) => expect(isPoBoxLine(line)).toBe(false));
});

describe("isMilitaryAddress", () => {
  it("blocks the military states AA, AE and AP", () => {
    for (const state of ["AA", "AE", "AP", "ae"]) expect(isMilitaryAddress({ state, city: "Somewhere" })).toBe(true);
  });
  it("blocks APO, FPO and DPO cities and PSC / CMR lines", () => {
    expect(isMilitaryAddress({ city: "APO", state: "NY" })).toBe(true);
    expect(isMilitaryAddress({ city: "fpo", state: "CA" })).toBe(true);
    expect(isMilitaryAddress({ city: "DPO" })).toBe(true);
    expect(isMilitaryAddress({ line1: "PSC 1234 Box 5678", city: "Anywhere", state: "TX" })).toBe(true);
    expect(isMilitaryAddress({ line1: "CMR 480 Box 12", city: "Anywhere", state: "TX" })).toBe(true);
  });
  it("allows ordinary addresses, including Unit numbers", () => {
    expect(isMilitaryAddress({ line1: "303 Holly Cir", line2: "Unit 3262", city: "Clarksville", state: "TN" })).toBe(false);
    expect(isMilitaryAddress({ line1: "1 Apollo Way", city: "Houston", state: "TX" })).toBe(false);
  });
});

describe("checkShipTo", () => {
  it("accepts and cleans a street address", () => {
    const r = checkShipTo({ ...good, name: "  Ada   Lovelace ", state: "tn", email: "ADA@Example.com" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ name: "Ada Lovelace", state: "TN", email: "ada@example.com" });
  });
  it("accepts a PMB and a ZIP+4", () => {
    expect(checkShipTo({ ...good, line1: "500 Main St", line2: "PMB 204", postal_code: "37043-1234" }).ok).toBe(true);
  });
  it("refuses a PO box in either line, warmly", () => {
    for (const bad of [{ line1: "PO Box 12" }, { line2: "P.O. Box 7" }]) {
      const r = checkShipTo({ ...good, ...bad }) as { ok: boolean; problem?: string; message?: string };
      expect(r.ok).toBe(false);
      expect(r.problem).toBe("po_box");
      expect(r.message).toContain("street address");
      expect(r.message).not.toContain(EM_DASH);
    }
  });
  it("refuses APO / FPO / DPO", () => {
    const r = checkShipTo({ ...good, line1: "Unit 2050 Box 4190", city: "APO", state: "AE", postal_code: "09096" }) as {
      ok: boolean; problem?: string; message?: string;
    };
    expect(r.ok).toBe(false);
    expect(r.problem).toBe("military");
    expect(r.message).not.toContain(EM_DASH);
  });
  it("needs every required field, a real state, a ZIP and an email", () => {
    expect(checkShipTo({ ...good, line1: "" })).toMatchObject({ ok: false, problem: "missing" });
    expect(checkShipTo({ ...good, email: "" })).toMatchObject({ ok: false, problem: "missing" });
    expect(checkShipTo({ ...good, state: "PR" })).toMatchObject({ ok: false, problem: "state" });
    expect(checkShipTo({ ...good, postal_code: "3704" })).toMatchObject({ ok: false, problem: "zip" });
    expect(checkShipTo({ ...good, email: "ada.example.com" })).toMatchObject({ ok: false, problem: "email" });
    expect(checkShipTo(null)).toMatchObject({ ok: false, problem: "missing" });
  });
});

describe("locked address round trip (create-checkout metadata -> stripe-webhook)", () => {
  it("rebuilds Stripe-shaped shipping details", () => {
    const r = checkShipTo({ ...good, line2: "Apt 4" }) as { ok: boolean; value?: Parameters<typeof shipToMetadata>[0] };
    expect(r.ok).toBe(true);
    const meta = { print_ship_to: shipToMetadata(r.value!) };
    expect(meta.print_ship_to.length).toBeLessThanOrEqual(500);
    expect(shippingDetailsFromMetadata(meta)).toEqual({
      name: "Ada Lovelace",
      address: { line1: "12 Maple St", line2: "Apt 4", city: "Clarksville", state: "TN", postal_code: "37043", country: "US" },
    });
  });
  it("returns null when there is no locked address (every normal order)", () => {
    expect(shippingDetailsFromMetadata({})).toBeNull();
    expect(shippingDetailsFromMetadata({ print_ship_to: "not json" })).toBeNull();
    expect(shippingDetailsFromMetadata(null)).toBeNull();
  });
  it("the webhook backstop flags PO boxes and APOs only", () => {
    expect(isGroundUndeliverable({ line1: "PO Box 3", city: "Nashville", state: "TN" })).toBe(true);
    expect(isGroundUndeliverable({ line1: "PSC 1 Box 2", city: "APO", state: "AE" })).toBe(true);
    expect(isGroundUndeliverable({ line1: "12 Maple St", city: "Nashville", state: "TN" })).toBe(false);
    expect(isGroundUndeliverable(null)).toBe(false);
  });
});
