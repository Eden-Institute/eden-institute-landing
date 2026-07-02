import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useCurrentTier } from "@/hooks/useCurrentTier";
import { isSubscriberTier } from "@/hooks/useHerbsDirectory";
import { patternNameToSlug } from "@/lib/amazonKitUrls";
import { constitutionProfiles } from "@/lib/constitution-data";
import { ROUTES } from "@/lib/routes";
import { useDocumentMeta } from "@/lib/useDocumentMeta";
import { useStructuredData } from "@/lib/useStructuredData";
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
  const { data: tier } = useCurrentTier();
  const isSubscriber = isSubscriberTier(tier);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  // PR η fix #7 — Pattern Detail page active-profile awareness.
  //
  // The /results/:slug route is intentionally URL-slug-driven for SEO
  // (one canonical URL per Pattern, indexable individually). Camila
  // reproduced the bug on production: she switched the picker to her
  // person-profile "Olivia" (Pattern: Frozen Knot), navigated to her
  // own /results/pressure-cooker page, and the page kept showing
  // Pressure Cooker — the previous active profile's Pattern — instead
  // of redirecting to Olivia's Frozen Knot page.
  //
  // Approach: rather than abandoning the slug-driven canonical URL
  // (which would hurt SEO), the page redirects when the signed-in
  // user has an active profile whose Pattern slug differs from the URL
  // slug. Anonymous visitors arriving from email links, SERP results,
  // or social shares are NOT redirected — they see whichever Pattern
  // they linked to. The redirect only fires for signed-in users with
  // an actively-resolved Pattern (i.e. a real active-profile context
  // exists), so the SEO/share semantics stay intact.
  //
  // Race-safe: useEdenPattern is gated on the ActiveProfileContext's
  // hydration (per PR δ), so we don't redirect before the context has
  // had a chance to resolve the active profile's Pattern.
  const { data: activePattern, activeProfile, isLoading: patternLoading } =
    useEdenPattern();
  useEffect(() => {
    if (!user) return; // anon visitor — never redirect
    if (patternLoading) return; // wait for context to hydrate
    if (!activePattern) return; // active profile has no Pattern yet
    if (!activeProfile) return; // no picker context, leave URL alone
    if (!constitutionSlug) return; // /results/* with no slug — let the not-found render
    const desiredSlug = patternNameToSlug(activePattern);
    if (desiredSlug && desiredSlug !== constitutionSlug) {
      navigate(`/results/${desiredSlug}`, { replace: true });
    }
  }, [user, patternLoading, activePattern, activeProfile, constitutionSlug, navigate]);

  const constitutionType = constitutionSlug ? slugToType[constitutionSlug] : undefined;
  const profile = constitutionType ? constitutionProfiles[constitutionType] : undefined;

  const canonical = constitutionSlug
    ? `https://edeninstitute.health/results/${constitutionSlug}`
    : "https://edeninstitute.health/assessment";

  const title = profile
    ? `Your Body Pattern: ${profile.nickname} — The Eden Institute`
    : "Body Pattern Not Found — The Eden Institute";
  const description = profile && constitutionType
    ? `Your body pattern is ${profile.nickname} (${constitutionType}). ${profile.tagline} See the herbs that meet this pattern and how to begin.`
    : "We couldn't find that body pattern. Take the Pattern of Eden quiz to find yours.";

  useDocumentMeta({
    title,
    description,
    canonical,
    ogType: "article",
  });

  useStructuredData(
    "article",
    profile && constitutionType
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          url: canonical,
          mainEntityOfPage: canonical,
          datePublished: "2026-04-30",
          dateModified: "2026-04-30",
          author: {
            "@type": "Organization",
            name: "The Eden Institute",
            url: "https://edeninstitute.health",
          },
          publisher: {
            "@type": "Organization",
            name: "The Eden Institute",
            url: "https://edeninstitute.health",
            logo: {
              "@type": "ImageObject",
              url: "https://edeninstitute.health/favicon.ico",
            },
          },
          about: {
            "@type": "Thing",
            name: profile.nickname,
            alternateName: constitutionType,
          },
          articleSection: "Pattern of Eden — Constitutional Patterns",
          inLanguage: "en-US",
        }
      : null,
  );

  useStructuredData(
    "breadcrumbs",
    profile
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://edeninstitute.health/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Pattern of Eden Quiz",
              item: "https://edeninstitute.health/assessment",
            },
            {
              "@type": "ListItem",
              position: 3,
              name: profile.nickname,
            },
          ],
        }
      : null,
  );

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
          <Link to={ROUTES.ASSESSMENT}>
            <Button variant="eden" size="xl">Take the Pattern of Eden Quiz</Button>
          </Link>
        </div>
      </div>
    );
  }

  // PR η fix #4: short Pattern label without leading "The".
  const patternShort = profile.nickname.replace(/^The\s+/i, "");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* CRO Phase 1 reorder (approved plan §4): reveal → matched herbs →
            Seed (primary) → save-account (soft) → "Also available" row.
            The signup nudge that used to sit ABOVE the reveal moved below
            the Seed block so the emotional payoff comes first. */}

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

        {user && (
          <div className="mb-12">
            <Button
              variant="eden"
              size="xl"
              className="w-full"
              onClick={() => navigate(ROUTES.APOTHECARY)}
            >
              Continue to the Apothecary
            </Button>
            <p className="font-body text-xs text-center mt-3" style={{ color: "hsl(30, 10%, 40%, 0.7)" }}>
              Your full directory of 100 herbs, with match badges based on your Pattern.
            </p>
          </div>
        )}

        <div className="mb-12">
          <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>
            Three herbs matched to your Pattern
          </h2>
          {/* Each card deep-links into the herb's public monograph
              (/apothecary/:slug, CRO Phase 1). The clinical-why teaser is
              honest: the monograph's clinical study is Seed-gated, so the
              lock line only shows to non-subscribers. */}
          <div className="space-y-4">
            {profile.herbs.slice(0, 3).map((herb) => (
              <Link
                key={herb.herbSlug + herb.name}
                to={ROUTES.APOTHECARY_HERB(herb.herbSlug)}
                data-cta="results-herb-monograph"
                className="block p-5 border border-[hsl(40,20%,80%)] rounded bg-white transition-colors hover:border-[#C9A84C]"
              >
                <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "#C9A84C" }}>
                  {herb.name}
                </h3>
                <p className="font-body text-base mb-3" style={{ color: "#1C3A2E" }}>
                  {herb.note}
                </p>
                <p className="font-body text-sm" style={{ color: "#1C3A2E" }}>
                  <span className="underline underline-offset-4">Read the monograph</span>
                  {" →"}
                </p>
                {!isSubscriber && (
                  <p className="font-body text-xs mt-1" style={{ color: "hsl(30, 10%, 40%, 0.7)" }}>
                    The full clinical study opens with Seed.
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Seed subscription — primary conversion CTA. Depth-led (Seed = full
            clinical study) and Pattern-personalized. Shown to non-subscribers;
            forest-filled so it reads as the dominant action above the guide. */}
        {!isSubscriber && (
          <div className="p-6 md:p-8 border-2 rounded mb-8" style={{ borderColor: "#C9A84C", backgroundColor: "#1C3A2E" }}>
            <p className="font-accent text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#C9A84C" }}>
              See the clinical why
            </p>
            <h2 className="font-serif text-2xl font-bold mb-3" style={{ color: "#F5F0E8" }}>
              Unlock the full clinical study for your {patternShort}.
            </h2>
            <p className="font-body text-base leading-relaxed mb-6" style={{ color: "rgba(245,240,232,0.85)" }}>
              Seed opens how each of the 100 herbs acts in the body, which ones suit your {patternShort} pattern and why, and how to use them safely. Actions, tissue states, energetics, and the full contraindication library.
            </p>
            <Button
              variant="eden"
              size="xl"
              className="w-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3 px-4"
              asChild
              data-cta="results-upgrade-seed"
            >
              <Link to={`${ROUTES.APOTHECARY_PRICING}#tier-seed`}>
                Unlock the full study with Seed, $7.99/mo
              </Link>
            </Button>
          </div>
        )}

        {/* Progressive account creation — AFTER the result is delivered
            (approved plan §5). Anon gets the soft save card; authed gets
            the quiet confirmation line. */}
        {user ? (
          <div className="text-center mb-12">
            <p className="font-accent text-sm tracking-[0.2em] uppercase mb-1" style={{ color: "#C9A84C" }}>
              Your Pattern is saved to your account
            </p>
          </div>
        ) : (
          <div className="text-center mb-12 p-5 rounded" style={{ backgroundColor: "white", border: "1px solid hsl(40, 20%, 80%)" }}>
            <p className="font-body text-sm mb-3" style={{ color: "#1C3A2E" }}>
              Save this Pattern to a free account so you can come back to it
              any time, and keep a study list of the herbs that fit it.
            </p>
            <Link to={`${ROUTES.APOTHECARY_SIGNUP}?return_to=${encodeURIComponent(`/results/${constitutionSlug}`)}`}>
              <Button variant="eden" size="lg">
                Create a free account to save your Pattern
              </Button>
            </Link>
          </div>
        )}

        {/* "Also available" — guide, kit, and course demoted to a compact
            supporting row (approved plan §4/§8: subscription-primary; the
            one-off guide is a stepping stone, not the destination). The
            guide checkout wiring is unchanged, only restyled. */}
        <div className="mb-4 text-center">
          <p className="font-accent text-xs tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
            Also available
          </p>
        </div>
        {error && <p className="font-body text-sm text-destructive mb-4 text-center">{error}</p>}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex flex-col p-5 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
            <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "#1C3A2E" }}>
              The Deep-Dive Guide
            </h3>
            <p className="font-body text-sm leading-relaxed mb-4 flex-1" style={{ color: "#1C3A2E" }}>
              All 10 matched herbs with preparation methods, dosages, and
              safety notes, plus lifestyle guidance and a Biblical framework
              for your pattern.
            </p>
            <Button
              variant="eden"
              size="lg"
              className="w-full whitespace-normal leading-snug h-auto py-3"
              data-product="constitution-guide"
              disabled={checkoutLoading}
              onClick={async () => {
                setCheckoutLoading(true);
                setError("");
                try {
                  const slug = patternNameToSlug(profile.nickname);
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
              {checkoutLoading ? "Redirecting…" : "Get the Guide, $4.99"}
            </Button>
          </div>

          <div className="flex flex-col p-5 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
            <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "#1C3A2E" }}>
              Starter Herb Kit
            </h3>
            <p className="font-body text-sm leading-relaxed mb-4 flex-1" style={{ color: "#1C3A2E" }}>
              A starter set on Amazon, aligned to your pattern, so you can
              begin practicing in your own kitchen.
            </p>
            <a
              href={profile.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-3 font-serif font-bold text-sm tracking-wider uppercase transition-colors rounded"
              style={{ backgroundColor: "#1C3A2E", color: "#F5F0E8" }}
            >
              Shop on Amazon
            </a>
            <p className="font-body text-xs text-center mt-2" style={{ color: "hsl(30, 10%, 40%, 0.6)" }}>
              Affiliate link. I earn a small commission at no cost to you.
            </p>
          </div>

          <div className="flex flex-col p-5 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
            <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "#1C3A2E" }}>
              The Foundations Course
            </h3>
            <p className="font-body text-sm leading-relaxed mb-4 flex-1" style={{ color: "#1C3A2E" }}>
              Learn to read your body pattern and match it to God's provision
              in the plant world.
            </p>
            <a
              href="https://learn.edeninstitute.health/course/back-to-eden1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-3 font-serif font-bold text-sm tracking-wider uppercase transition-colors rounded"
              style={{ backgroundColor: "#C9A84C", color: "#1C3A2E" }}
            >
              Enroll, $97
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
