// Founder dashboard → Funnel tab → "Week 1 sign-ups by source" panel:
//   1. Calls founder_week1_signups_by_source with the computed p_since and renders
//      both tables, the Instagram call-out and the source note.
//   2. A failed RPC shows the error and no tables (never a table of fake zeros).

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import Week1SourcesPanel from "@/components/founder/Week1SourcesPanel";

const NOTE =
  "Instagram tagged = link in bio or a tagged link; Instagram referrer = untagged taps from Instagram.";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T22:00:00Z"));
  rpc.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Week1SourcesPanel", () => {
  it("loads the fixed range and renders the weekly and monthly tables", async () => {
    rpc.mockResolvedValue({
      data: {
        by_week: [
          { week_start: "2026-10-05", total: 14, instagram_tagged: 2, instagram_referrer: 2, facebook: 2, other_tagged: 1, untagged: 7 },
        ],
        by_month: [
          { month_start: "2026-10-01", total: 32, instagram_tagged: 2, instagram_referrer: 2, facebook: 7, other_tagged: 6, untagged: 15 },
        ],
      },
      error: null,
    });

    render(<Week1SourcesPanel />);

    expect(rpc).toHaveBeenCalledWith("founder_week1_signups_by_source", {
      p_since: "2026-04-30T00:00:00.000Z",
    });
    await screen.findByText(NOTE);
    expect(screen.getByText("Instagram, last 12 weeks: 4 of 14 sign-ups (29%)")).toBeTruthy();
    expect(screen.getByText("Last 12 weeks (week of Monday)")).toBeTruthy();
    expect(screen.getByText("Last 6 months")).toBeTruthy();
    expect(screen.getByText("Oct 5")).toBeTruthy();
    expect(screen.getByText("May 2026")).toBeTruthy();
    // 12 week rows + 6 month rows, plus one header row per table.
    expect(screen.getAllByRole("row")).toHaveLength(12 + 6 + 2);
  });

  it("shows the error instead of a table of zeros when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Not authorized") });

    render(<Week1SourcesPanel />);

    await waitFor(() => expect(screen.getByText("Not authorized")).toBeTruthy());
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
