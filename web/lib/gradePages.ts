/**
 * /homeschool/<grade>: one page per grade, K through 5. Added 2026-09-25.
 *
 * WHY. Families search by grade ("christian kindergarten science curriculum",
 * "3rd grade homeschool nature study"), and Pinterest's own expansion chips for
 * "christian homeschool curriculum" are "free" and then grade levels. Until now no
 * page on the site answered a grade-level search; /homeschool answers "Eden's Table".
 *
 * COPY RULES (read before editing):
 *  - Every product fact here is already on a live page (/homeschool, /starter,
 *    /starter/seedlings, /freebies, /books). Nothing new is claimed. If a line is
 *    not on one of those pages, it does not go here.
 *  - Where a family starts is the founder decision of 2026-09-24, the same rule
 *    BandChooser.astro shows: K-2 Sprouts; 3-5 new to herbs Sprouts; 3-5 who know
 *    the basics Seedlings; children in both, Sprouts together first.
 *  - No em dashes. No health claims. No kit, preorder or credit wording.
 *  - Read-aloud stories are NOT weekly (Sprouts: seven readings across the year).
 *    Never write "a story every week".
 *  - Prices: $249 set + $12 flat shipping, $39 Starter, $39.99 extra notebook.
 *    Change BandChooser.astro and the product pages first, then here.
 */

export type Band = "sprouts" | "seedlings";

export interface GradeFaq {
  q: string;
  a: string;
}

export interface GradePage {
  slug: string;
  /** Short name for breadcrumbs and link lists, e.g. "Kindergarten", "3rd grade". */
  short: string;
  /** In-sentence name, e.g. "kindergarten", "third grade". */
  inSentence: string;
  /** Band this grade belongs to. */
  band: Band;
  title: string;
  description: string;
  h1: string;
  /** First paragraph: answers the search in two sentences. */
  answer: string;
  faq: GradeFaq[];
}

const SPROUTS_OLDER_FAQ: GradeFaq = {
  q: "Should a grades 3-5 child start with Sprouts or Seedlings?",
  a: "If herbs are new to your family, start with Sprouts. Sprouts and Seedlings teach different plants, 36 each, so skipping Sprouts leaves out 36 of the 72 your child would otherwise finish with, and no later year goes back for them. If your child already knows the basics, go straight to Seedlings. Children in both bands learn Sprouts together first, then Seedlings the next year.",
};

const BABYISH_FAQ: GradeFaq = {
  q: "Will an older child find Sprouts babyish?",
  a: "The reading level is K-2. The plant work is not. An older child simply goes further within the same week: longer notebook entries, the botanical drawing done properly, and the harder questions in the Teacher's Guide. They also move faster, so a year of Sprouts often takes an older child considerably less than a year.",
};

const NO_HERBALISM_FAQ: GradeFaq = {
  q: "Do I need to know herbalism to teach it?",
  a: "No. Open the Teacher's Guide on Monday morning and the week is already built. The read-aloud is scripted, the discussion questions are written, the memory verse is chosen, and the kitchen lab tells you exactly which supplies to set on the counter.",
};

const HERBS_FAQ: GradeFaq = {
  q: "Are the herbs included?",
  a: "No. Each week uses a small amount of a common dried herb from your pantry, your garden, or the herb list we keep for families at edeninstitute.health/homeschool/herbs.",
};

