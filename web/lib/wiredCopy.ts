// Fearfully & Wonderfully Wired: the words on /wired and /wired/results (W4).
//
// Every string here is Camila's APPROVED copy, word for word:
//   - docs/wired-copy/Wired_Quiz_Results_Page_Copy.md (approved 2026-11-19 11:20 AM CT; the later $28 upgrade
//     approved 2026-11-21 ~8:52 AM CT)
//   - docs/wired-copy/Wired_Quiz_Resource_Guide_Copy.md section 2 (approved 2026-11-19 10:50 PM CT): the
//     "Helpful extras section" words and the "Screen-based" label (the same strings the Curriculum Finder shows)
//   - docs/wired-copy/Wired_Quiz_Family_Questions.md (approved 2026-11-19 8:47 AM CT)
//   - docs/wired-copy/Wired_Quiz_Family_Map_And_Screens.md section 1 (quiz screens, approved
//     2026-11-19 2:19 PM CT)
//   - the 9 write-ups: web/lib/wiredWriteups.ts (generated from the approved file)
// Placeholders: {name} = [Nickname], {wiring} = [Wiring], {approach} = [Approach],
// {description} = [its one-line description], {a} {b} {c} = [A] [B] [C], {state} = [State].
// src/test/wiredCopy.test.ts puts each placeholder back and checks the string is in the approved
// file, so an edit here that the approved file does not have fails CI. Rule 1: no "learning style",
// "learns best", "diagnose" or "assessment shows" (checked too). No em dashes.

import type { Domain } from "../../supabase/functions/_shared/wired-engine";

/** The screens around the questions (screens file section 1). */
export const SCREENS = {
  welcomeTitle: "Fearfully & Wonderfully Wired",
  welcomeVerse: "\"I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works\" (Psalm 139:14)",
  welcomeBody: "God made your child on purpose. This free quiz takes about 8 minutes and helps you see how your child is wired right now: the strengths and interests they reach for most, the places they're still growing, and curriculum that fits them and your real life.",
  welcomeNote: "You answer for your child. It isn't a test, and there are no wrong answers.",
  welcomeButton: "Start the quiz",
  welcomeSmall: "Free results for up to 2 children per email.",
  childHeading: "Tell us about your child",
  nicknameLabel: "Nickname (a first name or a nickname is fine, no last names)",
  gradeLabel: "Grade this school year (K to 12)",
  gradeHelper: "We use the grade to pick the right questions.",
  next: "Next",
  part1: "Part 1 of 3: Everyday moments (12 quick picks)",
  part2: "Part 2 of 3: How often (9 quick taps)",
  part3: "Part 3 of 3: About your family (6 questions, then what matters most to you)",
  beforeEmail: "All done! Where should we send {name}'s results?",
  anotherChild: "Take it for another child",
  anotherChildFree: "Your 2nd child's results are free too.",
  anotherChildPaid: "Results for a 3rd child unlock with a Blueprint or the Family Map.",
} as const;

