import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { constitutionProfiles } from "@/lib/constitution-data";

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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = constitutionSlug ? slugToType[constitutionSlug] : undefined;
  const profile = constitutionType ? constitutionProfiles[constitutionType] : undefined;

  useEffect(() => {
    if (!profile || !constitutionType) return;

    const title = `Your Type: ${profile.nickname} — The Eden Institute`;
    const description = `You are ${profile.nickname} (${constitutionType}). ${profile.tagline} Discover your top herbs and a Biblical framework for your body type pattern.`;
    const url = `https://eden-institute-landing.lovable.app/results/${constitutionSlug}`;
    const ogImage = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/885c26d7-47fa-44a2-8cbe-2fb65fe2ac1d/id-preview-76fd0110--2c0295c8-d605-4e05-b894-d14a43a38181.lovable.app-1771968635738.png";

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
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:type", "article");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);
    setMeta("name", "twitter:card", "summary_large_image");

    return () => {
      document.title = "The Eden Institute — Biblical Clinical Herbalism Education";
    };
  }, [profile, constitutionType, constitutionSlug]);

  if (!profile || !constitutionType) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#F5F0E8" }}>
        <h1 className="font-serif text-3xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
          Body Type Not Found
        </h1>
        <p className="font-body text-lg mb-8" style={{ color: "#1C3A2E" }}>
          We couldn't find that body type. Take the free quiz to discover yours.
        </p>
        <Link to="/assessment">
          <Button variant="eden" size="xl">Take the Free Quiz</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Type Header */}
        <div className="text-center mb-12">
          <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
            Your Body Type
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
        <div className="space-y-6 mb-16">
          {profile.description.map((para, i) => (
            <p key={i} className="font-body text-lg leading-relaxed" style={{ color: "#1C3A2E" }}>
              {para}
            </p>
          ))}
        </div>

        {/* Top 3 Herbs */}
        <div className="mb-16">
          <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>
            Your Top 3 Herbs
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

        {/* $14 Deep-Dive Guide Upsell */}
        <div className="p-6 md:p-8 border-2 rounded mb-12" style={{ borderColor: "#C9A84C", backgroundColor: "white" }}>
          <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
            Want the full picture?
          </h2>
          <p className="font-body text-base leading-relaxed mb-4" style={{ color: "#1C3A2E" }}>
            Your complete Deep-Dive Guide includes all 10 matched herbs with clinical preparation methods, dosages, and safety notes — plus caution lists, lifestyle and nutrition guidance, and a Biblical framework for your body type pattern.
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
                const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
                  body: {
                    constitution_type: constitutionType,
                    constitution_nickname: profile.nickname,
                  },
                });
                if (fnError) throw fnError;
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
            We curated the exact herbs for your body type on Amazon. One-click shopping list — everything you need to get started.
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

        {/* Course CTA */}
        <div className="text-center p-10 rounded mb-8" style={{ backgroundColor: "#1C3A2E" }}>
          <h3 className="font-serif text-2xl font-bold mb-4" style={{ color: "#C9A84C" }}>
            Ready to Go Deeper?
          </h3>
          <p className="font-body text-lg mb-8 max-w-xl mx-auto" style={{ color: "#F5F0E8" }}>
            The Foundations Course teaches you how to read your body type and match it to God's provision in the plant world.
          </p>
          <a
            href="https://learn.edeninstitute.health/course/back-to-eden1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-10 py-4 font-serif font-bold text-base tracking-wider uppercase transition-colors rounded"
            style={{ backgroundColor: "#C9A84C", color: "#1C3A2E" }}
          >
            Enroll in the Foundations Course — $197
          </a>
        </div>

        {/* Retake Quiz */}
        <div className="text-center mt-8">
          <Link to="/assessment" className="font-body text-base underline" style={{ color: "#5C7A5C" }}>
            Retake the Body Type Quiz →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Results;
