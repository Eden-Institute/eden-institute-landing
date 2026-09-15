// Founder dashboard: Security. Set up the authenticator app that protects
// broadcast sends and Lulu order cancels (founder decision 2026-09-15).
//
// Enrolment is Supabase Auth TOTP: mfa.enroll returns a QR code (an SVG data URL)
// and the secret for manual entry; mfa.challengeAndVerify with the first 6-digit
// code marks the factor verified. Only a VERIFIED factor switches the step-up on,
// so abandoning this screen halfway never locks the founder out.
// How-to for the founder: docs/ops/founder-2fa-setup.md

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const MFA_SETUP_SUCCESS =
  "Authenticator set up. You will be asked for a code before sending broadcasts or cancelling orders.";

interface Pending {
  factorId: string;
  qrCode: string;
  secret: string;
}

type Status = { enrolled: boolean; sessionConfirmed: boolean } | null;

export default function SecurityTab() {
  const [status, setStatus] = useState<Status>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [{ data: factors, error: fErr }, { data: aal, error: aErr }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (fErr) throw fErr;
      if (aErr) throw aErr;
      setStatus({
        enrolled: (factors?.totp ?? []).length > 0,
        sessionConfirmed: aal?.currentLevel === "aal2",
      });
    } catch (e) {
      setStatus(null);
      setLoadError(e instanceof Error ? e.message : "Could not check your authenticator settings.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // Clear any half-finished setup first, so an abandoned attempt cannot block a new one.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error: eErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Eden founder ${Date.now()}`,
      });
      if (eErr || !data) throw eErr ?? new Error("Setup did not start.");
      setPending({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup did not start. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    if (!pending) return;
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("Please enter all 6 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.factorId, code: clean });
      if (vErr) {
        setError("That code did not work. Check your authenticator app and try the newest code.");
        return;
      }
      setPending(null);
      setCode("");
      setSuccess(MFA_SETUP_SUCCESS);
      await load();
    } catch {
      setError("That code did not work. Check your authenticator app and try the newest code.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSetup() {
    if (!pending) return;
    setBusy(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId });
    } catch {
      // An unverified factor does nothing; the next setup clears it anyway.
    } finally {
      setPending(null);
      setCode("");
      setError(null);
      setBusy(false);
    }
  }

  const field = "w-full max-w-[12rem] rounded-md border border-border bg-background px-3 py-2 font-body text-lg tracking-[0.3em] text-center";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
          Two-factor protection
        </h2>
        <p className="font-body text-sm text-muted-foreground">
          An authenticator app on your phone adds a second lock. Once it is set up, sending a
          broadcast or cancelling an order asks for the 6-digit code from the app, so a stolen
          password alone cannot do either.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">
            {loadError}{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => void load()}>Try again</button>
          </p>
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border p-4" style={{ borderColor: "hsl(var(--eden-sage) / 0.6)", backgroundColor: "hsl(var(--eden-sage) / 0.1)" }}>
          <p className="font-body text-sm">{success}</p>
        </div>
      )}

      {status && !pending && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          {status.enrolled ? (
            <>
              <p className="font-body text-sm"><strong>Authenticator: set up.</strong></p>
              <p className="font-body text-sm text-muted-foreground">
                {status.sessionConfirmed
                  ? "You have already entered a code in this session."
                  : "You will be asked for a code before sending broadcasts or cancelling orders."}
              </p>
            </>
          ) : (
            <>
              <p className="font-body text-sm"><strong>Authenticator: not set up yet.</strong></p>
              <p className="font-body text-sm text-muted-foreground">
                Until you add one, broadcasts and order cancels only need your password.
              </p>
              <Button variant="eden" onClick={() => void startSetup()} disabled={busy}>
                {busy ? "Starting..." : "Set up authenticator"}
              </Button>
            </>
          )}
        </div>
      )}

      {pending && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <ol className="font-body text-sm list-decimal pl-5 space-y-1">
            <li>Open your authenticator app and choose to add an account.</li>
            <li>Scan this QR code with your phone.</li>
            <li>Type the 6-digit code the app shows, then press Confirm.</li>
          </ol>
          <img src={pending.qrCode} alt="QR code for your authenticator app" className="w-48 h-48 bg-white p-2 rounded" />
          <div>
            <p className="font-body text-xs text-muted-foreground mb-1">
              Cannot scan? Type this key into the app instead. Save it in your password manager as a backup.
            </p>
            <code data-testid="mfa-secret" className="font-mono text-sm break-all select-all">{pending.secret}</code>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmSetup();
            }}
            className="space-y-2"
          >
            <label htmlFor="mfa-setup-code" className="font-body text-sm block">6-digit code</label>
            <input
              id="mfa-setup-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={field}
              placeholder="123456"
            />
            {error && <p role="alert" className="font-body text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="eden" disabled={busy}>{busy ? "Checking..." : "Confirm"}</Button>
              <Button type="button" variant="outline" onClick={() => void cancelSetup()} disabled={busy}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {!pending && error && <p role="alert" className="font-body text-sm text-destructive">{error}</p>}
    </div>
  );
}
