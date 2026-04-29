import { Link, NavLink } from "react-router-dom";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTier, Tier } from "@/hooks/useCurrentTier";
import { ProfilePicker } from "./ProfilePicker";
import { ROUTES } from "@/lib/routes";

type NavItem = { to: string; label: string; end?: boolean };

/**
 * Authed-only nav links. Unauthenticated visitors only ever see /apothecary/start
 * (Locked Decision §0.8 v3.3 #21 — no anonymous browsing inside the app), so the
 * middle nav surface is empty for them by design.
 */
const AUTHED_NAV_LINKS: NavItem[] = [
  { to: ROUTES.APOTHECARY, label: "Home", end: true },
  { to: ROUTES.APOTHECARY_PRICING, label: "Pricing" },
  { to: ROUTES.APOTHECARY_ACCOUNT, label: "Account" },
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

  // Logo routes to the directory for authed users, to the public landing
  // for everyone else. Keeps the nav self-consistent with the auth wall.
  const logoTo = user ? ROUTES.APOTHECARY : ROUTES.APOTHECARY_START;

  return (
    <nav className="border-b border-border/40 bg-background sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to={logoTo}
          className="font-serif text-xl font-semibold flex items-center gap-2"
          style={{ color: "hsl(var(--eden-bark))" }}
        >
          <Leaf className="w-5 h-5" style={{ color: "hsl(var(--eden-gold))" }} />
          Eden Apothecary
        </Link>
        {user && (
          <div className="hidden md:flex items-center gap-6">
            {AUTHED_NAV_LINKS.map((link) => (
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
        )}
        <div className="flex items-center gap-3">
          {user && tier && tier !== "anon" && (
            <span
              className="hidden sm:inline-block font-accent text-xs tracking-[0.2em] uppercase"
              style={{ color: "hsl(var(--eden-gold))" }}
            >
              {tierLabel[tier]}
            </span>
          )}
          {/*
            ProfilePicker — Stage 6.3.5 Phase B sub-task 4. Renders only at
            Root+ tier (self-gates). Sits between the tier badge and the
            Sign-out button so the tier indicator stays as the leftmost
            account-context anchor and the picker has visual primacy as the
            primary "whose info am I looking at?" affordance per Lock §0.8 #18.
          */}
          {user && <ProfilePicker />}
          {user ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          ) : (
            <Button variant="eden" size="sm" asChild>
              <Link to={ROUTES.APOTHECARY_SIGNIN}>Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
