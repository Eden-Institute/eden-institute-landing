// The July yearly-retest link (/wired/retake?r=, spec 7.5): the link leaves the address bar at once, the child
// step opens with the nickname (fixed) and the assumed grade (changeable), and the submit carries the child id.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredQuiz from "../../web/components/islands/WiredQuiz";
import { NOT_OPEN } from "../../web/components/islands/WiredNotOpen";
import { SCREENS } from "../../web/lib/wiredCopy";

const KID = "22222222-2222-2222-2222-222222222222";
const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("July retake link", () => {
  it("strips ?r= before anything else, resolves it, and fills in the child and grade", async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => ok(String(url).includes("wired-retake") ? { status: "ok", child_id: KID, nickname: "Lily", grade: 3, email: "mom@example.com" } : {}));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/wired/retake?r=abc.def&utm_source=email");
    render(<WiredQuiz retake />);
    expect(window.location.search).not.toContain("r=");
    expect(window.location.search).toContain("utm_source=email");
    fireEvent.click(await screen.findByText(SCREENS.welcomeButton));
    const nick = screen.getByLabelText(SCREENS.nicknameLabel) as HTMLInputElement;
    expect(nick.value).toBe("Lily");
    expect(nick.readOnly).toBe(true);
    const grade = screen.getByLabelText(SCREENS.gradeLabel) as HTMLSelectElement;
    expect(grade.value).toBe("3");
    expect(grade.disabled).toBe(false);
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("wired-retake"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({ r: "abc.def" });
  });

  it("an expired or used link gives the plain quiz (nothing filled in)", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => ok(String(url).includes("wired-retake") ? { error: "invalid_or_expired_link" } : {}, String(url).includes("wired-retake") ? 401 : 200)));
    window.history.replaceState(null, "", "/wired/retake?r=old.link");
    render(<WiredQuiz retake />);
    fireEvent.click(await screen.findByText(SCREENS.welcomeButton));
    const nick = screen.getByLabelText(SCREENS.nicknameLabel) as HTMLInputElement;
    expect(nick.value).toBe("");
    expect(nick.readOnly).toBe(false);
  });

  it("dark: not open yet", async () => {
    vi.stubGlobal("fetch", vi.fn(() => ok({ error: "not_found" }, 404)));
    window.history.replaceState(null, "", "/wired/retake?r=abc.def");
    render(<WiredQuiz retake />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
  });

  it("plain /wired never reads ?r=", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => ok({}));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/wired?r=abc.def");
    render(<WiredQuiz />);
    await screen.findByText(SCREENS.welcomeButton);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("wired-retake"))).toBe(false);
  });
});
