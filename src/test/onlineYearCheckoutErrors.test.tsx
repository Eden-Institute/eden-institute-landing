// The Online Year order page shows create-checkout's refusal line exactly as approved, on its own
// (2026-11-25 "Order page error lines"); a failure with no line keeps the old "could not open checkout" path.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/lib/trackCta", () => ({ trackCta: () => {} }));

import OnlineYearCheckout from "../../web/components/islands/OnlineYearCheckout";
import { OY_APPROVED, OY_APPROVED_ORDER_ERRORS } from "../../web/lib/onlineYearCopy";

const refusal = (status: number, body: unknown) => new FunctionsHttpError(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "mom@example.com" } });
  fireEvent.change(screen.getByLabelText("Child's first name or nickname"), { target: { value: "B3n" } });
  fireEvent.change(screen.getByLabelText("Where do you live?"), { target: { value: "US" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: OY_APPROVED.button }));
}

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

describe("OnlineYearCheckout error lines", () => {
  for (const [code, line] of [
    ["OY_BAD_CHILD_NAME", OY_APPROVED_ORDER_ERRORS.badChildName],
    ["OY_DUPLICATE_CHILD_NAME", OY_APPROVED_ORDER_ERRORS.duplicateChildName],
    ["OY_EMAIL", OY_APPROVED_ORDER_ERRORS.email],
    ["OY_TOO_MANY_CHILDREN", OY_APPROVED_ORDER_ERRORS.tooManyChildren],
    ["OY_NOT_CONFIGURED", OY_APPROVED_ORDER_ERRORS.notConfigured],
    ["OY_COUNTRY", "Something went wrong. Please refresh the page and try again."],
  ] as const) {
    it(`${code}: the line reaches the screen word for word, on its own`, async () => {
      invoke.mockResolvedValue({ data: null, error: refusal(code === "OY_NOT_CONFIGURED" ? 503 : 400, { error: line, code }) });
      render(<OnlineYearCheckout />);
      fillAndSubmit();
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(line));
    });
  }

  it("a failure with no line of its own (dark 404) keeps the 'could not open checkout' path", async () => {
    invoke.mockResolvedValue({ data: null, error: refusal(404, { error: "not_found" }) });
    render(<OnlineYearCheckout />);
    fillAndSubmit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("We could not open checkout: Edge Function returned a non-2xx status code"));
  });
});
