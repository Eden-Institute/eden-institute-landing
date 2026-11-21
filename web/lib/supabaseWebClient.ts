// web/lib/supabaseWebClient.ts
//
// The marketing site's (Astro build's) Supabase client. astro.config.mjs aliases the exact module
// "@/integrations/supabase/client" to this file, so every island (page views, the waitlist form, buy
// boxes, Get Involved, CTA beacon) uses it. The SPA (founder dashboard, Apothecary) builds with
// vite.config.ts and keeps the generated client in src/integrations/supabase/client.ts unchanged.
//
// Why (2026-11-21, 8 AM digest system check, Camila's tap "Build the fix"): the generated client keeps a
// login session and coordinates token refreshes across tabs with a Navigator lock named
// "lock:sb-<ref>-auth-token". A visitor with several of our pages open at once waited on that lock, it
// gave up after 10 s ("Acquiring an exclusive Navigator LockManager lock ... timed out waiting 10000ms",
// 8 browser errors from 4 visitors on 11/20) and that page's view was never counted. No marketing page
// ever signs anyone in (supabase.auth is used only by SPA code: AuthContext, founder StepUp/SecurityTab,
// Apothecary auth), so here there is no stored session, no refresh timer, no session-in-URL parsing, and
// an in-tab lock instead of the cross-tab one. Requests still carry the publishable key, exactly as an
// anonymous visitor's always did.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Runs the auth step at once: with no session to share there is nothing to coordinate across tabs. */
export const inTabLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

export const WEB_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  lock: inTabLock,
} as const;

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: WEB_AUTH_OPTIONS },
);
