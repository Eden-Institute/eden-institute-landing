// src/components/utils/PageViewTracker.tsx
//
// Cookieless first-party page-view beacon. On each client-side navigation it
// fire-and-forgets a record_page_view RPC (anon key). The server derives a
// daily-rotating, salted visitor hash from IP+UA — no cookies, no localStorage,
// no PII stored. Mounted once in App, inside <BrowserRouter>.
//
// Internal/admin surfaces are skipped so marketing analytics stay clean.

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { captureFirstTouch } from "@/lib/attribution";
import { installClientErrorBeacon } from "@/lib/clientErrorBeacon";

const SKIP_PREFIXES = ["/founder", "/apothecary/auth", "/apothecary/account"];

export default function PageViewTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  // Browser error report (src/lib/clientErrorBeacon.ts, 2026-11-17). Once per page load, on every app
  // route including the skipped ones below: a broken page is worth knowing about wherever it is.
  useEffect(() => {
    installClientErrorBeacon({
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  }, []);

  useEffect(() => {
    const path = location.pathname;
    if (lastPath.current === path) return; // ignore query-only changes
    lastPath.current = path;
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return;

    captureFirstTouch();
    const params = new URLSearchParams(location.search);
    // Fire-and-forget. Analytics must never block render or surface an error.
    void supabase
      .rpc("record_page_view" as never, {
        p_path: path,
        p_referrer: document.referrer || null,
        p_utm_source: params.get("utm_source"),
        p_utm_medium: params.get("utm_medium"),
        p_utm_campaign: params.get("utm_campaign"),
        p_utm_content: params.get("utm_content"),
      } as never)
      .then(
        () => {},
        () => {},
      );
  }, [location.pathname, location.search]);

  return null;
}
