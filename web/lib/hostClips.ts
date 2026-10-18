// Podcast-host clips used as social proof (founder brief, 2026-10-17).
//
// Real recordings only: every clip is cut from the original episode file, with
// word-by-word captions and a host + show lower-third burned in. Nothing in these
// videos is AI-generated imagery. The cut list, times and caption checks live in
// the founder's ops folder (Host Montage/Site Clips/clips_site.json) and the
// Outreach Bible tab "Site Clips".
//
// 🛑 PERMISSION GATE. A clip renders on the LIVE site only when `permission` is
// true, and that is set only after Camila confirms the host said yes. Preview
// builds (Vercel preview, or HOST_CLIPS_PREVIEW=1 locally) show every clip with
// a "waiting on host OK" badge so the placements can be reviewed. If a placement
// has no permitted clip, it renders nothing at all.

export type HostClipKind = "endorsement" | "authority";

export interface HostClip {
  id: string;
  kind: HostClipKind;
  /** Who is speaking in the clip. */
  speaker: string;
  host: string;
  show: string;
  episodeTitle: string;
  /** Full-episode link, copied from the transcript header or the 10/07 credits guide. */
  episodeUrl: string;
  /** The words spoken, exactly as captioned. */
  quote: string;
  topic: string;
  /** Host was sent a free sample of Eden's Table (FTC disclosure). */
  sentSample: boolean;
  /** 🛑 Founder-confirmed host permission. */
  permission: boolean;
  /** File stem: <stem>_9x16.mp4, <stem>_16x9.mp4, <stem>_9x16_poster.jpg, <stem>_16x9_poster.jpg */
  file: string;
  seconds: number;
}

export interface Show {
  show: string;
  host: string;
  episodeTitle: string;
  episodeUrl: string;
}

/** Where the MP4s and posters are served from. Live: the site itself (public/host-clips). */
export const HOST_CLIP_BASE = "/host-clips/";

/**
 * Every show Camila has been a guest on whose full episode is public, with the
 * link checked live (HTTP 200) on 2026-10-17. Show names as Apple Podcasts lists
 * them. Macy's episode title is shortened on purpose: the full title calls Camila
 * an herbalist, and she is not one. Southern Appalachian Herbs (Judson Carroll,
 * Show 298) is left off on purpose: no clip from it, and the episode is largely
 * political with little Scripture (review note 2026-10-17, founder's call to add).
 */
