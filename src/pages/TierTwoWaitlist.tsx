import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Sparkles, Lock, Calendar } from "lucide-react";
import { z } from "zod";

const PAGE_TITLE = "Tier 2 — Seeking Partners | The Eden Institute";
const PAGE_DESCRIPTION =
  "Tier 2: Body Systems & Clinical Literacy. We are currently seeking aligned partners, investors, and collaborators to help bring this stage of Eden Institute to life.";

const signupSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { message: "First name is required" })
    .max(100, { message: "First name must be less than 100 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
});

const TierTwoWaitlist = () => {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // SEO meta
  useEffect(() => {
    document.title = PAGE_TITLE;

    const ensureMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(selector.startsWith("link") ? "link" : "meta") as any;
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };

    ensureMeta('meta[name="description"]', { name: "description", content: PAGE_DESCRIPTION });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: PAGE_TITLE });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: PAGE_DESCRIPTION });
    ensureMeta('link[rel="canonical"]', { rel: "canonical", href: "https://edeninstitute.health/tier-2-waitlist" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ firstName, email });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Please check your inputs");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("tier-2-waitlist-signup", {
        body: { firstName: parsed.data.firstName, email: parsed.data.email },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      try {
        (window as any).gtag?.("event", "tier_2_partner_inquiry", {
          event_category: "lead",
        });
      } catch { /* noop */ }

      setSubmitted(true);
    } catch (err) {
      console.error("Tier 2 partner inquiry failed:", err);
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* HERO */}
      <section
        className="py-20 md:py-28 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="font-accent text-sm tracking-[0.3em] uppercase mb-6"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Tier 2 · Seeking Partners
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            You've Mastered the Foundation.
            <br />
            <span className="italic">Now Go Clinical.</span>
          </h1>
          <div
            className="w-16 h-px mx-auto my-8"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Tier 2 — <em>Body Systems &amp; Clinical Literacy</em> — is the next stage of the Eden Institute curriculum.
            We are currently seeking aligned partners, investors, and collaborators to help bring it to life. If you
            share our vision for faith-grounded, terrain-based health education, we would love to connect.
          </p>
          <div className="mt-10">
            <a
              href="#waitlist-form"
              className="inline-block"
            >
              <Button variant="eden" size="xl">
                Connect With Us
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* WHAT TIER 2 COVERS */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="font-serif text-3xl md:text-4xl font-bold mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Fourteen Modules. 127 Lessons. Every Body System.
          </h2>
          <div
            className="w-16 h-px mx-auto my-6"
            style={{ backgroundColor: "hsl(var(--eden-gold))" }}
          />
          <p className="font-body text-lg leading-relaxed text-muted-foreground">
            Where Tier 1 taught you to read terrain, Tier 2 teaches you to read the body itself. Every major body system —
            digestive, hepatobiliary, cardiovascular, respiratory, nervous, endocrine, immune, urinary, musculoskeletal,
            integumentary, reproductive — studied through a terrain lens with Scripture as the anchor. This is where students
            stop dabbling and start practicing.
          </p>
        </div>
      </section>

      {/* WHAT PARTNERS GET — 3 CARDS */}
      <section
        className="py-20 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="font-accent text-sm tracking-[0.3em] uppercase mb-4"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              Partnership Opportunities
            </p>
            <h2
              className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              How Partners Help Build the Next Stage
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <article
              className="rounded-lg p-8 border-2 bg-background"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <Sparkles className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
                Shape the Curriculum
              </h3>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Aligned partners get a seat at the table while Tier 2 is being built — helping shape the modules, the
                clinical case framing, and the pedagogy from the inside.
              </p>
            </article>
            <article
              className="rounded-lg p-8 border-2 bg-background"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <Lock className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
                Lasting Recognition
              </h3>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Founding partners are recognized inside the program and across Eden Institute materials. This is for
                people who want to help build something that lasts — not just buy a course.
              </p>
            </article>
            <article
              className="rounded-lg p-8 border bg-background"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <CheckCircle2 className="w-7 h-7 mb-4" style={{ color: "hsl(var(--eden-sage))" }} />
              <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "hsl(var(--eden-bark))" }}>
                A Real Conversation
              </h3>
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                Reach out and we'll set up a real conversation. No obligation. We're looking for people whose vision
                aligns with ours — faith-grounded, terrain-based, clinically serious.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* WHAT WE'RE BUILDING */}
      <section
        className="py-20 px-6"
        style={{ backgroundColor: "hsl(var(--eden-forest))" }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="font-accent text-sm tracking-[0.3em] uppercase mb-4"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              The Vision
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white">
              Three Pillars of the Next Stage
            </h2>
          </div>
          <ol className="grid md:grid-cols-3 gap-6">
            <li
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: "hsl(var(--eden-gold) / 0.4)",
              }}
            >
              <Calendar className="w-6 h-6 mb-3" style={{ color: "hsl(var(--eden-gold))" }} />
              <p
                className="font-accent text-xs tracking-[0.2em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Curriculum
              </p>
              <p className="font-serif text-lg font-semibold text-white mb-2">Clinical Body Systems</p>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                14 modules across every major body system, terrain-based and Scripture-anchored.
              </p>
            </li>
            <li
              className="rounded-lg p-6 border-2"
              style={{
                backgroundColor: "rgba(197,164,78,0.12)",
                borderColor: "hsl(var(--eden-gold))",
              }}
            >
              <Calendar className="w-6 h-6 mb-3" style={{ color: "hsl(var(--eden-gold))" }} />
              <p
                className="font-accent text-xs tracking-[0.2em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Partnership
              </p>
              <p className="font-serif text-lg font-semibold text-white mb-2">Seeking Aligned Partners</p>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                Investors, collaborators, and contributors who share our vision and want to help build it with us.
              </p>
            </li>
            <li
              className="rounded-lg p-6 border"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: "hsl(var(--eden-gold) / 0.4)",
              }}
            >
              <Calendar className="w-6 h-6 mb-3" style={{ color: "hsl(var(--eden-gold))" }} />
              <p
                className="font-accent text-xs tracking-[0.2em] uppercase mb-2"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Mission
              </p>
              <p className="font-serif text-lg font-semibold text-white mb-2">Built to Last</p>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                A serious, rigorous clinical herbalism education for Christian families and practitioners.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* CONTACT FORM */}
      <section
        id="waitlist-form"
        className="py-20 md:py-24 px-6"
        style={{ backgroundColor: "hsl(var(--eden-cream))" }}
      >
        <div className="max-w-xl mx-auto">
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <h2
                  className="font-serif text-3xl md:text-4xl font-bold mb-4"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  Connect With Us
                </h2>
                <p className="font-body text-base text-muted-foreground">
                  Share your name and email and we'll be in touch personally. Or email us directly at{" "}
                  <a
                    href="mailto:hello@edeninstitute.health"
                    className="underline"
                    style={{ color: "hsl(var(--eden-gold))" }}
                  >
                    hello@edeninstitute.health
                  </a>
                  .
                </p>
              </div>
              <form
                onSubmit={handleSubmit}
                className="rounded-lg p-8 bg-background border space-y-5"
                style={{ borderColor: "hsl(var(--eden-gold) / 0.4)" }}
              >
                <div>
                  <Label htmlFor="firstName" className="font-body text-sm mb-2 block">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    maxLength={100}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your first name"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="font-body text-sm mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={submitting}
                  />
                </div>
                {error && (
                  <p className="font-body text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="eden"
                  size="xl"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Connect With Us"}
                </Button>
                <p className="font-body text-xs text-center text-muted-foreground">
                  No spam. Unsubscribe anytime.
                </p>
              </form>
            </>
          ) : (
            <div
              className="rounded-lg p-10 bg-background border-2 text-center"
              style={{ borderColor: "hsl(var(--eden-gold))" }}
            >
              <div className="flex justify-center mb-4">
                <CheckCircle2
                  className="w-12 h-12"
                  style={{ color: "hsl(var(--eden-gold))" }}
                  aria-hidden="true"
                />
              </div>
              <h2
                className="font-serif text-3xl font-bold mb-4"
                style={{ color: "hsl(var(--eden-bark))" }}
              >
                Thank you — we'll be in touch.
              </h2>
              <div
                className="w-12 h-px mx-auto mb-6"
                style={{ backgroundColor: "hsl(var(--eden-gold))" }}
              />
              <p className="font-body text-base leading-relaxed text-muted-foreground">
                We received your note. A real person will reach out personally to continue the conversation.
              </p>
              <p className="font-body text-base leading-relaxed text-muted-foreground mt-4">
                In the meantime, check your inbox — your confirmation is on its way.{" "}
                <strong style={{ color: "hsl(var(--eden-bark))" }}>Using Gmail?</strong> Your first email may
                arrive in Promotions or Spam — please move it to your Primary inbox so you don't miss our reply.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TierTwoWaitlist;
