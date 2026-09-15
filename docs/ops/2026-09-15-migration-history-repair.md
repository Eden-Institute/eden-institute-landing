# Migration history repair, 2026-09-15

Founder decision 2026-09-15: "Repair the records." Goal: the repo's migrations describe
production, so `supabase db push` works again and a fresh database can be rebuilt, with no
change to the live schema.

This branch **prepares** the repair. Nothing here has been run against production. All
production reads below were made with the read-only Supabase connection
(`supabase_read_only_user`) on 2026-09-15.

## 1. Local files vs remote history

Remote: `select version, name from supabase_migrations.schema_migrations order by version`
returned **149** rows, from `20260304192045` to `20260915100000`.
Local: `supabase/migrations/` on `origin/main` (0a2efea) holds **152** files, all named
`<14-digit version>_<name>.sql`, no duplicate versions.

| Set | Versions |
|---|---|
| Remote only (history row, no file) | **none** |
| Local only (file, no history row) | `20260912230000`, `20260914230000`, `20260915000000` |
| Both | the other 149 |

After this branch adds the snapshot file, local-only also includes `20260607003543`.

### Local-only versions: are they live?

All three were applied outside the CLI and are live. Checked object by object:

| Version / file | What it creates | Production on 2026-09-15 |
|---|---|---|
| `20260912230000_founding_partners_next_followup_override.sql` | column `founding_partners.next_followup_due`; `founder_partner_due()` replaced | column present; function `prosrc` md5 identical to the file body |
| `20260914230000_esa_invoices.sql` | tables `esa_invoice_counters`, `esa_invoices` (RLS on), 2 indexes, function `esa_next_invoice_number(text,int)` (service_role only), bucket `esa-invoices` | all present; RLS on; both indexes; bucket row exists; anon has no EXECUTE; function body md5 identical |
| `20260915000000_esa_payments.sql` | tables `esa_payments`, `esa_payment_confirmations` (RLS on), index, 10 new `esa_invoices` columns, functions `esa_auto_confirm_ready()`, `esa_mark_invoice_paid(uuid,text,uuid)` (service_role only) | all present; all 10 columns; index present; anon has no EXECUTE on either function, service_role has it; both bodies md5 identical |

So they are marked applied, never re-run.

## 2. Production-only objects: snapshot migration

A sweep of every `public` table, view and non-extension function in production against
`create table|view|function` statements in `supabase/migrations/` found these with no
creating migration:

| Object | Kind | Notes |
|---|---|---|
| `crm_people` | view | owner `postgres`, no `security_invoker`, ACL postgres + service_role only |
| `feedback_submissions` | table | RLS on; first altered by `20260709180000` |
| `nurture_email_queue` | table | RLS on, no policies; first altered by `20260607003544` |
| `founder_crm_feed(timestamptz)` | function | SECURITY DEFINER, `is_founder()` gate (not a view) |
| `founder_crm_summary(timestamptz)` | function | same |
| `founder_partner_awaiting_email()` | function | same; also prod-only, found by the sweep |
| `set_nurture_queue_updated_at()` | trigger function | behind `trg_nurture_queue_updated_at` |

`founders_interest` and `founders_send_log` are already codified by
`20260915100000_audit_hardening.sql` section 9, but `founders_interest` is read by
`20260728230000_launch_day_blast_preorder_series.sql:48`, which sorts before section 9.

**New file:** `supabase/migrations/20260607003543_snapshot_prod_only_relations.sql`

- Version: one second before `20260607003544_nurture_queue_allow_3arc_positions.sql`, the
  earliest migration that touches any of these objects (the mentions in `20260603040000`
  and `20260616120000` are comments). Not taken locally or remotely, and not one of the
  `20260916*` versions used by other batches.
- Contents: `founders_interest` (same shape as section 9), `nurture_email_queue` (full
  live shape), `set_nurture_queue_updated_at()` + its trigger, `feedback_submissions`
  **base shape** (the 8 original columns; `20260709180000` adds the other 17 columns, two
  indexes and the `feedback_submissions_select_own` policy, and its CREATE POLICY is
  unguarded, so those are left to it), `crm_people`, and the three founder RPCs, with
  grants matching the live ACLs.
- Every dependency of `crm_people` (`waitlist_signups`, `quiz_completions`,
  `magnet_email_queue`, `profiles`, `is_internal_tester`) is created by an earlier
  migration, and no later migration drops or retypes a column the view reads.
- Idempotent and non-destructive: `create table if not exists`, `create index if not
  exists`, view and functions created only when `to_regclass` / `to_regprocedure` is
  null (never replaced), trigger created only if absent, no DROP, no data.
- Verified byte-for-byte against production: the md5 of `pg_get_viewdef` for `crm_people`
  and of `pg_get_functiondef` for all four functions equals the md5 of the file text (view
  compared with the added `public.` qualifiers removed).