export const RESULTS = {
  heading: "How God wired {name}",
  intro: "Here's what you see in {name} right now: strengths and interests, not a test score. Kids grow and change, so each July we'll invite you back to take it again.",
  top3Heading: "{name}'s top 3 wirings",
  renaissance: "{name} has a Renaissance profile: five or more wirings sit close together right now. That's a gift. Many doors are open, so follow the ones that light {name} up.",
  chartHeading: "All 9 wirings",
  chartCaption: "The longest bars show what {name} reaches for most right now. The shortest are growing edges: places to steward and help grow.",
  seekerNote: "Seeker is the most debated of the nine. We include it because Scripture cares about a child's heart for the big questions.",
  matchesHeading: "Curriculum matches for {name}",
  matchesIntro: "Sorted by what you said matters most. Every curriculum here was looked over by Camila, and affiliate links never change the order.",
  filterBudget: "Only show options within my budget",
  filterChristian: "Only show Christian curricula",
  filterEsa: "Only show ESA-eligible options",
  emailStep: "We'll email your results and a few helpful notes. Unsubscribe anytime.",
  emailLabel: "Email",
  firstNameLabel: "First name (optional)",
  emailButton: "Show my results",
  thirdChild: "{name}'s top wiring is {wiring}. Your quiz includes free results for 2 children, so to see {name}'s full results, unlock them with a Blueprint ($19) or the Family Map ($47).",
  thirdChildBlueprint: "Unlock with a Blueprint ($19)",
  thirdChildFamilyMap: "Unlock with the Family Map ($47)",
  savingFailed: "We saved your answers. Your results are on their way by email.",
  approachHeading: "Approaches with room for {name}'s wiring",
  approachLine: "{approach}: {description} It gives room to {name}'s {a} and {b} sides.",
  approachAlreadyThere: "You're already there. Keep going.",
  approachWorthALook: "Worth a look alongside what you do now. You don't have to switch to give these strengths room.",
  approachNote: "This is about giving strengths room, not about how {name} learns. Kids tend to pay closer attention and stick with things longer when they care about the topic.",
  tipsHeading: "3 things to try this week",
  comingSoon68: "Eden's Table for grades 6-8 is on the way, made the same Charlotte Mason way as our K-5 sets. Join the waitlist and be the first to know.",
  comingSoonLabel: "Coming soon",
  blueprintOffer: "Want a plan built around {name}? The Learner Blueprint turns these results into a subject-by-subject plan, a daily rhythm that fits your home, growing edges to steward, curriculum matches for each subject, and a page to help you pray for {name}.",
  blueprintObservers: "Add up to 3 more people who know {name} (dad, a grandparent, a co-op teacher), and we'll send an updated PDF when they answer.",
  blueprintButton: "Get {name}'s Blueprint ($19)",
  blueprintSmall: "Instant PDF download. Because it's digital, all sales are final.",
  familyMapOffer: "Teaching more than one? The Family Learning Map includes a full Blueprint for each child, plus your own teaching wiring, how to teach your kids together, a family weekly rhythm, and how your children's wirings work with each other.",
  familyMapButton: "Get the Family Map ($47 for up to 5 kids)",
  familyMapSmall: "+$10 for each child after 5. Instant PDF download. Because it's digital, all sales are final.",
  /** The later $28 upgrade (approved 2026-11-21): {name} = the child whose Blueprint she already has. */
  familyMapUpgradeLine: "You already have {name}'s Blueprint, so the Family Map is $28 for you this school year.",
  familyMapUpgradeButton: "Upgrade to the Family Map ($28)",
  /** The coming-soon line's button (results copy section 5). */
  waitlistButton: "Join the waitlist",
  /** Helpful extras (spec answer 38; Resource Guide copy section 2 "Helpful extras section" + its labels). */
  extrasHeading: "Helpful extras",
  extrasLine: "Apps, videos, songs and books that can sit alongside a curriculum. Not a full curriculum on their own.",
  screenBased: "Screen-based",
  notDiagnosticHeading: "What this quiz is, and isn't",
  notDiagnostic: [
    "This quiz shows the strengths and interests you notice in {name} right now. It is not a diagnostic tool. It doesn't measure intelligence, it isn't a test score, and it can't find or rule out a learning difference, an attention issue or anything medical.",
    "It also doesn't sort {name} into a type or tell you how {name} takes in information. Research hasn't found that matching teaching to a child's type helps children learn more.",
    "Kids grow and change, especially in the teen years, so treat this as a snapshot and take it again each July.",
  ],
  evaluationHeading: "When to look into an evaluation",
  evaluation: [
    "Every child struggles sometimes. Talk with {name}'s doctor if {name} keeps having a hard time for months, even with steady teaching, with things like reading, spelling or sounding out words, math, following directions, staying focused, or getting organized. Do the same if you notice speech, hearing or vision concerns, or your mom gut says something is off. Experts say getting help early is best.",
    "At well visits, ask whether {name} is due for the routine vision and hearing checks.",
    "Under federal law, public school districts must find and evaluate children who may have a disability, at no cost to parents. Whether that includes homeschooled children depends on your state, so call your local school district and ask. Nobody can make you agree to an evaluation.",
  ],
  affiliateNote: "Some of these links pay Eden a commission if you buy. That never changes which curricula show up or the order they're in.",
  affiliateLabel: "Eden earns a commission",
  privacyShort: "We keep {name}'s nickname, grade and quiz year, your answers and the scores, saved under your email. No login, no full names, no birthdays. Delete it all anytime with the link at the bottom of any learner email.",
} as const;

/** Grades 9-12 coming-soon line: the approved 6-8 line "with 'grades 9-12'" (results copy section 5). */
export const COMING_SOON_912 = RESULTS.comingSoon68.replace("grades 6-8", "grades 9-12");

