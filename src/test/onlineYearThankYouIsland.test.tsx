// /online-year/thank-you island (punch #472): reads the session id, asks online-year-order-status, and shows
// the approved READY words or the approved "still being set up" words. The status call is faked.
// End dates here are at noon UTC, so they read the same calendar day in the time zone of any machine
// running the test (the time-zone rule itself is pinned in onlineYearThankYou.test.ts).
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import OnlineYearThankYou, { POLL_FOR_MS, POLL_EVERY_MS } from "../../web/components/islands/OnlineYearThankYou";

const SID = "cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuV";
const PENDING_HEADING = "Thank you! Your order went through.";
const READY = {
  state: "ready",
  band: "seedlings",
  children: [
    { name: "Ben", ends_at: "2027-11-25T12:00:00Z" },
    { name: "Ava", ends_at: "2028-03-01T12:00:00Z" },
  ],
};
const notFound = () => new FunctionsHttpError(new Response(JSON.stringify({ error: "not_found" }), { status: 404 }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.history.replaceState({}, "", `/online-year/thank-you?session_id=${SID}`);
});
afterEach(() => {
  cleanup();
  invoke.mockReset();
  vi.useRealTimers();
});

describe("OnlineYearThankYou", () => {
  it("ready on the first answer: band heading, one sentence per end date, the button to sign-in, the remaining lines", async () => {
    invoke.mockResolvedValue({ data: READY, error: null });
    render(<OnlineYearThankYou />);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Thank you! Your Online Year of Seedlings (3-5) is ready."));
    expect(invoke).toHaveBeenCalledWith("online-year-order-status", { body: { session_id: SID } });
    expect(screen.getByText("Ben's year runs through November 25, 2027. Ava's year runs through March 1, 2028.")).toBeTruthy();
    const button = screen.getByRole("link", { name: "Open Seedlings" });
    expect(button.getAttribute("href")).toBe("/online-year/sign-in");
    expect(screen.getByText(/tap Print, and Ben and Ava's name goes on every page\.$/)).toBeTruthy();
    expect(screen.getByText("We just sent you an email with all of this too.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "hello@edeninstitute.health" }).getAttribute("href")).toBe("mailto:hello@edeninstitute.health");
    expect(screen.queryByText(PENDING_HEADING)).toBeNull();
  });

  it("pending first: the 'still being set up' words, then the ready words once the order is recorded", async () => {
    invoke.mockResolvedValueOnce({ data: { state: "pending" }, error: null }).mockResolvedValue({ data: READY, error: null });
    render(<OnlineYearThankYou />);
    await waitFor(() => expect(screen.getByText(PENDING_HEADING)).toBeTruthy());
    expect(screen.getByText("We're setting up your Online Year now. Your welcome email is on its way, and it has everything you need to get started.")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_EVERY_MS); });
    await waitFor(() => expect(screen.getByRole("link", { name: "Open Seedlings" })).toBeTruthy());
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("keeps asking for about a minute, then stops and keeps the 'still being set up' words", async () => {
    invoke.mockResolvedValue({ data: { state: "pending" }, error: null });
    render(<OnlineYearThankYou />);
    await waitFor(() => expect(screen.getByText(PENDING_HEADING)).toBeTruthy());
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_FOR_MS + 10 * POLL_EVERY_MS); });
    const calls = invoke.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(15);
    expect(calls).toBeLessThanOrEqual(Math.ceil(POLL_FOR_MS / POLL_EVERY_MS) + 1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * POLL_EVERY_MS); });
    expect(invoke.mock.calls.length).toBe(calls);
    expect(screen.getByText(PENDING_HEADING)).toBeTruthy();
    expect(screen.getByText(/If it hasn't arrived in 10 minutes, check your spam folder or email/)).toBeTruthy();
  });

  it("dark (404): the 'still being set up' words, and it does not keep asking", async () => {
    invoke.mockResolvedValue({ data: null, error: notFound() });
    render(<OnlineYearThankYou />);
    await waitFor(() => expect(screen.getByText(PENDING_HEADING)).toBeTruthy());
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * POLL_EVERY_MS); });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("no session id: the 'still being set up' words, and nothing is asked", async () => {
    window.history.replaceState({}, "", "/online-year/thank-you");
    render(<OnlineYearThankYou />);
    await waitFor(() => expect(screen.getByText(PENDING_HEADING)).toBeTruthy());
    expect(invoke).not.toHaveBeenCalled();
  });
});
