-- =============================================================================
-- Eden Apothecary — RLS Cleanup: drop stale permissive policies, re-apply canonical set
-- Migration date: 2026-04-21 (same-day patch to 20260421_rls_and_views.sql)
-- Manual ref:     v1.7 §6.4 (RLS reconciliation note)
-- =============================================================================
--
-- CONTEXT
-- The prior RLS migration (20260421_rls_and_views.sql) successfully:
--   - enabled RLS on all base + junction + dimension tables
--   - created canonical policies (herbs_no_client_read, contra_seed_read,
--     refer_out_public_read, <table>_seed_read, <table>_public_read)
-- But it did NOT drop pre-existing policies inherited from an older seed
-- migration. Under Postgres RLS, permissive policies are OR'd together, so a
-- stale `read_public USING (true)` on contraindications lets anon read 202
-- rows even though our canonical `contra_seed_read` is restrictive.
--
-- POST-MIGRATION VERIFICATION (as anon role, 2026-04-21):
--   herbs                  = 50  (leak via `herbs_tier_gated`)
--   contraindications      = 202 (leak via `read_public USING (true)`)
--   herbs_actions          = 199 (leak via `ha_gated` EXISTS-join)
--   herbs_tastes           = leaked (same pattern)
--
-- STRATEGY
--   1. For every scoped relation, DROP every existing policy.
--   2. Re-apply only the canonical policies.
--   3. Re-verify as anon — expect zeros on base/junction reads.
--
-- SAFE TO RE-RUN (idempotent via loops + `drop policy if exists`).
-- =============================================================================

begin;


-- -----------------------------------------------------------------------------
-- 1 · Drop EVERY policy on scoped tables (clean slate)
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
  pol record;
  scoped_tables text[] := array[
    -- profiles + base herbs
    'profiles','herbs',
    -- junctions
    'herbs_actions','herbs_complaints','herbs_constitutions',
    'herbs_doshas_aggravates','herbs_doshas_match','herbs_preparations',
    'herbs_systems','herbs_tastes','herbs_tcm_contraindicated',
    'herbs_tcm_indicated','herbs_tissue_states_contraindicated',
    'herbs_tissue_states_indicated',
    -- dimensions
    'actions','body_systems','complaints','conditions','constitutions','doshas',
    'preparations','tastes','tcm_patterns','tissue_states',
    -- contraindications + refer-out
    'contraindications','refer_out_triggers',
    -- metadata
    'sources','citations','citations_herbs','herb_synonyms','complaint_synonyms',
    'schema_fields','schema_version',
    -- service_role-only audit log
    'subscription_events'
  ];
begin
  foreach tbl in array scoped_tables
  loop
    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I;', pol.policyname, tbl);
    end loop;
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- 2 · profiles  (owner-only reads/writes; service_role bypasses)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_self_select" on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- subscription fields are service_role-owned; block client-side edits:
    and subscription_tier   is not distinct from (select subscription_tier   from public.profiles where user_id = auth.uid())
    and subscription_status is not distinct from (select subscription_status from public.profiles where user_id = auth.uid())
    and stripe_customer_id  is not distinct from (select stripe_customer_id  from public.profiles where user_id = auth.uid())
  );


-- -----------------------------------------------------------------------------
-- 3 · herbs base table  (no direct client access)
-- -----------------------------------------------------------------------------
alter table public.herbs enable row level security;

create policy "herbs_no_client_read" on public.herbs
  for select to anon, authenticated
  using (false);


-- -----------------------------------------------------------------------------
-- 4 · junction tables  (Seed+ direct reads only)
-- -----------------------------------------------------------------------------
do $$
declare jt text;
declare junction_tables text[] := array[
  'herbs_actions','herbs_complaints','herbs_constitutions',
  'herbs_doshas_aggravates','herbs_doshas_match','herbs_preparations',
  'herbs_systems','herbs_tastes','herbs_tcm_contraindicated',
  'herbs_tcm_indicated','herbs_tissue_states_contraindicated',
  'herbs_tissue_states_indicated'
];
begin
  foreach jt in array junction_tables
  loop
    execute format('alter table public.%I enable row level security;', jt);
    execute format(
      $p$create policy "%I_seed_read" on public.%I for select to authenticated using (public.current_user_at_least('seed'));$p$,
      jt, jt
    );
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- 5 · dimension tables  (public terminology, read-only)
-- -----------------------------------------------------------------------------
do $$
declare dt text;
declare dimension_tables text[] := array[
  'actions','body_systems','complaints','conditions','constitutions','doshas',
  'preparations','tastes','tcm_patterns','tissue_states'
];
begin
  foreach dt in array dimension_tables
  loop
    execute format('alter table public.%I enable row level security;', dt);
    execute format(
      'create policy "%I_public_read" on public.%I for select to anon, authenticated using (true);',
      dt, dt
    );
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- 6 · contraindications  (Seed+ direct; anon goes through safety-floor view)
-- -----------------------------------------------------------------------------
alter table public.contraindications enable row level security;

create policy "contra_seed_read" on public.contraindications
  for select to authenticated
  using (public.current_user_at_least('seed'));


-- -----------------------------------------------------------------------------
-- 7 · refer_out_triggers  (clinical safety: public read)
-- -----------------------------------------------------------------------------
alter table public.refer_out_triggers enable row level security;

create policy "refer_out_public_read" on public.refer_out_triggers
  for select to anon, authenticated
  using (true);


-- -----------------------------------------------------------------------------
-- 8 · metadata tables  (public provenance/search surface)
-- -----------------------------------------------------------------------------
do $$
declare mt text;
declare meta_tables text[] := array[
  'sources','citations','citations_herbs','herb_synonyms','complaint_synonyms',
  'schema_fields','schema_version'
];
begin
  foreach mt in array meta_tables
  loop
    execute format('alter table public.%I enable row level security;', mt);
    execute format(
      'create policy "%I_public_read" on public.%I for select to anon, authenticated using (true);',
      mt, mt
    );
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- 9 · subscription_events  (service_role only — no client policies)
-- -----------------------------------------------------------------------------
alter table public.subscription_events enable row level security;
-- Intentionally no policies: RLS + no policy = no client rows reachable.
-- service_role bypasses RLS entirely.


commit;


-- =============================================================================
-- Verification (run manually after applying, switching the Role dropdown)
-- =============================================================================
-- As anon, expect:
--   herbs                      = 0
--   herbs_public               = 50
--   herbs_clinical_v           = 0
--   contraindications          = 0
--   contraindications_safety_v = 30
--   herbs_actions              = 0
--   herbs_tastes               = 0
--   body_systems               = 14   (dimension public read)
--   profiles                   = 0
-- =============================================================================
