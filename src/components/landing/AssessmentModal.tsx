import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

// Topics are now handled server-side in the edge function

interface Question {
  id: number;
  axis: "temperature" | "fluid" | "tone";
  question: string;
  options: { label: string; text: string; score: string }[];
}

const questions: Question[] = [
  { id: 1, axis: "temperature", question: "How would you describe your body temperature in everyday life?", options: [
    { label: "A", text: "I run warm — I often feel too hot, prefer cool rooms, and kick off blankets at night", score: "Hot" },
    { label: "B", text: "I run cool — I'm often the coldest person in the room and love warming up", score: "Cold" },
    { label: "C", text: "It varies a lot — sometimes hot, sometimes cold, hard to pin down", score: "neutral" },
    { label: "D", text: "I don't notice much either way", score: "neutral" },
  ]},
  { id: 2, axis: "temperature", question: "When you're under stress or overwhelmed, what happens to your body?", options: [
    { label: "A", text: "I get hot, flushed, or feel heat in my chest and face", score: "Hot" },
    { label: "B", text: "I get cold, stiff, or feel chilled and want to bundle up", score: "Cold" },
    { label: "C", text: "I get sweaty but also cold at the same time", score: "neutral" },
    { label: "D", text: "My temperature doesn't change much", score: "neutral" },
  ]},
  { id: 3, axis: "temperature", question: "How do you feel after eating a large, rich, or heavy meal?", options: [
    { label: "A", text: "Uncomfortable, overly warm, or nauseous", score: "Hot" },
    { label: "B", text: "Better — a warm meal genuinely helps me", score: "Cold" },
    { label: "C", text: "Sluggish and sleepy regardless", score: "neutral" },
    { label: "D", text: "Depends on the food", score: "neutral" },
  ]},
  { id: 4, axis: "temperature", question: "What kind of weather feels best to your body?", options: [
    { label: "A", text: "Cool or cold weather", score: "Hot" },
    { label: "B", text: "Warm or hot weather", score: "Cold" },
    { label: "C", text: "Mild seasons", score: "neutral" },
    { label: "D", text: "No strong preference", score: "neutral" },
  ]},
  { id: 5, axis: "fluid", question: "How would you describe your skin and mucous membranes?", options: [
    { label: "A", text: "Oily skin, prone to breakouts, mucus congestion", score: "Damp" },
    { label: "B", text: "Dry skin, dry eyes, dry mouth, tendency toward dehydration", score: "Dry" },
    { label: "C", text: "Combination", score: "neutral" },
    { label: "D", text: "Normal", score: "neutral" },
  ]},
  { id: 6, axis: "fluid", question: "How does your body handle respiratory illness?", options: [
    { label: "A", text: "Lots of mucus, congestion, runny nose, phlegm", score: "Damp" },
    { label: "B", text: "Dry, tight, unproductive symptoms — dry cough", score: "Dry" },
    { label: "C", text: "Varies by illness", score: "neutral" },
    { label: "D", text: "Don't get sick often enough to notice", score: "neutral" },
  ]},
  { id: 7, axis: "fluid", question: "Which best describes your digestion?", options: [
    { label: "A", text: "Loose, sluggish, prone to bloating — I retain water easily", score: "Damp" },
    { label: "B", text: "Dry, constipated, prone to hard stools", score: "Dry" },
    { label: "C", text: "Irregular — alternates", score: "neutral" },
    { label: "D", text: "Generally normal", score: "neutral" },
  ]},
  { id: 8, axis: "fluid", question: "How would you describe your body type?", options: [
    { label: "A", text: "I gain weight easily, retain fluid, soft or puffy tissue", score: "Damp" },
    { label: "B", text: "I stay lean naturally, dry out easily, firm tissue", score: "Dry" },
    { label: "C", text: "I fluctuate", score: "neutral" },
    { label: "D", text: "Don't strongly identify with either", score: "neutral" },
  ]},
  { id: 9, axis: "tone", question: "How does your nervous system respond to stress?", options: [
    { label: "A", text: "I tighten up — shoulders, jaw, gut clench and it's hard to let go", score: "Tense" },
    { label: "B", text: "I go soft or spacey — scattered, loose, lose focus", score: "Relaxed" },
    { label: "C", text: "I swing between the two", score: "neutral" },
    { label: "D", text: "I stay pretty even", score: "neutral" },
  ]},
  { id: 10, axis: "tone", question: "Where do you feel tension most often?", options: [
    { label: "A", text: "Tight muscles, clenched jaw, tension headaches, cramping", score: "Tense" },
    { label: "B", text: "Weakness, sagging feeling, poor muscle tone, heaviness", score: "Relaxed" },
    { label: "C", text: "Pain that moves — sometimes tight, sometimes loose", score: "neutral" },
    { label: "D", text: "No consistent pattern", score: "neutral" },
  ]},
  { id: 11, axis: "tone", question: "How would you describe your sleep?", options: [
    { label: "A", text: "Hard to fall asleep — mind won't stop, body feels wound up", score: "Tense" },
    { label: "B", text: "Fall asleep easily but sleep too deeply — hard to feel rested", score: "Relaxed" },
    { label: "C", text: "Inconsistent", score: "neutral" },
    { label: "D", text: "Sleep normally", score: "neutral" },
  ]},
  { id: 12, axis: "tone", question: "How do your emotions express in your body?", options: [
    { label: "A", text: "Intense — I feel things strongly, shows up as tension, heat, or pain", score: "Tense" },
    { label: "B", text: "Porous — I absorb others' energy and feel drained or loose", score: "Relaxed" },
    { label: "C", text: "I bottle things up until I crash", score: "neutral" },
    { label: "D", text: "I process emotions smoothly", score: "neutral" },
  ]},
];

