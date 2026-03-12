import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="section-padding bg-eden-bark text-eden-parchment/60">
      <div className="eden-container text-center">
        <p className="font-serif text-xl font-semibold text-eden-parchment mb-2">
          The Eden Institute
        </p>
        <p className="font-body text-sm mb-4">
          edeninstitute.health
        </p>
        <div className="eden-divider" />
        <p className="font-accent text-sm tracking-[0.1em] md:tracking-[0.3em] uppercase text-eden-gold">
          "Back to Eden. Back to Truth."
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-body text-eden-parchment/30">
          <Link to="/terms" className="hover:text-eden-parchment/50 transition-colors">
            Terms &amp; Conditions
          </Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-eden-parchment/50 transition-colors">
            Privacy Policy
          </Link>
          <span>|</span>
          <Link to="/cookies" className="hover:text-eden-parchment/50 transition-colors">
            Cookie Policy
          </Link>
        </div>

        <p className="mt-4 font-body text-xs text-eden-parchment/30">
          © {new Date().getFullYear()} The Eden Institute. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