export const GRADE_PAGES: readonly GradePage[] = [
  {
    slug: "kindergarten",
    short: "Kindergarten",
    inSentence: "kindergarten",
    band: "sprouts",
    title: "Christian Kindergarten Homeschool Curriculum, Science and Nature Study",
    description:
      "Eden's Table Sprouts is a Bible-based kindergarten homeschool curriculum: one plant a week for 36 weeks, written for readers and pre-readers together. Free Week 1, a $39 nine-week starter, or the printed year for $249.",
    h1: "A Christian kindergarten curriculum, one plant a week",
    answer:
      "For kindergarten, Eden's Table starts with Sprouts, the K-2 year: 36 plants learned by sight, smell and touch, with kitchen labs, memory songs and Scripture throughout. It is written for readers and pre-readers together, so a child who is not reading yet sits at the same table as an older sibling.",
    faq: [
      {
        q: "Does my kindergartner need to read?",
        a: "No. Sprouts is written for readers and pre-readers together. The read-aloud is scripted in the Teacher's Guide, and in the Student Notebook your child draws the plant she just held and records its color, smell, taste and texture.",
      },
      {
        q: "Is it too much for a five year old?",
        a: "Every lesson is written at two depths, so a younger and an older child work the same week at one table, and the enrichment work is deliberately marked optional: complete it if you have time.",
      },
      {
        q: "What subjects does it cover?",
        a: "A single week on a single plant carries Bible, science, language arts, math, art, history, geography, Latin, health, and character, and the Week at a Glance page tells you which day carries which.",
      },
      NO_HERBALISM_FAQ,
      HERBS_FAQ,
    ],
  },
  {
    slug: "first-grade",
    short: "1st grade",
    inSentence: "first grade",
    band: "sprouts",
    title: "Christian 1st Grade Homeschool Curriculum, Science and Nature Study",
    description:
      "Eden's Table Sprouts is a Bible-based first grade homeschool curriculum: 36 weeks, one plant a week, kitchen labs and memory work, with younger siblings learning at the same table. Free Week 1 or $39 for nine weeks.",
    h1: "A Christian first grade curriculum, one plant a week",
    answer:
      "For first grade, Eden's Table starts with Sprouts, the K-2 year: one plant a week for 36 weeks, taught through a kitchen lab, memory work, Scripture and a family of read-aloud stories. Every lesson is written at two depths, so a first grader and a younger sibling learn the same plant at one table.",
    faq: [
      {
        q: "Can my first grader and a younger sibling do it together?",
        a: "Yes. Sprouts covers kindergarten through second grade and every lesson is written at two depths, so you teach one week, once, to both children. Teaching more than one child? Add extra Student Notebooks at checkout, $39.99 each.",
      },
      {
        q: "What does my first grader actually do?",
        a: "The Student Notebook is the book your child fills in. She draws the plant she just held, records what it smelled like, and answers questions in her own handwriting, including some that have no answer key.",
      },
      {
        q: "What subjects does it cover?",
        a: "A single week on a single plant carries Bible, science, language arts, math, art, history, geography, Latin, health, and character, and the Week at a Glance page tells you which day carries which.",
      },
      NO_HERBALISM_FAQ,
      HERBS_FAQ,
    ],
  },
  {
    slug: "second-grade",
    short: "2nd grade",
    inSentence: "second grade",
    band: "sprouts",
    title: "Christian 2nd Grade Homeschool Curriculum, Science and Nature Study",
    description:
      "Eden's Table Sprouts is a Bible-based second grade homeschool curriculum: 36 plants in 36 weeks, with a scripted Teacher's Guide, a write-in Student Notebook and read-aloud stories. Free Week 1, $39 starter, or $249 printed.",
    h1: "A Christian second grade curriculum, one plant a week",
    answer:
      "For second grade, Eden's Table uses Sprouts, the K-2 year: 36 plants in 36 weeks, each one taught through Scripture, a kitchen lab and a write-in notebook. A second grader is the oldest in the Sprouts band, so she goes further within each week and moves on to Seedlings, a different 36 plants, in third grade.",
    faq: [
      {
        q: "Will my second grader be bored?",
        a: "Every lesson is written at two depths. An older child in Sprouts goes further within the same week: longer notebook entries, the botanical drawing done properly, and the harder questions in the Teacher's Guide.",
      },
      {
        q: "What comes after second grade?",
        a: "Seedlings, for grades 3 to 5. It teaches a different 36 plants from Sprouts, with body systems, herb profiles, and a hypothesis your child writes and then tests, so a family who does both finishes with 72.",
      },
      {
        q: "Does it help with record keeping?",
        a: "Yes. The Student Notebook is dated, sequential and in your child's own hand, showing observation, narration, scripture copywork and real measurement across thirty-six weeks.",
      },
      NO_HERBALISM_FAQ,
      HERBS_FAQ,
    ],
  },
  {
    slug: "third-grade",
    short: "3rd grade",
    inSentence: "third grade",
    band: "seedlings",
    title: "Christian 3rd Grade Homeschool Curriculum, Science and Nature Study",
    description:
      "Eden's Table for third grade: Seedlings (grades 3-5) teaches body systems, herb profiles and a weekly hypothesis, all Bible-based. New to herbs? Most families start with Sprouts. Free Week 1 for either.",
    h1: "A Christian third grade curriculum, one plant a week",
    answer:
      "For third grade, Eden's Table has two ways in. If your child already knows the plant basics, Seedlings, the grades 3-5 year, teaches body systems, herb profiles and a hypothesis tracked across a week; if herbs are new to your family, most start with Sprouts, because its 36 plants are the ones Seedlings builds on.",
    faq: [
      SPROUTS_OLDER_FAQ,
      {
        q: "What does Seedlings add for a third grader?",
        a: "Color, smell, taste and texture at K-2 become measurements, ratios, and a hypothesis at 3-5. Seedlings brings body systems, herb profiles, a hypothesis tracked across a week, and dinner-table questions with real reasoning in them.",
      },
      BABYISH_FAQ,
      NO_HERBALISM_FAQ,
      HERBS_FAQ,
    ],
  },
  {
    slug: "fourth-grade",
    short: "4th grade",
    inSentence: "fourth grade",
    band: "seedlings",
    title: "Christian 4th Grade Homeschool Curriculum, Science and Nature Study",
    description:
      "Eden's Table for fourth grade: Seedlings (grades 3-5) is a Bible-based science and nature study year with body systems, herb profiles and a weekly hypothesis. Free Week 1, a $39 nine-week starter, or $249 printed.",
    h1: "A Christian fourth grade curriculum, one plant a week",
    answer:
      "For fourth grade, Eden's Table uses Seedlings, the grades 3-5 year: a different 36 plants, with body systems, herb profiles, a hypothesis your child writes and then tests, and Scripture throughout. If herbs are new to your family, most families still start with Sprouts, because Seedlings builds on its 36 plants.",
    faq: [
      SPROUTS_OLDER_FAQ,
      BABYISH_FAQ,
      {
        q: "Can I teach a fourth grader and a younger child together?",
        a: "Yes. Teach Sprouts to everyone together first, then Seedlings the next year. You teach one week, once, to everybody, and the older child simply goes further within it.",
      },
      NO_HERBALISM_FAQ,
      HERBS_FAQ,
    ],
  },
  {
    slug: "fifth-grade",
    short: "5th grade",
    inSentence: "fifth grade",
    band: "seedlings",
    title: "Christian 5th Grade Homeschool Curriculum, Science and Nature Study",
    description:
      "Eden's Table for fifth grade: Seedlings (grades 3-5) is a Bible-based science and nature study year, one plant a week, with body systems, herb profiles and a hypothesis your child tests. Free Week 1 or $39 for nine weeks.",
    h1: "A Christian fifth grade curriculum, one plant a week",
    answer:
      "For fifth grade, Eden's Table uses Seedlings, the grades 3-5 year: 36 plants, one a week, with body systems, herb profiles and dinner-table questions with real reasoning in them, all anchored in Scripture. Cultivators, for grades 6 to 8, is planned for late 2027 and comes back to the same plants at a deeper level.",
    faq: [
      SPROUTS_OLDER_FAQ,
      {
        q: "What comes after fifth grade?",
        a: "Cultivators, for grades 6 to 8, planned for late 2027. It is the second pass at the 72 plants from Sprouts and Seedlings, this time through body patterns and terrain. Practitioners, for grades 9 to 12, is planned for 2028.",
      },
      BABYISH_FAQ,
      NO_HERBALISM_FAQ,
      HERBS_FAQ,
    ],
  },
];

export const gradePath = (g: GradePage) => `/homeschool/${g.slug}`;
