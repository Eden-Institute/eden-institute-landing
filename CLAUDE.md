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

> **Cloud/web sessions:** remote Claude Code sessions see only the repo clone — the Session Log, Manual, and `_memory/` live on OneDrive and are unreachable there. In that case skip steps 1–3, treat this file + git history as continuity, and don't claim founder-side status you can't verify.

---

## Who & what

- **Founder:** Camila Johnson (`hello@edeninstitute.health`). Architect-founder, not a developer; runs Windows PowerShell. She decides; I build.
- **Eden Apothecary is an APP** (not a course/service/product line) — every consumer surface must frame it that way.
- **Repo:** `Eden-Institute/eden-institute-landing` · default branch `main` · local clone at `C:\Users\gramm\OneDrive\Documents\Biblical Herbalism\Products\App\eden-institute-landing-repo` (her PowerShell auto-cds here).
- **Supabase:** project ref `noeqztssupewjidpvhar`; custom tables in `public`.
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons in `vercel.json`; logs at vercel.com/eden-b55b0b13/eden-institute-landing/logs.
- **Stack:** Astro (marketing) + Vite/React SPA (TS), Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, Twilio (SMS), Vercel.

## Commands

```
npm run dev          # SPA dev server (Vite)
npm run dev:astro    # Astro marketing-pages dev server
npm run build        # prod parity: astro build → dist/ THEN vite build → dist/_spa (base /_spa/)
npm run lint         # eslint .
npm run test         # vitest run (all tests)
npx vitest run src/test/edenPattern.test.ts   # single test file
```

Tests live in `src/test/` (jsdom + Testing Library, setup in `src/test/setup.ts`).

## Architecture (big picture)

**Hybrid Astro + SPA on one Vercel project.** Astro owns the public marketing routes and pre-renders them to static HTML (SEO — the SPA shells were invisible to crawlers). The SPA owns app/auth/interactive routes.

