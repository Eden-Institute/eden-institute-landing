import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

// hardNav pages exist only as static Astro pages (web/pages/*.astro), not as
// SPA routes — they need a full-page <a href> navigation, not a router <Link>.
//
// Container, gap and breakpoint are deliberately IDENTICAL to
// web/components/Navbar.astro (max-w-[1340px], gap-4, min-[1340px]) even though
// this header carries less: no Freebies link and one CTA instead of two, so it
// needs only logo 214 + nav 578 (5 links at gap-4) + button 216 = 1008px and
// would fit a narrower cap. Matching anyway, because a visitor crosses between
// the two rendering paths (marketing pages are Astro, /assessment, /results and
// /apothecary/* are this one) and a differing cap would shift the logo sideways
// and flip the hamburger on and off mid-journey.
//
// "Home" was dropped on 2026-09-02 when the labels were renamed for clarity:
// with it, the old 1152px cap left the row a single pixel of slack. The logo
// already returns home. See the Astro file for the full width arithmetic.
const navLinks = [
  { label: "Homeschool Curriculum", href: "/homeschool", external: false },
  { label: "Adult Courses", href: "/courses", external: false },
  { label: "Herb Reference App", href: "/apothecary", external: false },
  { label: "Buy the Book", href: "https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20", external: true },
  { label: "Contact", href: "/contact", external: false, hardNav: true },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // The quiz CTA carries data-cta so the highest-frequency quiz entry is
  // measurable (CRO Phase 4); rendered in both desktop and mobile menus.
  const renderLink = (
    link: { label: string; href: string; external: boolean; hardNav?: boolean },
    onClick?: () => void,
  ) =>
    link.external || link.hardNav ? (
      <a
        key={link.href}
        href={link.href}
        target={link.external ? "_blank" : undefined}
        rel={link.external ? "noopener noreferrer" : undefined}
        onClick={onClick}
        className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200 whitespace-nowrap"
      >
        {link.label}
      </a>
    ) : (
      <Link
        key={link.href}
        to={link.href}
        onClick={onClick}
        className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200 whitespace-nowrap"
      >
        {link.label}
      </Link>
    );

  return (
    <header className="w-full bg-[#FAF8F3] border-b border-[#D6CDB8] sticky top-0 z-50">
      <div className="max-w-[1340px] mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex flex-col leading-tight">
          <span className="font-serif text-xl text-[#3B4A3F] tracking-wide">The Eden Institute</span>
          <span className="text-xs text-[#7A8C7E] tracking-widest uppercase font-sans">Biblical Herbalism Education</span>
        </Link>
        <nav className="hidden min-[1340px]:flex items-center gap-4">
          {navLinks.map((link) => renderLink(link))}
        </nav>
        <div className="hidden min-[1340px]:block">
          <Link
            to="/assessment"
            data-cta="nav-take-quiz"
            className="text-sm font-sans px-5 py-2 rounded-sm tracking-wide transition-colors duration-200 min-h-[44px] inline-flex items-center"
            style={{ backgroundColor: "var(--honey, #C5A44E)", color: "#1C3A2E" }}
          >
            Discover your Body Pattern
          </Link>
        </div>
        <button
          className="min-[1340px]:hidden text-[#3B4A3F] min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="min-[1340px]:hidden bg-[#FAF8F3] border-t border-[#D6CDB8] px-6 pb-6 pt-4 flex flex-col gap-5 [&>a]:min-h-[44px] [&>a]:inline-flex [&>a]:items-center">
          {navLinks.map((link) => renderLink(link, () => setOpen(false)))}
          <Link
            to="/assessment"
            onClick={() => setOpen(false)}
            data-cta="nav-take-quiz"
            className="text-sm font-sans px-5 py-2 rounded-sm tracking-wide text-center min-h-[44px] inline-flex items-center justify-center"
            style={{ backgroundColor: "var(--honey, #C5A44E)", color: "#1C3A2E" }}
          >
            Discover your Body Pattern
          </Link>
        </div>
      )}
    </header>
  );
}
