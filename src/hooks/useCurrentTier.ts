import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Tier = "anon" | "free" | "seed" | "root" | "practitioner";

const KNOWN_TIERS: ReadonlyArray<Tier> = [
  "anon",
  "free",
  "seed",
  "root",
  "practitioner",
];

/**
 * Returns the current user's tier via the Postgres RPC current_user_tier(),
 * which is the single source of truth for tier gating per Locked Decision §0.8.
 *
 * - Anon visitors → "anon"
 * - Authed users → their profiles.subscription_tier value
 * - Cache key includes user id so the cache is naturally invalidated on
 *   signin/signout/user-switch. We also set a short-ish staleTime so tier
 *   changes (e.g., after Stripe webhook upgrade) are picked up on page focus.
 */
export function useCurrentTier() {
  const { user, loading: authLoading } = useAuth();

  return useQuery<Tier>({
    queryKey: ["currentTier", user?.id ?? "anon"],
    queryFn: async (): Promise<Tier> => {
      const { data, error } = await supabase.rpc("current_user_tier");
      if (error) throw error;
      const value = typeof data === "string" ? data : "anon";
      return (KNOWN_TIERS as readonly string[]).includes(value)
        ? (value as Tier)
        : "anon";
    },
    enabled: !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