export const SHOWS: Show[] = [
  { show: "Holy Ground Motherhood", host: "Julia Geiger", episodeTitle: "Reclaiming the Garden: Herbalism, Homeschooling, and Stewarding Our Design", episodeUrl: "https://www.youtube.com/watch?v=mwwvx6X9WRc" },
  { show: "Prayers for Parents", host: "Dr. Macy Bassler", episodeTitle: "Ep. 26: When Wonder Becomes Worship", episodeUrl: "https://podcasts.apple.com/us/podcast/26-when-wonder-becomes-worship-raising-kids-who-know/id1865618537?i=1000788835281" },
  { show: "Planted on Purpose", host: "Aurie Riley", episodeTitle: "For Moms, Biohacking Your Child's Education", episodeUrl: "https://podcasts.apple.com/us/podcast/for-moms-biohacking-your-childs-education/id1795364672?i=1000788744083" },
  { show: "Visibly Fit with Wendie Pett", host: "Wendie Pett, ND", episodeTitle: "Ep. 262: Christian Herbalism: What God's Creation Can Teach Us About Health", episodeUrl: "https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson" },
  { show: "Christian Wellness for Weary Women", host: "Cassie Hutton", episodeTitle: "Ep. 117: Functional Health Starts at Home Before You Reach for Another Remedy", episodeUrl: "https://cassiehutton27.podbean.com/e/ep-117-functional-health-starts-at-home-before-you-reach-for-another-remedy-with-camila-johnson/" },
  { show: "The Roaming Mama Podcast", host: "Lynn Benson", episodeTitle: "Learning to Notice: Faith, Nature & the Joy of Homeschooling", episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719" },
  { show: "Homeschooling Systems for ADHD Families", host: "Jenny Prior", episodeTitle: "Ep. 26: How Unit Studies & Interest-led Learning Help Kids Find Identity & Purpose", episodeUrl: "https://homeschoolingsystemsforadhdfamilies.podbean.com/e/26-how-unit-studies-interest-led-learning-help-kids-find-identity-purpose-a-chat-with-camila-johnson/" },
];

const SHOW_TITLE: Record<string, string> = Object.fromEntries(SHOWS.map((s) => [s.show, s.episodeTitle]));

// Written by scripts/host_clips/export_site_data.py from the clip manifest. Every quote is
// the exact caption text burned into that video. permission: true = founder confirmed the
// host said yes (all eight hosts, 2026-10-17).
export const HOST_CLIPS: HostClip[] = [
  { id: "E01", kind: "endorsement", speaker: "Wendie Pett, ND", host: "Wendie Pett, ND", show: "Visibly Fit with Wendie Pett", episodeTitle: SHOW_TITLE["Visibly Fit with Wendie Pett"], episodeUrl: "https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson", quote: "Well, I just love that you're doing this curriculum. I'm like, I got giddy when I opened up the sample. I'm like, what? This is so good. And I, you know, I'm picky.", topic: "Overall verdict on the sample, from a self-described picky reviewer", sentSample: true, permission: true, file: "E01_wendie_giddy", seconds: 12.2 },
  { id: "E02", kind: "endorsement", speaker: "Wendie Pett, ND", host: "Wendie Pett, ND", show: "Visibly Fit with Wendie Pett", episodeTitle: SHOW_TITLE["Visibly Fit with Wendie Pett"], episodeUrl: "https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson", quote: "I love that you bring Jesus to the curriculum. And you sent me a sample of your course, your curriculum, and it is so well done.", topic: "Is it biblically sound: Jesus in the curriculum; sample quality", sentSample: true, permission: true, file: "E02_wendie_jesus", seconds: 8.8 },
  { id: "E03", kind: "endorsement", speaker: "Wendie Pett, ND", host: "Wendie Pett, ND", show: "Visibly Fit with Wendie Pett", episodeTitle: SHOW_TITLE["Visibly Fit with Wendie Pett"], episodeUrl: "https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson", quote: "And I love just the flow and just the discovery sessions and just the kitchen labs. And I mean, each day is just full of quality teaching moments.", topic: "Daily flow, discovery sessions and kitchen labs", sentSample: true, permission: true, file: "E03_wendie_kitchen_labs", seconds: 13.9 },
  { id: "E16", kind: "endorsement", speaker: "Wendie Pett, ND", host: "Wendie Pett, ND", show: "Visibly Fit with Wendie Pett", episodeTitle: SHOW_TITLE["Visibly Fit with Wendie Pett"], episodeUrl: "https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson", quote: "I mean, I, you know, my kid's grown, but man, if I were doing homeschool with him, I would be all over this. This is so well done.", topic: "Would use it herself if homeschooling; quality", sentSample: true, permission: true, file: "E16_wendie_all_over_this", seconds: 11.6 },
  { id: "U06", kind: "authority", speaker: "Camila Johnson", host: "Wendie Pett, ND", show: "Visibly Fit with Wendie Pett", episodeTitle: SHOW_TITLE["Visibly Fit with Wendie Pett"], episodeUrl: "https://www.wendiepett.com/262-christian-herbalism-what-gods-creation-can-teach-us-about-health-camila-johnson", quote: "So before you even reach for an herb to fix something, how is your hydration? How are you eating? How are you sleeping? Are you resting? And are you spiritually aligned with your God?", topic: "Terrain: the basics before any herb (water, food, sleep, rest, spirit)", sentSample: true, permission: true, file: "U06_camila_basics_first", seconds: 12.5 },
  { id: "E04", kind: "endorsement", speaker: "Aurie Riley", host: "Aurie Riley", show: "Planted on Purpose", episodeTitle: SHOW_TITLE["Planted on Purpose"], episodeUrl: "https://podcasts.apple.com/us/podcast/for-moms-biohacking-your-childs-education/id1795364672?i=1000788744083", quote: "This plant connects just as much to what it says in Scripture and what that has to do with my life as the tea that I make from it.", topic: "Is it biblically sound: each plant tied to Scripture", sentSample: true, permission: true, file: "E04_aurie_scripture_plant", seconds: 8.3 },
  { id: "E05", kind: "endorsement", speaker: "Aurie Riley", host: "Aurie Riley", show: "Planted on Purpose", episodeTitle: SHOW_TITLE["Planted on Purpose"], episodeUrl: "https://podcasts.apple.com/us/podcast/for-moms-biohacking-your-childs-education/id1795364672?i=1000788744083", quote: "Ladies, wasn't today's conversation just so fun and educational? Camila's curriculum is just so cool.", topic: "Overall verdict: fun, natural learning", sentSample: true, permission: true, file: "E05_aurie_so_cool", seconds: 10.6 },
  { id: "E06", kind: "endorsement", speaker: "Aurie Riley", host: "Aurie Riley", show: "Planted on Purpose", episodeTitle: SHOW_TITLE["Planted on Purpose"], episodeUrl: "https://podcasts.apple.com/us/podcast/for-moms-biohacking-your-childs-education/id1795364672?i=1000788744083", quote: "But you know, it makes it so easy for children to learn. You've you've removed a lot of the learning barriers for children with this material because it engages all of their senses.", topic: "Will kids do it: easy to learn, engages all their senses", sentSample: true, permission: true, file: "E06_aurie_senses", seconds: 12.2 },
  { id: "U08", kind: "authority", speaker: "Camila Johnson", host: "Aurie Riley", show: "Planted on Purpose", episodeTitle: SHOW_TITLE["Planted on Purpose"], episodeUrl: "https://podcasts.apple.com/us/podcast/for-moms-biohacking-your-childs-education/id1795364672?i=1000788744083", quote: "But even if I stopped at fifth grade, guess what? My love for my kids would be the single biggest credential of why I'm qualified to teach my children. Nobody loves them more. Nobody sees what they're wired for more.", topic: "A parent's love is the biggest credential to teach her children", sentSample: true, permission: true, file: "U08_camila_qualified", seconds: 13.8 },
  { id: "E08", kind: "endorsement", speaker: "Dr. Macy Bassler", host: "Dr. Macy Bassler", show: "Prayers for Parents", episodeTitle: SHOW_TITLE["Prayers for Parents"], episodeUrl: "https://podcasts.apple.com/us/podcast/26-when-wonder-becomes-worship-raising-kids-who-know/id1865618537?i=1000788835281", quote: "Yeah, it really is such a beautiful, a beautiful curriculum, and I love the whole aspect of, like, me learning alongside my children.", topic: "Parent learns right alongside the children", sentSample: true, permission: true, file: "E08_macy_learning_alongside", seconds: 11.3 },
  { id: "E09", kind: "endorsement", speaker: "Dr. Macy Bassler", host: "Dr. Macy Bassler", show: "Prayers for Parents", episodeTitle: SHOW_TITLE["Prayers for Parents"], episodeUrl: "https://podcasts.apple.com/us/podcast/26-when-wonder-becomes-worship-raising-kids-who-know/id1865618537?i=1000788835281", quote: "And then also like the most important thing is like teaching this skill of wonder, of pointing it all back to God and, you know, showing that we're just stewards of the creation that he's given us.", topic: "Is it biblically sound: wonder that points back to God; stewardship", sentSample: true, permission: true, file: "E09_macy_wonder", seconds: 13.5 },
  { id: "U04", kind: "authority", speaker: "Camila Johnson", host: "Dr. Macy Bassler", show: "Prayers for Parents", episodeTitle: SHOW_TITLE["Prayers for Parents"], episodeUrl: "https://podcasts.apple.com/us/podcast/26-when-wonder-becomes-worship-raising-kids-who-know/id1865618537?i=1000788835281", quote: "Wonder, oh, well, I mean, there's nothing more worthy of wonder than God, right? Because there's so many mysteries and so many things that we don't know.", topic: "Biblical framework: nothing more worthy of wonder than God", sentSample: true, permission: true, file: "U04_camila_wonder", seconds: 13.9 },
  { id: "E10", kind: "endorsement", speaker: "Lynn Benson", host: "Lynn Benson", show: "The Roaming Mama Podcast", episodeTitle: SHOW_TITLE["The Roaming Mama Podcast"], episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719", quote: "I actually spent the past couple weeks doing this with my own children, and after getting to experience it in our home, I wanted to sit down and have a conversation with the woman behind it, not just about the curriculum itself, but about the heart behind it.", topic: "Will kids do it: the host taught it to her own children before the interview", sentSample: true, permission: true, file: "E10_lynn_own_children", seconds: 14.1 },
  { id: "E11", kind: "endorsement", speaker: "Lynn Benson", host: "Lynn Benson", show: "The Roaming Mama Podcast", episodeTitle: SHOW_TITLE["The Roaming Mama Podcast"], episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719", quote: "I think we did the chamomile. My kids loved it. They loved the drawing part of it. They loved the story part.", topic: "Will kids do it: her kids loved the drawing and the story", sentSample: true, permission: true, file: "E11_lynn_kids_loved_it", seconds: 10.1 },
  { id: "E12", kind: "endorsement", speaker: "Lynn Benson", host: "Lynn Benson", show: "The Roaming Mama Podcast", episodeTitle: SHOW_TITLE["The Roaming Mama Podcast"], episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719", quote: "They rated it a three star. We colored all three stars in because they were like, we love this. And then they asked for it the next day.", topic: "Will kids do it: three stars, and they asked for it the next day", sentSample: true, permission: true, file: "E12_lynn_asked_next_day", seconds: 8.1 },
  { id: "E13", kind: "endorsement", speaker: "Julia Geiger", host: "Julia Geiger", show: "Holy Ground Motherhood", episodeTitle: SHOW_TITLE["Holy Ground Motherhood"], episodeUrl: "https://www.youtube.com/watch?v=mwwvx6X9WRc", quote: "It's so well done and it's so easy to tack on to your day as a 15 minute way to slow down, connect with your kid and show them the intention that God made them and the world around them.", topic: "Easy to fit into the day; a way to slow down and connect", sentSample: true, permission: true, file: "E13_julia_slow_down", seconds: 14.1 },
  { id: "E14", kind: "endorsement", speaker: "Jenny Prior", host: "Jenny Prior", show: "Homeschooling Systems for ADHD Families", episodeTitle: SHOW_TITLE["Homeschooling Systems for ADHD Families"], episodeUrl: "https://homeschoolingsystemsforadhdfamilies.podbean.com/e/26-how-unit-studies-interest-led-learning-help-kids-find-identity-purpose-a-chat-with-camila-johnson/", quote: "But this has been so great to talk to you and hear more about your story. And I think that this curriculum, this, and this learning approach is really going to be helpful for kids and be something really fun they can do as a family.", topic: "Fun to learn together as a family", sentSample: false, permission: true, file: "E14_jenny_fun_as_family", seconds: 11.7 },
  { id: "E15", kind: "endorsement", speaker: "Cassie Hutton", host: "Cassie Hutton", show: "Christian Wellness for Weary Women", episodeTitle: SHOW_TITLE["Christian Wellness for Weary Women"], episodeUrl: "https://cassiehutton27.podbean.com/e/ep-117-functional-health-starts-at-home-before-you-reach-for-another-remedy-with-camila-johnson/", quote: "And it really is, as I was looking through it, it was like, this really is pick up and go. And so as a homeschool mom, that I am absolutely horrible at, I'm not gonna stick with a homeschool curriculum if it's not pick up and go.", topic: "Open and go: no planning needed", sentSample: true, permission: true, file: "E15_cassie_pick_up_and_go", seconds: 14.3 },
  { id: "U01", kind: "authority", speaker: "Camila Johnson", host: "Julia Geiger", show: "Holy Ground Motherhood", episodeTitle: SHOW_TITLE["Holy Ground Motherhood"], episodeUrl: "https://www.youtube.com/watch?v=mwwvx6X9WRc", quote: "So, a lot of science curriculum, they focus on the design. They focus on the creation. They focus on the what and how I focus on the designer, the creator, and the who.", topic: "Biblical framework: starts with the Designer, not just the design", sentSample: true, permission: true, file: "U01_camila_the_who", seconds: 15.6 },
  { id: "U02", kind: "authority", speaker: "Camila Johnson", host: "Lynn Benson", show: "The Roaming Mama Podcast", episodeTitle: SHOW_TITLE["The Roaming Mama Podcast"], episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719", quote: "And knowing that you were created for a purpose by a loving God and knowing how to care for your body, those are things that everybody should know regardless of who they're created to be.", topic: "Created for a purpose by a loving God; knowing how to care for your body", sentSample: true, permission: true, file: "U02_camila_created_for_purpose", seconds: 11.4 },
  { id: "U03", kind: "authority", speaker: "Camila Johnson", host: "Lynn Benson", show: "The Roaming Mama Podcast", episodeTitle: SHOW_TITLE["The Roaming Mama Podcast"], episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719", quote: "And the only difference is we don't worship the plants. So the whole curriculum is we steward the plants. We're thankful for the provision, but we give worship to God alone.", topic: "We steward the plants and give worship to God alone", sentSample: true, permission: true, file: "U03_camila_worship_god_alone", seconds: 13.1 },
  { id: "U05", kind: "authority", speaker: "Camila Johnson", host: "Julia Geiger", show: "Holy Ground Motherhood", episodeTitle: SHOW_TITLE["Holy Ground Motherhood"], episodeUrl: "https://www.youtube.com/watch?v=mwwvx6X9WRc", quote: "I wanted to create something that would be useful no matter how God designed them, right? Because whether you were going to be a plumber or a teacher or a mom or whatever God designed you, you're going to have to steward your health.", topic: "Stewardship: everyone has to steward their health, whatever God designed them for", sentSample: true, permission: true, file: "U05_camila_steward_your_health", seconds: 12.6 },
  { id: "U07", kind: "authority", speaker: "Camila Johnson", host: "Jenny Prior", show: "Homeschooling Systems for ADHD Families", episodeTitle: SHOW_TITLE["Homeschooling Systems for ADHD Families"], episodeUrl: "https://homeschoolingsystemsforadhdfamilies.podbean.com/e/26-how-unit-studies-interest-led-learning-help-kids-find-identity-purpose-a-chat-with-camila-johnson/", quote: "And there's nothing worse than sucking the fun out of the room when you're trying to teach somebody something, right? Like, I think the goal of us as parent educators is to create lifelong learners.", topic: "Why kids engage: keep the fun in it and raise lifelong learners", sentSample: false, permission: true, file: "U07_camila_lifelong_learners", seconds: 13.7 },
  { id: "U10", kind: "authority", speaker: "Camila Johnson", host: "Lynn Benson", show: "The Roaming Mama Podcast", episodeTitle: SHOW_TITLE["The Roaming Mama Podcast"], episodeUrl: "https://podcasts.apple.com/us/podcast/learning-to-notice-faith-nature-the-joy-of-homeschooling/id1873324343?i=1000790934719", quote: "I mean, there's there is no way that you can go into nature and you can learn about it and not see the fingerprint of God.", topic: "Nature study as worship: the fingerprint of God in creation", sentSample: true, permission: true, file: "U10_camila_fingerprint_of_god", seconds: 9.0 },
];

/**
 * Which clips go where (founder brief, 2026-10-17, placements in her order).
 * A placement with no permitted clip renders nothing on the live site.
 */
export const PLACEMENTS = {
  /** Homepage: one looping reel of the best 3-4, beside the hero (desktop) or under it (mobile). */
  homeHero: ["E10", "E01", "E08", "E06"] as string[],
  /** /homeschool closing price block (#pricing). Endorsements. */
  homeschoolPricing: ["E03", "E15", "E14"] as string[],
  /** /homeschool new FAQ: "Is this biblically sound?" */
  homeschoolBiblical: ["E02", "E04", "E09"] as string[],
  /** /homeschool new FAQ: "Will my kids actually do this?" */
  homeschoolKids: ["E11", "E12", "E06"] as string[],
  /** /books, beside the Sprouts buy box. One endorsement. */
  books: ["E16"] as string[],
  /** /freebies, beside the Week 1 sign-up buttons. One short clip, no more. */
  freebies: ["E12"] as string[],
  /** /back-to-eden (the adult page that replaced the retired course pages). Authority clips only. */
  backToEden: ["U06", "U02", "U10", "U04"] as string[],
};

export function isPreviewBuild(): boolean {
  const env = (typeof process !== "undefined" && process.env) || {};
  return env.VERCEL_ENV === "preview" || env.HOST_CLIPS_PREVIEW === "1";
}

/** The clips a placement may show in THIS build, in the order asked for. */
export function clipsFor(ids: string[]): HostClip[] {
  const preview = isPreviewBuild();
  return ids
    .map((id) => HOST_CLIPS.find((c) => c.id === id))
    .filter((c): c is HostClip => !!c && (c.permission || preview));
}

/** Every clip this build may show, optionally filtered by kind. */
export function allClips(kind?: HostClipKind): HostClip[] {
  const preview = isPreviewBuild();
  return HOST_CLIPS.filter((c) => (c.permission || preview) && (!kind || c.kind === kind));
}

export function clipUrls(c: HostClip) {
  const b = HOST_CLIP_BASE + c.file;
  return {
    v916: `${b}_9x16.mp4`,
    v169: `${b}_16x9.mp4`,
    p916: `${b}_9x16_poster.jpg`,
    p169: `${b}_16x9_poster.jpg`,
  };
}

/** The disclosure line, built from the clips actually on the page. */
export function disclosureFor(clips: HostClip[]): string {
  const names = [...new Set(clips.filter((c) => c.sentSample).map((c) => firstName(c.host)))];
  if (!names.length) return "";
  if (names.length === 1) {
    return `${names[0]} was sent a free sample of Eden's Table. The words are ${names[0]}'s own.`;
  }
  const list = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} were each sent a free sample of Eden's Table. Their words are their own.`;
}

function firstName(host: string): string {
  return host.replace(/^Dr\.\s+/, "").split(/\s+/)[0];
}
