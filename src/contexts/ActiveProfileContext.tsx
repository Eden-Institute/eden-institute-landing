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
 *     that need Layer 3 read it via diagnostic_profile_v (or the dedicated
 *     `usePersonProfileTissueStates` hook when it ships).
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
 * ActiveProfileProvider wraps the apothecary route subtree.
 *
 * Per Locked Decision §0.8 #18: "Persistent profile picker pill in top-right
 * nav (Root tier). Switching profile re-filters directory immediately to the
 * active profile's constitution. Reason: 'whose info am I looking at?' must
 * always be unambiguous."
 *
 * Provides:
 * - profiles: all person_profiles for the current user (via React Query;
 *   RLS scopes to user_id = auth.uid() so a plain SELECT * is safe).
 * - activeProfile: currently selected. Hydrated from localStorage on
 *   profile-list load; defaults to is_self if no valid stored value;
 *   defaults to first profile if no self exists; null if user has no profiles.
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

  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    null,
  );

  // Hydrate active id from localStorage on profile-list load.
  // Default to is_self if no valid stored value.
  useEffect(() => {
    if (profilesQuery.isLoading) return;
    if (profiles.length === 0) {
      setActiveProfileIdState(null);
      return;
    }
    const stored = loadStoredId();
    if (stored && profiles.some((p) => p.id === stored)) {
      setActiveProfileIdState(stored);
      return;
    }
    const self = profiles.find((p) => p.is_self);
    setActiveProfileIdState(self?.id ?? profiles[0].id);
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
 * ActiveProfileProvider (mounted at ApothecaryLayout). Throws if used
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
 * outside ActiveProfileProvider (e.g. on the marketing /assessment route,
 * which is not mounted under ApothecaryLayout).
 *
 * Rationale: hooks like useEdenPattern and useDiagnosticProfile are
 * consumed both inside the apothecary subtree (where the picker exists)
 * AND in places that pre-date the picker. The strict useActiveProfile
 * throw would force every consumer to gate itself on route, which is
 * brittle. The optional variant lets the hook decide its behavior based
 * on context availability rather than caller routing.
 */
export function useActiveProfileOptional(): ActiveProfileContextValue | null {
  return useContext(ActiveProfileContext);
}
