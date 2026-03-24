import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getFullGuide } from "@/lib/guide-registry";
import GuideTemplate from "@/components/guide/GuideTemplate";
import { constitutionProfiles } from "@/lib/constitution-data";

const GuideSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [constitutionType, setConstitutionType] = useState("");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      navigate("/assessment");
      return;
    }

    const verify = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("verify-session", {
          body: { session_id: sessionId },
        });

        if (fnError) throw fnError;
        if (!data?.paid) throw new Error("Payment not verified");

        setConstitutionType(data.constitution_type);
        setNickname(data.constitution_nickname);
      } catch (err: any) {
        setError(err.message || "Payment verification failed");
        setTimeout(() => navigate("/assessment"), 3000);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#C5A44E", borderTopColor: "transparent" }} />
          <p className="font-serif text-lg" style={{ color: "#2C3E2D" }}>Verifying your purchase…</p>
        </div>
      </div>
    );
  }

  if (error || !nickname) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center max-w-md px-6">
          <p className="font-serif text-xl mb-4" style={{ color: "#2C3E2D" }}>Payment verification failed</p>
          <p className="font-body text-sm" style={{ color: "#6B6560" }}>Redirecting you back to the assessment…</p>
        </div>
      </div>
    );
  }

  // Try full guide first
  const fullGuide = getFullGuide(nickname);
  if (fullGuide) {
    return <GuideTemplate guide={fullGuide} />;
  }

  // Fallback to legacy simplified rendering for types not yet migrated
  const profile = constitutionProfiles[constitutionType];
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center max-w-md px-6">
          <p className="font-serif text-xl mb-4" style={{ color: "#2C3E2D" }}>Guide not found</p>
          <p className="font-body text-sm" style={{ color: "#6B6560" }}>We couldn't load your guide. Please contact support.</p>
        </div>
      </div>
    );
  }

  const scriptureMap: Record<string, { verse: string; ref: string }> = {
    "The Burning Bowstring": { verse: "Be still and know that I am God.", ref: "Psalm 46:10" },
    "The Open Flame": { verse: "A gentle answer turns away wrath, but a harsh word stirs up anger.", ref: "Proverbs 15:1" },
    "The Pressure Cooker": { verse: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
    "The Overflowing Cup": { verse: "Above all else, guard your heart, for everything you do flows from it.", ref: "Proverbs 4:23" },
    "The Drawn Bowstring": { verse: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
    "The Spent Candle": { verse: "He leads me beside quiet waters, He restores my soul.", ref: "Psalm 23:2-3" },
    "The Still Water": { verse: "Whatever you do, work heartily, as for the Lord.", ref: "Colossians 3:23" },
  };

  const scripture = scriptureMap[nickname] || { verse: "The earth is the Lord's, and everything in it.", ref: "Psalm 24:1" };

  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        <header className="no-print sticky top-0 z-50 px-6 py-4 border-b" style={{ backgroundColor: "#F5F0E8", borderColor: "#EBE4D8" }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <a href="/" className="font-serif text-lg font-bold" style={{ color: "#2C3E2D" }}>The Eden Institute</a>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded font-accent text-sm tracking-wider uppercase"
              style={{ backgroundColor: "#2C3E2D", color: "#F5F0E8" }}
            >
              Save as PDF
            </button>
          </div>
        </header>

        <div className="guide-container max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C5A44E" }}>Your Deep-Dive Guide</span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mt-3 mb-2" style={{ color: "#2C3E2D" }}>{nickname}</h1>
            <p className="font-body text-lg" style={{ color: "#6B6560" }}>{constitutionType}</p>
            <p className="font-accent text-lg italic mt-2" style={{ color: "#C5A44E" }}>{profile.tagline}</p>
          </div>

          <div className="flex items-center justify-center mb-12">
            <div className="h-px flex-1" style={{ backgroundColor: "#C5A44E" }} />
            <span className="px-4 font-serif text-sm" style={{ color: "#C5A44E" }}>✦</span>
            <div className="h-px flex-1" style={{ backgroundColor: "#C5A44E" }} />
          </div>

          <div className="mb-12">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#2C3E2D" }}>Understanding Your Pattern</h2>
            {profile.description.map((para, i) => (
              <p key={i} className="font-body text-base leading-relaxed mb-4" style={{ color: "#2C3E2D" }}>{para}</p>
            ))}
          </div>

          <div className="mb-12 p-8 rounded text-center" style={{ backgroundColor: "white", border: "2px solid #C5A44E" }}>
            <p className="font-serif text-xl italic mb-3" style={{ color: "#2C3E2D" }}>"{scripture.verse}"</p>
            <p className="font-accent text-sm tracking-wider uppercase" style={{ color: "#C5A44E" }}>— {scripture.ref}</p>
          </div>

          <div className="mb-12">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#2C3E2D" }}>Your 10 Matched Herbs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.herbs.map((herb, i) => (
                <div key={i} className="herb-card p-5 rounded border" style={{ backgroundColor: "white", borderColor: "#EBE4D8" }}>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-serif text-sm font-bold" style={{ backgroundColor: "#C5A44E", color: "white" }}>
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-serif text-lg font-bold" style={{ color: "#2C3E2D" }}>{herb.name}</h3>
                      <p className="font-body text-sm mt-1" style={{ color: "#6B6560" }}>{herb.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="no-print text-center p-10 rounded" style={{ backgroundColor: "#2C3E2D" }}>
            <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#F5F0E8" }}>Ready to Go Deeper?</h2>
            <p className="font-body text-base mb-6" style={{ color: "#D4C088" }}>
              The Foundations of Constitutional Herbalism course teaches you to apply this knowledge with confidence.
            </p>
            <a
              href="https://edeninstitute.health/course"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 rounded font-serif font-bold tracking-wider uppercase"
              style={{ backgroundColor: "#C5A44E", color: "#2C3E2D" }}
            >
              Enroll in the Foundations Course — $197
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideSuccess;
