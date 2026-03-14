import { Link } from "react-router-dom";

const FOOTER_BG_IMG = "https://images.unsplash.com/photo-1726996155615-e986ed87c9d4?auto=format&fit=crop&w=1920&q=80";

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

            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-body flex-wrap" style={{ color: "hsl(var(--eden-parchment) / 0.3)" }}>
              <Link to="/why-eden" className="hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Why Eden
              </Link>
              <span>|</span>
              <Link to="/terms" className="hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Terms &amp; Conditions
              </Link>
              <span>|</span>
              <Link to="/privacy" className="hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Privacy Policy
              </Link>
              <span>|</span>
              <Link to="/cookies" className="hover:opacity-70 transition-colors" style={{ color: "hsl(var(--eden-parchment) / 0.5)" }}>
                Cookie Policy
              </Link>
            </div>

            <p className="mt-4 font-body text-xs" style={{ color: "hsl(var(--eden-parchment) / 0.3)" }}>
              © {new Date().getFullYear()} The Eden Institute. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
