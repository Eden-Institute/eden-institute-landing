import { Link, NavLink } from "react-router-dom";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";

const NAV_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: "/apothecary", label: "Home", end: true },
  { to: "/apothecary/pricing", label: "Pricing" },
];

const tierLabel: Record<Tier, string> = {
  anon: "",
  free: "Free",
  seed: "Seed",
  root: "Root",
  practitioner: "Practitioner",
};

export function ApothecaryNav() {
  const { user, signOut } = useAuth();
  const { data: tier } = useCurrentTier();

  return (
    <nav className="border-b border-border/40 bg-background sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/apothecary"
          className="font-serif text-xl font-semibold flex items-center gap-2"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          <Leaf className="w-5 h-5" style={{ color: "hsl(var(--eden-gold))" }} />
          Eden Apothecary
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `font-body text-sm transition-colors ${
                  isActive
                    ? "font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
              style={({ isActive }) =>
                isActive ? { color: "hsl(var(--eden-bark))" } : {}
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user && tier && tier !== "anon" && (
            <span
              className="hidden sm:inline-block font-accent text-xs tracking-[0.2em] uppercase"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              {tierLabel[tier]}
            </span>
          )}
          {user ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          ) : (
            <Button variant="eden" size="sm" asChild>
              <Link to="/apothecary/auth/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
