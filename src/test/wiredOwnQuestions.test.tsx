// 2026-11-21 (Camila's tap "Build it, as written", relayed by Lane NP): the "Your own questions" box on
// /wired/results. It shows only for a Family Map family (paid or pilot) whose mom has not answered her own set
// (wired-results: has_family_map + own_questions_answered); its button runs the approved adult-v1 screens from the
// bank (Part A: 12 moments + 9 how-often; Part B: 12 teaching-style lines on 5 labelled points), sends them to
// wired-submit as {set: 'adult', token} (never an email), and then shows the approved done line.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredResults from "../../web/components/islands/WiredResults";
import { RESULTS_KEY } from "../../web/lib/wiredApi";
import { OWN_QUESTIONS } from "../../web/lib/wiredCopy";
import { publicBank, type Bank } from "../../supabase/functions/_shared/wired-engine";

const root = join(__dirname, "..", "..");
const ADULT = publicBank(JSON.parse(readFileSync(join(root, "supabase", "functions", "_shared", "wired-banks", "adult-v1.json"), "utf8")) as Bank, () => 0);
const scores = { storyteller: 40, organizer: 30, designer: 85, maker: 90, psalmist: 20, connector: 50, ponderer: 10, cultivator: 70, seeker: 5 };
const child = {
  child_id: "c1", nickname: "Lily", grade: 2, unlocked: true, scores, top3: ["maker", "designer", "cultivator"], renaissance: false,
  tip_first: "low_prep", matches: [], coming_soon: [], offers: { blueprint: true, family_map: true },
};

