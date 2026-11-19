-- ============================================================================
-- Fearfully & Wonderfully Wired, ticket W3: public.wired_submit(p jsonb).
--
-- Spec section 18 answer 9: ONE writer. A single SECURITY DEFINER function does the family
-- upsert, the free-slot claim (row lock on the family), the session and the results in one
-- transaction; wired-submit and wired-replay-failures both call it. Scoring, blending and
-- matching happen in the edge function (pure _shared/wired-engine.ts + wired-match.ts) and
-- arrive here as values.
--
-- Rules it enforces:
--   - one family per email (lower(email) unique), first name kept unless a new one is given;
--   - "2 children per email, ever" (DECIDED 11/17): a NEW child gets a free slot only while
--     free children + the tombstone's free_slots_used (answer 10) are under 2; a free slot is
--     never reassigned; a child past the limit is stored LOCKED (answers saved, 7.2);
--   - the same nickname in the same family is the same child (case-insensitive), so a
--     re-submission never burns a second free slot;
--   - one completed quiz per rater per child per year (the W1 unique index): a repeat
--     returns status 'already_completed' and writes nothing new;
--   - blend guard: the caller blended against the sessions it read
--     (results.expected_session_ids); if another rater finished in between, nothing is
--     written and status 'stale_blend' asks the caller to re-read and retry.
--
-- Returns jsonb {status: ok | already_completed | stale_blend | unknown_child, family_id,
-- child_id, session_id, unlocked, new_child}. Callable by service_role only.
-- ============================================================================

