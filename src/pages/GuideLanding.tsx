import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { constitutionProfiles } from "@/lib/constitution-data";
import { getFullGuide } from "@/lib/guide-registry";
import GuideTemplate from "@/components/guide/GuideTemplate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Map slug → constitution type key
const slugToType: Record<string, string> = {};
for (const [type, profile] of Object.entries(constitutionProfiles)) {
  const slug = profile.nickname
    .replace(/^The\s+/i, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
  slugToType[slug] = type;
}

const GuideLanding = () => {
  const { constitutionSlug } = useParams<{ constitutionSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = constitutionSlug ? slugToType[constitutionSlug] : null;
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  // On mount: check for session_id (post-payment redirect)
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    setVerifying(true);
    const verify = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-session", {
          body: { session_id: sessionId },
        });
        if (fnError) throw fnError;
        if (data?.paid) {
          setPaid(true);
          localStorage.setItem(`guide_purchased_${constitutionSlug}`, "true");
        }
      } catch (err) {
        console.error("Payment verification failed:", err);
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [searchParams]);

  // Check for prior purchase if no session_id
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) return;

    const checkPriorPurchase = async () => {
      if (localStorage.getItem(`guide_purchased_${constitutionSlug}`) === "true") {
        setPaid(true);
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-session", {
          body: { check_slug: constitutionSlug },
        });
        if (fnError) throw fnError;
        if (data?.paid) {
          setPaid(true);
        }
      } catch (err) {
        console.error('Prior purchase check failed:', err);
      }
    };
    checkPriorPurchase();
  }, [constitutionSlug, searchParams]);

  useEffect(() => {
    if (constitutionSlug && !profile) {
      navigate("/assessment");
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#C5A44E", borderTopColor: "transparent" }} />
          <p className="font-serif text-lg" style={{ color: "#2C3E2D" }}>Verifying your purchase…</p>
        </div>
      </div>
    );
  }

  // If paid, render the full guide
  if (paid) {
    const fullGuide = getFullGuide(profile.nickname);
    if (fullGuide) {
      return <GuideTemplate guide={fullGuide} />;
    }
  }

  // Otherwise show the sales/upsell page
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setError("");
    try {
      // Phase 5 fix #4 / launch-blocker #58a — pass lookup_key (was
      // missing → silent 400) and a success_url that returns to this
      // same /guide/[slug] page with ?session_id= so the verify-session
      // useEffect above unlocks the full guide.
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: {
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
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const displayName = profile.nickname.replace(/^The\s+/i, "");

  return (
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
            Your Top 3 Herbs
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
            {checkoutLoading ? "Loading…" : `Get Your ${displayName} Guide — $14`}
          </button>

          {error && (
            <p className="text-sm mt-3" style={{ color: "#E57373" }}>{error}</p>
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
  );
};

export default GuideLanding;