interface ConstitutionProfile {
  nickname: string;
  description: string[];
  herbs: { name: string; note: string }[];
}

const constitutionProfiles: Record<string, ConstitutionProfile> = {
  "Hot / Dry / Tense": {
    nickname: "The Burning Bowstring",
    description: [
      "You are a person of intensity. Your body runs hot, your tissues tend toward dryness, and your nervous system holds tension like a drawn bow.",
      "Your body needs cooling, moistening, and relaxing support — not more stimulation.",
      "Your path to wellness involves learning to yield — to rest before you're forced to, to hydrate before you're parched.",
    ],
    herbs: [
      { name: "Marshmallow Root", note: "Deeply moistening and soothing to dry, inflamed tissues." },
      { name: "Passionflower", note: "Calms an overactive mind and releases muscular tension." },
      { name: "Lemon Balm", note: "Gently cooling and nervine, easing heat-driven anxiety." },
      { name: "Chamomile", note: "Anti-inflammatory and relaxing, especially for tension in the gut." },
      { name: "Violet Leaf", note: "Cooling and moistening, softening dry, tight tissue states." },
    ],
  },
  "Hot / Dry / Relaxed": {
    nickname: "The Open Flame",
    description: [
      "You burn bright but without the tension to hold it in — your heat disperses freely.",
      "This is the constitution of someone who gives freely — perhaps too freely.",
      "Your healing journey is about containment without restriction.",
    ],
    herbs: [
      { name: "Shatavari", note: "Deeply nourishing and moistening, rebuilding depleted fluids." },
      { name: "Rose", note: "Gently cooling and mildly astringent, restoring tone." },
      { name: "Hibiscus", note: "Cooling and hydrating with mild astringency." },
      { name: "Licorice Root", note: "Moistening and restorative, supporting adrenal function." },
      { name: "Aloe Vera", note: "Cooling, moistening, and soothing to internal dry heat." },
    ],
  },
  "Hot / Damp / Tense": {
    nickname: "The Pressure Cooker",
    description: [
      "You hold heat and fluid simultaneously, and your body is wound tight.",
      "This is one of the most intense constitutional patterns.",
      "Your work is to create outlets — not through force, but through gentle, consistent release.",
    ],
    herbs: [
      { name: "Dandelion Root", note: "Bitter, cooling, and draining — supports liver function." },
      { name: "Skullcap", note: "Nervine relaxant that cools and calms without adding moisture." },
      { name: "Burdock Root", note: "Alterative and cooling, clearing damp heat." },
      { name: "Milk Thistle", note: "Liver-protective and cooling." },
      { name: "Cramp Bark", note: "Antispasmodic that releases tension in muscles." },
    ],
  },
  "Hot / Damp / Relaxed": {
    nickname: "The Overflowing Cup",
    description: [
      "You run warm, your body holds excess moisture, and your tissues lack tone.",
      "This constitution often shows up as someone who feels weighed down by their own abundance.",
      "Your path involves drying, cooling, and toning simultaneously.",
    ],
    herbs: [
      { name: "Yarrow", note: "Cooling, drying, and astringent — restores tone." },
      { name: "Sage", note: "Drying and mildly astringent, reduces excessive dampness." },
      { name: "Green Tea", note: "Gently stimulating, antioxidant-rich, and astringent." },
      { name: "Oregon Grape Root", note: "Bitter and cooling, clears damp heat." },
      { name: "Raspberry Leaf", note: "Nutritive and astringent, toning lax tissues." },
    ],
  },
  "Cold / Dry / Tense": {
    nickname: "The Drawn Bowstring",
    description: [
      "You are cold, dry, and tightly wound — like a bow drawn but never released.",
      "This is the constitution of someone who holds everything in.",
      "Your healing lies in warmth, moisture, and gentle release.",
    ],
    herbs: [
      { name: "Ashwagandha", note: "Warming, moistening adaptogen for depleted, tense constitutions." },
      { name: "Cinnamon", note: "Gently warming and stimulating to cold circulation." },
      { name: "Marshmallow Root", note: "Deeply moistening, softening dry, constricted tissues." },
      { name: "Milky Oat Tops", note: "Nervine trophorestorative for exhausted nervous systems." },
      { name: "Ginger", note: "Warming and stimulating to sluggish digestion." },
    ],
  },
  "Cold / Dry / Relaxed": {
    nickname: "The Spent Candle",
    description: [
      "You are depleted across all three axes — cold, dry, and without tone.",
      "This is often the constitution of deep exhaustion.",
      "Your path is the most gentle of all — slow, steady rebuilding.",
    ],
    herbs: [
      { name: "Shatavari", note: "Deeply nourishing, warming, and moistening." },
      { name: "Astragalus", note: "Warming and tonifying, strengthening immunity." },
      { name: "Licorice Root", note: "Moistening, warming, and restorative." },
      { name: "Rehmannia", note: "Blood-building and deeply moistening." },
      { name: "Bone Broth Herbs (Nettle, Oatstraw)", note: "Mineral-rich and gently building." },
    ],
  },
  "Cold / Damp / Tense": {
    nickname: "The Frozen River",
    description: [
      "You are cold and waterlogged, but held rigidly in place — like a river frozen mid-flow.",
      "This constitution combines stagnation with rigidity.",
      "Your healing requires gentle warming, drying herbs, and antispasmodics.",
    ],
    herbs: [
      { name: "Ginger", note: "Warming and drying, stimulating sluggish circulation." },
      { name: "Juniper Berry", note: "Warming, drying, and diuretic — moves stagnant fluid." },
      { name: "Rosemary", note: "Warming and stimulating to cold, tense tissue states." },
      { name: "Valerian", note: "Warming antispasmodic that releases deep-held tension." },
      { name: "Angelica Root", note: "Warming and aromatic, moving stagnant blood and fluid." },
    ],
  },
  "Cold / Damp / Relaxed": {
    nickname: "The Still Pond",
    description: [
      "You are the most yin of all constitutional types — cold, damp, and relaxed.",
      "This constitution often manifests as weight gain, chronic congestion, and fatigue.",
      "Your path is activation — gentle, sustained activation, not aggressive stimulation.",
    ],
    herbs: [
      { name: "Cinnamon", note: "Warming and drying, kindling metabolic fire." },
      { name: "Turmeric", note: "Warming, drying, and anti-inflammatory." },
      { name: "Sage", note: "Drying and astringent, toning lax tissues." },
      { name: "Eleuthero", note: "Warming adaptogen that builds sustained energy." },
      { name: "Thyme", note: "Warming, drying, and antimicrobial." },
    ],
  },
};

