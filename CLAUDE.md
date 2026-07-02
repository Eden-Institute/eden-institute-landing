# CLAUDE.md — Eden Institute / Eden Apothecary

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It doubles as working memory — auto-loaded every session. Keep it high-signal.

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
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons in `vercel.json`.
- **Stack:** Astro (static marketing pages) + Vite React SPA (TS), Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, LearnWorlds (courses), Vercel.

## Repo architecture

One Vercel deploy serves two frontends plus serverless cron endpoints:

### Astro marketing site (`web/`, config in `astro.config.mjs`)
- Owns the public **marketing** routes, pre-rendered to static HTML for SEO: `/` (homepage), `/why-eden`, `/courses`, `/constitutional-herbalism`, `/community`, `/homeschool`, `/homeschool/herbs`. Pages in `web/pages/`, shared layout `web/layouts/MarketingLayout.astro`.
- `srcDir` is `./web` so Astro's file router never collides with the SPA's `src/pages/*.tsx`. It reuses SPA React components and CSS via the same `@/` → `./src` alias, and exposes `VITE_`-prefixed env so shared modules (Supabase client, analytics) work identically.
- Interactive pieces are React islands in `web/components/islands/` (waitlist forms, analytics beacons, homepage personalization, partner-inquiry form). **Any island that imports the Supabase client must be `client:only="react"`** — the client touches localStorage at module load and crashes SSR.
- A route is "migrated to Astro" simply by existing in `web/pages/` — Astro's static output in `dist/` wins over the SPA rewrite (filesystem beats rewrites on Vercel).

