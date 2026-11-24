-- public.podcast_appearances: every podcast episode Camila has been a guest on, for /as-heard-on (punch #474).
--
-- Camila's taps 2026-11-24 (Lane 2): "Small table (Recommended)" = the As Heard On list lives here, one row per
-- aired episode, so a new airing is one row and no code change; "Leave it off" = Southern Appalachian Herbs stays
-- off the page (as decided 2026-10-17); "Add all 10" + the three name picks for the rows below.
-- The page (web/pages/as-heard-on.astro) reads published rows at build time, and its AsHeardOnLive island reads
-- them again in the browser, so a row added here shows on the live page at once.
--
-- To add an episode when it airs (podcast lane): open the episode page first and copy the exact title, the host
-- as the show credits them, and the date the page shows. Titles follow the page's style: "Ep. N: Title", without
-- "with Camila Johnson". Then, through the Management API (service role):
--   insert into public.podcast_appearances (show, host, episode_title, episode_url, aired_on)
--   values ('Show', 'Host', 'Ep. N: Title', 'https://...', 'YYYY-MM-DD');
-- To take one down without deleting it: update ... set published = false where id = '...';
-- The 8 shows that have host clips must keep their show names exactly as web/lib/hostClips.ts spells them, or
-- their clips stop showing.

create table if not exists public.podcast_appearances (
  id uuid primary key default gen_random_uuid(),
  show text not null check (length(btrim(show)) > 0),
  host text not null check (length(btrim(host)) > 0),
  episode_title text not null check (length(btrim(episode_title)) > 0),
  episode_url text not null unique check (episode_url ~ '^https://'),
  aired_on date not null,
  published boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.podcast_appearances is
  'Every aired podcast episode Camila was a guest on; /as-heard-on lists the published rows, newest first (punch #474).';

alter table public.podcast_appearances enable row level security;

-- The site reads the list as anon (build) and in visitors' browsers; edge functions and lanes write as service_role.
grant select on table public.podcast_appearances to anon, authenticated;
grant select, insert, update, delete on table public.podcast_appearances to service_role;

drop policy if exists podcast_appearances_public_read on public.podcast_appearances;
create policy podcast_appearances_public_read on public.podcast_appearances
  for select to anon, authenticated using (published);

-- Every link below was opened 2026-11-24 (HTTP 200, the right episode title) and aired_on is the date on that
-- episode page. The first 8 are the shows the page already listed (web/lib/hostClips.ts SHOWS, unchanged).
insert into public.podcast_appearances (show, host, episode_title, episode_url, aired_on) values
  ('Holy Ground Motherhood', 'Julia Geiger', 'Reclaiming the Garden: Herbalism, Homeschooling, and Stewarding Our Design', 'https://www.youtube.com/watch?v=mwwvx6X9WRc', '2026-10-13'),
  ('Prayers for Parents', 'Dr. Macy Bassler', 'Ep. 26: When Wonder Becomes Worship', 'https://podcasts.apple.com/us/podcast/26-when-wonder-becomes-worship-raising-kids-who-know/id1865618537?i=1000788835281', '2026-09-10'),
  ('Planted on Purpose', 'Aurie Riley', 'For Moms, Biohacking Your Child''s Education', 'https://podcasts.apple.com/us/podcast/for-moms-biohacking-your-childs-education/id1795364672?i=1000788744083', '2026-09-09'),
  ('Visibly Fit with Wendie Pett', 'Wendie Pett, ND', 'Ep. 262: Christian Herbalism: What God''s Creation Can Teach Us About Health', 'https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson', '2026-09-28'),
  ('Christian Wellness for Weary Women', 'Cassie Hutton', 'Ep. 117: Functional Health Starts at Home Before You Reach for Another Remedy', 'https://cassiehutton27.podbean.com/e/ep-117-functional-health-starts-at-home-before-you-reach-for-another-remedy-with-camila-johnson/', '2026-09-29'),
  ('The Roaming Mama Podcast', 'Lynn Benson', 'Learning to Notice: Faith, Nature & the Joy of Homeschooling', 'https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719', '2026-09-21'),
  ('Homeschooling Systems for ADHD Families', 'Jenny Prior', 'Ep. 26: How Unit Studies & Interest-led Learning Help Kids Find Identity & Purpose', 'https://homeschoolingsystemsforadhdfamilies.podbean.com/e/26-how-unit-studies-interest-led-learning-help-kids-find-identity-purpose-a-chat-with-camila-johnson/', '2026-09-30'),
  ('Gardens in Babylon', 'Kevin Minnett', 'God’s Medicine Cabinet: Rediscovering Herbs for Your Health', 'https://podcasts.apple.com/us/podcast/gods-medicine-cabinet-rediscovering-herbs-for-your/id1892034341?i=1000796364010', '2026-10-14'),
  ('Home(school) with Steph', 'Steph', 'Ep. 93: Why This Former Teacher Quit Teaching to the Test and Started Teaching Herbs', 'https://podcasts.apple.com/us/podcast/93-why-this-former-teacher-quit-teaching-to-the-test/id1777305995?i=1000799618116', '2026-11-03'),
  ('The Motherhood Experience', 'Val Kleppen', 'From Toxic Upbringing to Healthy Learning', 'https://podcasts.apple.com/us/podcast/from-toxic-upbringing-to-healthy-learning-with-camila/id1703142839?i=1000802412152', '2026-11-17'),
  ('Healing Anxiety for Christian Moms', 'Hannah Flagg', 'Ep. 28: The Truth About Herbalism That Christian Moms Need to Hear', 'https://thehopefulpostpartummom.podbean.com/e/the-truth-about-herbalism-that-christian-moms-need-to-hear-with-guest-camila-johnson/', '2026-11-13'),
  ('Fuel Your Dreams with Jamie Hass & Patricia Lambert', 'Jamie Hass and Patricia Lambert', 'S04 E13: Launching Business, Stepping Out in Faith', 'https://podcasts.apple.com/us/podcast/s04-e13-launching-business-stepping-out-in-faith-with/id1715368323?i=1000803538635', '2026-11-23'),
  ('A More Beautiful Life Collective Podcast', 'Cayce Fletcher', 'S4E11: Cultivating Wonder Through Homeschooling & Nature Study', 'https://podcasts.apple.com/us/podcast/s4e11-cultivating-wonder-through-homeschooling-nature/id1694072670?i=1000801187964', '2026-11-11'),
  ('Sunshine Café: Stories to Encourage & Inspire', 'Lisa Roers', 'Ep. 153: Are We Being Brainwashed About Natural Health?', 'https://podcasts.apple.com/us/podcast/153-are-we-being-brainwashed-about-natural-health-wtih/id1718168011?i=1000801920372', '2026-11-14'),
  ('Homeschooling For Catholic Parents', 'Maeve and Mat Jemison', 'Ep. 140: Reading Aloud, Nature & Raising Kids Who Love to Learn', 'https://www.buzzsprout.com/2306441/episodes/19976952-140-reading-aloud-nature-raising-kids-who-love-to-learn-with-camila-johnson', '2026-10-18'),
  ('Grace Rooted Wellness', 'Melissa Ticer', 'Herbalism for Kids: A Hands-On Way to Learn Science, History, Math & More', 'https://rss.com/podcasts/gracerootedwellness/3235291/', '2026-10-15'),
  ('Women Soaring: Wherever You''re Sent', 'the Women Soaring team', 'Rooted in Creation: Herbalism for the Homeschool Family', 'https://podcasts.apple.com/us/podcast/rooted-in-creation-herbalism-for-the-homeschool/id1471289963?i=1000799585181', '2026-11-03'),
  ('Vintage Homeschool Moms', 'Felice Gerwitz', 'Biblical Herbalism for Kids: Teaching God’s Design One Plant at a Time', 'https://podcasts.apple.com/us/podcast/biblical-herbalism-for-kids-teaching-gods-design-one/id717402509?i=1000793516688', '2026-10-06')
on conflict (episode_url) do nothing;
