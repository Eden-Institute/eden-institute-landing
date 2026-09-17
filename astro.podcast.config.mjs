import { defineConfig } from "astro/config";

// Tales & Table Talk (talesandtabletalk.com) builds from this same repo but as
// its OWN Vercel project, so it gets its own canonical host. Astro allows one
// `site` per build: sharing the Eden build would stamp every canonical, sitemap
// entry and absolute URL on the show page with edeninstitute.health, which tells
// Google the podcast domain is a duplicate of a different site. Hence a second
// config with its own srcDir/publicDir/outDir. Nothing here touches the Eden
// build (astro.config.mjs) or vercel.json, which routes the live store.
export default defineConfig({
  site: "https://talesandtabletalk.com",
  srcDir: "./web-podcast",
  publicDir: "./public-podcast",
  outDir: "./dist-podcast",
  output: "static",
  trailingSlash: "ignore",
});
