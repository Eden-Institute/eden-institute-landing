// src/components/utils/GaPageViewTracker.tsx
//
// GA4 page_view for every app route, with the route's real title (2026-10-28).
// index.html configures GA with send_page_view: false; this sends it instead, once
// useDocumentMeta has set the title (src/lib/gaPageView.ts). Mounted once in App,
// beside PageViewTracker, inside <BrowserRouter>. Keyed on the path only: a
// query-only change is not a new page, the same rule PageViewTracker uses.

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { sendPageViewWhenTitled } from "@/lib/gaPageView";

export default function GaPageViewTracker() {
  const location = useLocation();
  // The app page the reader came from. The first page has none and keeps GA's own
  // referrer (document.referrer).
  const fromHref = useRef<string | null>(null);

  useEffect(() => {
    const cancel = sendPageViewWhenTitled(location.pathname, fromHref.current);
    const href = window.location.href;
    return () => {
      cancel();
      fromHref.current = href;
    };
  }, [location.pathname]);

  return null;
}
