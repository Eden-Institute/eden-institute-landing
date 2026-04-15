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