create or replace function public.wired_submit(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email     text := lower(btrim(coalesce(p->>'email', '')));
  v_year      integer := (p->>'quiz_year')::integer;
  v_family    uuid;
  v_child     uuid;
  v_session   uuid;
  v_nick      text;
  v_grade     integer;
  v_free_used integer;
  v_tomb      integer;
  v_free      boolean;
  v_new_child boolean := false;
  v_unlocked  text;
  v_pilot     boolean := coalesce((p->>'is_pilot_retake')::boolean, false);
  v_expected  uuid[];
  v_current   uuid[];
  v_weights   jsonb;
begin
  if v_email = '' or v_year is null then
    raise exception 'wired_submit: email and quiz_year are required' using errcode = '22023';
  end if;

  -- Family: one per email; then lock it so two submissions cannot both claim a free slot.
  insert into public.wired_families (email, first_name)
  values (v_email, nullif(btrim(coalesce(p->>'first_name', '')), ''))
  on conflict ((lower(email))) do update
    set first_name = coalesce(excluded.first_name, public.wired_families.first_name)
  returning id into v_family;
  perform 1 from public.wired_families where id = v_family for update;

  -- ── Mom's own (adult) set: no child; result goes to wired_family_results ──
  if p->'child' is null or jsonb_typeof(p->'child') = 'null' then
    begin
      insert into public.wired_sessions (family_id, child_id, rater_role, bank_version, quiz_year,
                                         raw_answers, scores, top3, renaissance, engine_version,
                                         attribution, started_at, completed_at)
      values (v_family, null, 'mom', p->>'bank_version', v_year,
              p->'raw_answers', p->'scores', array(select jsonb_array_elements_text(coalesce(p->'top3', '[]'::jsonb))),
              (p->>'renaissance')::boolean, p->>'engine_version',
              p->'attribution', nullif(p->>'started_at', '')::timestamptz, now())
      returning id into v_session;
    exception when unique_violation then
      return jsonb_build_object('status', 'already_completed', 'family_id', v_family);
    end;
    insert into public.wired_family_results (family_id, quiz_year, adult_scores, teaching_style, session_id, computed_at)
    values (v_family, v_year, p->'scores', p->'teaching_style', v_session, now())
    on conflict (family_id, quiz_year) do update
      set adult_scores = excluded.adult_scores, teaching_style = excluded.teaching_style,
          session_id = excluded.session_id, computed_at = now();
    return jsonb_build_object('status', 'ok', 'family_id', v_family, 'session_id', v_session);
  end if;

  -- ── Child quiz ──
  v_nick  := btrim(coalesce(p->'child'->>'nickname', ''));
  v_grade := (p->'child'->>'grade')::integer;

  if nullif(p->>'child_id', '') is not null then
    select id into v_child from public.wired_children
     where id = (p->>'child_id')::uuid and family_id = v_family and removed_at is null;
    if v_child is null then
      return jsonb_build_object('status', 'unknown_child', 'family_id', v_family);
    end if;
  else
    select id into v_child from public.wired_children
     where family_id = v_family and removed_at is null and lower(nickname) = lower(v_nick)
     order by created_at limit 1;
  end if;

  if v_child is null then
    select count(*) into v_free_used from public.wired_children where family_id = v_family and free_slot;
    select coalesce(max(free_slots_used), 0) into v_tomb from public.wired_tombstones where email_hash = p->>'email_hash';
    v_free := (v_free_used + v_tomb) < 2;
    insert into public.wired_children (family_id, nickname, grade, free_slot, unlocked_via, unlocked_at)
    values (v_family, v_nick, v_grade, v_free, case when v_free then 'free' end, case when v_free then now() end)
    returning id into v_child;
    v_new_child := true;
  else
    update public.wired_children set grade = v_grade where id = v_child and grade is distinct from v_grade;
  end if;

  -- Blend guard: the caller's blend must cover exactly the raters on record now.
  v_expected := coalesce(array(select (jsonb_array_elements_text(coalesce(p->'results'->'expected_session_ids', '[]'::jsonb)))::uuid order by 1), '{}');
  v_current  := coalesce(array(select id from public.wired_sessions
                                where child_id = v_child and quiz_year = v_year
                                  and completed_at is not null and not is_pilot_retake
                                order by id), '{}');
  if not v_pilot and v_current is distinct from v_expected then
    return jsonb_build_object('status', 'stale_blend', 'family_id', v_family, 'child_id', v_child, 'current', to_jsonb(v_current));
  end if;

  begin
    insert into public.wired_sessions (family_id, child_id, rater_role, observer_id, bank_version, quiz_year,
                                       grade_at_quiz, is_pilot_retake, raw_answers, scores, top3, renaissance,
                                       engine_version, family_answers, attribution, started_at, completed_at)
    values (v_family, v_child, coalesce(p->>'rater_role', 'mom'), nullif(p->>'observer_id', '')::uuid,
            p->>'bank_version', v_year, v_grade, v_pilot,
            p->'raw_answers', p->'scores', array(select jsonb_array_elements_text(coalesce(p->'top3', '[]'::jsonb))),
            (p->>'renaissance')::boolean, p->>'engine_version', p->'family_answers', p->'attribution',
            nullif(p->>'started_at', '')::timestamptz, now())
    returning id into v_session;
  exception when unique_violation then
    return jsonb_build_object('status', 'already_completed', 'family_id', v_family, 'child_id', v_child);
  end;

  -- Results: the blended profile including this rater (a pilot retake is kept for the
  -- reliability study only and never moves the results).
  if not v_pilot then
    v_weights := coalesce(p->'results'->'weights', '{}'::jsonb);
    if v_weights ? 'new' then
      v_weights := (v_weights - 'new') || jsonb_build_object(v_session::text, v_weights->'new');
    end if;
    insert into public.wired_results (child_id, quiz_year, blended_scores, top3, renaissance, weights,
                                      session_ids, matches_snapshot, engine_version, computed_at)
    values (v_child, v_year, p->'results'->'blended_scores',
            array(select jsonb_array_elements_text(coalesce(p->'results'->'top3', '[]'::jsonb))),
            coalesce((p->'results'->>'renaissance')::boolean, false), v_weights,
            v_expected || v_session, p->'results'->'matches_snapshot', p->'results'->>'engine_version', now())
    on conflict (child_id, quiz_year) do update
      set blended_scores = excluded.blended_scores, top3 = excluded.top3, renaissance = excluded.renaissance,
          weights = excluded.weights, session_ids = excluded.session_ids,
          matches_snapshot = excluded.matches_snapshot, engine_version = excluded.engine_version, computed_at = now();
  end if;

  select unlocked_via into v_unlocked from public.wired_children where id = v_child;
  return jsonb_build_object('status', 'ok', 'family_id', v_family, 'child_id', v_child, 'session_id', v_session,
                            'unlocked', v_unlocked is not null, 'new_child', v_new_child);
end;
$$;

revoke execute on function public.wired_submit(jsonb) from public, anon, authenticated;
grant execute on function public.wired_submit(jsonb) to service_role;