### React SPA (`src/`)
- Owns everything interactive/auth-walled: `/assessment` (the Pattern of Eden quiz), `/results/:slug`, `/guide/:slug` + `/guide/success`, legal ×3 (`/terms` `/privacy` `/cookies`), `/tier-2-waitlist`, `/homeschool/welcome` (Stripe success redirect), `/founder` (dashboard), and the `/apothecary/**` app (auth, pricing, home, profiles, favorites, in-app quiz).
- Built to `dist/_spa` with base `/_spa/`; the `vercel.json` rewrite routes every non-asset, non-Astro path to `/_spa/index.html`.
- **`src/lib/routes.ts` is the single source of truth for SPA paths** (`ROUTES` const). Add a route there AND as a `<Route>` in `src/App.tsx`; never scatter string-literal paths (a `/quiz` vs `/assessment` typo once lost real quiz submissions — PR #75).
- Structure: `src/contexts/` (AuthContext, ActiveProfileContext — both global in App.tsx; ActiveProfileProvider must stay hoisted above the router so profile selection survives navigation), `src/components/` (`apothecary/`, `founder/`, `guide/`, `journey/`, `landing/`, `quiz/`, `ui/` = shadcn, `utils/` = route-level trackers), `src/lib/` (domain logic: `edenPattern.ts`, `constitution-data.ts`, `consent.ts`, `metaPixel.ts`, `apothecaryTiers.ts`…), `src/integrations/supabase/` (client + generated types).

### Supabase Edge Functions (`supabase/functions/`)
- Deno EFs; shared modules in `_shared/` (nurture + homeschool email templates, `require-service-role.ts`, `email-unsubscribe.ts`, `shop-cta.ts`).
- **`_shared/guide/` holds the PAID Deep-Dive Guide content** (one file per pattern + `registry.ts`). It is server-side ONLY — a verified paid Stripe session (`verify-session` EF) is the sole way to obtain it. Never import it into client code (PR #235 closed a paywall bypass).
- Three categories, locked in `supabase/config.toml` (Lock #72 — the file layer wins on every CLI deploy):
  1. **Public-frontend** (`verify_jwt=false`, do their own validation): resend-waitlist, record-quiz-completion, record-diagnostic-completion, submit-feedback, submit-partner-inquiry, practitioner-waitlist-signup, tier-2-waitlist-signup, unsubscribe, guide-checkout, founders-lock.
  2. **Webhooks** (`verify_jwt=false`, signature-authenticated): stripe-webhook (HMAC), resend-webhook (svix), learnworlds-webhook (HMAC).
  3. **Internal cron workers** (`verify_jwt=true` + `_shared/require-service-role.ts`): nurture-emails, notify-founder-digest, weekly-trends-digest, replay-quiz-completion-failures. Also service-role-gated: constitution-pdf (renders the paid guide PDF, fetched by stripe-webhook).
- `supabase/migrations/*.sql` mirrors everything applied via MCP (see Migrations rule below).

### Vercel crons (`api/cron/`)
Edge-runtime functions triggered by `vercel.json` crons. Pattern: verify `Authorization: Bearer ${CRON_SECRET}` → invoke the matching EF with the service-role key → return the EF response for logs. Four crons: `drain-nurture-queue` (*/15 min), `replay-quiz-failures` (*/30 min), `notify-founder-digest` (daily 14:00 UTC), `weekly-trends-digest` (Fri 14:00 UTC).

### Redirects worth knowing (`vercel.json`)
`/app/*` → `/apothecary/*`; `/go/deep-dive/:slug` → the `guide-checkout` EF (straight-to-Stripe from nurture emails); `/Homeschool` → `/homeschool`.

### Domain vocabulary
- **8 body patterns** (canonical slugs): `pressure-cooker`, `burning-bowstring`, `drawn-bowstring`, `frozen-knot`, `open-flame`, `overflowing-cup`, `spent-candle`, `still-water`.
- **Tiers:** free → `seed` → `root` → `practitioner` (see `src/lib/apothecaryTiers.ts`; gating via `RequireAuth` + `RequireTier`).

## Commands

```
npm run dev          # SPA dev server (Vite, port 8080)
npm run dev:astro    # Astro dev server (marketing pages)
npm run build        # full prod build: astro build → dist/, then SPA → dist/_spa
npm run lint         # eslint
npm run test         # vitest run (jsdom + testing-library; tests in src/**/*.test.ts[x])
npm run test:watch   # vitest watch mode
npx vitest run src/test/edenPattern.test.ts   # single test file
```

## How Camila wants me to work

- **One command per code block, always.** Her paste is atomic; never chain with `;`/`&&`.
- **Durable best-practice solution from the start** — no patches/workarounds/cache-busts. Structural soundness wins tradeoffs.
- **Auto-continue** end to end; only the explicit word "wrap"/"wrap up" ends a session. Manual milestones don't stop it.
- **Ping only at authority surfaces:** architectural scope, brand/worldview/copy positioning, money ops, strategic direction. Drive everything else.
- **User-experience language** for status (Lock #51): lead with what the visitor/customer now experiences, not the mechanism.
- **Response style:** clean, structural, intellectually serious. No pop-wellness language. No emoji unless she uses them first. No "Let me…" preamble. Don't recap a diff after showing it.
- **Don't re-verify done work; don't re-derive what the Manual/Session Log already states.** Check existing state before driving any key/secret/config walkthrough.
- **Verify don't trust:** I made avoidable errors this stack by asserting before reading the code (e.g., calling a canonical slug a "bug"). Read the resolver/EF/data first.
- **PRs use the template** (`.github/pull_request_template.md`): §8.5 Four-Screen Test (Terrain / Worldview / Tier / Safety) is mandatory — even infra PRs answer all four (typically three justified N/A + one substantive).

## Brand / clinical locks (high-frequency)

- **"body pattern"** is canonical — never "body type" (Lock #54).
- Clinical claims: **dual-source** (primary PD + modern secondary) (Lock #43). Formularies/recipes are **Practitioner-tier only**.
- Lock register lives in Manual §0.8 — always check the newest Manual version for the current index (v4.10 was caught up through #83; later sessions have added more).

## Deploy & tooling rules (learned the hard way)

- **Public Edge Functions must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. `supabase/config.toml` now locks `verify_jwt` per function at the file layer (Lock #72), so CLI deploys honor it without per-call flags — keep config.toml in sync when adding an EF.
- **`gh` CLI is not installed** — use `mcp__github__*` (create_pull_request, merge_pull_request, etc.). Pushes via local `git` over SSH work.
- **`git commit -m "…"` must not contain backticks or `$()`** — bash runs them as command substitution and mangles the message. (Squash-merge titles via MCP are clean regardless.)
- **Migrations:** apply via `mcp__supabase__apply_migration` (auto-tracked), AND commit the matching `.sql` file (use the recorded version as the filename) so `supabase db push` stays a no-op. Idempotent guards (`IF NOT EXISTS`, `CREATE OR REPLACE`) make re-runs safe.
- **Dashboard counts/aggregates must always be server-side** (RPCs like `founder_lead_summary`), never `data.length` — PostgREST caps RPC rows at 1000.
- **Editing the Manual docx:** `unpack.py` is NOT standalone here — it ships inside the **`docx` skill** (`scripts/office/unpack.py --merge-runs false` → edit XML with the Edit tool → `pack.py --original`). Set `PYTHONUTF8=1` when running pack (Windows console cp1252 chokes on `→`). Rev version, add §9 entry, archive prior to `_archive/manuals/`.
- **Python:** the bash `python` is the Windows Store stub. Real Python is via scoop (`/c/Users/gramm/scoop/apps/python/current/python.exe`); `pip install defusedxml lxml` for the docx scripts.

## Environment realities (Camila's machine)

- **Agent file tools and Camila's interactive PowerShell see different filesystems.** They share only the OneDrive tree (`…/Biblical Herbalism/**`). `AppData` is agent-side-visible but NOT visible to her terminal. **Route any file handoff through OneDrive.**
- **Supabase MCP token** lives agent-side in `claude_desktop_config.json` (`%APPDATA%\Claude`), passed as `--access-token`. Rotation helper: `…/Products/App/stage-token.ps1` (masked input → OneDrive temp file → agent writes config → Camila fully quits + reopens Claude from the tray). Token + GitHub PAT rotate ~90 days.
- **Chrome / browser:** Camila drives browser steps via screenshots; be explicit when I can't drive something. Stripe dashboard is blocked to automation — she pastes/screenshots.
- `_memory/` (`…/Eden Apothecary/_memory/`) holds the prior Cowork memory system (~50 `feedback_*.md` + `MEMORY.md`) — load-bearing context distilled here, but read it if deeper detail is needed.

## Current open items (refreshed 2026-07-02 from repo state through PR #238 — cross-check the newest Session Log, which remains authoritative)

**Shipped since the last refresh (v4.12 / 2026-06-05) — do not re-open:**

- **Astro migration is effectively complete for marketing**, including the homepage (PR #196) with a returning-visitor personalization island (`HomeJourneyPersonalizer`, PR #197). Astro now serves `/`, `/why-eden`, `/courses`, `/constitutional-herbalism`, `/community`, `/homeschool`, `/homeschool/herbs`. Legal ×3, `/results/:slug`, and apothecary marketing remain SPA — migrate only if SEO demands it.
- **Deep-Dive Guide is $4.99** (PRs #199–#207), content moved **server-side** (`_shared/guide/`, PR #235), rich 8-pattern **PDF delivered on purchase** via `constitution-pdf` (PRs #218/#219), and email CTAs go **straight to Stripe checkout** via `/go/deep-dive/:slug` → `guide-checkout` EF (PR #217).
- **Both waitlists retired:** Tier 2 → coming-soon + Start-with-Tier-1 (PR #185); Practitioner → explainer, no signups (PR #187). The app is presented as **live**, not a beta waitlist (PR #186).
- **`resend-waitlist` now persists `metadata`** on `waitlist_signups` — the old "waitlistUpsert ignores it" follow-up is resolved.
- **New surfaces/systems:** partner/investor inquiries + co-op licensing + founder punch-list feeding the daily digest (PRs #211–#214); homeschool kit orders + 500-unit preorder counter (PR #216); `founders-lock` EF for Sprouts founder's-price capture (PR #225); Eden's Table herb sourcing at `/homeschool/herbs` + Shop-Herbs CTAs in nav and every customer email (PRs #222, #228–#232); email open/click + CTA tracking (PR #205) with behavioral suppression in nurture (PR #208); founder dashboard CRM tab (PR #198) + unified revenue view incl. LearnWorlds sales (PR #206); per-list one-click unsubscribe, RFC 8058 (PR #190); quiz 3-arc + waitlist email de-dup (PR #189); `llms.txt` + AI-crawler allowances (PR #192); homeschool nurture Weeks 4–7 (PR #209); payment/cron EF hardening + dead-code audit (PRs #233–#235).

**Still open / unverified from the repo (confirm against Session Log + founder):**

- **Meta CAPI** active, consent-gated; Canva scroll-ad → Meta Ads campaign was in the founder's court.
- **GA4 + GSC automation** blocked by org policy `iam.disableServiceAccountKeyCreation`; founder chose manual reads.
- **Lock ratifications** and Manual §9 folding for everything shipped since v4.12 (the docx Manual is likely several versions behind PR #238).
- **Phase 3.1.2 Day-7 nurture redesign** under a NEW table name (`nurture_email_queue` is taken by the v3.33 constitution drip).
- **Balanced quiz leads → dashboard** (EF + `entry_funnel` enum) — no repo evidence it shipped.
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.
