// Post-payment Welcome page (founder decision 2026-09-15). Pins the state machine:
//   - it never says "You're on the ... plan." while the tier is still free
//   - after ~9 s of quick polls it shows the "processing" screen with Check again
//   - it keeps polling in the background and switches to the confirmed welcome by
//     itself when the tier lands
//   - "Check again" refetches the tier

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ loading: false }) }));
vi.mock("@/lib/checkoutSession", () => ({ readCheckoutSessionId: () => "cs_test_welcome" }));

const tierState: { tier: string; isFetching: boolean } = { tier: "free", isFetching: false };
const refetch = vi.fn();
vi.mock("@/hooks/useCurrentTier", () => ({
  useCurrentTier: () => ({ data: tierState.tier, refetch, isFetching: tierState.isFetching }),
}));

import Welcome from "@/pages/apothecary/Welcome";

function renderWelcome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const rerender = () =>
    utils.rerender(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Welcome />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  return { rerender };
}

// Each poll's timer is scheduled by an effect after the previous tick re-renders,
// so time is advanced in small steps with React flushed between them.
async function advance(ms: number) {
  const step = 250;
  let left = ms;
  do {
    const d = Math.min(step, left);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(d);
    });
    left -= d;
  } while (left > 0);
}

beforeEach(() => {
  vi.useFakeTimers();
  tierState.tier = "free";
  tierState.isFetching = false;
  refetch.mockReset();
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { paid: true }, error: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Apothecary Welcome after checkout", () => {
  it("shows verifying first, then processing (not 'paid plan') when the tier stays free", async () => {
    renderWelcome();
    await advance(0);
    expect(screen.getByText(/Confirming your subscription/)).toBeInTheDocument();

    await advance(6 * 1500 + 10);
    expect(screen.getByText("Payment received. Your upgrade is on its way.")).toBeInTheDocument();
    expect(screen.getByText(/Stripe has confirmed your payment/)).toBeInTheDocument();
    expect(screen.queryByText(/You're on the/)).not.toBeInTheDocument();
  });

  it("keeps polling every 5 seconds and switches to confirmed when the tier lands", async () => {
    const { rerender } = renderWelcome();
    await advance(6 * 1500 + 10);
    expect(screen.getByText("Payment received. Your upgrade is on its way.")).toBeInTheDocument();

    const before = refetch.mock.calls.length;
    await advance(5000);
    expect(refetch.mock.calls.length).toBeGreaterThan(before);

    tierState.tier = "root";
    rerender();
    await advance(0);
    expect(screen.getByText("You're on the Root plan.")).toBeInTheDocument();
    expect(screen.queryByText("Payment received. Your upgrade is on its way.")).not.toBeInTheDocument();
  });

  it("stops background polling after about two minutes", async () => {
    renderWelcome();
    await advance(6 * 1500 + 10);
    await advance(24 * 5000 + 10);
    const settled = refetch.mock.calls.length;
    await advance(60_000);
    expect(refetch.mock.calls.length).toBe(settled);
    expect(screen.getByText("Payment received. Your upgrade is on its way.")).toBeInTheDocument();
  });

  it("Check again refetches the tier", async () => {
    renderWelcome();
    await advance(6 * 1500 + 10);
    const before = refetch.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(refetch.mock.calls.length).toBe(before + 1);
  });

  it("goes straight to confirmed when the tier is already paid", async () => {
    tierState.tier = "seed";
    renderWelcome();
    await advance(0);
    expect(screen.getByText("You're on the Seed plan.")).toBeInTheDocument();
  });

  it("an unpaid session shows payment not completed", async () => {
    invoke.mockResolvedValue({ data: { paid: false }, error: null });
    renderWelcome();
    await advance(0);
    expect(screen.getByText("Payment not completed")).toBeInTheDocument();
  });
});
