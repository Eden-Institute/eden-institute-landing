// Fearfully & Wonderfully Wired, W11: the quiz buttons and the exit pop-up, word for word from Camila's approved
// copy (Wired_Quiz_Buttons_and_Popup.md, APPROVED 2026-11-19 5:14 PM CT; spec answer 36). Launch with version A
// everywhere; the first test is the pop-up taking turns with the existing exit box, then the header and
// /homeschool A/B lines one at a time (version B is kept here for that later test).
//
// Every button links to /wired inside the site: no UTM (it would erase the visitor's real source). ?p=<placement>
// lets the quiz record which button sent her (WiredQuiz reads it into attribution.placement), and the click beacon
// counts record_cta_click('wired', page, placement). Nothing renders until WIRED_IS_PUBLIC (the one launch switch).

export { WIRED_IS_PUBLIC } from "../../supabase/functions/_shared/wired-launch";

export type WiredPlacement =
  | "header" | "homeschool_inline" | "sample_inline" | "freebies_inline" | "esa_inline" | "home_inline"
  | "bodypattern_results" | "blog_end" | "exit_popup";

export interface WiredCard { headline?: string; text: string; button: string }

export const WIRED_CARDS: Record<Exclude<WiredPlacement, "header" | "exit_popup">, WiredCard> = {
  homeschool_inline: {
    headline: "How is your child wired?",
    text: "A free, 8-minute quiz for homeschool moms: your child's strengths and interests right now, and curriculum that fits them and your real life.",
    button: "Take the free quiz",
  },
  sample_inline: {
    headline: "Before you choose curriculum, see how your child is wired",
    text: "Free, about 8 minutes. You'll get your child's top 3 wirings and curriculum matches from the whole market, Eden's Table included and scored by the same rules.",
    button: "Start the quiz",
  },
  freebies_inline: {
    headline: "One more free one: Fearfully & Wonderfully Wired",
    text: "See how God wired each of your kids, in about 8 minutes.",
    button: "Take the quiz",
  },
  esa_inline: {
    headline: "Using ESA funds? Find curriculum that fits your child",
    text: "Our free quiz shows how your child is wired, and you can narrow the matches to options that are ESA-eligible in [State].",
    button: "Take the free quiz",
  },
  home_inline: {
    headline: "Every child is wired on purpose",
    text: "Find out how yours is, free, in about 8 minutes.",
    button: "Take the Wired quiz",
  },
  bodypattern_results: {
    headline: "Homeschooling too?",
    text: "Our free kids' quiz shows how God wired each of your children, and finds curriculum that fits them.",
    button: "Take the kids' quiz",
  },
  blog_end: {
    text: "Wondering how your child is wired? Take our free, 8-minute quiz.",
    button: "Take the quiz",
  },
};

/** Version B lines, held for the one-at-a-time tests after the pop-up test reads out. */
export const WIRED_B = { header: "Free Kids' Quiz", homeschoolHeadline: "See how God wired your child" } as const;

export const WIRED_POPUP = {
  A: { headline: "Before you go: how is your child wired?", text: "Free, about 8 minutes, with curriculum matches that fit your real life.", yes: "Take the quiz", no: "No thanks" },
  B: { headline: "Free for homeschool moms", text: "See your child's top 3 strengths right now, plus 3 things to try this week.", yes: "Show me", no: "Maybe later" },
} as const;

export const wiredHref = (placement: WiredPlacement) => `/wired?p=${placement}`;
