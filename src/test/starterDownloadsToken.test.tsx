// /starter/downloads reads its download token with readUrlToken("t"), because the
// first head script moves ?t= out of the address bar before Pinterest and GA run.
// These tests pin that the island still fetches with the token after the strip,
// on a return to the clean URL, and that the "incomplete link" state still shows
// when there is truly no token.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import StarterDownloads from "../../web/components/islands/StarterDownloads";
import { CHECKOUT_SESSION_STRIP_JS } from "@/lib/checkoutSession";

const TOKEN = "fedcba9876543210fedcba9876543210";

function go(url: string) {
  window.history.replaceState(null, "", url);
}
function runStrip() {
  new Function(CHECKOUT_SESSION_STRIP_JS)();
}

describe("StarterDownloads token mode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete (window as unknown as { __edenUrlTokens?: unknown }).__edenUrlTokens;
    fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          expires_at: "2026-09-20T00:00:00Z",
          download_token: TOKEN,
          files: [{ slug: "teachers-guide", label: "Teacher's Guide", url: "https://example.test/tg.pdf" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    delete (window as unknown as { __edenUrlTokens?: unknown }).__edenUrlTokens;
    go("/");
  });

  function calledWith(): string {
    expect(fetchMock).toHaveBeenCalled();
    return String(fetchMock.mock.calls[0][0]);
  }

  it("fetches with the token after the strip has cleaned the URL", async () => {
    go(`/starter/downloads?t=${TOKEN}&utm_source=email#x`);
    runStrip();
    expect(window.location.search).toBe("?utm_source=email");
    render(<StarterDownloads mode="token" />);
    expect(await screen.findByText("Teacher's Guide")).toBeInTheDocument();
    expect(calledWith()).toContain(`/functions/v1/starter-download?t=${TOKEN}`);
  });

  it("a return to the clean URL on the same device still fetches from localStorage", async () => {
    go(`/starter/downloads?t=${TOKEN}`);
    runStrip();
    delete (window as unknown as { __edenUrlTokens?: unknown }).__edenUrlTokens;
    sessionStorage.clear();
    go("/starter/downloads");
    render(<StarterDownloads mode="token" />);
    expect(await screen.findByText("Teacher's Guide")).toBeInTheDocument();
    expect(calledWith()).toContain(`t=${TOKEN}`);
  });

  it("shows the incomplete-link message when there is no token anywhere", async () => {
    go("/starter/downloads");
    render(<StarterDownloads mode="token" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That link is incomplete"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
