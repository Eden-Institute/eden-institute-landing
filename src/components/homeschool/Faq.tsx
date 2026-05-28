import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Faq (§12) — 10-question accordion + brief refusal line.
 *
 * Verbatim Q&A from spec v1.5 §12. Refund question (#10) uses the v1.5
 * launch default:
 *  "30-day refund on physical products if shipped damaged. Digital lead
 *  magnets and Co-op License are non-refundable once delivered."
 * Founder can red-line in PR review before squash-merge.
 *
 * Below the accordion: the brief refusal line that ends the FAQ block.
 * This is doctrinal positioning copy — don't soften.
 */
const FAQS = [
  {
    q: "What subjects does Eden's Table count as in our homeschool?",
    a: "Science (botany, anatomy, body systems), Bible/theology, life skills, ELA (chants, vocabulary spine, story comprehension, write-in prompts), Math (Wednesday Kitchen Lab measurement, slow-medicine ratios, timing), and History (ancient herbalism traditions, Creation Care Timeline). HAT badges on every product show which subjects each piece engages.",
  },
  {
    q: "How much time per day does it take?",
    a: "25–40 minutes for Sprouts. 35–55 minutes for Seedlings. Five days a week.",
  },
  {
    q: "Do my children need to be the right grade?",
    a: "Multi-age by design. Sprouts works for K-2, Seedlings for 3-5. Siblings can stack — older students go deeper through Garden Journal pointers and additional Notebook prompts.",
  },
  {
    q: "Do I need any herbalism background to teach this?",
    a: "No. The Teacher Guide is written for the parent with zero prior knowledge. The Foundations Course (sold separately) is for parents who want their own adult herbalism education alongside.",
  },
  {
    q: "What denomination is this written from?",
    a: "Grounded in Biblical truth. Reformed theological lean underneath; broadly accessible to all Bible-believing Christian families. Scripture is NASB.",
  },
  {
    q: "Will this work for my family if we don't have a garden?",
    a: "Yes. Garden activities are optional and scalable to windowsill / community garden / forest walk. Wednesday Kitchen Lab is the load-bearing activity and requires no garden.",
  },
  {
    q: "What's the difference between Eden's Table and the Foundations Course?",
    a: "Eden's Table is the K-12 family curriculum (for children, taught by the parent). The Foundations Course is the adult Tier 1 of Eden Institute (for the parent's own herbalism education). Many families buy both — the Mother + Family Founders Package combines them at a discount.",
  },
  {
    q: "Is this compatible with Charlotte Mason, classical, Tuttle Twins, or other pedagogies?",
    a: "Yes. Eden's Table is multi-age, hands-on, scripture-anchored, and rigorous — pair freely with whichever pedagogy you're already using.",
  },
  {
    q: "How does shipping work?",
    a: "Print-on-demand through Lulu Direct (books) and The Game Crafter (cards). Your order arrives in 10–14 days as two packages (books + cards). Free shipping over $149; $9.99 flat below.",
  },
  {
    q: "What if it's not for my family — can I get a refund?",
    a: "30-day refund on physical products if shipped damaged. Digital lead magnets and the Co-op License are non-refundable once delivered. The two free sample weeks are designed so you can evaluate the curriculum before committing to a band purchase.",
  },
];

export default function Faq() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream-light))" }}>
      <div className="max-w-3xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          Questions Mothers Have Asked
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-12"
          style={{ color: "hsl(var(--ink))" }}
        >
          FAQ.
        </h2>

        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((item, i) => (
            <AccordionItem key={i} value={`q-${i}`} style={{ borderColor: "hsl(var(--sage-pale))" }}>
              <AccordionTrigger
                className="text-left font-serif text-lg min-h-[56px]"
                style={{ color: "hsl(var(--ink))" }}
              >
                {item.q}
              </AccordionTrigger>
              <AccordionContent
                className="text-base leading-relaxed"
                style={{ color: "hsl(var(--ink-soft))" }}
              >
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div
          className="mt-12 p-6 rounded-sm text-sm leading-relaxed italic"
          style={{
            backgroundColor: "hsl(var(--cream))",
            border: "1px solid hsl(var(--sage-pale))",
            color: "hsl(var(--ink-soft))",
          }}
        >
          Eden's Table is rooted in Western clinical herbalism tradition
          (Eclectic, Physiomedical, Vitalist) and Scripture. We do not teach
          chakras, doshas, moon cycles, or any framework that locates the
          source of vital force outside the Holy Spirit. If you've shopped
          Christian herbalism curricula and quietly noticed Eastern frameworks
          beneath the surface — this isn't that.
        </div>
      </div>
    </section>
  );
}
