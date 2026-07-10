-- Copy pass 2026-07-10: the launch-day feedback_areas seed shipped two Lock #54
-- violations ("Constitutional...") and one pre-terminology-decision label
-- ("Client Roster"). These labels render verbatim in the FeedbackButton area
-- picker for every user. area_key is the stable join key and does not change,
-- so submissions already filed keep their area.

UPDATE public.feedback_areas SET label = 'Pattern Quiz & Results'  WHERE area_key = 'assessment';
UPDATE public.feedback_areas SET label = 'Pattern–Herb Matching'   WHERE area_key = 'matching';
UPDATE public.feedback_areas SET label = 'Patient Roster & Notes'  WHERE area_key = 'clients';
