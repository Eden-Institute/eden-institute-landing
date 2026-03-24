import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  // Scripture mapping
  const scriptureMap: Record<string, { verse: string; ref: string }> = {
    "The Burning Bowstring": { verse: "Be still and know that I am God.", ref: "Psalm 46:10" },
    "The Open Flame": { verse: "A gentle answer turns away wrath, but a harsh word stirs up anger.", ref: "Proverbs 15:1" },
    "The Pressure Cooker": { verse: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
    "The Overflowing Cup": { verse: "Above all else, guard your heart, for everything you do flows from it.", ref: "Proverbs 4:23" },
    "The Drawn Bowstring": { verse: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
    "The Spent Candle": { verse: "He leads me beside quiet waters, He restores my soul.", ref: "Psalm 23:2-3" },
    "The Frozen Knot": { verse: "Forget the former things; do not dwell on the past. See, I am doing a new thing!", ref: "Isaiah 43:18-19" },
    "The Still Water": { verse: "Whatever you do, work heartily, as for the Lord.", ref: "Colossians 3:23" },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
          <p className="font-serif text-lg" style={{ color: "#1C3A2E" }}>Verifying your purchase…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5F0E8" }}>
        <div className="text-center max-w-md px-6">
          <p className="font-serif text-xl mb-4" style={{ color: "#1C3A2E" }}>Payment verification failed</p>
          <p className="font-body text-sm" style={{ color: "hsl(30, 10%, 40%)" }}>Redirecting you back to the assessment…</p>
        </div>
      </div>
    );
  }

  const scripture = scriptureMap[nickname] || { verse: "The earth is the Lord's, and everything in it.", ref: "Psalm 24:1" };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .guide-container { background: white !important; box-shadow: none !important; }
          .herb-card { break-inside: avoid; }
          .guide-section { break-inside: avoid; }
        }
      `}</style>

      <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
        {/* Sticky header */}
        <header className="no-print sticky top-0 z-50 px-6 py-4 border-b" style={{ backgroundColor: "#F5F0E8", borderColor: "hsl(40, 20%, 80%)" }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <a href="/" className="font-serif text-lg font-bold" style={{ color: "#1C3A2E" }}>The Eden Institute</a>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded font-accent text-sm tracking-wider uppercase"
              style={{ backgroundColor: "#1C3A2E", color: "#F5F0E8" }}
            >
              Save as PDF
            </button>
          </div>
        </header>

        <div className="guide-container max-w-3xl mx-auto px-6 py-12">
          {/* Title */}
          <div className="text-center mb-12 guide-section">
            <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>Your Deep-Dive Guide</span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mt-3 mb-2" style={{ color: "#1C3A2E" }}>{nickname}</h1>
            <p className="font-body text-lg" style={{ color: "hsl(30, 10%, 40%)" }}>{constitutionType}</p>
            <p className="font-accent text-lg italic mt-2" style={{ color: "#C9A84C" }}>{profile.tagline}</p>
          </div>

          {/* Divider */}
          <div className="flex items-center justify-center mb-12">
            <div className="h-px flex-1" style={{ backgroundColor: "#C9A84C" }} />
            <span className="px-4 font-serif text-sm" style={{ color: "#C9A84C" }}>✦</span>
            <div className="h-px flex-1" style={{ backgroundColor: "#C9A84C" }} />
          </div>

          {/* Full Description */}
          <div className="mb-12 guide-section">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>Understanding Your Pattern</h2>
            {profile.description.map((para, i) => (
              <p key={i} className="font-body text-base leading-relaxed mb-4" style={{ color: "#1C3A2E" }}>{para}</p>
            ))}
          </div>

          {/* Scripture Anchor */}
          <div className="mb-12 p-8 rounded text-center guide-section" style={{ backgroundColor: "white", border: "2px solid #C9A84C" }}>
            <p className="font-serif text-xl italic mb-3" style={{ color: "#1C3A2E" }}>"{scripture.verse}"</p>
            <p className="font-accent text-sm tracking-wider uppercase" style={{ color: "#C9A84C" }}>— {scripture.ref}</p>
          </div>

          {/* Herbs Section */}
          <div className="mb-12 guide-section">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>Your 10 Matched Herbs</h2>
            <p className="font-body text-base mb-8" style={{ color: "hsl(30, 10%, 40%)" }}>
              These herbs are specifically selected for the {nickname.replace(/^The /, "")} pattern. Each one addresses a key aspect of your constitutional imbalance.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.herbs.map((herb, i) => (
                <div key={i} className="herb-card p-5 rounded border" style={{ backgroundColor: "white", borderColor: "hsl(40, 20%, 80%)" }}>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-serif text-sm font-bold" style={{ backgroundColor: "#C9A84C", color: "white" }}>
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-serif text-lg font-bold" style={{ color: "#1C3A2E" }}>{herb.name}</h3>
                      <p className="font-body text-sm mt-1" style={{ color: "hsl(30, 10%, 40%)" }}>{herb.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lifestyle & Nutrition */}
          <div className="mb-12 guide-section">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>Lifestyle & Nutrition Guidance</h2>
            <div className="p-6 rounded" style={{ backgroundColor: "white", border: "1px solid hsl(40, 20%, 80%)" }}>
              <p className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
                As a {nickname.replace(/^The /, "")}, your daily habits matter as much as your herbs. Focus on foods and rhythms that complement your constitutional pattern. {
                  constitutionType.includes("Hot") ? "Favor cooling foods — raw vegetables, bitter greens, cucumber, and room-temperature water. Avoid excessive spice, alcohol, and caffeine." :
                  "Favor warming, cooked foods — soups, stews, ginger tea, and warming spices. Minimize raw, cold foods and iced beverages."
                } {
                  constitutionType.includes("Dry") ? "Prioritize hydration and healthy fats — olive oil, avocado, bone broth, and mucilaginous foods like okra and flax." :
                  "Reduce excess moisture with lighter meals, aromatic herbs in cooking, and regular movement to promote fluid circulation."
                } {
                  constitutionType.includes("Tense") ? "Build in rest — breathwork, gentle stretching, warm baths, and firm boundaries around overstimulation." :
                  "Add gentle structure — regular meal times, moderate exercise, and tonic herbs that build tone without forcing it."
                }
              </p>
            </div>
          </div>

          {/* Caution Herbs */}
          <div className="mb-12 guide-section">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>Herbs to Use with Caution</h2>
            <div className="p-6 rounded" style={{ backgroundColor: "hsl(0, 40%, 97%)", border: "1px solid hsl(0, 30%, 85%)" }}>
              <p className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
                {constitutionType.includes("Hot") ? "Avoid strongly warming stimulants: Cayenne, Cinnamon bark (in large doses), Ginseng (Panax), and Black Pepper in therapeutic quantities. These will aggravate your heat." : ""}
                {constitutionType.includes("Cold") ? "Use cooling herbs cautiously: Peppermint (in large doses), Goldenseal (long-term), raw Aloe vera internally, and excessive Green Tea. These can further chill your system." : ""}
                {" "}
                {constitutionType.includes("Dry") ? "Avoid strongly drying herbs: Sage (large therapeutic doses), Uva Ursi (long-term), and excessive caffeine. Your system needs moisture, not more drying." : ""}
                {constitutionType.includes("Damp") ? "Limit demulcents without purpose: Marshmallow root, Slippery Elm, and excessive oily/sweet herbs can add more dampness to an already waterlogged system." : ""}
                {" "}
                {constitutionType.includes("Tense") ? "Avoid strong stimulants: high-dose caffeine, Ephedra, and Guarana will worsen your tension pattern." : ""}
                {constitutionType.includes("Relaxed") ? "Use strong sedatives sparingly: Kava, high-dose Valerian, and Passionflower may over-relax an already lax system." : ""}
              </p>
            </div>
          </div>

          {/* Preparation Methods */}
          <div className="mb-12 guide-section">
            <h2 className="font-serif text-2xl font-bold mb-6" style={{ color: "#1C3A2E" }}>Preparation Methods</h2>
            <div className="space-y-4">
              {[
                { title: "Infusion (Tea)", desc: "Pour boiling water over 1 tbsp dried herb, steep 10-15 minutes covered. Best for leaves and flowers." },
                { title: "Decoction", desc: "Simmer 1 tbsp root/bark in 2 cups water for 20-30 minutes. Strain and drink warm. Best for roots, barks, and tough plant material." },
                { title: "Tincture", desc: "Use 30-60 drops (1-2 dropperfuls) in a small amount of water, 2-3 times daily. Tinctures offer convenience and longer shelf life." },
              ].map((method, i) => (
                <div key={i} className="p-5 rounded" style={{ backgroundColor: "white", border: "1px solid hsl(40, 20%, 80%)" }}>
                  <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "#1C3A2E" }}>{method.title}</h3>
                  <p className="font-body text-sm" style={{ color: "hsl(30, 10%, 40%)" }}>{method.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Closing Scripture */}
          <div className="text-center py-12 guide-section">
            <div className="h-px mb-8" style={{ backgroundColor: "#C9A84C" }} />
            <p className="font-serif text-lg italic mb-2" style={{ color: "#1C3A2E" }}>
              "For everything there is a season, and a time for every matter under heaven."
            </p>
            <p className="font-accent text-sm tracking-wider uppercase" style={{ color: "#C9A84C" }}>— Ecclesiastes 3:1</p>
            <div className="h-px mt-8" style={{ backgroundColor: "#C9A84C" }} />
          </div>

          {/* Course CTA */}
          <div className="no-print text-center p-10 rounded guide-section" style={{ backgroundColor: "#1C3A2E" }}>
            <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: "#F5F0E8" }}>Ready to Go Deeper?</h2>
            <p className="font-body text-base mb-6" style={{ color: "hsl(40, 30%, 75%)" }}>
              The Foundations of Constitutional Herbalism course teaches you to apply this knowledge with confidence.
            </p>
            <a
              href="https://edeninstitute.health/course"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 rounded font-serif font-bold tracking-wider uppercase"
              style={{ backgroundColor: "#C9A84C", color: "#1C3A2E" }}
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
