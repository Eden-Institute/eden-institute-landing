import { describe, expect, it } from "vitest";
import { usMobileE164 } from "../../web/lib/smsPhone";

describe("usMobileE164 (the number next to the SMS consent box)", () => {
  it("accepts the usual ways a US number is typed", () => {
    expect(usMobileE164("(931) 555-0123")).toBe("+19315550123");
    expect(usMobileE164("931-555-0123")).toBe("+19315550123");
    expect(usMobileE164("931.555.0123")).toBe("+19315550123");
    expect(usMobileE164("9315550123")).toBe("+19315550123");
    expect(usMobileE164("+1 931 555 0123")).toBe("+19315550123");
    expect(usMobileE164("1 (931) 555-0123")).toBe("+19315550123");
  });

  it("refuses anything that is not 10 US digits", () => {
    expect(usMobileE164("")).toBeNull();
    expect(usMobileE164(null)).toBeNull();
    expect(usMobileE164(undefined)).toBeNull();
    expect(usMobileE164("555-0123")).toBeNull();
    expect(usMobileE164("931555012")).toBeNull();
    expect(usMobileE164("93155501234")).toBeNull();
    expect(usMobileE164("+44 20 7946 0958")).toBeNull();
  });

  it("refuses area codes and exchanges that start with 0 or 1", () => {
    expect(usMobileE164("031-555-0123")).toBeNull();
    expect(usMobileE164("131-555-0123")).toBeNull();
    expect(usMobileE164("931-055-0123")).toBeNull();
    expect(usMobileE164("931-155-0123")).toBeNull();
  });
});
