import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PractitionerWaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Retained for call-site compatibility; no signup is collected here. */
  surface?: string;
}

/**
 * Practitioner tier is deprioritized — no waitlist. This modal now simply
 * EXPLAINS the tier and tells current Eden Apothecary users they'll be the
 * first invited to beta-test it. Props are unchanged so every existing
 * trigger (Navbar, JourneyCTA, TierComparison) keeps working without edits.
 */
export function PractitionerWaitlistModal({
  open,
  onOpenChange,
}: PractitionerWaitlistModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-foreground">
            The Practitioner Tier
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground pt-2">
            The deepest tier of Eden Apothecary — formula builder, dose schedules,
            exportable case files, and the full contraindication apparatus, for
            clinicians and serious practitioners.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="font-body text-sm text-foreground leading-relaxed">
            It&rsquo;s still being built while we focus on getting the K&ndash;12 curriculum
            shipped. Here&rsquo;s our promise: <strong>current Eden Apothecary users will be
            the first invited to beta-test it</strong> &mdash; before anyone else.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            The surest way to be first in line is simply to be using the app. Start
            with any tier today, and you&rsquo;ll be on the inside when Practitioner opens.
          </p>
          <Button
            variant="eden"
            size="xl"
            className="w-full whitespace-normal text-sm sm:text-base leading-snug min-h-[48px] h-auto py-3"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PractitionerWaitlistModal;
