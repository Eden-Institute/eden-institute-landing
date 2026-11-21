// /wired/pilot advance chapters: the chapter email's ?t= is kept and stripped, a button shows per ready chapter,
// and each tap asks wired-pilot for a fresh link (private storage), opened in the tab made inside the tap.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trackCta", () => ({ trackCta: vi.fn() }));

import WiredPilot from "../../web/components/islands/WiredPilot";
import { CHAPTERS_COPY } from "../../web/lib/wiredPilotCopy";
import { savedResultsToken } from "../../web/lib/wiredApi";

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("pilot chapters", () => {
  it("shows the Chapter 1 button and opens a fresh signed link", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      const b = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (String(url).includes("wired-pilot")) {
        bodies.push(b);
        if (b.action === "status") return ok({ selected: true, child: { id: "c1", nickname: "Lily", grade: 2 }, chapters: [1], next: "retake", opens_at: "2027-04-01T00:00:00Z", retake_needed: true });
        if (b.action === "chapter") return ok({ url: "https://db/storage/v1/object/sign/pilot-chapters/chapter-1.pdf?token=x" });
      }
      return ok({ children: [] });
    }));
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    window.history.replaceState(null, "", "/wired/pilot?t=fam.token&utm_source=email");
    render(<WiredPilot />);
    expect(window.location.search).not.toContain("t=fam");
    expect(savedResultsToken()).toBe("fam.token");
    fireEvent.click(await screen.findByText(CHAPTERS_COPY.button[1]));
    await waitFor(() => expect(tab.location.href).toContain("chapter-1.pdf"));
    expect(bodies.find((b) => b.action === "chapter")).toEqual({ action: "chapter", token: "fam.token", n: 1 });
    expect(screen.queryByText(CHAPTERS_COPY.button[4])).toBeNull();
  });

  it("no chapter section before step 3", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      const b = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (String(url).includes("wired-pilot") && b.action === "status") return ok({ selected: true, child: { id: "c1", nickname: "Lily", grade: 2 }, chapters: [], next: "family_map", opens_at: "2027-04-01T00:00:00Z" });
      return ok({ children: [] });
    }));
    localStorage.setItem("eden_wired_results", "fam.token");
    window.history.replaceState(null, "", "/wired/pilot");
    render(<WiredPilot />);
    await screen.findByText(/Your next step opens on/);
    expect(screen.queryByText(CHAPTERS_COPY.heading)).toBeNull();
  });
});