- The file and every `$ddl$` string in it parse with the PostgreSQL parser bundled in pglast 8.4 (libpg_query).

## 3. Guards on existing migrations

Each file below has already run in production, and an applied migration never runs there
again, so none of these edits changes production.

| File | Change |
|---|---|
| `20260427200000_herbs_cold_quadrant_dual_citation.sql` | Trailing `INSERT INTO supabase_migrations.schema_migrations ... ON CONFLICT DO NOTHING` commented out, with a note; header NOTE updated to say so |
| `20260427210000_herbs_mixed_energetic_dual_citation.sql` | Same |
| `20260502151500_v4_3_2_canonicalize_constitution_slugs.sql` | `INSERT INTO public.schema_migrations ...` wrapped in `DO $guard$ ... IF to_regclass('public.schema_migrations') IS NOT NULL THEN ... END IF ... $guard$`, with a note |
| `20260502160000_v4_3_3_canonicalize_herb_status.sql` | Same |

Why:
- `public.schema_migrations` does not exist in production today and no migration creates
  it, so on a replay those two inserts fail on a missing relation.
- For the other two, the CLI writes `supabase_migrations.schema_migrations` itself after
  running a file. The CLI 2.90.0 binary contains both a plain
  `INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES($1, $2, $3)`
  and an `ON CONFLICT (version) DO UPDATE` variant. That the apply path uses the plain
  insert, and so collides with a row the file already wrote, is **inferred, not reproduced**.
  Commenting the insert out is correct either way.

`20260728230000` (reads `founders_interest`) is not edited: the snapshot now creates the
table first. Line endings unchanged (LF, as committed). Diff on those 4 files: +60 / -24.

## 4. Repair commands (for the orchestrator; NOT run)

The CLI's `migration repair` has no `--project-ref` flag. It acts on the linked project
(`--linked` is the default), so link first. It only writes history rows. It executes no
migration SQL.

```
supabase link --project-ref noeqztssupewjidpvhar
supabase migration list
supabase migration repair --status applied 20260607003543 20260912230000 20260914230000 20260915000000
supabase migration list
supabase db push --dry-run
```

Expected:
- the first `migration list` shows the four versions as local only, and nothing as remote only
- the second shows them in both columns
- `db push --dry-run` lists only genuinely new files, meaning the `20260916100000`,
  `20260916110000`, `20260916120000` and `20260916130000` files once those batches are
  merged, and nothing else

**No `--status reverted` is needed.** There are no remote-only versions.

Order matters. Merge this branch, then run the repair, then run any `db push`. If the
repair lands before this branch is on the checkout the CLI reads, the repair for
`20260607003543` fails because there is no local file.

## 5. Replay validation

- `docker info` failed: Docker is not available on this machine, so `supabase db reset`
  was **not run**. The chain has not been replayed end to end.
- Static ordering check (a script over all 153 files): comments and dollar-quoted bodies
  stripped, then every `public.<relation>` referenced by FROM / JOIN / ALTER TABLE /
  REFERENCES / INSERT / UPDATE / ON / TRUNCATE checked against tables, views and functions
  created by the same or an earlier file.
  - Before this branch it flagged: `public.schema_migrations` (20260502151500, 20260502160000),
    `nurture_email_queue` (20260607003544, 20260903170000), `feedback_submissions`
    (20260709180000) and `founders_interest` (20260728230000).
  - After this branch it flags nothing.
- Full parse of all 153 files with the PostgreSQL parser: one failure, and it is known.
  **`20260426013216_drift_correction_phase_a.sql` is truncated mid-statement**, as its own
  2026-09-15 header says. A fresh `db reset` still stops there. It cannot be fixed with a
  guard: the complete SQL that was hand-applied was never committed, and the file's note
  says not to reconstruct it by hand. Closing it needs a dump of the live
  `diagnostic_profile_v` and the functions that file touched. That is a separate decision.
- The static check does not catch semantic replay problems the audit already recorded,
  for example the one-off data repair with a hard-coded user id in `20260502142601` and
  non-idempotent CREATEs in about 15 older files. A real `db reset` on a machine with
  Docker is the next step.

## Risks

- **Running `supabase db push --include-all` before the repair would execute the four
  local-only files against production.** A plain `db push` without the repair should refuse (inferred from CLI behaviour, not run),
  because the local-only versions sort before the latest remote one.
  - Checked against today's production, that run would be a no-op in effect. The snapshot
    creates nothing (everything exists) and re-issues grants identical to the live ACLs.
  - The three ESA and partner files use `if not exists` / `on conflict do nothing`, and
    their `create or replace function` bodies are md5-identical to production.
  - Do not rely on that: run the repair first.
- The snapshot re-states Supabase's default full table grants to anon/authenticated on
  `nurture_email_queue` and `feedback_submissions`, because that is what production has.
  RLS blocks those roles. Revoking them is a separate hardening decision, not part of a
  records repair.
