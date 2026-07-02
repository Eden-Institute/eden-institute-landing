# CLAUDE.md — Eden Institute / Eden Apothecary

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Working memory for Claude Code. Auto-loaded every session. Keep it high-signal.

---

## ▶ START EVERY SESSION HERE

Run this before doing task work:

1. **Read the newest `Session_Log_*.md`** in `…/Products/App/Eden Apothecary/` (they're dated + versioned; newest = where we left off). It is the authoritative continuity record.
2. **Skim the Manual** `…/Products/App/Eden Apothecary/Eden_Apothecary_Manual_v*.docx` (latest version) — §0 (Locks, founding decisions) and §9 (Session Log). Use the `docx` skill to read/edit it.
3. **Verify the Supabase MCP token:** call `mcp__supabase__list_tables`. If `Unauthorized`, the token lapsed — see "Supabase MCP token" below.
4. **Verify repo state:** `git -C <repo> log --oneline -5` and `mcp__github__list_pull_requests` (open PRs).
5. **Then ask Camila what to work on** — surface anything in "Current open items" first.

I do **not** have memory between sessions. Continuity = these artifacts. **Update the Session Log (and the Manual) at the end of every session — non-negotiable.**

**Remote/web sessions:** the OneDrive tree (Session Logs, Manual) and the Supabase MCP are only reachable from Camila's desktop. In a cloud container, skip steps 1–3 and rely on this file + `git log` + merged-PR history; flag anything that needs the Session Log for her desktop session.

---

## Who & what

- **Founder:** Camila Johnson (`hello@edeninstitute.health`). Architect-founder, not a developer; runs Windows PowerShell. She decides; I build.
- **Eden Apothecary is an APP** (not a course/service/product line) — every consumer surface must frame it that way.
- **Repo:** `Eden-Institute/eden-institute-landing` · default branch `main` · local clone at `C:\Users\gramm\OneDrive\Documents\Biblical Herbalism\Products\App\eden-institute-landing-repo` (her PowerShell auto-cds here).
- **Supabase:** project ref `noeqztssupewjidpvhar`; custom tables in `public`.
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons in `vercel.json`.
- **Stack:** Astro (static marketing) + Vite/React SPA (TS), Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, Vercel.

## Commands

- `npm run dev` — SPA dev server (Vite). `npm run dev:astro` — Astro marketing pages.
- `npm run build` — full production build: `astro build` → `dist/`, then `vite build --outDir dist/_spa --base /_spa/`.
- `npm run lint` — ESLint.
- `npm test` — Vitest run (jsdom + Testing Library; files `src/**/*.{test,spec}.{ts,tsx}`). Watch: `npm run test:watch`. Single file: `npx vitest run src/test/edenPattern.test.ts`.

## Architecture — dual build (Astro + SPA)

- **Astro owns public marketing routes** and pre-renders them to static HTML for SEO. It lives in `./web` (`srcDir` in `astro.config.mjs`) so its `web/pages/` router never collides with the SPA's `src/pages/*.tsx`. Shared React components/CSS via the same `@/` → `./src` alias.
- **The SPA builds into `dist/_spa`** (base `/_spa/`). The `vercel.json` rewrite sends any path that isn't a real static file to `/_spa/index.html`; Vercel serves filesystem matches first, so Astro's pre-rendered pages win at their own paths.
- **Astro pages (pre-rendered):** `/` (homepage — migrated in PR #196 with the `HomeJourneyPersonalizer` `client:only` island preserving returning-visitor personalization), `/community`, `/homeschool`, `/homeschool/herbs`, `/constitutional-herbalism`, `/why-eden`, `/courses`.
- **SPA-only routes:** `/assessment` (quiz), `/results/:slug`, `/guide/:slug`, `/guide/success`, legal ×3, `/tier-2-waitlist`, `/homeschool/welcome` (Stripe success), `/founder`, and all of `/apothecary/*`.
- **Islands that import the Supabase client must be `client:only`** (localStorage at module load crashes SSR).
- **`src/lib/routes.ts` is the single source of truth for SPA route paths.** Add a route there AND in `App.tsx`; never hand-write route string literals (a `/quiz` typo once lost real quiz submissions — see the module docblock).
- **Apothecary app** (`src/pages/apothecary/`, `src/components/apothecary/`): `ApothecaryLayout` + `RequireAuth`/`RequireTier` gates; tiers free → seed → root → practitioner. Public since CRO Phase 1: the anon index (quiz-led `ApothecaryWelcome`), `/apothecary/pricing`, `/apothecary/start`, auth pages, and `/apothecary/:herbId` monographs (slug or H-code). Monograph **depth** is tier-gated server-side by `herbs_directory_v` — never client-side.
- **Global providers** (`App.tsx`): `AuthProvider` → `ActiveProfileProvider` (global scope, localStorage `eden.active_profile_id` — hoisting it out of the apothecary layout was a deliberate fix; keep it global). Trackers mounted as `<Routes>` siblings: `PageViewTracker` (`record_page_view` RPC, cookieless), `CtaClickTracker` (delegated `[data-cta]` listener → `record_cta_click` RPC, CRO Phase 4), `MetaPixelTracker` (consent-gated).

## Backend

- **Edge Functions** in `supabase/functions/`; `verify_jwt` per function is locked in `supabase/config.toml` (Lock #72) in three categories: (1) public-frontend fns `verify_jwt=false` (own input validation), (2) webhooks `false` (Stripe HMAC / Resend svix / LearnWorlds HMAC), (3) internal cron workers `true` + `_shared/require-service-role.ts`. `constitution-pdf` must stay `verify_jwt=true` (service-role-only paid PDF).
- **Vercel crons** (`api/cron/*.ts` → invoke the matching EF with the service-role key; inbound auth = `CRON_SECRET` header): `drain-nurture-queue` */15min, `replay-quiz-failures` */30min, `notify-founder-digest` daily 14:00 UTC, `weekly-trends-digest` Fri 14:00 UTC.
- **Paid Deep-Dive Guide ($4.99):** content lives server-side in `supabase/functions/_shared/guide/` (paywall bypass closed, PR #235 — don't reintroduce guide body content into the client bundle). `guide-checkout` 302s to Stripe (`/go/deep-dive/:slug` redirect in `vercel.json`); `stripe-webhook` fulfills and fetches `constitution-pdf` server-side.
- **Migrations:** `supabase/migrations/*.sql`. Apply via `mcp__supabase__apply_migration` (auto-tracked) AND commit the matching `.sql` (recorded version as filename) so `supabase db push` stays a no-op. Idempotent guards make re-runs safe.
- **Dashboard counts/aggregates must be server-side** (RPC, e.g. `founder_lead_summary`), never `data.length` — PostgREST caps RPC rows at 1000.

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
- Lock register lives in Manual §0.8. As of v4.10 the docx index is caught up through #83 (**#83 awaits founder ratification**).
- **Design language:** vintage apothecary / Materia Medica — parchment, forest green, gold-leaf, serif display. Use the `--eden-*` CSS tokens and the Button `eden`/`eden-outline`/`eden-gold`/`eden-light` variants; full token set + idiom in `.design-sync/conventions.md`. Never bright-SaaS, never pop-wellness.

## Deploy & tooling rules (learned the hard way)

- **Public Edge Functions must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. (`config.toml` now locks the setting file-side per Lock #72, but the CLI-from-main rule stands.)
- **`gh` CLI is not installed** — use `mcp__github__*` (create_pull_request, merge_pull_request, etc.). Pushes via local `git` over SSH work.
- **`git commit -m "…"` must not contain backticks or `$()`** — bash runs them as command substitution and mangles the message. (Squash-merge titles via MCP are clean regardless.)
- **Editing the Manual docx:** `unpack.py` is NOT standalone here — it ships inside the **`docx` skill** (`scripts/office/unpack.py --merge-runs false` → edit XML with the Edit tool → `pack.py --original`). Set `PYTHONUTF8=1` when running pack (Windows console cp1252 chokes on `→`). Rev version, add §9 entry, archive prior to `_archive/manuals/`.
- **Python:** the bash `python` is the Windows Store stub. Real Python is via scoop (`/c/Users/gramm/scoop/apps/python/current/python.exe`); `pip install defusedxml lxml` for the docx scripts.

## Environment realities (Camila's machine)

- **Agent file tools and Camila's interactive PowerShell see different filesystems.** They share only the OneDrive tree (`…/Biblical Herbalism/**`). `AppData` is agent-side-visible but NOT visible to her terminal. **Route any file handoff through OneDrive.**
- **Supabase MCP token** lives agent-side in `claude_desktop_config.json` (`%APPDATA%\Claude`), passed as `--access-token`. Rotation helper: `…/Products/App/stage-token.ps1` (masked input → OneDrive temp file → agent writes config → Camila fully quits + reopens Claude from the tray). Token + GitHub PAT rotate ~90 days.
- **Chrome / browser:** Camila drives browser steps via screenshots; be explicit when I can't drive something. Stripe dashboard is blocked to automation — she pastes/screenshots.
- `_memory/` (`…/Eden Apothecary/_memory/`) holds the prior Cowork memory system (~50 `feedback_*.md` + `MEMORY.md`) — load-bearing context distilled here, but read it if deeper detail is needed.

## Current open items (as of 2026-07-02, refreshed from repo state through PR #249 — update at each wrap)

- **SEO Astro migration largely COMPLETE.** Since v4.12: `/constitutional-herbalism` (#193), `/why-eden` (#194), `/courses` (#195), and the **homepage** (#196 — the earlier "leave the homepage" decision was superseded; it ships the no-Pattern static render + `HomeJourneyPersonalizer` island). Also `llms.txt` + AI answer-engine crawlers allowed (#192). Still SPA-only: legal ×3, `/results/:slug` ×8, `/guide/:slug` landers.
- **Apothecary CRO Phases 0–4 SHIPPED** (#245–#249): quiz-first anon front door at `/apothecary`, **public herb monographs** at `/apothecary/:herbId`, directory-depth advertising, retention loop (favorites open to free tier), funnel metrics (`record_cta_click` + `cta_events`, Cold/flu + PMS complaint-link seeds). Watch funnel numbers on the dashboard.
- **Deep-Dive Guide is $4.99 end-to-end** (#199/#201/#217): price wired through create-checkout, Results/Index/emails; email CTAs go straight to Stripe via `guide-checkout`. **Rich 8-pattern PDF delivered on purchase** (`constitution-pdf`, #218/#219); paid content moved server-side (#235).
- **Homeschool (Eden's Table, launching Aug 1 2026):** sourcing page `/homeschool/herbs` with 36 Seedlings herbs (#222/#228); free sample is the dominant hero CTA (#199/#203); `founders-lock` EF captures founder's-price signups + sent Email #1 blast (#225); Stripe records homeschool kit orders + 500-unit preorder counter (#216); nurture Weeks 4–7 live (#209); new Canva PDF lead magnets (#224).
- **Partner/investor pipeline:** "Get Involved" capture-then-book on the homepage (#212/#215) → `submit-partner-inquiry` EF → `partner_inquiries` + founder punch-list follow-up (#213/#214); co-op licensing section on `/homeschool` (#211).
- **Email infra:** open/click engagement tracking (#205), per-list RFC 8058 one-click unsubscribe (#190), behavioral suppression — no re-pitching purchased offers (#208), fuzzy email-typo blocking on waitlist submit (#210), "Shop Medicinal Herbs" CTA in every customer email + global nav (#229–#232).
- **Founder dashboard:** CRM tab (#198), real revenue view — LearnWorlds course sales + unified `founder_revenue` (#206), clickable lead-magnet drill-downs (#204), daily digest now appends punch-list items; lead-digest PII function locked down (#233).
- **Security hardening pass done** (#233–#236): payment + internal-cron EFs hardened, paywall bypass closed, dead weight removed.
- **Carried from v4.12 — verify against the newest Session Log before acting:** ratify Lock #83; Canva scroll-ad → Meta Ads campaign; GA4/GSC automation still blocked by org policy (manual reads); Meta CAPI dedup %; Day-7 nurture redesign under a NEW table name (`nurture_email_queue` is taken by the v3.33 constitution drip); `resend-waitlist` `metadata` persistence for Pattern-segmented nurture; fold recent PRs into docx Manual §9 + promote proposed Locks.
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.
