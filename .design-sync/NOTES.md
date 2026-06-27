# design-sync NOTES — Eden Institute DS

Repo: `eden-institute-landing` (Vite + React + Astro + shadcn/ui). This is an **app, not a library** — no published component entry, so the sync runs the package shape in a curated **barrel-entry** mode.

## Build setup (how this repo syncs)
- **Curated barrel entry**: `.design-sync/gen-entry.mjs` generates `eden-ds-entry.tsx` (repo root, gitignored) + `.design-sync/.componentSrcMap.json`. Re-run the generator before a re-sync if components changed. The barrel `export *`s only vetted presentational components so the IIFE doesn't crash.
- **`cfg.entry = ./eden-ds-entry.tsx`** anchors PKG_DIR to the repo root (package.json name `vite_react_shadcn_ts`); `cfg.globalName = EdenInstitute` overrides the ugly pkg name.
- **CSS**: shadcn is Tailwind-utility-styled. Raw `src/index.css` is just `@tailwind` directives — useless uncompiled. `cfg.cssEntry` points at the **compiled SPA stylesheet** `dist/_spa/assets/index-*.css` (full utilities + `--eden-*` brand tokens). NOTE: the hash in that filename changes if the app is rebuilt — update `cfg.cssEntry` if `npm run build` is re-run.
- **Fonts**: load via remote Google Fonts `@import` at the top of the compiled CSS (Playfair Display, Crimson Text, Cormorant Garamond, EB Garamond, Caveat) → `[FONT_REMOTE]`, no font files to ship.

## Bundle-safety exclusions (module-eval crashers)
- **Supabase client** (`@/integrations/supabase/client`) calls `createClient(import.meta.env.VITE_SUPABASE_URL, ...)` at module scope. In an esbuild IIFE `import.meta.env` is undefined → `createClient(undefined,...)` **throws at module load and crashes the whole bundle**. So any component importing it (19 files incl. PricingTier, CheckoutButton, HerbCard's neighbors, founder/* tabs, auth) is **excluded from the barrel**.
- Also excluded: page sections (`*Section`, Navbar, Footer, layouts), contexts, `utils/*` trackers, `founder/*` dashboard, modals/forms — page-level, not design-system primitives.
- `ui/sonner.tsx` denied (its `Toaster` export collides with `ui/toaster.tsx`).

## Scope (first sync, 2026-06-27)
- 57 components: ~47 shadcn `ui/` primitives (themed) + curated Eden set (AxisSpectrum, BotanicalAccents ×4, WorldviewBand, PublicTierCard, TierComparison, PageSkeleton, HerbCard).
- Plan: floor cards for stock shadcn; authored rich previews for the Eden-specific + most-used primitives.

## Brand aesthetic direction
- Founder wants a **vintage apothecary / Materia Medica** look (ancient herbal knowledge unearthed): aged parchment, botanical illustration, serif display type, gold accents, manuscript quiet space. Encode in `conventions.md` (readmeHeader). Tokens already lean this way.

## Authored previews (techniques baked into `.design-sync/previews/*.tsx`)
- 36 components have authored previews; the rest ship the floor card (functional, authorable on any re-sync).
- **Overlays render their OPEN state in-card**: Dialog/Sheet/AlertDialog use controlled `open` (and Dialog/Sheet add inline `position:static; transform:none` on the content) so the panel paints. `cfg.overrides` frames them: `Dialog`/`Sheet`/`TierComparison` set `cardMode:"single"` + a viewport.
- **Select** uses `open` + a wrapper `minHeight` so the Radix portal dropdown paints. **Tooltip** uses `defaultOpen` to show the bubble. **Avatar** uses `AvatarFallback` only (no image URLs in the sandbox). **Menubar** dropdowns are portaled with no controlled-open prop → the menubar bar is the graded surface.
- **HerbCard floor-carded on purpose**: its `herb: HerbRow` prop is a large DB row with citations + match computation — too much to mock for marginal value (the Card "Chamomile monograph" preview covers the herb-card aesthetic).

## Known render warns (triaged legitimate — don't re-flag on re-sync)
- Botanical SVGs (`BotanicalLeaf*`, `BotanicalSprig`) are faint line-art → may warn `[RENDER_THIN]`; intentional, framed on parchment in their previews.
- Overlay previews may show a faint full-bleed `bg-black/80` scrim behind the card; content stays legible.

## Re-sync risks
- `cfg.cssEntry` filename hash is build-dependent — re-check after any app rebuild.
- Curated component list is hand-vetted for supabase/module-eval safety; if new presentational components are added, vet their imports before adding to `gen-entry.mjs` EDEN list.
