import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NAV_BUTTONS, NAV_LINKS, type SiteButton, type SiteLink } from "@/lib/navLinks";

// The SPA header. Links and buttons come from src/lib/navLinks.ts, the same
// module web/components/Navbar.astro renders, so a visitor crossing between the
// two rendering paths (marketing pages are Astro, /assessment, /results and
// /apothecary/* are this one) sees the same header on both.
//
// Container, gap and breakpoint are IDENTICAL to the Astro header
// (max-w-[1340px], gap-4, min-[1340px]); a differing cap would shift the logo
// sideways and flip the hamburger on and off mid-journey. See the Astro file
// for the full width arithmetic.
//
// Only links marked spaRoute use a router <Link>. Everything else, including
// the logo ("/" is the static Astro homepage), is a full page load.

const LINK_CLASS =
  "text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200 whitespace-nowrap";

function NavAnchor({
  link,
  className,
  style,
  onClick,
}: {
  link: SiteLink;
  className: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const shared = {
    className,
    style,
    onClick,
    "data-cta": link.cta,
  };
  if (link.spaRoute && !link.external) {
    return (
      <Link to={link.href} {...shared}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noopener noreferrer" : undefined}
      {...shared}
    >
      {link.label}
    </a>
  );
}

const buttonStyle = (b: SiteButton): CSSProperties => ({ backgroundColor: b.background, color: b.color });

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="w-full bg-[#FAF8F3] border-b border-[#D6CDB8] sticky top-0 z-50">
      <div className="max-w-[1340px] mx-auto px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex flex-col leading-tight">
          <span className="font-serif text-xl text-[#3B4A3F] tracking-wide">The Eden Institute</span>
          <span className="text-xs text-[#5A6B5E] tracking-widest uppercase font-sans">Biblical Herbalism Education</span>
        </a>
        <nav className="hidden min-[1340px]:flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <NavAnchor key={link.href} link={link} className={LINK_CLASS} />
          ))}
        </nav>
        <div className="hidden min-[1340px]:flex items-center gap-3">
          {NAV_BUTTONS.map((b) => (
            <NavAnchor
              key={b.href}
              link={b}
              className="text-sm font-sans px-5 py-2 rounded-sm tracking-wide transition-colors duration-200 min-h-[44px] inline-flex items-center"
              style={buttonStyle(b)}
            />
          ))}
        </div>
        <button
          type="button"
          className="min-[1340px]:hidden text-[#3B4A3F] min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="min-[1340px]:hidden bg-[#FAF8F3] border-t border-[#D6CDB8] px-6 pb-6 pt-4 flex flex-col gap-5">
          {NAV_LINKS.map((link) => (
            <NavAnchor
              key={link.href}
              link={link}
              onClick={close}
              className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200 min-h-[44px] inline-flex items-center"
            />
          ))}
          {NAV_BUTTONS.map((b) => (
            <NavAnchor
              key={b.href}
              link={b}
              onClick={close}
              className="text-sm font-sans px-5 py-2 rounded-sm tracking-wide text-center min-h-[44px] inline-flex items-center justify-center"
              style={buttonStyle(b)}
            />
          ))}
        </div>
      )}
    </header>
  );
}
