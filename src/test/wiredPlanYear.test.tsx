// 2026-11-22 (Camila's tap "Use as written"): the child step's "Which school year are you choosing curriculum for?",
// right under the grade, with exactly the approved words (docs/wired-copy/Wired_Quiz_Family_Map_And_Screens.md,
// "Tell us about your child"). A choice goes to wired-submit as family_answers.plan_year ('this' | 'next'); skipping
// sends nothing (= this school year). The grade (and so the question set) is unchanged.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredQuiz from "../../web/components/islands/WiredQuiz";
import { FAMILY_QUESTIONS, RANKING, RESULTS, SCREENS } from "../../web/lib/wiredCopy";

const QUESTION = "Which school year are you choosing curriculum for?";
const BANK = {
  version: "g35-v1", instructions: "Pick the one that sounds most like your child.", frequency_stem: "How often does your child...",
  scale: { points: 5, labels: ["Never", "Rarely", "Sometimes", "Often", "Always"] },
  scenarios: [{ id: "g35-s01", prompt: "On a free afternoon...", options: [{ id: "g35-s01-a", text: "Builds something" }, { id: "g35-s01-b", text: "Reads" }] }],
  frequency: [{ id: "g35-f01", text: "ask why" }],
};

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
function stubServer() {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (String(url).includes("wired-bank")) return ok(BANK);
    // 502 = "saved, results by email later": the island stays on the page, so the test can read the body it sent.
    if (String(url).includes("wired-submit")) return ok({ error: "queued" }, 502);
    return ok({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/wired"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openChildStep() {
  render(<WiredQuiz />);
  fireEvent.click(await screen.findByText(SCREENS.welcomeButton));
  expect(screen.getByText(SCREENS.childHeading)).toBeTruthy();
}

/** Nickname + grade 5, the optional school-year choice, then every step to the email, and submit. Returns the body sent. */
async function finishQuiz(fetchMock: ReturnType<typeof stubServer>, pick: string | null) {
  await openChildStep();
  fireEvent.change(screen.getByLabelText(SCREENS.nicknameLabel), { target: { value: "Lily" } });
  fireEvent.change(screen.getByLabelText(SCREENS.gradeLabel), { target: { value: "5" } });
  if (pick) fireEvent.click(screen.getByRole("radio", { name: pick }));
  fireEvent.click(screen.getByRole("button", { name: SCREENS.next }));
  fireEvent.click(await screen.findByRole("button", { name: "Builds something" }));
  fireEvent.click(await screen.findByRole("button", { name: "Often" }));
  for (const q of FAMILY_QUESTIONS) {
    await screen.findByText(q.question);
    fireEvent.click(screen.getByRole("button", { name: q.options[1]?.[1] ?? q.options[0][1] }));
  }
  fireEvent.click(await screen.findByText(RANKING.skip));
  fireEvent.change(await screen.findByLabelText(RESULTS.emailLabel), { target: { value: "mom@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: RESULTS.emailButton }));
  await screen.findByText(RESULTS.savingFailed);
  const call = fetchMock.mock.calls.find(([u]) => String(u).includes("wired-submit"));
  expect(call).toBeTruthy();
  return JSON.parse(String((call![1] as RequestInit).body));
}

describe("Wired child step: which school year", () => {
  it("the approved words, right under the grade: the question and its two answers, no helper line, nothing chosen", async () => {
    stubServer();
    await openChildStep();
    expect(SCREENS.planYearQuestion).toBe(QUESTION);
    expect([SCREENS.planYearThis, SCREENS.planYearNext]).toEqual(["This school year", "Next school year"]);
    const group = screen.getByRole("group", { name: QUESTION });
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual(["This school year", "Next school year"]);
    expect(radios.every((r) => !r.checked)).toBe(true);
    // only the approved words inside the group (the question + the two answers), nothing else
    expect(group.textContent).toBe(QUESTION + "This school year" + "Next school year");
    // order on the page: grade, then this question, then the Next button
    const grade = screen.getByLabelText(SCREENS.gradeLabel);
    const next = screen.getByRole("button", { name: SCREENS.next });
    expect(grade.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // a tap selects one, a tap on the other moves the choice
    fireEvent.click(screen.getByRole("radio", { name: "Next school year" }));
    expect(radios.map((r) => r.checked)).toEqual([false, true]);
    fireEvent.click(screen.getByRole("radio", { name: "This school year" }));
    expect(radios.map((r) => r.checked)).toEqual([true, false]);
  });

  it("Next school year: the submit carries family_answers.plan_year = 'next'; the grade (and question set) stay as entered", async () => {
    const fetchMock = stubServer();
    const body = await finishQuiz(fetchMock, "Next school year");
    expect(body.family_answers.plan_year).toBe("next");
    expect(body.child).toEqual({ nickname: "Lily", grade: 5 });
    expect(body.bank_version).toBe("g35-v1");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("wired-bank?set=g3_5"))).toBe(true);
    // her six family answers are all still there alongside it
    for (const q of FAMILY_QUESTIONS) expect(typeof body.family_answers[q.key]).toBe("string");
  });

  it("This school year: plan_year = 'this'", async () => {
    const fetchMock = stubServer();
    const body = await finishQuiz(fetchMock, "This school year");
    expect(body.family_answers.plan_year).toBe("this");
  });

  it("the July retake link's child step asks it too, under the filled-in grade, with nothing chosen for her", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => ok(String(url).includes("wired-retake")
      ? { status: "ok", child_id: "22222222-2222-2222-2222-222222222222", nickname: "Lily", grade: 6, email: "mom@example.com" } : BANK)));
    window.history.replaceState(null, "", "/wired/retake?r=abc.def");
    render(<WiredQuiz retake />);
    fireEvent.click(await screen.findByText(SCREENS.welcomeButton));
    expect((screen.getByLabelText(SCREENS.gradeLabel) as HTMLSelectElement).value).toBe("6");
    screen.getByRole("group", { name: QUESTION });
    expect((screen.getAllByRole("radio") as HTMLInputElement[]).every((r) => !r.checked)).toBe(true);
  });

  it("skipped: nothing is sent for it (the server reads that as this school year), and the quiz goes on as before", async () => {
    const fetchMock = stubServer();
    const body = await finishQuiz(fetchMock, null);
    expect("plan_year" in body.family_answers).toBe(false);
    expect(Object.keys(body.family_answers).sort()).toEqual(FAMILY_QUESTIONS.map((q) => q.key).sort());
    expect(body.child).toEqual({ nickname: "Lily", grade: 5 });
  });
});
