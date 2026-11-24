// Founder dashboard → Funnel tab → "How did you hear about us?" panel:
//   1. Calls founder_heard_about_counts and renders one row per choice (her labels, her order), plus the
//      Answered and Skipped rows.
//   2. A failed RPC shows the error and no table (never a table of fake zeros).
//   3. The function's value list in the migration equals HEARD_ABOUT_OPTIONS, and the migration gates on
//      is_founder() and revokes anon.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEARD_ABOUT_OPTIONS } from "../../supabase/functions/_shared/heard-about";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import HeardAboutPanel, { formatLaunch } from "@/components/founder/HeardAboutPanel";

beforeEach(() => {
  rpc.mockReset();
});

afterEach(() => {
  cleanup();
});

const ANSWERS = HEARD_ABOUT_OPTIONS.map((o, i) => ({ value: o.value, signups: i, orders: i === 0 ? 2 : 0 }));

describe("HeardAboutPanel", () => {
  it("renders every choice with her labels, then Answered and Skipped", async () => {
    rpc.mockResolvedValue({
      data: {
        launched_at: "2026-11-24T18:54:16+00:00",
        by_answer: ANSWERS,
        signups: { answered: 36, skipped: 4 },
        orders: { answered: 2, skipped: 1 },
      },
      error: null,
    });

    render(<HeardAboutPanel />);

    expect(rpc).toHaveBeenCalledWith("founder_heard_about_counts");
    await screen.findByText("Tales & Table Talk podcast");
    const rows = screen.getAllByRole("row");
    // header + 9 choices + Answered + Skipped
    expect(rows).toHaveLength(1 + HEARD_ABOUT_OPTIONS.length + 2);
    HEARD_ABOUT_OPTIONS.forEach((o, i) => {
      expect(within(rows[i + 1]).getByText(o.label)).toBeTruthy();
    });
    expect(within(rows[1]).getByText("2")).toBeTruthy(); // orders for the first choice
    expect(within(rows[10]).getByText("Answered")).toBeTruthy();
    expect(within(rows[10]).getByText("36")).toBeTruthy();
    expect(within(rows[11]).getByText("Skipped the question")).toBeTruthy();
    expect(within(rows[11]).getByText("4")).toBeTruthy();
    expect(screen.getByText(/Asked since November 24, 2026/)).toBeTruthy();
  });

  it("shows the error instead of a table of zeros when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Not authorized") });

    render(<HeardAboutPanel />);

    await waitFor(() => expect(screen.getByText("Not authorized")).toBeTruthy());
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("formats the launch instant in Central time", () => {
    expect(formatLaunch("2026-11-24T18:54:16+00:00")).toBe("November 24, 2026");
    expect(formatLaunch("not a date")).toBe("the day it went live");
  });
});

describe("the founder_heard_about_counts migration", () => {
  const dir = join(__dirname, "..", "..", "supabase", "migrations");
  const file = readdirSync(dir).find((f) => f.endsWith("_founder_heard_about_counts.sql"));
  const sql = readFileSync(join(dir, file!), "utf8");

  it("counts exactly her choices, in her order", () => {
    const m = sql.match(/vals constant text\[\] := array\[([^\]]+)\]/);
    expect(m).toBeTruthy();
    const listed = [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    expect(listed).toEqual(HEARD_ABOUT_OPTIONS.map((o) => o.value));
  });

  it("is founder-gated, read-only, and closed to anon", () => {
    expect(sql).toContain("if not public.is_founder() then");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function public.founder_heard_about_counts() from public, anon;");
    expect(sql).not.toMatch(/\b(insert into|update public\.|delete from|alter table|drop table)\b/i);
  });
});
