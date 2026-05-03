import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEdenPattern } from "@/hooks/useEdenPattern";
import { useTierAwareCTA } from "@/hooks/useTierAwareCTA";
import { ROUTES } from "@/lib/routes";
import PractitionerWaitlistModal from "@/components/landing/PractitionerWaitlistModal";

// PR #52 v3.33: Apothecary nav entry added between "Why Eden" and the
// CTA per founder Q3 authorization. Links to the public marketing landing
// /apothecary/start (Lock #47 framing surface).
const navLinks = [
  { label: "Home", href: ROUTES.HOME },
  { label: "Courses", href: ROUTES.COURSES },
  { label: "Homeschool", href: ROUTES.HOMESCHOOL },
  { label: "Community", href: ROUTES.COMMUNITY },
  { label: "Why Eden", href: ROUTES.WHY_EDEN },
  { label: "Apothecary", href: ROUTES.APOTHECARY_START },
];

// PR ι (iota): the canonical anchor used by useTierAwareCTA() for the
// practitioner-waitlist upgrade step. Detecting via href (rather than
// adding a "kind" discriminator to the upgrade slot) keeps the change
// narrow and tier-agnostic — any tier whose upgrade slot resolves to
// this anchor (Seed/Root/Practitioner today and going forward per
// Camila's PR ι clarification on multi-profile tier coverage) gets
// the modal-trigger treatment automatically.
const PRACTITIONER_WAITLIST_ANCHOR = "/apothecary#practitioner-waitlist";

