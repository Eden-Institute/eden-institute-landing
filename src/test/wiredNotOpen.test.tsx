// While the quiz is dark (every wired-* function answers 404 not_found), each /wired page says
// "This page isn't open yet." instead of a form, an error or a "no results" line (Camila 2026-11-20).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredResults from "../../web/components/islands/WiredResults";
import WiredRater from "../../web/components/islands/WiredRater";
import WiredDelete from "../../web/components/islands/WiredDelete";
import WiredPilot from "../../web/components/islands/WiredPilot";
import WiredQuiz from "../../web/components/islands/WiredQuiz";
import { NOT_OPEN } from "../../web/components/islands/WiredNotOpen";

const dark = () => vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: "not_found" }), { status: 404 })));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", dark());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("dark quiz: every page says it is not open yet", () => {
  it("results with no results on this device", async () => {
    window.history.replaceState(null, "", "/wired/results");
    render(<WiredResults />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
  });
  it("results from an email link", async () => {
    window.history.replaceState(null, "", "/wired/results?t=abc.def");
    render(<WiredResults />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
  });
  it("teen page with no link code", async () => {
    window.history.replaceState(null, "", "/wired/teen");
    render(<WiredRater kind="teen" />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
  });
  it("observer page from an invite link", async () => {
    window.history.replaceState(null, "", "/wired/observer?c=abcdefghijabcdefghijabcdefghijabcdefghijabc");
    render(<WiredRater kind="observer" />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
  });
  it("delete page: no form while dark", async () => {
    window.history.replaceState(null, "", "/wired/delete");
    render(<WiredDelete />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
    expect(screen.queryByText("Email me the confirm link")).toBeNull();
  });
  it("pilot page and the quiz", async () => {
    window.history.replaceState(null, "", "/wired/pilot");
    render(<WiredPilot />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
    cleanup();
    window.history.replaceState(null, "", "/wired");
    render(<WiredQuiz />);
    expect(await screen.findByText(NOT_OPEN)).toBeTruthy();
  });
});
