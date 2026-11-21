// The grade 6-12 waitlist form (web/lib/bandWaitlist.ts), opened from the Curriculum Finder's coming-soon cards and
// the Wired results page's coming-soon line. The modal is loaded only when a mom taps "Join the waitlist": it touches
// localStorage at module load, so never during the build.
import { lazy, Suspense } from "react";
import { bandWaitlistProps, type UpperBand } from "../../lib/bandWaitlist";

const WaitlistModal = lazy(() => import("@/components/landing/WaitlistModal"));

export default function BandWaitlistModal({ band, formName, onClose }: { band: UpperBand | null; formName: string; onClose: () => void }) {
  if (!band) return null;
  return (
    <Suspense fallback={null}>
      <WaitlistModal open onOpenChange={(o) => { if (!o) onClose(); }} {...bandWaitlistProps(band, formName)} />
    </Suspense>
  );
}