function mockFetch(routes: Record<string, { status: number; body: unknown } | (() => { status: number; body: unknown })>) {
  return vi.fn((url: string) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    const r = hit ? (typeof hit[1] === "function" ? hit[1]() : hit[1]) : { status: 500, body: {} };
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
}
const results = (extra: Record<string, unknown>) => ({ status: 200, body: { first_name: "Sarah", children: [child], family_map_upgrade: null, ...extra } });
const box = () => within(document.getElementById("own-questions")!);

/** Answer all 33: the first option of each moment, "Often" for each how-often item, "Somewhere in between" for Part B. */
function answerAll() {
  expect(box().getByText(ADULT.instructions)).toBeTruthy();
  for (const [k, s] of ADULT.scenarios.entries()) {
    expect(box().getByText(`${k + 1} of 33`)).toBeTruthy();
    expect(box().getByText(s.prompt)).toBeTruthy();
    fireEvent.click(box().getByText(s.options[0].text));
  }
  for (const f of ADULT.frequency) {
    expect(box().getByText(ADULT.frequency_stem)).toBeTruthy();
    expect(box().getByText(f.text)).toBeTruthy();
    fireEvent.click(box().getByText("Often"));
  }
  const ts = ADULT.teaching_style!;
  expect(box().getByText(ts.instructions)).toBeTruthy();
  for (const [k, t] of ts.items.entries()) {
    expect(box().getByText(`${ADULT.scenarios.length + ADULT.frequency.length + k + 1} of 33`)).toBeTruthy();
    expect(box().getByText(t.stem)).toBeTruthy();
    expect(box().getByText(t.left)).toBeTruthy();
    expect(box().getByText(t.right)).toBeTruthy();
    for (const label of ts.scale.labels) expect(box().getByText(label)).toBeTruthy();
    fireEvent.click(box().getByText("Somewhere in between"));
  }
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(RESULTS_KEY, "TOKEN123");
  window.history.replaceState(null, "", "/wired/results");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the 'Your own questions' box", () => {
  it("the box copy is the approved screens copy and the screens' text (the adult-v1 bank) is the approved Mom Set, word for word", () => {
    const screens = readFileSync(join(root, "docs", "wired-copy", "Wired_Quiz_Family_Map_And_Screens.md"), "utf8").replace(/\s+/g, " ");
    expect(screens).toContain(`Heading: ${OWN_QUESTIONS.heading}`);
    expect(screens).toContain(`Line: ${OWN_QUESTIONS.line}`);
    expect(screens).toContain(`Button: ${OWN_QUESTIONS.button}`);
    expect(screens).toContain(`When she finishes: ${OWN_QUESTIONS.done}`);
    const mom = readFileSync(join(root, "docs", "wired-copy", "Wired_Quiz_Mom_Set.md"), "utf8").replace(/\s+/g, " ");
    const ts = ADULT.teaching_style!;
    const shown = [
      ADULT.instructions, ADULT.frequency_stem, ...ADULT.scale.labels,
      ...ADULT.scenarios.flatMap((s) => [s.prompt, ...s.options.map((o) => o.text)]), ...ADULT.frequency.map((f) => f.text),
      ts.instructions, ...ts.scale.labels, ...ts.items.flatMap((t) => [t.stem, t.left, t.right]),
    ];
    expect(shown).toHaveLength(106);
    expect(shown.filter((s) => !mom.includes(s))).toEqual([]);
    // 33 = 12 moments + 9 how-often items + 12 teaching-style lines, as the approved line says.
    expect(ADULT.scenarios.length + ADULT.frequency.length + ts.items.length).toBe(33);
  });

  it("shows the approved heading, line and button for a Family Map family whose mom has not answered", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "wired-results": results({ has_family_map: true, own_questions_answered: false }),
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
    }));
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Your own questions")).toBeTruthy());
    expect(screen.getByText("Your Family Map includes pages about you: your own wiring and how you like to teach. Answer 33 quick questions about yourself (about 8 minutes) and we'll email you the complete map.")).toBeTruthy();
    expect(box().getByRole("button", { name: "Answer my questions" })).toBeTruthy();
  });

  it("is hidden once she has answered, and for a family without a Family Map (or an older server with neither field)", async () => {
    for (const extra of [{ has_family_map: true, own_questions_answered: true }, { has_family_map: false, own_questions_answered: false }, {}]) {
      vi.stubGlobal("fetch", mockFetch({
        "wired-results": results(extra),
        "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      }));
      render(<WiredResults />);
      await waitFor(() => expect(screen.getByText("How God wired Lily")).toBeTruthy());
      expect(screen.queryByText(OWN_QUESTIONS.heading)).toBeNull();
      expect(document.getElementById("own-questions")).toBeNull();
      cleanup();
    }
  });

  it("runs the 33 approved adult-v1 screens, submits {set:'adult', token} with no email, then the approved done line", async () => {
    const fetchMock = mockFetch({
      "wired-results": results({ has_family_map: true, own_questions_answered: false }),
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      "wired-bank": { status: 200, body: ADULT },
      "wired-submit": { status: 200, body: { status: "ok", child_id: null, token: "NEW", results: null } },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Your own questions")).toBeTruthy());
    fireEvent.click(box().getByRole("button", { name: "Answer my questions" }));
    await waitFor(() => expect(box().getByText(ADULT.scenarios[0].prompt)).toBeTruthy());
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("wired-bank?set=adult"))).toBe(true);
    answerAll();
    await waitFor(() => expect(screen.getByText("Thank you! Your complete Family Map is on its way to your inbox.")).toBeTruthy());
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("wired-submit"))!;
    const sent = JSON.parse(((call as unknown as [string, RequestInit])[1]).body as string);
    expect(Object.keys(sent).sort()).toEqual(["answers", "bank_version", "set", "token"]);
    expect(sent.set).toBe("adult");
    expect(sent.token).toBe("TOKEN123");
    expect(sent.bank_version).toBe("adult-v1");
    expect(Object.keys(sent.answers.scenarios)).toHaveLength(12);
    expect(Object.values(sent.answers.frequency)).toEqual(Array(9).fill(3));
    expect(sent.answers.teaching).toEqual(Object.fromEntries(ADULT.teaching_style!.items.map((t) => [t.id, 3])));
    expect(sent.answers.scenarios[ADULT.scenarios[0].id]).toBe(ADULT.scenarios[0].options[0].id);
    // The box keeps the done line; the questions are gone.
    expect(box().queryByRole("button", { name: "Answer my questions" })).toBeNull();
  });

  it("a failed save says so and keeps her answers; pressing again sends them again", async () => {
    let n = 0;
    const fetchMock = mockFetch({
      "wired-results": results({ has_family_map: true, own_questions_answered: false }),
      "wired-matches": { status: 200, body: { matches: [], budget_filter_offered: true } },
      "wired-bank": { status: 200, body: ADULT },
      "wired-submit": () => (++n === 1 ? { status: 500, body: { error: "could_not_save" } } : { status: 409, body: { status: "already_completed" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<WiredResults />);
    await waitFor(() => expect(screen.getByText("Your own questions")).toBeTruthy());
    fireEvent.click(box().getByRole("button", { name: "Answer my questions" }));
    await waitFor(() => expect(box().getByText(ADULT.scenarios[0].prompt)).toBeTruthy());
    answerAll();
    await waitFor(() => expect(box().getByRole("alert").textContent).toBe("Something went wrong. Please try again in a minute."));
    expect(screen.queryByText(OWN_QUESTIONS.done)).toBeNull();
    fireEvent.click(box().getByText("Somewhere in between"));
    await waitFor(() => expect(screen.getByText(OWN_QUESTIONS.done)).toBeTruthy());
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("wired-submit"))).toHaveLength(2);
  });
});
