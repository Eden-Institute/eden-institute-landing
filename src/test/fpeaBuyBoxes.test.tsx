// FPEA 2027 convention offer (/fpea, 2026-10-30), the page half. The server half
// (window gate, prices, the webhook gift, no credit) is in
// supabase/functions/_shared/fpea-offer.test.ts.
//
// Pins:
//   - REGRESSION: without the `offer` prop the Starter and print boxes send exactly the
//     request body they sent before, and show the same price and shipping
//   - with the offer: the FPEA price (from STARTER_BANDS, not typed), free shipping shown
//     and carried in the request, the gifted Starter named, returns to /fpea
//   - the /fpea island shows buttons only inside the window, and a plain "opens on" /
//     "ended on" note with a link to /books outside it

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
import FpeaOffer from "../../web/components/islands/FpeaOffer";

beforeEach(() => {
  invoke.mockReset();
  // No url back: the box shows an error instead of navigating, and the body is captured.
  invoke.mockResolvedValue({ data: {}, error: null });
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function clickAndGetBody(name: RegExp) {
  fireEvent.click(await screen.findByRole("button", { name }));
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  return invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
}

describe("StarterBuyBox", () => {
  it("REGRESSION: without the offer it shows $39 and sends exactly the body it always sent", async () => {
    render(<StarterBuyBox cta="t" />);
    const [fn, opts] = await clickAndGetBody(/Get the Starter Unit, \$39$/);
    expect(fn).toBe("create-checkout");
    expect(opts).toEqual({ body: { attribution: { probe: 1 }, lookup_key: "sprouts_starter_unit" } });
    expect(screen.queryByText(/FPEA/)).toBeNull();
  });

  it("with the offer it shows 25% off the configured price and sends the offer, returning to /fpea", async () => {
    render(<StarterBuyBox cta="t" band="seedlings" offer="fpea2027" />);
    expect(await screen.findByText("FPEA price: 25% off the regular $39.00.")).toBeInTheDocument();
    const [, opts] = await clickAndGetBody(/Get the Starter Unit, \$29\.25$/);
    expect(opts.body).toEqual({
      attribution: { probe: 1 },
      lookup_key: "seedlings_starter_unit",
      offer: "fpea2027",
      cancel_url: "https://edeninstitute.health/fpea?checkout=cancelled&item=starter-seedlings#starter-seedlings",
    });
  });
});

describe("PrintBuyBox", () => {
  it("REGRESSION: without the offer, shipping is charged and shown as before and the body has no offer", async () => {
    render(<PrintBuyBox cta="t" />);
    expect(await screen.findByText("$12.00")).toBeInTheDocument();
    expect(screen.getByText("$261.00")).toBeInTheDocument();
    expect(screen.queryByText(/FPEA/)).toBeNull();
    const [fn, opts] = await clickAndGetBody(/Order the set, \$249\.00/);
    expect(fn).toBe("create-checkout");
    expect(opts.body).toEqual({
      attribution: { probe: 1 },
      print_shop: true,
      items: [{ sku: "sprouts_print_set", qty: 1 }],
      sms_consent: false,
      success_url: "https://edeninstitute.health/books/thank-you?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://edeninstitute.health/books?checkout=cancelled",
    });
  });

  it("with the offer, shipping shows Free, the total drops by it, the gift is named, and the body carries the offer", async () => {
    render(<PrintBuyBox cta="t" offer="fpea2027" />);
    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getAllByText("$249.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("$12.00")).toBeNull();
    expect(screen.getByText(/FPEA offer: free shipping, plus the Sprouts Starter Unit download emailed to you right after you pay\./)).toBeInTheDocument();
    const [, opts] = await clickAndGetBody(/Order the set, \$249\.00/);
    expect(opts.body.offer).toBe("fpea2027");
    expect(opts.body.cancel_url).toBe("https://edeninstitute.health/fpea?checkout=cancelled&item=print-sprouts#print-sprouts");
    expect(opts.body.success_url).toBe("https://edeninstitute.health/books/thank-you?session_id={CHECKOUT_SESSION_ID}");
  });

  it("the both-years box under the offer names both Starters", async () => {
    render(<PrintBuyBox cta="t" band="both" offer="fpea2027" />);
    expect(await screen.findByText(/plus the Sprouts and Seedlings Starter Unit downloads emailed to you/)).toBeInTheDocument();
  });
});

describe("/fpea island", () => {
  it("before May 27, 2027: no buttons, the opening date, and a link to /books", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2027-05-26T23:59:59-04:00"));
    render(<FpeaOffer />);
    expect(await screen.findByText("The FPEA convention offer opens on May 27, 2027.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the printed sets" })).toHaveAttribute("href", "/books");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("after June 5, 2027: no buttons, the end date, and a link to /books", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2027-06-06T00:00:00-04:00"));
    render(<FpeaOffer />);
    expect(await screen.findByText("The FPEA convention offer ended on June 5, 2027.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the printed sets" })).toHaveAttribute("href", "/books");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("inside the window: three printed sets and two Starters, all under the offer", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2027-05-27T00:00:00-04:00"));
    render(<FpeaOffer />);
    expect(await screen.findByText("Your convention offer, through June 5")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Order (the set|both sets)/ })).toHaveLength(3));
    expect(screen.getAllByRole("button", { name: "Get the Starter Unit, $29.25" })).toHaveLength(2);
    expect(screen.getAllByText("Free")).toHaveLength(3);
  });
});
