# CLAUDE.md — Eden Institute / Eden Apothecary

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

---

## Who & what

- **Founder:** Camila Johnson (`hello@edeninstitute.health`). Architect-founder, not a developer; runs Windows PowerShell. She decides; I build.
- **Eden Apothecary is an APP** (not a course/service/product line) — every consumer surface must frame it that way.
- **Repo:** `Eden-Institute/eden-institute-landing` · default branch `main` · local clone at `C:\Users\gramm\OneDrive\Documents\Biblical Herbalism\Products\App\eden-institute-landing-repo` (her PowerShell auto-cds here).
- **Supabase:** project ref `noeqztssupewjidpvhar`; custom tables in `public`.
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons in `vercel.json`.
- **Stack:** Vite + React SPA (TS), Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, Vercel.

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

- **Public Edge Functions** (`resend-waitlist`, `record-quiz-completion`, etc. — `verify_jwt=false` in `supabase/config.toml`) **must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. (Verified anon-200 holds after CLI deploy.)
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

## Current open items (as of 2026-06-05, v4.12 — update at each wrap)

- **SEO: SPA→Astro migration IN PROGRESS** (v4.12, PR #181). `/community` + `/homeschool` now **pre-rendered to static HTML and live** — crawlers finally read real content + `Course` JSON-LD (were empty SPA shells with the homepage title). Architecture: Astro in `./web` (own srcDir) → `dist/`; SPA → `dist/_spa` (base `/_spa/`); `vercel.json` rewrite routes non-marketing paths to the SPA shell; crons preserved. **Islands that import the Supabase client must be `client:only`** (localStorage at module load crashes SSR). **Homepage deliberately NOT migrated — leave it.** Remaining: `/constitutional-herbalism`, `/why-eden`, `/courses`, legal×3, `/results/:slug`×8, apothecary marketing×3. Founder chose to **preserve `JourneyAwareQuizCTA` personalization exactly** → build a reusable `client:only` enhancer island (needs a logged-in preview test). Founder action: request indexing for `/homeschool` in GSC. See newest Session Log §2/§5.
- **Meta CAPI is ACTIVE** (consent-gated, PR #171; `META_CAPI_ACCESS_TOKEN` set; resend-waitlist v34). Browser Pixel Lead confirmed; server dedup % surfaces on Meta's clock. **`edeninstitute.health` domain verified** in Meta Business (PR #172).
- **Weekly trends briefing LIVE** — `weekly-trends-digest` EF + Vercel cron `0 14 * * 5`; emails interpreted WoW trends to hello@ every Friday. **First run was Fri Jun 5** — still unconfirmed (check `weekly_trends_runs` + inbox). GA4/GSC NOT auto-included (see below).
- **GA4 + GSC automation BLOCKED/deferred:** GCP project `eden-institute-analytics` + key-less service account `eden-weekly-briefing@…` exist, but org policy `iam.disableServiceAccountKeyCreation` blocks the key (needs Org Policy Admin). Founder chose manual GA4/GSC reads for now.
- **Founder actions / in progress:** ratify **Lock #83**; finish the **Canva scroll-ad** (timing 4.5s/frame + Slide-Up transition + CTA + MP4 export → Meta Ads campaign optimizing on `Lead`); optional AEM `Lead` prioritization in Meta.
- **Engineering follow-ups:** **Phase 3.1.2 Day-7 nurture needs redesign under a NEW table name** (`nurture_email_queue` is taken by the v3.33 constitution drip — PR #144 closed); fold v4.12 PRs (#179/#180/#181) into docx Manual §9 + promote proposed Locks; balanced quiz leads → dashboard (EF + `entry_funnel` enum); `resend-waitlist` doesn't persist `metadata` on `waitlist_signups` (PR #180 forwards it; `waitlistUpsert` ignores it — wire if Pattern-segmented nurture wanted). **Open-PR list is currently empty.**
- **Founder dashboard** live at `/founder` (login `hello@`); Leads + Traffic tabs; test traffic excluded. **v4.12:** counts now **server-aggregated** via `founder_lead_summary` RPC (was capped at 1000 rows / froze at ~994); **Sign out** button + refresh timestamp added. Dashboard counts/aggregates must always be server-side, never `data.length` (PostgREST caps RPC rows at 1000).
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.
