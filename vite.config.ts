import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// The SPA is built a second time into dist/_spa with --base /_spa/ (package.json build).
// Astro already copies public/ to dist/, so skip the duplicate copy and point
// public-file URLs (the favicon links in index.html) at the root copy.
const isSpaSubBuild = process.argv.includes("/_spa/");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ...(isSpaSubBuild && {
    build: { copyPublicDir: false },
    experimental: {
      renderBuiltUrl(filename: string, { type }: { type: "public" | "asset" }) {
        return type === "public" ? `/${filename}` : undefined;
      },
    },
  }),
}));
