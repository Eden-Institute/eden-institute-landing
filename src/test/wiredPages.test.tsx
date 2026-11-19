// Wired quiz W4: the results and quiz islands, rendered against a mocked server.
//   1. Results: the approved words render with the child's nickname; the tip her frustration picked
//      comes first; Seeker carries its note; the Family Map shows for 2+ kids; a token in the address
//      bar is moved to storage and stripped (answer 12); a locked 3rd child sees only the top wiring.
//   2. Quiz: dark (the functions answer 404 not_found) shows a plain line, never the questions.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredResults, { reasonLines } from "../../web/components/islands/WiredResults";
import WiredQuiz from "../../web/components/islands/WiredQuiz";
import { RESULTS_KEY } from "../../web/lib/wiredApi";

const scores = { storyteller: 40, organizer: 30, designer: 85, maker: 90, psalmist: 20, connector: 50, ponderer: 10, cultivator: 70, seeker: 5 };
const unlockedChild = {
  child_id: "c1", nickname: "Lily", grade: 2, unlocked: true, scores, top3: ["maker", "designer", "cultivator"], renaissance: false,
  tip_first: "low_prep", approach: { fits: [{ approach: "unit_study", room_for: ["maker", "designer"] }], already_there: false, her_approach: "charlotte_mason" },
  matches: [], coming_soon: [{ name: "Eden's Table 6-8", eden_band: "6-8 set" }], offers: { blueprint: true, family_map: true },
};

function mockFetch(routes: Record<string, { status: number; body: unknown }>) {
  return vi.fn((url: string) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    const r = hit ? hit[1] : { status: 500, body: {} };
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/wired/results");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WiredResults", () => {
  it("renders the approved results for an unlocked child and strips ?t= from the address bar", async () => {
    window.history.replaceState(null, "", "/wired/results?t=TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { first_name: "Sarah", children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("How God wired Lily")).toBeTruthy());
    expect(window.location.search).toBe("");
    expect(localStorage.getItem(RESULTS_KEY)).toBe("TOKEN123");
    expect(screen.getByText("Lily's top 3 wirings")).toBeTruthy();
    expect(screen.getByText(/Your child thinks with their hands/)).toBeTruthy(); // Maker short write-up
    // tips: low prep first because her frustration was time/budget
    const labels = screen.getAllByText(/^(Try today|Low prep or free|Together, or choosing curriculum):$/).map((n) => n.textContent);
    expect(labels).toEqual(["Low prep or free:", "Try today:", "Together, or choosing curriculum:"]);
    expect(screen.getByText(/Unit study: One theme ties many subjects together/)).toBeTruthy();
    expect(screen.getByText(/Worth a look alongside what you do now/)).toBeTruthy();
    expect(screen.getByText(/Seeker is the most debated of the nine/)).toBeTruthy();
    expect(screen.getByText(/Teaching more than one\?/)).toBeTruthy();
    expect(screen.getByText(/Eden's Table for grades 6-8 is on the way/)).toBeTruthy();
    expect(screen.getByText("What this quiz is, and isn't")).toBeTruthy();
    expect(screen.getByText("Your 2nd child's results are free too.")).toBeTruthy();
    expect(screen.getByText(/Talk with Lily's doctor/)).toBeTruthy();
  });

  it("a locked 3rd child sees only the top wiring and the unlock offers", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [{ child_id: "c3", nickname: "Ana", grade: 7, unlocked: false, preview: { top_wiring: "seeker" }, offers: { blueprint: true, family_map: true } }] } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText(/Ana's top wiring is Seeker\./)).toBeTruthy());
    expect(screen.queryByText("All 9 wirings")).toBeNull();
    expect(screen.getByText("Unlock with a Blueprint ($19)")).toBeTruthy();
  });

  it("with no token on this device it says so, and never calls the server", async () => {
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText(/couldn't find quiz results on this device/)).toBeTruthy());
    expect(f).not.toHaveBeenCalled();
  });

  it("reason lines use the approved wording", () => {
    const m = { id: "x", name: "X", because: ["wiring", "budget", "siblings", "esa"], served_top3: ["designer", "maker"] as never, components: { budget: 0.5 }, esa_state: "TN" };
    expect(reasonLines(m, "Lily", ["maker", "designer", "cultivator"])).toEqual([
      "Serves 2 of Lily's top 3: Maker and Designer", "A little over your budget", "Works for several ages together", "ESA-eligible in TN",
    ]);
  });
});

describe("WiredQuiz", () => {
  it("dark: a visitor sees one plain line straight away, never the welcome or the questions", async () => {
    vi.stubGlobal("fetch", mockFetch({ "wired-bank": { status: 404, body: { error: "not_found" } } }));
    render(<WiredQuiz />);
    await waitFor(() => expect(screen.getByText("This page isn't open yet.")).toBeTruthy());
    expect(screen.queryByText("Start the quiz")).toBeNull();
  });

  it("open (or preview): the approved welcome, then the child step", async () => {
    const bank = { version: "k2-v1", instructions: "i", frequency_stem: "f", scale: { points: 5, labels: ["1", "2", "3", "4", "5"] }, scenarios: [], frequency: [] };
    vi.stubGlobal("fetch", mockFetch({ "wired-bank": { status: 200, body: bank } }));
    render(<WiredQuiz />);
    await waitFor(() => expect(screen.getByText("Fearfully & Wonderfully Wired")).toBeTruthy());
    expect(screen.getByText(/Psalm 139:14/)).toBeTruthy();
    fireEvent.click(screen.getByText("Start the quiz"));
    expect(screen.getByText("Tell us about your child")).toBeTruthy();
    expect(screen.getByLabelText(/^Nickname/)).toBeTruthy();
  });
});
