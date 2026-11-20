// The two site-wide 2027 sale weeks (founder decision 2026-11-20, whole site), the
// page half. The server half (windows in America/Chicago, the gate, prices, the
// webhook gift) is in supabase/functions/_shared/sale-offers.test.ts.
//
// Pins:
//   - Spring Planning Week (Feb 22 to Feb 28, 2027): every Starter box shows 25% off
//     and sends offer "spring2027"; printed sets are unchanged that week
//   - Back-to-School Week (Jul 5 to Jul 11, 2027): every printed-set box shows free
//     shipping and the gifted Starter(s) and sends offer "summer2027"; Starters are
//     unchanged that week
//   - one second outside either window, both boxes are exactly as before
//   - a partner's ?promo= code is never sent with a sale
//   - the /fpea offer prop still wins over a site-wide sale

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const rows = [
  { sku: "sprouts_print_set", name: "Sprouts Printed Curriculum Set", retail_price_cents: 24900, shipping_tier_cents: 1200, volume_price_cents: null, volume_min_qty: null },
  { sku: "seedlings_print_set", name: "Seedlings Printed Curriculum Set", retail_price_cents: 24900, shipping_tier_cents: 1200, volume_price_cents: null, volume_min_qty: null },
  { sku: "both_bands_print_set", name: "Sprouts and Seedlings Printed Curriculum Sets", retail_price_cents: 42900, shipping_tier_cents: 1600, volume_price_cents: null, volume_min_qty: null },
];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      select: () => ({
        in: (_col: string, skus: string[]) => Promise.resolve({ data: rows.filter((r) => skus.includes(r.sku)), error: null }),
      }),
    }),
  },
}));
vi.mock("@/lib/fbAttribution", () => ({ getFbAttribution: () => ({}) }));
vi.mock("@/lib/attribution", () => ({ getCheckoutAttribution: () => ({ probe: 1 }) }));
vi.mock("@/lib/pinterestTag", () => ({ pinTrack: vi.fn(), centsToValue: (c: number) => c / 100 }));
vi.mock("../../web/components/islands/PayOverTime", () => ({ default: () => null }));

import StarterBuyBox from "../../web/components/islands/StarterBuyBox";
import PrintBuyBox from "../../web/components/islands/PrintBuyBox";

// Wall-clock instants in Chicago: CST (UTC-6) in February, CDT (UTC-5) in July.
const SPRING_FIRST = "2027-02-22T00:00:00-06:00";
const SPRING_LAST = "2027-02-28T23:59:59-06:00";
const SPRING_BEFORE = "2027-02-21T23:59:59-06:00";
const SPRING_AFTER = "2027-03-01T00:00:00-06:00";
const SUMMER_FIRST = "2027-07-05T00:00:00-05:00";
const SUMMER_LAST = "2027-07-11T23:59:59-05:00";
const SUMMER_BEFORE = "2027-07-04T23:59:59-05:00";
const SUMMER_AFTER = "2027-07-12T00:00:00-05:00";

