import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { constitutionProfiles, computeResult } from "@/lib/constitution-data";
import { getNameFromType, getSlugFromType } from "@/lib/constitution-utils";

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

interface AssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AssessmentModal = ({ open, onOpenChange }: AssessmentModalProps) => {
  const navigate = useNavigate();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<"intro" | "quiz" | "gate" | "results">("intro");
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = (phase === "gate" || phase === "results") ? computeResult(answers) : "";
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  const q = questions[currentQ];
  const progress = phase === "quiz" ? ((currentQ + (answers[q.id] ? 1 : 0)) / questions.length) * 100 : 100;
  const axisLabel = q.axis === "temperature" ? "Temperature Axis" : q.axis === "fluid" ? "Fluid Axis" : "Tone Axis";

  const handleAnswer = useCallback((questionId: number, score: string) => {
    if (currentQ === 0) {
      (window as any).gtag?.('event', 'quiz_start', { event_category: 'engagement' });
    }
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
      const { error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName,
          email,
          constitutionType,
          constitutionSlug: getSlugFromType(constitutionType),
          constitutionName: getNameFromType(constitutionType),
          constitutionNickname: profile?.nickname,
          source: "constitution_assessment",
        },
      });
      if (fnError) throw fnError;

      (window as any).gtag?.('event', 'email_submit', { event_category: 'conversion' });
      (window as any).gtag?.('event', 'quiz_complete', { event_category: 'engagement', quiz_result: constitutionType });
      const slug = getSlugFromType(constitutionType);
      handleClose(false);
      navigate(`/results/${slug}`);
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
      setPhase("intro");
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

        {phase === "intro" && (
          <div className="px-5 md:px-6 py-8 md:py-12 text-center">
            <h2 className="font-serif text-xl md:text-2xl lg:text-3xl font-bold mb-6" style={{ color: "#1C3A2E" }}>
              Discover Your Constitutional Type
            </h2>
            <p className="font-body text-base md:text-lg leading-relaxed mb-8 max-w-lg mx-auto" style={{ color: "hsl(30, 10%, 40%)", fontFamily: "'EB Garamond', 'Crimson Text', Georgia, serif" }}>
              Most people have tried herbs and gotten inconsistent results. That's because herbalism is not one-size-fits-all — your body has a type. Answer 12 questions to discover yours. No email required to start.
            </p>
            <Button
              variant="eden"
              size="xl"
              className="min-h-[48px] w-full sm:w-auto"
              onClick={() => setPhase("quiz")}
            >
              → Begin the Quiz
            </Button>
          </div>
        )}

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
              {profile.nickname}
            </h2>
            <p className="font-body text-base mb-1" style={{ color: "#1C3A2E" }}>
              {constitutionType}
            </p>
            <p className="font-accent text-base italic mb-6" style={{ color: "#C9A84C" }}>
              {profile.tagline}
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
            {/* Section A: Type Header */}
            <div className="text-center mb-6 md:mb-8">
              <p className="font-body text-sm mb-1" style={{ color: "#C9A84C" }}>
                ✓ Your results are on their way. Check your inbox.
              </p>
              <p className="font-body text-xs italic mb-3" style={{ color: "#C9A84C", opacity: 0.8 }}>
                Using Gmail? Your first email may arrive in your Promotions or Spam folder. Please move it to your Primary inbox so you don't miss anything from us.
              </p>
              <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl font-bold mt-3 mb-2" style={{ color: "#1C3A2E" }}>
                {profile.nickname}
              </h2>
              <p className="font-body text-base mb-1" style={{ color: "#1C3A2E" }}>
                {constitutionType}
              </p>
              <p className="font-accent text-base italic" style={{ color: "#C9A84C" }}>
                {profile.tagline}
              </p>
            </div>

            {/* Section B: Pattern Summary */}
            <div className="space-y-4 mb-8 md:mb-10">
              {profile.description.map((para, i) => (
                <p key={i} className="font-body text-base leading-relaxed" style={{ color: "#1C3A2E" }}>
                  {para}
                </p>
              ))}
            </div>

            {/* Section C: Top 3 Herbs */}
            <h3 className="font-serif text-xl font-bold mb-4" style={{ color: "#1C3A2E" }}>
              Your Top 3 Herbs
            </h3>
            <div className="space-y-3 mb-8">
              {profile.herbs.slice(0, 3).map((herb, i) => (
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

            {/* Section D: $14 Deep-Dive Guide Upsell */}
            <div className="p-5 md:p-6 border-2 rounded mb-8" style={{ borderColor: "#C9A84C", backgroundColor: "white" }}>
              <h3 className="font-serif text-lg font-bold mb-3" style={{ color: "#1C3A2E" }}>
                Your {profile.nickname.replace(/^The /, '')} Deep-Dive Guide
              </h3>
              <p className="font-body text-sm leading-relaxed mb-4" style={{ color: "#1C3A2E" }}>
                Everything God designed into your body — and every plant He made to meet it. 10 matched herbs with clinical actions explained in plain language. Nutrition, lifestyle, and spiritual guidance for your specific pattern. Biblical anchors. Preparation methods. Caution herbs to avoid.
              </p>
              <p className="font-serif text-2xl font-bold mb-4" style={{ color: "#C9A84C" }}>
                $14
              </p>
              <Button
                variant="eden"
                size="lg"
                className="w-full min-h-[48px]"
                data-product="constitution-guide"
                disabled={checkoutLoading}
                onClick={async () => {
                  setCheckoutLoading(true);
                  try {
                    const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
                      body: {
                        constitution_type: constitutionType,
                        constitution_nickname: profile?.nickname,
                        email,
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
                {checkoutLoading ? "Redirecting to checkout…" : "Get Your Full Guide — $14"}
              </Button>
            </div>

            {/* Section E: Amazon Herb Kit */}
            <div className="p-5 md:p-6 rounded mb-8" style={{ backgroundColor: "#F5F0E8" }}>
              <h3 className="font-serif text-lg font-bold mb-3" style={{ color: "#1C3A2E" }}>
                Your Starter Herb Kit
              </h3>
              <p className="font-body text-sm leading-relaxed mb-4" style={{ color: "#1C3A2E" }}>
                We curated the exact herbs for your body type on Amazon. One-click shopping list — everything you need to get started.
              </p>
              <a
                href={profile.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full px-6 py-3 font-serif font-bold text-sm tracking-wider uppercase transition-colors min-h-[48px] rounded"
                style={{ backgroundColor: "#1C3A2E", color: "#F5F0E8" }}
              >
                Shop Your Kit on Amazon
              </a>
              <p className="font-body text-xs text-center mt-2" style={{ color: "hsl(30, 10%, 40%, 0.6)" }}>
                Affiliate link — I earn a small commission at no cost to you.
              </p>
            </div>

            {/* Section F: Course CTA */}
            <div className="p-6 md:p-8 rounded text-center mb-6" style={{ backgroundColor: "#1C3A2E" }}>
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "#C9A84C" }}>
                Ready to Go Deeper?
              </h3>
              <p className="font-body text-base mb-6" style={{ color: "#F5F0E8" }}>
                The Foundations Course teaches you how to read your constitution and match it to God's provision in the plant world.
              </p>
              <a
                href="/why-eden"
                className="inline-flex items-center justify-center px-8 py-3 font-serif font-bold text-sm tracking-wider uppercase transition-colors min-h-[48px] rounded"
                style={{ backgroundColor: "#C9A84C", color: "#1C3A2E" }}
              >
                Learn About the Foundations Course
              </a>
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
