import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { constitutionProfiles } from "@/lib/constitution-data";
import { getTypeFromSlug } from "@/lib/constitution-utils";
import type { FullGuideContent } from "@/lib/guide-types";
import GuideTemplate from "@/components/guide/GuideTemplate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import { ROUTES } from "@/lib/routes";
import { trackCta } from "@/lib/trackCta";
import { readCheckoutSessionId } from "@/lib/checkoutSession";
import {
  clearGuideAccessToken,
  forgetGuideSession,
  readGuideAccessToken,
  readStoredGuideSession,
  saveGuideSession,
  stripGuideAccessFromUrl,
} from "@/lib/guideAccess";
import { FORM_ERROR_FALLBACK, visitorFacingError } from "@/lib/edgeFunctionError";

import { getFbAttribution } from "@/lib/fbAttribution";

const GuideLanding = () => {
  const { constitutionSlug } = useParams<{ constitutionSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  // Guide content is fetched from the server after a paid session is verified —
  // it is no longer bundled into the client, so it cannot be read for free.
  const [guide, setGuide] = useState<FullGuideContent | null>(null);

  const constitutionType = constitutionSlug ? getTypeFromSlug(constitutionSlug) ?? null : null;
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  // "Already bought your guide?" form, shown only to visitors not seeing the guide.
  const [linkEmail, setLinkEmail] = useState("");
  const [linkSending, setLinkSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState("");

  // On mount, three ways in, most specific first:
  //   1. ?session_id (post-payment redirect). index.html's first script has already
  //      moved it out of the URL (src/lib/checkoutSession.ts).
  //   2. ?access=<token> from the emailed guide link. index.html's second script has
  //      already moved it out of the URL before any tag ran (src/lib/guideAccess.ts).
  //   3. A checkout session id remembered on this device, for up to 90 days.
  useEffect(() => {
    if (!constitutionSlug) return;
    let cancelled = false;

    const verifySession = async (sessionId: string, remember: boolean) => {
      const { data, error: fnError } = await supabase.functions.invoke("verify-session", {
        body: { session_id: sessionId },
      });
      if (fnError) throw fnError;
      if (cancelled) return false;
      if (data?.paid && data.guide) {
        setPaid(true);
        setGuide(data.guide as FullGuideContent);
        // Persist the verified session id (not a spoofable boolean) for 90 days so
        // return visits can re-verify against Stripe and re-fetch the guide.
        if (remember) saveGuideSession(constitutionSlug, sessionId);
        return true;
      }
      return false;
    };

    const run = async () => {
      const sessionId = readCheckoutSessionId();
      if (sessionId) {
        setVerifying(true);
        try {
          await verifySession(sessionId, true);
        } catch (err) {
          console.error("Payment verification failed:", err);
        } finally {
          if (!cancelled) setVerifying(false);
        }
        return;
      }

      const accessToken = readGuideAccessToken();
      if (accessToken) {
        setVerifying(true);
        try {
          const { data, error: fnError } = await supabase.functions.invoke("guide-access-link", {
            body: { token: accessToken },
          });
          if (fnError) throw fnError;
          if (cancelled) return;
          if (data?.ok && data.guide && data.slug === constitutionSlug) {
            setPaid(true);
            setGuide(data.guide as FullGuideContent);
            // Normally index.html's head script has already done this.
            stripGuideAccessFromUrl();
            return;
          }
          clearGuideAccessToken();
        } catch (err) {
          console.error("Guide access link check failed:", err);
        } finally {
          if (!cancelled) setVerifying(false);
        }
        // A bad or expired link falls through to a remembered session, if any.
      }

      const storedSession = readStoredGuideSession(constitutionSlug);
      if (!storedSession) return;
      setVerifying(true);
      try {
        const ok = await verifySession(storedSession, false);
        if (!ok && !cancelled) forgetGuideSession(constitutionSlug);
      } catch (err) {
        console.error("Prior purchase check failed:", err);
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [constitutionSlug, searchParams]);

  useEffect(() => {
    if (constitutionSlug && !profile) {
      navigate(ROUTES.ASSESSMENT);
    }
  }, [constitutionSlug, profile, navigate]);

  useEffect(() => {
    if (profile) {
      document.title = `${profile.nickname} Deep-Dive Guide — The Eden Institute`;
    }
  }, [profile]);

  if (!profile || !constitutionType || !constitutionSlug) return null;

  // Show loading spinner during verification
  if (verifying) {
    return (
      <>
        <Navbar />
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
          <div className="text-center">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#C5A44E", borderTopColor: "transparent" }} />
            <p className="font-serif text-lg" style={{ color: "#2C3E2D" }}>Verifying your purchase…</p>
          </div>
        </div>
      </>
    );
  }

  // If paid, render the full guide (fetched from the server, not the bundle).
  if (paid && guide) {
    return (
      <>
        <Navbar />
        <GuideTemplate guide={guide} />
      </>
    );
  }

  // Otherwise show the sales/upsell page
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setError("");
    // Funnel moment (CRO Phase 4): guide checkout-start from the sales page.
    trackCta("checkout-start", { lookupKey: "deep_dive_guide" });
    try {
      // Phase 5 fix #4 / launch-blocker #58a — pass lookup_key (was
      // missing → silent 400) and a success_url that returns to this
      // same /guide/[slug] page with ?session_id= so the verify-session
      // useEffect above unlocks the full guide.
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: {
          ...getFbAttribution(),
          lookup_key: "deep_dive_guide",
          constitution_type: constitutionType,
          constitution_nickname: profile.nickname,
          success_url: `https://edeninstitute.health/guide/${constitutionSlug}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `https://edeninstitute.health/guide/${constitutionSlug}`,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Checkout failed");
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError("");
    setLinkSending(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("guide-access-link", {
        body: { email: linkEmail.trim(), slug: constitutionSlug },
      });
      if (fnError) throw fnError;
      setLinkSent(true);
    } catch (err) {
      setLinkError(await visitorFacingError(err, FORM_ERROR_FALLBACK));
    } finally {
      setLinkSending(false);
    }
  };

  const displayName = profile.nickname.replace(/^The\s+/i, "");

  return (
    <>
      <Navbar />
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        {/* Header */}
        <header className="py-6 border-b" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="font-serif text-xs tracking-[0.25em] uppercase" style={{ color: "#C5A44E" }}>
              The Eden Institute
            </p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-12">
          {/* Type badge */}
          <div className="text-center mb-8">
            <span
              className="inline-block text-xs tracking-[0.2em] uppercase font-bold px-4 py-1.5 rounded-full"
              style={{ backgroundColor: "#2C3E2D", color: "#C5A44E" }}
            >
              Your Body Pattern
            </span>
          </div>

          <h1 className="font-serif text-3xl md:text-4xl font-bold text-center mb-3" style={{ color: "#2C3E2D" }}>
            {profile.nickname}
          </h1>
          <p className="font-serif text-lg text-center italic mb-8" style={{ color: "#5C7A5C" }}>
            {profile.tagline}
          </p>

          {/* Description */}
          <div className="rounded-lg p-6 mb-8" style={{ backgroundColor: "#FFFFFF", border: "1px solid hsl(40, 20%, 85%)" }}>
            {profile.description.map((para, i) => (
              <p key={i} className="font-body text-base leading-relaxed mb-4 last:mb-0" style={{ color: "#3D3832" }}>
                {para}
              </p>
            ))}
          </div>

          {/* Herb teaser */}
          <div className="mb-8">
            <h2 className="font-serif text-xl font-bold mb-4" style={{ color: "#2C3E2D" }}>
              Three herbs matched to your Pattern
            </h2>
            <div className="space-y-3">
              {profile.herbs.slice(0, 3).map((herb, i) => (
                <div
                  key={i}
                  className="rounded-lg p-4 flex items-start gap-3"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid hsl(40, 20%, 85%)" }}
                >
                  <span className="font-serif font-bold text-lg" style={{ color: "#C5A44E" }}>{i + 1}</span>
                  <div>
                    <p className="font-serif font-bold" style={{ color: "#2C3E2D" }}>{herb.name}</p>
                    <p className="text-sm" style={{ color: "#6B6560" }}>{herb.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upsell CTA */}
          <div
            className="rounded-lg p-8 text-center mb-8"
            style={{ backgroundColor: "#2C3E2D" }}
          >
            <p className="text-xs tracking-[0.2em] uppercase font-bold mb-3" style={{ color: "#C5A44E" }}>
              Want the full picture?
            </p>
            <h3 className="font-serif text-2xl font-bold mb-3" style={{ color: "#F5F0E8" }}>
              Your Complete Deep-Dive Guide
            </h3>
            <p className="font-body text-sm mb-2" style={{ color: "#C5C0B8" }}>
              All 10 herbs with preparation methods • Biblical framework for your type
            </p>
            <p className="font-body text-sm mb-6" style={{ color: "#C5C0B8" }}>
              Lifestyle protocol • Historical context • Printable PDF
            </p>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="inline-block font-serif text-sm font-bold tracking-[0.15em] uppercase px-8 py-4 rounded transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#C5A44E", color: "#2C3E2D" }}
            >
              {checkoutLoading ? "Loading…" : `Get Your ${displayName} Guide — $4.99`}
            </button>

            {error && (
              <p className="text-sm mt-3" style={{ color: "#E57373" }}>{error}</p>
            )}
          </div>

          {/* Emailed access link for buyers on a new device or browser */}
          <div
            className="rounded-lg p-6 mb-8 text-center"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid hsl(40, 20%, 85%)" }}
          >
            {linkSent ? (
              <p className="font-body text-base" style={{ color: "#3D3832" }} role="status">
                If that email bought this guide, a link is on its way. Check your inbox in a minute or two.
              </p>
            ) : (
              <form onSubmit={handleSendLink}>
                <label htmlFor="guide-link-email" className="block font-serif text-base mb-3" style={{ color: "#2C3E2D" }}>
                  Already bought your guide? Enter your email and we will send you a link.
                </label>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <input
                    id="guide-link-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    className="flex-1 min-w-0 rounded border px-4 py-3 font-body text-base"
                    style={{ borderColor: "hsl(40, 20%, 75%)", color: "#2C3E2D" }}
                  />
                  <button
                    type="submit"
                    disabled={linkSending}
                    className="font-serif text-sm font-bold tracking-[0.1em] uppercase px-6 py-3 rounded transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: "#2C3E2D", color: "#F5F0E8" }}
                  >
                    Send me my guide link
                  </button>
                </div>
                {linkError && (
                  <p className="text-sm mt-3" style={{ color: "#B3261E" }} role="alert">{linkError}</p>
                )}
              </form>
            )}
          </div>

          {/* Amazon kit link */}
          <div className="text-center">
            <a
              href={profile.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-serif text-sm font-bold tracking-[0.1em] uppercase px-6 py-3 rounded transition-colors"
              style={{
                backgroundColor: "transparent",
                color: "#2C3E2D",
                border: "2px solid #2C3E2D",
              }}
            >
              Shop Your Starter Herb Kit →
            </a>
          </div>
        </main>
      </div>
    </>
  );
};

export default GuideLanding;
