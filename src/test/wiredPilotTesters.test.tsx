// 2026-11-22 testers-only pilot (founder tap via Lane NP): what the browser sends and shows for a selected tester.
//   1. wiredApi sends x-wired-pass (her pilot pass, else the call's own link, else her saved results token), never
//      with the preview pass and never to create-checkout (its CORS does not allow it, and buying stays closed).
//   2. The results page hides every buy button and offer box when wired-results says buy_closed (removal only).

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredResults from "../../web/components/islands/WiredResults";
import { getBank, getResults, PILOT_KEY, PREVIEW_KEY, RESULTS_KEY, rater, startWiredCheckout } from "../../web/lib/wiredApi";

const scores = { storyteller: 40, organizer: 30, designer: 85, maker: 90, psalmist: 20, connector: 50, ponderer: 10, cultivator: 70, seeker: 5 };
const unlockedChild = {
  child_id: "c1", nickname: "Lily", grade: 2, unlocked: true, scores, top3: ["maker", "designer", "cultivator"], renaissance: false,
  tip_first: "low_prep", approach: { fits: [{ approach: "unit_study", room_for: ["maker", "designer"] }], already_there: false, her_approach: "charlotte_mason" },
  matches: [], coming_soon: [], offers: { blueprint: true, family_map: true },
};

function mockFetch(routes: Record<string, { status: number; body: unknown }>) {
  return vi.fn((url: string, _init?: RequestInit) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    const r = hit ? hit[1] : { status: 200, body: {} };
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
}
const headersOf = (f: ReturnType<typeof mockFetch>, fn: string) => {
  const call = f.mock.calls.find(([u]) => String(u).includes(fn));
  return ((call?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/wired/results");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("wiredApi: the tester pass header", () => {
  it("sends her pilot pass first", async () => {
    localStorage.setItem(PILOT_KEY, "PILOTPASS");
    localStorage.setItem(RESULTS_KEY, "RESULTSTOKEN");
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);
    await getBank("k2");
    expect(headersOf(f, "wired-bank")["x-wired-pass"]).toBe("PILOTPASS");
  });
  it("else the call's own link, else her saved results token", async () => {
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);
    await getResults("OWNTOKEN");
    expect(headersOf(f, "wired-results")["x-wired-pass"]).toBe("OWNTOKEN");
    localStorage.setItem(RESULTS_KEY, "SAVED");
    const g = mockFetch({});
    vi.stubGlobal("fetch", g);
    await getBank("g3_5");
    expect(headersOf(g, "wired-bank")["x-wired-pass"]).toBe("SAVED");
  });
  it("a rater page sends its own link as rater:<kind>:<code>", async () => {
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);
    await rater({ kind: "observer", code: "CODE123", action: "context" });
    expect(headersOf(f, "wired-rater")["x-wired-pass"]).toBe("rater:observer:CODE123");
  });
  it("nothing to send: no header", async () => {
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);
    await getBank("k2");
    expect(headersOf(f, "wired-bank")["x-wired-pass"]).toBeUndefined();
  });
  it("never with the preview pass, and never to create-checkout", async () => {
    localStorage.setItem(PREVIEW_KEY, "PREVIEW");
    localStorage.setItem(PILOT_KEY, "PILOTPASS");
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);
    await getBank("k2");
    expect(headersOf(f, "wired-bank")["x-wired-preview"]).toBe("PREVIEW");
    expect(headersOf(f, "wired-bank")["x-wired-pass"]).toBeUndefined();
    localStorage.removeItem(PREVIEW_KEY);
    const g = mockFetch({});
    vi.stubGlobal("fetch", g);
    await startWiredCheckout({ token: "T", product: "blueprint" });
    expect(headersOf(g, "create-checkout")["x-wired-pass"]).toBeUndefined();
  });
});

describe("WiredResults for a tester (buy_closed)", () => {
  it("shows her results with no Blueprint or Family Map box and no buy button", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { first_name: "Sarah", children: [unlockedChild], buy_closed: true } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    const { container } = render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("How God wired Lily")).toBeTruthy());
    expect(screen.queryByText("Get Lily's Blueprint ($19)")).toBeNull();
    expect(container.querySelector('[data-offer="blueprint"]')).toBeNull();
    expect(container.querySelector('[data-offer="family_map"]')).toBeNull();
    expect(screen.queryByText(/\$47|\$28/)).toBeNull();
  });
  it("the same page for everyone else still shows the offers", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    const { container } = render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Get Lily's Blueprint ($19)")).toBeTruthy());
    expect(container.querySelector('[data-offer="blueprint"]')).toBeTruthy();
    expect(container.querySelector('[data-offer="family_map"]')).toBeTruthy();
  });
  it("a locked 3rd child keeps the approved line but loses the unlock buttons", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { buy_closed: true, children: [{ child_id: "c3", nickname: "Ana", grade: 7, unlocked: false, preview: { top_wiring: "seeker" }, offers: { blueprint: true, family_map: true } }] } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText(/Ana's top wiring is Seeker\./)).toBeTruthy());
    expect(screen.queryByText("Unlock with a Blueprint ($19)")).toBeNull();
    expect(screen.queryByText("Unlock with the Family Map ($47)")).toBeNull();
  });
});