/**
 * §8.1.1 (Manual v4.0) — State-aware Navbar CTA.
 *
 * Right-aligned desktop button: "Take the Quiz" (anon / no-Pattern)
 * or "Open Apothecary" (authed with Pattern). Unchanged from
 * v4.1.1 — desktop scope is intentional per Camila's 2026-04-30
 * mobile-only spec for the new tier-aware CTAs.
 *
 * Mobile hamburger drawer: renders three state-aware CTAs (Upgrade +
 * Guide + Amazon Kit) above the existing primary button. Driven by
 * useTierAwareCTA() which centralizes the (auth, Pattern, tier,
 * guide-purchased, amazonKitUrl) → (upgrade, guide, amazonKit) state
 * machine. See src/hooks/useTierAwareCTA.ts for the matrix.
 *
 * The Amazon kit slot is the only external-link CTA in the trio —
 * opens in a new tab with rel="noopener noreferrer sponsored" (Google's
 * affiliate-disclosure attribute) and is followed by an FTC affiliate
 * disclosure footer.
 *
 * ─────────────────────────────────────────────────────────────────
 * PR ι (iota) — dual-CTA practitioner waitlist.
 * ─────────────────────────────────────────────────────────────────
 *
 * The tier-aware upgrade slot, when its href resolves to the
 * practitioner-waitlist anchor, switches from a single Link to a
 * primary modal-trigger button + secondary "Learn more about the
 * Practitioner tier" link. Collapses the structural 2-click flow
 * (drawer Link → /apothecary navigation → scroll past the full herb
 * directory → reach the inline form → submit) into 1-click direct
 * modal open.
 *
 * Tier-agnostic by design: detects on href, not the user's tier.
 * Per Camila's PR ι clarification (2026-05-02), the 2-click flow
 * shows up on every tier that supports multi-profile switching —
 * Seed (up to 5 profiles), Root (up to 10), and Practitioner
 * (up to 500). Today the practitioner-waitlist anchor only resolves
 * for Root in useTierAwareCTA, but this branch fires for any tier
 * the state machine surfaces it to without further changes here.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  // PR ι: separate modal-open state. Decoupled from drawer-open so the
  // modal stays interactive after we close the drawer on the same
  // click (drawer collapses, modal appears, focus moves into form).
  const [practitionerModalOpen, setPractitionerModalOpen] = useState(false);
  const { user } = useAuth();
  const { data: pattern } = useEdenPattern();
  const { upgrade, guide, amazonKit } = useTierAwareCTA();

  const ctaLabel = user && pattern ? "Open Apothecary" : "Take the Quiz";
  const ctaHref = user && pattern ? ROUTES.APOTHECARY : ROUTES.ASSESSMENT;

  // PR ι: tier-agnostic detection via href. Future state-machine
  // tweaks that add Seed/Practitioner to the practitioner-waitlist
  // step inherit the modal-trigger behaviour automatically.
  const upgradeIsPractitionerWaitlist =
    upgrade?.href === PRACTITIONER_WAITLIST_ANCHOR;

  return (
    <header className="w-full bg-[#FAF8F3] border-b border-[#D6CDB8] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to={ROUTES.HOME} className="flex flex-col leading-tight">
          <span className="font-serif text-xl text-[#3B4A3F] tracking-wide">The Eden Institute</span>
          <span className="text-xs text-[#7A8C7E] tracking-widest uppercase font-sans">Biblical Herbalism Education</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide transition-colors duration-200">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link to={ctaHref} className="bg-[#3B4A3F] text-[#FAF8F3] text-sm font-sans px-5 py-2 rounded-sm tracking-wide hover:bg-[#2E3D32] transition-colors duration-200">
            {ctaLabel}
          </Link>
        </div>
        <button className="md:hidden text-[#3B4A3F]" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#FAF8F3] border-t border-[#D6CDB8] px-6 pb-6 pt-4 flex flex-col gap-5">
          {/* Plain navigation links */}
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} onClick={() => setOpen(false)} className="text-sm font-sans text-[#4A5C4E] hover:text-[#2E3D32] tracking-wide">
              {link.label}
            </Link>
          ))}

          {/* Tier-aware CTA trio (Camila's 2026-04-30 spec). Visually
              distinct from plain nav links via gold border + tinted
              background. Upgrade slot is suppressed when null (Root /
              Practitioner). Amazon kit slot is suppressed when null
              (anon / no-Pattern).

              PR ι (iota): when the upgrade slot resolves to the
              practitioner-waitlist anchor, render a dual-CTA pair —
              primary modal-trigger button + secondary "Learn more"
              link — instead of a single Link. */}
          <div className="border-t border-[#D6CDB8] pt-4 flex flex-col gap-3">
            {upgrade && upgradeIsPractitionerWaitlist ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setPractitionerModalOpen(true);
                  }}
                  data-cta="tier-aware-upgrade"
                  data-cta-kind="practitioner-waitlist-modal"
                  className="text-sm font-sans text-[#3B4A3F] border border-[#C9A84C] bg-[#C9A84C]/10 px-4 py-3 rounded-sm tracking-wide text-center hover:bg-[#C9A84C]/20 transition-colors duration-200 leading-snug"
                >
                  {upgrade.label}
                </button>
                <Link
                  to={PRACTITIONER_WAITLIST_ANCHOR}
                  onClick={() => setOpen(false)}
                  data-cta="tier-aware-upgrade-learn-more"
                  className="text-xs font-sans text-[#7A8C7E] hover:text-[#3B4A3F] tracking-wide text-center underline-offset-4 hover:underline transition-colors duration-200"
                >
                  Learn more about the Practitioner tier →
                </Link>
              </>
            ) : upgrade ? (
              <Link
                to={upgrade.href}
                onClick={() => setOpen(false)}
                data-cta="tier-aware-upgrade"
                className="text-sm font-sans text-[#3B4A3F] border border-[#C9A84C] bg-[#C9A84C]/10 px-4 py-3 rounded-sm tracking-wide text-center hover:bg-[#C9A84C]/20 transition-colors duration-200 leading-snug"
              >
                {upgrade.label}
              </Link>
            ) : null}
            <Link
              to={guide.href}
              onClick={() => setOpen(false)}
              data-cta="tier-aware-guide"
              className="text-sm font-sans text-[#3B4A3F] border border-[#C9A84C] bg-[#C9A84C]/10 px-4 py-3 rounded-sm tracking-wide text-center hover:bg-[#C9A84C]/20 transition-colors duration-200 leading-snug"
            >
              {guide.label}
            </Link>
            {amazonKit && (
              <>
                <a
                  href={amazonKit.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => setOpen(false)}
                  data-cta="tier-aware-amazon-kit"
                  aria-label={`${amazonKit.label} (opens in a new tab)`}
                  className="text-sm font-sans text-[#3B4A3F] border border-[#C9A84C] bg-[#C9A84C]/10 px-4 py-3 rounded-sm tracking-wide text-center hover:bg-[#C9A84C]/20 transition-colors duration-200 leading-snug"
                >
                  {amazonKit.label}
                </a>
                {/* FTC affiliate disclosure (matches MatchedHerbsCtaPair
                    wording in PR #72 for cross-surface consistency). */}
                <p className="text-[11px] text-[#7A8C7E] italic text-center leading-snug px-2">
                  Affiliate links — Eden Institute earns a small commission at no extra cost to you.
                </p>
              </>
            )}
          </div>

          {/* Existing primary CTA (preserved) — the simpler
              "Take the Quiz" / "Open Apothecary" pivot remains the
              hamburger's bottom-most action. */}
          <Link to={ctaHref} onClick={() => setOpen(false)} className="bg-[#3B4A3F] text-[#FAF8F3] text-sm font-sans px-5 py-2 rounded-sm tracking-wide text-center hover:bg-[#2E3D32] transition-colors duration-200">
            {ctaLabel}
          </Link>
        </div>
      )}
      {/* PR ι (iota): mounted at navbar root so the modal is reachable
          whenever the upgrade slot above resolves to the practitioner
          waitlist. Only opens via the modal-trigger button branch. */}
      <PractitionerWaitlistModal
        open={practitionerModalOpen}
        onOpenChange={setPractitionerModalOpen}
        surface="navbar_tier_aware_upgrade"
      />
    </header>
  );
}
