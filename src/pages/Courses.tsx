))", color: "white" }}>Launches July 7</div>
                <GraduationCap className="w-8 h-8 mb-4" style={{ color: "hsl(var(--eden-sage))" }} />
                <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Tier 2</>h3>
                <p className="font-accent text-xs tracking-widest uppercase mb-4" style={{ color: "hsl(var(--eden-sage))" }}>Body Systems & Clinical Literacy</p>p>
                <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">Deep-dive through every major body system — cardiovascular, digestive, respiratory, neurological, and more — through a terrain-based, Biblical lens.</p>p>
                <ul className="space-y-2 mb-8">
                  {["127 lessons across 14 modules", "Full clinical textbook included", "Herb matching protocols", "Early bird pricing for Tier 1 students"].map(item => (
                                    <li key={item} className="flex items-start gap-2 font-body text-sm text-muted-foreground">
                                                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-sage))" }} />
                                      {item}
                                    </li>li>
                                ))}
                </ul>ul>
                <p className="font-body text-sm text-muted-foreground text-center mb-4">Opening July 7, 2026</p>p>
                <a href={TIER1_URL} target="_blank" rel="noopener noreferrer" className="block">
                                <Button variant="eden-outline" className="w-full">Enroll in Tier 1 for Priority Access</Button>Button>
                </a>a>
  </div>
   
               <div className="rounded-lg p-8 border relative opacity-70" style={{ borderColor: "hsl(var(--border))" }}>
                             <div className="absolute -top-3 left-6 px-3 py-1 text-xs font-body font-semibold tracking-widest uppercase rounded bg-muted text-muted-foreground">Coming 2027</div>div>
                             <Users className="w-8 h-8 mb-4 text-muted-foreground" />
                             <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Tier 3</h3>h3>
                             <p className="font-accent text-xs tracking-widest uppercase mb-4 text-muted-foreground">Terrain-Based Clinical Herbalism</p>p>
                             <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">Advanced clinical application — tissue states, constitutional prescribing, case analysis, and supervised practice for the serious student.</p>p>
                             <ul className="space-y-2 mb-8">
                               {["Full clinical methodology", "Mentorship track", "Case study library", "Practitioner credential"].map(item => (
                                   <li key={item} className="flex items-start gap-2 font-body text-sm text-muted-foreground">
                                                       <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                     {item}
                                   </li>li>
                                             ))}
                             </ul>ul>
                             <p className="font-body text-sm text-muted-foreground text-center mb-4">Complete Tier 1 + 2 to be notified</p>p>
                             <Button variant="eden-outline" className="w-full opacity-60" disabled>Coming 2027</Button>Button>
               </div>div>
  </div>
    </div>
  </section>
  
        <section className="py-16 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
                <div className="max-w-4xl mx-auto text-center">
                          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6 text-white">This Isn't Wellness Culture. It's Restoration.</h2>h2>
                          <p className="font-body text-lg mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                                      Most herbal courses teach you what a plant does. We teach you how to read the person first — their terrain, their constitution, their tissue state — and then match the plant. That's the difference between a symptom chart and a living system.
                          </p>p>
                          <div className="grid md:grid-cols-3 gap-6 text-left">
                            {[
                  { title: "Biblically Grounded", body: "Yahweh as ultimate healer. Every framework is anchored in Scripture and creation stewardship — free from Eastern religious frameworks." },
                  { title: "Terrain-Based", body: "We don't treat symptoms — we read the terrain. Constitutional types, tissue states, and energetics are the diagnostic tools." },
                  { title: "Clinically Rigorous", body: "127 lessons across 14 body systems with materia medica, case frameworks, and clinical vocabulary built into every module." },
                              ].map(({ title, body }) => (
                                              <div key={t</p>import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import AssessmentModal from "@/components/landing/AssessmentModal";
import { BookOpen, GraduationCap, CheckCircle, Clock, Users } from "lucide-react";

const TIER1_URL = "https://learn.edeninstitute.health/course/back-to-eden1";

const Courses = () => {
    const [assessmentModal, setAssessmentModal] = useState(false);

    return (
          <div className="min-h-screen bg-background">
                <nav className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-50">
                        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                                  <Link to="/" className="font-serif text-xl font-semibold tracking-wide" style={{ color: "hsl(var(--eden-bark))" }}>
                                              The Eden Institute
                                  </Link>Link>
                                  <div className="hidden md:flex items-center gap-6">
                                              <Link to="/" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>Link>
                                              <Link to="/courses" className="font-body text-sm font-medium" style={{ color: "hsl(var(--eden-bark))" }}>Courses</Link>Link>
                                              <Link to="/app" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">App</Link>Link>
                                              <Link to="/homeschool" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Homeschool</Link>Link>
                                              <Link to="/community" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Community</Link>Link>
                                              <Link to="/why-eden" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Why Eden</Link>Link>
                                  </div>div>
                                  <Button variant="eden" size="sm" onClick={() => setAssessmentModal(true)}>Free Quiz</Button>Button>
                        </div>div>
                </nav>nav>
          
                <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
                        <div className="max-w-4xl mx-auto text-center">
                                  <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>
                                              Biblical Clinical Herbalism Education
                                  </p>p>
                                  <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ color: "hsl(var(--eden-bark))" }}>
                                              Learn to Read the Body.<br />
                                              <span className="italic">Match the Plant. Steward the Family.</span>span>
                                  </h1>h1>
                                  <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
                                  <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                                              A three-tier, faith-rooted curriculum that takes Christian families from the biblical foundations of plant medicine all the way to terrain-based clinical herbalism.
                                  </p>p>
                                  <blockquote className="scripture-block text-sm md:text-base text-muted-foreground max-w-xl mx-auto mb-10 text-left">
                                              "He causeth the grass to grow for the cattle, and herb for the service of man."
                                              <footer className="mt-2 text-xs tracking-wider uppercase font-body font-medium not-italic" style={{ color: "hsl(var(--eden-forest))" }}>
                                                            — Psalm 104:14 (KJV)
                                              </footer>footer>
                                  </blockquote>blockquote>
                                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                              <a href={TIER1_URL} target="_blank" rel="noopener noreferrer">
                                                            <Button variant="eden" size="xl">Enroll in Tier 1 — $197</Button>Button>
                                              </a>a>
                                              <Button variant="eden-outline" size="xl" onClick={() => setAssessmentModal(true)}>Take the Free Quiz First</Button>Button>
                                  </div>div>
                        </div>div>
                </section>section>
          
                <section className="py-16 px-6 bg-background">
                        <div className="max-w-5xl mx-auto">
                                  <div className="text-center mb-14">
                                              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>Three Tiers. One Coherent Path.</h2>h2>
                                              <p className="font-body text-muted-foreground max-w-2xl mx-auto">Each tier builds on the last. You don't need a science background — you need a willingness to learn what Yahweh embedded in creation.</p>p>
                                  </div>div>
                                  <div className="grid md:grid-cols-3 gap-6">
                                              <div className="rounded-lg p-8 border-2 relative" style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}>
                                                            <div className="absolute -top-3 left-6 px-3 py-1 text-xs font-body font-semibold tracking-widest uppercase rounded" style={{ backgroundColor: "hsl(var(--eden-gold))", color: "hsl(var(--eden-bark))" }}>Available Now</div>div>
                                                            <BookOpen className="w-8 h-8 mb-4" style={{ color: "hsl(var(--eden-gold))" }} />
                                                            <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>Tier 1</h3>h3>
                                                            <p className="font-accent text-xs tracking-widest uppercase mb-4" style={{ color: "hsl(var(--eden-gold))" }}>Biblical Framework</p>p>
                                                            <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">The theological and historical foundation of plant medicine. Understand creation-based health, the Five Tenets, and your constitutional type.</p>p>
                                                            <ul className="space-y-2 mb-8">
                                                              {["10 lessons, self-paced", "Constitutional Assessment included", "Certificate of completion", "Lifetime access"].map(item => (
                              <li key={item} className="flex items-start gap-2 font-body text-sm text-muted-foreground">
                                                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "hsl(var(--eden-forest))" }} />
                                {item}
                              </li>li>
                                                                            ))}
                                                            </ul>ul>
                                                            <p className="font-serif text-3xl font-bold text-center mb-4" style={{ color: "hsl(var(--eden-bark))" }}>$197</p>p>
                                                            <a href={TIER1_URL} target="_blank" rel="noopener noreferrer" className="block">
                                                                            <Button variant="eden" className="w-full">Enroll Now</Button>Button>
                                                            </a>a>
                                              </div>div>
                                  
                                              <div className="rounded-lg p-8 border relative" style={{ borderColor: "hsl(var(--eden-sage))", backgroundColor: "hsl(var(--eden-cream) / 0.5)" }}>
                                                            <div className="absolute -top-3 left-6 px-3 py-1 text-xs font-body font-semibold tracking-widest uppercase rounded" style={{ backgroundColor: "hsl(var(--eden-sage"</div>
    )
}