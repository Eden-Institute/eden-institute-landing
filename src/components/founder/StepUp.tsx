// Founder dashboard: the authenticator step-up (founder decision 2026-09-15).
//
// Sending a broadcast and cancelling a Lulu order need a second factor once the
// founder has set up an authenticator app (Security tab). Two ways in:
//   1. Before the action: the session is aal1 but the account can reach aal2
//      (it has a verified authenticator), so ask for the code first.
//   2. After the action: the edge function answered code MFA_REQUIRED (for
//      example the authenticator was added in another tab), so ask and retry once.
// With no authenticator set up, nothing here prompts: the action runs as before.

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const STEP_UP_PROMPT = "Enter the 6-digit code from your authenticator app";
export const STEP_UP_BAD_CODE = "That code did not work. Check your authenticator app and try the newest code.";
export const MFA_NUDGE =
  "Two-factor protection is not set up yet. Open the Security tab to add your authenticator app.";

/** An edge-function failure that keeps the machine-readable code from the body. */
export class FounderActionError extends Error {
  code?: string;
  body?: Record<string, unknown> | null;
  constructor(message: string, code?: string, body?: Record<string, unknown> | null) {
    super(message);
    this.name = "FounderActionError";
    this.code = code;
    this.body = body;
  }
}

/** Reads the JSON body of a supabase.functions.invoke error. Never throws. */
export async function readFunctionErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  try {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isMfaRequired(err: unknown): boolean {
  return err instanceof FounderActionError && err.code === "MFA_REQUIRED";
}

/** True when the session should confirm a code before a protected action. */
export async function sessionNeedsStepUp(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false; // the server still enforces; it answers MFA_REQUIRED
    return data.currentLevel !== "aal2" && data.nextLevel === "aal2";
  } catch {
    return false;
  }
}

/**
 * useStepUp(): wrap a protected founder action with withStepUp(fn), and render
 * stepUpDialog somewhere in the component.
 */
export function useStepUp() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setOpen(false);
    setCode("");
    setError(null);
    setBusy(false);
    r?.(ok);
  }, []);

  /** Opens the prompt; resolves true once a code is verified, false if closed. */
  const requestCode = useCallback((): Promise<boolean> => {
    resolver.current?.(false);
    setCode("");
    setError(null);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const verify = useCallback(async () => {
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("Please enter all 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const factor = factors?.totp?.[0];
      if (!factor) {
        setError("No authenticator is set up on this account. Open the Security tab to add one.");
        setBusy(false);
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: clean });
      if (vErr) {
        setError(STEP_UP_BAD_CODE);
        setBusy(false);
        return;
      }
      finish(true);
    } catch {
      setError(STEP_UP_BAD_CODE);
      setBusy(false);
    }
  }, [code, finish]);

  const withStepUp = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (await sessionNeedsStepUp()) {
      if (!(await requestCode())) throw new FounderActionError("Cancelled. Nothing was done.", "STEP_UP_CANCELLED");
    }
    try {
      return await fn();
    } catch (err) {
      if (!isMfaRequired(err)) throw err;
      if (!(await requestCode())) throw new FounderActionError("Cancelled. Nothing was done.", "STEP_UP_CANCELLED");
      return await fn();
    }
  }, [requestCode]);

  const stepUpDialog = (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) finish(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">Confirm it is you</DialogTitle>
          <DialogDescription className="font-body">{STEP_UP_PROMPT}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label htmlFor="step-up-code" className="sr-only">Authenticator code</label>
          <input
            id="step-up-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-lg tracking-[0.3em] text-center"
            placeholder="123456"
          />
          {error && <p role="alert" className="font-body text-sm text-destructive mt-2">{error}</p>}
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => finish(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="eden" disabled={busy}>{busy ? "Checking..." : "Confirm"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { withStepUp, stepUpDialog };
}
