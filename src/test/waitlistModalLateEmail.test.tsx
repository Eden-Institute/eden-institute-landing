// Free-week pop-up, late-email fallback (2026-11-12, Lane 2 area 5 F3; founder-approved
// wording in web/lib/freeWeekModal.ts). resend-waitlist answers welcome_email_sent=false
// when Resend did not accept the Week 1 email. The success screen used to say "Week 1 is
// on its way" whatever happened; now, on the free-week pop-up only, it says the email is
// running late and gives a button to the band's Week 1 download page.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("@/lib/metaPixel", () => ({ metaTrack: vi.fn() }));
vi.mock("@/lib/pinterestTag", () => ({ pinSetHashedEmail: vi.fn(() => Promise.resolve()), pinTrack: vi.fn() }));
vi.mock("@/lib/emailSubmit", () => ({ trackEmailSubmit: vi.fn(), trackInternalLinkClick: vi.fn() }));

import WaitlistModal from "@/components/landing/WaitlistModal";
import { FREE_WEEK_MODAL, HOMESCHOOL_AUDIENCE_ID, freeWeekLateFor } from "../../web/lib/freeWeekModal";

const m = FREE_WEEK_MODAL.sprouts;

function renderFreeWeek(withLate = true) {
  render(
    <WaitlistModal
      open
      onOpenChange={() => {}}
      audienceId={HOMESCHOOL_AUDIENCE_ID}
      source={m.source}
      title={m.title}
      subtitle={m.subtitle}
      submitLabel={m.submitLabel}
      successMessage={m.successMessage}
      successSubtitle={m.successSubtitle}
      {...(withLate ? { lateMessage: m.lateMessage, lateHref: m.lateHref, lateLabel: m.lateLabel } : {})}
    />,
  );
}

async function submit() {
  fireEvent.change(screen.getByPlaceholderText("Your first name"), { target: { value: "Ruth" } });
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "ruth@gmail.com" } });
  fireEvent.click(screen.getByRole("button", { name: m.submitLabel }));
}

describe("free-week pop-up thank-you screen", () => {
  beforeEach(() => invoke.mockReset());
  afterEach(() => cleanup());

  it("says Week 1 is on its way when the email went", async () => {
    invoke.mockResolvedValue({ data: { success: true, welcome_email_sent: true }, error: null });
    renderFreeWeek();
    await submit();
    await waitFor(() => expect(screen.getByText(m.successMessage)).toBeTruthy());
    expect(screen.queryByText(m.lateMessage)).toBeNull();
    expect(screen.queryByRole("link", { name: m.lateLabel })).toBeNull();
  });

  it("says the email is late and links Week 1 when the email did not go", async () => {
    invoke.mockResolvedValue({ data: { success: true, welcome_email_sent: false }, error: null });
    renderFreeWeek();
    await submit();
    await waitFor(() => expect(screen.getByText(m.lateMessage)).toBeTruthy());
    expect(screen.queryByText(m.successMessage)).toBeNull();
    const link = screen.getByRole("link", { name: m.lateLabel });
    expect(link.getAttribute("href")).toBe("/freebies/sprouts-week-1");
  });

  it("keeps the normal screen when the server does not say (older reply)", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    renderFreeWeek();
    await submit();
    await waitFor(() => expect(screen.getByText(m.successMessage)).toBeTruthy());
    expect(screen.queryByText(m.lateMessage)).toBeNull();
  });

  it("keeps the normal screen on a surface with no late fallback", async () => {
    invoke.mockResolvedValue({ data: { success: true, welcome_email_sent: false }, error: null });
    renderFreeWeek(false);
    await submit();
    await waitFor(() => expect(screen.getByText(m.successMessage)).toBeTruthy());
    expect(screen.queryByRole("link", { name: m.lateLabel })).toBeNull();
  });
});

describe("freeWeekLateFor", () => {
  it("gives each band its own Week 1 page and nothing to other sign-ups", () => {
    expect(freeWeekLateFor("sprouts_magnet")?.lateHref).toBe("/freebies/sprouts-week-1");
    expect(freeWeekLateFor("seedlings_magnet")?.lateHref).toBe("/freebies/seedlings-week-1");
    expect(freeWeekLateFor("podcast")).toBeNull();
    expect(freeWeekLateFor(undefined)).toBeNull();
  });

  it("uses the approved wording, with no em dashes", () => {
    expect(m.lateMessage).toBe("You're signed up. Your email is running late, so here is Week 1 now:");
    expect(m.lateLabel).toBe("Open Week 1");
    expect(FREE_WEEK_MODAL.seedlings.lateMessage).toBe(m.lateMessage);
    expect(m.lateMessage.includes("—")).toBe(false);
  });
});
