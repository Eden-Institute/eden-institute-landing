import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Plus, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentTier, type Tier } from "@/hooks/useCurrentTier";
import { useActiveProfile } from "@/contexts/ActiveProfileContext";
import { resolveEdenPattern, PATTERN_PROFILES } from "@/lib/edenPattern";
import { ROUTES } from "@/lib/routes";
import { ProfileFormDialog } from "./ProfileFormDialog";

/**
 * Tier caps — v2 schedule (2026-04-30) per tier-cap restructure migration
 * (supabase/migrations/20260430140000_tier_cap_restructure_v2.sql).
 * Mirror of the SQL function public.person_profile_cap_for_tier; single
 * source of truth for the BACKEND remains the SQL function (BEFORE INSERT
 * trigger enforces). This constant is for UX gating only — the dropdown
 * "Cap reached (X)" label and the count readout in the menu header.
 *
 *   Free=0, Seed=5, Root=10, Practitioner=500.
 *
 * Free still excluded by the tier gate below (cap=0, nothing to switch
 * between). Practitioner is deferred to Phase 3 (end of 2027) but the
 * tier-gate handles it for forward-compat.
 */
const TIER_CAP: Record<Tier, number> = {
  anon: 0,
  free: 0,
  seed: 5,
  root: 10,
  practitioner: 500,
};

/**
 * Persistent profile picker pill — top-right nav, Seed tier and above.
 *
 * Per Locked Decision §0.8 #18: "Persistent profile picker pill in top-right
 * nav. Switching profile re-filters directory immediately to the active
 * profile's constitution. Reason: 'whose info am I looking at?' must
 * always be unambiguous."
 *
 * Tier-cap restructure v2 (2026-04-30): picker ungated from Root+ to
 * Seed+ since Seed users now have a 5-cap and need a switcher between
 * their multiple profiles. Free remains gated out (cap=0). Anon is
 * unauthenticated and never sees this surface.
 *
 * Switching active profile updates ActiveProfileContext, which downstream
 * consumers (useDiagnosticProfile, useEdenPattern, HerbDirectoryFilters,
 * HerbCard, useTierAwareCTA) read on next render.
 *
 * Mobile-aware per project_mobile_wrapping_roadmap.md:
 *   - All interactive elements are click/tap-only, no hover-only behavior.
 *   - Tap targets ≥44px (min-h-[44px]) on the trigger and every menu item.
 *   - Dropdown content is touch-friendly (shadcn DropdownMenu handles this).
 */
export function ProfilePicker() {
  const { data: tier } = useCurrentTier();
  const { profiles, activeProfile, setActiveProfileId } = useActiveProfile();
  const [showAddForm, setShowAddForm] = useState(false);

  // Tier gate: Seed, Root, Practitioner see the picker (cap ≥ 1 by v2
  // schedule). Anon and Free see nothing — anon can't auth, Free has
  // cap=0 so there's nothing to switch between.
  if (
    !tier ||
    (tier !== "seed" && tier !== "root" && tier !== "practitioner")
  ) {
    return null;
  }

  const cap = TIER_CAP[tier] ?? 0;
  const canAddMore = profiles.length < cap;

  const renderPatternBadge = (rawValue: string | null) => {
    const pattern = resolveEdenPattern(rawValue);
    if (!pattern) return null;
    const profile = PATTERN_PROFILES[pattern];
    return (
      <span className="text-xs text-muted-foreground ml-2 font-body">
        · {profile.name}
      </span>
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] gap-2"
            aria-label={`Active profile: ${activeProfile?.name ?? "none"}`}
          >
            <User className="w-4 h-4" />
            <span className="font-body text-sm max-w-[140px] truncate">
              {activeProfile?.name ?? "Add profile"}
            </span>
            <ChevronDown className="w-4 h-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[260px]">
          <DropdownMenuLabel className="font-accent text-xs tracking-[0.2em] uppercase">
            Family profiles · {profiles.length} of {cap}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground font-body">
              No profiles yet. Add yourself to start.
            </div>
          ) : (
            profiles.map((p) => (
              <DropdownMenuItem
                key={p.id}
                className="min-h-[44px] cursor-pointer"
                onSelect={() => setActiveProfileId(p.id)}
              >
                <div className="flex items-center w-full">
                  <span className="font-body text-sm">{p.name}</span>
                  {p.is_self && (
                    <span className="text-xs text-muted-foreground ml-2 font-accent uppercase tracking-wider">
                      · self
                    </span>
                  )}
                  {renderPatternBadge(p.eden_constitution)}
                  {activeProfile?.id === p.id && (
                    <span
                      className="ml-auto text-xs font-accent uppercase tracking-wider"
                      style={{ color: "hsl(var(--eden-gold))" }}
                    >
                      active
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canAddMore}
            onSelect={(e) => {
              e.preventDefault();
              if (canAddMore) setShowAddForm(true);
            }}
            className="min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="font-body text-sm">
              {canAddMore ? "Add profile" : `Cap reached (${cap})`}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-[44px] cursor-pointer">
            <Link to={ROUTES.APOTHECARY_PROFILES} className="flex items-center w-full">
              <Settings className="w-4 h-4 mr-2" />
              <span className="font-body text-sm">Manage profiles</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileFormDialog
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        mode="create"
      />
    </>
  );
}
