// "How did you hear about us?" (2026-11-24; Gina / UHPN's ask, Camila's taps "Yes, add it" + "Use these").
// The words, the database's allowed values and the free-week form all come from one list.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/lib/metaPixel", () => ({ metaTrack: vi.fn() }));
vi.mock("@/lib/pinterestTag", () => ({ pinSetHashedEmail: vi.fn(() => Promise.resolve()), pinTrack: vi.fn() }));
vi.mock("@/lib/emailSubmit", () => ({ trackEmailSubmit: vi.fn(), trackInternalLinkClick: vi.fn() }));

import WaitlistModal from "@/components/landing/WaitlistModal";
import { FREE_WEEK_MODAL, HOMESCHOOL_AUDIENCE_ID } from "../../web/lib/freeWeekModal";
import { HEARD_ABOUT_OPTIONS, HEARD_ABOUT_QUESTION } from "../../supabase/functions/_shared/heard-about";

// Her approved words, 2026-11-24 (Lane 2 tap "Use these").
const APPROVED = [
  "Tales & Table Talk podcast", "Ultimate Homeschool Podcast Network", "Another podcast", "Facebook", "Instagram",
  "Pinterest", "Google or another search", "A friend or family member", "Other",
];

describe("the list", () => {
  it("is her approved question and choices, in her order", () => {
    expect(HEARD_ABOUT_QUESTION).toBe("How did you hear about us?");
    expect(HEARD_ABOUT_OPTIONS.map((o) => o.label)).toEqual(APPROVED);
  });

  it("the migration allows exactly these values on both tables", () => {
    const dir = join(__dirname, "..", "..", "supabase", "migrations");
    const file = readdirSync(dir).find((f) => f.endsWith("_heard_about.sql"));
    expect(file).toBeTruthy();
    const sql = readFileSync(join(dir, file!), "utf8");
    const lists = [...sql.matchAll(/heard_about in \(([^)]*)\)/g)].map((m) => [...m[1].matchAll(/'([a-z0-9]+)'/g)].map((x) => x[1]));
    expect(lists).toHaveLength(2);
    for (const l of lists) expect(l).toEqual(HEARD_ABOUT_OPTIONS.map((o) => o.value));
  });
});

function renderForm(source: string) {
  const m = FREE_WEEK_MODAL.sprouts;
  render(
    <WaitlistModal open onOpenChange={() => {}} audienceId={HOMESCHOOL_AUDIENCE_ID} source={source} title={m.title}
      subtitle={m.subtitle} submitLabel={m.submitLabel} successMessage={m.successMessage} successSubtitle={m.successSubtitle} />,
  );
  return m;
}

async function fillAndSubmit(submitLabel: string) {
  fireEvent.change(screen.getByPlaceholderText("Your first name"), { target: { value: "Ruth" } });
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "ruth@gmail.com" } });
  fireEvent.click(screen.getByRole("button", { name: submitLabel }));
  await waitFor(() => expect(invoke).toHaveBeenCalled());
  return (invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
}

describe("free-week form", () => {
  beforeEach(() => { invoke.mockReset(); invoke.mockResolvedValue({ data: { success: true, welcome_email_sent: true }, error: null }); });
  afterEach(() => cleanup());

  it("asks the optional question on a free-week sign-up and sends the pick", async () => {
    const m = renderForm("sprouts_magnet");
    const select = screen.getByLabelText(`${HEARD_ABOUT_QUESTION} (optional)`) as HTMLSelectElement;
    expect(select.required).toBe(false);
    expect([...select.options].map((o) => o.textContent)).toEqual(["", ...APPROVED]);
    fireEvent.change(select, { target: { value: "talesandtabletalk" } });
    const body = await fillAndSubmit(m.submitLabel);
    expect(body.heard_about).toBe("talesandtabletalk");
    expect(body.source).toBe("sprouts_magnet");
  });

  it("sends nothing when she skips it", async () => {
    const m = renderForm("seedlings_magnet");
    const body = await fillAndSubmit(m.submitLabel);
    expect("heard_about" in body).toBe(false);
  });

  it("is not on the other lists' forms", () => {
    renderForm("waitlist");
    expect(screen.queryByLabelText(`${HEARD_ABOUT_QUESTION} (optional)`)).toBeNull();
  });
});