function setNow(iso: string) {
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
  // Only Date is faked, so testing-library's own timers keep running.
  vi.useFakeTimers({ toFake: ["Date"] });
  invoke.mockReset();
  invoke.mockResolvedValue({ data: {}, error: null });
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function clickAndGetBody(name: RegExp) {
  fireEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  return invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
}

describe("Spring Planning Week (Starter 25% off, whole site)", () => {
  for (const at of [SPRING_FIRST, SPRING_LAST]) {
    it(`at ${at} the Starter box shows the sale and sends spring2027, with no cancel_url change`, async () => {
      setNow(at);
      render(<StarterBuyBox cta="t" band="seedlings" />);
      expect(await screen.findByText("Spring Planning Week price: 25% off the regular $39.00.")).toBeInTheDocument();
      const [fn, opts] = await clickAndGetBody(/Get the Starter Unit, \$29\.25$/);
      expect(fn).toBe("create-checkout");
      expect(opts.body).toEqual({ attribution: { probe: 1 }, lookup_key: "seedlings_starter_unit", offer: "spring2027" });
    });
  }

  it("a partner's ?promo= code is not sent with the sale (no stacking)", async () => {
    setNow(SPRING_FIRST);
    window.history.replaceState(null, "", "/starter?promo=LIZ10");
    render(<StarterBuyBox cta="t" />);
    const [, opts] = await clickAndGetBody(/Get the Starter Unit, \$29\.25$/);
    expect(opts.body.offer).toBe("spring2027");
    expect(opts.body.promo_code).toBeUndefined();
  });

  it("printed sets are full price that week: shipping charged, no offer sent", async () => {
    setNow(SPRING_FIRST);
    render(<PrintBuyBox cta="t" />);
    expect(await screen.findByText("$12.00")).toBeInTheDocument();
    expect(screen.queryByText(/Spring Planning Week|Back-to-School Week/)).toBeNull();
    const [, opts] = await clickAndGetBody(/Order the set, \$249\.00/);
    expect(opts.body.offer).toBeUndefined();
  });

  for (const at of [SPRING_BEFORE, SPRING_AFTER]) {
    it(`one second outside (${at}) the Starter box is exactly as before`, async () => {
      setNow(at);
      render(<StarterBuyBox cta="t" />);
      const [, opts] = await clickAndGetBody(/Get the Starter Unit, \$39$/);
      expect(opts).toEqual({ body: { attribution: { probe: 1 }, lookup_key: "sprouts_starter_unit" } });
      expect(screen.queryByText(/Spring Planning Week/)).toBeNull();
    });
  }
});

describe("Back-to-School Week (printed sets: free shipping plus the Starter, whole site)", () => {
  for (const at of [SUMMER_FIRST, SUMMER_LAST]) {
    it(`at ${at} the print box shows free shipping and the gift, and sends summer2027 with the normal return address`, async () => {
      setNow(at);
      render(<PrintBuyBox cta="t" />);
      expect(await screen.findByText("Free")).toBeInTheDocument();
      expect(screen.queryByText("$12.00")).toBeNull();
      expect(screen.getByText("Back-to-School Week: free shipping, plus the Sprouts Starter Unit download emailed to you right after you pay.")).toBeInTheDocument();
      const [, opts] = await clickAndGetBody(/Order the set, \$249\.00/);
      expect(opts.body).toEqual({
        attribution: { probe: 1 },
        print_shop: true,
        items: [{ sku: "sprouts_print_set", qty: 1 }],
        sms_consent: false,
        offer: "summer2027",
        success_url: "https://edeninstitute.health/books/thank-you?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://edeninstitute.health/books?checkout=cancelled",
      });
    });
  }

  it("the both-years box names both Starters", async () => {
    setNow(SUMMER_FIRST);
    render(<PrintBuyBox cta="t" band="both" />);
    expect(await screen.findByText(/Back-to-School Week: free shipping, plus the Sprouts and Seedlings Starter Unit downloads emailed to you/)).toBeInTheDocument();
  });

  it("a partner's ?promo= code is not sent with the sale (no stacking)", async () => {
    setNow(SUMMER_FIRST);
    window.history.replaceState(null, "", "/books?promo=LIZ10");
    render(<PrintBuyBox cta="t" />);
    const [, opts] = await clickAndGetBody(/Order the set, \$249\.00/);
    expect(opts.body.offer).toBe("summer2027");
    expect(opts.body.promo_code).toBeUndefined();
  });

  it("Starter Units are full price that week: $39, no offer sent", async () => {
    setNow(SUMMER_FIRST);
    render(<StarterBuyBox cta="t" />);
    const [, opts] = await clickAndGetBody(/Get the Starter Unit, \$39$/);
    expect(opts.body.offer).toBeUndefined();
  });

  for (const at of [SUMMER_BEFORE, SUMMER_AFTER]) {
    it(`one second outside (${at}) the print box is exactly as before`, async () => {
      setNow(at);
      render(<PrintBuyBox cta="t" />);
      expect(await screen.findByText("$12.00")).toBeInTheDocument();
      expect(screen.queryByText(/Back-to-School Week/)).toBeNull();
      const [, opts] = await clickAndGetBody(/Order the set, \$249\.00/);
      expect(opts.body.offer).toBeUndefined();
    });
  }
});

describe("the /fpea offer prop", () => {
  it("still wins over the site-wide sale and keeps its own copy and return address", async () => {
    setNow(SPRING_FIRST);
    render(<StarterBuyBox cta="t" offer="fpea2027" />);
    expect(await screen.findByText("FPEA price: 25% off the regular $39.00.")).toBeInTheDocument();
    const [, opts] = await clickAndGetBody(/Get the Starter Unit, \$29\.25$/);
    expect(opts.body.offer).toBe("fpea2027");
    expect(opts.body.cancel_url).toBe("https://edeninstitute.health/fpea?checkout=cancelled&item=starter-sprouts#starter-sprouts");
  });
});
