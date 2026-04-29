import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { constitutionProfiles } from "@/lib/constitution-data";
import Navbar from "@/components/landing/Navbar";

const slugToType: Record<string, string> = {
  "burning-bowstring": "Hot / Dry / Tense",
  "open-flame": "Hot / Dry / Relaxed",
  "pressure-cooker": "Hot / Damp / Tense",
  "overflowing-cup": "Hot / Damp / Relaxed",
  "drawn-bowstring": "Cold / Dry / Tense",
  "spent-candle": "Cold / Dry / Relaxed",
  "frozen-knot": "Cold / Damp / Tense",
  "still-water": "Cold / Damp / Relaxed",
};

const Results = () => {
  const { constitutionSlug } = useParams<{ constitutionSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = constitutionSlug ? slugToType[constitutionSlug] : undefined;
  const profile = constitutionType ? constitutionProfiles[constitutionType] : undefined;

  useEffect(() => {
    if (!profile || !constitutionType) return;

    const title = `Your Body Pattern: ${profile.nickname} — The Eden Institute`;
    const description = `Your body pattern is ${profile.nickname} (${constitutionType}). ${profile.tagline} See the herbs that meet this pattern and how to begin.`;
    const url = `https://edeninstitute.health/results/${constitutionSlug}`;

    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", "article");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:card", "summary_large_image");

    return () => {
      document.title = "The Eden Institute — Biblical Clinical Herbalism Education";
    };
  }, [profile, constitutionType, constitutionSlug]);

  if (!profile || !constitutionType) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <h1 className="font-serif text-3xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
            Body Pattern Not Found
          </h1>
          <p className="font-body text-lg mb-8" style={{ color: "#1C3A2E" }}>
            We couldn't find that body pattern. Take the Pattern of Eden quiz to find yours.
          </p>
          <Link to="/assessment">
            <Button variant="eden" size="xl">Take the Pattern of Eden Quiz</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* User-aware top banner — saved-to-account or sign-up-to-save */}
        {user ? (
          <div className="text-center mb-8">
            <p className="font-accent text-sm tracking-[0.2em] uppercase mb-1" style={{ color: "#C9A84C" }}>
              Your Pattern is saved to your account
            </p>
          </div>
        ) : (
          <div className="text-center mb-8 p-4 rounded" style={{ backgroundColor: "white", border: "1px solid hsl(40, 20%, 80%)" }}>
            <p className="font-body text-sm mb-3" style={{ color: "#1C3A2E" }}>
              Save this Pattern to your Apothecary account so you can come back to it any time.
            </p>
            <Link to="/apothecary/auth/signup">
              <Button variant="eden-outline" size="sm">
                Sign up to save
              </Button>
            </Link>
          </div>
        )}

        {/* Type Header */}
        <div className="text-center mb-12">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
            Your Body Pattern
          </span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-4 mb-2" style={{ color: "#1C3A2E" }}>
            {profile.nickname}
          </h1>
          <p className="font-body text-lg mb-1" style={{ color: "#1C3A2E" }}>
            {constitutionType}
          </p>
          <p className="font-accent text-xl italic" style={{ color: "#C9A84C" }}>
            {profile.tagline}
          </p>
        </div>

        {/* Pattern Summary */}
        <div className="space-y-6 mb-12">
          {profile.description.map((para, i) => (
            <p key={i} className="font-body text-lg leading-relaxed" style={{ color: "#1C3A2E" }}>
              {para}
            </p>
          ))}
        </div>

        {/* Continue to Apothecary CTA — prominent, primary action for logged-in users */}
        {user && (
          <div className="mb-12">
            <Button
              variant="eden"
              size="xl"
              className="w-full"
              onClick={() => navigate("/apothecary")}
            >
              Continue to the Apothecary
            </Button>
            <p className="font-body text-xs text-center mt-3" style={{ color: "hsl(30, 10%, 40%, 0.7)" }}>
              Your full directory of 100 herbs, with match badges based on your Pattern.
            </p>
          </div>
        )}

        {/* Three herbs matched to your Pattern */}
        <div className="mb-12">
          <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>
            Three herbs matched to your Pattern
          </h2>
          <div className="space-y-4">
            {profile.herbs.slice(0, 3).map((herb, i) => (
              <div key={i} className="p-5 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
                <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "#C9A84C" }}>
                  {herb.name}
                </h3>
                <p className="font-body text-base" style={{ color: "#1C3A2E" }}>
                  {herb.note}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* $14 Deep-Dive Guide Upsell — fixed CTA with lookup_key + success_url */}
        <div className="p-6 md:p-8 border-2 rounded mb-12" style={{ borderColor: "#C9A84C", backgroundColor: "white" }}>
          <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
            Want the full picture?
          </h2>
          <p className="font-body text-base leading-relaxed mb-4" style={{ color: "#1C3A2E" }}>
            Your complete Deep-Dive Guide includes all 10 matched herbs with clinical preparation methods, dosages, and safety notes — plus caution lists, lifestyle and nutrition guidance, and a Biblical framework for your body pattern.
          </p>
          {error && <p className="font-body text-sm text-destructive mb-4">{error}</p>}
          <Button
            variant="eden"
            size="xl"
            className="w-full"
            data-product="constitution-guide"
            disabled={checkoutLoading}
            onClick={async () => {
              setCheckoutLoading(true);
              setError("");
              try {
                const slug = (profile.nickname).replace(/^The\s+/i, "").toLowerCase().replace(/\s+/g, "-");
                const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
                  body: {
                    lookup_key: "deep_dive_guide",
                    constitution_type: constitutionType,
                    constitution_nickname: profile.nickname,
                    email: user?.email,
                    success_url: `https://edeninstitute.health/guide/${slug}?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `https://edeninstitute.health/results/${constitutionSlug}`,
                  },
                });
                if (fnError) throw fnError;
                if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Checkout failed");
                if (data?.url) window.location.href = data.url;
              } catch (err: any) {
                setError(err.message || "Could not start checkout");
              } finally {
                setCheckoutLoading(false);
              }
            }}
          >
            {checkoutLoading ? "Redirecting to checkout…" : `Get Your Full ${profile.nickname.replace(/^The\s+/i, "")} Guide — $14`}
          </Button>
        </div>

        {/* Amazon Herb Kit */}
        <div className="p-6 md:p-8 rounded mb-12" style={{ backgroundColor: "#F5F0E8", border: "1px solid hsl(40, 20%, 80%)" }}>
          <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
            Your Starter Herb Kit
          </h2>
          <p className="font-body text-base leading-relaxed mb-6" style={{ color: "#1C3A2E" }}>
            A starter set on Amazon — herbs aligned to your pattern so you can begin practicing in your own kitchen.
          </p>
          <a
            href={profile.amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full px-8 py-4 font-serif font-bold text-base tracking-wider uppercase transition-colors rounded"
            style={{ backgroundColor: "#1C3A2E", color: "#F5F0E8" }}
          >
            Shop Your Kit on Amazon
          </a>
          <p className="font-body text-xs text-center mt-3" style={{ color: "hsl(30, 10%, 40%, 0.6)" }}>
            Affiliate link — I earn a small commission at no cost to you.
          </p>
        </div>

        {/* Foundations Course CTA — fixed price ($97 not $197) */}
        <div className="text-center p-10 rounded" style={{ backgroundColor: "#1C3A2E" }}>
          <h3 className="font-serif text-2xl font-bold mb-4" style={{ color: "#C9A84C" }}>
            Ready to Go Deeper?
          </h3>
          <p className="font-body text-lg mb-8 max-w-xl mx-auto" style={{ color: "#F5F0E8" }}>
            The Foundations Course teaches you how to read your body pattern and match it to God's provision in the plant world.
          </p>
          <a
            href="https://learn.edeninstitute.health/course/back-to-eden1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-10 py-4 font-serif font-bold text-base tracking-wider uppercase transition-colors rounded"
            style={{ backgroundColor: "#C9A84C", color: "#1C3A2E" }}
          >
            Enroll in the Foundations Course — $97
          </a>
        </div>
      </div>
    </div>
  );
};

export default Results;
