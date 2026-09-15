// ESA invoice form double-submit protection (2026-09-16):
//   1. esaIdempotencyKey keeps the key for the same fill and changes it when the fill changes.
//   2. The form sends that key, reuses it on a retry after a dropped connection, and a double
//      click sends one request.
//   3. The form shows the function's own refusal message (the hourly cap's 429).
//   4. The Arizona fee sentence matches the invoice PDF's.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EsaInvoiceForm from "../../web/components/islands/EsaInvoiceForm";
import { esaFeeSentence, esaIdempotencyKey, ESA_STATE_OPTIONS } from "../../web/lib/esaInvoice";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("esaIdempotencyKey", () => {
  it("reuses the key for the same fill and makes a new one when the fill changes", () => {
    let n = 0;
    const gen = () => `key-${++n}`;
    const a = esaIdempotencyKey(null, "fill-1", gen);
    expect(a.key).toBe("key-1");
    expect(esaIdempotencyKey(a, "fill-1", gen)).toBe(a);
    const b = esaIdempotencyKey(a, "fill-2", gen);
    expect(b.key).toBe("key-2");
  });

  it("defaults to a random UUID", () => {
    expect(esaIdempotencyKey(null, "x").key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

function fillIn() {
  fireEvent.change(screen.getByLabelText(/Parent's first and last name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText("Student 1 first name"), { target: { value: "Sam" } });
  fireEvent.change(screen.getByLabelText("Student 1 last name"), { target: { value: "Doe" } });
  fireEvent.change(screen.getByLabelText("Street address"), { target: { value: "1 Main St" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Mobile" } });
  fireEvent.change(screen.getByLabelText("ZIP code"), { target: { value: "36602" } });
}

const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body));

describe("EsaInvoiceForm", () => {
  it("retries a dropped connection with the same key, and a new fill gets a new key", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<EsaInvoiceForm state="AL" stateName="Alabama" short="Alabama CHOOSE Act" />);
    fillIn();
    const form = container.querySelector("form")!;

    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not reach our server");
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const k1 = bodyOf(fetchMock.mock.calls[0]).idempotencyKey;
    expect(k1).toMatch(/^[0-9a-f-]{36}$/);
    expect(bodyOf(fetchMock.mock.calls[1]).idempotencyKey).toBe(k1);

    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("Student 1 first name"), { target: { value: "Samuel" } });
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(bodyOf(fetchMock.mock.calls[2]).idempotencyKey).not.toBe(k1);
  });

  it("a double click sends one request", async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (release = r)));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<EsaInvoiceForm state="AL" stateName="Alabama" short="Alabama CHOOSE Act" />);
    fillIn();
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release(new Response(JSON.stringify({ error: "x" }), { status: 500 }));
    await screen.findByRole("alert");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the function's hourly-cap message", async () => {
    const msg = "We are getting a lot of invoice requests right now. Please try again in a few minutes, or email hello@edeninstitute.health.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: msg, code: "RATE_LIMITED" }), { status: 429 })));
    const { container } = render(<EsaInvoiceForm state="AL" stateName="Alabama" short="Alabama CHOOSE Act" />);
    fillIn();
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(msg);
  });
});

describe("Arizona fee sentence", () => {
  it("is the founder-approved sentence", () => {
    expect(esaFeeSentence(ESA_STATE_OPTIONS.AZ.feeRate)).toBe("ClassWallet deducts 2%, so this invoice adds 2.0408% to cover it.");
  });
});
