import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Three-step onboarding tour for first-time signed-in users.
 *
 * Reached two ways:
 *   1. Email confirmation link (AuthForm sets emailRedirectTo to this URL).
 *   2. Direct sign-up with active session and no return_to (AuthForm
 *      navigates here on the immediate-session branch).
 *
 * Skipping or finishing routes the user to /apothecary (the directory).
 * The tour is intentionally URL-addressable so users can revisit it.
 *
 * No data writes here — that lands in Stage 6.3.5 with person_profiles.
 */
export default function WelcomeTour() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const finish = () => navigate("/apothecary", { replace: true });

  const card = STEPS[step];

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-6">
      <div
        className="max-w-xl w-full rounded-lg border p-8 md:p-10 shadow-sm"
        style={{
          borderColor: "hsl(var(--border))",
          backgroundColor: "hsl(var(--background))",
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="h-1.5 w-8 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i <= step
                    ? "hsl(var(--eden-gold))"
                    : "hsl(var(--border))",
              }}
            />
          ))}
        </div>

        <p
          className="font-accent text-xs tracking-[0.3em] uppercase text-center mb-3"
          style={{ color: "hsl(var(--eden-gold))" }}
        >
          {card.kicker}
        </p>
        <h1
          className="font-serif text-3xl md:text-4xl font-bold leading-tight text-center mb-4"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          {card.title}
        </h1>
        <div className="font-body text-base text-muted-foreground leading-relaxed text-center space-y-3 mb-8">
          {card.body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
          <button
            type="button"
            onClick={finish}
            className="font-body text-sm underline text-muted-foreground hover:opacity-70"
          >
            Skip tour
          </button>
          <div className="flex gap-3">
            {step > 0 && (
              <Button
                variant="eden-outline"
                size="lg"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                variant="eden"
                size="lg"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Next
              </Button>
            ) : (
              <Button variant="eden" size="lg" asChild>
                <Link to="/apothecary">Enter the directory</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    kicker: "Welcome",
    title: "A clinical reasoning partner.",
    body: [
      "Eden Apothecary is built around how the body actually organizes itself — temperature, moisture, tone, tissue state, organ system — not around symptom-to-herb shortcuts.",
      "Every herb is taught against a terrain. Every terrain is taught against a pattern.",
    ],
  },
  {
    kicker: "How tiers work",
    title: "All hundred herbs. Tiers unlock depth.",
    body: [
      "Free shows the identity and population safety of every herb. Seed unlocks the clinical body — actions, tissue states, constitutional matches. Root adds drug interactions, refer thresholds, and source citations.",
      "You'll never be told a herb doesn't exist. You'll see exactly what depth your tier can read.",
    ],
  },
  {
    kicker: "What's next",
    title: "Find your pattern when you're ready.",
    body: [
      "The Pattern of Eden quiz maps you to one of eight constitutional patterns drawn from a 3-axis terrain model. Take it whenever — your result is saved to your account.",
      "Or start browsing the directory now.",
    ],
  },
];
