import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/", external: false },
  { label: "Eden's Table", href: "/homeschool", external: false },
  { label: "Courses", href: "/courses", external: false },
  { label: "Apothecary", href: "/apothecary", external: false },
  { label: "The Book", href: "https://www.amazon.com/dp/B0GPW5BZ32?tag=theedeninstit-20", external: true },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const renderLink = (
    link: { label: string; href: string; external: boolean },
    onClick?: () => void,
  ) =>
    link.external ? (
      <a
        key={link.href}
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200"
      >
        {link.label}
      </a>
    ) : (
      <Link
        key={link.href}
        to={link.href}
        onClick={onClick}
        className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200"
      >
        {link.label}
      </Link>
    );

  return (
    <header className="w-full bg-[#FAF8F3] border-b border-[#D6CDB8] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex flex-col leading-tight">
          <span className="font-serif text-xl text-[#3B4A3F] tracking-wide">The Eden Institute</span>
          <span className="text-xs text-[#7A8C7E] tracking-widest uppercase font-sans">Biblical Herbalism Education</span>
        </Link>
        <nav className="hidden min-[880px]:flex items-center gap-8">
          {navLinks.map((link) => renderLink(link))}
        </nav>
        <div className="hidden min-[880px]:block">
          <Link
            to="/assessment"
            className="text-sm font-sans px-5 py-2 rounded-sm tracking-wide transition-colors duration-200 min-h-[44px] inline-flex items-center"
            style={{ backgroundColor: "var(--honey, #C5A44E)", color: "#1C3A2E" }}
          >
            Take the Quiz
          </Link>
        </div>
        <button
          className="min-[880px]:hidden text-[#3B4A3F] min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="min-[880px]:hidden bg-[#FAF8F3] border-t border-[#D6CDB8] px-6 pb-6 pt-4 flex flex-col gap-5">
          {navLinks.map((link) => renderLink(link, () => setOpen(false)))}
          <Link
            to="/assessment"
            onClick={() => setOpen(false)}
            className="text-sm font-sans px-5 py-2 rounded-sm tracking-wide text-center min-h-[44px] inline-flex items-center justify-center"
            style={{ backgroundColor: "var(--honey, #C5A44E)", color: "#1C3A2E" }}
          >
            Take the Quiz
          </Link>
        </div>
      )}
    </header>
  );
}
