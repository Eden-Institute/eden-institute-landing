import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import WaitlistModal from "@/components/landing/WaitlistModal";
import { BookOpen, Sprout, Users } from "lucide-react";

const HS_AUD = "YOUR_EDENS_TABLE_AUDIENCE_ID";
const NAV = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/app", label: "App" },
  { to: "/homeschool", label: "Homeschool" },
  { to: "/community", label: "Community" },
  { to: "/why-eden", label: "Why Eden" },
];

const Homeschool = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/40 bg-background sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-xl font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>
            The Eden Institute
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`font-body text-sm transition-colors ${n.to === "/homeschool" ? "font-medium" : "text-muted-foreground hover:text-foreground"}`}
                style={n.to === "/homeschool" ? { color: "hsl(var(--eden-bark))" } : {}}
              >
                {n.label}
              </Link>
            ))}
          </div>
          <Button variant="eden" size="sm" onClick={() => setOpen(true)}>
            Early Access
          </Button>
        </div>
      </nav>

      <section className="py-20 md:py-28 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-accent text-sm tracking-[0.3em] uppercase mb-6" style={{ color: "hsl(var(--eden-gold))" }}>
            Eden's Table
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Herbalism for the
            <br />
            <span className="italic">Whole Family Table.</span>
          </h1>
          <div className="w-16 h-px mx-auto my-8" style={{ backgroundColor: "hsl(var(--eden-gold))" }} />
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            A K-12 Biblical herbalism curriculum for homeschool families. Open-and-go lesson plans, memory songs,
            kitchen labs, garden activities, and a recurring family story — rooted in Scripture and creation
            stewardship.
          </p>
          <p className="font-accent text-sm tracking-wider uppercase mb-8" style={{ color: "hsl(var(--eden-sage))" }}>
            Launching November 2026 — Sprouts (K-3) first
          </p>
          <Button variant="eden" size="xl" onClick={() => setOpen(true)}>
            Get Early Access
          </Button>
        </div>
      </section>

      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
              Four Grade Bands. One Family Vision.
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Eden's Table grows with your children — from wonder-filled kitchen labs to clinical reasoning in high
              school.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div
              className="rounded-lg p-6 border-2"
              style={{ borderColor: "hsl(var(--eden-gold))", backgroundColor: "hsl(var(--eden-cream))" }}
            >
              <Sprout className="w-6 h-6 mb-3" style={{ color: "hsl(var(--eden-gold))" }} />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                Sprouts
              </h3>
              <p
                className="font-accent text-xs tracking-widest uppercase mb-3"
                style={{ color: "hsl(var(--eden-gold))" }}
              >
                Grades K-3
              </p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Wonder, stories, and simple plant identification. Kitchen labs and memory songs.
              </p>
              <span
                className="text-xs font-body px-2 py-1 rounded"
                style={{ backgroundColor: "hsl(var(--eden-gold) / 0.15)", color: "hsl(var(--eden-gold))" }}
              >
                Nov 2026
              </span>
            </div>
            <div className="rounded-lg p-6 border opacity-75" style={{ borderColor: "hsl(var(--border))" }}>
              <BookOpen className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                Seedlings
              </h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">Grades 4-6</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Body systems basics, herb profiles, and family dinner discussions.
              </p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">2027</span>
            </div>
            <div className="rounded-lg p-6 border opacity-75" style={{ borderColor: "hsl(var(--border))" }}>
              <BookOpen className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                Cultivators
              </h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">Grades 7-9</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Constitutional thinking, terrain basics, and garden-to-remedy workflows.
              </p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">2027</span>
            </div>
            <div className="rounded-lg p-6 border opacity-75" style={{ borderColor: "hsl(var(--border))" }}>
              <Users className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                Practitioners
              </h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">Grades 10-12</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Clinical literacy, materia medica, and real-world application.
              </p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">2028</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6" style={{ backgroundColor: "hsl(var(--eden-forest))" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-6 text-white">Open-and-Go. Family-Style. Faith-Rooted.</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left mt-8">
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">No Prep Required</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                Every lesson includes a parent guide, student workbook, kitchen lab card, and garden activity card. Open
                and teach.
              </p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Multi-Age by Design</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                Lessons are written for the whole family to learn together. Older students go deeper; younger ones grow
                into it.
              </p>
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <h3 className="font-serif text-lg font-semibold mb-3 text-white">Scripture Throughout</h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                Every unit anchored in Scripture. Herbalism presented as stewardship of Yahweh's creation, not
                alternative medicine.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6" style={{ backgroundColor: "hsl(var(--eden-cream))" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl font-bold mb-4" style={{ color: "hsl(var(--eden-bark))" }}>
            Be First at the Table
          </h2>
          <p className="font-body text-muted-foreground mb-8">
            Founding families receive first access, launch pricing, and the opportunity to shape the curriculum.
          </p>
          <Button variant="eden" size="xl" onClick={() => setOpen(true)}>
            Join the Early Access List
          </Button>
        </div>
      </section>

      <Footer />
      <WaitlistModal
        open={open}
        onOpenChange={setOpen}
        audienceId={HS_AUD}
        title="Join Eden's Table Early Access List"
      />
    </div>
  );
};

export default Homeschool;
