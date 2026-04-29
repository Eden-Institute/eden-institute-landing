import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";

// PR #52 v3.33: Apothecary nav entry added between "Why Eden" and the
// CTA per founder Q3 authorization. Links to the public marketing landing
// /apothecary/start (Lock #47 framing surface).
const navLinks = [
  { label: "Home", href: "/" },
  { label: "Courses", href: "/courses" },
  { label: "Homeschool", href: "/homeschool" },
  { label: "Community", href: "/community" },
  { label: "Why Eden", href: "/why-eden" },
  { label: "Apothecary", href: "/apothecary/start" },
];

/**
 * §8.1.1 (Manual v4.0) — State-aware Navbar CTA.
 *
 * The right-aligned button used to render "Take the Quiz" universally on
 * every page — including for users who already have a resolved Pattern,
 * which the founder reported as a confusing dead-end on April 28.
 *
 * Two states now:
 *   • No resolved Pattern (anon, or authed without quiz) → "Take the Quiz"
 *     → /quiz (current behavior; primary acquisition CTA).
 *   • Resolved Pattern (authed, any tier) → "Open Apothecary"
 *     → /apothecary (sends them to where their Pattern matters).
 *
 * Subscription tier doesn't change the CTA — both Free and Seed/Root users
 * with a Pattern want the apothecary directory; tier gating happens
 * server-side via `herbs_directory_v` per Lock #4.
 *
 * Pattern resolution uses `useEdenPattern` (already wired for the apothecary
 * surface). The hook is safe to call here: anon callers resolve null
 * synchronously, so no auth bounce. `useActiveProfileOptional` returns null
 * when ActiveProfileContext isn't mounted (which is the case on every
 * non-apothecary surface), and the hook falls back to a user-level read.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: pattern } = useEdenPattern();
  const ctaLabel = user && pattern ? "Open Apothecary" : "Take the Quiz";
  const ctaHref = user && pattern ? "/apothecary" : "/quiz";

  return (
    <header className="w-full bg-[#FAF8F3] border-b border-[#D6CDB8] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex flex-col leading-tight">
          <span className="font-serif text-xl text-[#3B4A3F] tracking-wide">The Eden Institute</span>
          <span className="text-xs text-[#7A8C7E] tracking-widest uppercase font-sans">Biblical Herbalism Education</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link to={ctaHref} className="bg-[#3B4A3F] text-[#FAF8F3] text-sm font-sans px-5 py-2 rounded-sm tracking-wide hover:bg-[#2E3D32] transition-colors duration-200">
            {ctaLabel}
          </Link>
        </div>
        <button className="md:hidden text-[#3B4A3F]" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#FAF8F3] border-t border-[#D6CDB8] px-6 pb-6 pt-4 flex flex-col gap-5">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} onClick={() => setOpen(false)} className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide">
              {link.label}
            </Link>
          ))}
          <Link to={ctaHref} onClick={() => setOpen(false)} className="bg-[#3B4A3F] text-[#FAF8F3] text-sm font-sans px-5 py-2 rounded-sm tracking-wide text-center hover:bg-[#2E3D32] transition-colors duration-200">
            {ctaLabel}
          </Link>
        </div>
      )}
    </header>
  );
}
