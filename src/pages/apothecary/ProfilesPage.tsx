import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/apothecary/RequireAuth";
import { RequireTier } from "@/components/apothecary/RequireTier";
import {
  useActiveProfile,
  type PersonProfile,
} from "@/contexts/ActiveProfileContext";
import { useCurrentTier, type Tier } from "@/hooks/useCurrentTier";
import { ProfileFormDialog } from "@/components/apothecary/ProfileFormDialog";
import { resolveEdenPattern, PATTERN_PROFILES } from "@/lib/edenPattern";

// Tier-cap restructure v2 (2026-04-30) — mirror of
// public.person_profile_cap_for_tier(tier text) in the corresponding
// migration file. Single source of truth for the BACKEND is the SQL
// function (BEFORE INSERT trigger enforces). This constant is for
// UX gating only — "Add profile" disabled-state, header count
// readout. Keep in lockstep with the SQL function.
const TIER_CAP: Record<Tier, number> = {
  anon: 0,
  free: 0,
  seed: 5,
  root: 10,
  practitioner: 500,
};

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
}: {
  profile: PersonProfile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pattern = resolveEdenPattern(profile.eden_constitution);
  const patternProfile = pattern ? PATTERN_PROFILES[pattern] : null;
  return (
    <div
      className="rounded-lg border border-border/60 bg-card p-5"
      style={{ borderColor: "hsl(var(--eden-bark) / 0.2)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-semibold">{profile.name}</h3>
          <p className="font-body text-sm text-muted-foreground mt-0.5">
            {profile.profile_kind === "child" ? "Child" : "Adult"} ·{" "}
            {ageFromDob(profile.date_of_birth)} years old ·{" "}
            {profile.biological_sex === "female" ? "Female" : "Male"}
          </p>
        </div>
        {profile.is_self && (
          <span
            className="font-accent text-xs tracking-[0.2em] uppercase shrink-0"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Self
          </span>
        )}
      </div>
      {patternProfile && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="font-accent text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Pattern
          </p>
          <p className="font-body text-sm mt-1">{patternProfile.name}</p>
        </div>
      )}
      {(profile.allergies ||
        profile.medications ||
        profile.conditions ||
        profile.notes) && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-sm font-body">
          {profile.allergies && (
            <div>
              <span className="text-muted-foreground">Allergies: </span>
              {profile.allergies}
            </div>
          )}
          {profile.medications && (
            <div>
              <span className="text-muted-foreground">Medications: </span>
              {profile.medications}
            </div>
          )}
          {profile.conditions && (
            <div>
              <span className="text-muted-foreground">Conditions: </span>
              {profile.conditions}
            </div>
          )}
          {profile.notes && (
            <div>
              <span className="text-muted-foreground">Notes: </span>
              {profile.notes}
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={onEdit}
        >
          <Pencil className="w-4 h-4 mr-1.5" />
          Edit
        </Button>
        {!profile.is_self && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfilesPageContent() {
  const { data: tier } = useCurrentTier();
  const { profiles, activeProfile, refetchProfiles, setActiveProfileId } =
    useActiveProfile();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PersonProfile | null>(
    null,
  );
  const [deletingProfile, setDeletingProfile] = useState<PersonProfile | null>(
    null,
  );

  const cap = tier ? (TIER_CAP[tier] ?? 0) : 0;
  const canAddMore = profiles.length < cap;

  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("person_profiles")
        .delete()
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: async () => {
      // If we deleted the active profile, ActiveProfileContext re-hydrates to is_self.
      if (deletingProfile && activeProfile?.id === deletingProfile.id) {
        setActiveProfileId(null);
      }
      setDeletingProfile(null);
      await refetchProfiles();
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            Family profiles
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {profiles.length} of {cap} profile{cap === 1 ? "" : "s"} used.
            Constitutional-quiz results land on each profile automatically.
          </p>
        </div>
        <Button
          variant="eden"
          disabled={!canAddMore}
          onClick={() => setShowAddForm(true)}
          className="min-h-[44px] shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {canAddMore ? "Add profile" : `Cap reached (${cap})`}
        </Button>
      </header>

      {profiles.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border/60 bg-card p-10 text-center"
          style={{ borderColor: "hsl(var(--eden-bark) / 0.2)" }}
        >
          <h2 className="font-serif text-lg font-semibold">No profiles yet</h2>
          <p className="font-body text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Start by adding yourself. Each family member gets their own profile
            so the directory can match herbs to their specific terrain.
          </p>
          <Button
            variant="eden"
            onClick={() => setShowAddForm(true)}
            className="mt-5 min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add your profile
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onEdit={() => setEditingProfile(p)}
              onDelete={() => setDeletingProfile(p)}
            />
          ))}
        </div>
      )}

      <ProfileFormDialog
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        mode="create"
      />
      {editingProfile && (
        <ProfileFormDialog
          open={true}
          onClose={() => setEditingProfile(null)}
          mode="edit"
          profile={editingProfile}
        />
      )}

      {/* Delete confirmation */}
      {deletingProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => !deleteMutation.isPending && setDeletingProfile(null)}
        >
          <div
            className="bg-card rounded-lg border border-border p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold">
              Delete profile?
            </h3>
            <p className="font-body text-sm text-muted-foreground mt-2">
              This permanently removes <strong>{deletingProfile.name}</strong>{" "}
              and any diagnostic data attached to this profile. Cannot be
              undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingProfile(null)}
                disabled={deleteMutation.isPending}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deletingProfile.id)}
                disabled={deleteMutation.isPending}
                className="min-h-[44px]"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete profile"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * /apothecary/profiles — multi-profile management surface.
 *
 * Tier-cap restructure v2 (2026-04-30): Free=0, Seed=5, Root=10,
 * Practitioner=500. Page ungated from {root, practitioner} to
 * {seed, root, practitioner} so Seed users with their new 5-cap
 * can actually reach the management surface. Free still excluded
 * (cap=0, nothing to manage) per Decision 2.
 *
 * Auth + tier gating is enforced at three layers:
 *   1. RequireAuth — must be authenticated to reach this route.
 *   2. RequireTier — must be Seed+ tier; lower tiers see the paywall fallback.
 *   3. RLS — Postgres row-level security on person_profiles enforces
 *      user_id = auth.uid() so even a misconfigured client can't see
 *      another user's profiles.
 */
export default function ProfilesPage() {
  return (
    <RequireAuth>
      <RequireTier allow={["seed", "root", "practitioner"]}>
        <ProfilesPageContent />
      </RequireTier>
    </RequireAuth>
  );
}
