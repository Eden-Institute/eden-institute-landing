# CLAUDE.md — Eden Institute / Eden Apothecary

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is working memory — auto-loaded every session. Keep it high-signal.

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
- **Stack:** Astro (pre-rendered marketing) + Vite React SPA (app) hybrid, TS, Tailwind + shadcn/ui, Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, Twilio (SMS via `founders-lock`), LearnWorlds (course webhook), Vercel.
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.

## Commands

```
npm i                  # install (npm; package-lock.json is canonical)
npm run dev            # SPA dev server (Vite)
npm run dev:astro      # Astro dev server (marketing pages)
npm run build          # prod build: astro build → dist/, then SPA → dist/_spa (base /_spa/)
npm run lint           # eslint .
npm run test           # vitest run (jsdom, setup: src/test/setup.ts)
npm run test:watch     # vitest watch
npx vitest run src/test/edenPattern.test.ts   # single test file
```

Tests live in `src/**/*.{test,spec}.{ts,tsx}` (config: `vitest.config.ts`).

## Architecture (the big picture)

**Hybrid Astro + SPA on one Vercel project.** Understanding this split is prerequisite to touching any page:

- **Astro owns public marketing routes** and pre-renders them to static HTML for crawlers/SEO. It lives in `./web` (`srcDir` in `astro.config.mjs`) so its file-router never collides with the SPA's `src/pages/*.tsx`. Builds to `dist/`. Current Astro pages: `/` (homepage — migrated PR #196; the v4.12 "homepage deliberately NOT migrated" rule is obsolete), `/community`, `/constitutional-herbalism`, `/courses`, `/homeschool`, `/homeschool/herbs`, `/why-eden`. Layout: `web/layouts/MarketingLayout.astro`; shared Astro components in `web/components/`.
- **The SPA** (Vite + React Router, `src/`) builds to `dist/_spa` with base `/_spa/`. The `vercel.json` rewrite sends any path that doesn't match a static file to `/_spa/index.html` — so Astro's pre-rendered HTML wins by filesystem match, and the SPA serves everything else: `/assessment`, `/results/:slug`, `/guide/:slug`, legal ×3, `/apothecary/*` (the auth-walled app), `/founder` (dashboard).
- **Shared code:** both builds resolve `@/` → `./src`, so islands and the SPA use the same components, Supabase client, and `src/index.css`. React islands for Astro pages live in `web/components/islands/` (`WaitlistController`, `HomeJourneyPersonalizer`, `PartnerInquiryForm`, `SiteAnalytics`). **Islands that import the Supabase client must be `client:only`** (localStorage at module load crashes SSR).
- The SPA still registers routes for the migrated marketing pages — direct loads get Astro HTML; client-side navigation inside the SPA renders the SPA versions. Keep copy in sync across both when editing a migrated surface.
- **`src/lib/routes.ts` is the single source of truth for SPA route paths** — add/rename routes there AND in `App.tsx`; never hardcode path literals (a `/quiz` string-literal typo once lost real quiz submissions).

**Backend = Supabase Edge Functions + Vercel crons.**

