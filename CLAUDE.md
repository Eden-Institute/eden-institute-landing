# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is the working memory for Eden Institute / Eden Apothecary — auto-loaded every session. Keep it high-signal.

---

## ▶ START EVERY SESSION HERE

Run this before doing task work:

1. **Read the newest `Session_Log_*.md`** in `…/Products/App/Eden Apothecary/` (they're dated + versioned; newest = where we left off). It is the authoritative continuity record.
2. **Skim the Manual** `…/Products/App/Eden Apothecary/Eden_Apothecary_Manual_v*.docx` (latest version) — §0 (Locks, founding decisions) and §9 (Session Log). Use the `docx` skill to read/edit it.
3. **Verify the Supabase MCP token:** call `mcp__supabase__list_tables`. If `Unauthorized`, the token lapsed — see "Supabase MCP token" below.
4. **Verify repo state:** `git -C <repo> log --oneline -5` and `mcp__github__list_pull_requests` (open PRs).
5. **Then ask Camila what to work on** — surface anything in "Current open items" first.

I do **not** have memory between sessions. Continuity = these artifacts. **Update the Session Log (and the Manual) at the end of every session — non-negotiable.**

---

## Who & what

- **Founder:** Camila Johnson (`hello@edeninstitute.health`). Architect-founder, not a developer; runs Windows PowerShell. She decides; I build.
- **Eden Apothecary is an APP** (not a course/service/product line) — every consumer surface must frame it that way.
- **Repo:** `Eden-Institute/eden-institute-landing` · default branch `main` · local clone at `C:\Users\gramm\OneDrive\Documents\Biblical Herbalism\Products\App\eden-institute-landing-repo` (her PowerShell auto-cds here).
- **Supabase:** project ref `noeqztssupewjidpvhar`; custom tables in `public`.
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons + rewrites in `vercel.json`.
- **Stack:** Astro (static marketing pages, `web/`) + Vite React SPA (TS, `src/`), Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, LearnWorlds (webhook), Vercel. Repo originated from Lovable (hence the boilerplate README and both `package-lock.json` and `bun.lock` — npm is the working flow).
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.

## Commands

```
npm i                # install
npm run dev          # SPA dev server (Vite, port 8080)
npm run dev:astro    # Astro dev server (marketing pages)
npm run build        # full prod build: astro build → dist/, then SPA → dist/_spa (base /_spa/)
npm run lint         # eslint .
npm test             # vitest run (jsdom; setup: src/test/setup.ts)
npx vitest run src/test/edenPattern.test.ts   # single test file
```

Test coverage is thin by design: `src/test/edenPattern.test.ts` covers the core Pattern engine; that's the load-bearing suite.

## Architecture — hybrid Astro + SPA

One repo, two frontends sharing `src/` code via the same `@/` alias:

- **Astro** (`astro.config.mjs`, `srcDir: "./web"`, `output: "static"`) pre-renders the public **marketing** routes to static HTML for SEO: `/` (homepage), `/why-eden`, `/courses`, `/constitutional-herbalism`, `/community`, `/homeschool`, `/homeschool/herbs`. Shared shell: `web/layouts/MarketingLayout.astro` (per-page title/canonical/OG/JSON-LD baked into static HTML); Astro-native Navbar/Footer ports in `web/components/`.
- **SPA** (React Router; routes in `src/App.tsx`, all static imports — no lazy loading) builds to `dist/_spa`; the `vercel.json` rewrite sends every path that isn't a static file to `/_spa/index.html`. It owns everything interactive/auth'd: `/assessment` (quiz; `/quiz` redirects there), `/results/:slug`, `/guide/:slug` + `/guide/success`, `/apothecary/**` (the app), `/founder` (dashboard), `/homeschool/welcome` (Stripe success redirect), `/tier-2-waitlist`, legal ×3.
- **Dual-render hazard:** marketing pages exist in BOTH `web/pages/*.astro` (what crawlers and first loads get) and `src/pages/*.tsx` (what renders after client-side navigation inside the SPA — its Navbar uses react-router `<Link>`). Copy changes on marketing pages must be applied to **both** or the two renders drift.
- **Islands** (`web/components/islands/`): interactive React inside Astro — `SiteAnalytics` (mounted once per page in the layout; Astro counterpart of the SPA's PageViewTracker + MetaPixelTracker + ConsentBanner), `HomeJourneyPersonalizer` (homepage returning-visitor personalization), `WaitlistController` (homeschool), `PartnerInquiryForm`. Any island that imports the Supabase client **must be `client:only="react"`** — the client touches `localStorage` at module load and crashes SSR. Every existing island is `client:only`.

### SPA internals

- **`src/lib/routes.ts` is the canonical route table** (born from a lost-leads 404 incident). New route = add to `ROUTES` AND the matching `<Route>` in `App.tsx`; never hardcode path strings at callsites.
- Provider order (App.tsx): `QueryClientProvider` → `BrowserRouter` → `AuthProvider` → `ActiveProfileProvider`. `ActiveProfileProvider` is deliberately **global**, not apothecary-scoped — the active person-profile (localStorage `eden.active_profile_id`) must survive navigation to marketing pages, and it calls `useAuth()` so order matters.
- Apothecary app: `/apothecary/**` under `ApothecaryLayout`. Public surfaces: `start`, `auth/*`, `pricing` (deliberately public for conversion). `RequireAuth`-walled: home, welcome, welcome-tour, account, profiles, favorites. The in-app quiz route is additionally `RequireTier`-gated (guards in `src/components/apothecary/`).
- **Pattern engine:** `src/lib/edenPattern.ts` — single source of truth for the eight Patterns (Temperature × Moisture × Tone axes) and herb↔Pattern scoring (a herb *matches* the Pattern whose axes it opposes; same-axis = aggravates). Quiz domain around it: `src/pages/Assessment.tsx` (12 base questions), `quiz-followup.ts` (tie-breakers when axes are Neutral), `diagnosticProfile.ts` (4-layer diagnostic contract), `constitution-data.ts`/`constitution-utils.ts`. Tier pricing/features: `src/lib/apothecaryTiers.ts`.
- Supabase client: `import { supabase } from "@/integrations/supabase/client"` (`types.ts` is auto-generated — don't hand-edit). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; Astro exposes the same `VITE_` prefix so shared modules work in islands.
- Analytics: cookieless first-party page views via the `record_page_view` RPC (`PageViewTracker` in the SPA, `SiteAnalytics` island in Astro — both skip `/founder` and apothecary auth/account paths) + consent-gated Meta Pixel (`src/lib/metaPixel.ts`, gated by `src/lib/consent.ts`). Server-side Meta CAPI lives in the `resend-waitlist` EF.
- **Dashboard counts/aggregates must always be computed server-side (RPC), never `data.length`** — PostgREST caps RPC rows at 1000 (the `/founder` dashboard froze at ~994 before `founder_lead_summary`). Founder RPCs are gated server-side by `is_founder()`; the client `RequireAuth` is UX, not the boundary.

### Backend — Supabase Edge Functions + Vercel crons

Edge functions live in `supabase/functions/`; `supabase/config.toml` **locks `verify_jwt` per function at the file layer** (Lock #72) and documents the categories — register every new function there:

1. **Public-frontend** (`verify_jwt=false`, do their own validation): `resend-waitlist` (waitlist insert + at-signup email + Meta CAPI), `record-quiz-completion`, `record-diagnostic-completion` (sole write surface for `diagnostic_completions`, Locks #40/#41), `submit-feedback`, `submit-partner-inquiry`, `unsubscribe` (RFC 8058, signed-token auth), `guide-checkout` (302 → Stripe, email-safe), plus the two retired waitlist-signup functions.
2. **Webhooks** (`verify_jwt=false`, signature-authed): `stripe-webhook` (HMAC; also fulfillment — provisions users, flags homeschool orders, triggers guide PDF), `resend-webhook` (svix; email events), `learnworlds-webhook` (HMAC; `course_sales`), `founders-lock` (signed-token Sprouts founder's-price capture).
3. **Internal cron workers** (`verify_jwt=true` + `_shared/require-service-role.ts`): `nurture-emails` (drains `nurture_email_queue`, Lock #48), `notify-founder-digest`, `weekly-trends-digest`, `replay-quiz-completion-failures` (dead-letter queue).
4. No config entry = default `verify_jwt=true`: `create-checkout`, `customer-portal`, `verify-session` (post-checkout verification; flips `purchased_guide` and returns server-only guide content).

- `constitution-pdf` is special: it renders the **paid** Deep-Dive Guide PDF, keeps `verify_jwt=true`, and additionally requires `role=service_role` — invoked only server-side by `stripe-webhook` on purchase. Paid guide content lives server-only in `_shared/guide/` (per-Pattern `guide-content-<slug>.ts` + `registry.ts`; paywall bypass closed in PR #235) — never ship it to the client bundle.
- `api/cron/*.ts` = Vercel cron entry points (schedules in `vercel.json`: drain-nurture-queue */15 min, replay-quiz-failures */30 min, notify-founder-digest daily 14:00 UTC, weekly-trends-digest Fri 14:00 UTC). Auth chain: Vercel injects `Authorization: Bearer ${CRON_SECRET}` → proxy verifies → calls the EF with the service-role key.
- Shared EF code: `supabase/functions/_shared/` — nurture + homeschool email template builders, HMAC unsubscribe tokens, shop-CTA email card, service-role guard, guide content.
- Migrations: `supabase/migrations/*.sql`, timestamp-named (`YYYYMMDDHHMMSS_slug.sql`). Apply via `mcp__supabase__apply_migration` AND commit the matching file (see deploy rules).

## How Camila wants me to work

- **One command per code block, always.** Her paste is atomic; never chain with `;`/`&&`.
- **Durable best-practice solution from the start** — no patches/workarounds/cache-busts. Structural soundness wins tradeoffs.
- **Auto-continue** end to end; only the explicit word "wrap"/"wrap up" ends a session. Manual milestones don't stop it.
- **Ping only at authority surfaces:** architectural scope, brand/worldview/copy positioning, money ops, strategic direction. Drive everything else.
- **User-experience language** for status (Lock #51): lead with what the visitor/customer now experiences, not the mechanism.
- **Response style:** clean, structural, intellectually serious. No pop-wellness language. No emoji unless she uses them first. No "Let me…" preamble. Don't recap a diff after showing it.
- **Don't re-verify done work; don't re-derive what the Manual/Session Log already states.** Check existing state before driving any key/secret/config walkthrough.
- **Verify don't trust:** I made avoidable errors this stack by asserting before reading the code (e.g., calling a canonical slug a "bug"). Read the resolver/EF/data first.

## Brand / clinical locks (high-frequency)

- **"body pattern"** is canonical — never "body type" (Lock #54).
- Clinical claims: **dual-source** (primary PD + modern secondary) (Lock #43). Formularies/recipes are **Practitioner-tier only**.
- Lock register lives in Manual §0.8. As of v4.10 the docx index was caught up through #83 (**#83 awaits founder ratification**) — check the newest Manual for the current version.

## Deploy & tooling rules (learned the hard way)

- **Public Edge Functions must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. `supabase/config.toml` locks the correct `verify_jwt` per function so the CLI honors it on every deploy (Lock #72).
- **`gh` CLI is not installed** — use `mcp__github__*` (create_pull_request, merge_pull_request, etc.). Pushes via local `git` over SSH work.
- **`git commit -m "…"` must not contain backticks or `$()`** — bash runs them as command substitution and mangles the message. (Squash-merge titles via MCP are clean regardless.)
- **Migrations:** apply via `mcp__supabase__apply_migration` (auto-tracked), AND commit the matching `.sql` file (use the recorded version as the filename) so `supabase db push` stays a no-op. Idempotent guards (`IF NOT EXISTS`, `CREATE OR REPLACE`) make re-runs safe.
- **Editing the Manual docx:** `unpack.py` is NOT standalone here — it ships inside the **`docx` skill** (`scripts/office/unpack.py --merge-runs false` → edit XML with the Edit tool → `pack.py --original`). Set `PYTHONUTF8=1` when running pack (Windows console cp1252 chokes on `→`). Rev version, add §9 entry, archive prior to `_archive/manuals/`.
- **Python:** the bash `python` is the Windows Store stub. Real Python is via scoop (`/c/Users/gramm/scoop/apps/python/current/python.exe`); `pip install defusedxml lxml` for the docx scripts.

## Environment realities (this machine)

- **Agent file tools and Camila's interactive PowerShell see different filesystems.** They share only the OneDrive tree (`…/Biblical Herbalism/**`). `AppData` is agent-side-visible but NOT visible to her terminal. **Route any file handoff through OneDrive.**
- **Supabase MCP token** lives agent-side in `claude_desktop_config.json` (`%APPDATA%\Claude`), passed as `--access-token`. Rotation helper: `…/Products/App/stage-token.ps1` (masked input → OneDrive temp file → agent writes config → Camila fully quits + reopens Claude from the tray). Token + GitHub PAT rotate ~90 days.
- **Chrome / browser:** Camila drives browser steps via screenshots; be explicit when I can't drive something. Stripe dashboard is blocked to automation — she pastes/screenshots.
- `_memory/` (`…/Eden Apothecary/_memory/`) holds the prior Cowork memory system (~50 `feedback_*.md` + `MEMORY.md`) — load-bearing context distilled here, but read it if deeper detail is needed.

## Current open items (as of 2026-07-02, rebuilt from repo state PRs #182–#238 — update at each wrap)

The newest Session Log remains authoritative; reconcile this snapshot against it at the next session.

- **SEO/Astro migration of the marketing surface is COMPLETE** — homepage included (#193–#196; the earlier "leave the homepage" decision was superseded), plus `/homeschool/herbs` (#222). Personalization preserved via the `HomeJourneyPersonalizer` island (#197). `llms.txt` + AI answer-engine crawlers allowed (#192). Still SPA-only by design: quiz/results/guide funnel, apothecary app, `/founder`, legal.
- **Waitlists RETIRED:** Tier 2 → coming-soon + start-with-Tier-1 panel (#185); Practitioner → explainer, current-users-beta-first, no signups (#187); `/apothecary` presents Eden Apothecary as **live**, not a beta waitlist (#186). The signup EFs still exist but the funnels are closed.
- **Deep-Dive Guide is a live $4.99 product:** email CTAs go straight to Stripe via `/go/deep-dive/:slug` → `guide-checkout` (#217); on purchase `stripe-webhook` invokes `constitution-pdf` to render + deliver the rich 8-Pattern PDF (#218/#219); paid content moved server-side to close a paywall bypass (#235).
- **Homeschool (Eden's Table) line:** herb sourcing page `/homeschool/herbs` with 36 Seedlings herbs (#222/#228); kit preorders recorded with a 500-unit counter (#216); `founders-lock` EF captures Sprouts founder's-pricing + sent the Email #1 blast (#225); nurture Weeks 4–7 shipped (#209); Week 1/2 lead magnets swapped to new Canva PDFs, read-aloud story ships Week 2 (#184/#224).
- **Founder dashboard** (`/founder`, login `hello@`): CRM tab (#198), Lead-magnet drill-downs (#204), real revenue view incl. LearnWorlds course sales via `founder_revenue` (#206), punch-list table in the daily digest — investor inquiries auto-add follow-ups (#213/#214).
- **Email infra:** open/click + CTA tracking pipeline (#205); behavioral suppression — never re-pitch purchased offers (#208); per-list RFC 8058 one-click unsubscribe (#190); quiz 3-arc nurture + waitlist de-dup (#189); "Shop Medicinal Herbs" CTA in global nav + every customer-facing email (#229–#232).
- **Partners/investors:** Get Involved homepage section + `submit-partner-inquiry` EF + co-op licensing on `/homeschool` (#211–#214).
- **Hardening/cleanup pass done (#233–#238):** payment + internal-cron EFs hardened, lead-digest PII function locked, dead code pruned across the apothecary app.
- **Carried from v4.12, NOT verifiable from the repo — confirm against the Session Log:** Lock #83 ratification; Canva scroll-ad → Meta Ads campaign optimizing on `Lead`; GA4/GSC stays manual (org policy blocks the SA key); Meta CAPI server-dedup confirmation; `resend-waitlist` `metadata` persistence to `waitlist_signups`; docx Manual §9 catch-up for the ~55 PRs since v4.12.
- **Open-PR list:** check `mcp__github__list_pull_requests` at session start.
