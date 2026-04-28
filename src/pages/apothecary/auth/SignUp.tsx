import { Link } from "react-router-dom";
import { AuthForm } from "@/components/apothecary/AuthForm";

export default function SignUp() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-6">
      <div className="max-w-md w-full space-y-4">
        <div
          className="rounded-lg p-8 shadow-sm border bg-background"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <AuthForm mode="signup" />
        </div>

        {/* Phase 5 fix #1: spam-folder disclaimer.
            Hotmail / Outlook / Yahoo aggressively filter first-sender
            emails. Setting expectations here prevents the “I never got
            the confirmation email” support load. */}
        <p
          className="font-body text-xs leading-relaxed text-center px-2"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          After signing up, check your <strong>spam or junk folder</strong> if
          the confirmation email doesn&rsquo;t arrive within 5 minutes —
          Hotmail, Outlook, and Yahoo sometimes filter our first emails. Add{" "}
          <Link
            to="#"
            onClick={(e) => e.preventDefault()}
            className="underline"
          >
            hello@edeninstitute.health
          </Link>{" "}
          to your contacts to make sure future emails reach your inbox.
        </p>
      </div>
    </div>
  );
}
