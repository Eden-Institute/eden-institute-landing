import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/homeschool/Hero";
import FounderLetter from "@/components/homeschool/FounderLetter";
import ThreePillars from "@/components/homeschool/ThreePillars";
import CoLearnerPromise from "@/components/homeschool/CoLearnerPromise";
import WeeklyRhythm from "@/components/homeschool/WeeklyRhythm";
import EightProducts from "@/components/homeschool/EightProducts";
import HatFramework from "@/components/homeschool/HatFramework";
import FourBands from "@/components/homeschool/FourBands";
import PricingCenterpiece from "@/components/homeschool/PricingCenterpiece";
import AlaCarteTable from "@/components/homeschool/AlaCarteTable";
import CoopLicense from "@/components/homeschool/CoopLicense";
import Faq from "@/components/homeschool/Faq";
import ParentTrack from "@/components/homeschool/ParentTrack";
import FinalCta from "@/components/homeschool/FinalCta";
import { useDocumentMeta } from "@/lib/useDocumentMeta";

/**
 * Homeschool (/homeschool) — Eden's Table revamp per
 * Eden_Table_Homeschool_Page_Implementation_Spec v1.5.
 *
 * v1.5 supersedes the v1.4 partner-positioning stub (commit 791fcb8).
 * The page is now a 15-section conversion surface for the August 1, 2026
 * launch of Sprouts (K-2) and Seedlings (3-5).
 *
 * Composition: Navbar + 13 section components + landing Footer.
 *  §0  Navbar (reused, has "Eden's Table" link to /homeschool already)
 *  §1  Hero — dual lead-magnet CTAs
 *  §2  FounderLetter
 *  §3  ThreePillars
 *  §4  CoLearnerPromise (key positioning)
 *  §5  WeeklyRhythm (Mon-Fri from Wk 02 master)
 *  §6  EightProducts (conversion engine)
 *  §7  HatFramework
 *  §8  FourBands (K-12 ladder)
 *  §9  PricingCenterpiece (centerpiece, dark green band)
 *  §10 AlaCarteTable
 *  §11 CoopLicense (new SKU)
 *  §12 Faq
 *  §13 ParentTrack
 *  §14 FinalCta (urgency close)
 *  §15 Footer (reused from landing)
 *
 * SEO: useDocumentMeta sets title / description / canonical / theme.
 * OG image hook + the founder photo + the 8 Canva product mockups all
 * land in the asset delivery pass (target July 22, 2026 per spec
 * Open Questions #6 + #7).
 *
 * Funnel signal: the entry funnel value remains canonical "edens_table"
 * per Camila's 2026-05-02 consolidation decision. Per-CTA lead_magnet
 * + band_waitlist + coop_license_application metadata fields let Resend
 * segment without needing additional audience IDs.
 *
 * Stripe checkout IDs across the page are placeholders that surface a
 * visible alert + console.warn on click. Phase 2 of the POD Setup
 * Timeline wires the 26 live-mode price IDs (target July 22-28).
 */
const Homeschool = () => {
  useDocumentMeta({
    title:
      "Eden's Table — A K-12 Herbalism Curriculum | The Eden Institute",
    description:
      "Open-and-go K-12 herbalism curriculum for the family. 36 weeks per year, Scripture at every turn, built by a credentialed teacher. Sprouts + Seedlings launch August 1, 2026.",
    canonical: "https://edeninstitute.health/homeschool",
  });

  return (
    <div className="min-h-screen bg-background" id="top">
      <Navbar />
      <Hero />
      <FounderLetter />
      <ThreePillars />
      <CoLearnerPromise />
      <WeeklyRhythm />
      <EightProducts />
      <HatFramework />
      <FourBands />
      <PricingCenterpiece />
      <AlaCarteTable />
      <CoopLicense />
      <Faq />
      <ParentTrack />
      <FinalCta />
      <Footer />
    </div>
  );
};

export default Homeschool;