/** Approach names + one-line descriptions (results copy section 2). Interest-led and online are never matched. */
export const APPROACHES: Record<string, { name: string; description: string }> = {
  charlotte_mason: { name: "Charlotte Mason", description: "Living books, narration, nature study, art and music, in short lessons." },
  classical: { name: "Classical", description: "Learning in stages, with memory work, great books and lots of good questions." },
  traditional: { name: "Traditional / textbook", description: "Clear lessons in order, with a textbook and workbook for each subject that a child can work through on their own." },
  unit_study: { name: "Unit study", description: "One theme ties many subjects together, often with projects the whole family does at once." },
  literature: { name: "Literature-based", description: "Great books carry history, reading and more." },
  montessori: { name: "Montessori", description: "Hands-on materials and child-led work in a calm, ordered space." },
  waldorf: { name: "Waldorf", description: "Art, music, handwork and the rhythm of the seasons." },
  eclectic: { name: "Eclectic / mixed", description: "Mix and match from several approaches. Often the best fit for a Renaissance profile, where many wirings are strong at once." },
};

export type TipKind = "try_today" | "low_prep" | "together";
export const TIP_LABELS: Record<TipKind, string> = {
  try_today: "Try today",
  low_prep: "Low prep or free",
  together: "Together, or choosing curriculum",
};

/** 3 tips per wiring (results copy section 3). */
export const TIPS: Record<Domain, Record<TipKind, string>> = {
  storyteller: {
    try_today: "Read aloud together tonight, then ask {name} to tell the story back in their own words.",
    low_prep: "Keep a library basket by the couch and a notebook that's just theirs. Words cost almost nothing and need almost no prep.",
    together: "Look for curriculum built on real books and narration. Siblings can share the read-aloud, and {name} can be the one who tells it back.",
  },
  organizer: {
    try_today: "Give {name} a real job that needs order: the pantry shelf, the chore chart, or this week's school checklist.",
    low_prep: "Card games, dominoes and puzzles count as math practice, and most homes already have them.",
    together: "Look for curriculum that shows the why behind each step. With siblings, let {name} keep the schedule or the score.",
  },
  designer: {
    try_today: "Hand {name} paper and colored pencils during read-aloud, and let them sketch what they hear.",
    low_prep: "Blocks, Legos, a sketchbook and the backyard make a free design studio. Ask for a map of your street or a plan for their room.",
    together: "Look for curriculum with maps, diagrams, timelines and drawing built in. Siblings can build a project while {name} draws the plan.",
  },
  maker: {
    try_today: "Before seatwork, let {name} move: a lap around the yard, kneading dough, or building the lesson with their hands.",
    low_prep: "Cooking, fixing, gardening and chores are hands-on lessons that cost nothing extra. Measure the recipe, count the screws.",
    together: "Look for curriculum with experiments, projects and things to build, not only worksheets. Makers often lead the hands-on part for younger siblings.",
  },
  psalmist: {
    try_today: "Put a Bible verse or a list you're learning to a simple tune, and let {name} sing it back to you.",
    low_prep: "Play hymns or classical music while you work. A free playlist and an old hymnal are all you need.",
    together: "Look for curriculum with songs, poems and rhythm in it. The whole family can sing the same verse together.",
  },
  connector: {
    try_today: "Let {name} teach you or a sibling what they just learned. Connectors light up when there's someone to share it with.",
    low_prep: "A weekly park day, co-op or library group gives a Connector time with people without adding prep for you.",
    together: "Look for curriculum you can do together at the table, with discussion and group projects. Connectors are often the glue between siblings.",
  },
  ponderer: {
    try_today: "After a lesson, give {name} a few quiet minutes to think or journal before you ask questions.",
    low_prep: "A notebook and a cozy corner cost almost nothing. Ponderers often do their deepest thinking alone.",
    together: "Look for curriculum with short lessons and room for independent work. With siblings, give {name} a quiet spot for part of the day.",
  },
  cultivator: {
    try_today: "Take today's lesson outside: a nature walk, a leaf to identify, a bird to look up together.",
    low_prep: "Your backyard, a window bird feeder and a library field guide make a free science lab.",
    together: "Look for curriculum with nature study, gardening or animals built in. Siblings of every age can share one nature walk and journal at their own level.",
  },
  seeker: {
    try_today: "Start a wondering list for {name}'s big questions, and look for answers in Scripture together.",
    low_prep: "Your Bible, a few great books and good talks at the table cost nothing and feed a Seeker well.",
    together: "Look for curriculum that talks about the why: worldview, character and the Bible's big story. Family devotions can be where {name} asks the questions.",
  },
};

