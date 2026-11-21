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

  it("W6: the Blueprint button offers the $28 upgrade, and each choice asks create-checkout for the right cart", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, href: window.location.href, assign });
    const fetchMock = mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      "create-checkout": { status: 200, body: { url: "https://checkout.stripe.com/c/pay/x" } },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Get Lily's Blueprint ($19)")).toBeTruthy());
    fireEvent.click(screen.getByText("Get Lily's Blueprint ($19)"));
    expect(screen.getByText("Teaching more than one? Upgrade to the Family Map for $28 more.")).toBeTruthy();
    fireEvent.click(screen.getByText("Just Lily's Blueprint ($19)"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/x"));
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("create-checkout"))!;
    expect(JSON.parse(((call as unknown as [string, RequestInit])[1]).body as string)).toEqual({ lookup_key: "wired_cart", token: "TOKEN123", product: "blueprint", child_ids: ["c1"] });
  });

  it("W6: a refused checkout shows the server's sentence and re-enables the buttons", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      "create-checkout": { status: 409, body: { error: "You already have the Family Map this school year.", code: "WIRED_ALREADY_OWNED" } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Get the Family Map ($47 for up to 5 kids)")).toBeTruthy());
    fireEvent.click(screen.getByText("Get the Family Map ($47 for up to 5 kids)"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("You already have the Family Map this school year."));
    expect((screen.getByText("Get the Family Map ($47 for up to 5 kids)") as HTMLButtonElement).disabled).toBe(false);
  });

  it("W6: back from Stripe, ?paid= is stripped and the thank-you line shows", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    window.history.replaceState(null, "", "/wired/results?paid=cs_live_123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/^Thank you! Lily's full results are open below/));
    expect(window.location.search).toBe("");
  });

  it("with no token on this device (quiz open) it says so; only the open/dark check is made, never a results call", async () => {
    const f = mockFetch({ "wired-bank": { status: 200, body: { version: "k2-v1" } } });
    vi.stubGlobal("fetch", f);
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText(/couldn't find quiz results on this device/)).toBeTruthy());
    expect(f.mock.calls.every(([u]) => String(u).includes("wired-bank"))).toBe(true);
  });

  it("reason lines use the approved wording", () => {
    const m = { id: "x", name: "X", because: ["wiring", "budget", "siblings", "esa"], served_top3: ["designer", "maker"] as never, components: { budget: 0.5 }, esa_state: "TN" };
    expect(reasonLines(m, "Lily", ["maker", "designer", "cultivator"])).toEqual([
      "Serves 2 of Lily's top 3: Maker and Designer", "A little over your budget", "Works for several ages together", "ESA-eligible in TN",
    ]);
  });
});

