// Setup for the Astro page-render tests (vitest.astro.config.ts).
//
// In a real build, Astro's assets Vite plugin creates globalThis.astroAsset
// with a referencedImages Set, and every read of an imported image
// (heroX.src, .width) is recorded there. These tests render pages in a vitest
// worker, where that plugin state does not exist. The first getImage() call
// (web/components/HeroBackdrop.astro) then creates globalThis.astroAsset
// WITHOUT the Set, and the next image read throws "Cannot read properties of
// undefined (reading 'add')". Seeding the same shape the build has keeps the
// render identical to the build's.
const g = globalThis as unknown as { astroAsset?: { referencedImages?: Set<string> } };
g.astroAsset ??= {};
g.astroAsset.referencedImages ??= new Set();
