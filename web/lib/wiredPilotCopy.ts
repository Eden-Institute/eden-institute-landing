// Fearfully & Wonderfully Wired, W12: the pilot page /wired/pilot, word for word from Camila's approved copy
// (Wired_Quiz_Pilot_Pieces.md, APPROVED 2026-11-19 3:21 PM CT; spec answer 33). The two UMUX-LITE statements must
// stay exactly as published (Lewis, Utesch and Maher, 2013).
// One line is NOT approved yet: the thank-you's "[date]" (no date has been given). Until Camila gives one, the page
// leaves the date out (PILOT_REPLY_BY = null); it never invents one.

export const PILOT_REPLY_BY: string | null = null;

export const PILOT = {
  heading: "Help us test Fearfully & Wonderfully Wired",
  intro: "We're looking for 30 to 50 homeschool families to try our new quiz before it opens to everyone. It helps you see how God wired each child right now, and matches them with curriculum that fits your real life.",
  get: "What you get, free: your child's full results, the Learner Blueprint ($19), the Family Learning Map ($47), two advance chapters of Camila's upcoming book, Unschooled by Design, and a spot on our Founding Families list (only if you'd like your name there).",
  ask: "What we ask, over about a month: take the quiz, answer 4 short surveys (a few minutes each), and retake the quiz once after 30 days.",
  pick: "We'll pick about 10 to 12 families for each grade group (K-2, 3-5, 6-8 and 9-12) so every age is covered. If you're not picked this round, you can still take the free quiz when it opens to everyone.",
  firstName: "Your first name",
  email: "Your email",
  state: "Your state",
  years: { q: "How long have you homeschooled?", options: [["starting", "Just starting"], ["under_1", "Less than a year"], ["1_2", "1 to 2 years"], ["3_5", "3 to 5 years"], ["6_plus", "6 years or more"]] as [string, string][] },
  kids: { q: "How many children are you homeschooling this year?", options: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5plus", "5 or more"]] as [string, string][] },
  eachChild: "For each child: a nickname (no last names) and their grade this school year",
  approachQ: "How would you describe the way you homeschool right now?",
  heard: { q: "How did you hear about Eden?", options: [["facebook_group", "A Facebook group"], ["instagram", "Instagram"], ["podcast", "A podcast"], ["eden_email", "Eden's email"], ["friend", "A friend"], ["other", "Somewhere else"]] as [string, string][] },
  commitment: "I can take the quiz for at least one child, answer 4 short surveys over about a month, and retake the quiz once after 30 days.",
  button: "Apply to be a tester",
  thanksWithDate: "Thank you! We'll email you by [date] to let you know if you're in this round.",
  smallPrint: "We use your answers only to choose a balanced group of families and to run the test. We never sell your information.",
  everySurvey: "You get every reward for finishing the surveys, whether your feedback is positive, negative or mixed. Honest answers help us most.",
} as const;

/** The advance chapters on the tester page. APPROVED 2026-11-20 ~6:31 PM CT (Wired_Quiz_Pilot_Pieces.md section 6). */
export const CHAPTERS_COPY = {
  heading: "Your advance chapters",
  line: "Thank you for testing the quiz. Here's your gift: early chapters of my upcoming book, Unschooled by Design.",
  button: { 1: "Read Chapter 1: The Mouth of the South", 4: "Read Chapter 4: Judge a Fish" } as Record<1 | 4, string>,
};

/** The thank-you line: the approved sentence with her date, or (until she gives one) the same sentence without it. */
export function pilotThanks(): string {
  return PILOT_REPLY_BY ? PILOT.thanksWithDate.replace("[date]", PILOT_REPLY_BY) : PILOT.thanksWithDate.replace(" by [date]", "");
}

const AGREE7 = ["1 Strongly disagree", "2", "3", "4", "5", "6", "7 Strongly agree"];
const USEFUL5 = ["Not at all", "A little", "Somewhat", "Very", "Extremely"];
const FIT5 = ["Not at all", "A little", "Somewhat", "Very well", "Exactly"];

export type Q =
  | { key: string; kind: "scale7"; label: string; options: string[] }
  | { key: string; kind: "choice"; label: string; options: string[]; optional?: boolean }
  | { key: string; kind: "multi"; label: string; options: string[] }
  | { key: string; kind: "text"; label: string }
  | { key: string; kind: "perWiring"; label: string; options: string[] };

export const SURVEYS: Record<"ux" | "accuracy" | "family_map" | "retake", { title: string; top?: string; questions: Q[] }> = {
  ux: {
    title: "Survey 1",
    top: "About 2 minutes. Thinking about the quiz you just took:",
    questions: [
      { key: "capabilities", kind: "scale7", label: "This system's capabilities meet my requirements.", options: AGREE7 },
      { key: "easy", kind: "scale7", label: "This system is easy to use.", options: AGREE7 },
      { key: "confusing", kind: "text", label: "Was any question confusing or hard to answer? (optional: which one, and why)" },
      { key: "length", kind: "choice", label: "How long did it feel?", options: ["Shorter than I expected", "About right", "Longer than I expected"], optional: true },
      { key: "device", kind: "choice", label: "What did you use?", options: ["Phone", "Tablet", "Computer"], optional: true },
      { key: "fix", kind: "text", label: "Anything else we should fix? (optional)" },
    ],
  },
  accuracy: {
    title: "Survey 2",
    questions: [
      { key: "overall", kind: "choice", label: "How well do [Nickname]'s top 3 wirings describe them right now?", options: FIT5 },
      { key: "each", kind: "perWiring", label: "Does [Wiring] sound like [Nickname]?", options: ["Yes", "Somewhat", "No"] },
      { key: "missed", kind: "choice", label: "Is there a wiring we missed?", options: ["Storyteller", "Organizer", "Designer", "Maker", "Psalmist", "Connector", "Ponderer", "Cultivator", "Seeker", "None"], optional: true },
      { key: "edges", kind: "choice", label: "How well do the growing edges fit [Nickname]?", options: FIT5, optional: true },
      { key: "matches", kind: "choice", label: "How useful were the curriculum matches?", options: USEFUL5, optional: true },
      { key: "worried", kind: "choice", label: "Did anything in the results make you feel worried, or like [Nickname] was being labeled?", options: ["No", "Yes"], optional: true },
      { key: "worried_what", kind: "text", label: "Yes (tell us what, if you'd like)" },
      { key: "surprising", kind: "text", label: "Anything surprising? (optional, a sentence or two)" },
    ],
  },
  family_map: {
    title: "Survey 3",
    questions: [
      { key: "used", kind: "multi", label: "Which parts have you used so far? (tick all)", options: ["Subject plan", "Daily rhythm", "Quick tips", "Prayer page", "Teaching together", "Family week", "Siblings page", "Curriculum matches", "None yet"] },
      { key: "blueprint_useful", kind: "choice", label: "How useful has the Blueprint been so far?", options: USEFUL5, optional: true },
      { key: "map_useful", kind: "choice", label: "How useful has the Family Map been so far?", options: USEFUL5, optional: true },
      { key: "changed", kind: "text", label: "What, if anything, have you changed in your homeschool because of it? (optional)" },
      { key: "missing", kind: "text", label: "What was missing or confusing? (optional)" },
      { key: "recommend", kind: "choice", label: "Would you recommend the quiz to a friend?", options: ["Yes", "Maybe", "No"] },
      { key: "quote", kind: "text", label: "Optional: a sentence or two we could quote" },
      { key: "quote_permission", kind: "choice", label: "May we use your first name and state with it?", options: ["Yes", "No"], optional: true },
      { key: "badge", kind: "choice", label: "Optional: add my name to the Founding Families list?", options: ["Yes", "No thanks"], optional: true },
      { key: "badge_name", kind: "text", label: "Yes, as: ____" },
    ],
  },
  retake: {
    title: "Survey 4",
    top: "This is a one-month stability check: we're seeing whether the quiz gives a similar picture twice. Some change is normal, because kids really do change.",
    questions: [
      { key: "big_change", kind: "choice", label: "Has anything big changed for [Nickname] in the last month (a new interest, a move, an illness, a new baby)?", options: ["No", "Yes"] },
      { key: "big_change_what", kind: "text", label: "Yes (what, if you'd like)" },
      { key: "answered_differently", kind: "choice", label: "Did you answer any questions differently on purpose this time?", options: ["No", "Yes"] },
      { key: "answered_differently_which", kind: "text", label: "Yes (which, if you remember)" },
    ],
  },
};

/** The approved disclosure, next to every pilot quote, same size, never behind a link (16 CFR 255.5). */
export const TESTIMONIAL_DISCLOSURE = "Pilot tester. Received the Learner Blueprint, the Family Learning Map and two advance chapters of Unschooled by Design free for answering our surveys, whatever their feedback.";
