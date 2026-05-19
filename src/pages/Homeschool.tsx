import { useState } from "react";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Footer from "@/components/landing/Footer";
import WaitlistModal from "@/components/landing/WaitlistModal";
import Navbar from "@/components/landing/Navbar";
import { BookOpen, Sprout, Users } from "lucide-react";

const HS_AUD = "a48cb66e-b2a9-461d-98a6-bb1b12f72693";
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
  useSEO({
    title: "Homeschool Herbalism Curriculum | The Eden Institute",
    description: "Eden's Table homeschool herbalism — Scripture-rooted, family-centered botanical education for raising stewards of God's design.",
    path: "/homeschool",
  });
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

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
            Looking for Partners to Help Build the Next Stage
          </p>
          <a href="mailto:hello@edeninstitute.health">
            <Button variant="eden" size="xl">
              Connect With Us
            </Button>
          </a>
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
                Seeking Partners
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
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">Seeking Partners</span>
            </div>
            <div className="rounded-lg p-6 border opacity-75" style={{ borderColor: "hsl(var(--border))" }}>
              <BookOpen className="w-6 h-6 mb-3 text-muted-foreground" />
              <h3 className="font-serif text-lg font-bold mb-1" style={{ color: "hsl(var(--eden-bark))" }}>
                Cultivators
              </h3>
              <p className="font-accent text-xs tracking-widest uppercase mb-3 text-muted-foreground">Grades 7-9</p>
              <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
                Body type thinking, terrain basics, and garden-to-remedy workflows.
              </p>
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">Seeking Partners</span>
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
              <span className="text-xs font-body px-2 py-1 rounded bg-muted text-muted-foreground">Seeking Partners</span>
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
            Looking for Partners to Help Build the Next Stage
          </h2>
          <p className="font-body text-muted-foreground mb-8">
            We are currently seeking aligned partners, investors, and collaborators to help bring this stage of Eden Institute to life. If you share our vision for faith-grounded, terrain-based health education, we would love to connect.
          </p>
          <a href="mailto:hello@edeninstitute.health">
            <Button variant="eden" size="xl">
              Connect With Us
            </Button>
          </a>
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
