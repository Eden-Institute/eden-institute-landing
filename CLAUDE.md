# CLAUDE.md — Eden Institute / Eden Apothecary

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is working memory, auto-loaded every session. Keep it high-signal.

---

## ▶ START EVERY SESSION HERE

Run this before doing task work:

1. **Read the newest `Session_Log_*.md`** in `…/Products/App/Eden Apothecary/` (they're dated + versioned; newest = where we left off). It is the authoritative continuity record.
2. **Skim the Manual** `…/Products/App/Eden Apothecary/Eden_Apothecary_Manual_v*.docx` (latest version) — §0 (Locks, founding decisions) and §9 (Session Log). Use the `docx` skill to read/edit it.
3. **Verify the Supabase MCP token:** call `mcp__supabase__list_tables`. If `Unauthorized`, the token lapsed — see "Supabase MCP token" below.
4. **Verify repo state:** `git -C <repo> log --oneline -5` and `mcp__github__list_pull_requests` (open PRs).
5. **Then ask Camila what to work on** — surface anything in "Current open items" first.

I do **not** have memory between sessions. Continuity = these artifacts. **Update the Session Log (and the Manual) at the end of every session — non-negotiable.**

*(Remote/web Claude Code sessions can't see the OneDrive tree — steps 1–2 don't apply there; rely on this file + git history + open PRs, and flag anything Session-Log-dependent for the next local session.)*

---

## Who & what

- **Founder:** Camila Johnson (`hello@edeninstitute.health`). Architect-founder, not a developer; runs Windows PowerShell. She decides; I build.
- **Eden Apothecary is an APP** (not a course/service/product line) — every consumer surface must frame it that way.
- **Repo:** `Eden-Institute/eden-institute-landing` · default branch `main` · local clone at `C:\Users\gramm\OneDrive\Documents\Biblical Herbalism\Products\App\eden-institute-landing-repo` (her PowerShell auto-cds here).
- **Supabase:** project ref `noeqztssupewjidpvhar`; custom tables in `public`.
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons in `vercel.json`.
- **Stack:** Astro (marketing, pre-rendered) + Vite React SPA (app), TS, Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, Twilio, Vercel.
- **README.md is Lovable boilerplate** — ignore it; this file is the real doc.

## Codebase map

### Commands

- `npm run dev` — SPA dev server (Vite). `npm run dev:astro` — Astro marketing dev server.
- `npm run build` — production build: `astro build` → `dist/`, then `vite build` → `dist/_spa` (base `/_spa/`). `build:astro` / `build:spa` run the halves alone.
- `npm run lint` — ESLint. `npm test` — Vitest once; `npm run test:watch` to watch. Single file: `npx vitest run src/test/edenPattern.test.ts`. Tests are jsdom + Testing Library, `src/**/*.{test,spec}.{ts,tsx}`, setup in `src/test/setup.ts`.

### Two frontends, one deploy

- **Astro owns the public marketing routes** and pre-renders them to static HTML for SEO (`astro.config.mjs`; `srcDir: ./web` so its `web/pages/` router never collides with the SPA's `src/pages/*.tsx`). Migrated so far: `/` (homepage), `/why-eden`, `/courses`, `/constitutional-herbalism`, `/community`, `/homeschool`, `/homeschool/herbs`. Shared shell: `web/layouts/MarketingLayout.astro`; interactivity comes from React islands in `web/components/islands/`. **Any island that imports the Supabase client must be `client:only="react"`** — the client touches localStorage at module load and crashes SSR. Astro reaches shared SPA code via the same `@/` → `src/` alias.
- **The SPA (Vite + React Router, `src/`)** builds to `dist/_spa`; the `vercel.json` rewrite routes every non-static, non-Astro path to `/_spa/index.html`. SPA-served routes: `/assessment` (quiz), `/results/:slug`, `/guide/:slug` + `/guide/success`, legal ×3, `/tier-2-waitlist`, `/founder`, and the whole auth-walled `/apothecary/*` app (layout + `RequireAuth`/`RequireTier` in `src/components/apothecary/`).
- **`src/lib/routes.ts` is the single source of truth for SPA route paths** (born of the /quiz-vs-/assessment 404 that lost real leads). Add/rename routes there AND in `App.tsx`; never scatter path string literals.
- Redirects/aliases live in `vercel.json` (`/app` → `/apothecary`, `/go/deep-dive/:slug` → guide-checkout EF, …).

### Backend (Supabase Edge Functions + Vercel crons)

- ~24 EFs in `supabase/functions/`. **`supabase/config.toml` locks each function's `verify_jwt` (Lock #72)** in three categories: public-frontend (`verify_jwt=false`, own input validation), webhooks (`verify_jwt=false`, provider signatures — Stripe HMAC, Resend svix, LearnWorlds HMAC), and internal cron workers (`verify_jwt=true` **plus** `_shared/require-service-role.ts`, which checks the JWT `role` claim so the public anon key can't trigger them).
- **Vercel crons never hit EFs directly.** `vercel.json` crons → `api/cron/*.ts` edge handlers, which verify `CRON_SECRET` then forward with the service-role key: `drain-nurture-queue` (15 min), `replay-quiz-failures` (30 min), `notify-founder-digest` (daily 14:00 UTC), `weekly-trends-digest` (Fri 14:00 UTC).
- **Paid Deep-Dive Guide ($4.99): content lives ONLY server-side** in `supabase/functions/_shared/guide/registry.ts` (8 Pattern guides). The `/guide` page fetches it through `verify-session` after a verified Stripe purchase; `constitution-pdf` renders the purchase PDF (service-role-only, `verify_jwt=true`). Never bundle guide content into client JS — that paywall bypass was deliberately closed (PR #235).
- **Migrations:** `supabase/migrations/*.sql`, idempotent guards throughout. Quiz-funnel writes flow `quiz_completions` → DB triggers → `waitlist_signups` (incl. `metadata`).

### Design system

- `.design-sync/` is the Claude Design import bundle; `.design-sync/conventions.md` documents the brand idiom: vintage apothecary / Materia Medica aesthetic, `--eden-*` CSS color tokens, `font-serif`/`font-body`/`font-accent`, Button `variant="eden|eden-outline|eden-gold|eden-light"`. Style with brand tokens, not arbitrary utilities.

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
- Lock register lives in Manual §0.8. **As of v4.10 the docx index is caught up through #83** (the v4.9 "#56 quiz-capture" mislabel was resolved by assigning it #83 — **#83 awaits founder ratification**). Canonical Manual is now `Eden_Apothecary_Manual_v4_10.docx`.

## Deploy & tooling rules (learned the hard way)

- **Public Edge Functions** (`verify_jwt=false` in `supabase/config.toml`) **must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. (Verified anon-200 holds after CLI deploy.)
- **`gh` CLI is not installed** — use `mcp__github__*` (create_pull_request, merge_pull_request, etc.). Pushes via local `git` over SSH work.
- **`git commit -m "…"` must not contain backticks or `$()`** — bash runs them as command substitution and mangles the message. (Squash-merge titles via MCP are clean regardless.)
- **Migrations:** apply via `mcp__supabase__apply_migration` (auto-tracked), AND commit the matching `.sql` file (use the recorded version as the filename) so `supabase db push` stays a no-op. Idempotent guards (`IF NOT EXISTS`, `CREATE OR REPLACE`) make re-runs safe.
- **Editing the Manual docx:** `unpack.py` is NOT standalone here — it ships inside the **`docx` skill** (`scripts/office/unpack.py --merge-runs false` → edit XML with the Edit tool → `pack.py --original`). Set `PYTHONUTF8=1` when running pack (Windows console cp1252 chokes on `→`). Rev version, add §9 entry, archive prior to `_archive/manuals/`.
- **Python:** the bash `python` is the Windows Store stub. Real Python is via scoop (`/c/Users/gramm/scoop/apps/python/current/python.exe`); `pip install defusedxml lxml` for the docx scripts.

## Environment realities (Camila's machine)

- **Agent file tools and Camila's interactive PowerShell see different filesystems.** They share only the OneDrive tree (`…/Biblical Herbalism/**`). `AppData` is agent-side-visible but NOT visible to her terminal. **Route any file handoff through OneDrive.**
- **Supabase MCP token** lives agent-side in `claude_desktop_config.json` (`%APPDATA%\Claude`), passed as `--access-token`. Rotation helper: `…/Products/App/stage-token.ps1` (masked input → OneDrive temp file → agent writes config → Camila fully quits + reopens Claude from the tray). Token + GitHub PAT rotate ~90 days.
- **Chrome / browser:** Camila drives browser steps via screenshots; be explicit when I can't drive something. Stripe dashboard is blocked to automation — she pastes/screenshots.
- `_memory/` (`…/Eden Apothecary/_memory/`) holds the prior Cowork memory system (~50 `feedback_*.md` + `MEMORY.md`) — load-bearing context distilled here, but read it if deeper detail is needed.

## Current open items (as of 2026-07-02 — update at each wrap)

*Refreshed from repo state (main @ #238 + open PRs) by a remote session; reconcile against the newest Session Log at the next local wrap.*

- **Open PRs (3):** **#227** preorder system Phase 1 (draft — orders state machine, `docs/preorder-system-phase-1.md`; **migration runs only on founder "go"**, paired with the patched stripe-webhook redeploy; founding pricing: kit $249→$349 first 500, notebook $19.99→$24.99); **#226** founders-lock Twilio API-key auth + testsms (function already live in prod, PR syncs `main`; **SMS delivery gated on Twilio A2P 10DLC approval**); **#221** Materia Medica herb plates (component + 16 assets built, **not placed on any page — placement is a founder brand decision**).
- **SEO Astro migration:** homepage IS now migrated (#196; the v4.12 "leave the homepage" decision was superseded), plus `/why-eden` (#194), `/constitutional-herbalism` (#193), `/courses` (#195), `/community`, `/homeschool`, `/homeschool/herbs` (#222/#228). Journey personalization preserved via `HomeJourneyPersonalizer` `client:only` island (#197). Still SPA-served: legal ×3, `/results/:slug`, `/guide/:slug`, `/assessment`. `llms.txt` + AI-crawler allowances live (#192).
- **Deep-Dive Guide is $4.99** (#199/#201), delivered as a rich 8-Pattern PDF on purchase (#218/#219); content moved fully server-side to close the paywall bypass (#235); nurture-email CTAs go straight to Stripe via `/go/deep-dive/:slug` → guide-checkout EF (#217).
- **Waitlists retired:** Tier 2 → coming-soon + start-with-Tier-1 (#185); Practitioner → explainer, current-users-beta-first, no signups (#187); `/apothecary` marketing presents the app as **live**, not a beta waitlist (#186).
- **Homeschool funnel:** free sample is the dominant hero CTA; nurture Weeks 4–7 shipped (#209) with behavioral suppression (don't re-pitch purchased offers, #208); founders-lock Sprouts founder's-price capture + Email #1 blast sent (#225); kit orders recorded with 500-unit counter (#216); herb sourcing page at `/homeschool/herbs`.
- **Partner/investor pipeline:** homepage "Get Involved" section (#212), `submit-partner-inquiry` EF + co-op licensing (#211), investor inquiries auto-add founder punch-list follow-ups (#214), punch list appended to the daily digest (#213).
- **Founder dashboard (`/founder`):** CRM tab (#198), real revenue view incl. LearnWorlds course sales (#206), email open/click + CTA tracking (#205), lead-magnet drill-downs (#204). **Counts/aggregates must always be server-side RPCs, never `data.length`** (PostgREST caps RPC rows at 1000).
- **June hardening pass:** lead-digest PII function locked + dead weight removed (#233), payment + internal-cron EFs hardened (#234), stale code pruned (#236–#238). Per-list RFC 8058 one-click unsubscribe live (#190). "Shop Medicinal Herbs" CTA now in global nav + every customer email (#229–#232). The v4.12 "resend-waitlist doesn't persist metadata" follow-up is resolved (DB trigger path).
- **Carried from v4.12 (verify in newest Session Log):** ratify **Lock #83**; GA4/GSC automation still blocked by org policy `iam.disableServiceAccountKeyCreation` (manual reads for now); Phase 3.1.2 Day-7 nurture redesign under a NEW table name (`nurture_email_queue` is taken); Meta CAPI active (consent-gated); fold recent PRs into docx Manual §9 + promote proposed Locks.
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.
