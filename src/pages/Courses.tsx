import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle, Clock, GraduationCap, Users } from "lucide-react";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import AssessmentModal from "@/components/landing/AssessmentModal";
import { Button } from "@/components/ui/button";

const T1 = "https://learn.edeninstitute.health/course/back-to-eden1";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/app", label: "App" },
  { to: "/homeschool", label: "Homeschool" },
  { to: "/community", label: "Community" },
  { to: "/why-eden", label: "Why Eden" },
];

const Courses = () => {
  const [quiz, setQuiz] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="px-6 py-20 md:py-28" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="mb-6 font-accent text-sm uppercase tracking-[0.3em]"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Biblical Clinical Herbalism
          </p>
          <h1
            className="mb-6 font-serif text-4xl font-bold leading-tight md:text-5xl lg:text-6xl"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Learn to Read the Body.
            <br />
            <span className="italic">Match the Plant. Steward the Family.</span>
          </h1>
          <div className="mx-auto my-8 h-px w-16" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="mx-auto mb-10 max-w-2xl font-body text-lg leading-relaxed text-muted-foreground">
            A three-tier, faith-rooted curriculum for Christian families — from the biblical
            foundations of plant medicine through terrain-based clinical herbalism.
          </p>
          <blockquote className="scripture-block mx-auto mb-10 max-w-xl text-left text-sm text-muted-foreground">
            "He causeth the grass to grow for the cattle, and herb for the service of man."
            <footer
              className="mt-2 font-body text-xs font-medium uppercase tracking-wider not-italic"
              style={{ color: "hsl(var(--eden-forest))" }}
            >
              — Psalm 104:14 (KJV)
            </footer>
          </blockquote>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a href={T1} target="_blank" rel="noopener noreferrer">
              <Button variant="eden" size="xl">
                Enroll in Tier 1 — $197
              </Button>
            </a>
            <Button variant="eden-outline" size="xl" onClick={() => setQuiz(true)}>
              Take the Free Quiz First
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2
              className="mb-4 font-serif text-3xl font-bold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Three Tiers. One Coherent Path.
            </h2>
            <p className="mx-auto max-w-2xl font-body text-muted-foreground">
              Each tier builds on the last — from Biblical foundations to clinical practice.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div
              className="relative rounded-lg border-2 p-8"
              style={{
                borderColor: "hsl(var(--eden-gold))",
                backgroundColor: "hsl(var(--eden-cream))",
              }}
            >
              <span
                className="absolute -top-3 left-6 rounded px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                style={{
                  backgroundColor: "hsl(var(--eden-gold))",
                  color: "hsl(var(--eden-bark))",
                }}
              >
                Available Now
              </span>
              <BookOpen className="mb-4 h-8 w-8" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="mb-1 font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
                Tier 1 — Biblical Framework
              </h3>
              <p className="my-4 font-body text-sm leading-relaxed text-muted-foreground">
                The theological foundation of plant medicine. Creation-based health, the Five
                Tenets, and your body type.
              </p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-forest))" }}
                  />
                  10 lessons, self-paced
                </li>
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-forest))" }}
                  />
                  Body Type Quiz included
                </li>
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-forest))" }}
                  />
                  Certificate of completion
                </li>
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-forest))" }}
                  />
                  Lifetime access
                </li>
              </ul>
              <p className="mb-4 text-center font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
                $197
              </p>
              <a href={T1} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="eden" className="w-full">
                  Enroll Now
                </Button>
              </a>
            </div>

            <div className="mt-8 rounded-sm border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.4)" }}>
              <div>
                <p className="font-accent text-xs tracking-widest uppercase mb-1" style={{ color: "hsl(var(--eden-gold))" }}>
                  Companion Textbook · Tier 1
                </p>
                <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-forest))" }}>
                  Back to Eden: Foundations of Biblical Herbalism
                </h3>
                <p className="font-body text-sm" style={{ color: "hsl(var(--eden-bark) / 0.75)" }}>
                  The print companion to the Tier 1 course. Read it alongside the lessons or give it as a gift to someone beginning their herbal journey.
                </p>
              </div>
              <a href="https://edeninstitute.health" target="_blank" rel="noopener noreferrer"
                className="shrink-0 font-body text-sm font-semibold px-6 py-3 rounded-sm text-center"
                style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}>
                Get the Book →
              </a>
            </div>

            <div className="relative rounded-lg border p-8" style={{ borderColor: "hsl(var(--eden-sage))" }}>
              <span
                className="absolute -top-3 left-6 rounded px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white"
                style={{ backgroundColor: "hsl(var(--eden-sage))" }}
              >
                Launches July 7
              </span>
              <GraduationCap className="mb-4 h-8 w-8" style={{ color: "hsl(var(--eden-sage))" }} />
              <h3 className="mb-1 font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
                Tier 2 — Body Systems
              </h3>
              <p className="my-4 font-body text-sm leading-relaxed text-muted-foreground">
                14 modules through every major body system through a terrain-based, Biblical lens.
              </p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-sage))" }}
                  />
                  127 lessons across 14 modules
                </li>
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-sage))" }}
                  />
                  Full clinical textbook included
                </li>
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-sage))" }}
                  />
                  Herb-matching protocols
                </li>
                <li className="flex gap-2">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    style={{ color: "hsl(var(--eden-sage))" }}
                  />
                  Early bird for Tier 1 students
                </li>
              </ul>
              <p className="mb-4 text-center font-body text-sm text-muted-foreground">
                Opening July 7, 2026
              </p>
              <a href={T1} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="eden-outline" className="w-full">
                  Enroll Tier 1 for Priority Access
                </Button>
              </a>

              <div className="mt-6 rounded-sm border p-6"
                style={{ backgroundColor: "hsl(var(--eden-parchment))", borderColor: "hsl(var(--eden-gold) / 0.3)" }}>
                <p className="font-accent text-xs tracking-widest uppercase mb-1" style={{ color: "hsl(var(--eden-gold))" }}>
                  Companion Textbook · Tier 2 · Coming Later in 2026
                </p>
                <h3 className="font-serif text-lg font-bold mb-2" style={{ color: "hsl(var(--eden-forest))" }}>
                  Back to Eden: Body Systems &amp; Clinical Literacy
                </h3>
                <p className="font-body text-sm mb-4" style={{ color: "hsl(var(--eden-bark) / 0.75)" }}>
                  A comprehensive 14-module clinical reference covering every major body system. Terrain-based, Scripture-anchored, practitioner-grade. Join the waitlist to be notified when it's available.
                </p>
                <Button variant="eden" size="sm" onClick={() => setQuiz(true)}>
                  Join the Textbook Waitlist
                </Button>
              </div>
            </div>

            <div className="relative rounded-lg border p-8 opacity-65" style={{ borderColor: "hsl(var(--border))" }}>
              <span className="absolute -top-3 left-6 rounded bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Coming 2027
              </span>
              <Users className="mb-4 h-8 w-8 text-muted-foreground" />
              <h3 className="mb-1 font-serif text-xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
                Tier 3 — Clinical Practice
              </h3>
              <p className="my-4 font-body text-sm leading-relaxed text-muted-foreground">
                Advanced clinical application — tissue states, body type prescribing, and
                supervised practice.
              </p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  Full clinical methodology
                </li>
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  Mentorship track
                </li>
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  Case study library
                </li>
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  Practitioner credential
                </li>
              </ul>
              <Button variant="eden-outline" className="w-full opacity-50" disabled>
                Coming 2027
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 font-serif text-3xl font-bold text-white">
            This Is Not Wellness Culture. It's Restoration.
          </h2>
          <p className="mb-10 font-body text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
            Most courses teach you what a plant does. We teach you to read the person first —
            terrain, body type, tissue state — then match the plant.
          </p>
          <div className="grid gap-6 text-left md:grid-cols-3">
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="mb-3 font-serif text-lg font-semibold text-white">Biblically Grounded</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                Yahweh as ultimate healer. Every framework anchored in Scripture, free from
                Eastern religious concepts.
              </p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="mb-3 font-serif text-lg font-semibold text-white">Terrain-Based</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                We read the terrain, not the symptom. Body types, tissue states, and
                energetics are the tools.
              </p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="mb-3 font-serif text-lg font-semibold text-white">Clinically Rigorous</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                127 lessons, 14 body systems, clinical vocabulary, materia medica, and case
                frameworks built in.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-serif text-3xl font-bold" style={{ color: "hsl(var(--eden-bark))" }}>
            Not Sure Where to Start?
          </h2>
          <p className="mb-8 font-body text-muted-foreground">
            Take the 2-minute Body Type Quiz. Discover your body pattern first.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button variant="eden" size="xl" onClick={() => setQuiz(true)}>
              Take the Free Quiz
            </Button>
            <a href={T1} target="_blank" rel="noopener noreferrer">
              <Button variant="eden-outline" size="xl">
                Enroll in Tier 1 — $197
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <AssessmentModal open={quiz} onOpenChange={setQuiz} />
    </div>
  );
};

export default Courses;