-- Curriculum print orders: matte covers (founder decision 2026-09-25, "matte
-- everywhere").
--
-- Every Lulu project in Camila's account is set to a Matte cover, but the website's
-- print rail has sent GLOSS package ids since 2026-09-10 (the last segment of a
-- Lulu package id is the cover finish: G gloss, M matte). Found while building the
-- Back to Eden shop. Switching the Sprouts and Seedlings rows to the matte twin of
-- the same package: same trim, paper, binding and price on Lulu's spec sheet.
--
-- Only rows still on the old gloss id change. A row with a cached printable_id is
-- left alone by design: that id pins the files Lulu already has, and every row's
-- printable_id was NULL when this was written (checked 2026-09-25), so no row is
-- skipped today.

begin;

update public.lulu_printables
set pod_package_id = regexp_replace(pod_package_id, '\.GXX$', '.MXX'),
    updated_at     = now()
where band in ('sprouts', 'seedlings')
  and printable_id is null
  and pod_package_id in ('0850X1100.FC.STD.CO.080CW444.GXX', '0583X0827.FC.STD.PB.080CW444.GXX');

commit;
