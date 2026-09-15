// Second vitest project: tests that render real .astro pages.
//
// Astro components need Astro's own Vite plugins to compile, which the main
// jsdom project (vitest.config.ts) does not load. getViteConfig reads
// astro.config.mjs, so these tests compile pages exactly the way the build
// does, then render them with Astro's container API (astro/container). The
// main config lists this file under test.projects, so `npm test` runs both.
//
// Only files named *.astro.test.ts run here, in Node (a page render is a
// server render, there is no DOM to emulate).
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    name: "astro",
    environment: "node",
    include: ["src/**/*.astro.test.ts"],
  },
});