/** "Matched because..." reason lines (results copy section 4), joined by " · ". */
export const REASONS = {
  wiring3: "Serves all 3 of {name}'s top wirings: {a}, {b} and {c}",
  wiring2: "Serves 2 of {name}'s top 3: {a} and {b}",
  wiring1: "Serves {name}'s {a} side",
  budgetFree: "Free",
  budgetWithin: "Within your budget",
  budgetOver: "A little over your budget",
  prep: {
    open_and_go: "Open-and-go: about 10 minutes of prep a day",
    light: "Light prep: about 10 to 20 minutes a day",
    moderate: "Moderate prep: about 20 to 45 minutes a day",
    heavy: "More planning: 45 minutes or more a day, or weekly planning",
  } as Record<string, string>,
  prepOver: "(a little more prep than you said you have)",
  siblings: "Works for several ages together",
  esa: "ESA-eligible in {state}",
} as const;

// ── Family questions + ranking (Wired_Quiz_Family_Questions.md) ──
export const FAMILY_INTRO = "A few quick questions about your family, so the curriculum matches fit your real life, not just your child.";

export interface FamilyQuestion {
  key: "kids" | "prep" | "frustration" | "approach" | "budget" | "esa";
  question: string;
  helper?: string;
  options: [string, string][]; // [code, label]
}

export const FAMILY_QUESTIONS: FamilyQuestion[] = [
  { key: "kids", question: "How many children are you homeschooling this year?", options: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5plus", "5 or more"]] },
  {
    key: "prep", question: "On a typical day, how much time can you spend getting lessons ready?", helper: "Not the teaching, just the prep.",
    options: [["open_and_go", "10 minutes or less: I need open-and-go"], ["light", "About 10 to 20 minutes"], ["moderate", "About 20 to 45 minutes"], ["heavy", "45 minutes or more, or I like to plan ahead each week"]],
  },
  {
    key: "frustration", question: "What's your biggest homeschool frustration right now?",
    options: [["time", "Finding time to plan and prepare"], ["engagement", "Keeping my child interested"], ["multi_age", "Teaching more than one age at once"], ["enough", "Wondering if we're doing enough"], ["budget", "Finding curriculum that fits our budget"], ["choosing", "Picking the right curriculum in the first place"], ["other", "Something else"]],
  },
  {
    key: "approach", question: "How would you describe the way you homeschool right now?", helper: "Pick the closest one.",
    options: [
      ["classical", "Classical: learning in stages, lots of memory work and great books"],
      ["charlotte_mason", "Charlotte Mason: living books, nature study, narration, short lessons"],
      ["traditional", "Traditional: textbooks and workbooks, like school at home"],
      ["unit_study", "Unit studies: one theme ties many subjects together"],
      ["literature", "Literature-based: we learn through great books"],
      ["montessori", "Montessori: hands-on materials and child-led work"],
      ["waldorf", "Waldorf: arts, rhythm and imagination"],
      ["interest_led", "Interest-led: we follow my child's interests"],
      ["online", "Online or video lessons"],
      ["eclectic", "A mix of several"],
      ["starting", "We're just getting started"],
      ["unsure", "Not sure yet"],
    ],
  },
  {
    key: "budget", question: "About how much do you plan to spend on curriculum for this child this year?", helper: "All subjects together.",
    options: [["free", "Free options only"], ["under_100", "Under $100"], ["100_300", "$100 to $300"], ["300_600", "$300 to $600"], ["600_1000", "$600 to $1,000"], ["over_1000", "More than $1,000"], ["unsure", "Not sure yet"]],
  },
  {
    key: "esa", question: "Are you using ESA or scholarship funds for curriculum this year?", helper: "ESA = a state education savings account.",
    options: [["yes", "Yes"], ["planning", "Not yet, but I plan to"], ["no", "No"], ["unsure", "I'm not sure what that is"]],
  },
];

export const RANKING = {
  title: "What matters most to you right now?",
  body: "Tap these in order, most important first. We'll use your order to sort {name}'s curriculum matches.",
  options: [
    ["wiring", "A great fit for how God wired {name}"],
    ["budget", "Staying within my budget"],
    ["prep", "Open-and-go: little prep for me"],
    ["siblings", "Teaching several of my kids together"],
  ] as [string, string][],
  after: "Your top pick counts for about half of each match score.",
  startOver: "Start over",
  skip: "Skip this step",
  skipNote: "We'll use the most common order: a fit for {name} first, then little prep, then budget, then teaching together.",
} as const;

/** Fill the {placeholders} in an approved string. */
export function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(name|wiring|approach|description|a|b|c|state)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
