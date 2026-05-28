import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";

/**
 * ParentTrack (§13) — "For You, Mother" — compact tier table introducing
 * the Eden Institute parent path.
 *
 * Five rows: Tier 1 Foundations (live), Tier 2 Body Systems (waitlist),
 * Tier 3 (name TBD, waitlist), Eden Apothecary app (live, free), Back to
 * Eden book (Amazon).
 *
 * "See the Courses →" text link uses ROUTES.COURSES so a future rename
 * doesn't drift this surface (see PR #75 lesson re: routes.ts).
 */
const ROWS = [
  { tier: "Tier 1", product: "Foundations Course", status: "Live", price: "$97 Founders / $197 Public" },
  { tier: "Tier 2", product: "Body Systems & Clinical Literacy", status: "2028", price: "Waitlist" },
  { tier: "Tier 3", product: "(Name TBD)", status: "2029", price: "Waitlist" },
  { tier: "—", product: "Eden Apothecary App", status: "Live", price: "Free" },
  { tier: "—", product: "Back to Eden (the book)", status: "Live", price: "Amazon" },
];

export default function ParentTrack() {
  return (
    <section className="px-6 py-20 md:py-24" style={{ backgroundColor: "hsl(var(--cream))" }}>
      <div className="max-w-4xl mx-auto">
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-4 text-center font-sans"
          style={{ color: "hsl(var(--honey))" }}
        >
          For You, Mother
        </p>
        <h2
          className="font-serif text-3xl md:text-4xl text-center mb-6"
          style={{ color: "hsl(var(--ink))" }}
        >
          Eden Institute — The Parent Path.
        </h2>
        <p
          className="text-center max-w-2xl mx-auto mb-10 text-base"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Eden's Table is the family doorway into Eden Institute. As your
          child learns, you can begin your own adult education — three tiers
          building toward genuine clinical competence.
        </p>

        <div
          className="rounded-sm overflow-hidden"
          style={{ border: "1px solid hsl(var(--sage-pale))" }}
        >
          <div
            className="hidden min-[880px]:grid grid-cols-[1fr_2fr_1fr_2fr] px-5 py-3 text-[11px] uppercase tracking-[0.15em] font-sans"
            style={{ backgroundColor: "hsl(var(--cream-warm))", color: "hsl(var(--ink-soft))" }}
          >
            <span>Tier</span>
            <span>Product</span>
            <span>Status</span>
            <span>Price</span>
          </div>
          {ROWS.map((r, i) => (
            <div
              key={`${r.tier}-${r.product}`}
              className="px-5 py-4 grid grid-cols-1 min-[880px]:grid-cols-[1fr_2fr_1fr_2fr] gap-2 items-center"
              style={{
                backgroundColor: i % 2 === 0 ? "hsl(var(--cream-light))" : "hsl(var(--cream))",
              }}
            >
              <span className="text-xs uppercase tracking-wide" style={{ color: "hsl(var(--honey))" }}>{r.tier}</span>
              <span className="text-base font-serif" style={{ color: "hsl(var(--ink))" }}>{r.product}</span>
              <span className="text-sm" style={{ color: "hsl(var(--ink-soft))" }}>{r.status}</span>
              <span className="text-sm" style={{ color: "hsl(var(--green-deep))" }}>{r.price}</span>
            </div>
          ))}
        </div>

        <p
          className="text-center text-sm mt-8 italic"
          style={{ color: "hsl(var(--ink-soft))" }}
        >
          Mothers who begin Foundations now reach genuine clinical literacy by
          the time their children enter Practitioners band.
        </p>

        <div className="text-center mt-6">
          <Link
            to={ROUTES.COURSES}
            className="text-sm tracking-wide underline font-sans"
            style={{ color: "hsl(var(--green-deep))" }}
          >
            See the Courses →
          </Link>
        </div>
      </div>
    </section>
  );
}
