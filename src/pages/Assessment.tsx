import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  constitutionProfiles,
  computeResult,
  isInconclusiveResult,
  inconclusiveAxes,
} from "@/lib/constitution-data";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveProfileOptional } from "@/contexts/ActiveProfileContext";
import { useQueryClient } from "@tanstack/react-query";

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
  { id: 8, axis: "fluid", question: "How would you describe your body's build?", options: [
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

/**
 * Assessment — the 12-question Pattern of Eden quiz.
 *
 * Two modes (per Manual §0.8 #40 + v3.14 Session Log):
 *
 *   1. MARKETING mode (default). Mounted at `/assessment`. Anonymous flow:
 *      quiz → email-capture gate → resend-waitlist (lead capture) +
 *      record-quiz-completion (email-keyed marketing pipeline) → results.
 *      Inconclusive routes per Lock #39 (no silent defaults).
 *
 *   2. DIAGNOSTIC mode. Mounted at `/apothecary/quiz?profileId=<uuid>`,
 *      gated by RequireAuth + RequireTier(allow=["root","practitioner"]).
 *      Auth'd flow: quiz → record-diagnostic-completion (id-keyed clinical
 *      pipeline writing person_profiles.eden_constitution for the supplied
 *      profileId, NEVER touching the email-keyed marketing pipeline) →
 *      redirect back to /apothecary/start with the picker pointing at the
 *      now-personalized profile.
 *
 *   Mode is decided by presence of `?profileId=<uuid>` in the URL search.
 *   When in DIAGNOSTIC mode, the marketing header is suppressed because
 *   ApothecaryLayout already provides nav + the picker pill.
 *
 * Lock #40 separation: the two pipelines are NEVER mixed. A diagnostic-mode
 * completion does NOT call resend-waitlist or record-quiz-completion.
 */
const Assessment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const profileCtx = useActiveProfileOptional();

  // Diagnostic-mode detection: `?profileId=<uuid>` AND we are inside the
  // ApothecaryLayout (provider mounted) AND the supplied id matches one
  // of the user's profiles. The route-level RequireAuth + RequireTier
  // already enforce auth + Root tier; we additionally verify ownership
  // here to guard against a forged URL. Server-side, record-diagnostic-
  // completion re-checks ownership against auth.uid(), so this is a UX
  // guard, not a security boundary.
  const profileIdParam = searchParams.get("profileId");
  const targetProfile = useMemo(() => {
    if (!profileIdParam) return null;
    if (!profileCtx) return null;
    return profileCtx.profiles.find((p) => p.id === profileIdParam) ?? null;
  }, [profileIdParam, profileCtx]);
  const diagnosticMode = profileIdParam !== null && targetProfile !== null;
  const profileLookupPending =
    profileIdParam !== null && (profileCtx?.isLoading ?? false);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<
    "quiz" | "gate" | "inconclusive" | "results" | "diagnostic-saving" | "diagnostic-saved"
  >("quiz");
  const [transitioning, setTransitioning] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const constitutionType = phase !== "quiz" ? computeResult(answers) : "";
  const isInconclusive = constitutionType ? isInconclusiveResult(constitutionType) : false;
  const neutralAxes = constitutionType && isInconclusive ? inconclusiveAxes(constitutionType) : [];
  const profile = constitutionType ? constitutionProfiles[constitutionType] : null;

  // ── Diagnostic-mode submit: call record-diagnostic-completion ──
  // Skips email gate entirely. On success, invalidates the per-profile
  // diagnostic_profile_v2 + eden_pattern_v2 query keys so the picker-driven
  // hooks re-render the new Pattern, and the person_profiles list cache so
  // the picker dropdown reflects the new state. Then redirects to
  // /apothecary/start which has the directory + PatternMatchHero.
  const submitDiagnostic = useCallback(async (answersToSubmit: Record<number, string>) => {
    if (!targetProfile || !user) {
      setError("Missing profile context. Please reload and try again.");
      return;
    }
    setPhase("diagnostic-saving");
    setError("");
    try {
      const result = computeResult(answersToSubmit);
      // Inconclusive results don't write — surfaced to the user via the
      // inconclusive phase instead. We never silently default per Lock #39.
      if (isInconclusiveResult(result)) {
        setPhase("inconclusive");
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke(
        "record-diagnostic-completion",
        {
          body: {
            personProfileId: targetProfile.id,
            edenConstitution: result, // EF accepts axis-label form + normalizes to slug
            // Per Lock #40 strict separation, the in-app 12-q diagnostic
            // tags its writes with `v1-diagnostic`. The marketing-pipeline
            // `v1` namespace lives only on quiz_completions.
            quizVersion: "v1-diagnostic",
          },
        },
      );
      if (fnError) throw fnError;
      // EF v3.16 returns `{ error: { code, message } }` on failure (wire-stable
      // contract). Surface the message; UI may branch on `code` if needed.
      if (data?.error) {
        const msg = typeof data.error === "string"
          ? data.error
          : (data.error.message ?? "Could not save your Pattern. Please try again.");
        throw new Error(msg);
      }

      // Invalidate the picker-driven hooks + person_profiles so the new
      // Pattern shows up immediately on the directory.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["person_profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["eden_pattern_v2"] }),
        queryClient.invalidateQueries({ queryKey: ["diagnostic_profile_v2"] }),
      ]);

      setPhase("diagnostic-saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not save your Pattern. Please try again.";
      setError(message);
      setPhase("gate"); // surface the error inside the gate-style screen so user can retry
    }
  }, [targetProfile, user, queryClient]);

  // Auto-redirect after diagnostic save with a short pause for confirmation.
  useEffect(() => {
    if (phase === "diagnostic-saved") {
      const t = setTimeout(() => {
        navigate("/apothecary/start", { replace: true });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [phase, navigate]);

  const handleAnswer = useCallback((questionId: number, score: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: score };
      setTransitioning(true);
      setTimeout(() => {
        if (currentQ < questions.length - 1) {
          setCurrentQ((p) => p + 1);
        } else {
          const result = computeResult(next);
          if (isInconclusiveResult(result)) {
            setPhase("inconclusive");
          } else if (diagnosticMode) {
            // Diagnostic mode: skip the email gate, go straight to the EF.
            submitDiagnostic(next);
          } else {
            // Marketing mode: enter email-capture gate.
            setPhase("gate");
          }
        }
        setTransitioning(false);
      }, 400);
      return next;
    });
  }, [currentQ, diagnosticMode, submitDiagnostic]);

  const restartQuiz = useCallback(() => {
    setAnswers({});
    setCurrentQ(0);
    setPhase("quiz");
    setError("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("resend-waitlist", {
        body: {
          firstName,
          email,
          constitutionType,
          constitutionNickname: profile?.nickname,
          source: "constitution_assessment",
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Constitution capture for /apothecary personalization (independent of
      // marketing-consent). Failure here must NOT block the result reveal —
      // personalization is recoverable (the user can retake the quiz post-
      // signup) but a blocked results page is not.
      try {
        const { data: recordData, error: recordError } =
          await supabase.functions.invoke("record-quiz-completion", {
            body: {
              email,
              first_name: firstName,
              constitution_type: constitutionType,
              constitution_nickname: profile?.nickname,
            },
          });
        if (recordError) {
          console.error("record-quiz-completion failed", recordError);
        } else if (recordData?.error) {
          console.error("record-quiz-completion returned error", recordData.error);
        }
      } catch (recordErr) {
        console.error("record-quiz-completion threw", recordErr);
      }

      setPhase("results");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const q = questions[currentQ];
  const progress = phase === "quiz" ? ((currentQ + (answers[q.id] ? 1 : 0)) / questions.length) * 100 : 100;
  const axisLabel = q.axis === "temperature" ? "Temperature Axis" : q.axis === "fluid" ? "Fluid Axis" : "Tone Axis";

  // Profile-lookup pending: we have a profileId in the URL but the profile
  // list query hasn't resolved yet. Render a brief loading state — once
  // profiles hydrate we either enter diagnostic mode (target found) or
  // fall through to a 404-style message (target not found / not owned).
  if (profileLookupPending) {
    return (
      <div className={diagnosticMode ? "" : "min-h-screen"} style={!diagnosticMode ? { backgroundColor: "#F5F0E8" } : undefined}>
        <div className="max-w-xl mx-auto px-6 py-16 text-center font-body" style={{ color: "#1C3A2E" }}>
          Loading profile…
        </div>
      </div>
    );
  }

  // profileId param supplied but no matching profile under this user —
  // either bad URL or not owned. RequireAuth + RequireTier already gate the
  // route, so reaching this means the URL is wrong; surface a clear message
  // rather than silently re-mounting the marketing flow.
  if (profileIdParam !== null && !targetProfile && profileCtx !== null) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h2 className="font-serif text-2xl font-bold mb-3" style={{ color: "#1C3A2E" }}>
          Profile not found
        </h2>
        <p className="font-body text-base mb-6" style={{ color: "#1C3A2E" }}>
          The profile you tried to take the quiz for doesn't belong to your account or no longer exists.
        </p>
        <Button variant="eden" size="lg" onClick={() => navigate("/apothecary/profiles")}>
          Manage profiles
        </Button>
      </div>
    );
  }

  return (
    <div className={diagnosticMode ? "" : "min-h-screen"} style={!diagnosticMode ? { backgroundColor: "#F5F0E8" } : undefined}>
      {/* Marketing-mode header. Suppressed in diagnostic mode because the
          ApothecaryLayout already provides nav + picker pill. */}
      {!diagnosticMode && (
        <header className="px-6 py-6 border-b" style={{ borderColor: "hsl(40, 20%, 80%)" }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <a href="/" className="font-serif text-lg font-bold" style={{ color: "#1C3A2E" }}>
              The Eden Institute
            </a>
            <span className="font-accent text-sm tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>
              Body Pattern Quiz
            </span>
          </div>
        </header>
      )}

      {/* Diagnostic-mode banner — establishes "whose quiz is this?" so the
          user is never ambiguous about which profile they're personalizing. */}
      {diagnosticMode && targetProfile && phase === "quiz" && (
        <div className="max-w-2xl mx-auto px-6 pt-8">
          <p className="font-accent text-xs tracking-[0.2em] uppercase mb-1" style={{ color: "#C9A84C" }}>
            Pattern of Eden Quiz
          </p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold" style={{ color: "#1C3A2E" }}>
            {targetProfile.is_self ? "For you" : `For ${targetProfile.name}`}
          </h1>
        </div>
      )}

      {phase === "quiz" && (
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Progress */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <span className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>
                {axisLabel}
              </span>
              <span className="font-body text-sm" style={{ color: "#1C3A2E" }}>
                Question {currentQ + 1} of {questions.length}
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
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8" style={{ color: "#1C3A2E" }}>
              {q.question}
            </h2>
            <div className="space-y-4">
              {q.options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleAnswer(q.id, opt.score)}
                  className="w-full text-left p-5 border-2 rounded transition-all duration-200 hover:border-[#C9A84C] hover:shadow-md group min-h-[44px]"
                  style={{
                    borderColor: answers[q.id] === opt.score ? "#C9A84C" : "hsl(40, 20%, 80%)",
                    backgroundColor: answers[q.id] === opt.score ? "hsl(40, 55%, 50%, 0.08)" : "white",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-serif font-bold text-sm border-2 group-hover:border-[#C9A84C] group-hover:text-[#C9A84C] transition-colors"
                      style={{
 