describe("WiredResults, 2026-11-21: links, reasons, Helpful extras, the $28 upgrade", () => {
  const alpha = {
    id: "m1", name: "Alpha Math", because: ["wiring", "prep"], served_top3: ["maker", "designer"], components: { prep: 1, budget: 1 },
    prep_load: "open_and_go", price_cents: 20000, price_basis: "Per family per year", url: "https://aff.example/alpha?ref=eden", is_affiliate: true,
  };
  const beta = {
    id: "m2", name: "Beta Reading", because: ["budget", "prep"], served_top3: ["maker"], components: { budget: 1, prep: 0.5 },
    prep_load: "light", price_cents: 0, price_basis: "Free", url: "https://beta.example/", is_affiliate: false,
  };
  const extras = [
    { id: "x1", name: "Seeds Family Worship", resource_type: "Songs", screen_based: false, url: "https://seeds.example/", is_affiliate: false },
    { id: "x2", name: "Starfall", resource_type: "App", screen_based: true, url: "https://starfall.example/", is_affiliate: false },
  ];

  it("each match name links to its curriculum; the commission label sits next to affiliate links only; two reasons with prep and Free", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [alpha, beta], budget_filter_offered: true, extras: [] } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Alpha Math")).toBeTruthy());
    const a = screen.getByText("Alpha Math").closest("a")!;
    expect(a.getAttribute("href")).toBe("https://aff.example/alpha?ref=eden");
    expect(a.getAttribute("rel")).toBe("sponsored noopener");
    const b = screen.getByText("Beta Reading").closest("a")!;
    expect(b.getAttribute("href")).toBe("https://beta.example/");
    expect(b.getAttribute("rel")).toBe("noopener");
    expect(screen.getAllByText("Eden earns a commission")).toHaveLength(1);
    expect(a.parentElement!.textContent).toContain("Eden earns a commission");
    expect(screen.getByText("Some of these links pay Eden a commission if you buy. That never changes which curricula show up or the order they're in.")).toBeTruthy();
    expect(screen.getByText("Serves 2 of Lily's top 3: Maker and Designer · Open-and-go: about 10 minutes of prep a day")).toBeTruthy();
    expect(screen.getByText("Free · Light prep: about 10 to 20 minutes a day (a little more prep than you said you have)")).toBeTruthy();
  });

  it("Helpful extras: the approved heading and line, each with its type label and Screen-based, never numbered", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [alpha], budget_filter_offered: true, extras } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Helpful extras")).toBeTruthy());
    expect(screen.getByText("Apps, videos, songs and books that can sit alongside a curriculum. Not a full curriculum on their own.")).toBeTruthy();
    expect(screen.getByText("Songs")).toBeTruthy();
    expect(screen.getByText("App · Screen-based")).toBeTruthy();
    const item = screen.getByText("Starfall").closest("li")!;
    expect(item.parentElement!.tagName).toBe("UL");
    expect(screen.getByText("Starfall").closest("a")!.getAttribute("href")).toBe("https://starfall.example/");
  });

  it("Helpful extras from wired-results show before (or without) a live re-rank; none = no section", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({ "wired-results": { status: 200, body: { children: [{ ...unlockedChild, extras }] } } }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Seeds Family Worship")).toBeTruthy());
    cleanup();
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild] } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true, extras: [] } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("How God wired Lily")).toBeTruthy());
    expect(screen.queryByText("Helpful extras")).toBeNull();
  });

  it("the later $28 upgrade: a Blueprint this quiz year swaps the Family Map button and adds the line; it buys family_map_upgrade", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, href: window.location.href, assign });
    const fetchMock = mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild], family_map_upgrade: { blueprint_nickname: "Ben" } } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      "create-checkout": { status: 200, body: { url: "https://checkout.stripe.com/c/pay/u" } },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Upgrade to the Family Map ($28)")).toBeTruthy());
    expect(screen.getByText("You already have Ben's Blueprint, so the Family Map is $28 for you this school year.")).toBeTruthy();
    expect(screen.getByText("Because it's digital, all sales are final.")).toBeTruthy();
    expect(screen.getByText(/Teaching more than one\? The Family Learning Map includes/)).toBeTruthy();
    expect(screen.queryByText("Get the Family Map ($47 for up to 5 kids)")).toBeNull();
    fireEvent.click(screen.getByText("Upgrade to the Family Map ($28)"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/u"));
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("create-checkout"))!;
    expect(JSON.parse(((call as unknown as [string, RequestInit])[1]).body as string)).toEqual({ lookup_key: "wired_cart", token: "TOKEN123", product: "family_map_upgrade" });
  });

  it("no upgrade (null) keeps the $47 offer; a one-child family sees no Family Map box either way", async () => {
    localStorage.setItem(RESULTS_KEY, "TOKEN123");
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [unlockedChild], family_map_upgrade: null } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Get the Family Map ($47 for up to 5 kids)")).toBeTruthy());
    expect(screen.queryByText("Upgrade to the Family Map ($28)")).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": { status: 200, body: { children: [{ ...unlockedChild, offers: { blueprint: true, family_map: false } }], family_map_upgrade: { blueprint_nickname: "Lily" } } },
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("How God wired Lily")).toBeTruthy());
    expect(screen.queryByText("Upgrade to the Family Map ($28)")).toBeNull();
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
