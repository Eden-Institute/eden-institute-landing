import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TierTwoWaitlistForm } from "./TierTwoWaitlistForm";

interface TierTwoWaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional surface tag, written into analytics on submit so the
   * post-launch Leads Intelligence dashboard can distinguish a homepage
   * tile open from another surface. Defaults to 'tier_two_homepage_card'.
   */
  surface?: string;
}

/**
 * PR η fix #2 — Tier 2 waitlist as a one-click modal.
 *
 * The Tier 2 card on the homepage previously routed to a dedicated
 * /tier-2-waitlist landing page where the visitor had to scroll to the
 * inline form. That bounced two clicks for the same conversion intent.
 * Per Camila's spec, the homepage card now opens this modal directly
 * with the email form prominent. The /tier-2-waitlist page remains as
 * fallback for direct visitors and SEO — the page still carries the
 * timeline copy, the founding-benefits cards, and the form for visitors
 * who arrive from external links.
 *
 * Reuses TierTwoWaitlistForm (same EF, same validation) so we don't
 * have two copies of the body shape drifting against each other. EF is
 * tier-2-waitlist-signup v18 (hot-fixed to return=minimal in a sibling
 * task on 2026-05-02).
 */
export function TierTwoWaitlistModal({
  open,
  onOpenChange,
  surface = "tier_two_homepage_card",
}: TierTwoWaitlistModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-foreground">
            Tier 2 Is Coming
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground pt-2">
            Tier 2 — Body Systems &amp; Clinical Literacy — is on the way. Start with Tier 1 to build the
            foundation and be first to hear when it opens.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          <TierTwoWaitlistForm surface={surface} variant="modal" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TierTwoWaitlistModal;
