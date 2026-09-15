// /guide/:slug access paths (2026-09-15): emailed ?access token, the
// "Send me my guide link" form, and that the form is hidden while the guide shows.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/components/landing/Navbar", () => ({ default: () => null }));
vi.mock("@/components/guide/GuideTemplate", () => ({
  default: ({ guide }: { guide: { nickname: string } }) => <div>GUIDE:{guide.nickname}</div>,
}));
vi.mock("@/lib/checkoutSession", () => ({ readCheckoutSessionId: () => null }));

import GuideLanding from "@/pages/GuideLanding";
import { GUIDE_ACCESS_STORAGE_KEY, guideSessionKey } from "@/lib/guideAccess";

const FORM_LABEL = "Already bought your guide? Enter your email and we will send you a link.";
const SENT = "If that email bought this guide, a link is on its way. Check your inbox in a minute or two.";

function renderAt(path = "/guide/frozen-knot") {
  window.history.replaceState(null, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/guide/:constitutionSlug" element={<GuideLanding />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  delete (window as unknown as { __edenGuideAccess?: unknown }).__edenGuideAccess;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GuideLanding access", () => {
  it("a visitor with no purchase sees the email form and gets the generic message", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    renderAt();
    expect(await screen.findByText(FORM_LABEL)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(FORM_LABEL), { target: { value: "buyer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me my guide link" }));

    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("guide-access-link", {
      body: { email: "buyer@example.com", slug: "frozen-knot" },
    });
  });

  it("an emailed access token renders the guide and hides the form", async () => {
    sessionStorage.setItem(GUIDE_ACCESS_STORAGE_KEY, JSON.stringify({ token: "tok.sig", path: "/guide/frozen-knot" }));
    invoke.mockResolvedValue({
      data: { ok: true, slug: "frozen-knot", guide: { nickname: "The Frozen Knot" } },
      error: null,
    });
    renderAt();
    expect(await screen.findByText("GUIDE:The Frozen Knot")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("guide-access-link", { body: { token: "tok.sig" } });
    expect(screen.queryByText(FORM_LABEL)).not.toBeInTheDocument();
  });

  it("a token still in the URL is read and then stripped", async () => {
    invoke.mockResolvedValue({
      data: { ok: true, slug: "frozen-knot", guide: { nickname: "The Frozen Knot" } },
      error: null,
    });
    renderAt("/guide/frozen-knot?access=tok.sig");
    expect(await screen.findByText("GUIDE:The Frozen Knot")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("guide-access-link", { body: { token: "tok.sig" } });
    // A valid token stays usable for a reload in this tab, but not in the address bar.
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("an expired token is forgotten and the form shows", async () => {
    sessionStorage.setItem(GUIDE_ACCESS_STORAGE_KEY, JSON.stringify({ token: "old.sig", path: "/guide/frozen-knot" }));
    invoke.mockResolvedValue({ data: { ok: false }, error: null });
    renderAt();
    expect(await screen.findByText(FORM_LABEL)).toBeInTheDocument();
    expect(sessionStorage.getItem(GUIDE_ACCESS_STORAGE_KEY)).toBeNull();
  });

  it("a remembered checkout session older than 90 days is not re-verified", async () => {
    localStorage.setItem(
      guideSessionKey("frozen-knot"),
      JSON.stringify({ sessionId: "cs_live_old", savedAt: Date.now() - 91 * 24 * 60 * 60 * 1000 }),
    );
    renderAt();
    expect(await screen.findByText(FORM_LABEL)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("a remembered checkout session within 90 days still opens the guide", async () => {
    saveSession();
    invoke.mockResolvedValue({ data: { paid: true, guide: { nickname: "The Frozen Knot" } }, error: null });
    renderAt();
    expect(await screen.findByText("GUIDE:The Frozen Knot")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("verify-session", { body: { session_id: "cs_live_recent" } });
  });
});

function saveSession() {
  localStorage.setItem(
    guideSessionKey("frozen-knot"),
    JSON.stringify({ sessionId: "cs_live_recent", savedAt: Date.now() - 24 * 60 * 60 * 1000 }),
  );
}
