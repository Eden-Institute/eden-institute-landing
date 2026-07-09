-- Practitioner buildout Phase 1 (PD-4 curation, part 1 of 2): founder canon.
-- The 80 pattern-herb pairings shipped in the consumer quiz results
-- (src/lib/constitution-data.ts constitutionProfiles — founder-approved
-- copy) are authoritative. 27 of them computed as neutral/avoid under the
-- raw two-axis keyword algorithm (documented failure modes: mixed-
-- temperature prose classified by first keyword hit; nourishing tonics
-- indicated for deficiency/exhaustion "aggravating" tense depletion
-- patterns they classically remedy). Curation overrides them to match.

WITH founder(t, m, tn, slug) AS (VALUES
  ('hot','dry','tense','chamomile'),
  ('hot','dry','tense','california-poppy'),
  ('hot','dry','tense','marshmallow'),
  ('hot','dry','tense','lemon-balm'),
  ('hot','dry','tense','passionflower'),
  ('hot','dry','tense','skullcap'),
  ('hot','dry','tense','hawthorn'),
  ('hot','dry','tense','licorice'),
  ('hot','dry','tense','plantain'),
  ('hot','dry','tense','slippery-elm'),
  ('hot','dry','relaxed','witch-hazel'),
  ('hot','dry','relaxed','yarrow'),
  ('hot','dry','relaxed','raspberry-leaf'),
  ('hot','dry','relaxed','white-oak-bark'),
  ('hot','dry','relaxed','hibiscus'),
  ('hot','dry','relaxed','rose'),
  ('hot','dry','relaxed','lemon-balm'),
  ('hot','dry','relaxed','elder'),
  ('hot','dry','relaxed','plantain'),
  ('hot','dry','relaxed','chamomile'),
  ('hot','damp','tense','dandelion'),
  ('hot','damp','tense','linden'),
  ('hot','damp','tense','calendula'),
  ('hot','damp','tense','burdock'),
  ('hot','damp','tense','motherwort'),
  ('hot','damp','tense','skullcap'),
  ('hot','damp','tense','cleavers'),
  ('hot','damp','tense','nettle'),
  ('hot','damp','tense','chamomile'),
  ('hot','damp','tense','yarrow'),
  ('hot','damp','relaxed','calendula'),
  ('hot','damp','relaxed','sage'),
  ('hot','damp','relaxed','oregon-grape'),
  ('hot','damp','relaxed','raspberry-leaf'),
  ('hot','damp','relaxed','dandelion'),
  ('hot','damp','relaxed','cleavers'),
  ('hot','damp','relaxed','plantain'),
  ('hot','damp','relaxed','yarrow'),
  ('hot','damp','relaxed','white-oak-bark'),
  ('hot','damp','relaxed','thyme'),
  ('cold','dry','tense','ashwagandha'),
  ('cold','dry','tense','valerian'),
  ('cold','dry','tense','oat-straw'),
  ('cold','dry','tense','marshmallow'),
  ('cold','dry','tense','cinnamon'),
  ('cold','dry','tense','licorice'),
  ('cold','dry','tense','chamomile'),
  ('cold','dry','tense','lemon-balm'),
  ('cold','dry','tense','hawthorn'),
  ('cold','dry','tense','schisandra'),
  ('cold','dry','relaxed','ashwagandha'),
  ('cold','dry','relaxed','nettle'),
  ('cold','dry','relaxed','astragalus'),
  ('cold','dry','relaxed','marshmallow'),
  ('cold','dry','relaxed','licorice'),
  ('cold','dry','relaxed','oat-straw'),
  ('cold','dry','relaxed','shatavari'),
  ('cold','dry','relaxed','cinnamon'),
  ('cold','dry','relaxed','rehmannia'),
  ('cold','dry','relaxed','raspberry-leaf'),
  ('cold','damp','tense','ginger'),
  ('cold','damp','tense','valerian'),
  ('cold','damp','tense','prickly-ash'),
  ('cold','damp','tense','cramp-bark'),
  ('cold','damp','tense','rosemary'),
  ('cold','damp','tense','angelica'),
  ('cold','damp','tense','cinnamon'),
  ('cold','damp','tense','thyme'),
  ('cold','damp','tense','juniper-berry'),
  ('cold','damp','tense','black-pepper'),
  ('cold','damp','relaxed','ginger'),
  ('cold','damp','relaxed','rosemary'),
  ('cold','damp','relaxed','astragalus'),
  ('cold','damp','relaxed','cinnamon'),
  ('cold','damp','relaxed','sage'),
  ('cold','damp','relaxed','prickly-ash'),
  ('cold','damp','relaxed','juniper-berry'),
  ('cold','damp','relaxed','thyme'),
  ('cold','damp','relaxed','elecampane'),
  ('cold','damp','relaxed','bayberry')
),
resolved AS (
  SELECT h.herb_id, ep.pattern_id
    FROM founder f
    JOIN public.herbs h
      ON regexp_replace(lower(h.common_name), '[^a-z0-9]+', '-', 'g') = f.slug
    JOIN public.eden_patterns ep
      ON ep.temperature = f.t AND ep.moisture = f.m AND ep.tone = f.tn
)
UPDATE public.herbs_eden_patterns hep
   SET relationship = 'match',
       derivation   = 'curated',
       rationale    = concat_ws(' | ',
         'Founder-approved pattern-herb pairing (constitution-data.ts canon, shipped quiz results)',
         hep.rationale),
       updated_at   = now()
  FROM resolved r
 WHERE hep.herb_id = r.herb_id
   AND hep.pattern_id = r.pattern_id;
