# CLAUDE.md — Eden Institute / Eden Apothecary

Working memory for Claude Code. Auto-loaded every session. Keep it high-signal.

---

## ▶ START EVERY SESSION HERE

Run this before doing task work:

1. **Read the newest `Session_Log_*.md`** in `…/Products/App/Eden Apothecary/` (they're dated + versioned; newest = where we left off). It is the authoritative continuity record. *(OneDrive path — only reachable from Camila's machine; remote/cloud sessions work from this file + repo state.)*
2. **Skim the Manual** `…/Products/App/Eden Apothecary/Eden_Apothecary_Manual_v*.docx` (latest version) — §0 (Locks, founding decisions) and §9 (Session Log). Use the `docx` skill to read/edit it.
3. **Verify the Supabase MCP token:** call `mcp__supabase__list_tables`. If `Unauthorized`, the token lapsed — see "Supabase MCP token" below.
4. **Verify repo state:** `git -C <repo> log --oneline -5` and `mcp__github__list_pull_requests` (open PRs).
5. **Then ask Camila what to work on** — surface anything in "Current open items" first.

I do **not** have memory between sessions. Continuity = these artifacts. **Update the Session Log (and the Manual) at the end of every session — non-negotiable.**

---

## Who & what

- **Founder:** Camila Johnson (`hello@edeninstitute.health`). Architect-founder, not a developer; runs Windows PowerShell. She decides; I build.
- **Eden Apothecary is an APP** (not a course/service/product line) — every consumer surface must frame it that way. It is presented as **live** (waitlist framing retired, PR #186).
- **Repo:** `Eden-Institute/eden-institute-landing` · default branch `main` · local clone at `C:\Users\gramm\OneDrive\Documents\Biblical Herbalism\Products\App\eden-institute-landing-repo` (her PowerShell auto-cds here).
- **Supabase:** project ref `noeqztssupewjidpvhar`; custom tables in `public`.
- **Vercel:** project `eden-institute-landing`, prod `https://edeninstitute.health`; crons in `vercel.json`.
- **Stack:** Astro (static marketing pages, React islands) + Vite React SPA (TS) for app/auth routes, Supabase (Postgres + Edge Functions + Auth), Resend, Stripe, LearnWorlds (courses), Vercel.

## Architecture: dual build (Astro marketing + SPA app)

One repo, two builds, one Vercel deployment (`npm run build` = `astro build` then `vite build`):

- **Astro** owns public **marketing** routes, pre-rendered to static HTML for SEO. Lives in `./web` (own `srcDir` so its router never collides with the SPA's `src/pages/*.tsx`) → outputs to `dist/`. Migrated so far: `/` (homepage, PR #196 — the old "don't migrate the homepage" decision is superseded), `/community`, `/homeschool`, `/homeschool/herbs`, `/constitutional-herbalism`, `/why-eden`, `/courses`.
- **SPA** (Vite + React Router) owns everything else — quiz/assessment, `/results/:slug`, guide funnel, `/apothecary/**` app + auth, `/founder` dashboard, legal pages, 404 → builds to `dist/_spa` with base `/_spa/`.
- **Routing precedence:** Vercel serves static files first, so Astro's emitted HTML wins for migrated paths; the `vercel.json` rewrite sends every remaining non-asset path to `/_spa/index.html`. Redirects: `/app*` → `/apothecary*`, `/Homeschool` → `/homeschool`, `/go/deep-dive/:slug` → `guide-checkout` EF (302 straight to Stripe).
- **Shared code:** both builds resolve `@/` → `./src`, so Astro islands reuse SPA components, the Supabase client, and `src/index.css`. Astro exposes the same `VITE_`/`PUBLIC_` env prefixes.
- **Islands that import the Supabase client must be `client:only`** — the client touches localStorage at module load and crashes SSR. Islands live in `web/components/islands/` (`WaitlistController`, `SiteAnalytics`, `HomeJourneyPersonalizer` returning-visitor personalization, `PartnerInquiryForm`).

## Repo map

- `web/` — Astro srcDir: `pages/` (marketing routes), `layouts/MarketingLayout.astro`, `components/` (+ `islands/`).
- `src/` — SPA: `App.tsx` (route registry), `pages/` (incl. `apothecary/` app screens), `components/` (`apothecary/`, `founder/` dashboard tabs, `guide/`, `journey/`, `landing/`, `quiz/`, `ui/` shadcn), `lib/` (domain logic: `edenPattern.ts`, `constitution-data.ts`, `apothecaryTiers.ts`, `routes.ts`, `consent.ts`, `metaPixel.ts`…), `integrations/supabase/`, `contexts/`, `hooks/`, `test/` (vitest).
- `api/cron/` — Vercel cron handlers (thin service-role forwarders to internal EFs): `drain-nurture-queue` (*/15m), `replay-quiz-failures` (*/30m), `notify-founder-digest` (daily 14:00 UTC), `weekly-trends-digest` (Fri 14:00 UTC).
- `supabase/functions/` — ~21 Edge Functions; shared helpers in `_shared/` (`require-service-role.ts`, email templates, `email-unsubscribe.ts`, `shop-cta.ts`, `guide/`). `supabase/migrations/` — 60+ dated `.sql` files mirroring MCP-applied migrations.
- `supabase/config.toml` — **the layer that locks `verify_jwt` per function** (Lock #72). Three categories: (1) public-frontend EFs and (2) webhook EFs (`stripe-webhook`, `resend-webhook`, `learnworlds-webhook`, `founders-lock`) are `verify_jwt=false`; (3) internal cron workers + `constitution-pdf` are `verify_jwt=true` **and** require `role=service_role` — never flip these.
- `public/` — shared static assets: `robots.txt`, `sitemap.xml`, `llms.txt` (AI answer-engine crawlers explicitly allowed, PR #192), `email/` + `lead-magnets/` assets, `showcases/`.
- `.design-sync/` — curated component sync into claude.ai/design (config, vintage-apothecary conventions brief, 36 previews). Not app code.
- `.github/pull_request_template.md` — **mandatory §8.5 Four-Screen Test** (Terrain / Worldview / Tier / Safety) + Lock alignment + smoke plan. Every PR fills it in; unjustified "N/A" blocks merge.

## Development workflows

- `npm run dev` (SPA) · `npm run dev:astro` (marketing) · `npm run build` (both, in Vercel order) · `npm test` (vitest) · `npm run lint`.
- **Add a client route:** add to `ROUTES` in `src/lib/routes.ts` **and** the matching `<Route>` in `App.tsx`. Never hardcode path strings — a dead-URL Navbar CTA once lost 4 real quiz leads (PR #75 postmortem lives in that file's header).
- **Migrations:** apply via `mcp__supabase__apply_migration` (auto-tracked), AND commit the matching `.sql` file (use the recorded version as the filename) so `supabase db push` stays a no-op. Idempotent guards (`IF NOT EXISTS`, `CREATE OR REPLACE`) make re-runs safe.
- **Dashboard counts/aggregates must be server-side** (RPCs like `founder_lead_summary`, SECURITY DEFINER gated by `is_founder()`), never `data.length` — PostgREST caps rows at 1000 and the dashboard once froze at ~994.
- New EFs must be registered in `supabase/config.toml` with the correct `verify_jwt` category and a comment saying why.

## Key domain systems (as built, through PR #238)

- **Quiz/assessment funnel:** `/assessment` → `record-quiz-completion` EF → `/results/:slug` (8 body patterns). Failed captures replayed by the `replay-quiz-failures` cron. Fuzzy email-typo suggestions block first submit (PR #210).
- **Deep-Dive Guide ($4.99, paid):** `guide-checkout`/`create-checkout` → Stripe → `stripe-webhook` → `constitution-pdf` renders the rich 8-pattern PDF server-side (service-role only — **paid content never ships in client code**, PR #235) → `/guide/success` verified by `verify-session`.
- **Homeschool funnel ("Sprouts"/"Seedlings"):** `/homeschool` (free-sample-dominant hero) + `/homeschool/herbs` (Eden's Table herb sourcing), weekly lead magnets, Weeks 4–7 nurture (PR #209), kit preorders recorded via Stripe with a 500-unit counter (PR #216), `founders-lock` EF for founder's-price capture.
- **Email system (Resend):** nurture queue drained every 15 min; **behavioral suppression** — never re-pitch a purchased offer (PR #208); per-list RFC 8058 one-click unsubscribe (signed token, PR #190); open/click + CTA tracking via `resend-webhook` (PR #205); every customer-facing email carries the "Shop Medicinal Herbs" CTA (PR #232).
- **Founder dashboard** `/founder` (login `hello@`): Leads, Traffic, CRM, Revenue (Stripe + LearnWorlds via `learnworlds-webhook` → unified `founder_revenue`), Email-engagement, Lead-magnets (clickable drill-downs) tabs; test traffic excluded. Punch-list table feeds the daily founder digest (PR #213); partner/investor inquiries (`submit-partner-inquiry`) auto-add punch-list follow-ups.
- **Waitlists retired:** Tier-2 → coming-soon + Start-with-Tier-1 (PR #185); Practitioner → explainer, current-users-beta-first, no signups (PR #187). The EFs still exist; don't resurrect the funnels.
- **Analytics/ads:** Meta Pixel + CAPI, consent-gated (`consent.ts`, `ConsentBanner`); `edeninstitute.health` domain verified in Meta Business.

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
- Worldview language: stewardship + body-as-temple framing, never influencer-wellness syntax (§8.5 Worldview screen). Founder voice on community surfaces: off-grid/homesteaders, no woo-woo, God sovereign (PR #188).
- Lock register lives in Manual §0.8. As of v4.10 the docx index is caught up through #83 (**#83 awaits founder ratification** — verify current Manual version in the newest Session Log; repo work has continued past the docx).

## Deploy & tooling rules (learned the hard way)

- **Public Edge Functions** (`verify_jwt=false` in `supabase/config.toml`) **must deploy via the CLI from `main`** (Lock #71: `git checkout main` → `git pull` → `supabase functions deploy <fn>`). Do NOT deploy public EFs via MCP — it can reset `verify_jwt=true` and 401 every anon call. (Verified anon-200 holds after CLI deploy; config.toml now locks the setting at the file layer, Lock #72.)
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

- **Astro migration remaining:** legal ×3 (`/terms`, `/privacy`, `/cookies`), `/results/:slug` ×8, apothecary marketing ×3 (`/apothecary`, `/apothecary/start`, `/apothecary/pricing`). Homepage, `/community`, `/homeschool`(+`/herbs`), `/constitutional-herbalism`, `/why-eden`, `/courses` are DONE and live. Personalization preserved via `client:only` islands (`HomeJourneyPersonalizer` shipped, PR #197).
- **Manual/docx debt:** PRs since the v4.12 docx entry (#182–#238: waitlist retirements, $4.99 guide price, revenue view, CRM tab, homeschool orders/partner inquiries/punch-list migrations, email tracking, security hardening #233–#235, apothecary cleanup #237–#238) need folding into Manual §9 + Lock promotions. Ratify **Lock #83**.
- **Security hardening landed (Jul 1):** paid guide content moved server-side (#235), payment + internal-cron EFs hardened (#234), lead-digest PII function locked + dead weight removed (#233), stale verify-session comment fixed (#236). Keep this posture on new EFs.
- **Nurture redesign:** Phase 3.1.2 Day-7 nurture still needs a NEW table name (`nurture_email_queue` is taken by the v3.33 constitution drip — PR #144 closed).
- **GA4 + GSC automation BLOCKED/deferred:** org policy `iam.disableServiceAccountKeyCreation` blocks the service-account key (GCP project `eden-institute-analytics` exists). Founder chose manual GA4/GSC reads; weekly-trends digest runs without them.
- **Two accounts stay separate:** `hello@` = founder/admin/dashboard; `grammarswag@gmail.com` = Camila's personal (her Pattern). Do not merge.
- *Founder-side items (Canva ads, GSC indexing requests, Meta campaign state) live in the newest Session Log — check there, not here.*
