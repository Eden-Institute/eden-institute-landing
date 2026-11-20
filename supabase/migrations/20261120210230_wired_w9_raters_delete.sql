-- 2026-11-20, Wired quiz W9 (Lane 2b): observer links + data deletion. Camila's go for W9 via Lane NP 11:29;
-- applied only on her own tap. Spec 7.3, 7.4, 7.6, section 4 deletion rules, answers 10 and 11.
--
-- 1. wired_observers gets its link: token_hash (sha256 of the link code; the code itself is never stored),
--    token_expires_at (30 days after the invite, answer 11) and quiz_year (the year the invite is for).
-- 2. public.wired_delete_family(p_family, p_email_hash): "Delete my quiz data" in ONE transaction.
--    Writes/raises the tombstone first (answer 10: free_slots_used and last_quiz_year survive, keyed by the
--    peppered email hash), then removes that address's dead-letter payloads, one-a-day log rows, email
--    events and every wired queue row, then deletes the family. The family delete cascades children,
--    sessions, results, prefs, family results, observers, teen links, unlocks, pending checkouts and PDF
--    jobs. KEPT: wired_buyers (family_id becomes null by its FK) and orders (financial records), and every
--    email_list_unsubscribes row (an opt-out must survive deletion). Service role only.

alter table public.wired_observers add column if not exists token_hash text;
alter table public.wired_observers add column if not exists token_expires_at timestamptz;
alter table public.wired_observers add column if not exists quiz_year integer;
create unique index if not exists wired_observers_token_hash_key on public.wired_observers (token_hash) where token_hash is not null;
create index if not exists wired_observers_active_child_idx on public.wired_observers (child_id) where removed_at is null;

create or replace function public.wired_delete_family(p_family uuid, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email   text;
  v_free    integer;
  v_year    integer;
  v_q       integer := 0;
  v_f       integer := 0;
  v_l       integer := 0;
  v_e       integer := 0;
begin
  if p_family is null or coalesce(p_email_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'wired_delete_family: family id and a 64-hex email hash are required' using errcode = '22023';
  end if;
  select lower(btrim(email)) into v_email from public.wired_families where id = p_family for update;
  if v_email is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select count(*) into v_free from public.wired_children where family_id = p_family and free_slot;
  select max(r.quiz_year) into v_year
    from public.wired_results r join public.wired_children c on c.id = r.child_id
   where c.family_id = p_family;

  insert into public.wired_tombstones (email_hash, free_slots_used, last_quiz_year, deleted_at)
  values (p_email_hash, least(2, v_free), v_year, now())
  on conflict (email_hash) do update
    set free_slots_used = least(2, public.wired_tombstones.free_slots_used + least(2, v_free)),
        last_quiz_year  = greatest(public.wired_tombstones.last_quiz_year, excluded.last_quiz_year),
        deleted_at      = now();

  delete from public.wired_email_queue where family_id = p_family or lower(btrim(email)) = v_email;
  get diagnostics v_q = row_count;
  delete from public.wired_failures where email_lower = v_email;
  get diagnostics v_f = row_count;
  delete from public.nurture_send_log where email_lower = v_email;
  get diagnostics v_l = row_count;
  delete from public.email_events where lower(btrim(recipient)) = v_email;
  get diagnostics v_e = row_count;

  delete from public.wired_families where id = p_family;

  return jsonb_build_object('status', 'deleted', 'queue_rows', v_q, 'failures', v_f, 'send_log', v_l, 'email_events', v_e,
                            'free_slots_kept', least(2, v_free), 'last_quiz_year', v_year);
end;
$$;
revoke all on function public.wired_delete_family(uuid, text) from public, anon, authenticated;
grant execute on function public.wired_delete_family(uuid, text) to service_role;
