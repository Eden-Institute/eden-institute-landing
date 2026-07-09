-- Practitioner buildout Phase 0 (Decisions Ledger PD-3): normalize The
-- Pattern of Eden into a reference table. The eight Patterns and their axis
-- coordinates are canonical per Manual §0.8 Pattern-of-Eden Lock:
-- Temperature × Moisture × Tone. Until now the canonical framework existed
-- only as free-text eden_constitution slugs (already drifting) while the
-- SECONDARY frameworks (doshas, tcm_patterns, constitutions) were fully
-- normalized. This table is the one authoritative home for the Eden lens
-- (TL-1); person-side readings and the herb-side match/avoid bridge both
-- FK to it.
--
-- Dual-source citations per Lock #43: public-domain primary (Cook 1869 —
-- the physiomedical tissue-condition framework natively carrying all three
-- axes: heat/cold, dryness/dampness, constriction/relaxation) + industry
-- secondary (Wood 2004 — the modern terrain-energetics standard). Both are
-- already in the sources canon (S23, S21).

CREATE TABLE IF NOT EXISTS public.eden_patterns (
  pattern_id  text PRIMARY KEY CHECK (pattern_id ~ '^EP[0-9]{2}$'),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL UNIQUE,
  temperature text NOT NULL CHECK (temperature IN ('hot',  'cold')),
  moisture    text NOT NULL CHECK (moisture    IN ('dry',  'damp')),
  tone        text NOT NULL CHECK (tone        IN ('tense','relaxed')),
  tagline     text NOT NULL,
  description text NOT NULL,
  primary_text_citation jsonb NOT NULL,
  secondary_citation    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temperature, moisture, tone)
);

COMMENT ON TABLE public.eden_patterns IS
  'Canonical Pattern of Eden reference — 8 Patterns on Temperature × Moisture × Tone (Manual §0.8 Lock). One home per lens (TL-1): this table owns the Eden lens the way doshas / tcm_patterns / constitutions(Western) own theirs. slug is the canonical snake_case person-side value (the_pressure_cooker); pattern_id (EP01–EP08) keys the herb bridge. Dual-source citations per Lock #43. Consumer surfaces keep saying "body pattern" per Lock #54.';

ALTER TABLE public.eden_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY eden_patterns_public_read
  ON public.eden_patterns FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.eden_patterns
  (pattern_id, slug, name, temperature, moisture, tone, tagline, description,
   primary_text_citation, secondary_citation)
VALUES
  ('EP01', 'the_burning_bowstring', 'The Burning Bowstring', 'hot', 'dry', 'tense',
   'You run hot, burn dry, and hold everything tight.',
   'Elevated metabolic heat with fluid deficit and constricted tissue. Presents as intensity, rapid oxidation, dryness of tissue, and nervous/muscular holding. Therapeutic direction: cool, moisten, relax.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP02', 'the_open_flame', 'The Open Flame', 'hot', 'dry', 'relaxed',
   'You burn bright and open — warm, expressive, and unguarded.',
   'Elevated heat with fluid deficit and lax tissue tone. Heat dissipates freely; tissues lack containment. Therapeutic direction: cool, moisten, tone (astringe).',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP03', 'the_pressure_cooker', 'The Pressure Cooker', 'hot', 'damp', 'tense',
   'You run hot, hold fluid, and clench tight. Pressure builds with no release valve.',
   'Elevated heat with fluid retention under constriction. Trapped heat and unresolved inflammation build internal pressure. Therapeutic direction: drain, cool, and release without added stimulation.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP04', 'the_overflowing_cup', 'The Overflowing Cup', 'hot', 'damp', 'relaxed',
   'You run warm, hold fluid, and everything spills over.',
   'Elevated heat with fluid excess and lax tissue. Warm abundance that leaks rather than holds — excess secretion, boggy tissue, sluggish elimination. Therapeutic direction: dry, cool, astringe.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP05', 'the_drawn_bowstring', 'The Drawn Bowstring', 'cold', 'dry', 'tense',
   'You run cold, dry, and tight — depleted but unable to rest.',
   'Depressed metabolic heat with fluid deficit and constricted tissue. Depletion held under tension; the system cannot rest or rebuild. Therapeutic direction: warm, moisten, relax.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP06', 'the_spent_candle', 'The Spent Candle', 'cold', 'dry', 'relaxed',
   'You have burned to the wick — cold, dry, and too exhausted to hold yourself together.',
   'Depressed heat with fluid deficit and lax tone. An exhaustion pattern: low reserves, atrophic dryness, weak containment. Therapeutic direction: warm, nourish, gently tone.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP07', 'the_frozen_knot', 'The Frozen Knot', 'cold', 'damp', 'tense',
   'You run cold, hold water, and lock everything down.',
   'Depressed heat with fluid retention under constriction. Stagnation locked down by tension — congestion that cannot move. Therapeutic direction: warm, move, decongest, relax.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}'),
  ('EP08', 'the_still_water', 'The Still Water', 'cold', 'damp', 'relaxed',
   'You run deep and slow — calm, patient, and unmoved.',
   'Depressed heat with fluid excess and lax tissue. A slow, congested, torpid pattern: retained fluid, low metabolic drive, weak tone. Therapeutic direction: warm, dry, stimulate, tone.',
   '{"source_id":"S23","author":"Cook, W.H.","title":"The Physiomedical Dispensatory","year":1869,"url":"https://www.henriettes-herb.com/eclectic/cook/","locator":"General therapeutic principles — tissue conditions of heat and cold, dryness and dampness, constriction (tension) and relaxation"}',
   '{"source_id":"S21","kind":"industry_textbook","author":"Wood, M.","title":"The Practice of Traditional Western Herbalism: Basic Doctrine, Energetics, and Classification","year":2004,"publisher":"North Atlantic Books","locator":"Terrain energetics — the heat/cold, damp/dry, tension/relaxation axes and their tissue states"}')
ON CONFLICT (pattern_id) DO NOTHING;
