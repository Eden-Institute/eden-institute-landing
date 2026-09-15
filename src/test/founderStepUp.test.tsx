// Founder two-factor (founder decision 2026-09-15):
//   1. No authenticator set up: a protected action runs straight through, no prompt.
//   2. The server answers MFA_REQUIRED: the code prompt opens, the code is verified,
//      and the action is retried once.
//   3. Authenticator set up and the session is aal1: the prompt opens BEFORE the
//      action; closing it runs nothing.
//   4. A wrong code keeps the prompt open with a plain message.
//   5. The Security tab enrols: QR code and secret shown, 6-digit code verified,
//      success message shown.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

const mfa = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { mfa } },
}));

import { FounderActionError, STEP_UP_BAD_CODE, STEP_UP_PROMPT, useStepUp } from "@/components/founder/StepUp";
import SecurityTab, { MFA_SETUP_SUCCESS } from "@/components/founder/SecurityTab";

const VERIFIED = { id: "factor-1", factor_type: "totp", status: "verified" };

function Harness({ action }: { action: () => Promise<string> }) {
  const { withStepUp, stepUpDialog } = useStepUp();
  const [out, setOut] = useState("");
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          withStepUp(action).then(
            (r) => setOut(`done:${r}`),
            (e) => setOut(`failed:${e instanceof Error ? e.message : String(e)}`),
          );
        }}
      >
        Run
      </button>
      <p data-testid="out">{out}</p>
      {stepUpDialog}
    </div>
  );
}

beforeEach(() => {
  for (const fn of Object.values(mfa)) fn.mockReset();
  mfa.listFactors.mockResolvedValue({ data: { all: [VERIFIED], totp: [VERIFIED], phone: [] }, error: null });
  mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => cleanup());

describe("step-up prompt", () => {
  it("runs straight through when no authenticator is set up", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
    const action = vi.fn().mockResolvedValue("sent");
    render(<Harness action={action} />);
    fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("done:sent"));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(STEP_UP_PROMPT)).not.toBeInTheDocument();
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("on MFA_REQUIRED asks for the code, verifies it, and retries once", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
    const action = vi.fn()
      .mockRejectedValueOnce(new FounderActionError("Please confirm your authenticator code first.", "MFA_REQUIRED"))
      .mockResolvedValueOnce("sent");
    render(<Harness action={action} />);
    fireEvent.click(screen.getByText("Run"));

    expect(await screen.findByText(STEP_UP_PROMPT)).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123 456" } });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("done:sent"));
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("asks BEFORE the action when an authenticator exists and the session is aal1; closing runs nothing", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    const action = vi.fn().mockResolvedValue("cancelled order");
    render(<Harness action={action} />);
    fireEvent.click(screen.getByText("Run"));

    expect(await screen.findByText(STEP_UP_PROMPT)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("failed:Cancelled. Nothing was done."));
    expect(action).not.toHaveBeenCalled();
  });

  it("does not prompt when the session is already aal2", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    const action = vi.fn().mockResolvedValue("ok");
    render(<Harness action={action} />);
    fireEvent.click(screen.getByText("Run"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("done:ok"));
    expect(screen.queryByText(STEP_UP_PROMPT)).not.toBeInTheDocument();
  });

  it("a wrong code keeps the prompt open with a plain message", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: new Error("Invalid TOTP code entered") });
    const action = vi.fn().mockResolvedValue("sent");
    render(<Harness action={action} />);
    fireEvent.click(screen.getByText("Run"));

    await screen.findByText(STEP_UP_PROMPT);
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByText("Confirm"));
    expect(await screen.findByText(STEP_UP_BAD_CODE)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("done:sent"));
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("Security tab enrolment", () => {
  it("shows the QR code and secret, verifies the code, then shows the success message", async () => {
    const unverified = { id: "old-1", factor_type: "totp", status: "unverified" };
    let enrolled = false;
    mfa.listFactors.mockImplementation(async () => ({
      data: enrolled
        ? { all: [VERIFIED], totp: [VERIFIED], phone: [] }
        : { all: [unverified], totp: [], phone: [] },
      error: null,
    }));
    mfa.getAuthenticatorAssuranceLevel.mockImplementation(async () => ({
      data: { currentLevel: enrolled ? "aal2" : "aal1", nextLevel: enrolled ? "aal2" : "aal1" },
      error: null,
    }));
    mfa.unenroll.mockResolvedValue({ data: {}, error: null });
    mfa.enroll.mockResolvedValue({
      data: { id: "factor-1", type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://x" } },
      error: null,
    });
    mfa.challengeAndVerify.mockImplementation(async () => {
      enrolled = true;
      return { data: {}, error: null };
    });

    render(<SecurityTab />);
    fireEvent.click(await screen.findByText("Set up authenticator"));

    expect(await screen.findByAltText("QR code for your authenticator app")).toHaveAttribute("src", "data:image/svg+xml;utf-8,<svg/>");
    expect(screen.getByTestId("mfa-secret")).toHaveTextContent("JBSWY3DPEHPK3PXP");
    // The abandoned half-finished setup was cleared first.
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "old-1" });
    expect(mfa.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: "totp" }));

    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Confirm"));
    });
    expect(await screen.findByText(MFA_SETUP_SUCCESS)).toBeInTheDocument();
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    expect(await screen.findByText("Authenticator: set up.")).toBeInTheDocument();
    expect(MFA_SETUP_SUCCESS).toBe(
      "Authenticator set up. You will be asked for a code before sending broadcasts or cancelling orders.",
    );
  });
});