function computeResult(answers: Record<number, string>) {
  const axes = {
    temperature: { first: "Hot", second: "Cold", questions: [1, 2, 3, 4] },
    fluid: { first: "Damp", second: "Dry", questions: [5, 6, 7, 8] },
    tone: { first: "Tense", second: "Relaxed", questions: [9, 10, 11, 12] },
  };
  const results: string[] = [];
  for (const axis of Object.values(axes)) {
    let firstCount = 0;
    let secondCount = 0;
    for (const qId of axis.questions) {
      const score = answers[qId];
      if (score === axis.first) firstCount++;
      if (score === axis.second) secondCount++;
    }
    results.push(firstCount >= secondCount ? axis.first : axis.second);
  }
  return results.join(" / ");
}

interface AssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AssessmentModal = ({ open, onOpenChange }: AssessmentModalProps) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<"quiz" | "gate" | "results">("quiz");
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = phase !== "quiz" ? computeResult(answers) : "";
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  const q = questions[currentQ];
  const progress = phase === "quiz" ? ((currentQ + (answers[q.id] ? 1 : 0)) / questions.length) * 100 : 100;
  const axisLabel = q.axis === "temperature" ? "Temperature Axis" : q.axis === "fluid" ? "Fluid Axis" : "Tone Axis";

  const handleAnswer = useCallback((questionId: number, score: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
    setTransitioning(true);
    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((prev) => prev + 1);
      } else {
        setPhase("gate");
      }
      setTransitioning(false);
    }, 400);
  }, [currentQ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Single call — edge function handles all 3 topic subscriptions
      const { error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName,
          email,
          constitutionType,
          source: "constitution_assessment",
        },
      });
      if (fnError) throw fnError;

      setPhase("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setCurrentQ(0);
      setAnswers({});
      setPhase("quiz");
      setTransitioning(false);
      setFirstName("");
      setEmail("");
      setError("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-full h-full max-w-full max-h-full md:max-w-2xl md:max-h-[90vh] md:h-auto md:rounded-sm overflow-y-auto p-0 border-0 md:border md:border-eden-gold/20"
        style={{ backgroundColor: "#F5F0E8" }}
      >
        {/* Mobile close button */}
        <button
          onClick={() => handleClose(false)}
          className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <X size={24} style={{ color: "#1C3A2E" }} />
        </button>

        {/* Header */}
        <div className="px-5 md:px-6 py-4 md:py-5 border-b" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
          <div className="flex items-center justify-between pr-10">
            <span className="font-serif text-base md:text-lg font-bold" style={{ color: "#1C3A2E" }}>
              Constitutional Assessment
            </span>
            <span className="font-accent text-xs tracking-[0.2em] uppercase hidden sm:block" style={{ color: "#C9A84C" }}>
              The Eden Institute
            </span>
          </div>
        </div>

        {phase === "quiz" && (
          <div className="px-5 md:px-6 py-6 md:py-8">
            {/* Progress */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>
                  {axisLabel}
                </span>
                <span className="font-body text-sm" style={{ color: "#1C3A2E" }}>
                  {currentQ + 1} / {questions.length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ backgroundColor: "hsl(40, 20%, 80%)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: "#C9A84C" }}
                />
              </div>
            </div>

            {/* Question */}
            <div className={`transition-all duration-400 ${transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}>
              <h2 className="font-serif text-lg md:text-xl lg:text-2xl font-bold mb-5 md:mb-6" style={{ color: "#1C3A2E" }}>
                {q.question}
              </h2>
              <div className="space-y-3">
                {q.options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleAnswer(q.id, opt.score)}
                    className="w-full text-left p-4 border-2 rounded transition-all duration-200 hover:border-[#C9A84C] hover:shadow-md group min-h-[48px]"
                    style={{
                      borderColor: answers[q.id] === opt.score ? "#C9A84C" : "hsl(40, 20%, 80%)",
                      backgroundColor: answers[q.id] === opt.score ? "hsl(40, 55%, 50%, 0.08)" : "white",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full font-serif font-bold text-xs border-2 group-hover:border-[#C9A84C] group-hover:text-[#C9A84C] transition-colors"
                        style={{
                          borderColor: answers[q.id] === opt.score ? "#C9A84C" : "#1C3A2E",
                          color: answers[q.id] === opt.score ? "#C9A84C" : "#1C3A2E",
                        }}
                      >
                        {opt.label}
                      </span>
                      <span className="font-body text-sm md:text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
                        {opt.text}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "gate" && profile && (
          <div className="px-5 md:px-6 py-8 md:py-10 text-center">
            <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
              Your Constitutional Type
            </span>
            <h2 className="font-serif text-xl md:text-2xl lg:text-3xl font-bold mt-3 mb-2" style={{ color: "#1C3A2E" }}>
              {constitutionType}
            </h2>
            <p className="font-accent text-lg italic mb-6" style={{ color: "#C9A84C" }}>
              "{profile.nickname}"
            </p>

            <div className="p-5 md:p-6 border rounded text-left" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
              <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "#1C3A2E" }}>
                Get Your Full Constitutional Profile
              </h3>
              <p className="font-body text-sm mb-5" style={{ color: "hsl(30, 10%, 40%)" }}>
                Enter your name and email to unlock your full profile, personalized herb recommendations, and join our community.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Your first name"
                    className="w-full px-4 py-3 border font-body focus:outline-none transition-colors focus:border-[#C9A84C] min-h-[48px]"
                    style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }}
                  />
                </div>
                <div>
                  <label className="block font-accent text-xs tracking-[0.2em] uppercase mb-2" style={{ color: "hsl(30, 10%, 40%)" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border font-body focus:outline-none transition-colors focus:border-[#C9A84C] min-h-[48px]"
                    style={{ borderColor: "hsl(40, 20%, 80%)", color: "#1C3A2E", backgroundColor: "#F5F0E8" }}
                  />
                </div>
                {error && <p className="font-body text-sm text-destructive">{error}</p>}
                <Button variant="eden" size="xl" className="w-full min-h-[48px]" disabled={loading}>
                  {loading ? "Submitting…" : "→ Send Me My Results"}
                </Button>
                <p className="text-center font-body text-xs" style={{ color: "hsl(30, 10%, 40%, 0.6)" }}>
                  No spam. Unsubscribe anytime.
                </p>
              </form>
            </div>
          </div>
        )}

        {phase === "results" && profile && (
          <div className="px-5 md:px-6 py-8 md:py-10">
            <div className="text-center mb-6 md:mb-8">
              <p className="font-body text-sm mb-3" style={{ color: "#C9A84C" }}>
                ✓ Your results are on their way. Check your inbox.
              </p>
              <span className="font-accent text-sm tracking-[0.3em] uppercase" style={{ color: "#C9A84C" }}>
                Your Constitutional Type
              </span>
              <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl font-bold mt-3 mb-2" style={{ color: "#1C3A2E" }}>
                {constitutionType}
              </h2>
              <p className="font-accent text-lg md:text-xl italic" style={{ color: "#C9A84C" }}>
                "{profile.nickname}"
              </p>
            </div>

            <div className="space-y-4 mb-8 md:mb-10">
              {profile.description.map((para, i) => (
                <p key={i} className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
                  {para}
                </p>
              ))}
            </div>

            <h3 className="font-serif text-xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
              Your Top 5 Herbs
            </h3>
            <div className="space-y-3 mb-8">
              {profile.herbs.map((herb, i) => (
                <div key={i} className="p-4 border rounded" style={{ borderColor: "hsl(40, 20%, 80%)", backgroundColor: "white" }}>
                  <h4 className="font-serif text-base font-bold mb-1" style={{ color: "#C9A84C" }}>
                    {herb.name}
                  </h4>
                  <p className="font-body text-sm" style={{ color: "#1C3A2E" }}>
                    {herb.note}
                  </p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Button variant="eden" size="lg" className="w-full md:w-auto min-h-[48px]" onClick={() => handleClose(false)}>
                ← Back to Home
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssessmentModal;
