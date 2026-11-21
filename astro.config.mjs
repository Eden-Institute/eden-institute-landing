import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import { fileURLToPath } from "node:url";
// The free-week offer after the first section of a flagged /learn article (2026-10-28).
import { remarkFreeWeekOffer } from "./web/lib/freeWeekOffer.ts";

const fromRoot = (p) => fileURLToPath(new URL(p, import.meta.url));

// Astro owns the public MARKETING routes and pre-renders them to static HTML.
// It lives in ./web so its src/pages router never collides with the SPA's
// existing src/pages/*.tsx. Shared React components/CSS are reached via the
// same "@/" alias the SPA uses. publicDir stays ./public (shared favicons,
// robots.txt, sitemap.xml, /showcases images). The SPA is built separately
// into dist/_spa (base /_spa/, see package.json "build") and served by the
// vercel.json rewrite to /_spa/index.html for app/auth routes.
export default defineConfig({
  site: "https://edeninstitute.health",
  srcDir: "./web",
  output: "static",
  trailingSlash: "ignore",
  markdown: {
    remarkPlugins: [remarkFreeWeekOffer],
  },
  integrations: [
    react(),
    // We own base styles via src/index.css imported in the layout.
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    // The SPA's client code reads VITE_-prefixed env (Supabase URL + publishable
    // key, already public). Expose the same prefix to Astro so shared modules
    // (supabase client, analytics) work identically in islands.
    envPrefix: ["VITE_", "PUBLIC_"],
    resolve: {
      alias: [
        // 2026-11-21: marketing pages get a session-less Supabase client (no cross-tab auth lock, so a
        // visitor with several tabs open no longer loses page views). Exact match only, listed BEFORE "@",
        // so "@/integrations/supabase/types" and everything else still resolve into ./src.
        // The SPA (vite.config.ts) keeps the generated client. See web/lib/supabaseWebClient.ts.
        { find: /^@\/integrations\/supabase\/client$/, replacement: fromRoot("./web/lib/supabaseWebClient.ts") },
        { find: "@", replacement: fromRoot("./src") },
      ],
    },
  },
});
