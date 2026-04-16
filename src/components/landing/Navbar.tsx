import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Courses", href: "/courses" },
  { label: "Homeschool", href: "/homeschool" },
  { label: "Community", href: "/community" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

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
          <Link to="/quiz" className="bg-[#3B4A3F] text-[#FAF8F3] text-sm font-sans px-5 py-2 rounded-sm tracking-wide hover:bg-[#2E3D32] transition-colors duration-200">
            Take the Quiz
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
          <Link to="/quiz" onClick={() => setOpen(false)} className="bg-[#3B4A3F] text-[#FAF8F3] text-sm font-sans px-5 py-2 rounded-sm tracking-wide text-center hover:bg-[#2E3D32] transition-colors duration-200">
            Take the Quiz
          </Link>
        </div>
      )}
    </header>
  );
}