- EFs in `supabase/functions/`, shared helpers/templates in `supabase/functions/_shared/` (nurture + homeschool email templates, RFC 8058 unsubscribe tokens, `require-service-role.ts`, guide PDF content).
- `supabase/config.toml` locks `verify_jwt` per function in three categories: **public-frontend** (anon browser calls, `verify_jwt=false`, own validation), **webhooks** (Stripe HMAC / Resend svix / LearnWorlds HMAC signature auth, `verify_jwt=false`), **internal cron workers** (`verify_jwt=true` + `require-service-role.ts`). `constitution-pdf` is special: `verify_jwt=true` AND service-role-only — it renders PAID guide content server-side (paywall-bypass fix, PR #235). Don't loosen these.
- **Stripe:** one checkout creator (`create-checkout`) and **ONE webhook endpoint (`stripe-webhook`)** — never add a second endpoint/signing secret (double-processing risk; see PR #227 design rationale). `guide-checkout` is an anon 302 → Stripe (email CTAs via the `/go/deep-dive/:slug` redirect in `vercel.json`); `verify-session` + `customer-portal` support the app.
- **Vercel crons** (`vercel.json`) hit `api/cron/*.ts`, which invoke the matching EFs with the service-role key: `drain-nurture-queue` (*/15 min — sends from `magnet_email_queue`), `replay-quiz-failures` (*/30 min), `notify-founder-digest` (daily 14:00 UTC), `weekly-trends-digest` (Fri 14:00 UTC).
- **Migrations** in `supabase/migrations/` are idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`); apply via `mcp__supabase__apply_migration` (auto-tracked) AND commit the matching `.sql` (recorded version as filename) so `supabase db push` stays a no-op.

**PRs:** `.github/pull_request_template.md` is mandatory — §8.5 Four-Screen Test (Terrain / Worldview / Tier / Safety; any "No" or unjustified "N/A" blocks merge), §8 register reference, Lock alignment, smoke-verification plan, and the "Manual entries this PR triggers" list that feeds the end-of-session Manual update.

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
- Lock register lives in Manual §0.8. **As of v4.10 the docx index is caught up through #83** (the v4.9 "#56 quiz-capture" mislabel was resolved by assigning it #83 — **#83 awaits founder ratification**). Canonical Manual is now `Eden_Apothecary_Manual_v4_10.docx`. The repo (through PR #238) is well ahead of the last Manual fold-in — check the newest Session Log for the true sync point.

## Deploy & tooling rules (learned the hard way)

- **Public Edge Functions** (`verify_jwt=false` in `supabase/config.toml`) **must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. (`config.toml` now locks the setting at the file layer — Lock #72 — but the CLI-from-main rule stands. Verified anon-200 holds after CLI deploy.)
- **`gh` CLI is not installed** — use `mcp__github__*` (create_pull_request, merge_pull_request, etc.). Pushes via local `git` over SSH work.
- **`git commit -m "…"` must not contain backticks or `$()`** — bash runs them as command substitution and mangles the message. (Squash-merge titles via MCP are clean regardless.)
- **Editing the Manual docx:** `unpack.py` is NOT standalone here — it ships inside the **`docx` skill** (`scripts/office/unpack.py --merge-runs false` → edit XML with the Edit tool → `pack.py --original`). Set `PYTHONUTF8=1` when running pack (Windows console cp1252 chokes on `→`). Rev version, add §9 entry, archive prior to `_archive/manuals/`.
- **Python:** the bash `python` is the Windows Store stub. Real Python is via scoop (`/c/Users/gramm/scoop/apps/python/current/python.exe`); `pip install defusedxml lxml` for the docx scripts.

## Environment realities (Camila's machine)

- **Agent file tools and Camila's interactive PowerShell see different filesystems.** They share only the OneDrive tree (`…/Biblical Herbalism/**`). `AppData` is agent-side-visible but NOT visible to her terminal. **Route any file handoff through OneDrive.**
- **Supabase MCP token** lives agent-side in `claude_desktop_config.json` (`%APPDATA%\Claude`), passed as `--access-token`. Rotation helper: `…/Products/App/stage-token.ps1` (masked input → OneDrive temp file → agent writes config → Camila fully quits + reopens Claude from the tray). Token + GitHub PAT rotate ~90 days.
- **Chrome / browser:** Camila drives browser steps via screenshots; be explicit when I can't drive something. Stripe dashboard is blocked to automation — she pastes/screenshots.
- `_memory/` (`…/Eden Apothecary/_memory/`) holds the prior Cowork memory system (~50 `feedback_*.md` + `MEMORY.md`) — load-bearing context distilled here, but read it if deeper detail is needed.

## Current open items (as of 2026-07-02, reconstructed from repo state through PR #238 — update at each wrap)

**Open PRs (3):**

- **#227 Preorder system Phase 1 (draft):** orders state machine (`homeschool_orders` → `orders`, 8-state enum, `products`/`order_items`/`message_log`/`stripe_events` idempotency ledger), built by extending the existing EF stack. **Nothing touches prod until an explicit founder "go"** — the migration is paired with the patched `stripe-webhook` redeploy. Founding pricing: kit first-500 $249→$349; notebook time-bound $19.99→$24.99. Plan doc: `docs/preorder-system-phase-1.md`.
- **#226 founders-lock Twilio API-key auth + `testsms` route:** already deployed to prod; the PR syncs `main`. SMS delivery still gated on Twilio A2P 10DLC approval (external, founder-side).
- **#221 Materia Medica herb plates:** `MateriaMedicaPlate` component + 16 optimized antique plates (`public/materia-medica/`) — **not yet placed on any page** (brand-placement decision = founder authority surface).

**Landed since the last Manual fold-in (v4.12 covered through PR #181) — repo-verified highlights:**

- **Astro migration of marketing surfaces is effectively complete:** homepage (`/`) is Astro (#196) with the returning-visitor personalization island `HomeJourneyPersonalizer` (#197 — this is the enhancer-island plan realized); plus `/constitutional-herbalism` (#193), `/why-eden` (#194), `/courses` (#195), `/community`, `/homeschool`, `/homeschool/herbs` (#222). Still SPA-only: legal ×3, `/results/:slug`, `/guide/:slug`, apothecary surfaces. `llms.txt` + AI-crawler allowances added (#192).
- **Deep-Dive Guide is a live $4.99 product:** price wired through Stripe + all surfaces (#199–#201); rich 8-pattern PDF rendered server-side on purchase via `constitution-pdf` (#218/#219); email CTAs go straight to Stripe checkout (#217); paid guide content moved fully server-side, closing a paywall bypass (#235).
- **Nurture pipeline runs on `magnet_email_queue`** + `nurture-emails` EF + 15-min drain cron: homeschool Weeks 4–7 (#209), behavioral suppression — don't re-pitch purchased offers (#208), quiz 3-arc + waitlist email de-dup (#189), per-list one-click unsubscribe RFC 8058 (#190), email open/click + CTA tracking (#205), fuzzy email-typo blocking on first submit (#210).
- **Waitlists retired:** Tier-2 → coming-soon + Start-with-Tier-1 (#185); Practitioner → explainer, no signups (#187); App page presents Eden Apothecary as live, not a beta waitlist (#186).
- **Homeschool commerce:** kit orders recorded with a 500-unit founding counter (#216); `founders-lock` EF captures Sprouts founder pricing + sent the Email #1 blast (#225); partner inquiries + co-op licensing + investor inquiries → founder punch-list follow-ups (#211–#214); Eden's Table herb-sourcing page `/homeschool/herbs` with 36 Seedlings herbs (#222/#228); Shop CTAs in global nav + every customer email (#229–#232).
- **Founder dashboard grew:** CRM tab (#198), lead-magnet drill-downs (#204), real revenue view incl. LearnWorlds course sales via `founder_revenue` (#206), daily digest appends the punch-list (#213). Dashboard counts/aggregates must always be server-side RPC, never `data.length` (PostgREST caps RPC rows at 1000).
- **Security/hardening pass (Jul 1):** lead-digest PII function locked + dead weight removed (#233), payment + internal-cron EFs hardened (#234), apothecary dead-code prune + single-source constitution map (#237/#238).

**Carried from v4.12 — not re-verifiable from the repo; confirm against the newest Session Log before acting:**

- Ratify **Lock #83**; fold PRs #182–#238 into docx Manual §9 + promote proposed Locks (large backlog now).
- Canva scroll-ad → Meta Ads campaign optimizing on `Lead`; optional AEM `Lead` prioritization. Meta CAPI active (consent-gated, PR #171); `edeninstitute.health` domain verified in Meta Business (PR #172).
- GA4 + GSC automation still blocked by org policy `iam.disableServiceAccountKeyCreation` (needs Org Policy Admin) — founder chose manual GA4/GSC reads for now.
- Balanced quiz leads → dashboard (EF + `entry_funnel` enum); `resend-waitlist` doesn't persist `metadata` on `waitlist_signups` (wire if Pattern-segmented nurture wanted).
