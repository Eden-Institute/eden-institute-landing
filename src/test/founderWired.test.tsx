// Wired quiz W5: the founder admin page. A non-founder sees only the restricted line and never asks
// for the list; the founder sees every row with its status, and the approve-all button counts only
// the rows still waiting. (The server boundary is the wired_admin_* RPCs, checked by the dry run.)
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { mfa: {} } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import FounderWired from "../pages/FounderWired";

const row = (over: Record<string, unknown>) => ({
  id: crypto.randomUUID(), sheet_id: "C001", name: "Curriculum", publisher: "P", approach: "Classical", approach_secondary: null,
  subjects: [], grade_min: 0, grade_max: 5, domains_served: [], prep_load: "Light", price_cents: 10000, price_basis: null,
  multi_age: false, faith_alignment: null, url: null, affiliate_url: null, is_affiliate: false, eden_band: null, coming_soon: false,
  approved: false, approved_at: null, last_verified_at: "2026-11-18", dm_name: null, dm_role: null, dm_email: null, dm_source_url: null, esa: [],
  ...over,
});

afterEach(() => { cleanup(); rpc.mockReset(); });

describe("FounderWired", () => {
  it("a non-founder sees the restricted line and the list is never asked for", async () => {
    rpc.mockImplementation((fn: string) => Promise.resolve(fn === "is_founder" ? { data: false, error: null } : { data: [], error: null }));
    render(<FounderWired />);
    await waitFor(() => expect(screen.getByText("This page is for the founder account only.")).toBeTruthy());
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain("wired_admin_list");
  });

  it("the founder sees the rows, their status, and approve-all counts only rows still waiting", async () => {
    const rows = [row({ name: "Alpha", approved: true }), row({ name: "Beta" }), row({ name: "Gamma", price_cents: null })];
    rpc.mockImplementation((fn: string) => Promise.resolve(fn === "is_founder" ? { data: true, error: null } : { data: rows, error: null }));
    render(<FounderWired />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());
    expect(screen.getByText(/3 curricula, 1 approved/)).toBeTruthy();
    expect(screen.getByText("Approve all shown (2)")).toBeTruthy();
    expect(screen.getByText("no price")).toBeTruthy();
  });
});
