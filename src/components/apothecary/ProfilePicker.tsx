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
 * Tier caps per Locked Decision §0.8 #19. Free=0 / Seed=1 mean those tiers
 * cannot have a switcher (nothing to switch between); Practitioner is deferred
 * to Phase 3 (end of 2027) but the tier-gate handles it for forward-compat.
 */
const TIER_CAP: Record<Tier, number> = {
  anon: 0,
  free: 0,
  seed: 1,
  root: 6,
  practitioner: 500,
};

/**
 * Persistent profile picker pill — top-right nav, Root tier and above.
 *
 * Per Locked Decision §0.8 #18: "Persistent profile picker pill in top-right
 * nav (Root tier). Switching profile re-filters directory immediately to the
 * active profile's constitution. Reason: 'whose info am I looking at?' must
 * always be unambiguous."
 *
 * Renders nothing for tiers with cap < 2 (anon, free, seed). Switching active
 * profile updates ActiveProfileContext, which downstream consumers
 * (useDiagnosticProfile, useEdenPattern, HerbDirectoryFilters, HerbCard)
 * read on next render.
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

  // Tier gate: only Root + Practitioner see the picker.
  if (!tier || (tier !== "root" && tier !== "practitioner")) {
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