- **Astro** — `srcDir: ./web` (so its router never collides with the SPA's `src/pages/*.tsx`), builds to `dist/` root. Pages: `/` (homepage IS Astro now), `/community`, `/homeschool`, `/homeschool/herbs`, `/constitutional-herbalism`, `/why-eden`, `/courses`. Layout: `web/layouts/MarketingLayout.astro`; shared React reached via the same `@/` → `./src` alias.
- **SPA** — Vite React in `src/`, builds to `dist/_spa` with `--base /_spa/`. Routes registered in `src/lib/routes.ts` + `src/App.tsx`: `/assessment` (quiz), `/results/:slug`, `/guide/:slug` + `/guide/success`, legal ×3, `/tier-two-waitlist`, `/homeschool/welcome`, `/founder` (dashboard), `/apothecary/**` (app + auth). Duplicate SPA marketing pages still exist as fallback — Vercel serves Astro's static file when one exists, else the `vercel.json` rewrite sends the path to `/_spa/index.html`.
- **Islands rule:** anything importing the Supabase client must be `client:only` (localStorage at module load crashes SSR). Reusable islands live in `web/components/islands/` (`WaitlistController`, `SiteAnalytics`, `HomeJourneyPersonalizer`, `PartnerInquiryForm`).

**Supabase Edge Functions** (`supabase/functions/`) fall into three categories, pinned by `supabase/config.toml` (Lock #72 — the file layer keeps `verify_jwt` correct on every CLI deploy):

1. **Public-frontend** (`verify_jwt=false`, do their own validation): `resend-waitlist`, `record-quiz-completion`, `record-diagnostic-completion`, `submit-feedback`, `submit-partner-inquiry`, `practitioner-waitlist-signup`, `tier-2-waitlist-signup`, `unsubscribe` (RFC 8058 signed token), `guide-checkout`, `founders-lock` (signed HMAC token + Twilio SMS).
2. **Webhooks** (`verify_jwt=false`, provider-signature auth): `stripe-webhook` (HMAC), `resend-webhook` (svix), `learnworlds-webhook` (HMAC).
3. **Internal cron workers** (`verify_jwt=true` **and** `_shared/require-service-role.ts`): `nurture-emails`, `replay-quiz-completion-failures`, `notify-founder-digest`, `weekly-trends-digest`. Also service-role-only: `constitution-pdf` (`verify_jwt=true` — renders the PAID guide; must not be anon-callable).

**Cron chain:** `vercel.json` crons → `api/cron/*.ts` (verifies `CRON_SECRET`) → EF with the service-role key. Four crons: `drain-nurture-queue` (*/15), `replay-quiz-failures` (*/30), `notify-founder-digest` (daily 14:00 UTC), `weekly-trends-digest` (Fri 14:00 UTC).

**Commerce (Stripe):** `create-checkout` is the single source of truth for products/prices — three classes: subscriptions (Seed/Root/Practitioner, requires auth), one-off digital (Deep-Dive Guide $4.99, anon-ok), physical (homeschool kit, shipping). `stripe-webhook` reconciles `profiles` (subscriptions), `quiz_completions` (guide purchases), `homeschool_orders` (kit fulfillment + Founders 500-unit counter) and triggers the guide PDF. `guide-checkout` is a server-side 302 from email CTAs (cold SPA boots from mail clients produced 0 sales — never link a checkout CTA to an SPA route from email). `verify-session` verifies the post-checkout session and returns the guide. `customer-portal` opens the Stripe billing portal for logged-in users.

**Paywall rule:** paid Deep-Dive Guide content lives ONLY server-side in `supabase/functions/_shared/guide/` — never import it into the client bundle. A verified paid Stripe session is the sole way to obtain it.

**Email system:** producers INSERT into `nurture_email_queue` (multi-arc positions); the drain cron sends via `nurture-emails`. Behavioral suppression (don't re-pitch purchased offers) is live. Templates in `_shared/nurture-email-templates.ts` + `_shared/homeschool-followup-templates.ts`; every customer-facing email carries the Shop CTA (`_shared/shop-cta.ts`); per-list one-click unsubscribe via signed tokens (`_shared/email-unsubscribe.ts`). `resend-webhook` ingests engagement events.

**Founder dashboard** (`/founder`, login `hello@`): Leads / Traffic / Lead-magnets tabs with drill-downs; `founder_punch_list` table feeds the daily digest. **Counts/aggregates must always be server-side (RPCs like `founder_lead_summary`), never `data.length`** — PostgREST caps RPC rows at 1000. Test traffic is excluded via internal-tester exclusion.

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

- **Public Edge Functions must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. `supabase/config.toml` now pins `verify_jwt` per function (Lock #72) so CLI deploys honor it without `--no-verify-jwt`; keep new EFs registered there with a comment saying which category they're in.
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

## Current open items (as of 2026-07-02 — refreshed from repo state, PRs #182–#238 merged since v4.12; the Session Log remains authoritative for founder-side status — update at each wrap)

- **Open PRs (3):**
  - **#227 (draft) — Preorder system Phase 1:** `homeschool_orders` → `orders` state machine (+ `products`, `order_items`, `message_log`, `stripe_events` idempotency ledger). Migration `20260630120000` runs ONLY on an explicit founder "go", paired with the patched `stripe-webhook` redeploy. Full plan in `docs/preorder-system-phase-1.md`.
  - **#226 — founders-lock Twilio API-key auth + `testsms` admin route.** Already deployed to prod; the PR syncs `main` with the live function. SMS delivery still gated on Twilio A2P 10DLC approval (external).
  - **#221 — Materia Medica herb plates:** `MateriaMedicaPlate` component + 16 webp plates added, wired to nothing yet — placement is a brand decision (founder authority surface).
- **Astro migration is effectively DONE for marketing** — homepage, `/community`, `/homeschool` (+ `/homeschool/herbs`), `/constitutional-herbalism`, `/why-eden`, `/courses` are pre-rendered. (The homepage WAS migrated after all — supersedes the earlier "leave it" decision; #215 fixed Get Involved on "the real (Astro) homepage".) Still SPA-only: legal ×3, `/results/:slug`, guide pages, apothecary marketing.
- **Sprouts / homeschool funnel built out (late June):** Eden's Table sourcing page `/homeschool/herbs` (36 Seedlings herbs + purchase links), kit orders recorded on purchase (500-unit founders counter), `founders-lock` founder's-price capture + Email #1 blast, new Canva Week-1/2 lead-magnet PDFs, nurture Weeks 4–7 (course stopgap + value series), co-op licensing + partner/investor inquiries (`submit-partner-inquiry` EF; investor inquiries auto-add a `founder_punch_list` follow-up).
- **Security/audit pass (#233–#236, early July):** paid guide content moved fully server-side (paywall bypass closed), payment + internal-cron EFs hardened, lead-digest PII function locked down (`20260701120000` migration), dead code pruned (#237–#238 also pruned unwired apothecary modules + fixed pricing copy).
- **Email/analytics infra since v4.12:** email engagement events + one-off send log + course sales/revenue tables; behavioral suppression Phase 1 (#208); fuzzy email-typo blocking on waitlist submit (#210); Shop CTA on nav + all customer emails (#229–#232); founder dashboard lead-magnet drill-downs (#204).
- **Carried founder actions — status unverified since v4.12, confirm against the newest Session Log:** ratify **Lock #83**; Canva scroll-ad → Meta Ads campaign; GSC indexing requests for migrated pages; optional AEM `Lead` prioritization in Meta. Likewise Meta CAPI (active, consent-gated) and the weekly trends briefing (first run Fri Jun 5) — confirm current health in `weekly_trends_runs` + inbox rather than re-deriving.
- **GA4 + GSC automation still BLOCKED/deferred:** org policy `iam.disableServiceAccountKeyCreation` blocks the service-account key (needs Org Policy Admin). Founder chose manual GA4/GSC reads for now.
- **Docs debt:** fold v4.12+ PRs (#182 onward) into docx Manual §9 + promote proposed Locks; `resend-waitlist` still doesn't persist `metadata` on `waitlist_signups` (forwarding exists; `waitlistUpsert` ignores it — wire if Pattern-segmented nurture is wanted).
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.
