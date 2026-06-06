import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import { fileURLToPath } from "node:url";

const fromRoot = (p) => fileURLToPath(new URL(p, import.meta.url));

// Astro owns the public MARKETING routes and pre-renders them to static HTML.
// It lives in ./web so its src/pages router never collides with the SPA's
// existing src/pages/*.tsx. Shared React components/CSS are reached via the
// same "@/" alias the SPA uses. publicDir stays ./public (shared favicons,
// robots.txt, sitemap.xml, /showcases images). The SPA is built separately
// into dist/app and served by Vercel rewrites for app/auth routes.
export default defineConfig({
  site: "https://edeninstitute.health",
  srcDir: "./web",
  output: "static",
  trailingSlash: "ignore",
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
      alias: { "@": fromRoot("./src") },
    },
  },
});
