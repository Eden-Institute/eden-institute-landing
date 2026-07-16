-- Practitioner buildout Phase 0 (PD-3, second half): retire the drifting
-- free-text eden_constitution slugs and put the person side behind an FK to
-- eden_patterns. Live drift at migration time: person_profiles carried
-- 'pressure-cooker', 'the_pressure_cooker', and 'drawn-bowstring' side by
-- side; the marketing pipeline (quiz_completions.constitution_type → bridge
-- trigger) still writes un-prefixed kebab slugs, and the genuinely-balanced
-- path can leave axis-triple strings ('Hot / Damp / Tense'). This migration:
--   1. adds a canonicalizer that maps every historical slug shape to the
--      canonical snake_case slug (the_pressure_cooker),
--   2. normalizes the stored person-side values,
--   3. adds the FK on both person-side tables,
--   4. re-points the marketing→clinical bridge trigger through the
--      canonicalizer so future signups cannot re-introduce drift.
-- The marketing domain itself (quiz_completions, profiles.constitution_type)
-- is intentionally untouched per Lock #40 domain separation.

CREATE OR REPLACE FUNCTION public.eden_pattern_canonical_slug(raw text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  cleaned text;
  hit     text;
  axes    text[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;

  cleaned := lower(btrim(raw));

  -- Axis-triple form: 'hot / damp / tense' (quiz axis-label leakage).
  axes := regexp_match(cleaned, '^(hot|cold)\s*/\s*(damp|dry)\s*/\s*(tense|relaxed)$');
  IF axes IS NOT NULL THEN
    SELECT slug INTO hit
      FROM public.eden_patterns
     WHERE temperature = axes[1] AND moisture = axes[2] AND tone = axes[3];
    RETURN hit;
  END IF;

  -- Slug forms: 'pressure-cooker', 'the-pressure-cooker', 'pressure_cooker',
  -- 'the_pressure_cooker', 'The Pressure Cooker' → 'the_pressure_cooker'.
  cleaned := regexp_replace(cleaned, '^the[\s_-]+', '');
  cleaned := regexp_replace(cleaned, '[\s-]+', '_', 'g');

  SELECT slug INTO hit
    FROM public.eden_patterns
   WHERE slug = 'the_' || cleaned;

  RETURN hit;  -- NULL when unrecognized: callers must skip, never guess (Lock #39 posture)
END;
$$;

COMMENT ON FUNCTION public.eden_pattern_canonical_slug(text) IS
  'Maps any historical Eden Pattern slug shape (kebab/no-prefix marketing slugs, snake in-app slugs, axis-triple strings) to the canonical eden_patterns.slug. Returns NULL for unrecognized input so callers surface inconclusive rather than defaulting (Lock #39).';

-- 2. Normalize stored person-side values.
UPDATE public.person_profiles
   SET eden_constitution = public.eden_pattern_canonical_slug(eden_constitution)
 WHERE eden_constitution IS NOT NULL;

UPDATE public.diagnostic_completions
   SET eden_constitution = public.eden_pattern_canonical_slug(eden_constitution)
 WHERE eden_constitution IS NOT NULL;

-- 3. FK the person side to the canon (PD-3: "both person-side readings and
--    herb-side match/avoid FK to it").
ALTER TABLE public.person_profiles
  ADD CONSTRAINT person_profiles_eden_constitution_fkey
  FOREIGN KEY (eden_constitution) REFERENCES public.eden_patterns(slug);

ALTER TABLE public.diagnostic_completions
  ADD CONSTRAINT diagnostic_completions_eden_constitution_fkey
  FOREIGN KEY (eden_constitution) REFERENCES public.eden_patterns(slug);

-- 4. Marketing→clinical bridge normalizes at write time. Body is unchanged
--    from the shipped version except eden_constitution now flows through
--    eden_pattern_canonical_slug() and skips the write when unrecognized
--    (an FK violation here would break signup).
CREATE OR REPLACE FUNCTION public.tg_quiz_completion_sync_constitution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_slug    text;
BEGIN
  IF NEW.constitution_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- v3.33.2: also propagate first_name -> display_name where display_name is unset.
  -- COALESCE preserves any name the user has explicitly set (future signup-form name field).
  UPDATE public.profiles
     SET constitution_type = NEW.constitution_type,
         display_name = COALESCE(NULLIF(profiles.display_name, ''), NEW.first_name)
   WHERE email = NEW.email
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    v_slug := public.eden_pattern_canonical_slug(NEW.constitution_type);
    IF v_slug IS NOT NULL THEN
      UPDATE public.person_profiles
         SET eden_constitution = v_slug
       WHERE user_id = v_user_id AND is_self IS TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
