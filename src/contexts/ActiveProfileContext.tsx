import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * PersonProfile — minimal shape consumed by the picker + management surface.
 *
 * Per Lock #37 layered diagnostic stack:
 *   - Layer 1 (eden_constitution), Layer 2 (galenic_temperament), Layer 4
 *     (vital_force_reading) live as columns on this row and are SELECTed
 *     here so the picker dropdown can show "Pattern recorded" / "No Pattern
 *     yet" badges without a second fetch.
 *   - Layer 3 (tissue state profile by organ system) lives in the junction
 *     table public.person_profile_tissue_states and is NOT a column on
 *     this row. The phantom `tissue_state_profile` field that was on this
 *     interface in v3.15 was removed in the v3.16 audit-fix pass; consumers
 *     that need Layer 3 read it via diagnostic_profile_v; a dedicated
 *     per-profile reader hook will ship alongside the deep-quiz frontend
 *     when a consumer mounts.
 */
export interface PersonProfile {
  id: string;
  user_id: string;
  name: string;
  date_of_birth: string;
  biological_sex: "male" | "female";
  profile_kind: "adult" | "child";
  is_self: boolean;
  eden_constitution: string | null;
  galenic_temperament: string | null;
  vital_force_reading: string | null;
  allergies: string | null;
  medications: string | null;
  conditions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ActiveProfileContextValue {
  profiles: PersonProfile[];
  activeProfile: PersonProfile | null;
  setActiveProfileId: (id: string | null) => void;
  isLoading: boolean;
  refetchProfiles: () => Promise<void>;
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(
  null,
);

const STORAGE_KEY = "eden.active_profile_id";

function loadStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / Capacitor — silent; selection persists in-memory only */
  }
}

/**
 * ActiveProfileProvider wraps the entire App tree (per PR β hoist).
 *
 * Per Locked Decision §0.8 #18: "Persistent profile picker pill in top-right
 * nav (Root tier). Switching profile re-filters directory immediately to the
 * active profile's constitution. Reason: 'whose info am I looking at?' must
 * always be unambiguous."
 *
 * Provides:
 * - profiles: all person_profiles for the current user (via React Query;
 *   RLS scopes to user_id = auth.uid() so a plain SELECT * is safe).
 * - activeProfile: currently selected. Hydrated synchronously from
 *   localStorage at first render; defensively re-validated against the
 *   loaded profile list and defaulted to is_self if the stored value
 *   doesn't match (deleted profile, fresh device, cross-account
 *   collision); null if user has no profiles.
 * - setActiveProfileId: switch active and persist to localStorage.
 *
 * Tier-blind: every authed tier gets the provider. The picker UI gates itself
 * by current_user_tier(). Free users (cap=0) have no profiles, so
 * activeProfile stays null.
 *
 * localStorage policy (per project_mobile_wrapping_roadmap.md): the active-
 * profile selection is "session continuity convenience," not critical state.
 * Losing it on a new device or clean storage degrades gracefully to the
 * is_self default. All localStorage access is wrapped in try/catch so
 * Capacitor private-mode contexts don't throw.
 *
 * PR δ (2026-05-02) hydration race fix: activeProfileIdState is now
 * initialized synchronously from localStorage in the useState lazy
 * initializer rather than reset to null and hydrated via useEffect.
 * This closes a one-render window where activeProfileIdState was null
 * but profiles had already loaded — during that gap, useEdenPattern's
 * "no active profile → user-level read" branch returned the
 * signed-in user's primary Pattern (Camila's Burning Bowstring) even
 * when a non-self profile (Olivia's Frozen Knot) was actually selected.
 * Combined with the useEdenPattern context-isLoading gate, this makes
 * the active-profile resolution deterministic across all timing paths.
 */
export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ["person_profiles", user?.id ?? "anon"],
    queryFn: async (): Promise<PersonProfile[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("person_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("is_self", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) {
        // Soft-failure surface: empty list, picker shows "Add profile".
        return [];
      }
      return (data ?? []) as PersonProfile[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const profiles = profilesQuery.data ?? [];

  // PR δ: synchronous localStorage init via useState lazy initializer.
  // Earlier versions started at null and hydrated in a useEffect AFTER
  // profilesQuery resolved — which left a one-render gap where state was
  // null but profiles were loaded, during which useEdenPattern fell
  // through to the user-level read and returned the wrong Pattern for
  // non-self active profiles.
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    () => loadStoredId(),
  );

  // Defensive validation pass: once profiles arrive, confirm the
  // synchronously-hydrated stored ID is still valid against the loaded
  // list (the profile may have been deleted, RLS may have rejected it,
  // or this device's localStorage may carry an ID from a different
  // signed-in account). If the stored ID isn't in the list, fall back to
  // is_self — or the first profile if no self exists.
  useEffect(() => {
    if (profilesQuery.isLoading) return;
    if (profiles.length === 0) {
      if (activeProfileId !== null) setActiveProfileIdState(null);
      return;
    }
    if (activeProfileId && profiles.some((p) => p.id === activeProfileId)) {
      // Stored ID is valid against the loaded profile list — nothing to do.
      return;
    }
    // Either no stored ID, or the stored ID isn't in this user's profiles.
    // Fall back to is_self, then to first profile.
    const self = profiles.find((p) => p.is_self);
    setActiveProfileIdState(self?.id ?? profiles[0].id);
    // We intentionally don't include activeProfileId in the deps array —
    // it's read inside the effect for the validity check, but we want this
    // effect to fire only when the profile list itself changes. If a
    // consumer calls setActiveProfileId() that's the source of the change,
    // not this effect's purpose to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, profilesQuery.isLoading]);

  const setActiveProfileId = (id: string | null) => {
    setActiveProfileIdState(id);
    storeId(id);
  };

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId],
  );

  const value: ActiveProfileContextValue = useMemo(
    () => ({
      profiles,
      activeProfile,
      setActiveProfileId,
      isLoading: profilesQuery.isLoading,
      refetchProfiles: async () => {
        await queryClient.invalidateQueries({ queryKey: ["person_profiles"] });
      },
    }),
    [profiles, activeProfile, profilesQuery.isLoading, queryClient],
  );

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

/**
 * useActiveProfile — strict consumer hook. Must be used inside
 * ActiveProfileProvider (mounted at App scope per PR β). Throws if used
 * outside the provider so the mistake surfaces at component-mount time
 * rather than as a silent null-deref.
 */
export function useActiveProfile(): ActiveProfileContextValue {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    throw new Error(
      "useActiveProfile must be used within ActiveProfileProvider",
    );
  }
  return ctx;
}

/**
 * useActiveProfileOptional — non-throwing variant. Returns null when used
 * outside ActiveProfileProvider. Post-PR β the provider is mounted at App
 * scope so this should rarely be null in practice, but the optional
 * variant is preserved for tests and future surfaces that intentionally
 * mount outside the provider tree.
 */
export function useActiveProfileOptional(): ActiveProfileContextValue | null {
  return useContext(ActiveProfileContext);
}
