import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";

const FOOTER_BG_IMG = "https://images.unsplash.com/photo-1726996155615-e986ed87c9d4?auto=format&fit=crop&w=1920&q=80";

// Keep in lockstep with web/components/Footer.astro, which carries the same list
// for the Astro marketing pages. See the long note there for why these exact URLs.
// Short version: verified in-browser 2026-07-26; the old Instagram and Facebook
// usernames now 404 because neither platform redirects; and the Pinterest account
// is TheEdenInstituteBoards, not the near-empty "theedeninstitute" duplicate.
const SOCIALS = [
  { label: "Instagram", href: "https://www.instagram.com/edenstablehomeschoolcurriculum/" },
  { label: "Facebook", href: "https://www.facebook.com/EdensTableHomeschoolCurriculum" },
  { label: "Pinterest", href: "https://www.pinterest.com/TheEdenInstituteBoards/" },
];

const Footer = () => {
  return (
    <footer className="relative overflow-hidden">
      {/* Gold accent line at top */}
      <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent 5%, hsl(var(--eden-gold)) 30%, hsl(var(--eden-gold)) 70%, transparent 95%)" }} />

      <div className="relative" style={{ backgroundColor: "hsl(var(--eden-bark))" }}>
        {/* Subtle botanical photo overlay */}
        <img
          src={FOOTER_BG_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.06] mix-blend-luminosity pointer-events-none"
        />

        <div className="section-padding relative z-10 text-center" style={{ color: "hsl(var(--eden-parchment) / 0.6)" }}>
          <div className="eden-container">
            <p className="font-serif text-xl font-semibold mb-2" style={{ color: "hsl(var(--eden-parchment))" }}>
              The Eden Institute
            </p>
            <p className="font-body text-sm mb-4">
              edeninstitute.health
            </p>
            <div className="eden-divider" />
            <p className="font-accent text-sm tracking-[0.1em] md:tracking-[0.3em] uppercase" style={{ color: "hsl(var(--eden-gold))" }}>
              "Back to Eden. Back to Truth."
            </p>

            <div className="mt-6 flex items-center justify-center gap-4 text-sm font-body flex-wrap">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center min-h-[44px] hover:opacity-70 transition-opacity underline underline-offset-4"
                  style={{ color: "hsl(var(--eden-gold))" }}
                >
                  {s.label}
                </a>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-body flex-wrap" style={{ color: "hsl(var(--eden-parchment) / 0.3)" }}>
              <a href={ROUTES.WHY_EDEN} className="inline-flex items-center min-h-[44px] px-0.5 hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Why Eden
              </a>
              <span>|</span>
              <Link to={ROUTES.TERMS} className="inline-flex items-center min-h-[44px] px-0.5 hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Terms &amp; Conditions
              </Link>
              <span>|</span>
              <Link to={ROUTES.PRIVACY} className="inline-flex items-center min-h-[44px] px-0.5 hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Privacy Policy
              </Link>
              <span>|</span>
              <Link to={ROUTES.COOKIES} className="inline-flex items-center min-h-[44px] px-0.5 hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Cookie Policy
              </Link>
              <span>|</span>
              {/* /returns and /contact are static Astro pages, not SPA routes —
                  plain <a> so the browser does a full navigation. */}
              <a href="/returns" className="inline-flex items-center min-h-[44px] px-0.5 hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Returns &amp; Refunds
              </a>
              <span>|</span>
              <a href="/contact" className="inline-flex items-center min-h-[44px] px-0.5 hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Contact
              </a>
            </div>

            <p className="mt-4 font-body text-xs" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
              Eden's Table is published by Rooted in Faith Ventures LLC.
            </p>
            <p className="mt-2 font-body text-xs" style={{ color: "hsl(var(--eden-parchment) / 0.3)" }}>
              © {new Date().getFullYear()} The Eden Institute. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
