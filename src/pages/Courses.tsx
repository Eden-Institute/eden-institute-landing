import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import AssessmentModal from "@/components/landing/AssessmentModal";
import { BookOpen, GraduationCap, CheckCircle, Clock, Users } from "lucide-react";

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
                <nav className="border-b border-border/40 bg-background sticky top-0 z-50">
                        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                                  <Link to="/" className="font-serif text-xl font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>The Eden Institute</Link>Link>
                                  <div className="hidden md:flex items-center gap-6">
                                    {NAV.map(n => (
                          <Link key={n.to} to={n.to} className={`font-body text-sm transition-colors ${n.to === "/courses" ? "font-medium" : "text-muted-foreground hover:text-foreground"}`} style={n.to === "/courses" ? { color: "hsl(var(--eden-bark))" } : {}}>{n.label}</Link>Link>
                                              ))}
                                  </div>div>
                                  <Button variant="eden" size="sm" onClick={() => setQuiz(true)}>Free Quiz</Button>Button>
                        </div>div>
                </nav>nav>
          
                <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
                        <div className="max-w-4xl mx-auto text-center">
                                  <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>Biblical Clinical Herbalism</p>p>
                                  <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
                                              Learn to Read the Body.<br /><span className="italic">Match the Plant. Steward the Family.</span>span>
                                  </h1>h1>
                                  <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
                                  <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                                              A three-tier, faith-rooted curriculum for Christian families — from the biblical foundations of plant medicine through terrain-based clinical herbalism.
                                  </p>p>
                                  <blockquote className="scripture-block text-sm text-muted-foreground max-w-xl mx-auto mb-10 text-left">
                                              "He causeth the grass to grow for the cattle, and herb for the service of man."
                                              <footer className="mt-2 text-xs tracking-wider uppercase font-body font-medium not-italic" style={{ color: "hsl(var(--eden-forest))" }}>— Psalm 104:14 (KJV)</footer>footer>
                                  </blockquote>blockquote>
                                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                              <a href={T1} target="_blank" rel="noopener noreferrer"><Button variant="eden" size="xl">Enroll in Tier 1 — $197</Button>Button></a>a>
                                              <Button variant="eden-outline" size="xl" onClick={() => setQuiz(true)}>Take the Free Quiz First</Button>Button>
                                  </div>div>
                        </div>div>
                </section>section></div>
    )
}
]

      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>Three Tiers. One Coherent Path.</h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">Each tier builds on the last — from Biblical foundations to clinical practice.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-lg p-8 border-2 relative" style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}>
              <span className="absolute -top-3 left-6 px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded" style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}>Available Now</span>
              <BookOpen className="w-8 h-8 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Tier 1 — Biblical Framework</h3>
              <p className="font-body text-sm text-muted-foreground my-4 leading-relaxed">The theological foundation of plant medicine. Creation-based health, the Five Tenets, and your constitutional type.</p>
              <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />10 lessons, self-paced</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />Constitutional Assessment included</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />Certificate of completion</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />Lifetime access</li>
              </ul>
              <p className="font-serif text-3xl font-bold text-center mb-4" style={{ color: "hsl(var(--eden-bark))" }}>$197</p>
              <a href={T1} target="_blank" rel="noopener noreferrer" className="block"><Button variant="eden" className="w-full">Enroll Now</Button></a>
            </div>
            <div className="rounded-lg p-8 border relative" style={{ borderColor: "hsl(var(--eden-sage))" }}>
              <span className="absolute -top-3 left-6 px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded text-white" style={{ backgroundColor: "hsl(var(--eden-sage))" }}>Launches July 7</span>
              <GraduationCap className="w-8 h-8 mb-4" style={{ color: "hsl(var(--eden-sage))" }} />
              <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Tier 2 — Body Systems</h3>
              <p className="font-body text-sm text-muted-foreground my-4 leading-relaxed">14 modules through every major body system through a terrain-based, Biblical lens.</p>
              <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />127 lessons across 14 modules</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />Full clinical textbook included</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />Herb-matching protocols</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />Early bird for Tier 1 students</li>
              </ul>
              <p className="font-body text-sm text-muted-foreground text-center mb-4">Opening July 7, 2026</p>
              <a href={T1} target="_blank" rel="noopener noreferrer" className="block"><Button variant="eden-outline" className="w-full">Enroll Tier 1 for Priority Access</Button></a>
            </div>
            <div className="rounded-lg p-8 border relative opacity-65" style={{ borderColor: "hsl(var(--border))" }}>
              <span className="absolute -top-3 left-6 px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded bg-muted text-muted-foreground">Coming 2027</span>
              <Users className="w-8 h-8 mb-4 text-muted-foreground" />
              <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Tier 3 — Clinical Practice</h3>
              <p className="font-body text-sm text-muted-foreground my-4 leading-relaxed">Advanced clinical application — tissue states, constitutional prescribing, and supervised practice.</p>
              <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                <li className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />Full clinical methodology</li>
                <li className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />Mentorship track</li>
                <li className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />Case study library</li>
                <li className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />Practitioner credential</li>
              </ul>
              <Button variant="eden-outline" className="w-full opacity-50" disabled>Coming 2027</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-6 text-white">This Is Not Wellness Culture. It's Restoration.</h2>
          <p className="font-body text-lg mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>Most courses teach you what a plant does. We teach you to read the person first — terrain, constitution, tissue state — then match the plant.</p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Biblically Grounded</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>Yahweh as ultimate healer. Every framework anchored in Scripture, free from Eastern religious concepts.</p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Terrain-Based</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>We read the terrain, not the symptom. Constitutional types, tissue states, and energetics are the tools.</p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Clinically Rigorous</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>127 lessons, 14 body systems, clinical vocabulary, materia medica, and case frameworks built in.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>Not Sure Where to Start?</h2>
          <p className="font-body text-muted-foreground mb-8">Take the 2-minute Constitutional Assessment. Discover your body pattern first.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="eden" size="xl" onClick={() => setQuiz(true)}>Take the Free Quiz</Button>
            <a href={T1} target="_blank" rel="noopener noreferrer"><Button variant="eden-outline" size="xl">Enroll in Tier 1 — $197</Button></a>
          </div>
        </div>
      </section>

      <Footer />
      <AssessmentModal open={quiz} onOpenChange={setQuiz} />
    </div>
  );
};

export default Courses;